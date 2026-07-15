import { customAlphabet } from "nanoid";

// URL/QR-safe alphabet, no ambiguous characters.
const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

const shortId = customAlphabet(alphabet, 12);
const longId = customAlphabet(alphabet, 32);

/** Opaque value embedded in wallet passes / web card and scanned at checkout. */
export function newBarcodeValue(): string {
  return `stmp_${shortId()}`;
}

/** Secret token authorizing pass web-service + card page access for one card. */
export function newPassAuthToken(): string {
  return longId();
}

/** Apple pass serial number (stable per card). */
export function newAppleSerial(): string {
  return shortId();
}
