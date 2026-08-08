// ===== Player team history =====
// Builds a chronological list of team stints for a player from dated
// transfers, and splits each stint into active / inactive (bench) segments
// using the bench log.

import { loadFromStorage } from "./storage";
import { getAllTransfers } from "@/data/history";
import { teamDatabase } from "@/data/tournaments";
import { loadBenchLog, getBenchedFor } from "./benchedPlayers";
import { getWorldNowIso } from "./worldClock";
import type { TeamData, Transfer } from "./types";

export interface HistorySegment {
  from: string | null;
  to: string | null;
  inactive: boolean;
}

export interface TeamStint {
  team: string;
  from: string | null;
  to: string | null;
  segments: HistorySegment[];
  current: boolean;
  /** Gracz pełnił w tym okresie rolę trenera. */
  coach?: boolean;
}

function datedTransfers(player: string): Transfer[] {
  const stored = loadFromStorage<Transfer[]>("transfers_data", []);
  const list = stored.length > 0
    ? stored
    : getAllTransfers().map((t, i) => ({ id: String(i), date: "", ...t } as Transfer));
  return list
    .filter(t => t.player === player)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

const clamp = (value: string, lo: string | null, hi: string | null): string => {
  let v = value;
  if (lo && v < lo) v = lo;
  if (hi && v > hi) v = hi;
  return v;
};

function benchSegments(
  player: string,
  team: string,
  from: string | null,
  to: string | null,
): HistorySegment[] {
  const events = loadBenchLog()
    .filter(e => e.player === player && e.team === team)
    .filter(e => (!from || e.date >= from) && (!to || e.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Currently benched with no log entry at all → whole (open) stint inactive
  if (events.length === 0) {
    const benchedNow = !to && getBenchedFor(team).includes(player);
    return [{ from, to, inactive: benchedNow }];
  }

  const segments: HistorySegment[] = [];
  let cursor = from;
  let inactive = events[0].action === "activate"; // was benched before the window
  for (const e of events) {
    const at = clamp(e.date, from, to);
    const next = e.action === "bench";
    if (next !== inactive) {
      if (!cursor || at !== cursor) segments.push({ from: cursor, to: at, inactive });
      cursor = at;
      inactive = next;
    }
  }
  segments.push({ from: cursor, to, inactive });
  return segments.filter(s => !s.from || !s.to || s.from !== s.to);
}

export function buildPlayerTeamHistory(player: string, ranking?: TeamData[]): TeamStint[] {
  const source = ranking && ranking.length > 0 ? ranking : teamDatabase;
  const currentTeam = source.find(
    t => !t.isNational && (t.roster.includes(player) || t.coach === player),
  );

  const transfers = datedTransfers(player);
  const raw: { team: string; from: string | null; to: string | null }[] = [];
  let open: { team: string; from: string | null } | null = null;

  for (const t of transfers) {
    const date = t.date || null;
    if (t.oldTeam && t.oldTeam !== "-") {
      if (open && open.team === t.oldTeam) {
        raw.push({ team: open.team, from: open.from, to: date });
        open = null;
      } else {
        raw.push({ team: t.oldTeam, from: open?.from ?? null, to: date });
        open = null;
      }
    }
    if (t.newTeam && t.newTeam !== "-") {
      if (open) raw.push({ team: open.team, from: open.from, to: date });
      open = { team: t.newTeam, from: date };
    }
  }
  if (open) raw.push({ team: open.team, from: open.from, to: null });

  // Fall back / reconcile with the live roster
  if (currentTeam && !raw.some(s => s.team === currentTeam.name && s.to === null)) {
    raw.push({ team: currentTeam.name, from: null, to: null });
  }

  const now = getWorldNowIso();
  // Trener: albo drużyna ma go zapisanego jako coacha, albo jego rola to "Coach".
  const isCoachRole = (playerRoles as Record<string, string>)[player] === "Coach";
  const coachTeams = new Set(
    source.filter(t => t.coach === player).map(t => t.name),
  );
  return raw
    .map(s => ({
      ...s,
      current: s.to === null && currentTeam?.name === s.team,
      coach: isCoachRole || coachTeams.has(s.team),
      segments: benchSegments(player, s.team, s.from, s.to),
    }))
    .map(s => ({ ...s, to: s.to && s.to > now ? now : s.to }))
    .reverse();
}
