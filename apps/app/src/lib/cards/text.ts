import type { Dictionary } from "@stamply/i18n/dictionaries";
import { interpolate } from "@stamply/i18n/format";
import type { Program } from "@/types/database";
import type { CardState } from "./state";

type W = Dictionary["wallet"];

export interface TextField {
  key: string;
  label: string;
  value: string;
}

/** Formatted copy for a card, shared by both wallet passes and the card page. */
export interface CardText {
  /** Stamp, or points without tiers: the original stamp-style layout. */
  legacy: boolean;
  header: { label: string; value: string };
  /** Apple primary field (null = none, stamp strip owns that space). */
  primary: { label: string; value: string } | null;
  /** Secondary fields after the customer name. */
  secondary: TextField[];
  auxiliary: TextField[];
  howTo: string;
  benefits: string | null;
  headline: string;
  detail: string[];
}

type ProgramIn = Pick<Program, "type" | "goal" | "reward_description"> &
  Partial<Pick<Program, "config">>;

export function discountText(program: ProgramIn, w: W): string {
  const c = program.config ?? {};
  if (c.discount_kind === "percent") return interpolate(w.discountPercent, { value: String(c.value) });
  if (c.discount_kind === "fixed") return interpolate(w.discountFixed, { value: String(c.value) });
  return program.reward_description;
}

export function cardText(
  state: CardState,
  program: ProgramIn,
  w: W,
  opts: { locale: string; business: string; rewards: number; timeZone?: string },
): CardText {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(opts.locale, { dateStyle: "medium", timeZone: opts.timeZone }).format(
      new Date(iso),
    );
  const reward = { label: w.reward, value: program.reward_description };
  const legacyHow = interpolate(w.howTo, {
    business: opts.business,
    unit: program.type === "stamp" ? w.stampsWord : w.pointsWord,
    goal: program.goal,
    reward: program.reward_description,
  });
  const rewardsField = { key: "rewards", label: w.rewards, value: String(opts.rewards) };
  const base = { auxiliary: [], benefits: null, howTo: legacyHow };

  if (program.type === "stamp" || (program.type === "points" && !hasTiers(program))) {
    return legacy(state, program, w, base, rewardsField, reward);
  }

  switch (program.type) {
    case "points": {
      const next = state.nextTier
        ? interpolate(w.nextReward, {
            points: state.nextTier.points - state.available,
            reward: state.nextTier.reward,
          })
        : w.topTier;
      const headline = `${state.available} ${w.pointsWord}`;
      return {
        ...base,
        legacy: false,
        howTo: interpolate(w.howToPoints, { business: opts.business }),
        header: { label: w.pointsLabel, value: String(state.available) },
        primary: { label: w.nextRewardLabel, value: next },
        secondary: [],
        headline,
        detail: [next],
      };
    }

    case "coupon": {
      const discount = discountText(program, w);
      const uses = state.usesLeft === null ? w.unlimited : String(state.usesLeft);
      const until = state.until ? fmt(state.until) : null;
      return {
        ...base,
        legacy: false,
        howTo: interpolate(w.howToCoupon, { business: opts.business, reward: program.reward_description }),
        header: { label: w.couponLabel, value: state.expired ? w.expired : discount },
        primary: reward,
        secondary: [{ key: "uses", label: w.usesLabel, value: uses }],
        auxiliary: until ? [{ key: "until", label: w.validUntilLabel, value: until }] : [],
        headline: state.expired ? w.expired : discount,
        detail: [
          program.reward_description,
          `${w.usesLabel}: ${uses}`,
          ...(until ? [`${w.validUntilLabel}: ${until}`] : []),
        ],
      };
    }

    case "membership": {
      const tiers = Array.isArray(program.config?.tiers)
        ? (program.config.tiers as { name: string; benefits: string }[])
        : [];
      const benefits = tiers.find((t) => t.name === state.tier)?.benefits || null;
      // No valid_until yet = staff still has to activate it.
      const until = !state.until ? w.pending : state.expired ? w.expired : fmt(state.until);
      // Tierless memberships have no level name: don't pass the benefits blurb off as one.
      const header = state.tier
        ? { label: w.tierLabel, value: state.tier }
        : { label: w.membershipLabel, value: w.member };
      const tier = header.value;
      return {
        ...base,
        legacy: false,
        howTo: interpolate(w.howToMembership, { business: opts.business }),
        benefits,
        header,
        primary: reward,
        secondary: [{ key: "until", label: w.validUntilLabel, value: until }],
        headline: tier,
        detail: [`${w.validUntilLabel}: ${until}`, ...(benefits ? [benefits] : [])],
      };
    }
  }
}

function hasTiers(program: ProgramIn): boolean {
  return Array.isArray(program.config?.tiers) && program.config.tiers.length > 0;
}

function legacy(
  state: CardState,
  program: ProgramIn,
  w: W,
  base: Pick<CardText, "auxiliary" | "benefits" | "howTo">,
  rewardsField: TextField,
  reward: { label: string; value: string },
): CardText {
  const stamp = program.type === "stamp";
  return {
    ...base,
    legacy: true,
    header: {
      label: stamp ? w.stampsLabel : w.pointsLabel,
      value: `${state.progress}/${program.goal}`,
    },
    primary: stamp ? null : reward,
    secondary: [rewardsField],
    headline: `${state.progress}/${program.goal}`,
    detail: [],
  };
}
