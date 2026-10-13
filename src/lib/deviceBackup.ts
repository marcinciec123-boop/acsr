import { WORLD_CLOCK_EVENT, getWorldDate } from "./worldClock";
import { getAllImages } from "./storage";
import { DEVICE_STORE_REF, getAllCachedDeviceValues, getAllDeviceValues, removeDeviceValue, setDeviceValue } from "./deviceStore";

const BACKUP_DB_NAME = "csgo_hub_device_backups";
const BACKUP_DB_VERSION = 1;
const BACKUP_STORE = "snapshots";
const MAX_BACKUPS = 30;

export interface DeviceBackupSnapshot {
  id: string;
  createdAt: number;
  label: string;
  reason: "auto" | "manual" | "import";
  schemaVersion: 1;
  keys: Record<string, string>;
  size: number;
}

const isBrowser = () => typeof window !== "undefined" && typeof indexedDB !== "undefined";

// A save is 1:1: every app key belongs to it (transfers, rename/disband history,
// awards, scheduled matches, ranking history, reports, date, preferences...).
// Only auth/session and platform keys are excluded.
const EXCLUDED_PREFIXES = ["sb-", "supabase", "lovable", "__", "debug", "vite"];
const isManagedKey = (key: string) =>
  key !== AUTO_BACKUP_FLAG_KEY && !EXCLUDED_PREFIXES.some(p => key.toLowerCase().startsWith(p));

// ===== Autozapis on/off =====
const AUTO_BACKUP_FLAG_KEY = "csgo_hub_auto_backup_disabled";

export const isAutoBackupEnabled = (): boolean => {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(AUTO_BACKUP_FLAG_KEY) !== "1";
};

export const setAutoBackupEnabled = (enabled: boolean): void => {
  if (typeof localStorage === "undefined") return;
  if (enabled) localStorage.removeItem(AUTO_BACKUP_FLAG_KEY);
  else localStorage.setItem(AUTO_BACKUP_FLAG_KEY, "1");
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("csgo-hub-auto-backup-toggle"));
  }
};

const openBackupDb = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (!isBrowser()) return reject(new Error("Brak dostępu do zapisu urządzenia"));
  const request = indexedDB.open(BACKUP_DB_NAME, BACKUP_DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(BACKUP_STORE)) {
      db.createObjectStore(BACKUP_STORE, { keyPath: "id" });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const collectLocalState = (): Record<string, string> => {
  const keys: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key || !isManagedKey(key)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) keys[key] = value;
  }
  return Object.fromEntries(Object.entries(keys).sort(([a], [b]) => a.localeCompare(b)));
};

const collectDeviceState = async (): Promise<Record<string, string>> => {
  const values = getAllCachedDeviceValues() ?? await getAllDeviceValues();
  return Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => isManagedKey(key))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
};

const MEDIA_PREFIXES = ["csgo_hub_teamlogo_", "csgo_hub_playerphoto_"];
const isMediaKey = (key: string) => MEDIA_PREFIXES.some(p => key.startsWith(p));

/** Full save: real image data instead of reference markers, legacy images, and the fictional date. */
const collectFullState = async (): Promise<Record<string, string>> => {
  const keys: Record<string, string> = { ...collectLocalState(), ...(await collectDeviceState()) };
  // Legacy image DB (teamlogo_/playerphoto_) — bring into the save.
  try {
    const images = await getAllImages();
    for (const { id, dataUrl } of images) {
      const key = id.startsWith("teamlogo_") ? "csgo_hub_" + id
        : id.startsWith("playerphoto_") ? "csgo_hub_" + id : null;
      if (key && dataUrl && (!keys[key] || keys[key] === DEVICE_STORE_REF)) keys[key] = dataUrl;
    }
  } catch { /* ignore */ }
  for (const [k, v] of Object.entries(keys)) if (v === DEVICE_STORE_REF) delete keys[k];
  keys.world_clock_date = getWorldDate();
  return Object.fromEntries(Object.entries(keys).sort(([a], [b]) => a.localeCompare(b)));
};

