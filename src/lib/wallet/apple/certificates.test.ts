import { afterEach, describe, expect, it, vi } from "vitest";

// `@/lib/env` caches parsed env in a module singleton on first `serverEnv()`
// call, so each distinct env combination needs a fresh module registry.
async function freshCertificates() {
  vi.resetModules();
  return import("./certificates");
}

function stubCoreEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("appleCertificates", () => {
  it("throws a clear error when a required cert env var is missing", async () => {
    stubCoreEnv();
    const { appleCertificates } = await freshCertificates();
    expect(() => appleCertificates()).toThrow(
      "Missing APPLE_WWDR_CERT_BASE64 — required for Apple Wallet pass signing. Set it in your environment.",
    );
  });

  it("decodes base64 env vars into buffers via a round trip", async () => {
    stubCoreEnv();
    const wwdr = Buffer.from("wwdr-pem-contents");
    const signerCert = Buffer.from("signer-cert-pem");
    const signerKey = Buffer.from("signer-key-pem");
    vi.stubEnv("APPLE_WWDR_CERT_BASE64", wwdr.toString("base64"));
    vi.stubEnv("APPLE_PASS_CERT_BASE64", signerCert.toString("base64"));
    vi.stubEnv("APPLE_PASS_KEY_BASE64", signerKey.toString("base64"));
    vi.stubEnv("APPLE_PASS_CERT_PASSWORD", "s3cret");

    const { appleCertificates } = await freshCertificates();
    const certs = appleCertificates();

    expect(certs.wwdr.equals(wwdr)).toBe(true);
    expect(certs.signerCert.equals(signerCert)).toBe(true);
    expect(certs.signerKey.equals(signerKey)).toBe(true);
    expect(certs.signerKeyPassphrase).toBe("s3cret");
  });
});

describe("applePassConfig", () => {
  it("throws a clear error when APPLE_PASS_TYPE_ID is missing", async () => {
    stubCoreEnv();
    const { applePassConfig } = await freshCertificates();
    expect(() => applePassConfig()).toThrow(
      "Missing APPLE_PASS_TYPE_ID — required for Apple Wallet. Set it in your environment.",
    );
  });

  it("returns the configured pass type + team identifiers", async () => {
    stubCoreEnv();
    vi.stubEnv("APPLE_PASS_TYPE_ID", "pass.com.stamply.loyalty");
    vi.stubEnv("APPLE_TEAM_ID", "TEAM1234");

    const { applePassConfig } = await freshCertificates();
    expect(applePassConfig()).toEqual({
      passTypeIdentifier: "pass.com.stamply.loyalty",
      teamIdentifier: "TEAM1234",
    });
  });
});
