import { isHex } from "@/lib/programs/design";

/** Stamp milestones: extra rewards at chosen stamps (`programs.config.milestones`). */
export interface Milestone {
  at: number;
  reward: string;
  icon_url: string | null;
  /** Tint for this reward's icon; null = card-wide stamp color / icon's own colors. */
  icon_color: string | null;
}

/** Valid milestones only (1 <= at < goal, unique), sorted by stamp number. */
export function stampMilestones(
  config: Record<string, unknown> | null | undefined,
  goal: number,
): Milestone[] {
  const raw = Array.isArray(config?.milestones) ? config.milestones : [];
  const seen = new Set<number>();
  const out: Milestone[] = [];
  for (const m of raw as Record<string, unknown>[]) {
    const at = m?.at;
    if (!Number.isInteger(at) || (at as number) < 1 || (at as number) >= goal)
      continue;
    if (seen.has(at as number) || typeof m.reward !== "string" || !m.reward)
      continue;
    seen.add(at as number);
    out.push({
      at: at as number,
      reward: m.reward,
      icon_url: typeof m.icon_url === "string" ? m.icon_url : null,
      icon_color: isHex(m.icon_color) ? m.icon_color : null,
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Times the lifetime total has reached `at` (once per cycle of `goal`). */
export function milestoneEarned(
  stamps: number,
  at: number,
  goal: number,
): number {
  return stamps >= at ? Math.floor((stamps - at) / goal) + 1 : 0;
}

/** Milestones with at least one earned-but-unredeemed reward. */
export function availableMilestones(
  card: { stamps: number; milestones_redeemed?: Record<string, number> | null },
  program: {
    type: string;
    goal: number;
    config?: Record<string, unknown> | null;
  },
): (Milestone & { available: number })[] {
  if (program.type !== "stamp") return [];
  return stampMilestones(program.config, program.goal)
    .map((m) => ({
      ...m,
      available:
        milestoneEarned(card.stamps, m.at, program.goal) -
        (card.milestones_redeemed?.[String(m.at)] ?? 0),
    }))
    .filter((m) => m.available > 0);
}

/** Per-slot icons for the stamp grid: milestone slots plus the final reward slot. */
export function slotIcons(
  config: Record<string, unknown> | null | undefined,
  goal: number,
): Record<number, string> {
  const icons: Record<number, string> = {};
  for (const m of stampMilestones(config, goal))
    if (m.icon_url) icons[m.at] = m.icon_url;
  const final = config?.reward_icon_url;
  if (typeof final === "string" && final) icons[goal] = final;
  return icons;
}

/** Total rewards a customer can redeem now: the banked final reward plus open milestones. */
export function redeemableCount(
  card: {
    stamps: number;
    rewards: number;
    milestones_redeemed?: Record<string, number> | null;
  },
  program: Parameters<typeof availableMilestones>[1],
): number {
  return (
    card.rewards +
    availableMilestones(card, program).reduce((n, m) => n + m.available, 0)
  );
}

/** Per-slot icon colors (milestones and the final reward); slots without one use the card-wide color. */
export function slotColors(
  config: Record<string, unknown> | null | undefined,
  goal: number,
): Record<number, string> {
  const colors: Record<number, string> = {};
  for (const m of stampMilestones(config, goal))
    if (m.icon_color) colors[m.at] = m.icon_color;
  if (isHex(config?.reward_icon_color)) colors[goal] = config.reward_icon_color;
  return colors;
}
