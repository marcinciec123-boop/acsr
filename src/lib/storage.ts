import { scheduleDeviceBackup } from "./deviceBackup";
import { DEVICE_STORE_REF, getCachedDeviceValue, getDeviceValue, removeDeviceValue, setDeviceValue } from "./deviceStore";

// ===== Persistence Layer =====
// localStorage for text data, IndexedDB for images

const STORAGE_PREFIX = "csgo_hub_";

function notifyStorageUpdate(key: string): void {
  if (typeof window === "undefined") return;
  if (key === "ranking_data") {
    window.dispatchEvent(new CustomEvent("teams:update"));
    window.dispatchEvent(new CustomEvent("ranking:update"));
  }
  if (key === "ranking_history_v1") {
    window.dispatchEvent(new CustomEvent("ranking-history:update"));
  }
}

function normalizeStoredData<T>(key: string, data: T): T {
  if (key !== "ranking_data" || !Array.isArray(data)) return data;

  return data.map(item => {
    if (item && typeof item === "object" && "name" in item && "country" in item) {
      const team = item as { name?: unknown; country?: unknown };
      if (team.name === "Rare Atom" && team.country !== "IDN") {
        return { ...(item as Record<string, unknown>), country: "IDN" };
      }
    }
    return item;
  }) as T;
}

// --- localStorage helpers ---
export function saveToStorage<T>(key: string, data: T): boolean {
  const storageKey = STORAGE_PREFIX + key;
  try {
    const serialized = JSON.stringify(data);
    void setDeviceValue(storageKey, serialized).catch(error => {
      console.error("Failed to save to device storage:", key, error);
    });
    try {
      localStorage.setItem(storageKey, serialized.length > 120_000 ? DEVICE_STORE_REF : serialized);
    } catch (markerError) {
      console.warn("Local storage marker failed, data kept in device storage:", key, markerError);
      try {
        localStorage.removeItem(storageKey);
        localStorage.setItem(storageKey, DEVICE_STORE_REF);
      } catch { /* device storage cache will still serve this session */ }
    }
    scheduleDeviceBackup();
    notifyStorageUpdate(key);
    return true;
  } catch (e) {
    console.error("Failed to save storage marker:", key, e);
    return false;
  }
}

export async function saveToStorageAsync<T>(key: string, data: T): Promise<boolean> {
  const storageKey = STORAGE_PREFIX + key;
  try {
    const serialized = JSON.stringify(data);
    await setDeviceValue(storageKey, serialized);
    try { localStorage.setItem(storageKey, serialized.length > 120_000 ? DEVICE_STORE_REF : serialized); }
    catch { try { localStorage.setItem(storageKey, DEVICE_STORE_REF); } catch { /* device-only */ } }
    scheduleDeviceBackup();
    notifyStorageUpdate(key);
    return true;
  } catch (e) {
    console.error("Failed to save to device storage:", key, e);
    return false;
  }
}

export function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const storageKey = STORAGE_PREFIX + key;
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      const cached = getCachedDeviceValue(storageKey);
      return cached ? normalizeStoredData(key, JSON.parse(cached) as T) : fallback;
    }
    if (raw === DEVICE_STORE_REF) {
      const cached = getCachedDeviceValue(storageKey);
      return cached ? normalizeStoredData(key, JSON.parse(cached) as T) : fallback;
    }
    return normalizeStoredData(key, JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function loadFromStorageAsync<T>(key: string, fallback: T): Promise<T> {
  const storageKey = STORAGE_PREFIX + key;
  try {
    const marker = localStorage.getItem(storageKey);
    if (marker === DEVICE_STORE_REF) {
      const raw = await getDeviceValue(storageKey);
      return raw ? normalizeStoredData(key, JSON.parse(raw) as T) : fallback;
    }
    if (marker) return normalizeStoredData(key, JSON.parse(marker) as T);
    const raw = await getDeviceValue(storageKey);
    if (raw) {
      try { localStorage.setItem(storageKey, raw.length > 120_000 ? DEVICE_STORE_REF : raw); } catch { /* keep device-only */ }
      return normalizeStoredData(key, JSON.parse(raw) as T);
    }
    return fallback;
  } catch {
    return fallback;
  }
}

export async function migrateHeavyLocalStorageToDeviceStore(): Promise<number> {
  if (typeof localStorage === "undefined") return 0;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && (key.startsWith(STORAGE_PREFIX) || key.startsWith("tournament_progress_"))) keys.push(key);
  }

  let migrated = 0;
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (!value || value === DEVICE_STORE_REF) continue;
    const isHeavy = value.length > 120_000 || key.startsWith("csgo_hub_teamlogo_");
    if (!isHeavy) continue;
    await setDeviceValue(key, value);
    try { localStorage.setItem(key, DEVICE_STORE_REF); } catch { localStorage.removeItem(key); }
    migrated += 1;
  }
  if (migrated > 0) scheduleDeviceBackup();
  return migrated;
}

export function removeFromStorage(key: string): void {
  localStorage.removeItem(STORAGE_PREFIX + key);
  void removeDeviceValue(STORAGE_PREFIX + key).catch(() => undefined);
  scheduleDeviceBackup();
  notifyStorageUpdate(key);
}

// --- IndexedDB for images ---
const DB_NAME = "csgo_hub_images";
const DB_VERSION = 1;
const STORE_NAME = "images";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveImage(id: string, dataUrl: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put({ id, dataUrl });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadImage(id: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get(id);
    req.onsuccess = () => resolve(req.result?.dataUrl || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteImage(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllImages(): Promise<{ id: string; dataUrl: string }[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}
