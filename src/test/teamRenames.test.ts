import { beforeEach, describe, expect, it } from "vitest";
import { canonicalTeamName, teamNameAt } from "@/lib/teamRenames";
import { canonicalizeSnapshotMap } from "@/lib/rankingHistory";

describe("historical team identities", () => {
  beforeEach(() => localStorage.clear());

  it("shows the old name before a rename and the current name from rename day", () => {
    localStorage.setItem("csgo_hub_team_rename_log", JSON.stringify([
      { oldName: "Old Club", newName: "New Club", date: "2026-08-17" },
    ]));
    window.dispatchEvent(new CustomEvent("teams:update"));

    expect(canonicalTeamName("Old Club")).toBe("New Club");
    expect(teamNameAt("New Club", "2026-08-16")).toBe("Old Club");
    expect(teamNameAt("New Club", "2026-08-17")).toBe("New Club");
  });

  it("follows chained renames without creating a second identity", () => {
    localStorage.setItem("csgo_hub_team_rename_log", JSON.stringify([
      { oldName: "Alpha", newName: "Bravo", date: "2026-01-10" },
      { oldName: "Bravo", newName: "Charlie", date: "2026-03-10" },
    ]));
    window.dispatchEvent(new CustomEvent("teams:update"));

    expect(canonicalTeamName("Alpha")).toBe("Charlie");
    expect(teamNameAt("Charlie", "2026-01-09")).toBe("Alpha");
    expect(teamNameAt("Charlie", "2026-02-01")).toBe("Bravo");
    expect(teamNameAt("Charlie", "2026-03-10")).toBe("Charlie");
  });

  it("repairs duplicate aliases using the name valid on snapshot day", () => {
    localStorage.setItem("csgo_hub_team_rename_log", JSON.stringify([
      { oldName: "Alpha", newName: "Bravo", date: "2026-03-10" },
    ]));
    window.dispatchEvent(new CustomEvent("teams:update"));

    expect(canonicalizeSnapshotMap({ Alpha: 450, Bravo: 999 }, "2026-02-01")).toEqual({ Bravo: 450 });
    expect(canonicalizeSnapshotMap({ Alpha: 450, Bravo: 510 }, "2026-04-01")).toEqual({ Bravo: 510 });
  });
});