// Tournament logo persistence (device storage, same backend as team logos).
import { scheduleDeviceBackup } from "./deviceBackup";
import { DEVICE_STORE_REF, getCachedDeviceValue, getDeviceValue, removeDeviceValue, setDeviceValue } from "./deviceStore";

const key = (id: string) => "csgo_hub_tournamentlogo_" + id;
const memo = new Map<string, string | null>();

// A backup restore broadcasts without an id: discard all previous logo/null results
// before mounted logos read the restored device values.
if (typeof window !== "undefined") {
  window.addEventListener("tournamentlogo:update", (event: Event) => {
    const detail = (event as CustomEvent<{ id?: string }>).detail;
    if (!detail?.id) memo.clear();
  });
}

export async function saveTournamentLogo(id: string, dataUrl: string): Promise<void> {
  await setDeviceValue(key(id), dataUrl);
  try { localStorage.setItem(key(id), DEVICE_STORE_REF); } catch { /* ignore */ }
  memo.set(id, dataUrl);
  scheduleDeviceBackup();
  window.dispatchEvent(new CustomEvent("tournamentlogo:update", { detail: { id } }));
}

export function getCachedTournamentLogo(id: string): string | null | undefined {
  if (memo.has(id)) return memo.get(id);
  const c = getCachedDeviceValue(key(id));
  return c ?? undefined;
}

export async function loadTournamentLogo(id: string): Promise<string | null> {
  if (memo.has(id)) return memo.get(id) ?? null;
  let v: string | null = null;
  try { v = (await getDeviceValue(key(id))) ?? null; } catch { /* ignore */ }
  memo.set(id, v);
  return v;
}

export async function deleteTournamentLogo(id: string): Promise<void> {
  try { localStorage.removeItem(key(id)); } catch { /* ignore */ }
  try { await removeDeviceValue(key(id)); } catch { /* ignore */ }
  memo.set(id, null);
  scheduleDeviceBackup();
  window.dispatchEvent(new CustomEvent("tournamentlogo:update", { detail: { id } }));
}
