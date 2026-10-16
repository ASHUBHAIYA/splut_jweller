# Changes in this patch

## Root causes fixed
1. **Relay jobs were never executed.** The web app queues `{licenseKey, xml}`; the bridge read `data.xmlPayload` (never present). Bridge now reads `xml` (and `xmlPayload`).
2. **Everything failed silently / looked successful.** Tally returns HTTP 200 even when it rejects vouchers. Bridge and web now parse CREATED / ERRORS / every LINEERROR and report `success | tally_rejected | tally_offline`; sync logs no longer fake success or random master IDs.
3. **Latest invoice number was wrong.** Old query ignored the voucher type and the parser took the *first* voucher. New collection query (Sales only, current FY) + parser picks the latest by date and number.
4. **Educational mode dates.** New toggle clamps dates to 1st / 2nd / last day of month.
5. **`'DEFAULT'` license key** made the Worker deliver any shop's jobs to any bridge. Removed; web app now uses the real license key (Company Settings).
6. **Relay polling window** was 5-6 s vs a 3 s bridge poll; now 25-30 s, bridge polls every 2 s with backoff. 

## Architecture
- Relay is the only path for PC and mobile (`src/utils/tallyTransport.ts`). Local API is opt-in (`--local-api`) with an origin allow-list instead of `*`.

## Security / hygiene
- Sample Worker: requires active, unexpired license to queue jobs; UUID job ids; no cross-tenant `DEFAULT`; configurable `ALLOWED_ORIGIN`; reads `X-License-Key` header.
- Bridge: payload size cap and `<ENVELOPE>` check, license key no longer deleted when offline, retry on boot, PowerShell fallback when `wmic` is missing.
- Removed `tally-bridge.exe~`, stale `tally-bridge.exe`, hardcoded Worker URL and D1 ID.

## You must do
- **Redeploy the Worker** from `SAMPLE_CF_WORKER_CODE` in `src/utils/adminAuth.ts` (and set `ALLOWED_ORIGIN`). Set `VITE_CF_WORKER_URL`.
- **Rebuild `tally-bridge.exe`** (command in `tally-bridge/README.md`). Not compiled here: no Go toolchain in this environment.
- Rotate the old Worker URL / admin PIN since they were in the source you shared.

## Round 2: no hardcoded store / ledger / item names
- Tally company, store name, bank ledgers, party ledgers, sales ledgers, stock items, voucher prefix: all start empty and come from the UI (saved in the browser; nothing seeded in code).
- Removed 'Abhishek jwellers' / 'Abhishek Jewellers' defaults (App.tsx, CompanyProfileModal.tsx, tallyXmlGenerator.ts) and all sample store names in placeholders.
- Removed seeded ledgers/items (CASH SALE, SALE 3%, GOLD 24K, HDFC..., etc.) from useBillSplitter.ts and BankStatementManager.tsx.
- XML generators now throw if company, party ledger or sales ledger is empty; Push is blocked with a clear message instead of sending a bad request.
- Removed the fixed voucher narration text.
- Still fixed on purpose (Tally standard names): GMS unit, ROUND OFF, CGST/SGST OUTPUT, parent groups (Sales Accounts, Duties & Taxes, Sundry Debtors, Cash-in-hand, Indirect Expenses).

## Round 3: GST-correct Tally XML (Indian standard, 3% = 1.5% CGST + 1.5% SGST)
Masters: unit GMS with UQC (GMS-GRAMS); stock item with HSN and GST rate details (Central 1.5, State 1.5, Integrated 3); GST-applicable sales ledger; CGST/SGST duty ledgers; ROUND OFF; party ledgers with state/country/registration type (cash ledger under Cash-in-hand).
Vouchers: Sales item invoice with place of supply, state, country, HSN + rate details on the item, party Dr = final bill amount, sales Cr, CGST = SGST (computed on the taxable value), round-off. Every voucher balances to the paisa (tested).
New required UI input: State (Company Settings). HSN code comes from the stock item preset.
Removed: custom GUID/VCHKEY, extra junk ledgers (CGST/SGST/IGST generic), godown block.

