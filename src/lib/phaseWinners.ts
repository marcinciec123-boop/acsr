// ===== Compute winners from a finished phase =====
// Returns the ordered list of teams that should advance to the next phase.
// - swiss:        all teams marked "advanced" by the Swiss engine, sorted by standing
// - groups:       top N per group (advanceCount split evenly) by group standings
// - single/double-elim / showmatch: Grand Final winner first, then runner-up,
//                                   then semi losers (best-effort by round name)

import type { TournamentPhase, MatchResult } from "./types";
import { computeSwissStage } from "./swissEngine";
import { computeGroupStandings } from "./tournamentBuilder";

const isReal = (s: string | undefined): s is string =>
  !!s && s !== "BYE" && s !== "TBD" && !s.startsWith("TBD");

const winnerOf = (m: MatchResult): string | null => {
  if (!isReal(m.team1) || !isReal(m.team2)) {
    if (isReal(m.team1) && m.team2 === "BYE") return m.team1;
    if (isReal(m.team2) && m.team1 === "BYE") return m.team2;
    return null;
  }
  if ((m.score1 || 0) + (m.score2 || 0) === 0) return null;
  if (m.score1 === m.score2) return null;
  return m.score1 > m.score2 ? m.team1 : m.team2;
};

const loserOf = (m: MatchResult): string | null => {
  if (!isReal(m.team1) || !isReal(m.team2)) return null;
  if ((m.score1 || 0) + (m.score2 || 0) === 0) return null;
  if (m.score1 === m.score2) return null;
  return m.score1 > m.score2 ? m.team2 : m.team1;
};

export interface PhaseFinishStatus {
  finished: boolean;
  done: number;
  total: number;
}

export function getPhaseFinishStatus(phase: TournamentPhase): PhaseFinishStatus {
  if (phase.format === "swiss" && phase.bracket) {
    const n = phase.teams.length;
    const winCap = n >= 14 && n <= 18 ? 3 : n >= 6 && n <= 10 ? 2 : n >= 26 ? 4 : 3;
    const stage = computeSwissStage(phase.teams, phase.bracket, { winCap });
    const total = stage.standings.length;
    const done = stage.standings.filter(s => s.status !== "playing").length;
    return { finished: stage.finished, done, total };
  }
  let done = 0, total = 0;
  if (phase.bracket) {
    total += phase.bracket.length;
    done += phase.bracket.filter(m => m.score1 + m.score2 > 0 || m.team1 === "BYE" || m.team2 === "BYE").length;
  }
  if (phase.groups) {
    phase.groups.forEach(g => {
      total += g.matches.length;
      done += g.matches.filter(m => m.score1 + m.score2 > 0).length;
    });
  }
  return { finished: total > 0 && done === total, done, total };
}

