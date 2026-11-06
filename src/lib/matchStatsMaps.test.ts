import { describe, expect, it } from "vitest";
import { matchStatsMaps, selectMatchStatsMaps } from "./matchStatsMaps";

const maps = [
  { map: "Mirage", score1: 13, score2: 4 },
  { map: "Nuke", score1: 13, score2: 8 },
  { map: "Dust2", score1: 13, score2: 10 },
];

describe("match statistics selection", () => {
  it("defaults to all counting maps", () => {
    expect(selectMatchStatsMaps(matchStatsMaps(maps, 3))).toEqual(maps.slice(0, 2));
  });
  it("selects only the requested map without changing the source", () => {
    const counting = matchStatsMaps(maps, 3);
    expect(selectMatchStatsMaps(counting, 1)).toEqual([maps[1]]);
    expect(counting).toEqual(maps.slice(0, 2));
  });
  it("excludes a map after 2:0 in Bo3 even when it contains a score", () => {
    expect(matchStatsMaps(maps, 3).map(m => m.map)).toEqual(["Mirage", "Nuke"]);
  });
  it("excludes unstarted maps", () => {
    expect(matchStatsMaps([{ map: "Nuke", score1: 0, score2: 0 }], 3)).toEqual([]);
  });
  it("excludes walkover statistics", () => {
    expect(matchStatsMaps(maps, 3, true)).toEqual([]);
  });
});