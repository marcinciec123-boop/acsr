import type { MatchMap, MatchResult } from "./types";

export const winsNeededFor = (bo?: number): number => bo === 5 ? 3 : bo === 3 ? 2 : 1;

/** CS2 MR12, including overtime: a completed map needs a two-round lead. */
export const isMapDecided = (map: Pick<MatchMap, "score1" | "score2">): boolean =>
  Math.max(map.score1, map.score2) >= 13 && Math.abs(map.score1 - map.score2) >= 2;

const isRealTeam = (team?: string): boolean =>
  !!team && team !== "BYE" && !team.toUpperCase().startsWith("TBD");

/** A lead is not a final result; confirmation flags never override this rule. */
export function isMatchDecided(
  match: Pick<MatchResult, "team1" | "team2" | "score1" | "score2" | "bo">,
  defaultBo = 1,
): boolean {
  if (match.team1 === "BYE") return isRealTeam(match.team2);
  if (match.team2 === "BYE") return isRealTeam(match.team1);
  if (!isRealTeam(match.team1) || !isRealTeam(match.team2)) return false;
  return match.score1 !== match.score2 &&
    Math.max(match.score1, match.score2) >= winsNeededFor(match.bo ?? defaultBo);
}

export const isMatchInProgress = (match: MatchResult): boolean =>
  !isMatchDecided(match) && (match.score1 + match.score2 > 0 ||
    (match.maps || []).some(map => map.score1 + map.score2 > 0));

export function mapWins(maps: MatchMap[]): { score1: number; score2: number } {
  let score1 = 0, score2 = 0;
  for (const map of maps) {
    if (!isMapDecided(map)) continue;
    if (map.score1 > map.score2) score1++;
    else score2++;
  }
  return { score1, score2 };
}
/** Number of maps actually needed: once a side reaches the required wins, later maps are not played. */
export function playedMapCount(maps: MatchMap[], bo?: number): number {
  const need = winsNeededFor(bo);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < maps.length; i++) {
    if (s1 >= need || s2 >= need) return i;
    const m = maps[i];
    if (isMapDecided(m)) { if (m.score1 > m.score2) s1++; else s2++; }
  }
  return maps.length;
}

export const isMapUnplayed = (maps: MatchMap[], index: number, bo?: number): boolean =>
  index >= playedMapCount(maps, bo);

/** Maps that count toward results and statistics. */
export const playedMaps = (maps: MatchMap[] | undefined, bo?: number): MatchMap[] =>
  maps ? maps.slice(0, playedMapCount(maps, bo)) : [];
