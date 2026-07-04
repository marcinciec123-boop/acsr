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
import { getTeamFlag, isPlaceholder } from "@/lib/teamHelpers";

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

const formatDate = (d: string) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
  } catch { return d; }
};

const formatYear = (d: string) => {
  if (!d) return "";
  try {
    return new Date(d).getFullYear().toString();
  } catch { return ""; }
};

const fullDate = (d: string) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pl-PL", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return d; }
};

const monthKey = (d: string) => {
  if (!d) return "Bez daty";
  try {
    return new Date(d).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
  } catch { return "Bez daty"; }
};

const dateRangeDays = (start: string, end: string): string[] => {
  if (!start) return [];
  const out: string[] = [];
  const s = new Date(start);
  const e = new Date(end || start);
  const cur = new Date(s);
  if (Number.isNaN(cur.getTime())) return [];
  while (cur <= e) {
    out.push(cur.toISOString().slice(0, 10));
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
  const date = next ? new Date(next.startDate) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const TournamentCard = ({ t, onClick }: { t: TournamentData; onClick: () => void }) => {
  const totalMatches = t.phases.reduce((sum, p) =>
    sum + (p.bracket?.length || 0) + (p.groups?.reduce((s, g) => s + g.matches.length, 0) || 0), 0
  );
  const playedMatches = t.phases.reduce((sum, p) => {
    const b = (p.bracket || []).filter(m => m.score1 + m.score2 > 0).length;
    const g = (p.groups || []).reduce((ss, gr) => ss + gr.matches.filter(m => m.score1 + m.score2 > 0).length, 0);
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
          if (m.score1 + m.score2 > 0 && (m.round || "").toLowerCase().includes("final")) {
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
            <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border", tierColor(t.tier))}>
              {t.tier}-TIER
            </span>
            {t.kind === "qualifier" && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-[hsl(var(--gold))]/40 bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))] font-mono font-bold">
                QUAL
              </span>
            )}
            {t.status === "live" && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-[hsl(var(--win))]/50 bg-[hsl(var(--win))]/15 text-[hsl(var(--win))] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--win))] animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>

        {/* Title */}
        <h3 className="font-heading font-bold text-foreground text-base mb-0.5 line-clamp-2 leading-tight">
          {t.name}
        </h3>
        <p className="text-[11px] text-muted-foreground mb-3 truncate">
          {t.organizer || "—"} {formatYear(t.startDate) && `• ${formatYear(t.startDate)}`}
        </p>

        {/* Prize pool feature */}
        <div className="flex items-baseline gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-[hsl(var(--gold))] shrink-0" />
          <span className="text-lg font-heading font-bold text-[hsl(var(--gold))]">{t.prizePool}</span>
          <span className="text-[10px] font-mono text-muted-foreground ml-auto">
            {t.teams} drużyn
          </span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono text-muted-foreground border-t border-border/40 pt-2 mb-3">
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
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
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
            <span className="text-[10px] font-mono uppercase text-[hsl(var(--gold))] tracking-wider">Mistrz</span>
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
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/50 border border-border/50 text-muted-foreground truncate max-w-[110px]"
                title={team}
              >
                {getTeamFlag(team) && <span className="mr-0.5">{getTeamFlag(team)}</span>}
                {team}
              </span>
            ))}
            {t.participants.length > 5 && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/30 text-muted-foreground">
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
    const b = (p.bracket || []).filter(m => m.score1 + m.score2 > 0).length;
    const g = (p.groups || []).reduce((ss, gr) => ss + gr.matches.filter(m => m.score1 + m.score2 > 0).length, 0);
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

        <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-1 group-hover:text-primary transition-colors">
          {t.name}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">{t.organizer}</p>

        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Pula</div>
            <div className="text-lg font-heading font-bold text-[hsl(var(--gold))]">{t.prizePool}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Drużyny</div>
            <div className="text-lg font-heading font-bold text-foreground">{t.teams}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Mecze</div>
            <div className="text-lg font-heading font-bold text-foreground">{playedMatches}/{totalMatches}</div>
          </div>
          <div className="hidden sm:block">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Daty</div>
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
            <div className="text-[10px] font-mono text-muted-foreground mt-1 text-right">
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
            <span className={cn("text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border", tierColor(tier))}>
              {tier}-TIER
            </span>
            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-primary/40 bg-primary/10 text-primary font-mono font-bold">
              <Layers className="w-3 h-3" /> KWALIFIKACJE
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">
              {total} {total === 1 ? "region" : "regiony"}
            </span>
            {live && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-[hsl(var(--win))]/50 bg-[hsl(var(--win))]/15 text-[hsl(var(--win))] font-mono font-bold">
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
        <p className="text-[11px] text-muted-foreground mb-3 truncate">
          {first.organizer || "—"}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px] font-mono text-muted-foreground border-t border-border/40 pt-2">
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
                        "text-[10px] font-mono px-1.5 py-0.5 rounded border",
                        t.status === "live" && "border-[hsl(var(--win))]/50 bg-[hsl(var(--win))]/15 text-[hsl(var(--win))]",
                        t.status === "upcoming" && "border-primary/40 bg-primary/10 text-primary",
                        t.status === "completed" && "border-[hsl(var(--win))]/30 bg-[hsl(var(--win))]/10 text-[hsl(var(--win))]",
                      )}>
                        {t.status === "live" ? "LIVE" : t.status === "upcoming" ? "SOON" : "DONE"}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">{t.teams} dr.</span>
                    </div>
                    <div className="font-heading text-sm font-semibold text-foreground truncate">
                      {regionLabel(t.name)}
                    </div>
                    <div className="text-[10px] font-mono text-muted-foreground">
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

