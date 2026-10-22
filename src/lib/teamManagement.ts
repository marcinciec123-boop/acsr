// ===== Team management =====
// Edycja, rozwiązywanie i tworzenie drużyn.
//
// Zasada: zmiany propagujemy tylko do BIEŻĄCYCH danych:
//   - ranking_data (master rosterów / punktów)
//   - benched_players (mapa per-team)
//   - tournaments_data — TYLKO turnieje o statusie != "completed" / nie "resultsConfirmed"
//
// Historia (transfery, zakończone turnieje, disbands z hardkodu) pozostaje pod starą nazwą,
// dzięki czemu archiwum sezonu jest spójne z tym, co realnie się wydarzyło.

import { loadFromStorage, saveToStorage } from "./storage";
import { teamDatabase } from "@/data/tournaments";
import type { TeamData, TournamentData, Transfer } from "./types";
import { addManualFreeAgent, loadFreeAgentNationalityOverrides, loadManualFreeAgents, setFreeAgentRole } from "./freeAgents";
import { playerNationalities } from "@/data/playerNationalities";
import { loadPlayerNatOverrides } from "./playerMetadata";
import { getWorldDate, getWorldNowIso } from "./worldClock";
import { loadBenched } from "./benchedPlayers";
import { getTeamContracts, loadContracts, saveContracts } from "./contracts";
import { customTransfersGlobal } from "@/data/history";
import { nameChanges } from "@/data/history";
import { recordRename, sameName } from "./teamRenames";
import { recordOrgCreate, recordOrgDisband, recordOrgRename } from "./orgEvents";
import { loadTeamLogo, saveTeamLogo } from "./teamLogos";

/** Zmiana nazwy nie zmienia organizacji — logo przenosi się na nową nazwę,
 *  ale zostaje też pod starą (historia, rekordy, archiwum). */
function migrateTeamLogo(oldName: string, newName: string): void {
  void (async () => {
    try {
      const logo = await loadTeamLogo(oldName);
      if (!logo) return;
      await saveTeamLogo(newName, logo);
    } catch {
      /* logo migration is best-effort */
    }
  })();
}

const RANKING_KEY = "ranking_data";
const TOURNAMENTS_KEY = "tournaments_data";
const BENCH_KEY = "benched_players";
const DISBANDS_EXTRA_KEY = "disbands_extra";
const ARCHIVED_TEAMS_KEY = "archived_teams";
const TRANSFERS_KEY = "transfers_data";
const CUSTOM_TRANSFERS_KEY = "custom_transfers";
const ROSTER_OVERRIDE_KEY = "roster_overrides";
const COACH_OVERRIDE_KEY = "coach_overrides";
const TEAM_NAME_OVERRIDE_KEY = "team_name_overrides";

export interface ExtraDisband {
  team: string;
  date: string;
  reason: string;
  /** Snapshot składu w chwili rozwiązania (do archiwum) */
  finalRoster: string[];
  country: string;
  region: string;
}

// ---------- helpers ----------

function loadTeamsRaw(): TeamData[] {
  const stored = loadFromStorage<TeamData[] | null>(RANKING_KEY, null);
  if (stored && stored.length > 0) {
    // one-time country fixups for teams whose country was wrong in older builds
    let mutated = false;
    const fixed = stored.map(t => {
      if (t.name === "Rare Atom" && t.country !== "IDN") {
        mutated = true;
        return { ...t, country: "IDN" };
      }
      return t;
    });
    if (mutated) saveToStorage(RANKING_KEY, fixed);
    return fixed;
  }
  return teamDatabase.map(t => ({ ...t, roster: [...t.roster] }));
}

function saveTeams(teams: TeamData[]): void {
  saveToStorage(RANKING_KEY, teams);
  window.dispatchEvent(new CustomEvent("teams:update"));
}

export function loadAllTeams(): TeamData[] {
  const teams = loadTeamsRaw();
  const currentNames = new Set(teams.map(team => team.name));
  const obsoleteNames = new Set(
    nameChanges
      .filter(change => currentNames.has(change.newName))
      .map(change => change.oldName),
  );
  return teams.filter(team => !obsoleteNames.has(team.name));
}

export function loadArchivedTeams(): string[] {
  return loadFromStorage<string[]>(ARCHIVED_TEAMS_KEY, []);
}

function saveArchivedTeams(list: string[]): void {
  saveToStorage(ARCHIVED_TEAMS_KEY, [...new Set(list)]);
}

