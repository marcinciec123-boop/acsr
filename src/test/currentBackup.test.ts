import { Blob as NodeBlob } from "node:buffer";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/deviceStore", () => ({
  DEVICE_STORE_REF: "__CSGO_HUB_DEVICE_STORE__",
  getAllDeviceValuesWithMedia: vi.fn(), removeDeviceValue: vi.fn(), setDeviceValue: vi.fn(),
}));
vi.mock("@/lib/storage", () => ({ getAllImages: vi.fn(async () => []) }));
vi.mock("@/lib/worldClock", () => ({ WORLD_CLOCK_EVENT: "clock", getWorldDate: () => "2026-11-08" }));
import { getAllDeviceValuesWithMedia } from "@/lib/deviceStore";
import { decodeDeviceBackupFile, encodeCurrentDeviceBackup } from "@/lib/deviceBackup";

describe("current save export", () => {
  afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });
  it("exports latest device data, all three media types, drafts and current date", async () => {
    vi.stubGlobal("Blob", NodeBlob);
    localStorage.setItem("match_draft_1", '{"kills":24}');
    localStorage.setItem("csgo_hub_tournaments_data", "old");
    const latest = {
      csgo_hub_tournaments_data: '[{"score":"2:0"}]',
      csgo_hub_teamlogo_1: "data:image/webp;base64,team",
      csgo_hub_playerphoto_1: "data:image/png;base64,player",
      csgo_hub_tournamentlogo_1: "data:image/webp;base64,event",
    };
    vi.mocked(getAllDeviceValuesWithMedia).mockResolvedValue(latest);
    const exported = await encodeCurrentDeviceBackup();
    const parsed = JSON.parse(await decodeDeviceBackupFile(exported.blob));
    expect(parsed.keys).toEqual({ ...latest, match_draft_1: '{"kills":24}', world_clock_date: "2026-11-08" });
  });
  it("rejects export when collection fails rather than exporting partial data", async () => {
    vi.mocked(getAllDeviceValuesWithMedia).mockRejectedValue(new Error("unreadable media"));
    await expect(encodeCurrentDeviceBackup()).rejects.toThrow("unreadable media");
  });
});