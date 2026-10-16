import { SplitBill, SplitConfig, BankVoucherEntry } from '../types';
import { parseStatementDate } from './dateParse';
import { formatVoucherNo } from './voucherNo';
import { computeFromTaxablePaise, toPaise } from './gstMath';

export function getStoredCompanyName(fallback: string = ''): string {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem('atits_tally_company') || fallback;
    }
  } catch {}
  return fallback;
}

function rawFormatTallyDate(isoDate?: string | null): string {
  const str = typeof isoDate === 'string' ? isoDate.trim() : '';
  if (!str) {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  }
  const iso = parseStatementDate(str);
  if (!iso) throw new Error(`Unreadable date "${str}". Fix the date and push again.`);
  return iso.replace(/-/g, '');
}

/**
 * Tally educational mode only accepts vouchers dated the 1st, 2nd or last day of a month.
 * When enabled (localStorage 'atits_tally_edu' = '1'), dates are moved to the nearest allowed day
 * so test pushes succeed. Licensed Tally needs this OFF — real dates must be kept.
 */
export function isEducationalMode(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem('atits_tally_edu') === '1';
  } catch {
    return false;
  }
}

export function setEducationalMode(on: boolean): void {
  try {
    window.localStorage.setItem('atits_tally_edu', on ? '1' : '0');
  } catch {}
}

export function clampToEducationalDate(yyyymmdd: string): string {
  if (!/^\d{8}$/.test(yyyymmdd)) return yyyymmdd;
  const y = parseInt(yyyymmdd.slice(0, 4), 10);
  const m = parseInt(yyyymmdd.slice(4, 6), 10);
  const d = parseInt(yyyymmdd.slice(6, 8), 10);
  const last = new Date(y, m, 0).getDate();
  const nearest = [1, 2, last].reduce((a, b) => (Math.abs(b - d) < Math.abs(a - d) ? b : a));
  return `${yyyymmdd.slice(0, 6)}${String(nearest).padStart(2, '0')}`;
}

export function formatTallyDate(isoDate?: string | null): string {
  const base = rawFormatTallyDate(isoDate);
  return isEducationalMode() ? clampToEducationalDate(base) : base;
}

/**
 * Escapes XML strings safely, stripping any preexisting XML/HTML entity encoding down
 * to raw text first to guarantee zero double-escaping (e.g. `&amp;` will never become `&amp;amp;`).
 */
export function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  const unescaped = String(unsafe)
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'");

  return unescaped
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface TallyGstOptions {
  /** State exactly as named in Tally (e.g. "Chhattisgarh"). Used as place of supply and party state. */
  stateName: string;
  /** HSN code per stock item name, from the item presets in the UI. */
  hsnByItem: Record<string, string>;
  /** 'prime' = TallyPrime (any release incl. 7.x); 'erp9' = Tally.ERP 9 Release 6.x. */
  profile?: TallyProfile;
  /** Unit symbol as it exists (or should exist) in Tally for grams. Defaults to GMS. */
  unitName?: string;
}

export type TallyProfile = 'prime' | 'erp9';

/** Version-specific wording Tally expects for the same field. */
const REG_TYPE_UNREGISTERED: Record<TallyProfile, string> = {
  prime: 'Unregistered/Consumer',
  erp9: 'Unregistered',
};

const GST_FROM = '20170701';
const DEFAULT_UNIT = 'GMS';

function requireGst(opts?: TallyGstOptions): TallyGstOptions {
  if (!opts?.stateName?.trim()) {
    throw new Error('State name is required for GST (set it in Company Settings).');
  }
  return opts;
}


/** Split a bill's tax into equal CGST + SGST and make the voucher balance to the paisa. */
function splitTax(bill: SplitBill, gstRate: number) {
  // Exact paise arithmetic (shared with the app) so the voucher always balances and matches Tally's own rounding.
  const m = computeFromTaxablePaise(toPaise(bill.grossAmount), gstRate);
  return {
    taxable: m.taxableP / 100,
    cgst: m.cgstP / 100,
    sgst: m.sgstP / 100,
    final: m.finalP / 100,
    roundOff: m.roundOffP / 100,
    half: gstRate / 2,
  };
}

export const CGST_LEDGER = 'CGST A/C';
export const SGST_LEDGER = 'SGST A/C';

