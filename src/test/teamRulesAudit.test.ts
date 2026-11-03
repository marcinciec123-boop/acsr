import { describe, it, expect } from "vitest";
import { withdrawTeamFromTournament } from "@/lib/teamManagement";
import type { TournamentData } from "@/lib/types";

const t = (status: TournamentData["status"]): TournamentData => ({
  id: "x", name: "X", status, participants: ["A", "B"], placements: [],
  phases: [{ id: "p", name: "P", format: "single-elim", bo: 3, teams: ["A", "B"],
    bracket: [{ id: "m", team1: "A", team2: "B", score1: 0, score2: 0, bo: 3 }] }],
} as unknown as TournamentData);

describe("disband during a tournament", () => {
  it("before start: slot left for a replacement", () => {
    const out = withdrawTeamFromTournament(t("upcoming"), "A");
    expect(out.participants).toEqual(["TBD-disband", "B"]);
    expect(out.phases[0].bracket![0].team1).toBe("TBD-disband");
  });
  it("during the event: opponent wins by walkover (Bo3 = 2:0)", () => {
    const m = withdrawTeamFromTournament(t("live"), "A").phases[0].bracket![0];
    expect([m.score1, m.score2, m.walkover]).toEqual([0, 2, true]);
  });
  it("finished tournament stays untouched", () => {
    const done = t("completed");
    expect(withdrawTeamFromTournament(done, "A")).toBe(done);
  });
});
