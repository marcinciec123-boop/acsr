// Auto-resolves any match involving "BYE" so it never blocks the user with a
// "needs to be simulated" prompt, and stamps `playedAt` on freshly finalized
// matches so chronological match history works correctly.

import type { MatchResult, MatchMap, TournamentData } from "./types";

const isBye = (t?: string) => t === "BYE";

const winsNeededFor = (bo?: 1 | 3 | 5) => (bo === 5 ? 3 : bo === 3 ? 2 : 1);

const hasFinalScore = (m: MatchResult): boolean => {
  if (isBye(m.team1) || isBye(m.team2)) return true;
  if (!m.team1 || !m.team2) return false;
  if (m.team1.startsWith("TBD") || m.team2.startsWith("TBD")) return false;
  if ((m.score1 || 0) + (m.score2 || 0) <= 0) return false;
  if (m.score1 === m.score2) return false;
  return true;
};

/** Auto-fills BYE match results so they don't require manual interaction. */
const resolveByeMatch = (m: MatchResult): MatchResult => {
  const wins = winsNeededFor(m.bo);
  if (isBye(m.team2) && m.team1 && !isBye(m.team1) && !m.team1.startsWith("TBD")) {
    if (m.score1 === wins && m.score2 === 0 && m.playedAt) return m;
    return { ...m, score1: wins, score2: 0, playedAt: m.playedAt || new Date().toISOString() };
  }
  if (isBye(m.team1) && m.team2 && !isBye(m.team2) && !m.team2.startsWith("TBD")) {
    if (m.score2 === wins && m.score1 === 0 && m.playedAt) return m;
    return { ...m, score1: 0, score2: wins, playedAt: m.playedAt || new Date().toISOString() };
  }
  return m;
};

/** Stamp `playedAt` on a match if it just got a final score and didn't have one. */
export const stampPlayedAt = (prev: MatchResult, next: MatchResult): MatchResult => {
  const finalNow = hasFinalScore(next);
  const finalBefore = hasFinalScore(prev);
  if (finalNow && (!next.playedAt || !finalBefore)) {
    return { ...next, playedAt: next.playedAt || new Date().toISOString() };
  }
  // Reset playedAt if scores were cleared
  if (!finalNow && next.playedAt && !isBye(next.team1) && !isBye(next.team2)) {
    return { ...next, playedAt: undefined };
  }
  return next;
};

const normalizeMatchList = (matches?: MatchResult[]): MatchResult[] | undefined => {
  if (!matches) return matches;
  return matches.map(resolveByeMatch);
};

/** Walk an entire tournament and auto-resolve every BYE match in every phase/group. */
export const normalizeTournamentByes = (t: TournamentData): TournamentData => {
  const phases = t.phases?.map(p => ({
    ...p,
    bracket: normalizeMatchList(p.bracket),
    groups: p.groups?.map(g => ({ ...g, matches: normalizeMatchList(g.matches) || [] })),
  }));
  return {
    ...t,
    phases: phases || [],
    matches: normalizeMatchList(t.matches),
  };
};

export const normalizeAllTournamentByes = (ts: TournamentData[]): TournamentData[] =>
  ts.map(normalizeTournamentByes);

export type { MatchMap };
