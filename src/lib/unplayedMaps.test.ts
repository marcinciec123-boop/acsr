import { describe, it, expect } from "vitest";
import { playedMapCount, isMapUnplayed } from "./matchStatus";
const m = (a: number, b: number) => ({ map: "x", score1: a, score2: b });
describe("unplayed maps", () => {
  it("Bo3 2:0 leaves third map unplayed", () => {
    const maps = [m(13, 5), m(13, 9), m(0, 0)];
    expect(playedMapCount(maps, 3)).toBe(2);
    expect(isMapUnplayed(maps, 2, 3)).toBe(true);
  });
  it("Bo5 3:0 leaves maps 4 and 5 unplayed", () => {
    expect(playedMapCount([m(13, 1), m(13, 2), m(13, 3), m(0, 0), m(0, 0)], 5)).toBe(3);
  });
  it("Bo3 1:1 keeps decider playable", () => {
    expect(isMapUnplayed([m(13, 5), m(5, 13), m(0, 0)], 2, 3)).toBe(false);
  });
});
