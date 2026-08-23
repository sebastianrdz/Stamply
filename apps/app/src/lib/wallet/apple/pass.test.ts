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

// Mocked so pass tests stay hermetic (no native rasterizer); the icon renderer
// has its own unit tests in icon.test.ts.
vi.mock("./icon", () => ({
  renderPassIconSet: vi.fn(async () => ({
    "icon.png": Buffer.from("icon"),
    "icon@2x.png": Buffer.from("icon2x"),
    "icon@3x.png": Buffer.from("icon3x"),
  })),
}));

// Mocked so tests stay hermetic and don't hit the native rasterizer; returns
// a buffer tagged with the requested width so callers can tell scales apart.
const renderStampStripMock = vi.fn(
  async ({ width }: { width: number }) => Buffer.from(`stamp-strip-${width}`),
);
vi.mock("@/lib/wallet/stamp-image", () => ({
  renderStampStrip: (...args: [{ width: number }]) =>
    renderStampStripMock(...args),
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
    rewards: 0,
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
  availableRewards?: number,
): Promise<Record<string, unknown>> {
  await buildApplePass(c, locations, availableRewards);
  const [buffers] = pkPassCtor.mock.calls.at(-1) as [Record<string, Buffer>];
  return JSON.parse(buffers["pass.json"].toString());
}

beforeEach(() => {
  pkPassCtor.mockClear();
  appUrlBaseMock.mockReturnValue("http://localhost:3000");
  renderStampStripMock.mockClear();
});

async function buildPassBuffers(
  c: CardWithRelations,
  availableRewards?: number,
): Promise<Record<string, Buffer>> {
  await buildApplePass(c, undefined, availableRewards);
  const [buffers] = pkPassCtor.mock.calls.at(-1) as [Record<string, Buffer>];
  return buffers;
}

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
    expect(json.webServiceURL).toBe("https://stamply.example/api/apple");
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
    expect(storeCard.headerFields[0].label).toBe("SELLOS");
    expect(storeCard.headerFields[0].value).toBe("4/10");
  });

  it("shows POINTS as the header label/unit for a points program", async () => {
    const json = await buildPassJson(
      cardWithRelations({ points: 250 }, {}, { type: "points", goal: 500 }),
    );
    const storeCard = json.storeCard as { headerFields: Array<Record<string, unknown>> };
    expect(storeCard.headerFields[0].label).toBe("PUNTOS");
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
    expect(jsonLocations[0].relevantText).toBe("Estás cerca de Downtown");
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

  it("renders the stamp-grid strip at 1x/2x/3x for a stamp program", async () => {
    const c = cardWithRelations({ stamps: 3 }, {}, { type: "stamp", goal: 8 });
    const buffers = await buildPassBuffers(c);

    expect(renderStampStripMock).toHaveBeenCalledTimes(3);
    const widths = renderStampStripMock.mock.calls.map(([opts]) => opts.width);
    expect(widths.sort((a, b) => a - b)).toEqual([375, 750, 1125]);
    expect(renderStampStripMock).toHaveBeenCalledWith(
      expect.objectContaining({ progress: 3, goal: 8 }),
    );
    expect(buffers["strip.png"]).toEqual(Buffer.from("stamp-strip-375"));
    expect(buffers["strip@2x.png"]).toEqual(Buffer.from("stamp-strip-750"));
    expect(buffers["strip@3x.png"]).toEqual(Buffer.from("stamp-strip-1125"));
  });

  it("falls back to the raw background strip when the stamp renderer throws, instead of failing pass generation", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    renderStampStripMock.mockRejectedValueOnce(new Error("rasterizer failed"));
    renderStampStripMock.mockRejectedValueOnce(new Error("rasterizer failed"));
    renderStampStripMock.mockRejectedValueOnce(new Error("rasterizer failed"));

    const c = cardWithRelations(
      {},
      { background_image_url: "https://cdn.example/bg.jpg" },
      { type: "stamp" },
    );

    // Must not throw: a render failure has to degrade to the legacy strip,
    // not break pass generation (the APNs webservice route that also calls
    // buildApplePass has no try/catch of its own).
    const buffers = await buildPassBuffers(c);

    expect(buffers["strip.png"]).toEqual(Buffer.from("strip"));
    expect(buffers["strip@2x.png"]).toEqual(Buffer.from("strip"));
    expect(buffers["strip@3x.png"]).toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("omits primaryFields but keeps secondaryFields for a stamp program (strip collision)", async () => {
    const json = await buildPassJson(
      cardWithRelations({}, {}, { type: "stamp" }),
    );
    const storeCard = json.storeCard as Record<string, unknown>;
    expect(storeCard.primaryFields).toBeUndefined();
    expect(storeCard.secondaryFields).toEqual([
      { key: "name", label: "NOMBRE", value: "Jane Doe" },
      {
        key: "rewards",
        label: "PREMIOS",
        value: "0",
        textAlignment: "PKTextAlignmentRight",
      },
    ]);
  });

  it("shows the customer name and available-rewards count in secondaryFields for both program types", async () => {
    const stampJson = await buildPassJson(
      cardWithRelations({}, {}, { type: "stamp" }),
      undefined,
      3,
    );
    const pointsJson = await buildPassJson(
      cardWithRelations({}, {}, { type: "points" }),
      undefined,
      3,
    );
    for (const json of [stampJson, pointsJson]) {
      const storeCard = json.storeCard as { secondaryFields: Array<Record<string, unknown>> };
      expect(storeCard.secondaryFields).toEqual([
        { key: "name", label: "NOMBRE", value: "Jane Doe" },
        {
          key: "rewards",
          label: "PREMIOS",
          value: "3",
          textAlignment: "PKTextAlignmentRight",
        },
      ]);
    }
  });

  it("falls back to 'Member' when the customer has no full_name", async () => {
    const c = cardWithRelations();
    c.customer.full_name = null;
    const json = await buildPassJson(c);
    const storeCard = json.storeCard as { secondaryFields: Array<Record<string, unknown>> };
    expect(storeCard.secondaryFields[0]).toEqual({
      key: "name",
      label: "NOMBRE",
      value: "Miembro",
    });
  });

  it("includes localized detail back fields (web link, created by, pass id, last sync)", async () => {
    const json = await buildPassJson(
      cardWithRelations(
        { apple_serial: "serial-xyz", pass_auth_token: "tok_xyz" },
        { name: "The Coffee Spot" },
      ),
    );
    const backFields = (
      json.storeCard as { backFields: Array<Record<string, unknown>> }
    ).backFields;
    const byKey = Object.fromEntries(backFields.map((f) => [f.key, f]));

    expect(byKey.howto.label).toBe("Cómo funciona");
    expect(byKey.web.label).toBe("Ver en la web");
    expect(byKey.web.value).toContain("/c/tok_xyz");
    expect(byKey.web.attributedValue).toContain("<a href=");
    expect(byKey.createdBy).toEqual({
      key: "createdBy",
      label: "Creado por",
      value: "The Coffee Spot",
    });
    expect(byKey.passId).toEqual({
      key: "passId",
      label: "ID del pase",
      value: "serial-xyz",
    });
    expect(byKey.lastSync.label).toBe("Última actualización");
    expect(typeof byKey.lastSync.value).toBe("string");
  });

  it("keeps the raw background strip and primaryFields for a points program", async () => {
    const c = cardWithRelations(
      {},
      { background_image_url: "https://cdn.example/bg.jpg" },
      { type: "points" },
    );
    const buffers = await buildPassBuffers(c);
    const json = JSON.parse(buffers["pass.json"].toString());

    expect(renderStampStripMock).not.toHaveBeenCalled();
    expect(buffers["strip.png"]).toEqual(Buffer.from("strip"));
    expect(buffers["strip@3x.png"]).toBeUndefined();
    expect(json.storeCard.primaryFields).toEqual([
      { key: "reward", label: "PREMIO", value: "A free coffee" },
    ]);
  });
});
