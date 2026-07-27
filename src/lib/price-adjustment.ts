// Shared syntax for Patokan Harga adjustment expressions, used both for
// input validation (page-client + API) and, later, for actually computing an
// adjusted price from a base rate.
//
// Grammar: [rounding][offset], both parts optional, empty string = no adjustment.
//   rounding: "c" (ceil) or "f" (floor) followed by a step, e.g. "c5", "f0.05"
//   offset:   a signed number, e.g. "+5", "-10"
// Examples: "+5", "-10", "c5", "f0.05", "c0.1+5"
export const PRICE_ADJUSTMENT_REGEX = /^(?:[cf]\d+(?:\.\d+)?)?(?:[+-]\d+(?:\.\d+)?)?$/;

export function isValidPriceAdjustment(value: string): boolean {
  return PRICE_ADJUSTMENT_REGEX.test(value.trim());
}
