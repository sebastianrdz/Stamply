import { interpolate } from "@stamply/i18n/format";
import type { RewardType } from "@/types/database";

export const AUTOMATION_TYPES: RewardType[] = [
  "welcome",
  "birthday",
  "unredeemed_reminder",
  "win_back",
  "almost_there",
  "review_prompt",
];

/** Template cap for review_prompt so the tracked link always fits in 200 chars. */
export const REVIEW_MESSAGE_MAX = 120;
export const LINK_TOKEN = "{link}";

/** The one numeric setting each type has, with its default and bounds. */
export const CONFIG_FIELDS: Partial<
  Record<RewardType, { key: string; def: number; min: number; max: number }>
> = {
  birthday: { key: "days_before", def: 3, min: 0, max: 30 },
  unredeemed_reminder: { key: "remind_every_days", def: 14, min: 1, max: 90 },
  win_back: { key: "inactive_days", def: 30, min: 7, max: 365 },
  almost_there: { key: "remaining", def: 2, min: 1, max: 10 },
};

export function configNumber(
  type: RewardType,
  config: Record<string, unknown> | null | undefined,
): number {
  const f = CONFIG_FIELDS[type];
  if (!f) return 0;
  const v = Number(config?.[f.key]);
  return Number.isFinite(v) && v >= f.min && v <= f.max ? v : f.def;
}

/**
 * wallet_offers.body is capped at 200 chars. A template that ends with {link}
 * keeps the whole link: the text before it is trimmed instead of the link.
 */
export function renderMessage(
  template: string,
  vars: Record<string, string | number>,
): string {
  const t = template.trimEnd();
  if (typeof vars.link === "string" && t.endsWith(LINK_TOKEN)) {
    const head = interpolate(t.slice(0, -LINK_TOKEN.length), vars).trimEnd();
    return `${head.slice(0, 200 - vars.link.length - 1)} ${vars.link}`.trim();
  }
  return interpolate(template, vars).slice(0, 200);
}
