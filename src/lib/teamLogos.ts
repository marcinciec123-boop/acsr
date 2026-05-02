// Team logo persistence — reuses the IndexedDB image store.
import { saveImage, loadImage, deleteImage } from "./storage";

const PREFIX = "teamlogo_";
const key = (teamName: string) => PREFIX + teamName.toLowerCase().replace(/\s+/g, "_");

export async function saveTeamLogo(teamName: string, dataUrl: string): Promise<void> {
  await saveImage(key(teamName), dataUrl);
  // Notify listeners (TeamLogo components) so they can refresh without a remount.
  window.dispatchEvent(new CustomEvent("teamlogo:update", { detail: { teamName } }));
}

export async function loadTeamLogo(teamName: string): Promise<string | null> {
  return loadImage(key(teamName));
}

export async function deleteTeamLogo(teamName: string): Promise<void> {
  await deleteImage(key(teamName));
  window.dispatchEvent(new CustomEvent("teamlogo:update", { detail: { teamName } }));
}

/** Reads a File from an input and returns a resized data-URL (max 256x256, PNG). */
export function fileToLogoDataUrl(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Invalid image"));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas unavailable"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
