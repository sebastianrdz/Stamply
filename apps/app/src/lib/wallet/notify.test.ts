/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("@/lib/wallet/apple/apns", () => ({
  pushToDevices: (...a: unknown[]) => pushMock(...a),
}));
const addOfferMock = vi.fn(async (..._a: unknown[]) => undefined);
const patchClassMock = vi.fn(async (..._a: unknown[]) => undefined);
const patchObjectMock = vi.fn(async (..._a: unknown[]) => undefined);
vi.mock("@/lib/wallet/google/wallet", () => ({
  addOfferMessage: (...a: unknown[]) => addOfferMock(...a),
  patchLoyaltyClass: (...a: unknown[]) => patchClassMock(...a),
  patchLoyaltyObject: (...a: unknown[]) => patchObjectMock(...a),
}));
vi.mock("@/lib/cards/queries", () => ({ getCardByToken: vi.fn() }));
const kickMock = vi.fn();
vi.mock("@/lib/wallet/kick", () => ({ kickWalletPush: () => kickMock() }));

import { notifyOffers, notifyProgramDesignChanged } from "./notify";

type Row = Record<string, any>;

/**
 * Fake Supabase client that behaves like PostgREST: a query without `.range`
 * returns at most 1,000 rows (the max_rows cap that caused the bug), `.range`
 * returns that slice, `.in` filters. Records the `.range` calls per table.
 */
function postgrest(tables: Record<string, Row[]>) {
  const ranges: Record<string, [number, number][]> = {};
  const updates: Record<string, number> = {};
  const from = (table: string) => {
    let rows = tables[table] ?? [];
    let range: [number, number] | null = null;
    let isUpdate = false;
    const b: any = {
      select: () => b,
      update: () => ((isUpdate = true), b),
      eq: () => b,
      order: () => b,
      in: (col: string, vals: unknown[]) => {
        rows = rows.filter((r) => vals.includes(r[col]));
        return b;
      },
      range: (f: number, t: number) => {
        range = [f, t];
        (ranges[table] ??= []).push(range);
        return b;
      },
      then: (resolve: any, reject: any) => {
        if (isUpdate) {
          updates[table] = (updates[table] ?? 0) + rows.length;
          return Promise.resolve({ error: null }).then(resolve, reject);
        }
        const data = range
          ? rows.slice(range[0], range[1] + 1)
          : rows.slice(0, 1000);
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      },
    };
    return b;
  };
  return { client: { from } as any, ranges, updates };
}

const offer = (over: Row = {}) =>
  ({
    id: "off-1",
    business_id: "biz-1",
    customer_id: null,
    body: "2x1",
    ...over,
  }) as any;

const cards = (n: number, googleEvery = 1) =>
  Array.from({ length: n }, (_, i) => ({
    id: `card-${i}`,
    customer_id: `cust-${i}`,
    google_object_id: i % googleEvery === 0 ? `g-${i}` : null,
  }));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("notifyOffers beyond 1,000 passes", () => {
  it("reaches every opted-in card of a broadcast, not just the first 1,000", async () => {
    const { client, ranges } = postgrest({
      cards: cards(2500),
      apple_registrations: [],
    });
    const sent = await notifyOffers(client, [offer()]);
    expect(sent).toBe(2500);
    expect(addOfferMock).toHaveBeenCalledTimes(2500);
    expect(ranges.cards).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("pushes every Apple device even when a chunk of cards has more than 1,000 tokens", async () => {
    // 200 cards x 6 devices = 1,200 tokens for the first chunk.
    const regs = cards(200).flatMap((c, i) =>
      Array.from({ length: 6 }, (_, d) => ({
        id: `reg-${i}-${d}`,
        card_id: c.id,
        push_token: `tok-${i}-${d}`,
      })),
    );
    const { client } = postgrest({
      cards: cards(200),
      apple_registrations: regs,
    });
    await notifyOffers(client, [offer()]);
    const tokens = pushMock.mock.calls.flatMap((c) => c[0] as string[]);
    expect(tokens).toHaveLength(1200);
    expect(new Set(tokens).size).toBe(1200);
  });

  it("still handles per-customer offers (non-broadcast) and an empty audience", async () => {
    const { client } = postgrest({ cards: cards(3), apple_registrations: [] });
    const offers = [0, 1, 2].map((i) =>
      offer({ id: `o${i}`, customer_id: `cust-${i}` }),
    );
    expect(await notifyOffers(client, offers)).toBe(3);
    expect(await notifyOffers(client, [])).toBe(0);
  });
});

function client(rpcResult: { error: unknown }) {
  const rpc = vi.fn(async () => rpcResult);
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "not", "limit"]) b[m] = () => b;
  b.maybeSingle = async () => ({ data: { id: "card-1" }, error: null });
  const from = vi.fn(() => b);
  return { c: { from, rpc } as never, rpc, from };
}

describe("notifyProgramDesignChanged", () => {
  it("patches the class once, queues the refresh and never touches cards", async () => {
    const { c, rpc, from } = client({ error: null });
    await notifyProgramDesignChanged(c, "prog-1");
    expect(patchClassMock).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("request_program_wallet_refresh", {
      p_program_id: "prog-1",
    });
    expect(patchObjectMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1); // only the one class-source lookup
    expect(kickMock).toHaveBeenCalledTimes(1);
  });

  it("throws when the queue call fails so callers can log it", async () => {
    const { c } = client({ error: new Error("rpc") });
    await expect(notifyProgramDesignChanged(c, "p")).rejects.toThrow("rpc");
  });
});
