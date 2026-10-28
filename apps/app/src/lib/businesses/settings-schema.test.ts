import { describe, expect, it } from "vitest";
import { settingsSchema } from "./settings-schema";

const s = settingsSchema({
  businessNameRequired: "name",
  supportEmailInvalid: "email",
  supportPhoneInvalid: "phone",
  localeInvalid: "locale",
  timezoneInvalid: "tz",
});
const base = { name: "Cafe", timezone: "UTC" };

describe("settingsSchema", () => {
  it("maps empty contact fields to null", () => {
    const r = s.parse({
      ...base,
      support_email: "",
      support_phone: " ",
      locale: "",
    });
    expect(r).toMatchObject({
      support_email: null,
      support_phone: null,
      locale: null,
    });
  });
  it("accepts valid values", () => {
    const r = s.parse({
      ...base,
      support_email: "a@b.co",
      support_phone: "+52 (55) 1234-5678",
      locale: "en",
    });
    expect(r.locale).toBe("en");
  });
  it.each([
    [{ support_email: "nope" }, "email"],
    [{ support_phone: "abc" }, "phone"],
    [{ locale: "fr" }, "locale"],
  ])("rejects %j", (extra, msg) => {
    const r = s.safeParse({ ...base, ...extra });
    expect(r.success ? "" : r.error.issues[0].message).toBe(msg);
  });
  it("rejects an unknown timezone", () => {
    expect(s.safeParse({ ...base, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(s.safeParse({ ...base, timezone: "America/Mexico_City" }).success).toBe(true);
  });
});
