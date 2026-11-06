import { playedMaps } from "./matchStatus";
import type { MatchMap } from "./types";

/** Read-only selection: exclude unused veto maps, post-series maps and walkovers. */
export function matchStatsMaps(maps: MatchMap[], bo: number, walkover = false): MatchMap[] {
  return walkover ? [] : playedMaps(maps, bo).filter(m => m.score1 + m.score2 > 0);
}

export function selectMatchStatsMaps(maps: MatchMap[], selected: number | "all" = "all"): MatchMap[] {
  if (selected === "all" || !maps[selected]) return maps;
  return [maps[selected]];
}