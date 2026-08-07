// ===== Masowa edycja terminów (dyskretny panel) =====
// Osobny, domyślnie zwinięty panel do planowania terminów. W odróżnieniu od
// "Nadchodzących meczów" pokazuje TAKŻE mecze z dalszych faz, w których
// drużyny nie są jeszcze znane (TBD) — dzięki temu można zaplanować cały
// harmonogram turnieju z wyprzedzeniem.

import { useMemo, useState } from "react";
import { CalendarCog, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MatchResult, TournamentData } from "@/lib/types";
import { getWorldDate } from "@/lib/worldClock";
import { usePersistedState } from "@/lib/uiPrefs";

interface Row {
  phaseId: string;
  phaseName: string;
  groupId?: string;
  groupName?: string;
  match: MatchResult;
}

interface Props {
  tournament: TournamentData;
  onUpdateMatch: (phaseId: string, matchId: string, patch: Partial<MatchResult>, groupId?: string) => void;
}

const isUnplayed = (m: MatchResult) => (m.score1 || 0) + (m.score2 || 0) === 0 && !m.resultConfirmed;

const addMinutes = (iso: string, minutes: number) => {
  const d = new Date(`${iso}:00`);
  d.setMinutes(d.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const label = (name?: string) => (!name || name === "TBD" ? "TBD" : name);

export const ScheduleBulkPanel = ({ tournament: t, onUpdateMatch }: Props) => {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    t.phases.forEach(p => {
      (p.bracket || []).forEach(m => {
        if (isUnplayed(m) && m.team1 !== "BYE" && m.team2 !== "BYE") {
          out.push({ phaseId: p.id, phaseName: p.name, match: m });
        }
      });
      (p.groups || []).forEach(g => {
        g.matches.forEach(m => {
          if (isUnplayed(m) && m.team1 !== "BYE" && m.team2 !== "BYE") {
            out.push({ phaseId: p.id, phaseName: p.name, groupId: g.id, groupName: g.name, match: m });
          }
        });
      });
    });
    return out;
  }, [t]);

  const [open, setOpen] = usePersistedState<boolean>(`tour_schedule_bulk_open_${t.id}`, false);
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(() => getWorldDate());
  const [time, setTime] = useState("18:00");
  const [gap, setGap] = useState(90);

  if (rows.length === 0) return null;

  const key = (r: Row) => `${r.phaseId}:${r.groupId || "-"}:${r.match.id}`;
  const toggle = (k: string) => setSelected(s => (s.includes(k) ? s.filter(x => x !== k) : [...s, k]));

  const applyBulk = () => {
    // Zachowujemy kolejność zaznaczania użytkownika (a nie kolejność na liście).
    const chosen = selected
      .map(k => rows.find(r => key(r) === k))
      .filter((r): r is Row => !!r);
    if (chosen.length === 0) return;
    let cursor = `${date}T${time || "18:00"}`;
    chosen.forEach((r, i) => {
      const at = i === 0 ? cursor : (cursor = addMinutes(cursor, gap || 0));
      onUpdateMatch(r.phaseId, r.match.id, { scheduledAt: at }, r.groupId);
    });
    setSelected([]);
  };

  const clearBulk = () => {
    rows.filter(r => selected.includes(key(r)))
      .forEach(r => onUpdateMatch(r.phaseId, r.match.id, { scheduledAt: undefined }, r.groupId));
    setSelected([]);
  };

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs font-mono text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 transition-colors"
      >
        <CalendarCog className="w-3.5 h-3.5" />
        Masowa edycja terminów ({rows.length})
        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-90")} />
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-border/60 bg-secondary/10 p-3 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-mono text-muted-foreground">
              Data startu
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-8 mt-1 text-xs font-mono w-[150px]" />
            </label>
            <label className="text-xs font-mono text-muted-foreground">
              Godzina
              <Input type="time" value={time} onChange={e => setTime(e.target.value)} className="h-8 mt-1 text-xs font-mono w-[110px]" />
            </label>
            <label className="text-xs font-mono text-muted-foreground">
              Odstęp (min)
              <Input
                type="number" min={0} step={15} value={gap === 0 ? "0" : gap || ""}
                onChange={e => setGap(e.target.value === "" ? 0 : parseInt(e.target.value, 10) || 0)}
                className="h-8 mt-1 text-xs font-mono w-[100px]"
              />
            </label>
            <Button size="sm" className="h-8 text-xs font-mono" onClick={applyBulk} disabled={selected.length === 0}>
              Ustaw ({selected.length})
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs font-mono" onClick={clearBulk} disabled={selected.length === 0}>
              <X className="w-3 h-3 mr-1" /> Wyczyść termin
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="text-xs font-mono text-primary hover:underline" onClick={() => setSelected(rows.map(key))}>
              Zaznacz wszystkie
            </button>
            <button type="button" className="text-xs font-mono text-muted-foreground hover:underline" onClick={() => setSelected([])}>
              Odznacz
            </button>
            <span className="text-xs font-mono text-muted-foreground">
              Odstęp 0 = wszystkie mecze o tej samej godzinie · dostępne też mecze z dalszych faz (TBD)
            </span>
          </div>

          <div className="max-h-[320px] overflow-y-auto space-y-1 pr-1">
            {rows.map(r => {
              const k = key(r);
              const m = r.match;
              return (
                <label
                  key={k}
                  className={cn(
                    "flex items-center gap-2 rounded border border-border/40 bg-card/50 px-2 py-1.5 cursor-pointer transition-colors hover:border-primary/40",
                    selected.includes(k) && "border-primary/60 bg-primary/10",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(k)}
                    onChange={() => toggle(k)}
                    className="accent-primary w-3.5 h-3.5 shrink-0"
                  />
                  <span className="text-xs font-mono text-muted-foreground w-[124px] shrink-0 truncate">
                    {m.scheduledAt
                      ? `${m.scheduledAt.slice(0, 10)} ${m.scheduledAt.slice(11, 16)}`
                      : "termin —"}
                  </span>
                  <span className="text-xs font-medium truncate flex-1 text-right">{label(m.team1)}</span>
                  <span className="text-xs font-mono text-muted-foreground shrink-0">vs</span>
                  <span className="text-xs font-medium truncate flex-1">{label(m.team2)}</span>
                  <span className="text-xs font-mono text-muted-foreground shrink-0 hidden sm:inline truncate max-w-[190px]">
                    {r.groupName || r.phaseName}{m.round ? ` • ${m.round}` : ""} • Bo{m.bo || 1}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleBulkPanel;
