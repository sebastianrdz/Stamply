import { vi } from "vitest";

/**
 * Shared fake Supabase query-builder for unit tests. Every chain method
 * returns the same builder instance (so tests can assert on `.eq`/`.neq`/etc
 * call args after the fact) and the builder itself is a thenable that
 * resolves to the configured result, mirroring how the real Supabase client
 * lets you `await` a query at any point in the chain.
 */
export interface FakeQueryResult<T = unknown> {
  data?: T | null;
  error?: { message: string } | null;
  count?: number | null;
}

export interface FakeQueryBuilder<T = unknown> {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (
    resolve: (value: FakeQueryResult<T>) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise<unknown>;
}

/** Build a chainable fake query builder that resolves to `result` however it's awaited. */
export function makeQueryBuilder<T = unknown>(
  result: FakeQueryResult<T>,
): FakeQueryBuilder<T> {
  const builder = {} as FakeQueryBuilder<T>;
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.insert = vi.fn(self);
  builder.update = vi.fn(self);
  builder.delete = vi.fn(self);
  builder.eq = vi.fn(self);
  builder.neq = vi.fn(self);
  builder.ilike = vi.fn(self);
  builder.in = vi.fn(self);
  builder.gte = vi.fn(self);
  builder.order = vi.fn(self);
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

/**
 * Fake `.from(table)` router. Configure per-table result(s): a single result
 * reused for every call, or an array consumed one-per-call (sticking on the
 * last entry once exhausted) for code paths that hit the same table twice
 * with different expected outcomes (e.g. lookup-then-insert).
 */
export function makeSupabaseMock(
  config: Record<string, FakeQueryResult | FakeQueryResult[]>,
) {
  const builders: Record<string, FakeQueryBuilder[]> = {};
  const callCounts: Record<string, number> = {};

  const from = vi.fn((table: string) => {
    const cfgEntry = config[table];
    const resultsArr = Array.isArray(cfgEntry)
      ? cfgEntry
      : [cfgEntry ?? { data: null, error: null, count: null }];
    const idx = callCounts[table] ?? 0;
    callCounts[table] = idx + 1;
    const result = resultsArr[Math.min(idx, resultsArr.length - 1)];
    const builder = makeQueryBuilder(result);
    builders[table] = builders[table] ?? [];
    builders[table].push(builder);
    return builder;
  });

  /** The nth (default first) builder created for `table`. */
  function builderFor(table: string, call = 0): FakeQueryBuilder {
    const list = builders[table];
    if (!list || !list[call]) {
      throw new Error(`No builder recorded for table "${table}" call #${call}`);
    }
    return list[call];
  }

  return { from, builders, builderFor, callCounts };
}