export function loadExtraDisbands(): ExtraDisband[] {
  return loadFromStorage<ExtraDisband[]>(DISBANDS_EXTRA_KEY, []);
}

function saveExtraDisbands(list: ExtraDisband[]): void {
  saveToStorage(DISBANDS_EXTRA_KEY, list);
}

// ---------- create ----------

export interface CreateTeamInput {
  name: string;
  country: string;
  region: string;
  points?: number;
  roster?: string[];
}

export function createTeam(input: CreateTeamInput): { ok: boolean; error?: string } {
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Nazwa jest wymagana" };
  const teams = loadTeamsRaw();
  if (teams.some(t => sameName(t.name, name))) {
    return { ok: false, error: "Drużyna o takiej nazwie już istnieje" };
  }
  const fresh: TeamData = {
    name,
    country: (input.country || "").toUpperCase().slice(0, 4),
    region: input.region || "EU",
    points: Math.max(0, input.points ?? 0),
    roster: (input.roster || []).map(r => r.trim()).filter(Boolean),
  };
  saveTeams([...teams, fresh]);
  recordOrgCreate(name, getWorldDate(), "Powstanie organizacji");
  // Jeśli nazwa była wcześniej zarchiwizowana — odarchiwizuj.
  saveArchivedTeams(loadArchivedTeams().filter(n => n !== name));
  return { ok: true };
}

// ---------- update / rename ----------

export interface UpdateTeamPatch {
  name?: string;
  country?: string;
  region?: string;
  points?: number;
}

export function updateTeam(oldName: string, patch: UpdateTeamPatch): { ok: boolean; error?: string } {
  const teams = loadTeamsRaw();
  const idx = teams.findIndex(t => sameName(t.name, oldName));
  if (idx === -1) return { ok: false, error: "Nie znaleziono drużyny" };

  const newName = patch.name?.trim();
  if (newName && !sameName(newName, oldName)) {
    if (teams.some(t => sameName(t.name, newName))) {
      return { ok: false, error: "Drużyna o takiej nazwie już istnieje" };
    }
  }

  const next = [...teams];
  next[idx] = {
    ...next[idx],
    name: newName || next[idx].name,
    country: patch.country !== undefined ? patch.country.toUpperCase().slice(0, 4) : next[idx].country,
    region: patch.region ?? next[idx].region,
    points: patch.points !== undefined ? Math.max(0, patch.points) : next[idx].points,
  };
  saveTeams(next);

  // Propagacja zmiany nazwy do bieżących danych
  if (newName && !sameName(newName, oldName)) {
    propagateRename(teams[idx].name, newName);
  }
  return { ok: true };
}

