import { describe, it, expect, beforeEach } from "vitest";
import { isNationalTeam, isTransferAllowed, registerNationalTeamNames, resetNationalIdentityCache, isInternationalTournament } from "@/lib/nationalIdentity";
import { upsertNationalTeams } from "@/lib/nationalTeams";
import { saveToStorage } from "@/lib/storage";
import { getTeamRank } from "@/lib/vrsFormula";
import { disbandTeam } from "@/lib/teamManagement";
import type { TeamData } from "@/lib/types";

beforeEach(() => { localStorage.clear(); resetNationalIdentityCache(); });

describe("national teams are separate from clubs", () => {
  it("stays national even after the team record is gone", () => {
    registerNationalTeamNames(["Poland"]);
    resetNationalIdentityCache();
    expect(isNationalTeam("Poland")).toBe(true);
    expect(isNationalTeam("Vitality")).toBe(false);
  });

  it("transfers from or to a national team are blocked", () => {
    registerNationalTeamNames(["Poland"]);
    expect(isTransferAllowed("Vitality", "Poland")).toBe(false);
    expect(isTransferAllowed("Poland", "-")).toBe(false);
    expect(isTransferAllowed("Vitality", "-")).toBe(true);
  });

  it("national team cannot overwrite a club with the same name", () => {
    saveToStorage("ranking_data", [{ name: "Vitality", points: 900, country: "FR", region: "EU", roster: [] }]);
    expect(() => upsertNationalTeams([{ name: "Vitality", points: 0, country: "FR", region: "EU", roster: [], isNational: true } as TeamData])).toThrow();
  });

  it("national team does not take a club's VRS position", () => {
    registerNationalTeamNames(["Brazil"]);
    const ranking = [
      { name: "Brazil", points: 5000, isNational: true },
      { name: "FURIA", points: 800 },
    ] as TeamData[];
    expect(getTeamRank("FURIA", ranking)).toBe(1);
  });

  it("Worlds is an international tournament", () => {
    expect(isInternationalTournament({ kind: "worlds", participants: [] })).toBe(true);
  });

  it("national team cannot be disbanded", () => {
    saveToStorage("ranking_data", [{ name: "Denmark", points: 0, country: "DK", region: "EU", roster: [], isNational: true }]);
    expect(disbandTeam("Denmark").ok).toBe(false);
  });
});
