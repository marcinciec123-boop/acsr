// Team logo persistence.
// Stored in localStorage (under csgo_hub_teamlogo_*) so they are part of
// device backups / world exports. Falls back to IndexedDB for legacy data
// from older versions of the app.
import { saveImage, loadImage, deleteImage } from "./storage";
import { scheduleDeviceBackup } from "./deviceBackup";

const LS_PREFIX = "csgo_hub_teamlogo_";
const IDB_PREFIX = "teamlogo_"; // legacy IndexedDB key prefix

const slug = (teamName: string) => teamName.toLowerCase().replace(/\s+/g, "_");
const lsKey = (teamName: string) => LS_PREFIX + slug(teamName);
const idbKey = (teamName: string) => IDB_PREFIX + slug(teamName);

export async function saveTeamLogo(teamName: string, dataUrl: string): Promise<void> {
  try {
    localStorage.setItem(lsKey(teamName), dataUrl);
    scheduleDeviceBackup();
  } catch (e) {
    // localStorage quota — fall back to IndexedDB so the user doesn't lose the upload
    console.warn("Logo localStorage save failed, falling back to IndexedDB:", e);
    await saveImage(idbKey(teamName), dataUrl);
  }
  window.dispatchEvent(new CustomEvent("teamlogo:update", { detail: { teamName } }));
}

export async function loadTeamLogo(teamName: string): Promise<string | null> {
  try {
    const fromLs = localStorage.getItem(lsKey(teamName));
    if (fromLs) return fromLs;
  } catch {
    /* ignore */
  }
  // Legacy fallback — migrate to localStorage if present in IDB
  try {
    const legacy = await loadImage(idbKey(teamName));
    if (legacy) {
      try {
        localStorage.setItem(lsKey(teamName), legacy);
        scheduleDeviceBackup();
      } catch { /* quota — keep using IDB */ }
      return legacy;
    }
  } catch { /* ignore */ }
  return null;
}

export async function deleteTeamLogo(teamName: string): Promise<void> {
  try { localStorage.removeItem(lsKey(teamName)); } catch { /* ignore */ }
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
