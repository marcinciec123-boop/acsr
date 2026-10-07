// Strażnik rekordów: po każdym zapisanym wyniku meczu / zakończeniu turnieju
// przelicza Księgę Rekordów, porównuje liderów z poprzednim stanem i ogłasza
// pobite rekordy. Panel rekordów nasłuchuje "records:update".
import { toast } from "sonner";
import { computeRecordBook, type RecordDef } from "./recordBook";
import { loadStatsTournaments } from "./statsPortal";

const LS_KEY = "csgo_hub_record_leaders_v1";
const BROKEN_KEY = "csgo_hub_record_broken_v1";
const NEW_FOR_MS = 3 * 24 * 60 * 60 * 1000; // oznaczenie „NOWY” przez 3 dni (realne)

type Leaders = Record<string, string>;
const sig = (r: RecordDef) => {
  const e = r.entries[0];
  return `${e.player || e.team || e.context || ""}|${e.value}|${e.matchId || ""}`;
};

const readJson = <T,>(k: string, fb: T): T => {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb; } catch { return fb; }
};

export function getRecentlyBroken(): Set<string> {
  const map = readJson<Record<string, number>>(BROKEN_KEY, {});
  const now = Date.now();
  return new Set(Object.entries(map).filter(([, t]) => now - t < NEW_FOR_MS).map(([id]) => id));
}

// Tani odcisk palca rozstrzygniętych wyników. Pełne przeliczenie Księgi
// Rekordów (~70 kategorii) uruchamiamy tylko, gdy zmienił się wynik meczu
// albo status zatwierdzenia — wpisywanie statystyk graczy nie zmienia
// odcisku, więc nie powoduje ścinek.
let lastFingerprint: string | null = null;
function resultsFingerprint(): string {
  const parts: string[] = [];
  for (const t of loadStatsTournaments()) {
    const ms = [
      ...(t.phases || []).flatMap(p => [...(p.bracket || []), ...((p.groups || []).flatMap(g => g.matches || []))]),
      ...(t.matches || []),
    ];
    for (const m of ms) {
      if ((m.score1 || 0) + (m.score2 || 0) > 0 || m.resultConfirmed) {
        parts.push(`${m.id}:${m.score1}:${m.score2}:${m.resultConfirmed ? 1 : 0}`);
      }
    }
  }
  return parts.join("|");
}

function check(): void {
  let fp: string;
  try { fp = resultsFingerprint(); } catch (e) { console.error("Record fingerprint failed:", e); return; }
  if (fp === lastFingerprint) return;
  lastFingerprint = fp;

  let records: RecordDef[];
  try { records = computeRecordBook(); } catch (e) { console.error("Record check failed:", e); return; }
  const prev = readJson<Leaders | null>(LS_KEY, null);
  const next: Leaders = {};
  records.forEach(r => { next[r.id] = sig(r); });

  if (prev) {
    const broken = records.filter(r => prev[r.id] !== undefined && prev[r.id] !== next[r.id]);
    const fresh = records.filter(r => prev[r.id] === undefined);
    const changed = [...broken, ...fresh];
    if (changed.length) {
      const map = readJson<Record<string, number>>(BROKEN_KEY, {});
      const now = Date.now();
      changed.forEach(r => { map[r.id] = now; });
      try { localStorage.setItem(BROKEN_KEY, JSON.stringify(map)); } catch { /* ignore */ }
      broken.slice(0, 3).forEach(r => {
        const e = r.entries[0];
        toast.success(`Nowy rekord: ${r.title}`, {
          description: `${e.player || e.team || e.context || ""} — ${e.display}`,
        });
      });
      if (broken.length > 3) toast.success(`…i ${broken.length - 3} kolejnych pobitych rekordów`);
    }
  }
  try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent("records:update"));
}

let timer: ReturnType<typeof setTimeout> | null = null;
const schedule = () => {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; check(); }, 700);
};

let installed = false;
export function installRecordWatcher(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  ["tournaments:update", "teams:update", "ranking:update", "season:reset", "storage"].forEach(ev =>
    window.addEventListener(ev, schedule),
  );
  schedule();
}