## Round 4: version profiles (all Tally versions with GST)
- Company Settings: "Tally Software Version" = TallyPrime (any release incl. 7.x) or Tally.ERP 9 (Release 6.0+).
- Voucher ledger lines use LEDGERENTRIES.LIST (the tag in Tally's published item-invoice sample).
- Party registration type wording follows the profile (Prime: Unregistered/Consumer, ERP 9: Unregistered).
- Tally before ERP 9 Release 6.0 has no GST, so GST import cannot work there.

## Round 5: fixes from Tally import exceptions
- "Name or alias of the master is the same as in another master" (unit G vs Grams): masters now import with IMPORTDUPS=@@DUPMODIFY and no per-object ACTION, so masters that already exist are updated instead of rejected. The unit symbol is now a setting (Company Settings, default GMS) so it can match the unit already in Tally. No second unit is created.
- "No Accounting Allocations" on Sales vouchers: voucher now follows Tally's published item-invoice sample: batch allocation (Main Location / Primary Batch) on the stock line, bill allocation on non-cash party ledgers, ISLASTDEEMEDPOSITIVE on the party entry.

## Round 6: ledger tag
- Switched all voucher ledger lines back to LEDGERENTRIES.LIST (as in Tally's published item-invoice sample). The imported vouchers showed only the sales credit and no party/GST lines, which fits Tally ignoring ALLLEDGERENTRIES.LIST in invoice mode.

## Round 7: reverted unverified master import option
- Removed IMPORTDUPS=@@DUPMODIFY and restored ACTION="Create" on masters (Tally's documented form). A Tally crash (c0000005) followed the unverified option. Existing masters now give a harmless "already exists" line, which the app already treats as non-fatal.


## Cloudflare usage reduction (relay rewrite)
- **Worker** (`cloudflare-worker/`): job queue + bridge online state moved from D1 into a per-license Durable Object; no D1 writes while idle; licenses cached 60 s; no schema creation per request; old relay tables dropped; results deleted after 10 min.
- **Bridge** (`tally-bridge/main.go`): outbound WebSocket (stdlib client) with long-poll fallback; job execution split into `runTallyJob`; results reported over the socket (HTTPS fallback).
- **App**: results awaited with a long-poll (`awaitRelayJob`); Tally masters cached 30 min, last voucher numbers 2 min (cleared after any import; Connect/Refresh buttons force fresh data); the mount-time Tally probe runs once per company instead of on every callback change.
- **Security**: `/set` and `/create-key` require the admin PIN; PIN hashed; brute-force lockout; the key generator no longer shows a locally invented key when the Worker did not save it.



    


## Round 8: invoice zero-padding, Tally-connected status, bank voucher numbers, CGST A/C, negative round-off
1. **Leading zeros kept (0016 -> 0017).** "Fetch from Tally" now remembers the padding Tally uses (`LastVoucher.width`), the Start No box is a text box (type `0016`), and every place that builds a voucher number uses `formatVoucherNo()` (`src/utils/voucherNo.ts`).
2. **"Bridge Online" only when Tally is really connected.** The bridge checks Tally every 8 s locally and sends a `status` message over its WebSocket only when it changes (no extra Cloudflare load while idle). The Worker keeps it in the socket attachment and returns `tallyOnline` from `/relay/daemon-status`. The header pill shows green = bridge + Tally, amber = "Tally Not Connected", red = bridge offline. Status re-checks every 60 s while the tab is visible, and Push re-checks live before sending. Old bridges that do not report Tally still count as online (no break during upgrade).
3. **Bank voucher numbers.** Receipt and Payment vouchers now carry a voucher number. On Push the app reads the last Receipt / Payment number from Tally (keeping prefix and zero-padding) and numbers the new vouchers sequentially in date order. If Tally has none, numbering starts at 1. Export XML uses the numbers loaded last; without them Tally auto-numbers as before.
4. **Ledger names:** sales vouchers now use `CGST A/C` and `SGST A/C` (were `CGST OUTPUT 1.5%` / `SGST OUTPUT 1.5%`). Constants `CGST_LEDGER` / `SGST_LEDGER` in `tallyXmlGenerator.ts`.
5. **Negative round-off fixed.** GST was computed with floating point, so half-paise values rounded down (2283 x 1.5% = 34.245 became 34.24, Tally says 34.25). Bills near .50 then got e.g. -0.48 instead of +0.50. All amounts now use exact paise integer maths (`src/utils/gstMath.ts`) in the app and in the XML; swept 129,000+ amounts: every voucher balances and the grid round-off equals the XML round-off. The ROUND OFF entry also carries Tally's `ROUNDTYPE` / `ROUNDLIMIT` tags.

### You must do
- **Redeploy the Worker** (`cd cloudflare-worker && npx wrangler deploy -c wrangler.dev.toml`) for the Tally status.
- **Replace tally-bridge.exe** on the shop PC with the rebuilt one (built for the dev Worker URL in `.env.production`; rebuild with the command in `tally-bridge/README.md` for production).
- Redeploy the web app from GitHub as usual.




taskkill /IM tally-bridge.exe /F