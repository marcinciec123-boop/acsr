import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Newspaper, TrendingDown, TrendingUp, Sparkles, Trash2 } from "lucide-react";
import TeamLogo from "@/components/TeamLogo";
import { TeamLink } from "@/lib/profileNav";
import { cn } from "@/lib/utils";
import {
  buildWeeklyReport, deleteWeeklyReport, loadWeeklyReports, reportHighlights, saveWeeklyReport,
  WEEKLY_REPORT_EVENT, type WeeklyEntry,
} from "@/lib/weeklyRankingReport";
import { getWorldNow } from "@/lib/worldClock";

const COLLAPSE_KEY = "weekly_report_collapsed";
const fmt = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
};
const lastMondayIso = () => {
  const d = getWorldNow();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const Row = ({ e, delta }: { e: WeeklyEntry; delta: number }) => (
  <div className="flex items-center gap-2 py-1 text-xs">
    <span className="w-7 text-right font-mono text-muted-foreground">#{e.rank}</span>
    <TeamLogo team={e.team} size="sm" />
    <TeamLink name={e.team} className="flex-1 truncate font-bold text-foreground hover:text-primary cursor-pointer" />
    <span className={cn("font-mono font-black", delta > 0 ? "text-success" : "text-destructive")}>
      {delta > 0 ? `+${delta}` : delta}
    </span>
  </div>
);

const WeeklyRankingReport = () => {
  const [reports, setReports] = useState(loadWeeklyReports);
  const [idx, setIdx] = useState(0);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; } });

  useEffect(() => {
    const sync = () => { setReports(loadWeeklyReports()); setIdx(0); };
    window.addEventListener(WEEKLY_REPORT_EVENT, sync);
    return () => window.removeEventListener(WEEKLY_REPORT_EVENT, sync);
  }, []);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
  };

  const report = reports[Math.min(idx, reports.length - 1)];
  const h = useMemo(() => (report ? reportHighlights(report) : null), [report]);

  const generateNow = () => {
    const monday = lastMondayIso();
    if (reports.some(r => r.date === monday) && !confirm(`Raport z ${fmt(monday)} już istnieje. Nadpisać aktualnym rankingiem?`)) return;
    saveWeeklyReport(buildWeeklyReport(monday));
  };

  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-card/80 overflow-hidden">
      <button onClick={toggle} className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-gradient-to-r from-primary/10 to-transparent text-left">
        <div className="flex items-center gap-2 min-w-0">
          <Newspaper className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-mono uppercase tracking-wider text-primary font-black shrink-0">Ranking Update</span>
          <span className="text-sm font-heading font-black text-foreground truncate">
            {report ? `ACSR World Ranking — ${fmt(report.date)}` : "Brak raportów tygodniowych"}
          </span>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="p-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {reports.length > 0 && (
              <select
                value={idx}
                onChange={e => setIdx(Number(e.target.value))}
                className="h-8 px-2 rounded border border-border bg-background text-foreground font-mono"
              >
                {reports.map((r, i) => <option key={r.date} value={i}>Tydzień do {fmt(r.date)}</option>)}
              </select>
            )}
            <button onClick={generateNow} className="h-8 px-3 rounded border border-primary/40 bg-primary/10 text-primary font-mono font-bold hover:bg-primary/20">
              Wygeneruj raport teraz
            </button>
            {report && (
              <button
                onClick={() => { if (confirm(`Usunąć raport z ${fmt(report.date)}?`)) deleteWeeklyReport(report.date); }}
                className="h-8 w-8 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-destructive"
                title="Usuń raport"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            {report && <span className="text-muted-foreground font-mono ml-auto">porównanie z {fmt(report.compareDate)}</span>}
          </div>

          {!report || !h ? (
            <p className="text-xs text-muted-foreground">
              Raport pojawi się automatycznie przy przejściu zegara gry z niedzieli na poniedziałek.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1 text-xs font-mono uppercase font-black text-success">
                  <TrendingUp className="w-3.5 h-3.5" /> Największe awanse
                </div>
                {h.risers.length ? h.risers.map(e => <Row key={e.team} e={e} delta={e.delta} />)
                  : <p className="text-xs text-muted-foreground">Brak awansów.</p>}
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1 text-xs font-mono uppercase font-black text-destructive">
                  <TrendingDown className="w-3.5 h-3.5" /> Największe spadki
                </div>
                {h.fallers.length ? h.fallers.map(e => <Row key={e.team} e={e} delta={e.delta} />)
                  : <p className="text-xs text-muted-foreground">Brak spadków.</p>}
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1 text-xs font-mono uppercase font-black text-primary">
                  <Sparkles className="w-3.5 h-3.5" /> Nowi w czołówce
                </div>
                {([["Top 10", h.top10], ["Top 20", h.top20], ["Top 30", h.top30]] as const).map(([label, list]) => (
                  list.length > 0 && (
                    <div key={label} className="mb-1">
                      <div className="text-2xs font-mono uppercase text-muted-foreground">{label}</div>
                      {list.map(e => (
                        <div key={e.team} className="flex items-center gap-2 py-0.5 text-xs">
                          <span className="w-7 text-right font-mono text-muted-foreground">#{e.rank}</span>
                          <TeamLogo team={e.team} size="sm" />
                          <TeamLink name={e.team} className="flex-1 truncate font-bold text-foreground hover:text-primary cursor-pointer" />
                          <span className="font-mono text-muted-foreground">{e.prevRank ? `z #${e.prevRank}` : "nowa"}</span>
                        </div>
                      ))}
                    </div>
                  )
                ))}
                {!h.top10.length && !h.top20.length && !h.top30.length && <p className="text-xs text-muted-foreground">Bez debiutów.</p>}
              </div>
            </div>
          )}

          {report && (
            <details className="text-xs">
              <summary className="cursor-pointer font-mono text-muted-foreground hover:text-foreground">Pełne Top 30 tygodnia</summary>
              <div className="mt-2 grid sm:grid-cols-2 gap-x-6">
                {report.entries.slice(0, 30).map(e => {
                  const d = e.prevRank === null ? null : e.prevRank - e.rank;
                  return (
                    <div key={e.team} className="flex items-center gap-2 py-0.5">
                      <span className="w-7 text-right font-mono text-muted-foreground">#{e.rank}</span>
                      <TeamLogo team={e.team} size="sm" />
                      <TeamLink name={e.team} className="flex-1 truncate text-foreground hover:text-primary cursor-pointer" />
                      <span className="font-mono text-muted-foreground">{e.points}</span>
                      <span className={cn("w-8 text-right font-mono", d === null ? "text-primary" : d > 0 ? "text-success" : d < 0 ? "text-destructive" : "text-muted-foreground")}>
                        {d === null ? "new" : d > 0 ? `+${d}` : d < 0 ? d : "–"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
};

export default WeeklyRankingReport;
