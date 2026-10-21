// Team logo persistence: heavy image data lives in IndexedDB-backed device storage.
import { saveImage, loadImage, deleteImage } from "./storage";
import { scheduleDeviceBackup } from "./deviceBackup";
import { canonicalTeamName, teamNameChain } from "./teamRenames";
import { DEVICE_STORE_REF, getCachedDeviceValue, getDeviceValue, removeDeviceValue, setDeviceValue } from "./deviceStore";

const LS_PREFIX = "csgo_hub_teamlogo_";
const IDB_PREFIX = "teamlogo_"; // legacy IndexedDB key prefix

const slug = (teamName: string) => teamName.toLowerCase().replace(/\s+/g, "_");
const lsKey = (teamName: string) => LS_PREFIX + slug(teamName);
const idbKey = (teamName: string) => IDB_PREFIX + slug(teamName);

export async function saveTeamLogo(teamName: string, dataUrl: string): Promise<void> {
  try {
    await setDeviceValue(lsKey(teamName), dataUrl);
    try { localStorage.setItem(lsKey(teamName), DEVICE_STORE_REF); } catch { /* device-only */ }
  } catch (e) {
    console.warn("Logo device storage save failed, falling back to image DB:", e);
    await saveImage(idbKey(teamName), dataUrl);
  }
  scheduleDeviceBackup();
  window.dispatchEvent(new CustomEvent("teamlogo:update", { detail: { teamName } }));
}

export async function loadTeamLogo(teamName: string): Promise<string | null> {
  const key = lsKey(teamName);
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
  } catch {
    /* ignore */
  }
  // Legacy fallback — migrate to localStorage if present in IDB
  try {
    const legacy = await loadImage(idbKey(teamName));
    if (legacy) {
      try {
        await setDeviceValue(key, legacy);
        localStorage.setItem(key, DEVICE_STORE_REF);
        scheduleDeviceBackup();
      } catch { /* keep using legacy image DB */ }
      return legacy;
    }
  } catch { /* ignore */ }
  // Rename fallback: stare zapisy trzymają logo pod poprzednią nazwą drużyny.
  try {
    const chain = teamNameChain(canonicalTeamName(teamName));
    for (const alias of chain) {
      if (alias === teamName) continue;
      const aliasKey = lsKey(alias);
      const cachedAlias = getCachedDeviceValue(aliasKey);
      if (cachedAlias) return cachedAlias;
      const fromDevice = await getDeviceValue(aliasKey);
      if (fromDevice) return fromDevice;
      const fromLs = localStorage.getItem(aliasKey);
      if (fromLs && fromLs !== DEVICE_STORE_REF) return fromLs;
      const legacy = await loadImage(idbKey(alias));
      if (legacy) return legacy;
    }
  } catch { /* ignore */ }
  return null;
}

export async function deleteTeamLogo(teamName: string): Promise<void> {
  try { localStorage.removeItem(lsKey(teamName)); } catch { /* ignore */ }
  try { await removeDeviceValue(lsKey(teamName)); } catch { /* ignore */ }
  try { await deleteImage(idbKey(teamName)); } catch { /* ignore */ }
  scheduleDeviceBackup();
  window.dispatchEvent(new CustomEvent("teamlogo:update", { detail: { teamName } }));
}

/** Reads a File from an input and returns a resized data-URL. PNG by default; JPEG fallback if too large. */
export function fileToLogoDataUrl(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, w, h);
        let out = canvas.toDataURL("image/png");
        // Keep entries safely under typical localStorage per-key budgets.
        if (out.length > 180_000) out = canvas.toDataURL("image/jpeg", 0.85);
        resolve(out);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
