import { removeFromStorage, saveToStorage } from "./storage";
import { teamDatabase } from "@/data/tournaments";
import type { TeamData } from "./types";
import { resetWorldClock } from "./worldClock";

/**
 * Reset sezonu.
 *
 * Czyści wszystko, co powstało w trakcie rozgrywania sezonu (turnieje, wyniki
 * symulacji, historia rankingu, aktualności, nagrody roku, pick'emy), ale NIE
 * rusza rzeczy "trwałych": składów, transferów, kontraktów, ustawień aplikacji.
 */

/** Klucze `storage` (bez prefiksu) usuwane przy resecie sezonu. */
const SEASON_KEYS = [
  "tournaments_data",
  "ranking_history_v1",
  "ranking_history_month_mark",
  "ranking_adjustments",
  "news_posts",
  "news_post_likes",
  "news_comments",
  "year_awards_history",
  "year_awards_shown",
  "pickem_data",
  "hot_streaks_cache",
  "player_stats_cache",
];

/** Surowe klucze localStorage (bez prefiksu storage) używane przez UI. */
const RAW_KEYS = [
  "news_threads_collapsed",
];

export interface SeasonResetOptions {
  /** Czy wyzerować punkty rankingowe drużyn do wartości bazowych. */
  resetRanking?: boolean;
  /** Czy cofnąć datę w grze do wartości domyślnej. */
  resetClock?: boolean;
}

export function resetSeason(options: SeasonResetOptions = {}): void {
  const { resetRanking = true, resetClock = true } = options;

  SEASON_KEYS.forEach(key => {
    try { removeFromStorage(key); } catch { /* ignore */ }
  });
  RAW_KEYS.forEach(key => {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  });

  // Flagi seederów – bez ich wyczyszczenia bazowe turnieje nie wróciłyby.
  try {
    Object.keys(localStorage)
      .filter(k => k.startsWith("csgo_hub_seed"))
      .forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }

  if (resetRanking) {
    // Punkty wracają do bazowych, ale aktualne składy/nazwy zostają nietknięte.
    const base = new Map(teamDatabase.map(t => [t.name, t]));
    const current = (() => {
      try {
        const raw = localStorage.getItem("csgo_hub_ranking_data");
        return raw && raw.startsWith("[") ? (JSON.parse(raw) as TeamData[]) : null;
      } catch { return null; }
    })();
    const next: TeamData[] = (current || teamDatabase.map(t => ({ ...t }))).map(team => ({
      ...team,
      points: base.get(team.name)?.points ?? team.points,
    }));
    saveToStorage("ranking_data", next);
  }

  if (resetClock) resetWorldClock();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("teams:update"));
    window.dispatchEvent(new CustomEvent("ranking:update"));
    window.dispatchEvent(new CustomEvent("ranking-history:update"));
    window.dispatchEvent(new CustomEvent("season:reset"));
  }
}
