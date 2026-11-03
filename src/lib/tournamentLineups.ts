// ===== Tournament lineups =====
// Per-(tournament, team) selection of which 5 players from the team's
// roster will actually play in this specific tournament. Lets users
// substitute a benched player in for an event without permanently
// changing the team's active roster.
//
// Storage shape: { [tournamentId]: { [teamName]: string[] } }
// If no lineup is set for a (tournament, team) pair, the simulator
// falls back to the team's current active roster (bench excluded).

import { loadFromStorage, saveToStorage } from "./storage";
import { teamDatabase } from "@/data/tournaments";
import { getActiveRoster } from "./benchedPlayers";
import type { TeamData, TournamentData } from "./types";
import { getTeamRosterAt } from "./rankingHistory";
import { canonicalTeamName, sameName } from "./teamRenames";

const KEY = "tournament_lineups";

type LineupMap = Record<string, Record<string, string[]>>;

export function loadLineups(): LineupMap {
  return loadFromStorage<LineupMap>(KEY, {});
}

function saveLineups(map: LineupMap): void {
  saveToStorage(KEY, map);
  window.dispatchEvent(new CustomEvent("lineup:update"));
}

/** Get explicitly-set lineup for (tournament, team). Empty array = none. */
export function getTournamentLineup(tournamentId: string, team: string): string[] {
  const map = loadLineups();
  return map[tournamentId]?.[team] ? [...map[tournamentId][team]] : [];
}

export function setTournamentLineup(
  tournamentId: string,
  team: string,
  players: string[],
): void {
  const map = loadLineups();
  if (!map[tournamentId]) map[tournamentId] = {};
  // Dedupe, cap to 5
  const cleaned = Array.from(new Set(players)).slice(0, 5);
  if (cleaned.length === 0) {
    delete map[tournamentId][team];
    if (Object.keys(map[tournamentId]).length === 0) delete map[tournamentId];
  } else {
    map[tournamentId][team] = cleaned;
  }
  saveLineups(map);
}

export function clearTournamentLineup(tournamentId: string, team: string): void {
  setTournamentLineup(tournamentId, team, []);
}

/**
 * Resolve the lineup that should actually play for a team in a tournament.
 * Priority: explicit lineup > active roster (bench excluded).
 */
export function resolveLineup(tournamentId: string | undefined, team: string): string[] {
  const stored = loadFromStorage<TeamData[] | null>("ranking_data", null);
  const source = stored && stored.length > 0 ? stored : teamDatabase;
  const teamData = source.find(t => sameName(canonicalTeamName(t.name), canonicalTeamName(team)));
  if (tournamentId) {
    const explicit = getTournamentLineup(tournamentId, team);
    if (explicit.length > 0) return explicit;
    // Started/finished events without a frozen lineup: use the roster from
    // the event start, never the current (possibly benched) one.
    const tournaments = loadFromStorage<TournamentData[] | null>("tournaments_data", null) || [];
    const t = tournaments.find(x => x.id === tournamentId);
    if (t && t.status !== "upcoming" && t.startDate) {
      const historical = getTeamRosterAt(team, t.startDate);
      if (historical.length > 0) return historical.slice(0, 5);
    }
  }
  if (teamData) {
    const active = getActiveRoster(teamData);
    return active.slice(0, 5);
  }
  return [];
}

/**
 * Freeze the starting five of every participant for a tournament that has
 * started. Existing explicit lineups are kept; later bench moves or transfers
 * no longer change who represented a team in this event.
 */
export function lockTournamentLineups(tournamentId: string, participants: string[]): void {
  const map = loadLineups();
  const current = { ...(map[tournamentId] || {}) };
  let changed = false;
  for (const team of participants) {
    if (!team || current[team]?.length) continue;
    const lineup = resolveLineup(tournamentId, team);
    if (lineup.length) { current[team] = lineup.slice(0, 5); changed = true; }
  }
  if (!changed) return;
  map[tournamentId] = current;
  saveLineups(map);
}

/** All teams that have a customised lineup for this tournament. */
export function getCustomisedTeams(tournamentId: string): string[] {
  const map = loadLineups();
  return Object.keys(map[tournamentId] || {});
}

/** Selectable pool for the lineup picker: full team roster (active + bench). */
export function getSelectablePool(team: TeamData): string[] {
  return [...team.roster];
}
