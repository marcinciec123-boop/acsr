// ===== Frozen bookmaker odds =====
// Odds must be generated ONCE (before the match is played) and never move
// afterwards — neither when the result is entered nor when the ranking shifts.
// The first computed snapshot for a given match/teams/format is persisted and
// reused forever.

import { readUiPref, writeUiPref } from "./uiPrefs";

export interface OddsOutcome {
  label: string;
  prob: number;
  odds: number;
  favored: "t1" | "t2";
}

export interface OddsSnapshot {
  probWin1: number;
  odds1: number;
  odds2: number;
  correctScores: OddsOutcome[];
  /** ISO of the (fictional) moment the market was opened. */
  createdAt?: string;
}

const keyFor = (matchId: string, team1: string, team2: string, bo: number) =>
  `odds_${matchId}__${team1}__${team2}__bo${bo}`;

/**
 * Return the stored odds snapshot for this match, or compute + persist a new
 * one on first access. Subsequent calls always return the same numbers.
 */
export function resolveMatchOdds(
  matchId: string | undefined,
  team1: string,
  team2: string,
  bo: number,
  compute: () => OddsSnapshot,
): OddsSnapshot {
  if (!matchId || !team1 || !team2) return compute();
  const key = keyFor(matchId, team1, team2, bo);
  const stored = readUiPref<OddsSnapshot | null>(key, null);
  if (stored && typeof stored.odds1 === "number" && Array.isArray(stored.correctScores)) {
    return stored;
  }
  const fresh = compute();
  writeUiPref(key, fresh);
  return fresh;
}
