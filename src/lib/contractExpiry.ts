// ===== Automatic contract expiry handling =====
// When a contract passes its end date (fictional world clock), the player is
// released: removed from the club roster and logged as a transfer to "-" so the
// transfer panel and free-agent list show the change.

import { teamDatabase } from "@/data/tournaments";
import { customTransfersGlobal } from "@/data/history";
import { loadFromStorage, saveToStorage } from "./storage";
import { captureSnapshot, persistCurrentRosters, recordChange } from "./changeLog";
import { removeFromAllBenches } from "./benchedPlayers";
import { processExpiredContracts, type ExpiredRelease } from "./contracts";
import { getWorldNowIso } from "./worldClock";
import type { TeamData, Transfer } from "./types";

const TRANSFERS_KEY = "transfers_data";
const RANKING_KEY = "ranking_data";

/**
 * Zamyka wygasłe kontrakty i przenosi zawodników do wolnych agentów.
 * Bezpieczne do wielokrotnego wywołania — nic nie robi, gdy nic nie wygasło.
 */
export function releaseExpiredContracts(): ExpiredRelease[] {
  const releases = processExpiredContracts();
  if (releases.length === 0) return [];

  const before = captureSnapshot();
  const nowIso = getWorldNowIso();
  const newTransfers: Transfer[] = [];

  for (const r of releases) {
    // Runtime roster (teamDatabase is the master source)
    const team = teamDatabase.find(t => t.name === r.team);
    if (team) {
      team.roster = team.roster.filter(p => p !== r.player);
      if (team.coach === r.player) team.coach = undefined;
    }
    removeFromAllBenches(r.player);

    newTransfers.push({
      id: `exp-${Date.now().toString(36)}-${r.player}`,
      player: r.player,
      oldTeam: r.team,
      newTeam: "-",
      date: nowIso,
    });
    customTransfersGlobal.push({ player: r.player, oldTeam: r.team, newTeam: "-" });
  }

  saveToStorage("custom_transfers", customTransfersGlobal);
  persistCurrentRosters();

  // Mirror into ranking_data
  const ranking = loadFromStorage<TeamData[] | null>(RANKING_KEY, null);
  if (ranking) {
    const released = new Map(releases.map(r => [r.team, releases.filter(x => x.team === r.team).map(x => x.player)]));
    const patched = ranking.map(team => {
      const drop = released.get(team.name);
      if (!drop) return team;
      return {
        ...team,
        roster: team.roster.filter(p => !drop.includes(p)),
        coach: team.coach && drop.includes(team.coach) ? undefined : team.coach,
      };
    });
    saveToStorage(RANKING_KEY, patched);
  }

  const stored = loadFromStorage<Transfer[]>(TRANSFERS_KEY, []);
  saveToStorage(TRANSFERS_KEY, [...newTransfers, ...stored]);

  recordChange(
    "transfer",
    releases.length === 1
      ? `Wygasł kontrakt: ${releases[0].player} (${releases[0].team}) → wolny agent`
      : `Wygasło ${releases.length} kontraktów → wolni agenci`,
    before,
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("teams:update"));
    window.dispatchEvent(new CustomEvent("ranking:update"));
    window.dispatchEvent(new CustomEvent("transfers:update"));
  }
  return releases;
}

/** Instaluje automatyczne sprawdzanie wygasania przy każdej zmianie zegara świata. */
export function installContractExpiryWatcher(): void {
  if (typeof window === "undefined") return;
  const run = () => {
    try { releaseExpiredContracts(); }
    catch (e) { console.error("Contract expiry check failed:", e); }
  };
  window.addEventListener("worldclock:update", run);
}
