import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/deviceStore", () => ({ DEVICE_STORE_REF: "__device_store__", getCachedDeviceValue: () => null, setDeviceValue: async () => undefined }));
vi.mock("@/lib/deviceBackup", () => ({ scheduleDeviceBackup: () => undefined }));

import { captureSnapshot, recordChange, restoreSnapshot, revertTo, loadChangeLog } from "@/lib/changeLog";
import { loadContracts, saveContracts, signContract, type PlayerContract } from "@/lib/contracts";
import { benchPlayer, loadBenched, loadBenchLog, removeFromAllBenches } from "@/lib/benchedPlayers";
import { getTeamFinance, addManualEntry, updateFinanceSettings } from "@/lib/teamFinances";
import { loadFromStorage, saveToStorage } from "@/lib/storage";

const oldContract: PlayerContract = { id: "undo-old", player: "undoPlayer", team: "Undo Seller", startDate: "2026-01-01T12:00:00.000Z", endDate: "2027-01-01T12:00:00.000Z", signedAt: "2026-01-01T12:00:00.000Z", salary: 2000, terms: { buyout: 900_000 } };

describe("change log transfer undo", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("world_clock_date", "2026-06-02");
    saveToStorage("ranking_data", [
      { name: "Undo Seller", country: "POL", region: "EU", points: 100, roster: ["undoPlayer"] },
      { name: "Undo Buyer", country: "DEU", region: "EU", points: 50, roster: [] },
    ]);
    saveContracts([{ ...oldContract, terms: { ...oldContract.terms } }]);
    benchPlayer("Undo Seller", "undoPlayer");
  });

  it("restores the old contract, bench/history, and both clubs' transfer accounting", () => {
    const before = captureSnapshot();
    const sellerBalance = getTeamFinance("Undo Seller")?.balance;
    const buyerBalance = getTeamFinance("Undo Buyer")?.balance;
    removeFromAllBenches("undoPlayer");
    benchPlayer("Undo Buyer", "undoPlayer");
    expect(signContract({ player: "undoPlayer", team: "Undo Buyer", startDate: "2026-06-02T12:00:00.000Z", endDate: "2027-06-02T12:00:00.000Z", salary: 3000 }, { skipDuplicateCheck: true, transferFee: 500_000 }).ok).toBe(true);
    expect(getTeamFinance("Undo Seller")?.byCategory.transfer_in).toBe(500_000);
    expect(getTeamFinance("Undo Buyer")?.byCategory.transfer_out).toBe(-500_000);
    const entry = recordChange("transfer", "paid transfer", before);
    expect(revertTo(entry.id)).toBe(true);
    expect(loadContracts()).toEqual([oldContract]);
    expect(loadBenched()).toEqual({ "Undo Seller": ["undoPlayer"] });
    expect(loadBenchLog()).toEqual(before.benchLog);
    expect(getTeamFinance("Undo Seller")?.balance).toBe(sellerBalance);
    expect(getTeamFinance("Undo Buyer")?.balance).toBe(buyerBalance);
    expect(getTeamFinance("Undo Seller")?.byCategory.transfer_in).toBeUndefined();
    expect(getTeamFinance("Undo Buyer")?.byCategory.transfer_out).toBeUndefined();
    expect(loadChangeLog()).toEqual([]);
  });

  it("captures independent copies and restores explicit finance inputs", () => {
    addManualEntry({ team: "Undo Seller", amount: 1234, label: "original" });
    updateFinanceSettings("Undo Seller", { startingBalance: 200_000 });
    const before = captureSnapshot();
    const contracts = loadContracts();
    const first = contracts[0];
    if (!first) throw new Error("Missing test contract");
    first.terms.buyout = 1;
    loadBenched()["Undo Seller"].push("another");
    addManualEntry({ team: "Undo Seller", amount: -456, label: "later" });
    updateFinanceSettings("Undo Seller", { startingBalance: 1 });
    expect(before.contracts?.[0]?.terms.buyout).toBe(900_000);
    expect(before.benchedPlayers?.["Undo Seller"]).toEqual(["undoPlayer"]);
    restoreSnapshot(before);
    expect(loadFromStorage("team_finance_entries", [])).toEqual(before.teamFinanceEntries);
    expect(loadFromStorage("team_finance_settings", {})).toEqual({ "Undo Seller": { startingBalance: 200_000 } });
  });

  it("preserves uncaptured stores in legacy snapshots but restores explicitly empty stores", () => {
    const before = captureSnapshot();
    const { contracts, benchedPlayers, benchLog, teamFinanceEntries, teamFinanceSettings, ...legacy } = before;
    restoreSnapshot(legacy);
    expect(loadContracts()).toEqual(contracts);
    expect(loadBenched()).toEqual(benchedPlayers);
    expect(loadBenchLog()).toEqual(benchLog);
    restoreSnapshot({ ...legacy, contracts: [], benchedPlayers: {}, benchLog: [], teamFinanceEntries: [], teamFinanceSettings: {} });
    expect(loadContracts()).toEqual([]);
    expect(loadBenched()).toEqual({});
    expect(loadBenchLog()).toEqual([]);
  });
});