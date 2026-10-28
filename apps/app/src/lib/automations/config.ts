import { interpolate } from "@stamply/i18n/format";
import type { RewardType } from "@/types/database";

export const AUTOMATION_TYPES: RewardType[] = [
  "welcome",
  "birthday",
  "unredeemed_reminder",
  "win_back",
  "almost_there",
];

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

/** wallet_offers.body is capped at 200 chars. */
export function renderMessage(
  template: string,
  vars: Record<string, string | number>,
): string {
  return interpolate(template, vars).slice(0, 200);
}
