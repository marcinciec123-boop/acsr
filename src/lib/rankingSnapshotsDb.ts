// ===== Codzienne migawki rankingu w bazie (Lovable Cloud) =====
// Każde przejście do kolejnego dnia fikcyjnego kalendarza zapisuje pełny
// ranking dnia w bazie. Dodatkowo baza przechowuje historyczne rankingi
// zaimportowane z arkuszy — są one dociągane przy starcie i uwzględniane
// we wszystkich wykresach historii punktów/miejsc.

import { supabase } from "@/integrations/supabase/client";

export interface RemoteSnapshot {
  date: string;
  points: Record<string, number>;
  ranks?: Record<string, number>;
  rosters?: Record<string, string[]>;
  source?: string;
}

const CACHE_KEY = "ranking_history_remote_v1";
const DAY_MARK_KEY = "ranking_snapshot_day_mark";

/** Lokalny (synchroniczny) cache migawek z bazy — używany przy budowie wykresów. */
export function loadRemoteSnapshotCache(): RemoteSnapshot[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRemoteSnapshotCache(list: RemoteSnapshot[]): void {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(list)); } catch { /* ignore */ }
}

/** Pobiera wszystkie migawki z bazy i odświeża lokalny cache. */
export async function fetchRemoteSnapshots(): Promise<RemoteSnapshot[]> {
  const { data, error } = await supabase
    .from("ranking_snapshots")
    .select("snapshot_date, points, ranks, rosters, source")
    .eq("source", "historical")
    .order("snapshot_date", { ascending: true });
  if (error || !data) {
    if (error) console.error("Nie udało się pobrać migawek rankingu:", error.message);
    return loadRemoteSnapshotCache();
  }
  const list: RemoteSnapshot[] = data.map(row => ({
    date: String(row.snapshot_date).slice(0, 10),
    points: (row.points || {}) as Record<string, number>,
    ranks: (row.ranks || {}) as Record<string, number>,
    rosters: (row.rosters || {}) as Record<string, string[]>,
    source: row.source || "daily",
  }));
  saveRemoteSnapshotCache(list);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("ranking:update"));
  return list;
}

// Zapis migawek do bazy jest możliwy wyłącznie ręcznie (import historycznych
// arkuszy) przez funkcję backendową zabezpieczoną kluczem administratorskim.
// Aplikacja nigdy nie zapisuje — lokalny zapis użytkownika jest nadrzędny.
