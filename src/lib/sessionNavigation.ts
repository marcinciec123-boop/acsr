import type { Tab } from "@/components/NavBar";

export interface ProfileVisit { kind: "team" | "player"; name: string; key: number }
export interface TournamentVisit { tournamentId: string; matchId?: string }
export interface NavigationView {
  tab: Tab;
  profiles: ProfileVisit[];
  tournament: TournamentVisit | null;
}
export interface NavigationEntry { view: NavigationView; scrollY: number }
export interface SessionNavigation { current: NavigationEntry; past: NavigationEntry[] }

export const initialNavigation = (): SessionNavigation => ({
  current: { view: { tab: "news", profiles: [], tournament: null }, scrollY: 0 }, past: [],
});

export function pushNavigation(state: SessionNavigation, view: NavigationView, scrollY: number, nextScrollY = 0): SessionNavigation {
  if (JSON.stringify(state.current.view) === JSON.stringify(view)) return state;
  return { current: { view, scrollY: nextScrollY }, past: [...state.past, { ...state.current, scrollY }] };
}

export function backNavigation(state: SessionNavigation): SessionNavigation {
  const previous = state.past.at(-1);
  return previous ? { current: previous, past: state.past.slice(0, -1) } : state;
}