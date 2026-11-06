import { useEffect, useRef, useState } from "react";
import { loadFromStorage, removeFromStorage, saveToStorage } from "./storage";
import type { MatchResult, TeamData } from "./types";

export const matchDraftKey = (tournamentId: string | undefined, matchId: string) =>
  `match_draft_${encodeURIComponent(tournamentId ?? "")}_${encodeURIComponent(matchId)}`;

interface SavedDraft { base: string; match: MatchResult }

/** Draft writes never touch tournament/ranking storage or domain notifications. */
export function useMatchDraft(committed: MatchResult, tournamentId?: string) {
  const key = matchDraftKey(tournamentId, committed.id);
  const base = JSON.stringify(committed);
  const [match, setMatch] = useState(() => {
    const saved = loadFromStorage<SavedDraft | null>(key, null);
    return saved?.base === base ? saved.match : committed;
  });
  const latest = useRef(match);
  const dirty = useRef(false);
  const baseRef = useRef(base);
  baseRef.current = base;

  const flush = () => {
    if (dirty.current) saveToStorage(key, { base: baseRef.current, match: latest.current });
  };
  useEffect(() => {
    const timer = window.setTimeout(flush, 400);
    return () => window.clearTimeout(timer);
  }, [match, key]);
  useEffect(() => {
    window.addEventListener("beforeunload", flush);
    return () => { window.removeEventListener("beforeunload", flush); flush(); };
  }, [key]);

  return {
    match,
    update: (patch: Partial<MatchResult>) => {
      const next = { ...latest.current, ...patch };
      latest.current = next;
      dirty.current = true;
      setMatch(next);
    },
    clear: (next: MatchResult) => {
      dirty.current = false;
      latest.current = next;
      setMatch(next);
      removeFromStorage(key);
    },
  };
}

/** Reconfirmation replaces the old award, rather than awarding it twice. */
export function rankingAfterMatchConfirmation(ranking: TeamData[], previous: MatchResult, next: MatchResult): TeamData[] {
  const award = (match: MatchResult, team: string) => {
    if (!match.resultConfirmed || match.score1 === match.score2) return 0;
    const winner = match.score1 > match.score2 ? match.team1 : match.team2;
    const loser = match.score1 > match.score2 ? match.team2 : match.team1;
    return team === winner ? (match.pointsWinner ?? 0) : team === loser ? -(match.pointsLoser ?? 0) : 0;
  };
  return ranking.map(team => ({ ...team, points: Math.max(0, team.points - award(previous, team.name) + award(next, team.name)) }));
}