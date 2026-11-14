import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/assets/upload", () => ({
  resolveImageField: vi.fn(async () => undefined), // form sent no icon: keep current
}));

import { milestoneIcons } from "./milestone-icons";

const REFERRAL = {
  enabled: true,
  referrer_bonus: 1,
  referred_bonus: 1,
  monthly_cap: 5,
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (config: any, existing: any = {}) =>
  milestoneIcons(
    {} as never,
    "biz-1",
    new FormData(),
    config,
    existing,
    {} as never,
  );

describe("milestoneIcons", () => {
  it("keeps the referral settings, which it must not drop when rebuilding the config", async () => {
    const r = await run({ referral: REFERRAL });
    expect(r).toEqual({ config: { referral: REFERRAL } });
  });

  it("keeps referral alongside milestones and colors", async () => {
    const r = await run(
      {
        milestones: [{ at: 3, reward: "Coffee", icon_color: "#112233" }],
        reward_icon_color: "#445566",
        referral: REFERRAL,
      },
      {
        milestones: [{ at: 3, reward: "Coffee", icon_url: "https://x/y.png" }],
      },
    );
    expect(r).toEqual({
      config: {
        milestones: [
          {
            at: 3,
            reward: "Coffee",
            icon_url: "https://x/y.png",
            icon_color: "#112233",
          },
        ],
        reward_icon_color: "#445566",
        referral: REFERRAL,
      },
    });
  });

  it("omits referral when the program has none", async () => {
    const r = await run({});
    expect(r).toEqual({ config: {} });
  });
});
