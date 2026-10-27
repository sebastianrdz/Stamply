/**
 * Tiers the card can afford, keeping each tier's index in the ORIGINAL stored
 * `config.tiers` array — `redeem_tier` reads `config->'tiers'->idx`, so the
 * index must not come from a sorted/filtered view.
 */
export function affordableTiers<T extends { points: number }>(
  tiers: T[],
  available: number,
): (T & { index: number })[] {
  return tiers
    .map((t, index) => ({ ...t, index }))
    .filter((t) => t.points <= available)
    .sort((a, b) => a.points - b.points);
}
