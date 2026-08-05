/**
 * Minimal `{placeholder}` interpolation for dictionary strings — the whole
 * templating layer this project needs, so we don't pull in an ICU library.
 * `t("{count} opted in", { count: 3 })` → `"3 opted in"`.
 */
export function interpolate(
  template: string,
  vars: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
