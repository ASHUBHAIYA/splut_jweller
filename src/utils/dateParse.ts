/**
 * Date parsing for bank statements and Tally vouchers.
 * Returns an ISO date (YYYY-MM-DD) or null. It never falls back to "today": an unreadable date
 * must be surfaced to the user instead of silently posting a voucher on the wrong day.
 */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function fullYear(y: number): number {
  if (y >= 100) return y;
  return y < 70 ? 2000 + y : 1900 + y;
}

function valid(y: number, m: number, d: number): string | null {
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const last = new Date(y, m, 0).getDate();
  if (d > last) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Excel serial day number -> ISO (Excel 1900 system, UTC so there is no timezone shift). */
export function excelSerialToIso(serial: number): string | null {
  if (!isFinite(serial) || serial < 1) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return valid(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function parseStatementDate(input: unknown): string | null {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    return valid(input.getFullYear(), input.getMonth() + 1, input.getDate());
  }
  if (typeof input === 'number') return excelSerialToIso(input);

  const s = String(input).trim();
  if (!s) return null;

  // Pure number text (e.g. "45760") = Excel serial; 8 digits = YYYYMMDD or DDMMYYYY
  if (/^\d{8}$/.test(s)) {
    const a = Number(s.slice(0, 4));
    if (a >= 1900 && a <= 2100) return valid(a, Number(s.slice(4, 6)), Number(s.slice(6, 8)));
    return valid(Number(s.slice(4, 8)), Number(s.slice(2, 4)), Number(s.slice(0, 2)));
  }
  if (/^\d{5}(\.\d+)?$/.test(s)) return excelSerialToIso(Number(s));

  let m: RegExpMatchArray | null;

  // YYYY-MM-DD, YYYY/MM/DD (optional time part)
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/))) {
    return valid(Number(m[1]), Number(m[2]), Number(m[3]));
  }
  // DD-MM-YYYY, DD/MM/YY (Indian order: day first)
  if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?:[T\s].*)?$/))) {
    return valid(fullYear(Number(m[3])), Number(m[2]), Number(m[1]));
  }
  // DD-Mon-YY, DD Mon YYYY, DD-Month-YYYY
  if ((m = s.match(/^(\d{1,2})[-/.\s]([A-Za-z]{3,9})[-/.,\s]+(\d{2}|\d{4})(?:[T\s].*)?$/))) {
    const mon = MONTHS[m[2].toLowerCase().slice(0, m[2].toLowerCase().startsWith('sept') ? 4 : 3)];
    if (mon) return valid(fullYear(Number(m[3])), mon, Number(m[1]));
  }
  // Mon DD, YYYY
  if ((m = s.match(/^([A-Za-z]{3,9})[-/.\s]+(\d{1,2})(?:st|nd|rd|th)?,?[-/.\s]+(\d{2}|\d{4})$/))) {
    const mon = MONTHS[m[1].toLowerCase().slice(0, 3)];
    if (mon) return valid(fullYear(Number(m[3])), mon, Number(m[2]));
  }
  return null;
}
