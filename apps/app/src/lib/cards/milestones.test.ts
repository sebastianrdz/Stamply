import { describe, expect, it } from "vitest";
import {
  availableMilestones,
  milestoneEarned,
  slotColors,
  slotIcons,
  stampMilestones,
} from "./milestones";

const config = {
  milestones: [
    { at: 5, reward: "Drink", icon_url: "u5" },
    { at: 3, reward: "Cookie" },
    { at: 3, reward: "dup" },
    { at: 8, reward: "ignored (at == goal)" },
  ],
  reward_icon_url: "final",
};
const program = { type: "stamp", goal: 8, config };

describe("stamp milestones", () => {
  it("keeps valid unique milestones below the goal, sorted", () => {
    expect(stampMilestones(config, 8).map((m) => m.at)).toEqual([3, 5]);
  });

  it("earns once per cycle", () => {
    expect(milestoneEarned(2, 3, 8)).toBe(0);
    expect(milestoneEarned(3, 3, 8)).toBe(1);
    expect(milestoneEarned(10, 3, 8)).toBe(1);
    expect(milestoneEarned(11, 3, 8)).toBe(2);
  });

  it("subtracts redeemed rewards and hides spent ones", () => {
    const a = availableMilestones(
      { stamps: 5, milestones_redeemed: { "3": 1 } },
      program,
    );
    expect(a.map((m) => [m.at, m.available])).toEqual([[5, 1]]);
    expect(availableMilestones({ stamps: 2 }, program)).toEqual([]);
    expect(
      availableMilestones({ stamps: 5 }, { ...program, type: "points" }),
    ).toEqual([]);
  });

  it("maps slot icons, including the final reward slot", () => {
    expect(slotIcons(config, 8)).toEqual({ 5: "u5", 8: "final" });
  });

  it("maps per-slot colors, ignoring invalid ones", () => {
    const c = {
      milestones: [
        { at: 3, reward: "Cookie", icon_color: "#ff0000" },
        { at: 5, reward: "Drink", icon_color: "red" },
      ],
      reward_icon_color: "#00ff00",
    };
    expect(slotColors(c, 8)).toEqual({ 3: "#ff0000", 8: "#00ff00" });
  });
});
