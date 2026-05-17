/**
 * PSA grade pricing multipliers.
 *
 * Industry-standard rough premiums applied on top of raw (ungraded) market
 * price. Real sale prices vary widely with rarity, era, demand, and
 * population reports — these multipliers are best-effort averages suitable
 * for "ballpark" estimates only.
 *
 * Sources : aggregated PSA / eBay sold-comps analyses (modern era ≥ 2010).
 * Vintage cards (Base Set, Neo, etc.) command much higher PSA 10 premiums
 * (10-100×) — we don't auto-detect vintage here; the UI surfaces the
 * estimate as approximate.
 */
export const PSA_MULTIPLIERS: Readonly<Record<number, number>> = {
  10: 8.0, // Gem Mint — typical 5-10× raw on modern
  9: 3.0, // Mint — 2-4× raw
  8: 1.8, // NM-MT — 1.5-2× raw
  7: 1.3, // NM
  6: 1.0, // EX-MT — roughly raw NM value
  5: 0.8,
  4: 0.6,
  3: 0.5,
  2: 0.4,
  1: 0.3,
} as const;

export function getPsaMultiplier(grade: number): number {
  const g = Math.max(1, Math.min(10, Math.round(grade)));
  return PSA_MULTIPLIERS[g] ?? 1;
}

export function estimatePsaPrice(rawPrice: number, grade: number): number {
  const mult = getPsaMultiplier(grade);
  return Math.round(rawPrice * mult * 100) / 100;
}
