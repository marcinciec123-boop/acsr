import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/deviceStore", () => ({ DEVICE_STORE_REF: "__device_store__", getCachedDeviceValue: () => null, setDeviceValue: async () => undefined }));
vi.mock("@/lib/deviceBackup", () => ({ scheduleDeviceBackup: () => undefined }));

import { getTeamFinance } from "@/lib/teamFinances";
import { saveContracts, type PlayerContract } from "@/lib/contracts";
import { recordRename } from "@/lib/teamRenames";
import { saveToStorage } from "@/lib/storage";

const oldContract: PlayerContract = {
  id: "rename-old", player: "renamePlayer", team: "Rename Old Club",
  startDate: "2026-01-01T12:00:00.000Z", endDate: "2026-06-02T12:00:00.000Z",
  signedAt: "2026-01-01T12:00:00.000Z", salary: 2000,
  terminatedAt: "2026-06-02T12:00:00.000Z", terminationReason: "transfer",
  terms: { buyout: 500_000 },
};
const newContract = (team: string): PlayerContract => ({
  id: "rename-new", player: "renamePlayer", team,
  startDate: "2026-06-02T12:00:00.000Z", endDate: "2027-06-02T12:00:00.000Z",
  signedAt: "2026-06-02T12:00:00.000Z", salary: 2000, terms: {},
});

describe("transfer accounting after organization renames", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("world_clock_date", "2026-06-02");
    saveToStorage("ranking_data", [
      { name: "Rename Current Club", country: "POL", region: "EU", points: 100, roster: ["renamePlayer"] },
      { name: "Rename Buyer", country: "DEU", region: "EU", points: 50, roster: [] },
    ]);
    recordRename("Rename Old Club", "Rename Middle Club", "2026-03-01");
    recordRename("Rename Middle Club", "Rename Current Club", "2026-05-01");
  });

  it("does not book purchases or sales between former and current names of the same club", () => {
    saveContracts([oldContract, newContract("  rename current club  ")]);
    const finance = getTeamFinance("Rename Current Club");
    expect(finance).not.toBeNull();
    expect(finance?.ledger.filter(e => e.category === "transfer_in" || e.category === "transfer_out")).toEqual([]);
    expect(finance?.byCategory.transfer_in).toBeUndefined();
    expect(finance?.byCategory.transfer_out).toBeUndefined();
  });

  it("still books the full fee for a transfer to a different organization", () => {
    saveContracts([oldContract, newContract("Rename Buyer")]);
    expect(getTeamFinance("Rename Current Club")?.byCategory.transfer_in).toBe(500_000);
    expect(getTeamFinance("Rename Buyer")?.byCategory.transfer_out).toBe(-500_000);
  });
});