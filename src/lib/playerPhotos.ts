// Player photo persistence (custom uploads). Mirrors the team-logo storage:
// heavy image data lives in IndexedDB-backed device storage, localStorage only
// keeps a reference marker.
import { saveImage, loadImage, deleteImage } from "./storage";
import { scheduleDeviceBackup } from "./deviceBackup";
import { DEVICE_STORE_REF, getCachedDeviceValue, getDeviceValue, removeDeviceValue, setDeviceValue } from "./deviceStore";

export const PLAYER_PHOTO_EVENT = "playerphoto:update";

const LS_PREFIX = "csgo_hub_playerphoto_";
const IDB_PREFIX = "playerphoto_";

const slug = (player: string) => player.toLowerCase().replace(/\s+/g, "_");
const lsKey = (player: string) => LS_PREFIX + slug(player);
const idbKey = (player: string) => IDB_PREFIX + slug(player);

export async function savePlayerPhoto(player: string, dataUrl: string): Promise<void> {
  try {
    await setDeviceValue(lsKey(player), dataUrl);
    try { localStorage.setItem(lsKey(player), DEVICE_STORE_REF); } catch { /* device-only */ }
  } catch (e) {
    console.warn("Player photo device storage save failed, falling back to image DB:", e);
    await saveImage(idbKey(player), dataUrl);
  }
  scheduleDeviceBackup();
  window.dispatchEvent(new CustomEvent(PLAYER_PHOTO_EVENT, { detail: { player } }));
}

export async function loadPlayerPhoto(player: string): Promise<string | null> {
  const key = lsKey(player);
  const cached = getCachedDeviceValue(key);
  if (cached) return cached;
  try {
    const fromDevice = await getDeviceValue(key);
    if (fromDevice) return fromDevice;
    const fromLs = localStorage.getItem(key);
    if (fromLs && fromLs !== DEVICE_STORE_REF) {
      await setDeviceValue(key, fromLs);
      try { localStorage.setItem(key, DEVICE_STORE_REF); } catch { /* ignore */ }
      scheduleDeviceBackup();
      return fromLs;
    }
  } catch { /* ignore */ }
  try {
    const legacy = await loadImage(idbKey(player));
    if (legacy) return legacy;
  } catch { /* ignore */ }
  return null;
}

export function getCachedPlayerPhoto(player: string): string | null {
  return getCachedDeviceValue(lsKey(player)) || null;
}

export async function deletePlayerPhoto(player: string): Promise<void> {
  try { localStorage.removeItem(lsKey(player)); } catch { /* ignore */ }
  try { await removeDeviceValue(lsKey(player)); } catch { /* ignore */ }
  try { await deleteImage(idbKey(player)); } catch { /* ignore */ }
  scheduleDeviceBackup();
  window.dispatchEvent(new CustomEvent(PLAYER_PHOTO_EVENT, { detail: { player } }));
}

/** Deterministic jersey colours for a team (used by the procedural avatar). */
export function jerseyColors(teamName: string): { base: string; accent: string; dark: string } {
  let hash = 0;
  for (let i = 0; i < teamName.length; i++) hash = teamName.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  const accentHue = (hue + 32) % 360;
  return {
    base: `hsl(${hue} 62% 42%)`,
    accent: `hsl(${accentHue} 78% 58%)`,
    dark: `hsl(${hue} 55% 24%)`,
  };
}
