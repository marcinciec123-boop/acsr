import { describe, expect, it } from "vitest";
import { compactSteps } from "@/lib/rankingHistory";

describe("compactSteps", () => {
  it("drops unchanged middle days but keeps every change and both ends", () => {
    const pts = [
      { date: "1", points: 10, rank: 5 }, { date: "2", points: 10, rank: 5 }, { date: "3", points: 10, rank: 5 },
      { date: "4", points: 12, rank: 4 }, { date: "5", points: 12, rank: 4 },
    ];
    expect(compactSteps(pts).map(p => p.date)).toEqual(["1", "3", "4", "5"]);
  });
});
