import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { values } = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock("@/lib/deviceStore", () => ({
  DEVICE_STORE_REF: "__CSGO_HUB_DEVICE_STORE__",
  getAllCachedDeviceValues: () => Object.fromEntries(values),
  getAllDeviceValues: async () => Object.fromEntries(values),
  getCachedDeviceValue: (key: string) => values.get(key) ?? null,
  getDeviceValue: async (key: string) => values.get(key) ?? null,
  setDeviceValue: async (key: string, value: string) => { values.set(key, value); },
  removeDeviceValue: async (key: string) => { values.delete(key); },
}));
import { restoreDeviceBackup, type DeviceBackupSnapshot } from "@/lib/deviceBackup";
import { getCachedTournamentLogo, loadTournamentLogo } from "@/lib/tournamentLogos";

const logoKey = "csgo_hub_tournamentlogo_backup-test";
const logo = "data:image/png;base64,c21hbGw=";
let snapshot: DeviceBackupSnapshot;

describe("tournament logos restored from backup", () => {
  beforeEach(() => {
    localStorage.clear();
    values.clear();
    window.dispatchEvent(new CustomEvent("tournamentlogo:update", { detail: {} }));
    snapshot = { id: "backup", createdAt: 1, label: "test", reason: "manual", schemaVersion: 1, size: logo.length, keys: { [logoKey]: logo } };
    // Only model the backup read; media storage is independently inspected above.
    vi.stubGlobal("indexedDB", {
      open: () => {
        const request: { result: unknown; onsuccess?: () => void } = {
          result: { transaction: () => ({ objectStore: () => ({
            get: () => {
              const read: { result: DeviceBackupSnapshot; onsuccess?: () => void } = { result: snapshot };
              queueMicrotask(() => read.onsuccess?.());
              return read;
            },
          }) }) },
        };
        queueMicrotask(() => request.onsuccess?.());
        return request;
      },
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("stores a small tournament image as device media and clears a cached missing result", async () => {
    expect(await loadTournamentLogo("backup-test")).toBeNull();
    await restoreDeviceBackup("backup");
    expect(values.get(logoKey)).toBe(logo);
    expect(localStorage.getItem(logoKey)).toBe("__CSGO_HUB_DEVICE_STORE__");
    expect(getCachedTournamentLogo("backup-test")).toBe(logo);
    expect(await loadTournamentLogo("backup-test")).toBe(logo);
  });

  it("preserves current tournament media absent from an older save and replaces cached images present in it", async () => {
    values.set(logoKey, "old-logo");
    values.set("csgo_hub_tournamentlogo_keep", "shared-logo");
    expect(await loadTournamentLogo("backup-test")).toBe("old-logo");
    await restoreDeviceBackup("backup");
    expect(values.get("csgo_hub_tournamentlogo_keep")).toBe("shared-logo");
    expect(await loadTournamentLogo("backup-test")).toBe(logo);
  });
});