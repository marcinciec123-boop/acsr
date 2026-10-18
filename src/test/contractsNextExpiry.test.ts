import { beforeEach, describe, expect, it } from "vitest";
import { getNextContractExpiry, type PlayerContract } from "@/lib/contracts";

const NOW = new Date("2026-10-18T12:00:00Z").getTime();

const contract = (over: Partial<PlayerContract> & Pick<PlayerContract, "player" | "endDate">): PlayerContract => ({
  id: over.player,
  team: "Team Alpha",
  startDate: "2025-01-01",
  salary: 5000,
  signedAt: "2025-01-01",
  terms: {},
  ...over,
});

describe("next contract expiry on the team profile tile", () => {
  beforeEach(() => localStorage.clear());

  it("ignores a released player whose terminated contract ends sooner", () => {
    const list = [
      contract({ player: "gone", endDate: "2026-03-01", terminatedAt: "2026-03-01", terminationReason: "release" }),
      contract({ player: "staying", endDate: "2027-06-30" }),
    ];
    expect(getNextContractExpiry("Team Alpha", list, NOW)?.player).toBe("staying");
  });

  it("ignores a transferred player whose contract was cut short", () => {
    const list = [
      contract({ player: "sold", endDate: "2026-05-05", terminatedAt: "2026-05-05", terminationReason: "transfer" }),
      contract({ player: "next", endDate: "2026-11-02" }),
      contract({ player: "later", endDate: "2028-01-01" }),
    ];
    expect(getNextContractExpiry("Team Alpha", list, NOW)?.player).toBe("next");
  });

  it("ignores contracts that already ran out", () => {
    const list = [
      contract({ player: "lapsed", endDate: "2026-02-01" }),
      contract({ player: "upcoming", endDate: "2026-12-24" }),
    ];
    expect(getNextContractExpiry("Team Alpha", list, NOW)?.player).toBe("upcoming");
  });

  it("returns nothing when the team has no contract left to expire", () => {
    const list = [
      contract({ player: "gone", endDate: "2026-04-01", terminatedAt: "2026-04-01", terminationReason: "release" }),
      contract({ player: "lapsed", endDate: "2026-09-01" }),
    ];
    expect(getNextContractExpiry("Team Alpha", list, NOW)).toBeUndefined();
  });

  it("follows a team rename instead of dropping the roster", () => {
    localStorage.setItem("csgo_hub_team_rename_log", JSON.stringify([
      { oldName: "Team Alpha", newName: "Team Omega", date: "2026-06-01" },
    ]));
    window.dispatchEvent(new CustomEvent("teams:update"));
    const list = [contract({ player: "keeper", team: "Team Alpha", endDate: "2027-02-01" })];
    expect(getNextContractExpiry("Team Omega", list, NOW)?.player).toBe("keeper");
  });
});
