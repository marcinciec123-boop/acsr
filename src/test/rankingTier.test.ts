import { describe, expect, it } from "vitest";
import { getRankingTier } from "../lib/rankingTier";

describe("ranking tiers", () => {
  it("keeps Tier S at positions 1–10", () => {
    expect([1, 10, 11].map(getRankingTier)).toEqual(["S", "S", "A"]);
  });
  it("keeps Tier A at positions 11–25", () => {
    expect([11, 25, 26].map(getRankingTier)).toEqual(["A", "A", "B"]);
  });
  it("keeps Tier B at positions 26–50", () => {
    expect([26, 50, 51].map(getRankingTier)).toEqual(["B", "B", "C"]);
  });
  it("assigns Tier C to every position from 51 onward, including beyond 100", () => {
    expect([51, 100, 101, 109, 500, 1000].map(getRankingTier)).toEqual(Array(6).fill("C"));
  });
  it("does not assign a tier to unranked entries", () => {
    expect(getRankingTier(0)).toBeNull();
    expect(getRankingTier(-1)).toBeNull();
  });
});