export function propagateRename(oldName: string, newName: string): void {
  // 0) In-memory teamDatabase — inne komponenty czytają wprost stąd.
  const memTeam = teamDatabase.find(t => sameName(t.name, oldName));
  if (memTeam) memTeam.name = newName;

  // 0a) Zapisz zdarzenie zmiany nazwy (historia rankingu pokazuje starą nazwę
  // do dnia zmiany włącznie z okresem sprzed niej).
  recordRename(oldName, newName, getWorldDate());
  recordOrgRename(oldName, newName, getWorldDate());

  // 0b) Persist name override so rename survives page reload (teamDatabase is
  // re-imported fresh each load with hardcoded names).
  const nameOv = loadFromStorage<Record<string, string>>(TEAM_NAME_OVERRIDE_KEY, {});
  // Find original key mapping to oldName (in case of chained renames)
  let originalKey = oldName;
  for (const [orig, cur] of Object.entries(nameOv)) {
    if (cur === oldName) { originalKey = orig; break; }
  }
  nameOv[originalKey] = newName;
  saveToStorage(TEAM_NAME_OVERRIDE_KEY, nameOv);

  // 0c) Logo i identyfikacja wizualna pozostają przy organizacji.
  migrateTeamLogo(oldName, newName);

  // 1) Bench map
  const bench = loadFromStorage<Record<string, string[]>>(BENCH_KEY, {});
  if (bench[oldName]) {
    bench[newName] = bench[oldName];
    delete bench[oldName];
    saveToStorage(BENCH_KEY, bench);
    window.dispatchEvent(new CustomEvent("bench:update"));
  }

  // 1b) Roster / coach override maps (persistCurrentRosters używa nazwy jako klucza)
  const rosterOv = loadFromStorage<Record<string, string[]>>(ROSTER_OVERRIDE_KEY, {});
  if (rosterOv[oldName]) {
    rosterOv[newName] = rosterOv[oldName];
    delete rosterOv[oldName];
    saveToStorage(ROSTER_OVERRIDE_KEY, rosterOv);
  }
  const coachOv = loadFromStorage<Record<string, string>>(COACH_OVERRIDE_KEY, {});
  if (coachOv[oldName] !== undefined) {
    coachOv[newName] = coachOv[oldName];
    delete coachOv[oldName];
    saveToStorage(COACH_OVERRIDE_KEY, coachOv);
  }

  // 1c) Transfery — TRANSFERS_KEY oraz global custom transfers
  const transfers = loadFromStorage<Transfer[]>(TRANSFERS_KEY, []);
  let tChanged = false;
  const newTransfers = transfers.map(tr => {
    let x = tr;
    if (tr.oldTeam === oldName) { x = { ...x, oldTeam: newName }; tChanged = true; }
    if (tr.newTeam === oldName) { x = { ...x, newTeam: newName }; tChanged = true; }
    return x;
  });
  if (tChanged) saveToStorage(TRANSFERS_KEY, newTransfers);

  let ctChanged = false;
  for (const ct of customTransfersGlobal) {
    if (ct.oldTeam === oldName) { ct.oldTeam = newName; ctChanged = true; }
    if (ct.newTeam === oldName) { ct.newTeam = newName; ctChanged = true; }
  }
  if (ctChanged) saveToStorage(CUSTOM_TRANSFERS_KEY, customTransfersGlobal);

  // 1d) Disbandy / archiwum
  const disbands = loadFromStorage<ExtraDisband[]>(DISBANDS_EXTRA_KEY, []);
  let dChanged = false;
  const newDisbands = disbands.map(d => {
    if (d.team === oldName) { dChanged = true; return { ...d, team: newName }; }
    return d;
  });
  if (dChanged) saveToStorage(DISBANDS_EXTRA_KEY, newDisbands);

  const archived = loadFromStorage<string[]>(ARCHIVED_TEAMS_KEY, []);
  if (archived.includes(oldName)) {
    saveToStorage(ARCHIVED_TEAMS_KEY, archived.map(n => n === oldName ? newName : n));
  }

  // 2) Tournaments — WSZYSTKIE (także zakończone), żeby historia była spójna
  const tournaments = loadFromStorage<TournamentData[]>(TOURNAMENTS_KEY, []);
  let touched = false;
  const updated = tournaments.map(t => {
    let changed = false;

    const renameInArr = (arr: string[] | undefined) => {
      if (!arr) return arr;
      return arr.map(x => (x === oldName ? (changed = true, newName) : x));
    };

    const newParticipants = renameInArr(t.participants) || [];
    const newPhases = t.phases.map(p => ({
      ...p,
      teams: renameInArr(p.teams) || [],
      groups: p.groups?.map(g => ({
        ...g,
        teams: renameInArr(g.teams) || [],
        matches: g.matches.map(m => ({
          ...m,
          team1: m.team1 === oldName ? (changed = true, newName) : m.team1,
          team2: m.team2 === oldName ? (changed = true, newName) : m.team2,
        })),
      })),
      bracket: p.bracket?.map(m => ({
        ...m,
        team1: m.team1 === oldName ? (changed = true, newName) : m.team1,
        team2: m.team2 === oldName ? (changed = true, newName) : m.team2,
      })),
    }));

    if (!changed) return t;
    touched = true;
    return { ...t, participants: newParticipants, phases: newPhases };
  });
  if (touched) saveToStorage(TOURNAMENTS_KEY, updated);
  window.dispatchEvent(new CustomEvent("tournaments:update"));
  window.dispatchEvent(new CustomEvent("transfers:update"));
}

// ---------- disband ----------

export interface DisbandInput {
  reason?: string;
}

/**
 * Rozwiązuje drużynę:
 *  - usuwa ją z bieżącego rankingu (`ranking_data`)
 *  - dodaje do listy zarchiwizowanych (zachowuje widoczność w historii turniejów)
 *  - przenosi skład, rezerwowych i trenera do wolnych agentów (manual FA)
 *  - zamyka niezakończone kontrakty organizacji jako zwolnienie bez odstępnego
 *  - zapisuje wpis w `disbands_extra` z datą + powodem + składem końcowym
 *  - usuwa wpisy bench dla tej drużyny
 *
 * NIE modyfikuje historycznych transferów ani zakończonych turniejów.
 */
