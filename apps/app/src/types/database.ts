/**
 * Hand-maintained types mirroring supabase/migrations. Keep in sync with the SQL.
 * (Can be regenerated later with `supabase gen types typescript`.)
 */

export type MembershipRole = "owner" | "admin" | "employee";
export type PlanTier = "trial" | "small" | "medium" | "big";
export type SubscriptionStatus =
  "trialing" | "active" | "past_due" | "canceled" | "incomplete" | "unpaid";
export type ProgramType = "stamp" | "points";
export type CardStatus = "active" | "completed" | "redeemed";
export type StampKind = "stamp" | "redeem" | "adjust";
export type RewardType = "birthday";
export type StandaloneRewardStatus = "available" | "redeemed" | "expired";

// NOTE: these MUST be `type` aliases, not `interface`s. Supabase's Database
// generic requires each Row to satisfy `Record<string, unknown>`; TS interfaces
// are not assignable to that index signature (they could be augmented), which
// silently collapses all query types to `never`. Type aliases are assignable.
type Timestamped = { created_at: string };

export type Business = Timestamped & {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
  plan: PlanTier;
  subscription_status: SubscriptionStatus;
  stripe_customer_id: string | null;
  brand_primary_color: string;
  brand_secondary_color: string;
  logo_url: string | null;
  background_image_url: string | null;
  // Optional (not just nullable) unlike this file's usual convention, same
  // reason as `last_billing_event_at` below: several test fixtures
  // (src/lib/auth/session.test.ts, src/lib/billing/actions.test.ts,
  // src/lib/enroll/actions.test.ts, src/lib/programs/actions.test.ts,
  // src/lib/team/actions.test.ts, src/lib/wallet/apple/pass.test.ts,
  // src/lib/wallet/google/wallet.test.ts — all off-limits to edit here)
  // build full `Business` literals predating this column and can't be
  // updated as part of this change, so the key itself must be optional to
  // stay assignable. Runtime rows always have the key (value is `null`
  // until an icon is uploaded via migration 0011); treat a missing key the
  // same as `null`.
  stamp_icon_url?: string | null;
  show_business_name: boolean;
  timezone: string;
  // Optional (not just nullable) unlike this file's usual convention: a test
  // fixture (src/lib/auth/session.test.ts, off-limits to edit here) builds a
  // full `Business` literal predating this column and can't be updated as
  // part of this change, so the key itself must be optional to stay
  // assignable. Runtime rows always have the key (value is `null` until a
  // Stripe event lands); treat a missing key the same as `null`.
  last_billing_event_at?: string | null;
};

export type Membership = Timestamped & {
  id: string;
  business_id: string;
  user_id: string;
  role: MembershipRole;
  email: string | null;
};

export type Invitation = Timestamped & {
  id: string;
  business_id: string;
  email: string;
  role: MembershipRole;
  token: string;
  invited_by: string | null;
  expires_at: string;
  accepted_at: string | null;
};

export type Location = Timestamped & {
  id: string;
  business_id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
};

export type Program = Timestamped & {
  id: string;
  business_id: string;
  name: string;
  type: ProgramType;
  goal: number;
  reward_description: string;
  active: boolean;
  design: Record<string, unknown>;
};

export type Customer = Timestamped & {
  id: string;
  business_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  marketing_consent: boolean;
  consent_at: string | null;
  source_location_id: string | null;
  extra: Record<string, unknown>;
  // Optional (not just nullable) unlike this file's usual convention, same
  // reason as `Business.stamp_icon_url`/`Business.last_billing_event_at`
  // above: test fixtures (src/lib/wallet/apple/pass.test.ts,
  // src/lib/wallet/google/wallet.test.ts — both off-limits to edit here)
  // build full `Customer` literals predating this column and can't be
  // updated as part of this change, so the key itself must be optional to
  // stay assignable. Runtime rows always have the key (value is `null`
  // until a birthday is collected); treat a missing key the same as `null`.
  birthday?: string | null;
  // Optional (not just nullable) unlike this file's usual convention, same
  // reason as `birthday` above: test fixtures (src/lib/wallet/apple/pass.test.ts,
  // src/lib/wallet/google/wallet.test.ts — both off-limits to edit here)
  // build full `Customer` literals predating this column and can't be
  // updated as part of this change, so the key itself must be optional to
  // stay assignable. Runtime rows always have the key (value is `null` until
  // terms are accepted); treat a missing key the same as `null`.
  terms_accepted_at?: string | null;
};

export type Card = Timestamped & {
  id: string;
  business_id: string;
  program_id: string;
  customer_id: string;
  stamps: number;
  points: number;
  /** Banked, earned-but-unredeemed rewards. Accrues 1,2,3,…; decremented on redeem. */
  rewards: number;
  status: CardStatus;
  barcode_value: string;
  pass_auth_token: string;
  apple_serial: string | null;
  apple_pass_generated_at: string | null;
  google_object_id: string | null;
  updated_at: string;
};

export type StampEvent = Timestamped & {
  id: string;
  business_id: string;
  card_id: string;
  employee_id: string | null;
  delta: number;
  kind: StampKind;
  location_id: string | null;
};

export type Redemption = Timestamped & {
  id: string;
  business_id: string;
  card_id: string;
  reward: string;
  redeemed_by: string | null;
};

