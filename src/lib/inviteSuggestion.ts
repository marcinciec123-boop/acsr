// ===== Invite suggestions =====
// Sugeruje drużyny do zaproszenia na turniej w oparciu o aktualny ranking,
// z podziałem na sloty per region lub global.

import { loadAllTeams } from "./teamManagement";
import type { TeamData } from "./types";

export interface InviteSlotConfig {
  /** "global" — jedna pula, "regional" — sloty per region */
  scope: "global" | "regional";
  /** klucz: kod regionu (lub "GLOBAL"), wartość: liczba miejsc */
  slots: Record<string, number>;
  /** drużyny do wykluczenia (np. już ręcznie zaproszone) */
  exclude?: string[];
}

export interface InviteSuggestion {
  region: string;
  team: string;
  rank: number;
  points: number;
  country: string;
}

/**
 * Zwraca posortowaną listę sugerowanych zaproszeń dla podanej konfiguracji.
 * Pomija drużyny już znajdujące się w `exclude`.
 */
export function suggestInvites(config: InviteSlotConfig): InviteSuggestion[] {
  const all = loadAllTeams().sort((a, b) => b.points - a.points);
  const exclude = new Set(config.exclude || []);
  const out: InviteSuggestion[] = [];

  if (config.scope === "global") {
    const slots = Math.max(0, config.slots.GLOBAL || 0);
    let i = 0;
    for (const t of all) {
      if (out.length >= slots) break;
      if (exclude.has(t.name)) { i++; continue; }
      out.push({
        region: "GLOBAL",
        team: t.name,
        rank: i + 1,
        points: t.points,
        country: t.country,
      });
      i++;
    }
    return out;
  }

  // regional
  for (const [region, slotCountRaw] of Object.entries(config.slots)) {
    const slotCount = Math.max(0, slotCountRaw || 0);
    if (slotCount === 0) continue;
    const inRegion = all.filter(t => t.region === region);
    let picked = 0;
    inRegion.forEach((t, idx) => {
      if (picked >= slotCount) return;
      if (exclude.has(t.name)) return;
      out.push({
        region,
        team: t.name,
        rank: idx + 1,
        points: t.points,
        country: t.country,
      });
      picked++;
    });
  }
  return out;
}

/** Pomocnik: zwraca top N drużyn z danego regionu (lub global) jako alternatywy do podmiany. */
export function topTeamsForRegion(region: string, limit = 20, exclude: string[] = []): TeamData[] {
  const all = loadAllTeams().sort((a, b) => b.points - a.points);
  const ex = new Set(exclude);
  const filtered = region === "GLOBAL" ? all : all.filter(t => t.region === region);
  return filtered.filter(t => !ex.has(t.name)).slice(0, limit);
}
