import { isMatchDecided } from "@/lib/matchStatus";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Plus, Calendar, MapPin, DollarSign, Users as UsersIcon,
  Radio, Clock, CheckCircle2, ChevronRight, Filter, Layers, ChevronDown,
  CalendarDays, LayoutGrid, List, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TournamentData } from "@/lib/types";
import TeamLogo from "@/components/TeamLogo";
import TournamentLogo from "@/components/TournamentLogo";
import { getTeamFlag, isPlaceholder } from "@/lib/teamHelpers";
import { getWorldNow, useWorldDate } from "@/lib/worldClock";
import { usePersistedState } from "@/lib/uiPrefs";

interface Props {
  tournaments: TournamentData[];
  onSelect: (id: string) => void;
  onCreate: () => void;
  onCreateWorlds?: () => void;
}

type StatusFilter = "ALL" | "live" | "upcoming" | "completed";
type TierFilter = "ALL" | "S" | "A" | "B" | "C";
type ViewMode = "month" | "year" | "list";
type FormatFilter = "ALL" | string;

const tierColor = (tier: string) => {
  switch (tier) {
    case "S": return "text-[hsl(var(--gold))] border-[hsl(var(--gold))]/50 bg-[hsl(var(--gold))]/10";
    case "A": return "text-primary border-primary/50 bg-primary/10";
    case "B": return "text-[hsl(var(--silver))] border-[hsl(var(--silver))]/50 bg-[hsl(var(--silver))]/10";
    default: return "text-muted-foreground border-border bg-secondary/50";
  }
};

const tierBarColor = (tier: string) => {
  switch (tier) {
    case "S": return "bg-gradient-to-r from-[hsl(var(--gold))] to-[hsl(var(--accent))]";
    case "A": return "bg-gradient-to-r from-primary to-[hsl(190_100%_45%)]";
    case "B": return "bg-gradient-to-r from-[hsl(var(--silver))] to-muted";
    default: return "bg-gradient-to-r from-muted to-secondary";
  }
};

