import { describe, it, expect } from "vitest";
import { mergeGroupPhases } from "@/lib/mergeGroupPhases";
import type { TournamentData } from "@/lib/types";

const t = (phases: any[]) => ({ id: "t", name: "T", phases } as unknown as TournamentData);
const gsl = (id: string, name: string) => ({ id, name, format: "double-elim", bo: 3, teams: [id + "1", id + "2"], advanceCount: 2,
  bracket: [{ id: id + "m", team1: "", team2: "", score1: 0, score2: 0, bracketSlot: "GSL-OM1", round: "Opening" }] });

describe("mergeGroupPhases", () => {
  it("joins Group A and Group B phases into one phase with two groups", () => {
    const out = mergeGroupPhases(t([gsl("a", "Group A"), gsl("b", "Group B"), { id: "p", name: "Playoffs", format: "single-elim", bo: 3, teams: [], bracket: [] }]));
    expect(out.phases).toHaveLength(2);
    expect(out.phases[0].groups!.map(g => g.name)).toEqual(["Group A", "Group B"]);
    expect(out.phases[0].format).toBe("gsl-groups");
    expect(out.phases[0].advanceCount).toBe(4);
    expect(out.phases[0].groups![1].matches[0].id).toBe("bm");
  });
  it("leaves a single group phase and non-group phases untouched", () => {
    const input = t([gsl("a", "Group A"), { id: "p", name: "Playoffs", format: "single-elim", bo: 3, teams: [], bracket: [] }]);
    expect(mergeGroupPhases(input)).toBe(input);
  });
});
