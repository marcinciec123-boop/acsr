import { describe, expect, it } from "vitest";
import { initialNavigation, pushNavigation, backNavigation } from "./sessionNavigation";

describe("session navigation", () => {
  it("returns from a linked tournament to records' statistics panel and scroll", () => {
    const records = pushNavigation(initialNavigation(), { tab: "stats", profiles: [], tournament: null }, 0);
    const tournament = pushNavigation(records, { tab: "tournaments", profiles: [], tournament: { tournamentId: "esl" } }, 640);
    expect(backNavigation(tournament).current).toEqual({ view: records.current.view, scrollY: 640 });
  });
  it("returns directly from a record's match without inserting a tournament step", () => {
    const records = pushNavigation(initialNavigation(), { tab: "stats", profiles: [], tournament: null }, 0);
    const match = pushNavigation(records, { tab: "tournaments", profiles: [], tournament: { tournamentId: "esl", matchId: "final" } }, 180);
    expect(backNavigation(match).current.view.tab).toBe("stats");
  });
  it("restores match and player through nested cross-panel links", () => {
    const match = pushNavigation(initialNavigation(), { tab: "tournaments", profiles: [], tournament: { tournamentId: "esl", matchId: "final" } }, 0);
    const player = pushNavigation(match, { ...match.current.view, profiles: [{ kind: "player", name: "Marcin", key: 1 }] }, 210);
    const second = pushNavigation(player, { tab: "tournaments", profiles: [], tournament: { tournamentId: "esea" } }, 450);
    expect(backNavigation(second).current.view).toEqual(player.current.view);
    expect(backNavigation(backNavigation(second)).current).toEqual({ view: match.current.view, scrollY: 210 });
  });
  it("does not add duplicate visits and safely handles an empty history", () => {
    const state = initialNavigation();
    expect(pushNavigation(state, state.current.view, 55)).toBe(state);
    expect(backNavigation(state)).toBe(state);
  });
  it("branches from the restored view rather than retaining future destinations", () => {
    const first = pushNavigation(initialNavigation(), { tab: "stats", profiles: [], tournament: null }, 10);
    const second = pushNavigation(first, { tab: "players", profiles: [], tournament: null }, 20);
    const branch = pushNavigation(backNavigation(second), { tab: "rankings", profiles: [], tournament: null }, 30);
    expect(branch.past.map(entry => entry.view.tab)).toEqual(["news", "stats"]);
  });
});