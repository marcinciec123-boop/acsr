import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/deviceStore", () => ({
  DEVICE_STORE_REF: "__device_store__",
  getCachedDeviceValue: () => null,
  setDeviceValue: async () => undefined,
}));
vi.mock("@/lib/deviceBackup", () => ({ scheduleDeviceBackup: () => undefined }));

import { disbandTeam, loadExtraDisbands } from "@/lib/teamManagement";
import { getFreeAgents } from "@/lib/freeAgents";
import { getTeamContracts, loadContracts, signContract, type PlayerContract } from "@/lib/contracts";
import { loadFromStorage, saveToStorage } from "@/lib/storage";
import { playerNationalities } from "@/data/playerNationalities";
import type { TeamData } from "@/lib/types";

const club: TeamData = { name: "Disband Test Club", country: "POL", region: "EU", points: 100, roster: ["testStarter", "testBench"], coach: "testCoach" };
const buyer: TeamData = { name: "Disband Test Buyer", country: "DEU", region: "EU", points: 50, roster: ["testOther"] };
const contract = (player: string, team = club.name): PlayerContract => ({
  id: `test-${player}`, player, team,
  startDate: "2026-01-01T12:00:00.000Z", endDate: "2027-01-01T12:00:00.000Z",
  signedAt: "2026-01-01T12:00:00.000Z", salary: 2000, terms: { buyout: 100_000 },
});

describe("disbandTeam releases the whole organization", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("world_clock_date", "2026-06-01");
    window.dispatchEvent(new CustomEvent("teams:update"));
    saveToStorage("ranking_data", [{ ...club, roster: [...club.roster] }, buyer]);
    saveToStorage("benched_players", { [club.name]: ["testBench", "testBenchOnly"] });
    saveToStorage("coach_overrides", { [club.name]: "testOverrideCoach" });
    saveToStorage("roster_overrides", { [club.name]: club.roster });
    playerNationalities.testStarter = "UKR";
    playerNationalities.testBench = "SWE";
    playerNationalities.testBenchOnly = "DNK";
    playerNationalities.testOverrideCoach = "FRA";
    saveToStorage("player_contracts", [
      ...["testStarter", "testBench", "testBenchOnly", "testOverrideCoach"].map(p => contract(p)),
      contract("testOther", buyer.name),
    ]);
  });

  it("moves starters, bench-only players and the saved coach into free agency without duplicates", () => {
    expect(disbandTeam(club.name).ok).toBe(true);
    const names = getFreeAgents().map(p => p.player);
    for (const player of ["testStarter", "testBench", "testBenchOnly", "testOverrideCoach"]) {
      expect(names.filter(p => p === player)).toHaveLength(1);
    }
    expect(loadFromStorage("benched_players", {})).toEqual({});
    expect(getFreeAgents().find(p => p.player === "testOverrideCoach")?.role).toBe("Coach");
    expect(loadExtraDisbands()[0]?.finalRoster).toEqual(["testStarter", "testBench", "testBenchOnly"]);
  });

  it("keeps each person's nationality instead of assigning the club country", () => {
    disbandTeam(club.name);
    const countries = Object.fromEntries(getFreeAgents().map(p => [p.player, p.country]));
    expect(countries.testStarter).toBe("UA");
    expect(countries.testBench).toBe("SE");
    expect(countries.testBenchOnly).toBe("DK");
    expect(countries.testOverrideCoach).toBe("FR");
  });

  it("ends organization contracts as releases, preserves history and permits signing elsewhere", () => {
    disbandTeam(club.name);
    expect(getTeamContracts(club.name)).toEqual([]);
    const released = loadContracts().filter(c => c.team === club.name);
    expect(released).toHaveLength(4);
    for (const c of released) {
      expect(c.terminationReason).toBe("release");
      expect(c.terminatedAt?.slice(0, 10)).toBe("2026-06-01");
      expect(c.endDate).toBe(c.terminatedAt);
      expect(c.terms.buyout).toBe(100_000);
    }
    expect(getTeamContracts(buyer.name)).toHaveLength(1);
    expect(signContract({ player: "testStarter", team: buyer.name, salary: 2000,
      startDate: "2026-06-01T12:00:00.000Z", endDate: "2027-06-01T12:00:00.000Z" }).ok).toBe(true);
  });

  it("uses the same release for bankruptcy even when the supplied name differs in case", () => {
    expect(disbandTeam(`  ${club.name.toLowerCase()}  `, { reason: "Bankructwo" }).ok).toBe(true);
    expect(loadFromStorage<TeamData[]>("ranking_data", []).map(t => t.name)).toEqual([buyer.name]);
    expect(getTeamContracts(club.name)).toEqual([]);
    expect(loadExtraDisbands()[0]?.reason).toBe("Bankructwo");
  });
});