// Cheap, allocation-free hash of the whole state (FNV-1a). Replaces a full
// JSON.stringify comparison of the save, which froze the UI on big saves.
const stateSignature = (keys: Record<string, string>) => {
  let h = 0x811c9dc5;
  for (const [k, v] of Object.entries(keys)) {
    const s = k + "\u0000" + v.length + "\u0000";
    for (let i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    for (let i = 0; i < v.length; i += 1) { h ^= v.charCodeAt(i); h = Math.imul(h, 16777619); }
  }
  return (h >>> 0).toString(36);
};
let lastSignature: string | null = null;

export const listDeviceBackups = async (): Promise<DeviceBackupSnapshot[]> => {
  const db = await openBackupDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readonly");
    const req = tx.objectStore(BACKUP_STORE).getAll();
    req.onsuccess = () => resolve((req.result as DeviceBackupSnapshot[]).sort((a, b) => b.createdAt - a.createdAt));
    req.onerror = () => reject(req.error);
  });
};

/** Reads only the newest backup (ids start with a fixed-width timestamp). */
const getLatestBackup = async (): Promise<DeviceBackupSnapshot | null> => {
  const db = await openBackupDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readonly");
    const req = tx.objectStore(BACKUP_STORE).openCursor(null, "prev");
    req.onsuccess = () => resolve((req.result?.value as DeviceBackupSnapshot | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
};

const getBackup = async (id: string): Promise<DeviceBackupSnapshot | null> => {
  const db = await openBackupDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readonly");
    const req = tx.objectStore(BACKUP_STORE).get(id);
    req.onsuccess = () => resolve((req.result as DeviceBackupSnapshot | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
};

const trimBackups = async () => {
  const db = await openBackupDb();
  const ids = await new Promise<string[]>((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readonly");
    const req = tx.objectStore(BACKUP_STORE).getAllKeys();
    req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String));
    req.onerror = () => reject(req.error);
  });
  const stale = ids.sort((a, b) => b.localeCompare(a)).slice(MAX_BACKUPS);
  if (stale.length === 0) return;
  await Promise.all(stale.map(id => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readwrite");
    const req = tx.objectStore(BACKUP_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  })));
};

export const createDeviceBackup = async (
  reason: DeviceBackupSnapshot["reason"] = "auto",
  label?: string,
): Promise<DeviceBackupSnapshot | null> => {
  if (!isBrowser()) return null;
  const keys = await collectFullState();
  if (Object.keys(keys).length === 0) return null;

  const signature = stateSignature(keys);
  if (reason === "auto") {
    if (lastSignature === null) {
      const latest = await getLatestBackup();
      lastSignature = latest ? stateSignature(latest.keys) : "";
    }
    if (lastSignature === signature) return null;
  }

  const createdAt = Date.now();
  const snapshot: DeviceBackupSnapshot = {
    id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    label: label || (reason === "manual" ? "Ręczny zapis" : "Auto zapis"),
    reason,
    schemaVersion: 1,
    keys,
    size: Object.values(keys).reduce((n, v) => n + v.length, 0),
  };

  const db = await openBackupDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readwrite");
    const req = tx.objectStore(BACKUP_STORE).put(snapshot);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  lastSignature = signature;
  await trimBackups();
  window.dispatchEvent(new CustomEvent("csgo-hub-device-backup"));
  return snapshot;
};

let backupTimer: number | undefined;
export const scheduleDeviceBackup = (reason: DeviceBackupSnapshot["reason"] = "auto") => {
  if (!isBrowser()) return;
  // Skip auto-saves entirely when the user disabled them. Manual/import always pass through.
  if (reason === "auto" && !isAutoBackupEnabled()) return;
  window.clearTimeout(backupTimer);
  // Batch bursts of edits into one backup, taken when the app is idle.
  backupTimer = window.setTimeout(() => {
    const run = () => { void createDeviceBackup(reason).catch(error => console.error("Device backup failed:", error)); };
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (idle) idle(run, { timeout: 10_000 }); else run();
  }, 15_000);
};

export const deleteDeviceBackup = async (id: string): Promise<void> => {
  const db = await openBackupDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readwrite");
    const req = tx.objectStore(BACKUP_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("csgo-hub-device-backup"));
  }
};

