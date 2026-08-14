import type { MatchResult } from "./types";

type MatchTimeSource = Pick<MatchResult, "scheduledAt" | "playedAt"> & {
  fallbackDate?: string;
};

/**
 * The scheduled slot is the authoritative fictional-calendar time. Older
 * matches may only have playedAt, while imported history can fall back to the
 * tournament date.
 */
export function getMatchTimestamp(match: MatchTimeSource): number {
  const raw = match.scheduledAt || match.playedAt || match.fallbackDate || "";
  if (!raw) return 0;
  const timestamp = Date.parse(raw);
  if (Number.isFinite(timestamp)) return timestamp;
  const normalized = Date.parse(`${raw.slice(0, 10)}T00:00:00`);
  return Number.isFinite(normalized) ? normalized : 0;
}

export function getMatchDateTime(match: MatchTimeSource): string {
  return match.scheduledAt || match.playedAt || match.fallbackDate || "";
}

export function compareMatchesNewestFirst(
  a: MatchTimeSource & { id?: string },
  b: MatchTimeSource & { id?: string },
): number {
  const timeDifference = getMatchTimestamp(b) - getMatchTimestamp(a);
  if (timeDifference !== 0) return timeDifference;
  return (b.id || "").localeCompare(a.id || "");
}