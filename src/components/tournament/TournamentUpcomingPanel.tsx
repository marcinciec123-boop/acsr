// ===== Nadchodzące mecze w turnieju + masowa edycja terminów =====
// Lists every unplayed match (both teams known) across all phases/groups.
// Clicking a row opens the match; clicking a team name opens the team profile.
// "Masowa edycja" assigns date/time to many matches at once from one form.

import { useMemo, useState } from "react";
import { CalendarClock, ChevronRight, ListChecks, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MatchResult, TournamentData } from "@/lib/types";
import { isPlaceholder } from "@/lib/teamHelpers";
import TeamLogo from "@/components/TeamLogo";
import { TeamLink } from "@/lib/profileNav";
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
  onOpenMatch: (phaseId: string, matchId: string, groupId?: string) => void;
}

const isUnplayed = (m: MatchResult) => (m.score1 || 0) + (m.score2 || 0) === 0 && !m.resultConfirmed;

const addMinutes = (iso: string, minutes: number) => {
  const d = new Date(`${iso}:00`);
  d.setMinutes(d.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const TournamentUpcomingPanel = ({ tournament: t, onUpdateMatch, onOpenMatch }: Props) => {
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    t.phases.forEach(p => {
      (p.bracket || []).forEach(m => {
        if (isUnplayed(m) && !isPlaceholder(m.team1) && !isPlaceholder(m.team2)) {
          out.push({ phaseId: p.id, phaseName: p.name, match: m });
        }
      });
      (p.groups || []).forEach(g => {
        g.matches.forEach(m => {
          if (isUnplayed(m) && !isPlaceholder(m.team1) && !isPlaceholder(m.team2)) {
            out.push({ phaseId: p.id, phaseName: p.name, groupId: g.id, groupName: g.name, match: m });
          }
        });
      });
    });
    return out.sort((a, b) => {
      const sa = a.match.scheduledAt, sb = b.match.scheduledAt;
      if (sa && sb) return sa.localeCompare(sb);
      if (sa) return -1;
      if (sb) return 1;
      return 0;
    });
  }, [t]);

  const [bulk, setBulk] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(() => getWorldDate());
  const [time, setTime] = useState("18:00");
  const [gap, setGap] = useState(90);
  const [collapsed, setCollapsed] = usePersistedState<boolean>(`tour_upcoming_collapsed_${t.id}`, false);

  if (rows.length === 0) return null;

  const key = (r: Row) => `${r.phaseId}:${r.groupId || "-"}:${r.match.id}`;
  const toggle = (k: string) =>
    setSelected(s => (s.includes(k) ? s.filter(x => x !== k) : [...s, k]));

  const applyBulk = () => {
    const chosen = rows.filter(r => selected.includes(key(r)));
    if (chosen.length === 0) return;
    let cursor = `${date}T${time || "18:00"}`;
    chosen.forEach((r, i) => {
      const at = i === 0 ? cursor : (cursor = addMinutes(cursor, gap || 0));
      onUpdateMatch(r.phaseId, r.match.id, { scheduledAt: at }, r.groupId);
    });
    setSelected([]);
    setBulk(false);
  };

  const clearBulk = () => {
    rows.filter(r => selected.includes(key(r)))
      .forEach(r => onUpdateMatch(r.phaseId, r.match.id, { scheduledAt: undefined }, r.groupId));
    setSelected([]);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs font-heading font-bold uppercase text-primary tracking-wider flex items-center gap-2"
        >
          <CalendarClock className="w-3.5 h-3.5" />
          Nadchodzące mecze ({rows.length})
          <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", !collapsed && "rotate-90")} />
        </button>
        <Button
          size="sm"
          variant={bulk ? "default" : "outline"}
          className="h-7 text-xs font-mono"
          onClick={() => { setBulk(v => !v); setSelected([]); }}
        >
          <ListChecks className="w-3.5 h-3.5 mr-1" /> {bulk ? "Anuluj" : "Masowa edycja terminów"}
        </Button>
      </div>

      {bulk && (
        <div className="mb-3 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
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
          <div className="flex gap-2">
            <button type="button" className="text-xs font-mono text-primary hover:underline" onClick={() => setSelected(rows.map(key))}>
              Zaznacz wszystkie
            </button>
            <button type="button" className="text-xs font-mono text-muted-foreground hover:underline" onClick={() => setSelected([])}>
              Odznacz
            </button>
            <span className="text-xs font-mono text-muted-foreground">
              Odstęp 0 = wszystkie mecze o tej samej godzinie
            </span>
          </div>
        </div>
      )}

      {!collapsed && (
        <div className="space-y-1">
          {rows.map(r => {
            const k = key(r);
            const m = r.match;
            return (
              <div
                key={k}
                className={cn(
                  "flex items-center gap-2 rounded border border-border/40 bg-secondary/20 px-2 py-1.5 transition-colors hover:border-primary/50",
                  bulk && selected.includes(k) && "border-primary/70 bg-primary/10",
                )}
              >
                {bulk && (
                  <input
                    type="checkbox"
                    checked={selected.includes(k)}
                    onChange={() => toggle(k)}
                    className="accent-primary w-3.5 h-3.5 shrink-0"
                  />
                )}
                <span className="text-xs font-mono text-muted-foreground w-[124px] shrink-0 truncate">
                  {m.scheduledAt
                    ? `${m.scheduledAt.slice(0, 10)} ${m.scheduledAt.slice(11, 16)}`
                    : "termin —"}
                </span>
                <span className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                  <TeamLogo teamName={m.team1} size={18} rounded="md" />
                  <TeamLink name={m.team1} className="text-xs font-medium truncate" />
                </span>
                <span className="text-xs font-mono text-muted-foreground shrink-0">vs</span>
                <span className="flex items-center gap-1.5 min-w-0 flex-1">
                  <TeamLink name={m.team2} className="text-xs font-medium truncate" />
                  <TeamLogo teamName={m.team2} size={18} rounded="md" />
                </span>
                <span className="text-xs font-mono text-muted-foreground shrink-0 hidden sm:inline truncate max-w-[160px]">
                  {r.groupName || r.phaseName}{m.round ? ` • ${m.round}` : ""} • Bo{m.bo || 1}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenMatch(r.phaseId, m.id, r.groupId)}
                  className="text-xs font-mono text-primary hover:underline shrink-0 inline-flex items-center"
                  title="Otwórz mecz"
                >
                  Otwórz <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TournamentUpcomingPanel;