export function disbandTeam(name: string, input: DisbandInput = {}): { ok: boolean; error?: string } {
  const teams = loadTeamsRaw();
  const team = teams.find(t => sameName(t.name, name));
  if (!team) return { ok: false, error: "Nie znaleziono drużyny" };

  const teamName = team.name;
  const date = getWorldDate();
  const atIso = getWorldNowIso();
  const bench = loadBenched();
  const coachOverrides = loadFromStorage<Record<string, string>>(COACH_OVERRIDE_KEY, {});
  const coach = coachOverrides[teamName] ?? team.coach;
  const rosterOverrides = loadFromStorage<Record<string, string[]>>(ROSTER_OVERRIDE_KEY, {});
  const contracts = loadContracts();
  const teamContracts = getTeamContracts(teamName, contracts);
  const contractIds = new Set(teamContracts.map(c => c.id));
  const finalRoster = [...new Set([...team.roster, ...(rosterOverrides[teamName] || []), ...(bench[teamName] || [])])];
  const people = [...new Set([...finalRoster, ...(coach ? [coach] : []), ...teamContracts.map(c => c.player)])];
  // Capture explicit nationalities before removing any current membership.
  const playerCountries = loadPlayerNatOverrides();
  const faCountries = loadFreeAgentNationalityOverrides();
  const manualCountries = new Map(loadManualFreeAgents().map(p => [p.player, p.country]));
  const countries = new Map(people.map(player => [player,
    playerCountries[player] || playerNationalities[player] || faCountries[player] || manualCountries.get(player) || "",
  ]));

  // 1) usuń z rankingu NAJPIERW — addManualFreeAgent odrzuca graczy,
  //    którzy wciąż figurowaliby w składzie (ranking_data)
  saveTeams(teams.filter(t => t !== team));
  rosterOverrides[teamName] = [];
  coachOverrides[teamName] = "";
  saveToStorage(ROSTER_OVERRIDE_KEY, rosterOverrides);
  saveToStorage(COACH_OVERRIDE_KEY, coachOverrides);
  for (const current of teamDatabase) {
    if (!sameName(current.name, teamName)) continue;
    current.roster = [];
    current.coach = undefined;
  }

  // Close only this organization's contracts, retaining the history and terms.
  if (contractIds.size > 0) {
    saveContracts(contracts.map(c => contractIds.has(c.id)
      ? { ...c, terminatedAt: atIso, terminationReason: "release", endDate: atIso }
      : c));
  }

  // 2) gracze → wolni agenci
  // Narodowość gracza NIGDY nie jest nadpisywana krajem drużyny.
  for (const player of people) {
    addManualFreeAgent({ player, country: countries.get(player) || "", ...(player === coach ? { role: "Coach" } : {}) });
    if (player === coach) setFreeAgentRole(player, "Coach");
  }
  window.dispatchEvent(new CustomEvent("freeagents:update"));

  // 3) usuń bench
  if (bench[teamName]) {
    delete bench[teamName];
    saveToStorage(BENCH_KEY, bench);
    window.dispatchEvent(new CustomEvent("bench:update"));
  }

  // 4) archiwum
  saveArchivedTeams([...loadArchivedTeams(), teamName]);
  saveExtraDisbands([
    ...loadExtraDisbands(),
    {
      team: teamName,
      date,
      reason: input.reason?.trim() || "Rozwiązanie drużyny",
      finalRoster,
      country: team.country,
      region: team.region,
    },
  ]);

  recordOrgDisband(teamName, date, input.reason?.trim() || "Rozwiązanie drużyny");

  // 5) usuń z bieżących, niezakończonych turniejów (uczestnicy + faza 1)
  const tournaments = loadFromStorage<TournamentData[]>(TOURNAMENTS_KEY, []);
  let touched = false;
  const updated = tournaments.map(t => {
    if (t.resultsConfirmed || t.status === "completed") return t;
    if (!t.participants.includes(teamName)) return t;
    touched = true;
    return {
      ...t,
      participants: t.participants.filter(p => p !== teamName),
      teams: t.participants.filter(p => p !== teamName).length,
      phases: t.phases.map(p => ({
        ...p,
        teams: p.teams.map(x => (x === teamName ? `TBD-disband` : x)),
      })),
    };
  });
  if (touched) saveToStorage(TOURNAMENTS_KEY, updated);
  window.dispatchEvent(new CustomEvent("teams:update"));
  window.dispatchEvent(new CustomEvent("players:update"));

  return { ok: true };
}
