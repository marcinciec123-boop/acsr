import { diskDelete, diskLoadAll, diskSet, isDiskStoreAvailable } from "./diskStore";

const DEVICE_STORE_DB = "csgo_hub_device_store";
const DEVICE_STORE_VERSION = 1;
const DEVICE_STORE_NAME = "kv";

export const DEVICE_STORE_REF = "__CSGO_HUB_DEVICE_STORE__";

interface DeviceStoreRecord {
  key: string;
  value: string;
  updatedAt: number;
}

let deviceStoreCache: Record<string, string> | null = null;

const isBrowser = () => typeof window !== "undefined" && typeof indexedDB !== "undefined";

const openDeviceStore = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (!isBrowser()) return reject(new Error("Brak dostępu do pamięci urządzenia"));
  const request = indexedDB.open(DEVICE_STORE_DB, DEVICE_STORE_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(DEVICE_STORE_NAME)) {
      db.createObjectStore(DEVICE_STORE_NAME, { keyPath: "key" });
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

export const setDeviceValue = async (key: string, value: string): Promise<void> => {
  deviceStoreCache = { ...(deviceStoreCache || {}), [key]: value };
  if (isDiskStoreAvailable()) diskSet(key, value);
  const db = await openDeviceStore();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DEVICE_STORE_NAME, "readwrite");
    const req = tx.objectStore(DEVICE_STORE_NAME).put({ key, value, updatedAt: Date.now() } satisfies DeviceStoreRecord);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const getDeviceValue = async (key: string): Promise<string | null> => {
  if (deviceStoreCache && key in deviceStoreCache) return deviceStoreCache[key];
  const db = await openDeviceStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEVICE_STORE_NAME, "readonly");
    const req = tx.objectStore(DEVICE_STORE_NAME).get(key);
    req.onsuccess = () => resolve((req.result as DeviceStoreRecord | undefined)?.value ?? null);
    req.onerror = () => reject(req.error);
  });
};

export const removeDeviceValue = async (key: string): Promise<void> => {
  if (deviceStoreCache) {
    const next = { ...deviceStoreCache };
    delete next[key];
    deviceStoreCache = next;
  }
  if (isDiskStoreAvailable()) diskDelete(key);
  const db = await openDeviceStore();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DEVICE_STORE_NAME, "readwrite");
    const req = tx.objectStore(DEVICE_STORE_NAME).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const getAllDeviceValues = async (): Promise<Record<string, string>> => {
  const db = await openDeviceStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEVICE_STORE_NAME, "readonly");
    const req = tx.objectStore(DEVICE_STORE_NAME).getAll();
    req.onsuccess = () => {
      const rows = (req.result || []) as DeviceStoreRecord[];
      resolve(Object.fromEntries(rows.map(row => [row.key, row.value])));
    };
    req.onerror = () => reject(req.error);
  });
};

export const initializeDeviceStoreCache = async (): Promise<void> => {
  let browserValues: Record<string, string> = {};
  try {
    browserValues = await getAllDeviceValues();
  } catch {
    browserValues = {};
  }
  if (!isDiskStoreAvailable()) { deviceStoreCache = browserValues; return; }
  // Wersja .exe: pliki na dysku są źródłem prawdy. Przy pierwszym starcie
  // (pusty folder) dane z pamięci przeglądarki są jednorazowo kopiowane na
  // dysk; kopia w przeglądarce zostaje nienaruszona jako zabezpieczenie.
  try {
    const disk = await diskLoadAll();
    if (Object.keys(disk).length === 0) {
      for (const [key, value] of Object.entries(browserValues)) diskSet(key, value);
      deviceStoreCache = browserValues;
    } else {
      deviceStoreCache = { ...browserValues, ...disk };
    }
  } catch (error) {
    console.error("Disk store load failed, using browser storage:", error);
    deviceStoreCache = browserValues;
  }
};

export const getCachedDeviceValue = (key: string): string | null => (
  deviceStoreCache && key in deviceStoreCache ? deviceStoreCache[key] : null
);

export const getAllCachedDeviceValues = (): Record<string, string> | null => deviceStoreCache;