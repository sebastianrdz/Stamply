/* eslint-disable @typescript-eslint/no-explicit-any */
// In-memory PostgREST-like fake shared by the push worker tests and the
// (LOAD=1) load simulation. Test-only.

export type Row = Record<string, any>;

/** In-memory PostgREST-like fake: 1,000-row cap on unpaged reads, RPCs mirror 0035. */
export function fakeDb(
  tables: Record<string, Row[]>,
  opts: {
    /** Awaited before every query and RPC (injected latency). */ delay?: () => Promise<void>;
  } = {},
) {
  const rpcs = { claim: 0, finish: 0 };
  const indexes = new Map<string, { rows: Row[]; map: Map<unknown, Row[]> }>();
  function lookup(name: string, col: string) {
    const key = `${name}.${col}`;
    const hit = indexes.get(key);
    if (hit && hit.rows === tables[name]) return hit.map;
    const map = new Map<unknown, Row[]>();
    for (const r of tables[name]) {
      const l = map.get(r[col]);
      if (l) l.push(r);
      else map.set(r[col], [r]);
    }
    indexes.set(key, { rows: tables[name], map });
    return map;
  }
  function from(name: string) {
    const filters: ((r: Row) => boolean)[] = [];
    let candidates: Row[] | null = null;
    let patch: Row | null = null;
    let rng: [number, number] | null = null;
    let lim: number | null = null;
    let head = false;
    let del = false;
    const orderBy: string[] = [];
    const run = () => {
      let rows = (candidates ?? tables[name]).filter((r) =>
        filters.every((f) => f(r)),
      );
      if (del) {
        tables[name] = tables[name].filter((r) => !rows.includes(r));
        return { data: null, error: null };
      }
      if (patch) {
        rows.forEach((r) => Object.assign(r, patch));
        return { data: null, error: null };
      }
      for (const k of [...orderBy].reverse())
        rows = [...rows].sort((a, b) =>
          a[k] < b[k] ? -1 : a[k] > b[k] ? 1 : 0,
        );
      const count = rows.length;
      if (rng) rows = rows.slice(rng[0], rng[1] + 1);
      else rows = rows.slice(0, Math.min(lim ?? 1000, 1000));
      return { data: head ? null : rows, count, error: null };
    };
    const b: any = {
      select: (_c?: string, o?: any) => ((head = !!o?.head), b),
      update: (p: Row) => ((patch = p), b),
      delete: () => ((del = true), b),
      lt: (k: string, v: number) => (filters.push((r) => r[k] < v), b),
      eq: (k: string, v: any) => (filters.push((r) => r[k] === v), b),
      in: (k: string, v: any[]) => {
        const set = new Set(v);
        filters.push((r) => set.has(r[k]));
        // Small lists use a lazy per-column index (keeps 25k-row sims fast).
        if (v.length <= 500 && !candidates)
          candidates = v.flatMap((x) => lookup(name, k).get(x) ?? []);
        return b;
      },
      order: (k: string) => (orderBy.push(k), b),
      range: (f: number, t: number) => ((rng = [f, t]), b),
      limit: (n: number) => ((lim = n), b),
      then: (res: any, rej: any) =>
        (opts.delay ? opts.delay() : Promise.resolve())
          .then(run)
          .then(res, rej),
    };
    return b;
  }
  const rpc = async (fn: string, a: any) => {
    await opts.delay?.();
    if (fn === "claim_wallet_refresh") {
      const picked = tables.wallet_refresh_queue
        .filter(
          (r) =>
            r.attempts < a.p_max_attempts && !(r.claimed_until > Date.now()),
        )
        .sort((x, y) => (x.card_id < y.card_id ? -1 : 1))
        .slice(0, a.p_limit);
      picked.forEach((r) => {
        r.attempts++;
        r.claimed_until = Date.now() + a.p_lease_seconds * 1000;
      });
      return { data: picked.map((r) => ({ card_id: r.card_id })), error: null };
    }
    const recs = tables.wallet_offer_recipients;
    const max = a.p_max_attempts;
    const pend = (r: Row) =>
      r.offer_id === a.p_offer_id &&
      !r.delivered_at &&
      (r.attempts < max || r.claimed_until > Date.now());
    if (fn === "claim_offer_recipients") {
      rpcs.claim++;
      const picked = recs
        .filter(
          (r) =>
            r.offer_id === a.p_offer_id &&
            !r.delivered_at &&
            r.attempts < max &&
            !(r.claimed_until > Date.now()),
        )
        .sort((x, y) => (x.customer_id < y.customer_id ? -1 : 1))
        .slice(0, a.p_limit);
      picked.forEach((r) => {
        r.attempts++;
        r.claimed_until = Date.now() + a.p_lease_seconds * 1000;
      });
      return { data: picked.map((r) => ({ ...r })), error: null };
    }
    rpcs.finish++;
    if (!recs.some(pend)) {
      const o = tables.wallet_offers.find((x) => x.id === a.p_offer_id);
      if (o?.delivery === "pending") o.delivery = "done";
    }
    return { data: true, error: null };
  };
  return { client: { from, rpc } as any, rpcs, tables };
}

export function seed(n: number, opts: { googleEvery?: number } = {}) {
  const customers = Array.from(
    { length: n },
    (_, i) => `c${String(i).padStart(5, "0")}`,
  );
  return {
    wallet_offers: [
      {
        id: "o1",
        business_id: "b",
        body: "hi",
        delivery: "pending",
        created_at: "1",
      },
      {
        id: "done",
        business_id: "b",
        body: "old",
        delivery: "done",
        created_at: "0",
      },
    ],
    wallet_offer_recipients: customers.map((c) => ({
      offer_id: "o1",
      customer_id: c,
      delivered_at: null,
      attempts: 0,
      claimed_until: null,
      last_error: null,
    })),
    cards: customers.map((c, i) => ({
      id: `card-${c}`,
      customer_id: c,
      business_id: "b",
      google_object_id:
        opts.googleEvery && i % opts.googleEvery === 0 ? `g-${c}` : null,
      updated_at: null,
    })),
    apple_registrations: customers.map((c, i) => ({
      id: String(i).padStart(6, "0"),
      card_id: `card-${c}`,
      push_token: `t-${c}`,
    })),
  } as Record<string, Row[]>;
}

export function seedRefresh(n: number, google = false) {
  const s = seed(n);
  s.cards.forEach((c, i) => {
    c.google_object_id = google ? `g-${i}` : null;
  });
  s.wallet_refresh_queue = s.cards.map((c) => ({
    card_id: c.id,
    attempts: 0,
    claimed_until: null,
    last_error: null,
  }));
  return s;
}