export const TournamentPortal = ({ tournaments, onSelect, onCreate, onCreateWorlds }: Props) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("live");
  const [tierFilter, setTierFilter] = useState<TierFilter>("ALL");

  const counts = useMemo(() => ({
    live: tournaments.filter(t => t.status === "live").length,
    upcoming: tournaments.filter(t => t.status === "upcoming").length,
    completed: tournaments.filter(t => t.status === "completed").length,
  }), [tournaments]);

  // Auto-fallback: if active tab is empty, switch to non-empty one
  const effectiveStatus: StatusFilter = useMemo(() => {
    if (counts[statusFilter] > 0) return statusFilter;
    if (counts.live > 0) return "live";
    if (counts.upcoming > 0) return "upcoming";
    return "completed";
  }, [statusFilter, counts]);

  const filtered = useMemo(() => {
    let list = tournaments.filter(t => t.status === effectiveStatus);
    if (tierFilter !== "ALL") list = list.filter(t => t.tier === tierFilter);
    // Sort: live first by start date desc, upcoming by start date asc, completed by end date desc
    list.sort((a, b) => {
      if (effectiveStatus === "upcoming") {
        return (a.startDate || "").localeCompare(b.startDate || "");
      }
      return (b.endDate || b.startDate || "").localeCompare(a.endDate || a.startDate || "");
    });
    return list;
  }, [tournaments, effectiveStatus, tierFilter]);

  const featuredLive = effectiveStatus === "live" && filtered.length > 0
    ? filtered.find(t => t.tier === "S") || filtered.find(t => t.tier === "A") || filtered[0]
    : null;
  const restList = featuredLive ? filtered.filter(t => t.id !== featuredLive.id) : filtered;

  const tabs: { key: StatusFilter; label: string; icon: typeof Radio; count: number }[] = [
    { key: "live", label: "Na żywo", icon: Radio, count: counts.live },
    { key: "upcoming", label: "Nadchodzące", icon: Clock, count: counts.upcoming },
    { key: "completed", label: "Zakończone", icon: CheckCircle2, count: counts.completed },
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

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-border overflow-x-auto pb-px">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = effectiveStatus === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2.5 text-sm font-heading font-bold transition-colors whitespace-nowrap",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("w-4 h-4", active && tab.key === "live" && "animate-pulse")} />
                {tab.label}
                <span className={cn(
                  "text-[10px] font-mono px-1.5 py-0.5 rounded",
                  active ? "bg-primary/20 text-primary" : "bg-secondary/60 text-muted-foreground"
                )}>
                  {tab.count}
                </span>
                {active && (
                  <motion.div
                    layoutId="portal-tab-underline"
                    className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-primary"
                  />
                )}
              </button>
            );
          })}

          {/* Tier filter pills */}
          <div className="ml-auto flex items-center gap-1 pl-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            {(["ALL", "S", "A", "B", "C"] as TierFilter[]).map(tier => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                className={cn(
                  "text-[10px] font-mono font-bold px-2 py-1 rounded border transition-colors",
                  tierFilter === tier
                    ? tier === "ALL"
                      ? "bg-foreground/10 text-foreground border-foreground/30"
                      : tierColor(tier)
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tier}
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
                : `Brak turniejów w kategorii ${tabs.find(x => x.key === effectiveStatus)?.label}${tierFilter !== "ALL" ? ` • Tier ${tierFilter}` : ""}`}
            </p>
          </div>
        )}

        {/* Featured live tournament */}
        {featuredLive && (
          <div className="mb-5">
            <FeaturedLiveCard t={featuredLive} onClick={() => onSelect(featuredLive.id)} />
          </div>
        )}

        {/* Grid of cards — qualifiers from the same parent are bundled together */}
        <AnimatePresence mode="popLayout">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(() => {
              const quals = restList.filter(isQualifierName);
              const singles = restList.filter(t => !isQualifierName(t));
              const bundles = quals.reduce<Record<string, TournamentData[]>>((acc, t) => {
                const key = qualifierBundleKey(t);
                (acc[key] ??= []).push(t);
                return acc;
              }, {});
              const nodes: JSX.Element[] = [];
              singles.forEach(t => {
                nodes.push(<TournamentCard key={t.id} t={t} onClick={() => onSelect(t.id)} />);
              });
              Object.entries(bundles).forEach(([key, ts]) => {
                if (ts.length === 1) {
                  nodes.push(<TournamentCard key={ts[0].id} t={ts[0]} onClick={() => onSelect(ts[0].id)} />);
                } else {
                  nodes.push(
                    <QualifierBundleCard key={`bundle-${key}`} bundleKey={key} tournaments={ts} onSelect={onSelect} />
                  );
                }
              });
              return nodes;
            })()}
          </div>
        </AnimatePresence>
      </div>
    </section>
  );
};
