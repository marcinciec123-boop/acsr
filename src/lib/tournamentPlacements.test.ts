import { describe, it, expect } from "vitest";
import { finalPhasePlacements } from "./tournamentPlacements";
import { computePhaseWinners } from "./phaseWinners";

const m = (id: string, round: string, team1: string, team2: string, score1: number, score2: number) =>
  ({ id, round, team1, team2, score1, score2, bo: 1, maps: [{ map: "Mirage", score1: score1 ? 13 : 5, score2: score2 ? 13 : 5 }] } as any);

describe("final placements", () => {
  it("league ranks follow the table, not participant order", () => {
    const phase: any = { format: "league", teams: ["C", "B", "A"], groups: [{ name: "Liga", teams: ["C", "B", "A"], matches: [
      m("1", "R1", "A", "B", 1, 0), m("2", "R2", "A", "C", 1, 0), m("3", "R3", "B", "C", 1, 0)] }] };
    expect(finalPhasePlacements(phase).map(p => p.team)).toEqual(["A", "B", "C"]);
  });
  it("bronze match decides 3rd and 4th", () => {
    const phase: any = { format: "single-elim", teams: [], bracket: [
      m("s1", "Semifinal", "A", "B", 1, 0), m("s2", "Semifinal", "C", "D", 1, 0),
      m("f", "Final", "A", "C", 1, 0), m("b", "Mecz o 3. miejsce", "B", "D", 0, 1)] };
    expect(finalPhasePlacements(phase)).toEqual([
      { team: "A", placement: 1 }, { team: "C", placement: 2 }, { team: "D", placement: 3 }, { team: "B", placement: 4 }]);
  });
  it("double elim: lower-bracket GF winner advances first", () => {
    const phase: any = { format: "double-elim", teams: [], advanceCount: 2, bracket: [
      m("u", "UB Final", "A", "B", 1, 0), m("g", "Grand Final", "A", "B", 0, 1)] };
    expect(computePhaseWinners(phase).slice(0, 2)).toEqual(["B", "A"]);
  });
});
