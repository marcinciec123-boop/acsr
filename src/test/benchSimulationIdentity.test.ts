import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/deviceStore", () => ({ DEVICE_STORE_REF: "__device_store__", getCachedDeviceValue: () => null, setDeviceValue: async () => undefined }));
vi.mock("@/lib/deviceBackup", () => ({ scheduleDeviceBackup: () => undefined }));

import { simulateMatch } from "@/lib/matchSimulator";
import { resolveLineup, setTournamentLineup } from "@/lib/tournamentLineups";
import { consolidateBenchFor, getBenchedFor } from "@/lib/benchedPlayers";
import { recordRename } from "@/lib/teamRenames";
import { saveToStorage } from "@/lib/storage";

describe("renamed club bench in actual lineup and simulation", () => {
  beforeEach(() => {
    localStorage.clear();
    window.dispatchEvent(new CustomEvent("teams:update"));
    recordRename("Simulation Old", "Simulation Current", "2026-02-01");
    saveToStorage("ranking_data", [{ name: "Simulation Current", country: "POL", region: "EU", points: 1000, roster: ["Starter", "RESERVE"] }]);
    saveToStorage("benched_players", { "Simulation Old": ["reserve"] });
  });

  it("does not automatically field a reserve through an old name or different nickname case", () => {
    expect(resolveLineup(undefined, "simulation old")).toEqual(["Starter"]);
    const result = simulateMatch("simulation old", "Other Club", 1, { forcedScore: { score1: 1, score2: 0 } });
    expect(JSON.stringify(result.maps)).toContain("Starter");
    expect(JSON.stringify(result.maps)).not.toContain("RESERVE");
  });

  it("returns no automatic lineup when everybody is benched but preserves explicit substitute selection", () => {
    saveToStorage("benched_players", { "Simulation Old": ["starter", "reserve"] });
    expect(resolveLineup(undefined, "Simulation Current")).toEqual([]);
    setTournamentLineup("Bench Event", "Simulation Current", ["RESERVE"]);
    expect(resolveLineup("Bench Event", "Simulation Current")).toEqual(["RESERVE"]);
  });

  it("merges old and destination bench entries instead of overwriting either list", () => {
    saveToStorage("benched_players", { "Simulation Old": ["reserve"], "Simulation Current": ["Starter"] });
    consolidateBenchFor("Simulation Current");
    expect(getBenchedFor("Simulation Old")).toEqual(["reserve", "Starter"]);
  });
});