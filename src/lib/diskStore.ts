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

// ===== Archiwum sezonów =====
// Lista turniejów jest na dysku dzielona na osobne pliki per rok (+ mały plik
// z kolejnością). Zmiana bieżącego turnieju przepisuje tylko plik bieżącego
// roku — zakończone sezony zostają nietknięte. Aplikacja widzi to dalej jako
// jedną listę, więc nic w historii się nie zmienia.
export const SHARDED_KEYS = new Set(["csgo_hub_tournaments_data"]);
const SHARD_SEP = "@";
const ORDER = "order";

type Row = { id?: string; startDate?: string };
const yearOf = (t: Row) => (/^\d{4}/.test(t.startDate || "") ? (t.startDate as string).slice(0, 4) : "undated");

export function shardList(json: string): Record<string, string> | null {
  let list: unknown;
  try { list = JSON.parse(json); } catch { return null; }
  if (!Array.isArray(list) || list.some(t => !t || typeof t !== "object" || typeof (t as Row).id !== "string")) return null;
  const groups: Record<string, unknown[]> = {};
  for (const t of list as Row[]) (groups[yearOf(t)] ||= []).push(t);
  const out: Record<string, string> = { [ORDER]: JSON.stringify((list as Row[]).map(t => t.id)) };
  for (const [year, rows] of Object.entries(groups)) out[year] = JSON.stringify(rows);
  return out;
}

export function joinShards(parts: Record<string, string>): string | null {
  if (!parts[ORDER]) return null;
  const order: string[] = JSON.parse(parts[ORDER]);
  const byId = new Map<string, unknown>();
  for (const [suffix, raw] of Object.entries(parts)) {
    if (suffix === ORDER) continue;
    for (const t of JSON.parse(raw) as Row[]) byId.set(t.id as string, t);
  }
  return JSON.stringify(order.map(id => byId.get(id)).filter(Boolean));
}

const lastShards = new Map<string, Record<string, string>>();

export const diskLoadAll = async (): Promise<Record<string, string>> => {
  const invoke = getInvoke();
  if (!invoke) return {};
  const raw = await invoke<Record<string, string>>("store_load_all");
  const out: Record<string, string> = {};
  const shards = new Map<string, Record<string, string>>();
  for (const [key, value] of Object.entries(raw)) {
    const at = key.indexOf(SHARD_SEP);
    const base = at >= 0 ? key.slice(0, at) : key;
    if (at >= 0 && SHARDED_KEYS.has(base)) {
      const group = shards.get(base) || {};
      group[key.slice(at + 1)] = value;
      shards.set(base, group);
    } else out[key] = value;
  }
  for (const [base, parts] of shards) {
    try {
      const joined = joinShards(parts);
      if (joined) { out[base] = joined; lastShards.set(base, parts); }
    } catch (error) { console.error("Archive shard read failed:", base, error); }
  }
  return out;
};

export const diskSet = (key: string, value: string) => {
  const q = diskQueue();
  const shards = SHARDED_KEYS.has(key) ? shardList(value) : null;
  if (!shards) { q.set(key, value); return; }
  const prev = lastShards.get(key) || {};
  for (const [suffix, part] of Object.entries(shards)) {
    if (prev[suffix] !== part) q.set(`${key}${SHARD_SEP}${suffix}`, part);
  }
  for (const suffix of Object.keys(prev)) if (!(suffix in shards)) q.delete(`${key}${SHARD_SEP}${suffix}`);
  q.delete(key); // stary, niepodzielony plik z pierwszej migracji
  lastShards.set(key, shards);
};
export const diskDelete = (key: string) => {
  const q = diskQueue();
  for (const suffix of Object.keys(lastShards.get(key) || {})) q.delete(`${key}${SHARD_SEP}${suffix}`);
  lastShards.delete(key);
  q.delete(key);
};
export const diskFlush = () => (queue ? queue.flush() : Promise.resolve());
