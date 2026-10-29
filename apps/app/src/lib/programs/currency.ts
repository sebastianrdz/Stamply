export const CURRENCIES = [
  "USD",
  "MXN",
  "EUR",
  "GBP",
  "CAD",
  "COP",
  "ARS",
  "CLP",
  "PEN",
  "BRL",
] as const;
export type Currency = (typeof CURRENCIES)[number];
export const DEFAULT_CURRENCY: Currency = "USD";

export const isCurrency = (v: unknown): v is Currency =>
  (CURRENCIES as readonly unknown[]).includes(v);

/** "$1", "MX$1", "€1"… */
export const oneOf = (code: string): string =>
  new Intl.NumberFormat("en", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(1);