export function computePhaseWinners(phase: TournamentPhase): string[] {
  // SWISS
  if (phase.format === "swiss" && phase.bracket) {
    const n = phase.teams.length;
    const winCap = n >= 14 && n <= 18 ? 3 : n >= 6 && n <= 10 ? 2 : n >= 26 ? 4 : 3;
    const stage = computeSwissStage(phase.teams, phase.bracket, { winCap });
    return stage.standings
      .filter(s => s.status === "advanced")
      .map(s => s.team)
      .filter(isReal);
  }

  // GROUPS
  if (phase.groups && phase.groups.length > 0) {
    const perGroup = phase.advanceCount && phase.groups.length > 0
      ? Math.max(1, Math.ceil(phase.advanceCount / phase.groups.length))
      : 2;
    const winners: string[] = [];
    phase.groups.forEach(g => {
      if (phase.format === "gsl-de-groups") {
        const by = (slot: string) => g.matches.find(m => m.bracketSlot === slot);
        const qualified = [
          winnerOf(by("IEM-UB-SF-M1") as MatchResult),
          winnerOf(by("IEM-UB-SF-M2") as MatchResult),
          winnerOf(by("IEM-LB-FINAL") as MatchResult),
          winnerOf(by("IEM-LB-R2-M1") as MatchResult),
          winnerOf(by("IEM-LB-R2-M2") as MatchResult),
        ].filter((team): team is string => !!team && isReal(team));
        qualified.slice(0, perGroup).forEach(team => {
          if (!winners.includes(team)) winners.push(team);
        });
        return;
      }
      const standings = computeGroupStandings(g);
      standings.slice(0, perGroup).forEach(s => {
        if (isReal(s.team) && !winners.includes(s.team)) winners.push(s.team);
      });
    });
    return winners;
  }

  // BRACKET (single / double elim / showmatch)
  // Advancing teams = "survivors" — teams that appear in the bracket and never
  // lost a decided match. This correctly handles cases where the user only
  // plays the first round(s) and deletes later matches (e.g. QF winners of a
  // 32-team single-elim should be the 8 advancing teams).
  if (phase.bracket && phase.bracket.length > 0) {
    const seen = new Set<string>();
    const participants: string[] = [];
    const losers = new Set<string>();
    phase.bracket.forEach(m => {
      [m.team1, m.team2].forEach(t => {
        if (isReal(t) && !seen.has(t)) { seen.add(t); participants.push(t); }
      });
      const l = loserOf(m);
      if (l) losers.add(l);
    });
    const survivors = participants.filter(t => !losers.has(t));
    const need = phase.advanceCount || survivors.length;
    if (survivors.length >= need) return survivors.slice(0, need);
    // Fallback: fill remaining slots with the most-recent-round losers
    const rounds = Array.from(new Set(phase.bracket.map(m => m.round || "Match")));
    const out = [...survivors];
    for (let i = rounds.length - 1; i >= 0 && out.length < need; i--) {
      phase.bracket.filter(m => (m.round || "Match") === rounds[i]).forEach(m => {
        const l = loserOf(m);
        if (l && !out.includes(l)) out.push(l);
      });
    }
    return out.slice(0, need);
  }

  return [];
}

/**
 * Returns the ordered list of teams eliminated in earlier (non-final) phases,
 * best to worst. Uses Swiss / group standings so that e.g. 2-3 finishes above
 * 1-3 and 0-3, and 2nd in a group is above 3rd/4th.
 * Teams appearing multiple times (advanced further) are de-duplicated by first occurrence.
 */
export function getPreFinalEliminatedOrder(phases: TournamentPhase[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (team: string) => {
    if (!isReal(team) || seen.has(team)) return;
    seen.add(team);
    out.push(team);
  };

  // Iterate phases from LAST-1 to first — later phases (deeper) rank higher.
  for (let i = phases.length - 2; i >= 0; i--) {
    const phase = phases[i];
    if (phase.format === "swiss" && phase.bracket) {
      const n = phase.teams.length;
      const winCap = n >= 14 && n <= 18 ? 3 : n >= 6 && n <= 10 ? 2 : n >= 26 ? 4 : 3;
      const stage = computeSwissStage(phase.teams, phase.bracket, { winCap });
      // standings already sorted advanced > playing > eliminated, then wins desc / losses asc / buchholz / roundDiff
      stage.standings.forEach(s => push(s.team));
    } else if (phase.groups && phase.groups.length > 0) {
      // Interleave groups by rank (all 1sts, then all 2nds...) so mid-group teams sort fairly
      const perGroup = phase.groups.map(g => computeGroupStandings(g));
      const maxLen = Math.max(0, ...perGroup.map(s => s.length));
      for (let rank = 0; rank < maxLen; rank++) {
        for (const st of perGroup) {
          if (st[rank]) push(st[rank].team);
        }
      }
    } else if (phase.bracket) {
      // Bracket sub-phase — order losers by round from last to first
      const rounds = Array.from(new Set(phase.bracket.map(m => m.round || "Match")));
      for (let r = rounds.length - 1; r >= 0; r--) {
        phase.bracket.filter(m => (m.round || "Match") === rounds[r]).forEach(m => {
          const l = loserOf(m);
          if (l) push(l);
        });
      }
    }
  }
  return out;
}
