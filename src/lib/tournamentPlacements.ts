import type { MatchResult, TournamentPhase } from "./types";
import { computeGroupStandings } from "./tournamentBuilder";
import { computeSwissStage } from "./swissEngine";
import { isMatchDecided } from "./matchStatus";
import { isThirdPlaceRound } from "./bracketRounds";

const isReal = (s?: string): s is string => !!s && s !== "BYE" && s !== "TBD" && !s.startsWith("TBD");
const winnerOf = (m: MatchResult) => isReal(m.team1) && isReal(m.team2) && isMatchDecided(m) ? (m.score1 > m.score2 ? m.team1 : m.team2) : "";
const loserOf = (m: MatchResult) => isReal(m.team1) && isReal(m.team2) && isMatchDecided(m) ? (m.score1 > m.score2 ? m.team2 : m.team1) : "";

export interface PlacedTeam { team: string; placement: number }

/** Final standings of the last phase, best first. Ties share a placement (e.g. both semi losers without a bronze match). */
export function finalPhasePlacements(phase: TournamentPhase | undefined): PlacedTeam[] {
  const out: PlacedTeam[] = [];
  const seen = new Set<string>();
  const add = (team: string, placement: number) => {
    if (!isReal(team) || seen.has(team)) return;
    seen.add(team); out.push({ team, placement });
  };
  if (!phase) return out;

  const bracket = phase.bracket || [];
  if (phase.format === "swiss" && bracket.length) {
    const n = phase.teams.length;
    const winCap = n >= 14 && n <= 18 ? 3 : n >= 6 && n <= 10 ? 2 : n >= 26 ? 4 : 3;
    computeSwissStage(phase.teams, bracket, { winCap }).standings.forEach(s => add(s.team, out.length + 1));
    return out;
  }
  if (!bracket.length && phase.groups?.length) {
    const per = phase.groups.map(g => computeGroupStandings(g));
    const max = Math.max(0, ...per.map(s => s.length));
    for (let r = 0; r < max; r++) {
      const place = out.length + 1;
      // Several groups: same rank in every group shares a placement.
      per.forEach(st => st[r] && add(st[r].team, per.length > 1 ? place : out.length + 1));
    }
    return out;
  }

  const rounds = Array.from(new Set(bracket.map(m => m.round || "Match")));
  const third = rounds.find(r => isThirdPlaceRound(r));
  const main = rounds.filter(r => r !== third);
  const finalRound = main.find(r => /grand\s*final/i.test(r)) || main.find(r => /^final$/i.test(r)) || main.find(r => /final/i.test(r)) || main[main.length - 1];
  bracket.filter(m => (m.round || "Match") === finalRound).forEach(m => { add(winnerOf(m), 1); add(loserOf(m), 2); });
  if (third) bracket.filter(m => m.round === third).forEach(m => { add(winnerOf(m), 3); add(loserOf(m), 4); });
  const semi = main.find(r => /semi|półfina/i.test(r));
  if (semi) { const p = out.length + 1; bracket.filter(m => m.round === semi).forEach(m => add(loserOf(m), p)); }
  for (let i = main.length - 1; i >= 0; i--) {
    const p = out.length + 1;
    bracket.filter(m => (m.round || "Match") === main[i]).forEach(m => add(loserOf(m), p));
  }
  return out;
}
