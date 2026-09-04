import { describe, expect, it } from "vitest";
import { canonicalizeSnapshotMap } from "@/lib/rankingHistory";
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
});