export type AppleRegistration = Timestamped & {
  id: string;
  business_id: string;
  card_id: string;
  device_library_id: string;
  pass_serial: string;
  push_token: string;
};

export type Subscription = Timestamped & {
  id: string;
  business_id: string;
  stripe_subscription_id: string | null;
  plan: PlanTier;
  status: SubscriptionStatus;
  current_period_end: string | null;
  last_event_created_at: string | null;
  updated_at: string;
};

// Standalone (non-program) rewards, e.g. a business-configured birthday
// reward. RewardDefinition is the business's config for one reward `type`;
// StandaloneRewardGrant is a specific customer's earned instance of that
// reward for a given recurrence (`period_key`, e.g. a year for an annual
// birthday reward).
export type RewardDefinition = Timestamped & {
  id: string;
  business_id: string;
  type: RewardType;
  reward_description: string;
  active: boolean;
  config: Record<string, unknown>;
  updated_at: string;
};

export type StandaloneRewardGrant = Timestamped & {
  id: string;
  business_id: string;
  customer_id: string;
  reward_definition_id: string;
  period_key: string;
  status: StandaloneRewardStatus;
  granted_at: string;
  redeemed_at: string | null;
  redeemed_by: string | null;
};

export type StripeWebhookEvent = {
  event_id: string;
  event_type: string;
  created_at: string;
};

type Row<T> = T;
type Insert<T, Optional extends keyof T> = Omit<T, Optional> &
  Partial<Pick<T, Optional>>;
type Update<T> = Partial<T>;

type TableDef<T, OptionalInsert extends keyof T> = {
  Row: Row<T>;
  Insert: Insert<T, OptionalInsert>;
  Update: Update<T>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      businesses: TableDef<
        Business,
        | "id"
        | "created_at"
        | "plan"
        | "subscription_status"
        | "stripe_customer_id"
        | "brand_primary_color"
        | "brand_secondary_color"
        | "logo_url"
        | "background_image_url"
        | "stamp_icon_url"
        | "show_business_name"
        | "timezone"
        | "last_billing_event_at"
      >;
      memberships: TableDef<Membership, "id" | "created_at" | "role" | "email">;
      invitations: TableDef<
        Invitation,
        "id" | "created_at" | "role" | "invited_by" | "accepted_at"
      >;
      locations: TableDef<
        Location,
        "id" | "created_at" | "address" | "lat" | "lng"
      >;
      programs: TableDef<
        Program,
        "id" | "created_at" | "type" | "active" | "design"
      >;
      customers: TableDef<
        Customer,
        | "id"
        | "created_at"
        | "full_name"
        | "email"
        | "phone"
        | "marketing_consent"
        | "consent_at"
        | "source_location_id"
        | "extra"
        | "birthday"
        | "terms_accepted_at"
      >;
      cards: TableDef<
        Card,
        | "id"
        | "created_at"
        | "updated_at"
        | "stamps"
        | "points"
        | "rewards"
        | "status"
        | "apple_serial"
        | "apple_pass_generated_at"
        | "google_object_id"
      >;
      stamp_events: TableDef<
        StampEvent,
        "id" | "created_at" | "kind" | "employee_id" | "location_id"
      >;
      redemptions: TableDef<Redemption, "id" | "created_at" | "redeemed_by">;
      apple_registrations: TableDef<AppleRegistration, "id" | "created_at">;
      subscriptions: TableDef<
        Subscription,
        | "id"
        | "created_at"
        | "updated_at"
        | "stripe_subscription_id"
        | "current_period_end"
        | "last_event_created_at"
      >;
      stripe_webhook_events: TableDef<StripeWebhookEvent, "created_at">;
      reward_definitions: TableDef<
        RewardDefinition,
        "id" | "created_at" | "updated_at" | "active" | "config"
      >;
      standalone_reward_grants: TableDef<
        StandaloneRewardGrant,
        | "id"
        | "created_at"
        | "status"
        | "granted_at"
        | "redeemed_at"
        | "redeemed_by"
      >;
    };
    Views: Record<string, never>;
    Functions: {
      apply_stamp: {
        Args: {
          p_card_id: string;
          p_employee_id: string;
          p_delta?: number;
          p_location_id?: string | null;
        };
        Returns: Card;
      };
      redeem_card: {
        Args: {
          p_card_id: string;
          p_employee_id: string;
          p_location_id?: string | null;
        };
        Returns: Card;
      };
      auth_business_ids: { Args: Record<string, never>; Returns: string[] };
      is_business_admin: { Args: { b: string }; Returns: boolean };
      sync_subscription_if_newer: {
        Args: {
          p_business_id: string;
          p_stripe_subscription_id: string;
          p_plan: PlanTier;
          p_status: SubscriptionStatus;
          p_current_period_end: string | null;
          p_event_created_at: string;
        };
        Returns: boolean;
      };
      customers_with_birthday_this_month: {
        Args: Record<string, never>;
        Returns: Customer[];
      };
      redeem_standalone_reward: {
        Args: {
          p_grant_id: string;
          p_employee_id: string;
          p_location_id?: string | null;
        };
        Returns: StandaloneRewardGrant;
      };
    };
    Enums: {
      membership_role: MembershipRole;
      plan_tier: PlanTier;
      subscription_status: SubscriptionStatus;
      program_type: ProgramType;
      card_status: CardStatus;
      stamp_kind: StampKind;
      standalone_reward_status: StandaloneRewardStatus;
    };
  };
}
