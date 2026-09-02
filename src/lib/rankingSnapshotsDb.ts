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

/** Zapisuje (upsert) migawkę danego dnia w bazie i w cache. Zapis idzie przez funkcję backendową — tabela nie jest publicznie zapisywalna. */
export async function pushSnapshotToDb(snapshot: RemoteSnapshot): Promise<boolean> {
  const payload = {
    snapshot_date: snapshot.date,
    points: snapshot.points,
    ranks: snapshot.ranks || {},
    rosters: snapshot.rosters || {},
    source: snapshot.source === "historical" ? "historical" : "daily",
  };
  const { error } = await supabase.functions.invoke("save-ranking-snapshot", {
    body: payload,
  });
  if (error) {
    console.error("Zapis migawki rankingu nie powiódł się:", error.message);
    return false;
  }
  const cache = loadRemoteSnapshotCache().filter(s => s.date !== snapshot.date);
  cache.push({ ...snapshot, source: payload.source });
  cache.sort((a, b) => a.date.localeCompare(b.date));
  saveRemoteSnapshotCache(cache);
  return true;
}
