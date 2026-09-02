import { cloneElement, isValidElement, type ReactNode } from "react";

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

/**
 * Like `interpolate`, but lets `vars` carry React nodes (e.g. a `<Link>`)
 * instead of plain strings — useful when a dictionary string needs to embed
 * an actual element rather than its stringified form.
 */
export function interpolateNodes(
  template: string,
  vars: Record<string, ReactNode>,
): ReactNode[] {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const match = /^\{(\w+)\}$/.exec(part);
    if (match && match[1] in vars) {
      const node = vars[match[1]];
      return isValidElement(node) ? cloneElement(node, { key: `${match[1]}-${i}` }) : node;
    }
    return part;
  });
}
