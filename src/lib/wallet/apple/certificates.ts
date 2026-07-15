import "server-only";

import { decodeBase64Env, requireEnv } from "@/lib/env";

export interface AppleCertificates {
  wwdr: Buffer;
  signerCert: Buffer;
  signerKey: Buffer;
  signerKeyPassphrase?: string;
}

/** Load Apple PassKit signing certificates from base64-encoded env vars. */
export function appleCertificates(): AppleCertificates {
  const feature = "Apple Wallet pass signing";
  // Provide PEMs: signerCert (pass certificate), signerKey (its private key),
  // wwdr (Apple WWDR intermediate). Export them from the .p12 with openssl.
  return {
    wwdr: decodeBase64Env("APPLE_WWDR_CERT_BASE64", feature),
    signerCert: decodeBase64Env("APPLE_PASS_CERT_BASE64", feature),
    signerKey: decodeBase64Env("APPLE_PASS_KEY_BASE64", feature),
    signerKeyPassphrase: requireEnv("APPLE_PASS_CERT_PASSWORD", feature),
  };
}

export function applePassConfig() {
  const feature = "Apple Wallet";
  return {
    passTypeIdentifier: requireEnv("APPLE_PASS_TYPE_ID", feature),
    teamIdentifier: requireEnv("APPLE_TEAM_ID", feature),
  };
}
