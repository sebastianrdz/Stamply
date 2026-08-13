import "server-only";

import { cache } from "react";
import type { Locale } from "./config";
import type esDictionaryShape from "./dictionaries/es.json";

/** es.json is the canonical shape every other locale must match. */
export type Dictionary = typeof esDictionaryShape;

async function loadEs(): Promise<Dictionary> {
  const mod = await import("./dictionaries/es.json");
  return mod.default;
}

// The explicit `Promise<Dictionary>` return type ties en.json to the es.json
// shape at compile time: a key missing or renamed in en.json makes this
// `return` a type error under `tsc`, not just a silent runtime fallback.
async function loadEn(): Promise<Dictionary> {
  const mod = await import("./dictionaries/en.json");
  return mod.default;
}

const loaders: Record<Locale, () => Promise<Dictionary>> = {
  es: loadEs,
  en: loadEn,
};

/** Load the dictionary for `locale`. Memoized per request via React `cache()`. */
export const getDictionary = cache(
  async (locale: Locale): Promise<Dictionary> => loaders[locale](),
);
