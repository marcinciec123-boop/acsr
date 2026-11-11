import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { matchDraftKey, rankingAfterMatchConfirmation, updateMatchMetadata, useMatchDraft } from "./matchDraft";
import { loadFromStorage, removeFromStorage, saveToStorage } from "./storage";
import type { MatchResult, TeamData, TournamentData } from "./types";

vi.mock("./storage", () => ({ loadFromStorage: vi.fn((_key, fallback) => fallback), saveToStorage: vi.fn(() => true), removeFromStorage: vi.fn() }));
const match: MatchResult = { id: "m1", team1: "A", team2: "B", bo: 3, score1: 0, score2: 0 };
afterEach(() => { vi.clearAllMocks(); vi.useRealTimers(); });

describe("isolated match editing", () => {
  it("publishes upcoming date and BO without confirming results or advancing matches", () => {
    const source = [{ id: "t1", phases: [{ id: "p1", bracket: [match, { ...match, id: "next", team1: "TBD" }] }] }] as TournamentData[];
    const next = updateMatchMetadata(source, "t1", "p1", "m1", { scheduledAt: "2026-11-09T19:30", bo: 5 });
    expect(next[0].phases[0].bracket?.[0]).toEqual({ ...match, scheduledAt: "2026-11-09T19:30", bo: 5 });
    expect(next[0].phases[0].bracket?.[1]).toBe(source[0].phases[0].bracket?.[1]);
    expect(source[0].phases[0].bracket?.[0]).toBe(match);
  });
  it("publishes group scheduling and clears the schedule independently", () => {
    const source = [{ id: "t1", phases: [{ id: "p1", groups: [{ id: "g1", matches: [match] }] }] }] as TournamentData[];
    const scheduled = updateMatchMetadata(source, "t1", "p1", "m1", { scheduledAt: "2026-11-09T19:30" }, "g1");
    expect(scheduled[0].phases[0].groups?.[0].matches[0].scheduledAt).toBe("2026-11-09T19:30");
    const cleared = updateMatchMetadata(scheduled, "t1", "p1", "m1", { scheduledAt: undefined }, "g1");
    expect(cleared[0].phases[0].groups?.[0].matches[0].scheduledAt).toBeUndefined();
  });
  it("trims draft maps and recounts wins when BO3 is reduced to BO1", () => {
    vi.useFakeTimers();
    const maps = [ { map: "Mirage", score1: 13, score2: 4 }, { map: "Nuke", score1: 13, score2: 6 } ];
    const { result, rerender, unmount } = renderHook(({ committed }) => useMatchDraft(committed, "t1"), { initialProps: { committed: match } });
    act(() => result.current.update({ score1: 2, maps }));
    rerender({ committed: { ...match, bo: 1, scheduledAt: "2026-11-09T19:30" } });
    expect(result.current.match).toEqual({ ...match, bo: 1, scheduledAt: "2026-11-09T19:30", score1: 1, maps: maps.slice(0, 1) });
    act(() => vi.advanceTimersByTime(400));
    expect(saveToStorage).toHaveBeenLastCalledWith(matchDraftKey("t1", "m1"), expect.objectContaining({ match: result.current.match }));
    rerender({ committed: { ...match, bo: 3 } });
    expect(result.current.match.maps).toEqual(maps.slice(0, 1));
    expect(result.current.match.score1).toBe(1);
    unmount();
  });
  it("trims a confirmed BO5 to BO3 without publishing draft stats or changing other matches", () => {
    const maps = [
      { map: "Mirage", score1: 13, score2: 4 },
      { map: "Nuke", score1: 4, score2: 13 },
      { map: "Inferno", score1: 13, score2: 6 },
      { map: "Train", score1: 13, score2: 7 },
      { map: "Dust2", score1: 0, score2: 0 },
    ];
    const confirmed = { ...match, bo: 5 as const, maps, score1: 3, score2: 1, resultConfirmed: true, pointsWinner: 20 };
    const source = [{ id: "t1", phases: [{ id: "p1", bracket: [confirmed, { ...match, id: "next" }] }] }] as TournamentData[];
    const next = updateMatchMetadata(source, "t1", "p1", "m1", { bo: 3 });
    expect(next[0].phases[0].bracket?.[0]).toEqual({ ...confirmed, bo: 3, maps: maps.slice(0, 3), score1: 2, score2: 1 });
    expect(next[0].phases[0].bracket?.[1]).toBe(source[0].phases[0].bracket?.[1]);
    expect(confirmed.maps).toHaveLength(5);
  });
  it("restores retained draft map stats after committed maps were trimmed by a BO reduction", () => {
    const maps = [{ map: "Mirage", score1: 13, score2: 4 }, { map: "Nuke", score1: 4, score2: 13 }, { map: "Inferno", score1: 13, score2: 6 }];
    const old = { ...match, maps, score1: 2, score2: 1 };
    const draftMaps = [{ ...maps[0], score2: 8 }, ...maps.slice(1)];
    vi.mocked(loadFromStorage).mockReturnValueOnce({ base: JSON.stringify(old), match: { ...old, maps: draftMaps } });
    const { result, unmount } = renderHook(() => useMatchDraft({ ...old, bo: 1, maps: maps.slice(0, 1), score1: 1, score2: 0 }, "t1"));
    expect(result.current.match.maps).toEqual(draftMaps.slice(0, 1));
    expect([result.current.match.score1, result.current.match.score2]).toEqual([1, 0]);
    unmount();
  });
  it("restores draft results using current metadata, including schedule removal", () => {
    const old = { ...match, scheduledAt: "2026-11-09T19:30" };
    vi.mocked(loadFromStorage).mockReturnValueOnce({ base: JSON.stringify(old), match: { ...old, score1: 1 } });
    const { result, unmount } = renderHook(() => useMatchDraft({ ...match, bo: 5 }, "t1"));
    expect(result.current.match.score1).toBe(1);
    expect(result.current.match.bo).toBe(5);
    expect(result.current.match.scheduledAt).toBeUndefined();
    unmount();
  });
  it("rejects saved drafts based on outdated committed results", () => {
    vi.mocked(loadFromStorage).mockReturnValueOnce({ base: JSON.stringify(match), match: { ...match, score1: 1 } });
    const confirmed = { ...match, score2: 2, resultConfirmed: true };
    const { result, unmount } = renderHook(() => useMatchDraft(confirmed, "t1"));
    expect(result.current.match).toEqual(confirmed);
    unmount();
  });
  it("keeps typed scores and statistics out of committed tournaments and domain events", () => {
    vi.useFakeTimers();
    const event = vi.fn();
    window.addEventListener("tournaments:update", event);
    const { result, unmount } = renderHook(() => useMatchDraft(match, "t1"));
    act(() => result.current.update({ score1: 2, maps: [{ map: "Mirage", score1: 13, score2: 4 }] }));
    expect(result.current.match.score1).toBe(2);
    expect(match.score1).toBe(0);
    expect(saveToStorage).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(400));
    expect(saveToStorage).toHaveBeenCalledTimes(1);
    expect(saveToStorage).toHaveBeenCalledWith(matchDraftKey("t1", "m1"), expect.objectContaining({ match: expect.objectContaining({ score1: 2 }) }));
    expect(event).not.toHaveBeenCalled();
    unmount();
    window.removeEventListener("tournaments:update", event);
  });
  it("restores an unfinished draft after leaving the match", () => {
    vi.mocked(loadFromStorage).mockReturnValueOnce({ base: JSON.stringify(match), match: { ...match, score1: 1 } });
    const { result, unmount } = renderHook(() => useMatchDraft(match, "t1"));
    expect(result.current.match.score1).toBe(1);
    unmount();
  });
  it("removes the draft after confirmation without re-saving it on exit", () => {
    const { result, unmount } = renderHook(() => useMatchDraft(match, "t1"));
    act(() => result.current.update({ score1: 2 }));
    act(() => result.current.clear({ ...match, score1: 2, resultConfirmed: true }));
    unmount();
    expect(removeFromStorage).toHaveBeenCalledWith(matchDraftKey("t1", "m1"));
    expect(saveToStorage).not.toHaveBeenCalled();
  });
  it("updates points by replacing the previous award, including a corrected winner", () => {
    const ranking: TeamData[] = [ { name: "A", points: 120, country: "PL", region: "EU", roster: [] }, { name: "B", points: 90, country: "PL", region: "EU", roster: [] } ];
    const previous = { ...match, score1: 2, resultConfirmed: true, pointsWinner: 20, pointsLoser: 10 };
    expect(rankingAfterMatchConfirmation(ranking, previous, previous).map(t => t.points)).toEqual([120, 90]);
    expect(rankingAfterMatchConfirmation(ranking, previous, { ...previous, score1: 0, score2: 2, pointsWinner: 30, pointsLoser: 15 }).map(t => t.points)).toEqual([85, 130]);
  });
});