import { getAllDeviceValues, removeDeviceValue } from "./deviceStore";

/**
 * Pełny reset świata gry do stanu z 1 stycznia.
 *
 * Usuwa absolutnie wszystkie dane aplikacji (localStorage + pamięć urządzenia),
 * poza ustawieniami aplikacji i slotami zapisu. Po przeładowaniu seedery
 * odtwarzają bazowe turnieje, składy, kontrakty i ranking.
 */

/** Klucze, które przeżywają reset (ustawienia aplikacji). */
const KEEP_EXACT = new Set([
  "csgo_hub_app_theme",
  "csgo_hub_app_font",
  "csgo_hub_map_pool_active",
  "csgo_hub_auto_backup_disabled",
  "csgo_hub_save_1",
  "csgo_hub_save_2",
  "app_theme",
  "app_font",
]);
const KEEP_PREFIXES = ["csgo_hub_ui_", "sb-"];

const keep = (k: string) => KEEP_EXACT.has(k) || KEEP_PREFIXES.some(p => k.startsWith(p));

export async function resetSeason(): Promise<void> {
  try {
    Object.keys(localStorage).filter(k => !keep(k)).forEach(k => localStorage.removeItem(k));
  } catch { /* ignore */ }
  try { sessionStorage.clear(); } catch { /* ignore */ }
  try {
    const all = await getAllDeviceValues();
    await Promise.all(Object.keys(all).filter(k => !keep(k)).map(k => removeDeviceValue(k).catch(() => undefined)));
  } catch { /* ignore */ }

  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("season:reset"));
}
