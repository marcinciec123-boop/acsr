import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/deviceStore", () => ({ DEVICE_STORE_REF: "__device_store__", getCachedDeviceValue: () => null, setDeviceValue: async () => undefined }));
vi.mock("@/lib/deviceBackup", () => ({ scheduleDeviceBackup: () => undefined }));
vi.mock("@/lib/yearAwards", () => ({ loadYearAwardsHistory: () => awards }));
vi.mock("@/lib/tournamentLineups", () => ({ getTournamentLineup: () => [], resolveLineup: () => [] }));
vi.mock("@/lib/rankingHistory", () => ({ getTeamRosterAt: () => [] }));

import { getPlayerAccolades, getTeamAccolades } from "@/lib/awardAccolades";
import { computePortalStats, getTeamEarnings } from "@/lib/statsPortal";
import { activatePlayer, benchPlayer, clearBenchFor, getActiveRoster, getBenchedFor } from "@/lib/benchedPlayers";
import { recordRename } from "@/lib/teamRenames";
import { loadFromStorage, saveToStorage } from "@/lib/storage";

const awards = {
  "2025": {
    year: 2025,
    teamTop5: [{ team: "Identity Old" }],
    playerTop20: [{ player: "IdentityPlayer" }],
    rookieOfYear: { player: "IdentityPlayer" },
    topFragger: { player: "IdentityPlayer" },
    mvpKing: { player: "IdentityPlayer" },
    transferOfYear: { player: "IdentityPlayer" },
    playerOfYear: { team: "Identity Old", player: "IdentityPlayer" },
    coachOfYear: { team: "Identity Old", coach: "IdentityCoach" },
  },
};

describe("profiles keep organization and player identity", () => {
  beforeEach(() => {
    localStorage.clear();
    window.dispatchEvent(new CustomEvent("teams:update"));
    recordRename("Identity Old", "Identity Middle", "2026-02-01");
    recordRename("Identity Middle", "Identity Current", "2026-03-01");
    saveToStorage("ranking_data", [{ name: "Identity Current", country: "POL", region: "EU", points: 100, roster: [] }]);
  });

  it("retains ranked and special team awards through chained renames and case differences", () => {
    expect(getTeamAccolades("  IDENTITY CURRENT  ")).toHaveLength(3);
    expect(getTeamAccolades("identity old")).toEqual(getTeamAccolades("Identity Current"));
    expect(getTeamAccolades("Other Club")).toEqual([]);
  });

  it("retains every player and coach award irrespective of nickname case", () => {
    expect(getPlayerAccolades(" identityplayer ")).toHaveLength(5);
    expect(getPlayerAccolades("IDENTITYCOACH")).toHaveLength(1);
    expect(getPlayerAccolades("OtherPlayer")).toEqual([]);
  });

  it("merges earnings, events and medals under the current club name", () => {
    const event = (id: string, team: string) => ({
      id, name: id, tier: "S", kind: "tournament", status: "completed", prizePool: "$1000",
      startDate: "2026-01-01", endDate: "2026-01-02", location: "LAN",
      placements: [{ team, placement: 1 }], prizeDistribution: { 1: 1000 },
    });
    saveToStorage("tournaments_data", [event("Identity Event 1", "Identity Old"), event("Identity Event 2", " IDENTITY CURRENT ")]);
    const stats = computePortalStats("total");
    expect(stats.orgs).toHaveLength(1);
    expect(stats.orgs[0]).toMatchObject({ team: "Identity Current", earnings: 2000, gold: 2, events: 2 });
    expect(stats.orgs[0].titles).toHaveLength(2);
    expect(getTeamEarnings(" identity old ")).toEqual({ earnings: 2000, events: 2, gold: 2, rank: 1 });
  });

  it("excludes reserve players stored under any club alias from the simulator", () => {
    saveToStorage("benched_players", { "Identity Old": ["Reserve"], " IDENTITY CURRENT ": ["reserve", "OtherReserve"] });
    expect(getBenchedFor("identity middle")).toHaveLength(2);
    expect(getActiveRoster({ name: "Identity Current", country: "POL", region: "EU", points: 0, roster: ["Starter", "RESERVE", "OtherReserve"] })).toEqual(["Starter"]);
  });

  it("activates, benches and clears members across all aliases without stale entries", () => {
    saveToStorage("benched_players", { "Identity Old": ["Reserve"], " IDENTITY CURRENT ": ["OtherReserve"], "Other Club": ["Unrelated"] });
    activatePlayer("identity middle", "RESERVE");
    expect(getBenchedFor("Identity Old")).toEqual(["OtherReserve"]);
    benchPlayer("IDENTITY OLD", "Incoming");
    expect(getBenchedFor("Identity Current")).toEqual(["OtherReserve", "Incoming"]);
    clearBenchFor("identity old");
    expect(loadFromStorage("benched_players", {})).toEqual({ "Other Club": ["Unrelated"] });
  });
});