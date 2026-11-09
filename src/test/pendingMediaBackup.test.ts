import { afterEach, describe, expect, it, vi } from "vitest";
import { getAllDeviceValuesWithMedia, setDeviceValue, removeDeviceValue } from "@/lib/deviceStore";

describe("pending desktop media and export", () => {
  afterEach(() => { vi.unstubAllGlobals(); });
  it("waits for newly uploaded player/team/tournament images before enumerating the export", async () => {
    const disk: Record<string, string> = {};
    const releases: Array<() => void> = [];
    const invoke = vi.fn(async (command: string, args?: Record<string, string>) => {
      if (command === "media_write" && args) {
        await new Promise<void>(resolve => { releases.push(resolve); });
        disk[args.key] = args.value;
      }
      if (command === "media_load_all") return { ...disk };
      if (command === "media_remove" && args) delete disk[args.key];
    });
    vi.stubGlobal("window", { __TAURI_INTERNALS__: { invoke } });
    const keys = ["csgo_hub_playerphoto_qa", "csgo_hub_teamlogo_qa", "csgo_hub_tournamentlogo_qa"];
    const writes = keys.map(key => setDeviceValue(key, "new image"));
    await vi.waitFor(() => expect(releases).toHaveLength(3));
    let exported = false;
    const snapshot = getAllDeviceValuesWithMedia().then(values => { exported = true; return values; });
    await Promise.resolve();
    expect(exported).toBe(false);
    releases.forEach(release => release());
    await Promise.all(writes);
    // No IndexedDB needed: initialize base through the ordinary cache before snapshot.
    const values = await snapshot;
    for (const key of keys) expect(values[key]).toBe("new image");
  });
});