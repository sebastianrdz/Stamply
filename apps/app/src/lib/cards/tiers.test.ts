import { describe, expect, it } from "vitest";
import { affordableTiers } from "./tiers";

describe("affordableTiers", () => {
  it("keeps original config indexes when stored out of order", () => {
    const tiers = [
      { points: 500, reward: "C" },
      { points: 100, reward: "A" },
      { points: 250, reward: "B" },
    ];
    expect(affordableTiers(tiers, 300).map((t) => [t.reward, t.index])).toEqual([
      ["A", 1],
      ["B", 2],
    ]);
  });

  it("returns nothing when no tier is affordable", () => {
    expect(affordableTiers([{ points: 10 }], 5)).toEqual([]);
  });
});
