import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Business, Card, Customer, Program } from "@/types/database";
import type { CardWithRelations } from "@/lib/cards/queries";

const pkPassCtor = vi.fn();

vi.mock("passkit-generator", () => ({
  PKPass: class {
    static ctorArgs: unknown[] = [];
    buffers: Record<string, Buffer>;
    certificates: unknown;
    constructor(buffers: Record<string, Buffer>, certificates: unknown) {
      pkPassCtor(buffers, certificates);
      this.buffers = buffers;
      this.certificates = certificates;
    }
    async getAsBuffer() {
      return Buffer.from("fake-pkpass");
    }
  },
}));

vi.mock("./certificates", () => ({
  appleCertificates: vi.fn(() => ({
    wwdr: Buffer.from("wwdr"),
    signerCert: Buffer.from("cert"),
    signerKey: Buffer.from("key"),
  })),
  applePassConfig: vi.fn(() => ({
    passTypeIdentifier: "pass.com.stamply.loyalty",
    teamIdentifier: "TEAM123",
  })),
}));

vi.mock("./assets", () => ({
  logoBuffer: vi.fn(async () => Buffer.from("logo")),
  imageBuffer: vi.fn(async (url: string | null) =>
    url ? Buffer.from("strip") : null,
  ),
  placeholderIcon: vi.fn(() => Buffer.from("icon")),
}));

const appUrlBaseMock = vi.fn(() => "http://localhost:3000");
vi.mock("@/lib/wallet/shared", () => ({
  appUrlBase: () => appUrlBaseMock(),
}));

import { buildApplePass, type PassLocation } from "./pass";

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
    id: "prog-1",
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
    id: "card-1",
    business_id: "biz-1",
    program_id: "prog-1",
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

function cardWithRelations(
  cardOverrides: Partial<Card> = {},
  businessOverrides: Partial<Business> = {},
  programOverrides: Partial<Program> = {},
): CardWithRelations {
  return {
    ...card(cardOverrides),
    business: business(businessOverrides),
    program: program(programOverrides),
    customer: customer(),
  };
}

async function buildPassJson(
  c: CardWithRelations,
  locations?: PassLocation[],
): Promise<Record<string, unknown>> {
  await buildApplePass(c, locations);
  const [buffers] = pkPassCtor.mock.calls.at(-1) as [Record<string, Buffer>];
  return JSON.parse(buffers["pass.json"].toString());
}

beforeEach(() => {
  pkPassCtor.mockClear();
  appUrlBaseMock.mockReturnValue("http://localhost:3000");
});

describe("buildApplePass", () => {
  it("derives backgroundColor/labelColor/foregroundColor from the brand color", async () => {
    const json = await buildPassJson(cardWithRelations({}, { brand_primary_color: "#ffffff" }));
    expect(json.backgroundColor).toBe("rgb(255, 255, 255)");
    // white background -> dark foreground/label text
    expect(json.foregroundColor).toBe("rgb(17, 19, 26)");
    expect(json.labelColor).toBe("rgb(17, 19, 26)");
  });

  it("uses white foreground/label text on a dark brand color", async () => {
    const json = await buildPassJson(cardWithRelations({}, { brand_primary_color: "#000000" }));
    expect(json.foregroundColor).toBe("rgb(255, 255, 255)");
    expect(json.labelColor).toBe("rgb(255, 255, 255)");
  });

  it("includes logoText when show_business_name is true", async () => {
    const json = await buildPassJson(
      cardWithRelations({}, { show_business_name: true, name: "The Coffee Spot" }),
    );
    expect(json.logoText).toBe("The Coffee Spot");
  });

  it("omits logoText when show_business_name is false", async () => {
    const json = await buildPassJson(
      cardWithRelations({}, { show_business_name: false }),
    );
    expect(json.logoText).toBeUndefined();
  });

  it("omits webServiceURL/authenticationToken on http:// (e.g. localhost)", async () => {
    appUrlBaseMock.mockReturnValue("http://localhost:3000");
    const json = await buildPassJson(cardWithRelations());
    expect(json.webServiceURL).toBeUndefined();
    expect(json.authenticationToken).toBeUndefined();
  });

  it("includes webServiceURL/authenticationToken on https://", async () => {
    appUrlBaseMock.mockReturnValue("https://stamply.example");
    const json = await buildPassJson(
      cardWithRelations({ pass_auth_token: "secret-token" }),
    );
    expect(json.webServiceURL).toBe("https://stamply.example/api/apple/v1");
    expect(json.authenticationToken).toBe("secret-token");
  });

  it("sets the barcode message/format from the card's barcode value", async () => {
    const json = await buildPassJson(
      cardWithRelations({ barcode_value: "stmp_xyz789" }),
    );
    const barcodes = json.barcodes as Array<Record<string, unknown>>;
    expect(barcodes[0].message).toBe("stmp_xyz789");
    expect(barcodes[0].format).toBe("PKBarcodeFormatQR");
  });

  it("shows STAMPS as the header label/unit for a stamp program", async () => {
    const json = await buildPassJson(
      cardWithRelations({ stamps: 4 }, {}, { type: "stamp", goal: 10 }),
    );
    const storeCard = json.storeCard as { headerFields: Array<Record<string, unknown>> };
    expect(storeCard.headerFields[0].label).toBe("STAMPS");
    expect(storeCard.headerFields[0].value).toBe("4/10");
  });

  it("shows POINTS as the header label/unit for a points program", async () => {
    const json = await buildPassJson(
      cardWithRelations({ points: 250 }, {}, { type: "points", goal: 500 }),
    );
    const storeCard = json.storeCard as { headerFields: Array<Record<string, unknown>> };
    expect(storeCard.headerFields[0].label).toBe("POINTS");
    expect(storeCard.headerFields[0].value).toBe("250/500");
  });

  it("truncates locations to a maximum of 10 entries", async () => {
    const locations: PassLocation[] = Array.from({ length: 15 }, (_, i) => ({
      lat: i,
      lng: i,
    }));
    const json = await buildPassJson(cardWithRelations(), locations);
    expect((json.locations as unknown[]).length).toBe(10);
  });

  it("sets relevantText only for locations that have a name", async () => {
    const locations: PassLocation[] = [
      { lat: 1, lng: 1, name: "Downtown" },
      { lat: 2, lng: 2 },
    ];
    const json = await buildPassJson(cardWithRelations(), locations);
    const jsonLocations = json.locations as Array<Record<string, unknown>>;
    expect(jsonLocations[0].relevantText).toBe("You're near Downtown");
    expect(jsonLocations[1].relevantText).toBeUndefined();
  });

  it("falls back serialNumber to card.id when apple_serial is null", async () => {
    const json = await buildPassJson(
      cardWithRelations({ apple_serial: null, id: "card-fallback" }),
    );
    expect(json.serialNumber).toBe("card-fallback");
  });

  it("uses apple_serial as serialNumber when present", async () => {
    const json = await buildPassJson(
      cardWithRelations({ apple_serial: "serial-xyz", id: "card-1" }),
    );
    expect(json.serialNumber).toBe("serial-xyz");
  });
});
