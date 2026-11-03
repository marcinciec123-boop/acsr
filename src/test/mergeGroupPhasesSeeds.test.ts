import { describe, it, expect } from "vitest";
import { mergeGroupPhases } from "@/lib/mergeGroupPhases";
import { ESL_PRO_LEAGUE_I_SEED } from "@/lib/eslProLeagueISeed";
import { ESEA_MASTERS_2026_SEED } from "@/lib/eseaMasters2026Seed";
import type { TournamentData } from "@/lib/types";

const allMatches = (t: TournamentData) =>
  t.phases.flatMap(p => [...(p.bracket || []), ...(p.groups || []).flatMap(g => g.matches)]);
const kills = (t: TournamentData) =>
  allMatches(t).reduce((s, m) => s + (m.maps || []).reduce((a, mp) =>
    a + [...(mp.team1Players || []), ...(mp.team2Players || [])].reduce((k, p) => k + (p.kills || 0), 0), 0), 0);

describe("historical group merge keeps results", () => {
  for (const [name, t] of [["ESL", ESL_PRO_LEAGUE_I_SEED[0]], ["ESEA", ESEA_MASTERS_2026_SEED[0]]] as const) {
    it(`${name}: Group A + B become one phase with every match and stat`, () => {
      const merged = mergeGroupPhases(t);
      expect(merged.phases.length).toBe(t.phases.length - 1);
      expect(merged.phases[0].groups?.length).toBe(2);
      expect(merged.phases[0].mergedGroups).toBe(true);
      expect(merged.phases[0].advanceCount).toBe(t.phases.slice(0, 2).reduce((s, p) => s + (p.advanceCount || 0), 0));
      merged.phases[0].groups!.forEach((g, i) => expect(g.matches).toEqual(t.phases[i].bracket));
      expect(allMatches(merged).map(m => m.id).sort()).toEqual(allMatches(t).map(m => m.id).sort());
      expect(JSON.stringify(allMatches(merged).map(m => [m.id, m.score1, m.score2]).sort()))
        .toBe(JSON.stringify(allMatches(t).map(m => [m.id, m.score1, m.score2]).sort()));
      expect(kills(merged)).toBe(kills(t));
      expect(merged.placements).toEqual(t.placements);
    });
  }
});
