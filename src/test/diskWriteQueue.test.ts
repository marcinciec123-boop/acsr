import { describe, expect, it, vi } from "vitest";
import { createWriteQueue } from "@/lib/diskStore";

describe("disk write queue", () => {
  it("coalesces repeated writes of one key into the last value", async () => {
    const write = vi.fn(async () => undefined);
    const remove = vi.fn(async () => undefined);
    const q = createWriteQueue(write, remove, 10_000);
    q.set("a", "1"); q.set("a", "2"); q.set("a", "3");
    await q.flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith("a", "3");
  });
  it("a delete after a write removes instead of writing", async () => {
    const write = vi.fn(async () => undefined);
    const remove = vi.fn(async () => undefined);
    const q = createWriteQueue(write, remove, 10_000);
    q.set("b", "x"); q.delete("b");
    await q.flush();
    expect(write).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith("b");
  });
  it("strict flush rejects failed persistence while retaining data for retry", async () => {
    let fail = true;
    const q = createWriteQueue(async () => { if (fail) throw new Error("full disk"); }, async () => {}, 10_000);
    q.set("match", "latest results");
    await expect(q.flush(true)).rejects.toThrow("Nie udało się zapisać");
    expect(q.size()).toBe(1);
    fail = false;
    await q.flush(true);
    expect(q.size()).toBe(0);
  });
  it("strict flush also writes updates arriving during a pending write", async () => {
    let release: (() => void) | undefined;
    const write = vi.fn(async (_key: string, value: string) => {
      if (value === "old") await new Promise<void>(resolve => { release = resolve; });
    });
    const q = createWriteQueue(write, async () => {}, 10_000);
    q.set("match", "old");
    const flush = q.flush(true);
    await vi.waitFor(() => expect(release).toBeDefined());
    q.set("match", "new");
    release?.();
    await flush;
    expect(write).toHaveBeenLastCalledWith("match", "new");
    expect(q.size()).toBe(0);
  });
});