const parseLocalDate = (d: string): Date | null => {
  if (!d) return null;
  const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const date = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toIsoLocal = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const formatDate = (d: string) => {
  if (!d) return "—";
  try {
    return (parseLocalDate(d) ?? new Date(d)).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  } catch { return d; }
};

const formatYear = (d: string) => {
  if (!d) return "";
  try {
    return (parseLocalDate(d) ?? new Date(d)).getFullYear().toString();
  } catch { return ""; }
};

const fullDate = (d: string) => {
  if (!d) return "—";
  try {
    return (parseLocalDate(d) ?? new Date(d)).toLocaleDateString("pl-PL", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
};

const monthKey = (d: string) => {
  if (!d) return "Bez daty";
  try {
    return (parseLocalDate(d) ?? new Date(d)).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
  } catch { return "Bez daty"; }
};

const dateRangeDays = (start: string, end: string): string[] => {
  if (!start) return [];
  const out: string[] = [];
  const s = parseLocalDate(start);
  const e = parseLocalDate(end || start);
  if (!s || !e) return [];
  const cur = new Date(s);
  if (Number.isNaN(cur.getTime())) return [];
  while (cur <= e) {
    out.push(toIsoLocal(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out.length ? out : [start];
};

const statusLabel = (status: TournamentData["status"]) =>
  status === "live" ? "Na żywo" : status === "upcoming" ? "Nadchodzący" : "Zakończony";

const statusDot = (status: TournamentData["status"]) =>
  status === "live" ? "bg-[hsl(var(--win))] animate-pulse" : status === "upcoming" ? "bg-primary" : "bg-muted-foreground";

const initialCalendarDate = (tournaments: TournamentData[]) => {
  const sorted = [...tournaments].filter(t => t.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const next = sorted.find(t => t.status !== "completed") || sorted[sorted.length - 1];
  const date = next ? parseLocalDate(next.startDate) ?? getWorldNow() : getWorldNow();
  return Number.isNaN(date.getTime()) ? getWorldNow() : date;
};

const TournamentCard = ({ t, onClick }: { t: TournamentData; onClick: () => void }) => {
  const totalMatches = t.phases.reduce((sum, p) =>
    sum + (p.bracket?.length || 0) + (p.groups?.reduce((s, g) => s + g.matches.length, 0) || 0), 0
  );
  const playedMatches = t.phases.reduce((sum, p) => {
    const b = (p.bracket || []).filter(m => isMatchDecided(m, p.bo)).length;
    const g = (p.groups || []).reduce((ss, gr) => ss + gr.matches.filter(m => isMatchDecided(m, p.bo)).length, 0);
    return sum + b + g;
  }, 0);
  const progress = totalMatches > 0 ? Math.round((playedMatches / totalMatches) * 100) : 0;

  // Find winner (last decided final-ish match) for completed
  let winner: string | null = null;
  if (t.status === "completed") {
    for (const phase of t.phases) {
      if (phase.bracket && phase.bracket.length > 0) {
        for (let i = phase.bracket.length - 1; i >= 0; i--) {
          const m = phase.bracket[i];
          if (isMatchDecided(m, phase.bo) && (m.round || "").toLowerCase().includes("final")) {
            winner = m.score1 > m.score2 ? m.team1 : m.team2;
            break;
          }
        }
      }
      if (winner) break;
    }
  }

  // Top 4 participants for preview
  const topTeams = t.participants.slice(0, 6).filter(p => !isPlaceholder(p));

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      whileHover={{ y: -2 }}
      onClick={onClick}
      className="group relative bg-card border border-border rounded-lg overflow-hidden text-left hover:border-primary/60 hover:shadow-[0_0_18px_hsl(var(--primary)/0.15)] transition-all"
    >
      {/* Tier accent bar */}
      <div className={cn("h-1 w-full", tierBarColor(t.tier))} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn("text-xs font-mono font-bold px-1.5 py-0.5 rounded border", tierColor(t.tier))}>
              {t.tier}-TIER
            </span>
            {t.kind === "qualifier" && (
              <span className="text-xs px-1.5 py-0.5 rounded border border-[hsl(var(--gold))]/40 bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] font-mono font-bold">
                QUAL
              </span>
            )}
            {t.status === "live" && (
              <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-[hsl(var(--win))]/50 bg-[hsl(var(--win))]/15 text-[hsl(var(--win))] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--win))] animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>

        {/* Title */}
        <div className="flex items-center gap-2 mb-0.5">
          <TournamentLogo id={t.id} name={t.name} size={28} />
          <h3 className="font-heading font-bold text-foreground text-base line-clamp-2 leading-tight">{t.name}</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3 truncate">
          {t.organizer || "—"} {formatYear(t.startDate) && `• ${formatYear(t.startDate)}`}
        </p>

        {/* Prize pool feature */}
        <div className="flex items-baseline gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-[hsl(var(--gold))] shrink-0" />
          <span className="text-lg font-heading font-bold text-[hsl(var(--gold))]">{t.prizePool}</span>
          <span className="text-xs font-mono text-muted-foreground ml-auto">
            {t.teams} drużyn
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs font-mono text-muted-foreground border-t border-border/40 pt-2 mb-3">
          <div className="flex items-center gap-1.5 truncate">
            <Calendar className="w-3 h-3 shrink-0" />
            <span className="truncate">{formatDate(t.startDate)} → {formatDate(t.endDate)}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3 h-3 shrink-0" />
            <span className="truncate">{t.location || "—"}</span>
          </div>
        </div>

        {/* Progress bar (for live) */}
        {t.status === "live" && totalMatches > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground mb-1">
              <span>Postęp</span>
              <span>{playedMatches}/{totalMatches} ({progress}%)</span>
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6 }}
                className="h-full bg-gradient-to-r from-[hsl(var(--win))] to-primary"
              />
            </div>
          </div>
        )}

        {/* Winner banner (for completed) */}
        {winner && (
          <div className="mb-3 px-2 py-1.5 rounded bg-[hsl(var(--gold))]/10 border border-[hsl(var(--gold))]/30 flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-[hsl(var(--gold))] shrink-0" />
            <span className="text-xs font-mono uppercase text-[hsl(var(--gold))] tracking-wider">Mistrz</span>
            <span className="text-xs font-heading font-bold text-foreground truncate ml-auto">
              {getTeamFlag(winner) && <span className="mr-1">{getTeamFlag(winner)}</span>}
              {winner}
            </span>
          </div>
        )}

        {/* Top participants preview */}
        {topTeams.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {topTeams.slice(0, 5).map(team => (
              <span
                key={team}
                className="text-xs font-mono px-1.5 py-0.5 rounded bg-secondary/50 border border-border/50 text-muted-foreground truncate max-w-[110px]"
                title={team}
              >
                {getTeamFlag(team) && <span className="mr-0.5">{getTeamFlag(team)}</span>}
                {team}
              </span>
            ))}
            {t.participants.length > 5 && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-secondary/30 text-muted-foreground">
                +{t.participants.length - 5}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.button>
  );
};

const FeaturedLiveCard = ({ t, onClick }: { t: TournamentData; onClick: () => void }) => {
  const totalMatches = t.phases.reduce((sum, p) =>
    sum + (p.bracket?.length || 0) + (p.groups?.reduce((s, g) => s + g.matches.length, 0) || 0), 0
  );
  const playedMatches = t.phases.reduce((sum, p) => {
    const b = (p.bracket || []).filter(m => isMatchDecided(m, p.bo)).length;
    const g = (p.groups || []).reduce((ss, gr) => ss + gr.matches.filter(m => isMatchDecided(m, p.bo)).length, 0);
    return sum + b + g;
  }, 0);
  const progress = totalMatches > 0 ? Math.round((playedMatches / totalMatches) * 100) : 0;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="relative w-full bg-gradient-to-br from-[hsl(var(--win))]/10 via-card to-card border border-[hsl(var(--win))]/40 rounded-xl overflow-hidden text-left hover:border-[hsl(var(--win))]/70 transition-all group"
    >
      <div className={cn("h-1 w-full", tierBarColor(t.tier))} />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-[hsl(var(--win))]/50 bg-[hsl(var(--win))]/15 text-[hsl(var(--win))] font-mono font-bold">
            <Radio className="w-3 h-3 animate-pulse" />
            NA ŻYWO
          </span>
          <span className={cn("text-xs font-mono font-bold px-2 py-1 rounded border", tierColor(t.tier))}>
            {t.tier}-TIER
          </span>
          <span className="text-xs px-2 py-1 rounded border border-border bg-secondary/40 font-mono text-muted-foreground">
            {t.location || "—"}
          </span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-1 group-hover:text-primary transition-colors flex items-center gap-3">
          <TournamentLogo id={t.id} name={t.name} size={40} />
          {t.name}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">{t.organizer}</p>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Pula</div>
            <div className="text-lg font-heading font-bold text-[hsl(var(--gold))]">{t.prizePool}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Drużyny</div>
            <div className="text-lg font-heading font-bold text-foreground">{t.teams}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Mecze</div>
            <div className="text-lg font-heading font-bold text-foreground">{playedMatches}/{totalMatches}</div>
          </div>
          <div className="hidden sm:block">
            <div className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">Daty</div>
            <div className="text-sm font-mono text-foreground">{formatDate(t.startDate)} → {formatDate(t.endDate)}</div>
          </div>
        </div>

        {totalMatches > 0 && (
          <div className="mb-4">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8 }}
                className="h-full bg-gradient-to-r from-[hsl(var(--win))] to-primary"
              />
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-1 text-right">
              {progress}% rozegrane
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-primary font-mono group-hover:translate-x-1 transition-transform">
          Otwórz panel turnieju <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    </motion.button>
  );
};

// --- Qualifier bundling -------------------------------------------------
const isQualifierName = (t: TournamentData) =>
  t.kind === "qualifier" || /elimination|qualifier|open\s*qual|closed\s*qual/i.test(t.name);

const qualifierBundleKey = (t: TournamentData) =>
  t.name.replace(/\s*[—-]\s*.*?(elimination|qualifier).*$/i, "").trim();

const regionLabel = (name: string) => {
  const m = name.match(/[—-]\s*([^—-]+?)(?:\s+Elimination|\s+Qualifier)?\s*$/i);
  return (m?.[1] || name).trim();
};

const QualifierBundleCard = ({
  bundleKey,
  tournaments,
  onSelect,
}: {
  bundleKey: string;
  tournaments: TournamentData[];
  onSelect: (id: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...tournaments].sort(
    (a, b) => (a.startDate || "").localeCompare(b.startDate || "")
  );
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const tier = first.tier;
  const completed = sorted.filter(t => t.status === "completed").length;
  const total = sorted.length;
  const live = sorted.some(t => t.status === "live");
  const totalTeams = sorted.reduce((s, t) => s + (t.teams || 0), 0);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-card border border-border rounded-lg overflow-hidden sm:col-span-2 lg:col-span-3",
        live && "border-[hsl(var(--win))]/50"
      )}
    >
      <div className={cn("h-1 w-full", tierBarColor(tier))} />
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full text-left p-4 hover:bg-muted/10 transition-colors"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn("text-xs font-mono font-bold px-1.5 py-0.5 rounded border", tierColor(tier))}>
              {tier}-TIER
            </span>
            <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-primary/40 bg-primary/10 text-primary font-mono font-bold">
              <Layers className="w-3 h-3" /> KWALIFIKACJE
            </span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">
              {total} {total === 1 ? "region" : "regiony"}
            </span>
            {live && (
              <span className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-[hsl(var(--win))]/50 bg-[hsl(var(--win))]/15 text-[hsl(var(--win))] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--win))] animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform shrink-0", expanded && "rotate-180")} />
        </div>

        <h3 className="font-heading font-bold text-foreground text-base mb-0.5 leading-tight">
          {bundleKey} — Kwalifikacje
        </h3>
        <p className="text-xs text-muted-foreground mb-3 truncate">
          {first.organizer || "—"}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-xs font-mono text-muted-foreground border-t border-border/40 pt-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            <span>{completed}/{total} rozegranych</span>
          </div>
          <div className="flex items-center gap-1.5">
            <UsersIcon className="w-3 h-3 shrink-0" />
            <span>{totalTeams} drużyn</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 shrink-0" />
            <span>Online</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 shrink-0" />
            <span>{formatDate(first.startDate)} → {formatDate(last.endDate)}</span>
          </div>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-border overflow-hidden"
          >
            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sorted.map(t => (
                <button
                  key={t.id}
                  onClick={() => onSelect(t.id)}
                  className="flex items-center justify-between gap-2 p-3 rounded-md border border-border bg-background/40 hover:border-primary/50 hover:bg-muted/20 transition-colors text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className={cn(
                        "text-xs font-mono px-1.5 py-0.5 rounded border",
                        t.status === "live" && "border-[hsl(var(--win))]/50 bg-[hsl(var(--win))]/15 text-[hsl(var(--win))]",
                        t.status === "upcoming" && "border-primary/40 bg-primary/10 text-primary",
                        t.status === "completed" && "border-[hsl(var(--win))]/30 bg-[hsl(var(--win))]/10 text-[hsl(var(--win))]",
                      )}>
                        {t.status === "live" ? "LIVE" : t.status === "upcoming" ? "SOON" : "DONE"}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground">{t.teams} dr.</span>
                    </div>
                    <div className="font-heading text-sm font-semibold text-foreground truncate">
                      {regionLabel(t.name)}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {formatDate(t.startDate)} → {formatDate(t.endDate)}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const CalendarEventButton = ({ t, onSelect, dense = false }: { t: TournamentData; onSelect: (id: string) => void; dense?: boolean }) => (
  <button
    type="button"
    onClick={() => onSelect(t.id)}
    className={cn(
      "w-full text-left rounded border transition-colors hover:border-primary/60 hover:bg-primary/10 min-w-0",
      dense ? "px-1.5 py-1" : "px-2 py-1.5",
      tierColor(t.tier),
    )}
    title={`${t.name} • ${fullDate(t.startDate)} → ${fullDate(t.endDate)}`}
  >
    <div className="flex items-center gap-1.5 min-w-0">
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusDot(t.status))} />
      <span className={cn("font-heading font-bold truncate", dense ? "text-xs" : "text-xs")}>{t.name}</span>
      {t.status === "completed" && (
        <span className="ml-auto shrink-0 text-xs font-mono text-[hsl(var(--win))]">wyniki</span>
      )}
    </div>
    {!dense && (
      <div className="mt-0.5 flex items-center gap-2 text-xs font-mono text-muted-foreground">
        <span>{t.tier}-Tier</span>
        <span>•</span>
        <span className="truncate">{t.format}</span>
      </div>
    )}
  </button>
);

