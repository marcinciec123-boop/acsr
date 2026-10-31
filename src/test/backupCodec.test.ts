import { Blob as NodeBlob } from "node:buffer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeDeviceBackupFile, encodeDeviceBackup, type DeviceBackupSnapshot } from "@/lib/deviceBackup";

const snapshot: DeviceBackupSnapshot = {
  id: "codec", createdAt: 1, label: "Świat", reason: "manual", schemaVersion: 1, size: 0,
  keys: {
    csgo_hub_tournaments: JSON.stringify(Array.from({ length: 100 }, () => ({ name: "Turniej", score: "1:0" }))),
    csgo_hub_teamlogo_test: "data:image/webp;base64,logo",
    csgo_hub_playerphoto_test: "data:image/webp;base64,photo",
    csgo_hub_tournamentlogo_test: "data:image/webp;base64,event",
  },
};

describe("save file codec", () => {
  beforeEach(() => vi.stubGlobal("Blob", NodeBlob));
  afterEach(() => vi.unstubAllGlobals());

  it("exports Gzip with all graphics by default and reads back identical world data", async () => {
    const result = await encodeDeviceBackup(snapshot);
    expect(result.extension).toBe("csgobackup");
    expect(Array.from(new Uint8Array(await result.blob.slice(0, 2).arrayBuffer()))).toEqual([0x1f, 0x8b]);
    expect(JSON.parse(await decodeDeviceBackupFile(result.blob)).keys).toEqual(snapshot.keys);
    expect(result.blob.size).toBeLessThan(new Blob([JSON.stringify(snapshot)]).size);
  });

  it("omits only uploaded media from lightweight exports without changing the original", async () => {
    const result = await encodeDeviceBackup(snapshot, false);
    const parsed = JSON.parse(await decodeDeviceBackupFile(result.blob));
    expect(parsed.keys).toEqual({ csgo_hub_tournaments: snapshot.keys.csgo_hub_tournaments });
    expect(Object.keys(snapshot.keys)).toHaveLength(4);
  });

  it("continues reading old JSON files", async () => {
    const raw = JSON.stringify(snapshot, null, 2);
    expect(await decodeDeviceBackupFile(new Blob([raw]))).toBe(raw);
  });

  it("falls back to compact JSON when native compression is unavailable", async () => {
    vi.stubGlobal("CompressionStream", undefined);
    const result = await encodeDeviceBackup(snapshot);
    expect(result.extension).toBe("json");
    expect(await result.blob.text()).not.toContain("\n");
    expect(JSON.parse(await decodeDeviceBackupFile(result.blob)).keys).toEqual(snapshot.keys);
  });

  it("rejects damaged compressed files rather than passing them into restoration", async () => {
    await expect(decodeDeviceBackupFile(new Blob([new Uint8Array([0x1f, 0x8b, 0, 0])]))).rejects.toThrow();
  });
});