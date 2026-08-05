// ===== Pula map =====
// 13 map w grze, z czego dokładnie 11 jest w puli aktywnej (2 nieaktywne).

import { useEffect, useState } from "react";
import { loadFromStorage, saveToStorage } from "@/lib/storage";

export const ALL_MAPS = [
  "Anubis", "Ancient", "Cache", "Canals", "Cobblestone", "Dust II", "Inferno",
  "Mirage", "Nuke", "Overpass", "Train", "Tuscan", "Vertigo",
] as const;

export const ACTIVE_POOL_SIZE = 11;

export const DEFAULT_ACTIVE_MAPS = [
  "Anubis", "Ancient", "Cache", "Dust II", "Inferno", "Mirage",
  "Nuke", "Overpass", "Train", "Tuscan", "Vertigo",
];

const KEY = "map_pool_active";
export const MAP_POOL_EVENT = "mappool:update";

const sanitize = (maps: string[]): string[] => {
  const valid = maps.filter((m, i) => (ALL_MAPS as readonly string[]).includes(m) && maps.indexOf(m) === i);
  if (valid.length === ACTIVE_POOL_SIZE) return valid;
  // Uzupełnij / przytnij do dokładnie 11 map.
  const filled = [...valid];
  for (const m of DEFAULT_ACTIVE_MAPS) {
    if (filled.length >= ACTIVE_POOL_SIZE) break;
    if (!filled.includes(m)) filled.push(m);
  }
  for (const m of ALL_MAPS) {
    if (filled.length >= ACTIVE_POOL_SIZE) break;
    if (!filled.includes(m)) filled.push(m);
  }
  return filled.slice(0, ACTIVE_POOL_SIZE);
};

/** Aktywna pula map (zawsze 11), posortowana w kolejności ALL_MAPS. */
export function getActiveMaps(): string[] {
  const stored = loadFromStorage<string[]>(KEY, DEFAULT_ACTIVE_MAPS);
  const active = new Set(sanitize(Array.isArray(stored) ? stored : DEFAULT_ACTIVE_MAPS));
  return ALL_MAPS.filter(m => active.has(m));
}

/** Mapy poza pulą (zawsze 2). */
export function getInactiveMaps(): string[] {
  const active = new Set(getActiveMaps());
  return ALL_MAPS.filter(m => !active.has(m));
}

/** Zapisuje pulę — wymaga dokładnie 11 map. */
export function setActiveMaps(maps: string[]): boolean {
  if (maps.length !== ACTIVE_POOL_SIZE) return false;
  const clean = sanitize(maps);
  saveToStorage(KEY, clean);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(MAP_POOL_EVENT));
  return true;
}

/** Hook reagujący na zmianę puli map. */
export function useActiveMaps(): string[] {
  const [maps, setMaps] = useState<string[]>(() => getActiveMaps());
  useEffect(() => {
    const sync = () => setMaps(getActiveMaps());
    window.addEventListener(MAP_POOL_EVENT, sync);
    return () => window.removeEventListener(MAP_POOL_EVENT, sync);
  }, []);
  return maps;
}
