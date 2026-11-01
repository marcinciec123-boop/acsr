import { describe, expect, it } from "vitest";
import { calculateEloPoints } from "../lib/eloSystem";
import { getRankingAxis } from "../lib/rankingScale";
import { teamDatabase, tier4Teams, getDynamicRanking } from "../data/tournaments";

describe("unlimited ranking capacity", () => {
  it("uses continuous rank differences for ELO beyond rank 100", () => {
    const match = { team: "A", opponent: "B", won: true, tier: "S" };
    expect(calculateEloPoints({ ...match, teamRank: 105, opponentRank: 150 })).toBe(3);
    expect(calculateEloPoints({ ...match, teamRank: 150, opponentRank: 105 })).toBe(37);
    expect(calculateEloPoints({ ...match, teamRank: 5, opponentRank: 50 })).toBe(3);
  });
  it("includes every base club after position 50 in Tier C", () => {
    expect(tier4Teams).toEqual(teamDatabase.slice(50).map(team => team.name));
    expect(tier4Teams).toContain("Warzone Gaming");
  });
  it("keeps a full ranking with 150 clubs", () => {
    const teams = Array.from({ length: 150 }, (_, i) => ({ name: `Club ${i + 1}`, points: 150 - i, country: "POL", region: "EU", roster: [] }));
    const ranked = getDynamicRanking(teams, {}, []);
    expect(ranked).toHaveLength(150);
    expect(ranked[149]?.name).toBe("Club 150");
  });
  it("extends the position axis past 100 to the next multiple of 25", () => {
    expect(getRankingAxis([51, 109])).toEqual({ upper: 125, ticks: [1, 25, 50, 75, 100, 125] });
    expect(getRankingAxis([105, 150])).toEqual({ upper: 150, ticks: [1, 25, 50, 75, 100, 125, 150] });
    expect(getRankingAxis([]).upper).toBe(100);
  });
});