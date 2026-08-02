import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Business, Card, Customer, Program } from "@/types/database";
import type { CardWithRelations } from "@/lib/cards/queries";

const requestMock = vi.fn();
const getClientMock = vi.fn(async () => ({ request: requestMock }));
const googleAuthCtor = vi.fn();

vi.mock("google-auth-library", () => ({
  GoogleAuth: class {
    constructor(opts: unknown) {
      googleAuthCtor(opts);
    }
    getClient() {
      return getClientMock();
    }
  },
}));

const jwtSignMock = vi.fn((..._args: unknown[]) => "signed.jwt.token");
vi.mock("jsonwebtoken", () => ({
  default: { sign: (...args: unknown[]) => jwtSignMock(...args) },
}));

function stubCoreEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://stamply.example");
}

function stubGoogleEnv(issuerId = "3388000000012345678") {
  vi.stubEnv("GOOGLE_WALLET_ISSUER_ID", issuerId);
  vi.stubEnv("GOOGLE_WALLET_SA_EMAIL", "sa@stamply-project.iam.gserviceaccount.com");
  vi.stubEnv(
    "GOOGLE_WALLET_SA_KEY_BASE64",
    Buffer.from("-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----").toString(
      "base64",
    ),
  );
}

async function freshWallet() {
  vi.resetModules();
  return import("./wallet");
}

