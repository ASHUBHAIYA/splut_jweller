/**
 * Voucher number helpers.
 * Tally numbers such as "INV/0016" must keep their leading zeros, so the number is stored as an
 * integer plus a "width" (digits to pad to). width 0 = no padding.
 */
export function formatVoucherNo(prefix: string, n: number, width = 0): string {
  const digits = String(Math.max(0, Math.trunc(n)));
  return `${prefix || ''}${width > digits.length ? digits.padStart(width, '0') : digits}`;
}

/** Splits a voucher number into prefix + trailing digits. Keeps the digits as text so zeros survive. */
export function splitVoucherNo(no: string): { prefix: string; digits: string; n: number; width: number } | null {
  const m = String(no ?? '').trim().match(/^(.*?)(\d+)$/);
  if (!m) return null;
  const digits = m[2];
  return { prefix: m[1], digits, n: parseInt(digits, 10), width: digits.length > 1 && digits.startsWith('0') ? digits.length : 0 };
}

/** Reads what the user typed in a "Start No" box: "0016" -> { n: 16, width: 4 }. */
export function parseStartNoInput(text: string): { n: number; width: number } {
  const digits = (text || '').replace(/\D/g, '');
  if (!digits) return { n: 1, width: 0 };
  return { n: Math.max(0, parseInt(digits, 10)), width: digits.length > 1 && digits.startsWith('0') ? digits.length : 0 };
}
