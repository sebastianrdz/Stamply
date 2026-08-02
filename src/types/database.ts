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
  show_business_name: boolean;
  timezone: string;
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
};

export type Card = Timestamped & {
  id: string;
  business_id: string;
  program_id: string;
  customer_id: string;
  stamps: number;
  points: number;
  status: CardStatus;
  barcode_value: string;
  pass_auth_token: string;
  apple_serial: string | null;
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
  updated_at: string;
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
        | "show_business_name"
        | "timezone"
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
      >;
      cards: TableDef<
        Card,
        | "id"
        | "created_at"
        | "updated_at"
        | "stamps"
        | "points"
        | "status"
        | "apple_serial"
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
    };
    Enums: {
      membership_role: MembershipRole;
      plan_tier: PlanTier;
      subscription_status: SubscriptionStatus;
      program_type: ProgramType;
      card_status: CardStatus;
      stamp_kind: StampKind;
    };
  };
}
