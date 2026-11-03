// Zapis na dysku w wersji .exe (Tauri). Każdy klucz to osobny plik w AppData,
// zapisywany atomowo po stronie Rust. Zapisy są łączone (debounce), więc seria
// kliknięć nie przepisuje dużych plików wielokrotnie.

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

const getInvoke = (): Invoke | null => {
  if (typeof window === "undefined") return null;
  const internals = (window as unknown as { __TAURI_INTERNALS__?: { invoke?: Invoke } }).__TAURI_INTERNALS__;
  return internals?.invoke ?? null;
};

export const isDiskStoreAvailable = (): boolean => getInvoke() !== null;

export const WRITE_DEBOUNCE_MS = 400;

/** Łączy wiele zapisów tego samego klucza w jeden; usunięcie anuluje zapis. */
export function createWriteQueue(
  write: (key: string, value: string) => Promise<void>,
  remove: (key: string) => Promise<void>,
  delay = WRITE_DEBOUNCE_MS,
) {
  const pending = new Map<string, string | null>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = async () => {
    if (timer) { clearTimeout(timer); timer = null; }
    const batch = [...pending.entries()];
    pending.clear();
    await Promise.all(batch.map(([key, value]) => (value === null ? remove(key) : write(key, value))
      .catch(error => console.error("Disk save failed:", key, error))));
  };

  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { void flush(); }, delay);
  };

  return {
    set(key: string, value: string) { pending.set(key, value); schedule(); },
    delete(key: string) { pending.set(key, null); schedule(); },
    flush,
    size: () => pending.size,
  };
}

let queue: ReturnType<typeof createWriteQueue> | null = null;

const diskQueue = () => {
  if (queue) return queue;
  const invoke = getInvoke();
  if (!invoke) throw new Error("Disk store unavailable");
  queue = createWriteQueue(
    (key, value) => invoke<void>("store_write", { key, value }),
    key => invoke<void>("store_remove", { key }),
  );
  window.addEventListener("beforeunload", () => { void queue?.flush(); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) void queue?.flush(); });
  return queue;
};

export const diskLoadAll = async (): Promise<Record<string, string>> => {
  const invoke = getInvoke();
  if (!invoke) return {};
  return invoke<Record<string, string>>("store_load_all");
};

export const diskSet = (key: string, value: string) => diskQueue().set(key, value);
export const diskDelete = (key: string) => diskQueue().delete(key);
export const diskFlush = () => (queue ? queue.flush() : Promise.resolve());
