import {
  createLru, diskDelete, diskFlush, diskLoadAll, diskSet, isDiskStoreAvailable, isMediaKey,
  mediaLoadAll, mediaRead, mediaRemove, mediaWrite,
} from "./diskStore";

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
// Wersja .exe: grafiki leżą jako pliki w AppData/media i w RAM trzymamy tylko
// ostatnio wyświetlane (null = brak pliku).
const mediaCache = createLru<string | null>(150);
const onDiskMedia = (key: string) => isDiskStoreAvailable() && isMediaKey(key);

// Separate from the display LRU: pending/failed uploads must never be evicted.
const dirtyMedia = new Map<string, { value: string | null; operation: Promise<void> }>();
const persistMedia = (key: string, value: string | null): Promise<void> => {
  const previous = dirtyMedia.get(key);
  const operation = (previous?.operation ?? Promise.resolve()).catch(() => undefined).then(async () => {
    if (value === null) await mediaRemove(key); else await mediaWrite(key, value);
  });
  const entry = { value, operation };
  dirtyMedia.set(key, entry);
  void operation.then(() => {
    if (dirtyMedia.get(key) === entry) dirtyMedia.delete(key);
  }, () => { /* Keep failed values available for retry. */ });
  return operation;
};

export const flushDeviceWrites = async (): Promise<void> => {
  // Retry retained failures as well as wait for uploads still in flight.
  while (dirtyMedia.size) {
    await Promise.all([...dirtyMedia].map(async ([key, entry]) => {
      try { await entry.operation; } catch { await persistMedia(key, entry.value); }
    }));
  }
  await diskFlush();
};

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
  if (onDiskMedia(key)) {
    mediaCache.set(key, value);
    await persistMedia(key, value);
    return;
  }
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
  if (onDiskMedia(key)) {
    const dirty = dirtyMedia.get(key);
    if (dirty) return dirty.value;
    const hit = mediaCache.get(key);
    if (hit !== undefined) return hit;
    const value = await mediaRead(key);
    mediaCache.set(key, value);
    return value;
  }
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
  if (onDiskMedia(key)) {
    mediaCache.set(key, null);
    await persistMedia(key, null);
    try { await removeBrowserValue(key); } catch { /* ignore */ }
    return;
  }
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

const removeBrowserValue = async (key: string): Promise<void> => {
  const db = await openDeviceStore();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DEVICE_STORE_NAME, "readwrite");
    const req = tx.objectStore(DEVICE_STORE_NAME).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

/** Wszystkie wartości łącznie z grafikami z dysku — dla kopii zapasowych i resetu. */
export const getAllDeviceValuesWithMedia = async (): Promise<Record<string, string>> => {
  await flushDeviceWrites();
  const base = deviceStoreCache ?? await getAllDeviceValues();
  if (!isDiskStoreAvailable()) return base;
  return { ...base, ...(await mediaLoadAll()) };
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
    const firstRun = Object.keys(disk).length === 0;
    if (firstRun) {
      for (const [key, value] of Object.entries(browserValues)) if (!isMediaKey(key)) diskSet(key, value);
    }
    // Grafiki: jednorazowe przeniesienie do plików w AppData/media (z pamięci
    // przeglądarki lub ze starszego zapisu w folderze save). Po udanym zapisie
    // pliku kopia w przeglądarce jest usuwana, żeby nie trzymać zdjęć podwójnie.
    const media = Object.entries({ ...browserValues, ...disk }).filter(([key]) => isMediaKey(key));
    for (const [key, value] of media) {
      try {
        if (value && value !== DEVICE_STORE_REF) await mediaWrite(key, value);
        if (key in disk) diskDelete(key);
        if (key in browserValues) await removeBrowserValue(key);
      } catch (error) { console.error("Media migration failed:", key, error); }
    }
    const merged = firstRun ? browserValues : { ...browserValues, ...disk };
    deviceStoreCache = Object.fromEntries(Object.entries(merged).filter(([key]) => !isMediaKey(key)));
  } catch (error) {
    console.error("Disk store load failed, using browser storage:", error);
    deviceStoreCache = browserValues;
  }
};

export const getCachedDeviceValue = (key: string): string | null => (
  onDiskMedia(key) ? (mediaCache.get(key) ?? null) :
  deviceStoreCache && key in deviceStoreCache ? deviceStoreCache[key] : null
);

export const getAllCachedDeviceValues = (): Record<string, string> | null => deviceStoreCache;