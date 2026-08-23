export type PlanTier = "trial" | "small" | "medium" | "big";

/** A limit of `null` means unlimited. */
export interface PlanLimits {
  locations: number | null;
  employees: number | null;
  customers: number | null;
  programs: number | null;
}

/** Paid plans can be billed monthly or yearly. */
export type BillingInterval = "month" | "year";

export interface PlanDef {
  tier: PlanTier;
  name: string;
  /** Recurring monthly price in USD. */
  price: number;
  /** Total yearly price in USD when billed annually (paid plans only). */
  annualTotal?: number;
  /** Billing cadence for paid plans; undefined for the free trial. */
  interval?: BillingInterval;
  tagline: string;
  limits: PlanLimits;
  features: string[];
  /** Env var holding the Stripe (recurring, monthly) price id. */
  stripePriceEnv?:
    | "STRIPE_PRICE_SMALL"
    | "STRIPE_PRICE_MEDIUM"
    | "STRIPE_PRICE_BIG";
  /** Env var holding the Stripe (recurring, yearly) price id. */
  stripePriceEnvAnnual?:
    | "STRIPE_PRICE_SMALL_ANNUAL"
    | "STRIPE_PRICE_MEDIUM_ANNUAL"
    | "STRIPE_PRICE_BIG_ANNUAL";
}

export const PLANS: Record<PlanTier, PlanDef> = {
  trial: {
    tier: "trial",
    name: "Trial",
    price: 0,
    tagline: "14 days, full features, capped.",
    limits: { locations: 1, employees: 1, customers: 50, programs: 1 },
    features: ["All features", "1 location", "Up to 50 customers"],
  },
  small: {
    tier: "small",
    name: "Small",
    price: 679,
    annualTotal: 6790,
    interval: "month",
    tagline: "For a single location getting started.",
    limits: { locations: 1, employees: 1, customers: 100, programs: 1 },
    features: [
      "1 location",
      "1 employee",
      "Up to 100 customers",
      "1 loyalty program",
      "Apple & Google Wallet",
      "Basic stats",
    ],
    stripePriceEnv: "STRIPE_PRICE_SMALL",
    stripePriceEnvAnnual: "STRIPE_PRICE_SMALL_ANNUAL",
  },
  medium: {
    tier: "medium",
    name: "Medium",
    price: 1279,
    annualTotal: 12790,
    interval: "month",
    tagline: "For growing businesses with a small team.",
    limits: { locations: 3, employees: 5, customers: 1000, programs: 3 },
    features: [
      "Up to 3 locations",
      "5 employees",
      "Up to 1,000 customers",
      "3 loyalty programs",
      "Analytics dashboard",
      "Custom enrollment fields",
    ],
    stripePriceEnv: "STRIPE_PRICE_MEDIUM",
    stripePriceEnvAnnual: "STRIPE_PRICE_MEDIUM_ANNUAL",
  },
  big: {
    tier: "big",
    name: "Big",
    price: 1879,
    annualTotal: 18790,
    interval: "month",
    tagline: "For multi-location brands.",
    limits: {
      locations: null,
      employees: null,
      customers: 10000,
      programs: null,
    },
    features: [
      "Unlimited locations",
      "10+ employees",
      "Up to 10,000 customers",
      "Unlimited programs",
      "Priority support",
      "API access",
    ],
    stripePriceEnv: "STRIPE_PRICE_BIG",
    stripePriceEnvAnnual: "STRIPE_PRICE_BIG_ANNUAL",
  },
};

export const PAID_PLANS: PlanDef[] = [PLANS.small, PLANS.medium, PLANS.big];

export type LimitedResource = keyof PlanLimits;

/** Whether adding `additional` of `resource` keeps `count` within the plan. */
export function isWithinLimit(
  plan: PlanTier,
  resource: LimitedResource,
  count: number,
  additional = 1,
): boolean {
  const limit = PLANS[plan].limits[resource];
  if (limit === null) return true;
  return count + additional <= limit;
}

export function planLimit(
  plan: PlanTier,
  resource: LimitedResource,
): number | null {
  return PLANS[plan].limits[resource];
}

/** Per-month-equivalent price when billed annually (rounded), or null if the
 *  plan has no annual option. */
export function annualMonthly(tier: PlanTier): number | null {
  const { annualTotal } = PLANS[tier];
  return annualTotal == null ? null : Math.round(annualTotal / 12);
}

/** Whole-percent savings of the annual plan vs. paying month-to-month for a
 *  year, or 0 if the plan has no annual option. */
export function annualSavingsPct(tier: PlanTier): number {
  const { price, annualTotal } = PLANS[tier];
  if (!annualTotal || !price) return 0;
  return Math.round((1 - annualTotal / (price * 12)) * 100);
}
