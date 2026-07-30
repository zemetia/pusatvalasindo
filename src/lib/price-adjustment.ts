// Shared syntax for Patokan Harga adjustment expressions, used both for
// input validation (page-client + API) and for actually computing an adjusted
// price from a base rate.
//
// Grammar: [rounding][offset], both parts optional, empty string = no adjustment.
//   rounding: "c" (ceil) or "f" (floor) followed by a step, e.g. "c5", "f0.05"
//   offset:   a signed number, e.g. "+5", "-10"
// Examples: "+5", "-10", "c5", "f0.05", "c0.1+5"
export const PRICE_ADJUSTMENT_REGEX = /^(?:[cf]\d+(?:\.\d+)?)?(?:[+-]\d+(?:\.\d+)?)?$/;

export function isValidPriceAdjustment(value: string): boolean {
  return PRICE_ADJUSTMENT_REGEX.test(value.trim());
}

export type ParsedPriceAdjustment = {
  /** null = no rounding step declared. */
  rounding: { mode: "ceil" | "floor"; step: number } | null;
  /** Signed nominal added after rounding; 0 = none. */
  offset: number;
};

const PARSE_REGEX = /^(?:([cf])(\d+(?:\.\d+)?))?([+-]\d+(?:\.\d+)?)?$/;

/** Parses an adjustment expression; returns null when the syntax is invalid. */
export function parsePriceAdjustment(value: string): ParsedPriceAdjustment | null {
  const m = PARSE_REGEX.exec(value.trim());
  if (!m) return null;

  const [, mode, stepRaw, offsetRaw] = m;
  const step = stepRaw === undefined ? null : Number(stepRaw);
  // "c0" / "f0" parses but can't round to a zero step — treat it as no rounding
  // rather than dividing by zero.
  return {
    rounding: mode && step ? { mode: mode === "c" ? "ceil" : "floor", step } : null,
    offset: offsetRaw ? Number(offsetRaw) : 0,
  };
}

/**
 * Applies an adjustment expression to a base rate: round first (to the declared
 * step), then add the signed offset. An empty or invalid expression leaves the
 * base untouched — callers surface validity separately via isValidPriceAdjustment.
 *
 * Rounding runs in integer steps (value/step scaled) so decimal steps like
 * "f0.05" don't accumulate float error; the result is re-rounded to 4 decimals
 * for the same reason.
 */
export function applyPriceAdjustment(base: number, expression: string): number {
  if (!Number.isFinite(base)) return base;

  const parsed = parsePriceAdjustment(expression);
  if (!parsed) return base;

  let value = base;
  if (parsed.rounding) {
    const { mode, step } = parsed.rounding;
    const scaled = value / step;
    value = (mode === "ceil" ? Math.ceil(scaled) : Math.floor(scaled)) * step;
  }
  value += parsed.offset;

  return Math.round(value * 1e4) / 1e4;
}