const TournamentMonthCalendar = ({ tournaments, onSelect }: { tournaments: TournamentData[]; onSelect: (id: string) => void }) => {
  const initial = initialCalendarDate(tournaments);
  const [year, setYear] = usePersistedState("portal_cal_year", initial.getFullYear());
  const [month, setMonth] = usePersistedState("portal_cal_month", initial.getMonth());
  // Live fictional date — updates immediately when the world clock moves.
  const worldDate = useWorldDate();

  const dayIndex = useMemo(() => {
    const map: Record<string, TournamentData[]> = {};
    tournaments.forEach(t => {
      dateRangeDays(t.startDate, t.endDate).forEach(day => {
        (map[day] ??= []).push(t);
      });
    });
    Object.values(map).forEach(items => items.sort((a, b) => a.startDate.localeCompare(b.startDate)));
    return map;
  }, [tournaments]);

  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-border bg-secondary/40">
        <button
          type="button"
          onClick={() => {
            if (month === 0) { setMonth(11); setYear(v => v - 1); }
            else setMonth(v => v - 1);
          }}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
        <div className="text-center">
          <h3 className="font-heading font-black text-lg text-foreground capitalize">
            {first.toLocaleDateString("pl-PL", { month: "long", year: "numeric" })}
          </h3>
          <p className="text-xs font-mono text-muted-foreground">Kliknij turniej, żeby otworzyć panel i wyniki</p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (month === 11) { setMonth(0); setYear(v => v + 1); }
            else setMonth(v => v + 1);
          }}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-border/60 bg-background/40 text-xs sm:text-xs font-mono uppercase tracking-wider text-muted-foreground">
        {["Pon", "Wto", "Śro", "Czw", "Pią", "Sob", "Nie"].map(day => (
          <div key={day} className="text-center py-2">{day}</div>
        ))}
      </div>

      <div>
        {Array.from({ length: cells.length / 7 }).map((_, w) => {
          const week = cells.slice(w * 7, w * 7 + 7);
          const isos = week.map(d => (d ? toIsoLocal(d) : null));
          const seen = new Map<string, { t: TournamentData; s: number; e: number }>();
          isos.forEach((iso, i) => {
            if (!iso) return;
            (dayIndex[iso] || []).forEach(t => {
              const cur = seen.get(t.id);
              if (cur) cur.e = i; else seen.set(t.id, { t, s: i, e: i });
            });
          });
          const items = [...seen.values()].sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s));
          const laneEnds: number[] = [];
          const placed = items.map(it => {
            let lane = laneEnds.findIndex(end => end < it.s);
            if (lane === -1) { lane = laneEnds.length; laneEnds.push(it.e); } else laneEnds[lane] = it.e;
            return { ...it, lane };
          });
          return (
            <div key={w} className="relative grid grid-cols-7 auto-rows-min border-t border-border/30 min-h-24 sm:min-h-28">
              {week.map((day, i) => (
                <div
                  key={i}
                  style={{ gridColumn: i + 1, gridRow: `1 / span ${Math.max(2, laneEnds.length + 2)}` }}
                  className={cn("border-l border-border/30", !day && "bg-secondary/10", day && isos[i] === worldDate && "bg-primary/10")}
                />
              ))}
              {week.map((day, i) => day && (
                <span key={"n" + i} style={{ gridColumn: i + 1, gridRow: 1 }} className={cn("relative px-1.5 pt-1 text-xs font-mono", isos[i] === worldDate ? "text-primary font-black" : "text-muted-foreground")}>
                  {day.getDate()}
                </span>
              ))}
              {placed.map(({ t, s: cs, e: ce, lane }) => {
                const startsHere = isos[cs] === t.startDate;
                const endsHere = isos[ce] === t.endDate;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelect(t.id)}
                    title={`${t.name} • ${fullDate(t.startDate)} → ${fullDate(t.endDate)}`}
                    style={{ gridColumn: `${cs + 1} / ${ce + 2}`, gridRow: lane + 2 }}
                    className={cn(
                      "relative mx-0.5 mb-1 flex items-center gap-1.5 min-w-0 px-1.5 py-1 border text-left transition-colors hover:brightness-125",
                      tierColor(t.tier),
                      startsHere ? "rounded-l-md" : "rounded-l-none border-l-0",
                      endsHere ? "rounded-r-md" : "rounded-r-none border-r-0",
                    )}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusDot(t.status))} />
                    <TournamentLogo id={t.id} name={t.name} size={16} hideFallback />
                    <span className="font-heading font-bold text-xs leading-tight line-clamp-2 break-words">{t.name}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TournamentYearTimeline = ({ tournaments, onSelect }: { tournaments: TournamentData[]; onSelect: (id: string) => void }) => {
  const years = useMemo(() => Array.from(new Set(tournaments.map(t => formatYear(t.startDate)).filter(Boolean))).sort(), [tournaments]);
  const [year, setYear] = usePersistedState("portal_timeline_year", years[years.length - 1] || String(getWorldNow().getFullYear()));
  const yearTournaments = tournaments
    .filter(t => formatYear(t.startDate) === year || formatYear(t.endDate) === year)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-border bg-secondary/40">
        <button type="button" onClick={() => setYear(String(Number(year) - 1))} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary">
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
        <h3 className="font-heading font-black text-lg text-foreground">Sezon {year}</h3>
        <button type="button" onClick={() => setYear(String(Number(year) + 1))} className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="hidden md:grid grid-cols-[220px_1fr] border-b border-border/60 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <div className="px-3 py-2">Turniej</div>
        <div className="grid grid-cols-12">
          {["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"].map(m => (
            <div key={m} className="text-center py-2 border-l border-border/30">{m}</div>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border/40">
        {yearTournaments.map(t => {
          const start = parseLocalDate(t.startDate) ?? new Date();
          const end = parseLocalDate(t.endDate || t.startDate) ?? start;
          const startDay = start.getFullYear() === Number(year) ? start.getMonth() * 30 + start.getDate() : 0;
          const endDay = end.getFullYear() === Number(year) ? end.getMonth() * 30 + end.getDate() : 360;
          const left = Math.max(0, Math.min(98, (startDay / 360) * 100));
          const width = Math.max(2, Math.min(100 - left, ((endDay - startDay + 1) / 360) * 100));
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className="w-full grid grid-cols-1 md:grid-cols-[220px_1fr] items-center text-left hover:bg-secondary/30 transition-colors"
            >
              <div className="px-3 py-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn("text-xs font-mono font-bold px-1.5 py-0.5 rounded border shrink-0", tierColor(t.tier))}>{t.tier}</span>
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", statusDot(t.status))} />
                  <TournamentLogo id={t.id} name={t.name} size={18} hideFallback /><span className="text-sm font-heading font-bold text-foreground truncate">{t.name}</span>
                </div>
                <div className="mt-0.5 text-xs font-mono text-muted-foreground">{fullDate(t.startDate)} → {fullDate(t.endDate)} • {statusLabel(t.status)}</div>
              </div>
              <div className="relative h-9 px-3 hidden md:block">
                <div className="absolute inset-y-0 left-3 right-3 grid grid-cols-12">
                  {Array.from({ length: 12 }).map((_, i) => <div key={i} className="border-l border-border/20" />)}
                </div>
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  style={{ left: `${left}%`, width: `${width}%`, transformOrigin: "left" }}
                  className={cn(
                    "absolute top-2 h-5 rounded-md border",
                    t.status === "completed" ? "bg-muted/60 border-border" : t.status === "live" ? "bg-[hsl(var(--win))]/20 border-[hsl(var(--win))]/50" : "bg-primary/20 border-primary/50",
                  )}
                />
              </div>
            </button>
          );
        })}
        {yearTournaments.length === 0 && <div className="py-12 text-center text-sm font-mono text-muted-foreground">Brak turniejów w {year}.</div>}
      </div>
    </div>
  );
};

const TournamentChronologicalList = ({ tournaments, onSelect }: { tournaments: TournamentData[]; onSelect: (id: string) => void }) => {
  const grouped = tournaments.reduce<Record<string, TournamentData[]>>((acc, t) => {
    const key = monthKey(t.startDate);
    (acc[key] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([month, items]) => (
        <div key={month}>
          <h3 className="font-heading text-sm font-bold text-primary uppercase tracking-wider border-b border-border pb-2 mb-3 capitalize">{month}</h3>
          <div className="space-y-2">
            {items.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t.id)}
                className="w-full grid grid-cols-[auto_1fr_auto] gap-3 items-center p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-secondary/30 transition-colors text-left"
              >
                <span className={cn("text-xs font-mono font-bold px-2 py-1 rounded border", tierColor(t.tier))}>{t.tier}-Tier</span>
                <div className="min-w-0 flex items-center gap-2"><TournamentLogo id={t.id} name={t.name} size={28} /><div className="min-w-0">
                  <div className="font-heading font-bold text-foreground truncate">{t.name}</div>
                  <div className="text-xs font-mono text-muted-foreground truncate">{fullDate(t.startDate)} → {fullDate(t.endDate)} • {t.format} • {t.location || "—"}</div>
                </div></div>
                <div className="flex items-center gap-2">
                  <span className={cn("hidden sm:inline-flex items-center gap-1.5 text-xs font-mono", t.status === "completed" ? "text-[hsl(var(--win))]" : "text-muted-foreground")}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", statusDot(t.status))} />
                    {t.status === "completed" ? "wyniki" : statusLabel(t.status)}
                  </span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

const RESULTS_PAGE = 30;
const TournamentResultsList = ({ tournaments, onSelect }: { tournaments: TournamentData[]; onSelect: (id: string) => void }) => {
  const [limit, setLimit] = useState(RESULTS_PAGE);
  const sorted = useMemo(
    () => [...tournaments].sort((a, b) =>
      (b.endDate || b.startDate || "").localeCompare(a.endDate || a.startDate || "")
      || (b.startDate || "").localeCompare(a.startDate || "")),
    [tournaments],
  );
  const placeOf = (t: TournamentData, n: number) => t.placements?.find(p => p.placement === n)?.team;
  return (
    <div className="mt-6 bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/40">
        <List className="w-4 h-4 text-primary" />
        <h3 className="font-heading font-bold text-foreground">Lista turniejów</h3>
        <span className="text-xs font-mono text-muted-foreground">({sorted.length}) • najnowsze na górze</span>
      </div>
      <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_110px_70px] gap-3 px-4 py-2 text-xs font-mono uppercase text-muted-foreground border-b border-border/60">
        <span>Turniej</span><span>Zwycięzca</span><span>2. miejsce</span><span className="text-right">Pula</span><span className="text-right">Drużyny</span>
      </div>
      <div className="divide-y divide-border/40">
        {sorted.slice(0, limit).map(t => {
          const w = placeOf(t, 1), r = placeOf(t, 2);
          const count = t.participants?.length || t.teams || 0;
          return (
            <button key={t.id} type="button" onClick={() => onSelect(t.id)}
              className="w-full text-left grid grid-cols-1 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_110px_70px] gap-1 md:gap-3 items-center px-4 py-2.5 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn("text-xs font-mono font-bold px-1.5 py-0.5 rounded border shrink-0", tierColor(t.tier))}>{t.tier}</span>
                <TournamentLogo id={t.id} name={t.name} size={24} />
                <div className="min-w-0">
                  <div className="font-heading font-bold text-sm text-foreground truncate">{t.name}</div>
                  <div className="text-xs font-mono text-muted-foreground truncate">{formatDate(t.startDate)} – {formatDate(t.endDate)}</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 text-sm">
                <Trophy className="w-3.5 h-3.5 text-[hsl(var(--gold))] shrink-0" />
                {w && <TeamLogo teamName={w} size={20} rounded="md" className="shrink-0" />}
                <span className={cn("truncate", w ? "font-bold text-foreground" : "text-muted-foreground")}>{w || (t.status === "completed" ? "—" : "TBD")}</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 text-sm">
                <span className="text-xs font-mono text-[hsl(var(--silver))] shrink-0">2.</span>
                {r && <TeamLogo teamName={r} size={20} rounded="md" className="shrink-0" />}
                <span className={cn("truncate", r ? "text-foreground" : "text-muted-foreground")}>{r || "TBD"}</span>
              </div>
              <span className="text-sm font-mono text-[hsl(var(--win))] md:text-right">{t.prizePool || "—"}</span>
              <span className="text-sm font-mono text-muted-foreground md:text-right">{count} drużyn</span>
            </button>
          );
        })}
      </div>
      {sorted.length > limit && (
        <button type="button" onClick={() => setLimit(l => l + RESULTS_PAGE)}
          className="w-full py-2.5 text-xs font-mono font-bold text-primary hover:bg-secondary/30 border-t border-border">
          Pokaż więcej ({sorted.length - limit})
        </button>
      )}
    </div>
  );
};

export const TournamentPortal = ({ tournaments, onSelect, onCreate, onCreateWorlds }: Props) => {
  const [viewMode, setViewMode] = usePersistedState<ViewMode>("portal_view", "month");
  const [statusFilter, setStatusFilter] = usePersistedState<StatusFilter>("portal_status", "ALL");
  const [tierFilter, setTierFilter] = usePersistedState<TierFilter>("portal_tier", "ALL");
  const [formatFilter, setFormatFilter] = usePersistedState<FormatFilter>("portal_format", "ALL");
  const [yearFilter, setYearFilter] = usePersistedState<string>("portal_year", "ALL");
  const [organizerFilter, setOrganizerFilter] = usePersistedState<string>("portal_organizer", "ALL");
  const [search, setSearch] = useState("");

  const counts = useMemo(() => ({
    live: tournaments.filter(t => t.status === "live").length,
    upcoming: tournaments.filter(t => t.status === "upcoming").length,
    completed: tournaments.filter(t => t.status === "completed").length,
  }), [tournaments]);

  const availableYears = useMemo(
    () => Array.from(new Set(tournaments.map(t => formatYear(t.startDate)).filter(Boolean))).sort(),
    [tournaments],
  );

  const availableFormats = useMemo(
    () => Array.from(new Set(tournaments.map(t => t.format).filter(Boolean))).sort(),
    [tournaments],
  );

  const availableOrganizers = useMemo(
    () => Array.from(new Set(tournaments.map(t => (t.organizer || "").trim()).filter(Boolean))).sort(),
    [tournaments],
  );

  const filtered = useMemo(() => {
    let list = [...tournaments];
    if (statusFilter !== "ALL") list = list.filter(t => t.status === statusFilter);
    if (tierFilter !== "ALL") list = list.filter(t => t.tier === tierFilter);
    if (formatFilter !== "ALL") list = list.filter(t => t.format === formatFilter || t.format.toLowerCase().includes(String(formatFilter).toLowerCase()));
    if (yearFilter !== "ALL") list = list.filter(t => formatYear(t.startDate) === yearFilter || formatYear(t.endDate) === yearFilter);
    if (organizerFilter !== "ALL") list = list.filter(t => (t.organizer || "").trim() === organizerFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(t =>
        t.name.toLowerCase().includes(q)
        || t.organizer.toLowerCase().includes(q)
        || t.location.toLowerCase().includes(q)
        || t.format.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      const byDate = (a.startDate || "").localeCompare(b.startDate || "");
      if (byDate !== 0) return byDate;
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [tournaments, statusFilter, tierFilter, formatFilter, yearFilter, organizerFilter, search]);

  const statusTabs: { key: StatusFilter; label: string; icon: typeof Radio; count: number }[] = [
    { key: "ALL", label: "Wszystkie", icon: CalendarDays, count: tournaments.length },
    { key: "live", label: "Na żywo", icon: Radio, count: counts.live },
    { key: "upcoming", label: "Nadchodzące", icon: Clock, count: counts.upcoming },
    { key: "completed", label: "Zakończone", icon: CheckCircle2, count: counts.completed },
  ];

  const viewModes: { key: ViewMode; label: string; icon: typeof CalendarDays }[] = [
    { key: "month", label: "Kalendarz", icon: LayoutGrid },
    { key: "year", label: "Rok", icon: CalendarDays },
  ];

  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-heading font-bold text-foreground leading-tight">Portal Turniejów</h2>
              <p className="text-xs font-mono text-muted-foreground">{tournaments.length} wydarzeń w bazie</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onCreateWorlds && (
              <Button onClick={onCreateWorlds} variant="outline" className="gap-1.5">
                🌍 Mistrzostwa Świata
              </Button>
            )}
            <Button onClick={onCreate} className="gap-1.5">
              <Plus className="w-4 h-4" /> Nowy turniej
            </Button>
          </div>
        </div>

        {/* Calendar controls */}
        <div className="bg-card border border-border rounded-lg p-3 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-md bg-secondary/40 border border-border/60">
            {viewModes.map(mode => {
              const Icon = mode.icon;
              const active = viewMode === mode.key;
              return (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setViewMode(mode.key)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 px-2 py-2 rounded text-xs font-mono font-bold transition-colors",
                    active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary",
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {mode.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {statusTabs.map(tab => {
            const Icon = tab.icon;
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-2 text-xs font-heading font-bold transition-colors whitespace-nowrap rounded-md border",
                  active ? "text-primary bg-primary/10 border-primary/40" : "text-muted-foreground border-border hover:text-foreground hover:bg-secondary/40"
                )}
              >
                <Icon className={cn("w-4 h-4", active && tab.key === "live" && "animate-pulse")} />
                {tab.label}
                <span className={cn(
                  "text-xs font-mono px-1.5 py-0.5 rounded",
                  active ? "bg-primary/20 text-primary" : "bg-secondary/60 text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              </button>
            );
          })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2">
            <label className="relative min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Szukaj turnieju, organizatora, miasta, formatu..."
                className="w-full h-9 pl-8 pr-3 rounded-md bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60"
              />
            </label>
            <select
              value={yearFilter}
              onChange={e => setYearFilter(e.target.value)}
              className="h-9 px-2 rounded-md bg-background border border-border text-xs font-mono text-foreground"
            >
              <option value="ALL">Rok / sezon</option>
              {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
            <select
              value={organizerFilter}
              onChange={e => setOrganizerFilter(e.target.value)}
              className="h-9 px-2 rounded-md bg-background border border-border text-xs font-mono text-foreground max-w-[180px]"
              title="Filtruj po organizatorze"
            >
              <option value="ALL">Organizator</option>
              {availableOrganizers.map(org => <option key={org} value={org}>{org}</option>)}
            </select>
            <select
              value={formatFilter}
              onChange={e => setFormatFilter(e.target.value)}
              className="h-9 px-2 rounded-md bg-background border border-border text-xs font-mono text-foreground"
            >
              <option value="ALL">Format</option>
              {availableFormats.map(format => <option key={format} value={format}>{format}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            {(["ALL", "S", "A", "B", "C"] as TierFilter[]).map(tier => (
              <button
                key={tier}
                type="button"
                onClick={() => setTierFilter(tier)}
                className={cn(
                  "text-xs font-mono font-bold px-2 py-1 rounded border transition-colors",
                  tierFilter === tier
                    ? tier === "ALL"
                      ? "bg-foreground/10 text-foreground border-foreground/30"
                      : tierColor(tier)
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tier === "ALL" ? "Tier" : `${tier}-Tier`}
              </button>
            ))}
          </div>
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-20 text-muted-foreground border border-dashed border-border rounded-lg">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-mono text-sm">
              {tournaments.length === 0
                ? "Brak turniejów. Utwórz pierwszy!"
                : "Brak turniejów dla wybranych filtrów."}
            </p>
          </div>
        )}

        {filtered.length > 0 && viewMode === "month" && <TournamentMonthCalendar tournaments={filtered} onSelect={onSelect} />}
        {filtered.length > 0 && viewMode === "year" && <TournamentYearTimeline tournaments={filtered} onSelect={onSelect} />}
        {filtered.length > 0 && viewMode !== "year" && viewMode !== "month" && <TournamentMonthCalendar tournaments={filtered} onSelect={onSelect} />}
        {filtered.length > 0 && <TournamentResultsList tournaments={filtered} onSelect={onSelect} />}
      </div>
    </section>
  );
};
