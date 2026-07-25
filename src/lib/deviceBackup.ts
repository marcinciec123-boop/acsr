import { WORLD_CLOCK_EVENT } from "./worldClock";
import { DEVICE_STORE_REF, getAllDeviceValues, removeDeviceValue, setDeviceValue } from "./deviceStore";

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

// Keys outside the `csgo_hub_`/`tournament_progress_` namespaces that still
// belong to the saved world (e.g. the fictional calendar date).
const EXTRA_MANAGED_KEYS = new Set(["world_clock_date"]);

const isManagedKey = (key: string) =>
  (key.startsWith("csgo_hub_") || key.startsWith("tournament_progress_") || EXTRA_MANAGED_KEYS.has(key))
    && key !== AUTO_BACKUP_FLAG_KEY;

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
  const values = await getAllDeviceValues();
  return Object.fromEntries(
    Object.entries(values)
      .filter(([key]) => isManagedKey(key))
      .sort(([a], [b]) => a.localeCompare(b)),
  );
};

const stateSignature = (keys: Record<string, string>) => JSON.stringify(keys);

export const listDeviceBackups = async (): Promise<DeviceBackupSnapshot[]> => {
  const db = await openBackupDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readonly");
    const req = tx.objectStore(BACKUP_STORE).getAll();
    req.onsuccess = () => resolve((req.result as DeviceBackupSnapshot[]).sort((a, b) => b.createdAt - a.createdAt));
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
  const backups = await listDeviceBackups();
  const stale = backups.slice(MAX_BACKUPS);
  if (stale.length === 0) return;
  const db = await openBackupDb();
  await Promise.all(stale.map(s => new Promise<void>((resolve, reject) => {
    const tx = db.transaction(BACKUP_STORE, "readwrite");
    const req = tx.objectStore(BACKUP_STORE).delete(s.id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  })));
};

export const createDeviceBackup = async (
  reason: DeviceBackupSnapshot["reason"] = "auto",
  label?: string,
): Promise<DeviceBackupSnapshot | null> => {
  if (!isBrowser()) return null;
  const keys = { ...collectLocalState(), ...(await collectDeviceState()) };
  if (Object.keys(keys).length === 0) return null;

  const signature = stateSignature(keys);
  const latest = (await listDeviceBackups())[0];
  if (reason === "auto" && latest && stateSignature(latest.keys) === signature) return latest;

  const createdAt = Date.now();
  const snapshot: DeviceBackupSnapshot = {
    id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt,
    label: label || (reason === "manual" ? "Ręczny zapis" : "Auto zapis"),
    reason,
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
  window.dispatchEvent(new CustomEvent("csgo-hub-device-backup"));
  return snapshot;
};

let backupTimer: number | undefined;
export const scheduleDeviceBackup = (reason: DeviceBackupSnapshot["reason"] = "auto") => {
  if (!isBrowser()) return;
  // Skip auto-saves entirely when the user disabled them. Manual/import always pass through.
  if (reason === "auto" && !isAutoBackupEnabled()) return;
  window.clearTimeout(backupTimer);
  backupTimer = window.setTimeout(() => {
    void createDeviceBackup(reason).catch(error => console.error("Device backup failed:", error));
  }, 1000);
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
  currentKeys.forEach(key => localStorage.removeItem(key));
  const currentDeviceKeys = Object.keys(await collectDeviceState().catch(() => ({})));
  await Promise.all(currentDeviceKeys.map(key => removeDeviceValue(key).catch(() => undefined)));
  await Promise.all(Object.entries(snapshot.keys).map(async ([key, value]) => {
    if (value.length > 120_000) {
      await setDeviceValue(key, value);
      try { localStorage.setItem(key, DEVICE_STORE_REF); } catch { /* device-only */ }
    } else {
      localStorage.setItem(key, value);
      await removeDeviceValue(key).catch(() => undefined);
    }
  }));
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
  const deviceState = await collectDeviceState().catch(() => ({}));
  if (Object.keys({ ...collectLocalState(), ...deviceState }).length > 0) return false;
  const latest = (await listDeviceBackups())[0];
  if (!latest) return false;
  await restoreDeviceBackup(latest.id);
  return true;
};