export const deleteDeviceBackupsByReason = async (
  reason: DeviceBackupSnapshot["reason"],
): Promise<number> => {
  const all = await listDeviceBackups();
  const matches = all.filter(b => b.reason === reason);
  if (matches.length === 0) return 0;
  const db = await openBackupDb();
  await Promise.all(matches.map(b => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readwrite");
    const req = tx.objectStore(BACKUP_STORE).delete(b.id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  })));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("csgo-hub-device-backup"));
  }
  return matches.length;
};

export const deleteAllDeviceBackups = async (): Promise<number> => {
  const all = await listDeviceBackups();
  if (all.length === 0) return 0;
  const db = await openBackupDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readwrite");
    const req = tx.objectStore(BACKUP_STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("csgo-hub-device-backup"));
  }
  return all.length;
};

export const restoreDeviceBackup = async (id: string): Promise<DeviceBackupSnapshot> => {
  const snapshot = await getBackup(id);
  if (!snapshot) throw new Error("Nie znaleziono zapisu");

  const currentKeys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && isManagedKey(key)) currentKeys.push(key);
  }
  // Logos/photos are shared across saves: keep current ones unless the snapshot has its own.
  const keep = (key: string) => isMediaKey(key) && !(key in snapshot.keys);
  currentKeys.filter(k => !keep(k)).forEach(key => localStorage.removeItem(key));
  const currentDeviceKeys = Object.keys(await collectDeviceState().catch(() => ({})));
  await Promise.all(currentDeviceKeys.filter(k => !keep(k)).map(key => removeDeviceValue(key).catch(() => undefined)));
  await Promise.all(Object.entries(snapshot.keys).map(async ([key, value]) => {
    if (value === DEVICE_STORE_REF) return; // old exports carried only a marker
    if (value.length > 120_000 || isMediaKey(key)) {
      await setDeviceValue(key, value);
      try { localStorage.setItem(key, DEVICE_STORE_REF); } catch { /* device-only */ }
    } else {
      localStorage.setItem(key, value);
      await removeDeviceValue(key).catch(() => undefined);
    }
  }));
  window.dispatchEvent(new CustomEvent("teamlogo:update", { detail: {} }));
  window.dispatchEvent(new CustomEvent("playerphoto:update", { detail: {} }));
  if (typeof window !== "undefined") {
    // The restored save carries its own fictional date — tell the UI to re-read it.
    window.dispatchEvent(new Event(WORLD_CLOCK_EVENT));
  }
  return snapshot;
};

export const importDeviceBackup = async (raw: string): Promise<DeviceBackupSnapshot> => {
  const parsed = JSON.parse(raw) as Partial<DeviceBackupSnapshot>;
  if (!parsed.keys || typeof parsed.keys !== "object") throw new Error("Nieprawidłowy plik zapisu");
  const keys = Object.fromEntries(
    Object.entries(parsed.keys).filter(([key, value]) => isManagedKey(key) && typeof value === "string"),
  ) as Record<string, string>;
  if (Object.keys(keys).length === 0) throw new Error("Plik nie zawiera danych tego świata");
  const snapshot: DeviceBackupSnapshot = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
    label: parsed.label || "Importowany zapis",
    reason: "import",
    schemaVersion: 1,
    keys,
    size: new Blob(Object.values(keys)).size,
  };
  const db = await openBackupDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readwrite");
    const req = tx.objectStore(BACKUP_STORE).put(snapshot);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  await trimBackups();
  return snapshot;
};

export const restoreLatestDeviceBackupIfLocalStateMissing = async (): Promise<boolean> => {
  if (!isBrowser()) return false;
  if (localStorage.getItem("csgo_hub_season_reset_pending")) {
    localStorage.removeItem("csgo_hub_season_reset_pending");
    return false;
  }
  const deviceState = await collectDeviceState().catch(() => ({}));
  if (Object.keys({ ...collectLocalState(), ...deviceState }).length > 0) return false;
  const latest = (await listDeviceBackups())[0];
  if (!latest) return false;
  await restoreDeviceBackup(latest.id);
  return true;
};