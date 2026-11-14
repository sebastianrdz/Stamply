const PAGE = 1000;

/** Collect every row of a query PostgREST would cap at max_rows (stable order required). */
export async function fetchAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
  size = PAGE,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if ((data?.length ?? 0) < size) return out;
  }
}
