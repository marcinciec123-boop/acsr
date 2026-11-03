import { describe, expect, it } from "vitest";
import { createLru, isMediaKey } from "@/lib/diskStore";

describe("media storage", () => {
  it("keeps only the most recently shown images in memory", () => {
    const lru = createLru<string>(2);
    lru.set("a", "1"); lru.set("b", "2");
    lru.get("a");
    lru.set("c", "3");
    expect(lru.has("b")).toBe(false);
    expect(lru.has("a")).toBe(true);
    expect(lru.size()).toBe(2);
  });
  it("routes logos and photos to image files, not save data", () => {
    expect(isMediaKey("csgo_hub_playerphoto_s1mple")).toBe(true);
    expect(isMediaKey("csgo_hub_tournamentlogo_x")).toBe(true);
    expect(isMediaKey("csgo_hub_tournaments_data")).toBe(false);
  });
});
