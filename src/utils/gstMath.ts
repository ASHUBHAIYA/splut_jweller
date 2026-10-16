/**
 * Exact GST / round-off arithmetic in whole paise.
 *
 * Floating point (e.g. 2283 * 1.5 / 100 = 34.2449999...) rounds half-paise amounts DOWN, while Tally rounds
 * them UP. That made CGST/SGST one paisa short and flipped some round-offs (e.g. +0.50 became -0.48).
 * Everything here is integer maths, so the app, the grid, the CSV and the Tally XML always agree with Tally.
 */

/** Integer division rounding half up (positive numbers only). */
const divHalfUp = (num: number, den: number) => Math.floor((num + den / 2) / den);

export function toPaise(rupees: number): number {
  return Math.round((rupees + Number.EPSILON) * 100);
}

export interface PaiseAmounts {
  taxableP: number;
  cgstP: number;
  sgstP: number;
  gstP: number;
  netP: number;
  finalP: number;
  /** final - net: positive when rounded up, negative when rounded down. */
  roundOffP: number;
}

export function computeFromTaxablePaise(taxableP: number, gstRate: number): PaiseAmounts {
  const rateHundredths = Math.round(gstRate * 100); // 3% -> 300, 1.5% -> 150
  // each of CGST / SGST = taxable * (rate / 2) / 100, in paise
  const cgstP = divHalfUp(taxableP * rateHundredths, 20000);
  const sgstP = cgstP; // Tally always computes equal CGST and SGST
  const gstP = cgstP + sgstP;
  const netP = taxableP + gstP;
  const finalP = divHalfUp(netP, 100) * 100; // nearest rupee, .50 goes up
  return { taxableP, cgstP, sgstP, gstP, netP, finalP, roundOffP: finalP - netP };
}

/** Taxable value = weight (g, 3 decimals) x rate (Rs per g, 2 decimals), rounded half up to the paisa. */
export function taxableFromWeightRate(weight: number, rate: number): number {
  const milliGrams = Math.round(weight * 1000);
  const ratePaise = Math.round(rate * 100);
  return divHalfUp(milliGrams * ratePaise, 1000);
}
