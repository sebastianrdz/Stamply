import { describe, expect, it } from "vitest";
import { pesosToCents, settingsSchema } from "./settings-schema";

const s = settingsSchema({
  businessNameRequired: "name",
  supportEmailInvalid: "email",
  supportPhoneInvalid: "phone",
  localeInvalid: "locale",
  timezoneInvalid: "tz",
  averageTicketInvalid: "ticket",
  reviewUrlInvalid: "review",
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
    [{ google_review_url: "http://g.page/r/x" }, "review"],
    [{ google_review_url: "https://evil.io/x" }, "review"],
    [{ average_ticket: "0" }, "ticket"],
    [{ average_ticket: "-5" }, "ticket"],
    [{ average_ticket: "1.234" }, "ticket"],
    [{ average_ticket: "1000000" }, "ticket"],
  ])("rejects %j", (extra, msg) => {
    const r = s.safeParse({ ...base, ...extra });
    expect(r.success ? "" : r.error.issues[0].message).toBe(msg);
  });
  it("rejects an unknown timezone", () => {
    expect(s.safeParse({ ...base, timezone: "Mars/Olympus" }).success).toBe(false);
    expect(s.safeParse({ ...base, timezone: "America/Mexico_City" }).success).toBe(true);
  });
});

describe("average ticket", () => {
  it("empty clears it; valid pesos convert to cents", () => {
    expect(s.parse({ ...base, average_ticket: " " }).average_ticket).toBeNull();
    expect(pesosToCents(null)).toBeNull();
    expect(pesosToCents("120")).toBe(12000);
    expect(pesosToCents("99.5")).toBe(9950);
    expect(pesosToCents("999999.99")).toBe(99_999_999);
  });
});

describe("google review url", () => {
  it("empty clears it; a Google link is kept", () => {
    expect(s.parse({ ...base, google_review_url: " " }).google_review_url).toBeNull();
    expect(
      s.parse({ ...base, google_review_url: "https://g.page/r/abc/review" })
        .google_review_url,
    ).toBe("https://g.page/r/abc/review");
  });
});