export function taxLedgerNames(gstRate: number) {
  const half = Number((gstRate / 2).toFixed(2));
  // Rate-independent ledger names (the same CGST A/C and SGST A/C ledgers are used for any rate).
  return { cgst: CGST_LEDGER, sgst: SGST_LEDGER, igst: `IGST OUTPUT ${gstRate}%`, half };
}

/**
 * Tally masters (All Masters import) for Indian GST: unit with UQC, stock items with HSN and
 * GST rate details, sales ledger, CGST/SGST duty ledgers, round-off and party ledgers with state.
 */
export function generateTallyMastersXml(
  bills: SplitBill[],
  companyName: string,
  config?: SplitConfig,
  gst?: TallyGstOptions
): string {
  if (!companyName?.trim()) throw new Error('Tally company name is required.');
  const opts = requireGst(gst);
  const UNIT = escapeXml((opts.unitName || DEFAULT_UNIT).trim());
  const safeCompany = escapeXml(companyName.trim());
  const state = escapeXml(opts.stateName.trim());

  const stockItems = new Set<string>();
  if (config?.itemName) stockItems.add(config.itemName.trim());
  bills.forEach((b) => b.itemName && stockItems.add(b.itemName.trim()));
  if (stockItems.size === 0) throw new Error('Stock item name is required.');

  const salesLedgers = new Set<string>();
  if (config?.itemSalesAccount) salesLedgers.add(config.itemSalesAccount.trim());
  bills.forEach((b) => b.itemSalesAccount && salesLedgers.add(b.itemSalesAccount.trim()));
  if (salesLedgers.size === 0) throw new Error('Sales ledger name is required.');

  const partyLedgers = new Set<string>();
  if (config?.postAccountName) partyLedgers.add(config.postAccountName.trim());
  bills.forEach((b) => b.postAccountName && partyLedgers.add(b.postAccountName.trim()));
  if (partyLedgers.size === 0) throw new Error('Party ledger name is required.');

  const gstRate = config?.gstRate ?? (bills[0]?.gstRate || 3);
  const { cgst, sgst, half } = taxLedgerNames(gstRate);

  const wrap = (inner: string) => `      <TALLYMESSAGE xmlns:UDF="TallyUDF">\n${inner}\n      </TALLYMESSAGE>`;

  const unitBlock = wrap(`        <UNIT NAME="${UNIT}" ACTION="Create">
          <NAME>${UNIT}</NAME>
          <ISSIMPLEUNIT>Yes</ISSIMPLEUNIT>
          <DECIMALPLACES>3</DECIMALPLACES>
          <GSTREPUOM>GMS-GRAMS</GSTREPUOM>
        </UNIT>`);

  const rateLines = (r: number) => `            <GSTRATEDETAILS.LIST>
              <GSTRATEDUTYHEAD>Central Tax</GSTRATEDUTYHEAD>
              <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
              <GSTRATE>${Number((r / 2).toFixed(2))}</GSTRATE>
            </GSTRATEDETAILS.LIST>
            <GSTRATEDETAILS.LIST>
              <GSTRATEDUTYHEAD>State Tax</GSTRATEDUTYHEAD>
              <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
              <GSTRATE>${Number((r / 2).toFixed(2))}</GSTRATE>
            </GSTRATEDETAILS.LIST>
            <GSTRATEDETAILS.LIST>
              <GSTRATEDUTYHEAD>Integrated Tax</GSTRATEDUTYHEAD>
              <GSTRATEVALUATIONTYPE>Based on Value</GSTRATEVALUATIONTYPE>
              <GSTRATE>${r}</GSTRATE>
            </GSTRATEDETAILS.LIST>`;

  const stockItemBlocks = [...stockItems].map((item) => {
    const n = escapeXml(item);
    const hsn = escapeXml((opts.hsnByItem[item] || '').trim());
    if (!hsn) throw new Error(`HSN code is required for item "${item}".`);
    return wrap(`        <STOCKITEM NAME="${n}" ACTION="Create">
          <NAME>${n}</NAME>
          <BASEUNITS>${UNIT}</BASEUNITS>
          <ISBATCHWISEON>No</ISBATCHWISEON>
          <ISPERISHABLEON>No</ISPERISHABLEON>
          <GSTAPPLICABLE>Applicable</GSTAPPLICABLE>
          <GSTTYPEOFSUPPLY>Goods</GSTTYPEOFSUPPLY>
          <GSTDETAILS.LIST>
            <APPLICABLEFROM>${GST_FROM}</APPLICABLEFROM>
            <CALCULATIONTYPE>On Value</CALCULATIONTYPE>
            <HSNCODE>${hsn}</HSNCODE>
            <TAXABILITY>Taxable</TAXABILITY>
${rateLines(gstRate)}
          </GSTDETAILS.LIST>
        </STOCKITEM>`);
  });

  const salesLedgerBlocks = [...salesLedgers].map((x) => {
    const n = escapeXml(x);
    return wrap(`        <LEDGER NAME="${n}" ACTION="Create">
          <NAME>${n}</NAME>
          <PARENT>Sales Accounts</PARENT>
          <ISBILLWISEON>No</ISBILLWISEON>
          <AFFECTSSTOCK>Yes</AFFECTSSTOCK>
          <ISINVENTORYAFFECTED>Yes</ISINVENTORYAFFECTED>
          <GSTAPPLICABLE>Applicable</GSTAPPLICABLE>
        </LEDGER>`);
  });

  const dutyLedger = (name: string, head: string) => {
    const n = escapeXml(name);
    return wrap(`        <LEDGER NAME="${n}" ACTION="Create">
          <NAME>${n}</NAME>
          <PARENT>Duties &amp; Taxes</PARENT>
          <TAXTYPE>GST</TAXTYPE>
          <GSTDUTYHEAD>${head}</GSTDUTYHEAD>
          <ISBILLWISEON>No</ISBILLWISEON>
          <RATEOFTAXCALCULATION>${half}</RATEOFTAXCALCULATION>
        </LEDGER>`);
  };

  const roundOffBlock = wrap(`        <LEDGER NAME="ROUND OFF" ACTION="Create">
          <NAME>ROUND OFF</NAME>
          <PARENT>Indirect Expenses</PARENT>
          <ISBILLWISEON>No</ISBILLWISEON>
          <AFFECTSSTOCK>No</AFFECTSSTOCK>
          <ROUNDINGMETHOD>Normal Rounding</ROUNDINGMETHOD>
          <ROUNDINGLIMIT>1</ROUNDINGLIMIT>
        </LEDGER>`);

  const partyBlocks = [...partyLedgers].map((p) => {
    const n = escapeXml(p);
    const isCash = /cash|counter|petty|vault/i.test(p);
    if (isCash) {
      return wrap(`        <LEDGER NAME="${n}" ACTION="Create">
          <NAME>${n}</NAME>
          <PARENT>Cash-in-hand</PARENT>
          <ISBILLWISEON>No</ISBILLWISEON>
        </LEDGER>`);
    }
    return wrap(`        <LEDGER NAME="${n}" ACTION="Create">
          <NAME>${n}</NAME>
          <PARENT>Sundry Debtors</PARENT>
          <ISBILLWISEON>No</ISBILLWISEON>
          <COUNTRYOFRESIDENCE>India</COUNTRYOFRESIDENCE>
          <LEDSTATENAME>${state}</LEDSTATENAME>
          <GSTREGISTRATIONTYPE>${REG_TYPE_UNREGISTERED[opts.profile ?? 'prime']}</GSTREGISTRATIONTYPE>
        </LEDGER>`);
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${safeCompany}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${[unitBlock, ...stockItemBlocks, ...salesLedgerBlocks, dutyLedger(cgst, 'Central Tax'), dutyLedger(sgst, 'State Tax'), roundOffBlock, ...partyBlocks].join('\n')}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * Tally GST Sales item-invoice vouchers.
 * Robust, crash-proof XML schema without invalid scalar tags or malformed GUID elements.
 */
export function generateTallyXmlEnvelope(
  bills: SplitBill[],
  config: SplitConfig,
  companyName: string,
  gst?: TallyGstOptions
): string {
  if (!companyName?.trim()) throw new Error('Tally company name is required.');
  const opts = requireGst(gst);
  const UNIT = escapeXml((opts.unitName || DEFAULT_UNIT).trim());
  const safeCompany = escapeXml(companyName.trim());
  const state = escapeXml(opts.stateName.trim());
  const { cgst: cgstName, sgst: sgstName } = taxLedgerNames(config.gstRate);

  const voucherMessages = bills
    .map((bill) => {
      const tallyDate = formatTallyDate(bill.billDate || config.billDate);
      const t = splitTax(bill, bill.gstRate || config.gstRate);
      const item = escapeXml(bill.itemName);
      const party = escapeXml(bill.postAccountName);
      const sales = escapeXml(bill.itemSalesAccount);
      const vno = escapeXml(bill.voucherNo);
      const rate = Number(bill.rate).toFixed(2);
      const qty = `${bill.weight.toFixed(3)} ${UNIT}`;
      const neg = (n: number) => (n === 0 ? '0.00' : `-${n.toFixed(2)}`);

      const isCashParty = /cash|counter|petty|vault/i.test(bill.postAccountName);
      const billAlloc = isCashParty
        ? ''
        : `
            <BILLALLOCATIONS.LIST>
              <NAME>${vno}</NAME>
              <BILLTYPE>New Ref</BILLTYPE>
              <AMOUNT>${neg(t.final)}</AMOUNT>
            </BILLALLOCATIONS.LIST>`;

      const roundOffEntry =
        Math.abs(t.roundOff) > 0.0001
          ? `
          <LEDGERENTRIES.LIST>
            <ROUNDTYPE>Normal Rounding</ROUNDTYPE>
            <LEDGERNAME>ROUND OFF</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${t.roundOff < 0 ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <ISLASTDEEMEDPOSITIVE>${t.roundOff < 0 ? 'Yes' : 'No'}</ISLASTDEEMEDPOSITIVE>
            <ROUNDLIMIT>1</ROUNDLIMIT>
            <AMOUNT>${t.roundOff < 0 ? neg(Math.abs(t.roundOff)) : t.roundOff.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>`
          : '';

      return `      <TALLYMESSAGE xmlns:UDF="TALLYUDF">
        <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Invoice Voucher View">
          <DATE>${tallyDate}</DATE>
          <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <VOUCHERNUMBER>${vno}</VOUCHERNUMBER>
          <REFERENCE>${vno}</REFERENCE>
          <REFERENCEDATE>${tallyDate}</REFERENCEDATE>
          <PARTYLEDGERNAME>${party}</PARTYLEDGERNAME>
          <STATENAME>${state}</STATENAME>
          <PLACEOFSUPPLY>${state}</PLACEOFSUPPLY>
          <ISINVOICE>Yes</ISINVOICE>
          <VCHENTRYMODE>Item Invoice</VCHENTRYMODE>
          <NARRATION>Being sale of ${item}</NARRATION>
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${party}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
            <ISLASTDEEMEDPOSITIVE>Yes</ISLASTDEEMEDPOSITIVE>
            <AMOUNT>${neg(t.final)}</AMOUNT>${billAlloc}
          </LEDGERENTRIES.LIST>
          <ALLINVENTORYENTRIES.LIST>
            <STOCKITEMNAME>${item}</STOCKITEMNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <RATE>${rate}/${UNIT}</RATE>
            <AMOUNT>${t.taxable.toFixed(2)}</AMOUNT>
            <ACTUALQTY>${qty}</ACTUALQTY>
            <BILLEDQTY>${qty}</BILLEDQTY>
            <ACCOUNTINGALLOCATIONS.LIST>
              <LEDGERNAME>${sales}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <ISPARTYLEDGER>No</ISPARTYLEDGER>
              <AMOUNT>${t.taxable.toFixed(2)}</AMOUNT>
            </ACCOUNTINGALLOCATIONS.LIST>
          </ALLINVENTORYENTRIES.LIST>
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(cgstName)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>${t.cgst.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>${escapeXml(sgstName)}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>${t.sgst.toFixed(2)}</AMOUNT>
          </LEDGERENTRIES.LIST>${roundOffEntry}
        </VOUCHER>
      </TALLYMESSAGE>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${safeCompany}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${voucherMessages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

/**
 * Bank Receipt / Payment vouchers (single-entry layout).
 *
 * Accounting rules (Tally sign convention: Dr = ISDEEMEDPOSITIVE Yes + negative amount,
 * Cr = ISDEEMEDPOSITIVE No + positive amount):
 *  - Money in  (Receipt):   Bank Dr | Counter ledger Cr
 *  - Money out (Payment): Bank Cr | Counter ledger Dr
 *
 * Layout follows what Tally itself exports for single-entry vouchers, so that the BANK lands
 * in the top "Account" field and the counter ledger in "Particulars":
 *  1. FIRST  ALLLEDGERENTRIES = counter ledger (party / expense / cash), ISPARTYLEDGER=No.
 *  2. SECOND ALLLEDGERENTRIES = bank ledger, ISPARTYLEDGER=Yes, with BANKALLOCATIONS.LIST.
 *  3. Header PARTYLEDGERNAME = BANK ledger (this fills the "Account" field);
 *     PARTYNAME = counter ledger.
 */
/** Where the voucher numbers of one type (Receipt / Payment) continue from. */
export interface BankNumberSeries {
  prefix: string;
  /** Number given to the first voucher of this type (last number in Tally + 1, or 1 when Tally has none). */
  next: number;
  /** Zero-padding width, e.g. 4 for 0016. 0 = none. */
  width: number;
}
export type BankNumbering = Partial<Record<'Receipt' | 'Payment', BankNumberSeries>>;

export function generateBankVouchersTallyXml(
  entries: BankVoucherEntry[],
  companyName: string = getStoredCompanyName(),
  numbering?: BankNumbering
): string {
  if (!companyName?.trim()) throw new Error('Tally company name is required.');
  const safeCompany = escapeXml(companyName.trim());
  const selected = entries.filter((e) => e.selected);

  // Sequential numbers per voucher type, in date order (ties keep the statement order).
  const voucherNoOf = new Map<BankVoucherEntry, string>();
  if (numbering) {
    for (const type of ['Receipt', 'Payment'] as const) {
      const series = numbering[type];
      if (!series) continue;
      selected
        .map((e, i) => ({ e, i }))
        .filter((x) => x.e.type === type)
        .sort((a, b) => formatTallyDate(a.e.date).localeCompare(formatTallyDate(b.e.date)) || a.i - b.i)
        .forEach((x, k) => voucherNoOf.set(x.e, formatVoucherNo(series.prefix, series.next + k, series.width)));
    }
  }

  const voucherMessages = selected
    .map((e) => {
      const tallyDate = formatTallyDate(e.date);
      const isReceipt = e.type === 'Receipt'; // money in
      const vType = isReceipt ? 'Receipt' : 'Payment';
      if (!e.bankLedger?.trim()) throw new Error(`Entry dated ${e.date} has no Bank Ledger.`);
      const bankName = escapeXml(e.bankLedger.trim());
      const counterRaw = e.partyLedger?.trim() || '';
      if (!counterRaw) {
        throw new Error(`Entry dated ${e.date} has no Party Ledger. Select a ledger for every row.`);
      }
      const counterName = escapeXml(counterRaw);
      const amt = Math.abs(e.amount).toFixed(2);

      const bankDeemed = isReceipt ? 'Yes' : 'No'; // bank is Dr on money in
      const bankAmt = isReceipt ? `-${amt}` : amt;
      const counterDeemed = isReceipt ? 'No' : 'Yes';
      const counterAmt = isReceipt ? amt : `-${amt}`;

      return `      <TALLYMESSAGE xmlns:UDF="TallyUDF">
        <VOUCHER VCHTYPE="${vType}" ACTION="Create" OBJVIEW="Accounting Voucher View">
          <DATE>${tallyDate}</DATE>
          <EFFECTIVEDATE>${tallyDate}</EFFECTIVEDATE>
          <VOUCHERTYPENAME>${vType}</VOUCHERTYPENAME>${voucherNoOf.has(e) ? `\n          <VOUCHERNUMBER>${escapeXml(voucherNoOf.get(e)!)}</VOUCHERNUMBER>` : ''}
          <PARTYNAME>${counterName}</PARTYNAME>
          <PARTYLEDGERNAME>${bankName}</PARTYLEDGERNAME>
          <VOUCHERTYPEORIGNAME>${vType}</VOUCHERTYPEORIGNAME>
          <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
          <NARRATION>${escapeXml(e.narration)}</NARRATION>
          <ISINVOICE>No</ISINVOICE>
          <HASCASHFLOW>Yes</HASCASHFLOW>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${counterName}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${counterDeemed}</ISDEEMEDPOSITIVE>
            <LEDGERFROMITEM>No</LEDGERFROMITEM>
            <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <ISLASTDEEMEDPOSITIVE>${counterDeemed}</ISLASTDEEMEDPOSITIVE>
            <AMOUNT>${counterAmt}</AMOUNT>
          </ALLLEDGERENTRIES.LIST>
          <ALLLEDGERENTRIES.LIST>
            <LEDGERNAME>${bankName}</LEDGERNAME>
            <ISDEEMEDPOSITIVE>${bankDeemed}</ISDEEMEDPOSITIVE>
            <LEDGERFROMITEM>No</LEDGERFROMITEM>
            <REMOVEZEROENTRIES>No</REMOVEZEROENTRIES>
            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
            <ISLASTDEEMEDPOSITIVE>${bankDeemed}</ISLASTDEEMEDPOSITIVE>
            <AMOUNT>${bankAmt}</AMOUNT>
            <BANKALLOCATIONS.LIST>
              <DATE>${tallyDate}</DATE>
              <INSTRUMENTDATE>${tallyDate}</INSTRUMENTDATE>
              <TRANSACTIONTYPE>Others</TRANSACTIONTYPE>
              <BANKPARTYNAME>${counterName}</BANKPARTYNAME>
              <PAYMENTFAVOURING>${counterName}</PAYMENTFAVOURING>
              <STATUS>No</STATUS>
              <PAYMENTMODE>Transacted</PAYMENTMODE>
              <ISCONNECTEDPAYMENT>No</ISCONNECTEDPAYMENT>
              <AMOUNT>${bankAmt}</AMOUNT>
            </BANKALLOCATIONS.LIST>
          </ALLLEDGERENTRIES.LIST>
        </VOUCHER>
      </TALLYMESSAGE>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${safeCompany}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
${voucherMessages}
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function generateCreateSingleLedgerXml(
  ledgerName: string,
  parentGroup: string = 'Sundry Debtors',
  companyName: string = getStoredCompanyName()
): string {
  if (!companyName?.trim()) throw new Error('Tally company name is required.');
  const safeCompany = escapeXml(companyName.trim());
  const safeName = escapeXml(ledgerName.trim());
  const safeParent = escapeXml(parentGroup.trim());

  return `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>${safeCompany}</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <LEDGER NAME="${safeName}" ACTION="Create">
            <NAME>${safeName}</NAME>
            <PARENT>${safeParent}</PARENT>
            <ISBILLWISEON>No</ISBILLWISEON>
            <AFFECTSSTOCK>No</AFFECTSSTOCK>
          </LEDGER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function generateExcelCsvContent(
  bills: SplitBill[],
  summary: unknown,
  config: SplitConfig
): string {
  const headers = [
    'Bill #',
    'Voucher No',
    'Bill Date',
    'Post Account Ledger',
    'Stock Item',
    'Sales Ledger',
    `Weight (${config.unitLabel})`,
    'Unit Rate (INR)',
    'Gross Taxable Amt (INR)',
    'GST Rate (%)',
    'GST Amt (INR)',
    'Net Amt (INR)',
    'Round Off (INR)',
    'Final Bill Amt (INR)',
  ];

  const rows = bills.map((b) => [
    b.billNumber,
    `"${b.voucherNo}"`,
    b.billDate,
    `"${b.postAccountName}"`,
    `"${b.itemName}"`,
    `"${b.itemSalesAccount}"`,
    b.weight.toFixed(3),
    b.rate.toFixed(2),
    b.grossAmount.toFixed(2),
    b.gstRate.toFixed(2),
    b.gstAmount.toFixed(2),
    b.netAmount.toFixed(2),
    b.roundOff.toFixed(2),
    b.finalBillAmount.toFixed(2),
  ]);

  const totalWeight = bills.reduce((acc, b) => acc + Math.round(b.weight * 1000), 0) / 1000;
  const totalGross = bills.reduce((acc, b) => acc + b.grossAmount, 0);
  const totalGst = bills.reduce((acc, b) => acc + b.gstAmount, 0);
  const totalNet = bills.reduce((acc, b) => acc + b.netAmount, 0);
  const totalRoundOff = bills.reduce((acc, b) => acc + b.roundOff, 0);
  const totalFinal = bills.reduce((acc, b) => acc + b.finalBillAmount, 0);

  const summaryRow = [
    'TOTAL',
    `"${bills.length} Vouchers"`,
    config.billDate,
    `"${config.postAccountName}"`,
    `"${config.itemName}"`,
    `"${config.itemSalesAccount}"`,
    totalWeight.toFixed(3),
    '',
    totalGross.toFixed(2),
    config.gstRate.toFixed(2),
    totalGst.toFixed(2),
    totalNet.toFixed(2),
    totalRoundOff.toFixed(2),
    totalFinal.toFixed(2),
  ];

  return '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(',')), summaryRow.join(',')].join('\r\n');
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = filename;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
        window.URL.revokeObjectURL(url);
      } catch {}
    }, 1200);
  } catch {
    const encodedUri = encodeURI(`data:${mimeType},` + content);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      try {
        if (link.parentNode) {
          link.parentNode.removeChild(link);
        }
      } catch {}
    }, 1200);
  }
}
