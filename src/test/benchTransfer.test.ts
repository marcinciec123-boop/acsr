import { beforeEach, describe, expect, it } from "vitest";
import { benchPlayer, shouldAutoBenchIncoming } from "@/lib/benchedPlayers";
import type { TeamData } from "@/lib/types";

const team = (roster: string[]): TeamData => ({
  name: "Test Team",
  country: "PL",
  region: "EU",
  points: 0,
  roster,
});

describe("incoming transfer bench", () => {
  beforeEach(() => localStorage.clear());

  it("benches a sixth incoming player when five are active", () => {
    expect(shouldAutoBenchIncoming(team(["a", "b", "c", "d", "e"]), "f")).toBe(true);
  });

  it("does not count an already benched player as active", () => {
    const current = team(["a", "b", "c", "d", "e", "oldBench"]);
    benchPlayer(current.name, "oldBench", "2026-08-13T10:00:00");
    expect(shouldAutoBenchIncoming(current, "f")).toBe(true);
    expect(shouldAutoBenchIncoming(team(["a", "b", "c", "d"]), "e")).toBe(false);
  });
});