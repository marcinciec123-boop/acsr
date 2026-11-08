import { useEffect, useRef, useState } from "react";
import { loadFromStorage, removeFromStorage, saveToStorage } from "./storage";
import type { MatchResult, TeamData, TournamentData } from "./types";

export type MatchMetadataPatch = Partial<Pick<MatchResult, "bo" | "scheduledAt">>;

/** Metadata edits do not publish draft results or propagate bracket winners. */
export function updateMatchMetadata(source: TournamentData[], tournamentId: string, phaseId: string, matchId: string, patch: MatchMetadataPatch, groupId?: string): TournamentData[] {
  const metadata: MatchMetadataPatch = {};
  if ("bo" in patch) metadata.bo = patch.bo;
  if ("scheduledAt" in patch) metadata.scheduledAt = patch.scheduledAt;
  const update = (m: MatchResult) => m.id === matchId ? { ...m, ...metadata } : m;
  return source.map(t => t.id !== tournamentId ? t : {
    ...t,
    phases: t.phases.map(p => p.id !== phaseId ? p : groupId ? {
      ...p, groups: p.groups?.map(g => g.id !== groupId ? g : { ...g, matches: g.matches.map(update) }),
    } : { ...p, bracket: p.bracket?.map(update) }),
  });
}

const resultBase = (match: MatchResult) => {
  const { bo, scheduledAt, ...result } = match;
  return JSON.stringify(result);
};
const withMetadata = (match: MatchResult, committed: MatchResult): MatchResult =>
  ({ ...match, bo: committed.bo, scheduledAt: committed.scheduledAt });

function restoreDraft(saved: SavedDraft | null, committed: MatchResult): MatchResult {
  if (saved) try {
    if (resultBase(JSON.parse(saved.base)) === resultBase(committed)) return withMetadata(saved.match, committed);
  } catch { /* Invalid or incompatible drafts cannot replace committed results. */ }
  return committed;
}

export const matchDraftKey = (tournamentId: string | undefined, matchId: string) =>
  `match_draft_${encodeURIComponent(tournamentId ?? "")}_${encodeURIComponent(matchId)}`;

interface SavedDraft { base: string; match: MatchResult }

/** Draft writes never touch tournament/ranking storage or domain notifications. */
export function useMatchDraft(committed: MatchResult, tournamentId?: string) {
  const key = matchDraftKey(tournamentId, committed.id);
  const base = JSON.stringify(committed);
  const [match, setMatch] = useState(() => {
    const saved = loadFromStorage<SavedDraft | null>(key, null);
    return restoreDraft(saved, committed);
  });
  const latest = useRef(match);
  const dirty = useRef(false);
  const baseRef = useRef(base);
  baseRef.current = base;
  const committedRef = useRef(committed);
  committedRef.current = committed;

  const flush = () => {
    if (dirty.current) saveToStorage(key, { base: baseRef.current, match: withMetadata(latest.current, committedRef.current) });
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
    match: withMetadata(match, committed),
    update: (patch: Partial<MatchResult>) => {
      const next = { ...withMetadata(latest.current, committedRef.current), ...patch };
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