import { describe, expect, it } from "vitest";
import { canEditQualifierPoints, configuredRewards, qualifierPointsPatch, resolvePoints } from "./customPoints";
import type { TournamentData } from "./types";

const qualifier = (status: TournamentData["status"]): TournamentData => ({
  id: "loaded-qualifier", name: "Qualifier", kind: "qualifier", tier: "A", status,
  organizer: "", prizePool: "—", startDate: "", endDate: "", location: "",
  teams: 2, format: "Single Elimination", participants: ["A", "B"], phases: [], placements: [],
});

describe("qualifier rewards", () => {
  it("preserves configured points and prizes for single and regional creation", () => {
    const points = { "1": 37, "2": 0 };
    const prizes = { "1": 125, "2": 0 };
    const single = { ...qualifier("upcoming"), ...configuredRewards(true, points, true, prizes) };
    const regional = { ...qualifier("upcoming"), ...configuredRewards(true, points, true, prizes) };
    points["1"] = 999;
    expect(resolvePoints(single, 1)).toBe(37);
    expect(resolvePoints(regional, 2)).toBe(0);
    expect(single.customPrizes).toEqual({ "1": 125, "2": 0 });
    expect(regional.customPrizes).toEqual(single.customPrizes);
  });

  it.each(["upcoming", "live"] as const)("allows VRS corrections in loaded %s qualifiers", status => {
    const loaded = JSON.parse(JSON.stringify(qualifier(status))) as TournamentData;
    expect(canEditQualifierPoints(loaded)).toBe(true);
    const updated = { ...loaded, ...qualifierPointsPatch(loaded, { "1": 17, "2": 0 }) };
    expect(resolvePoints(updated, 1)).toBe(17);
    expect(resolvePoints(updated, 2)).toBe(0);
    expect(updated.placements).toEqual([]);
  });

  it("leaves completed qualifier history unchanged", () => {
    const completed = { ...qualifier("completed"), customPoints: { "1": 37 } };
    expect(canEditQualifierPoints(completed)).toBe(false);
    expect(qualifierPointsPatch(completed, { "1": 999 })).toEqual({});
  });

  it("blocks confirmed results even if a qualifier was reopened", () => {
    expect(qualifierPointsPatch({ ...qualifier("live"), resultsConfirmed: true }, { "1": 999 })).toEqual({});
  });
});