beforeEach(() => {
  requestMock.mockReset();
  getClientMock.mockClear();
  googleAuthCtor.mockClear();
  jwtSignMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function business(overrides: Partial<Business> = {}): Business {
  return {
    id: "biz-1",
    name: "The Coffee Spot",
    slug: "coffee-spot",
    owner_user_id: "owner-1",
    plan: "small",
    subscription_status: "active",
    stripe_customer_id: null,
    brand_primary_color: "#7c5cfc",
    brand_secondary_color: "#000000",
    logo_url: null,
    background_image_url: null,
    show_business_name: true,
    timezone: "UTC",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function program(overrides: Partial<Program> = {}): Program {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    business_id: "biz-1",
    name: "Coffee Punch Card",
    type: "stamp",
    goal: 10,
    reward_description: "A free coffee",
    active: true,
    design: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function customer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "cust-1",
    business_id: "biz-1",
    full_name: "Jane Doe",
    email: "jane@example.com",
    phone: null,
    marketing_consent: false,
    consent_at: null,
    source_location_id: null,
    extra: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    business_id: "biz-1",
    program_id: "11111111-2222-3333-4444-555555555555",
    customer_id: "cust-1",
    stamps: 4,
    points: 0,
    status: "active",
    barcode_value: "stmp_abc123",
    pass_auth_token: "tok_abc123",
    apple_serial: "serial-abc",
    google_object_id: null,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function cardWithRelations(): CardWithRelations {
  return {
    ...card(),
    business: business(),
    program: program(),
    customer: customer(),
  };
}

describe("classId / objectId", () => {
  it("strips hyphens from the id and prefixes with program_/card_", async () => {
    stubCoreEnv();
    stubGoogleEnv("3388000000012345678");
    const { classId, objectId } = await freshWallet();

    const programId = "11111111-2222-3333-4444-555555555555";
    const cardId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    expect(classId(programId)).toBe(
      `3388000000012345678.program_${programId.replace(/-/g, "")}`,
    );
    expect(objectId(cardId)).toBe(
      `3388000000012345678.card_${cardId.replace(/-/g, "")}`,
    );
  });

  it("sanitize() strips characters other than word chars, dot, and dash", async () => {
    stubCoreEnv();
    stubGoogleEnv("issuer123");
    const { classId } = await freshWallet();
    // No hyphens here, but spaces/symbols should still be stripped by sanitize().
    expect(classId("abc def!@#123")).toBe("issuer123.program_abcdef123");
  });

  it("throws when GOOGLE_WALLET_ISSUER_ID is missing", async () => {
    stubCoreEnv();
    const { classId } = await freshWallet();
    expect(() => classId("prog-1")).toThrow(/Missing GOOGLE_WALLET_ISSUER_ID/);
  });
});

describe("ensureLoyaltyClass", () => {
  it("POSTs the loyalty class when the GET 404s", async () => {
    stubCoreEnv();
    stubGoogleEnv();
    requestMock.mockImplementation(({ method }: { method: string }) => {
      if (method === "GET") return Promise.reject(new Error("404"));
      return Promise.resolve({});
    });

    const { ensureLoyaltyClass, classId } = await freshWallet();
    await ensureLoyaltyClass(cardWithRelations());

    const postCall = requestMock.mock.calls.find(
      ([opts]) => opts.method === "POST",
    );
    expect(postCall).toBeDefined();
    const [postOpts] = postCall!;
    expect(postOpts.url).toBe(
      "https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass",
    );
    expect(postOpts.data.id).toBe(classId(program().id));
    expect(postOpts.data.issuerName).toBe("The Coffee Spot");
    expect(postOpts.data.programName).toBe("Coffee Punch Card");
  });

  it("does NOT POST when the GET succeeds (class already exists)", async () => {
    stubCoreEnv();
    stubGoogleEnv();
    requestMock.mockResolvedValue({ data: { id: "exists" } });

    const { ensureLoyaltyClass } = await freshWallet();
    await ensureLoyaltyClass(cardWithRelations());

    const postCall = requestMock.mock.calls.find(
      ([opts]) => opts.method === "POST",
    );
    expect(postCall).toBeUndefined();
  });
});

describe("ensureLoyaltyObject", () => {
  it("POSTs the loyalty object when the GET 404s", async () => {
    stubCoreEnv();
    stubGoogleEnv();
    requestMock.mockImplementation(({ method }: { method: string }) => {
      if (method === "GET") return Promise.reject(new Error("404"));
      return Promise.resolve({});
    });

    const { ensureLoyaltyObject, objectId, classId } = await freshWallet();
    await ensureLoyaltyObject(cardWithRelations());

    const postCalls = requestMock.mock.calls.filter(
      ([opts]) => opts.method === "POST",
    );
    // One POST for the class, one for the object.
    expect(postCalls.length).toBe(2);
    const objectPost = postCalls.find(([opts]) =>
      opts.url.endsWith("/loyaltyObject"),
    );
    expect(objectPost).toBeDefined();
    const data = objectPost![0].data;
    expect(data.id).toBe(objectId(card().id));
    expect(data.classId).toBe(classId(program().id));
    expect(data.state).toBe("ACTIVE");
    expect(data.barcode).toEqual({ type: "QR_CODE", value: "stmp_abc123" });
    expect(data.loyaltyPoints).toEqual({ label: "Stamps", balance: { int: 4 } });
  });

  it("does NOT POST the object when the GET succeeds", async () => {
    stubCoreEnv();
    stubGoogleEnv();
    requestMock.mockResolvedValue({ data: {} });

    const { ensureLoyaltyObject } = await freshWallet();
    await ensureLoyaltyObject(cardWithRelations());

    const postCalls = requestMock.mock.calls.filter(
      ([opts]) => opts.method === "POST",
    );
    expect(postCalls.length).toBe(0);
  });
});

describe("googleSaveUrl", () => {
  it("returns a pay.google.com save URL wrapping the signed JWT", async () => {
    stubCoreEnv();
    stubGoogleEnv();
    requestMock.mockResolvedValue({ data: {} }); // GETs succeed, no POSTs needed

    const { googleSaveUrl, objectId } = await freshWallet();
    const url = await googleSaveUrl(cardWithRelations());

    expect(url).toBe("https://pay.google.com/gp/v/save/signed.jwt.token");
    expect(jwtSignMock).toHaveBeenCalledTimes(1);
    const [claims] = jwtSignMock.mock.calls[0];
    expect((claims as { payload: { loyaltyObjects: Array<{ id: string }> } }).payload
      .loyaltyObjects[0].id).toBe(objectId(card().id));
  });
});
