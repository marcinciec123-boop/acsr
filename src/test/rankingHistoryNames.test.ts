import { describe, expect, it } from "vitest";
import { canonicalizeSnapshotMap, mergeRankingSnapshots } from "@/lib/rankingHistory";
import { canonicalTeamName, teamNameAt } from "@/lib/teamRenames";

describe("historia rankingu — tożsamość drużyn", () => {
  it("mapuje starą nazwę na aktualną", () => {
    expect(canonicalTeamName("Warzone Gaming")).toBe("Rare Atom");
  });

  it("zachowuje nazwę obowiązującą danego dnia", () => {
    expect(teamNameAt("Rare Atom", "2025-01-01")).toBe("Warzone Gaming");
    expect(teamNameAt("Rare Atom", "2026-01-01")).toBe("Rare Atom");
  });

  it("scala historyczną migawkę pod kanoniczny klucz bez duplikatów", () => {
    const map = canonicalizeSnapshotMap({ "Warzone Gaming": 500 }, "2025-01-01");
    expect(map).toEqual({ "Rare Atom": 500 });
  });

  it("utrzymuje punkty i dokładną pozycję aż do następnej aktualizacji", () => {
    const history = mergeRankingSnapshots([
      { date: "2025-09-03", points: { "Team Liquid": 1165 }, ranks: { "Team Liquid": 7 } },
      { date: "2025-10-01", points: { "Rare Atom": 225 }, ranks: { "Rare Atom": 41 } },
      { date: "2025-10-30", points: { "Team Liquid": 1100 }, ranks: { "Team Liquid": 9 } },
    ]);

    expect(history[1].points["Team Liquid"]).toBe(1165);
    expect(history[1].ranks?.["Team Liquid"]).toBe(7);
    expect(history[2].points["Team Liquid"]).toBe(1100);
    expect(history[2].ranks?.["Team Liquid"]).toBe(9);
  });

  it("przenosi historyczną nazwę na aktualną razem z pozycją", () => {
    const history = mergeRankingSnapshots([
      { date: "2025-09-03", points: { "Warzone Gaming": 225 }, ranks: { "Warzone Gaming": 41 } },
      { date: "2025-10-30", points: { "Team Liquid": 1100 }, ranks: { "Team Liquid": 9 } },
    ]);

    expect(history[1].points["Rare Atom"]).toBe(225);
    expect(history[1].ranks?.["Rare Atom"]).toBe(41);
  });
});
