import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Users, Trophy, Zap, ChevronRight, Filter, Play, RotateCcw, FastForward, Shield, Crown, ChevronDown, Layers, List, CalendarDays, LayoutGrid } from "lucide-react";
import { type Tournament, type TournamentSimulation, type TeamData } from "@/data/tournaments";
import { cn } from "@/lib/utils";
import TournamentDetail from "./TournamentDetail";
import TournamentCalendar from "./tournament/TournamentCalendar";

const statusConfig = {
  live: { label: "LIVE", className: "bg-destructive/20 text-destructive border-destructive/40" },
  upcoming: { label: "UPCOMING", className: "bg-primary/10 text-primary border-primary/30" },
  completed: { label: "ZAKOŃCZONY", className: "bg-win/10 text-win border-win/30" },
};

const tierColors: Record<string, string> = {
  S: "text-accent",
  A: "text-primary",
  B: "text-silver",
  C: "text-muted-foreground",
};

const formatLabels: Record<string, string> = {
  "knockout": "KO",
  "swiss+knockout": "Swiss+KO",
  "groups+knockout": "Grupy+KO",
  "major": "Major",
};

const TournamentCard = ({ tournament, index, onClick, hasResult }: { tournament: Tournament; index: number; onClick: () => void; hasResult: boolean }) => {
  const status = statusConfig[tournament.status];
  const config = tournament.qualification;
  const needsQual = config.qualifierType !== "none" && config.qualifierSlots > 0 && !tournament.qualifierCompleted && tournament.status !== "completed";
  const qualDone = tournament.qualifierCompleted;

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className={cn(
        "group relative bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition-all duration-300 text-left w-full",
        tournament.status === "live" && "border-destructive/30 neon-border",
        tournament.status === "completed" && hasResult && "border-win/20"
      )}
    >
      {tournament.status === "live" && (
        <div className="absolute top-3 right-3">
          <Zap className="w-4 h-4 text-destructive animate-pulse-glow" />
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={cn("font-heading font-bold text-lg", tierColors[tournament.tier])}>
              {tournament.tier}
            </span>
            <span className={cn("text-xs font-mono px-2 py-0.5 rounded border", status.className)}>
              {status.label}
            </span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">
              {formatLabels[tournament.format]}
            </span>
            {/* Qualification badges */}
            {needsQual && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {config.qualifierType === "regional" ? "Kwal. Reg." : "Open Qual."}
              </span>
            )}
            {qualDone && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-win/30 bg-win/10 text-win flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Skład ustalony
              </span>
            )}
            {config.qualifierType === "none" && tournament.status === "upcoming" && (
              <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-accent/30 bg-accent/10 text-accent flex items-center gap-1">
                <Crown className="w-3 h-3" />
                Z rankingu
              </span>
            )}
          </div>
          <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-primary transition-colors">
            {tournament.name}
          </h3>
          <p className="text-muted-foreground text-sm">{tournament.organizer}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Trophy className="w-3.5 h-3.5 text-accent" />
          <span className="font-mono text-foreground">{tournament.prizePool}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{tournament.teams} Teams</span>
          {config.qualifierType !== "none" && (
            <span className="text-xs text-primary">
              ({config.inviteSlots}{config.manualInviteSlots ? `+${config.manualInviteSlots}☆` : ''}+{config.qualifierSlots})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" />
          <span className="truncate">{tournament.location}</span>
        </div>
        <div className="text-sm text-muted-foreground font-mono">
          {new Date(tournament.startDate).toLocaleDateString("pl-PL", { month: "short", day: "numeric" })}
          {" – "}
          {new Date(tournament.endDate).toLocaleDateString("pl-PL", { month: "short", day: "numeric" })}
        </div>
      </div>
    </motion.button>
  );
};

// Helper: derive region label from qualifier name
const regionLabel = (name: string) => {
  const m = name.match(/[—-]\s*([^—-]+?)(?:\s+Elimination|\s+Qualifier)?$/i);
  return (m?.[1] || name).trim();
};

const QualifierBundleCard = ({
  bundleKey,
  tournaments,
  index,
  simResults,
  onOpen,
}: {
  bundleKey: string;
  tournaments: Tournament[];
  index: number;
  simResults: Record<string, TournamentSimulation>;
  onOpen: (id: string) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...tournaments].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const tier = first.tier;
  const completed = sorted.filter((t) => t.status === "completed").length;
  const total = sorted.length;
  const live = sorted.some((t) => t.status === "live");
  const allDone = completed === total;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
      className={cn(
        "group relative bg-card border border-border rounded-lg overflow-hidden md:col-span-2 lg:col-span-3",
        live && "border-destructive/30 neon-border",
        allDone && "border-win/20"
      )}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left p-5 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn("font-heading font-bold text-lg", tierColors[tier])}>{tier}</span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary flex items-center gap-1">
                <Layers className="w-3 h-3" />
                Kwalifikacje
              </span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">
                {total} {total === 1 ? "region" : "regiony"}
              </span>
              {allDone && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-win/30 bg-win/10 text-win flex items-center gap-1">
                  <Crown className="w-3 h-3" />
                  Zakończone
                </span>
              )}
            </div>
            <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-primary transition-colors">
              {bundleKey} — Kwalifikacje
            </h3>
            <p className="text-muted-foreground text-sm">{first.organizer}</p>
          </div>
          <ChevronDown
            className={cn(
              "w-5 h-5 text-muted-foreground transition-transform mt-1 shrink-0",
              expanded && "rotate-180"
            )}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono text-foreground">{completed}/{total}</span>
            <span>rozegranych</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{sorted.reduce((s, t) => s + (t.teams || 0), 0)} drużyn</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span>Online</span>
          </div>
          <div className="text-muted-foreground font-mono">
            {new Date(first.startDate).toLocaleDateString("pl-PL", { month: "short", day: "numeric" })}
            {" – "}
            {new Date(last.endDate).toLocaleDateString("pl-PL", { month: "short", day: "numeric" })}
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
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sorted.map((t) => {
                const status = statusConfig[t.status];
                return (
                  <button
                    key={t.id}
                    onClick={() => onOpen(t.id)}
                    className="flex items-center justify-between gap-2 p-3 rounded-md border border-border bg-background/40 hover:border-primary/40 hover:bg-muted/20 transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", status.className)}>
                          {status.label}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {t.teams} dr.
                        </span>
                      </div>
                      <div className="font-heading text-sm font-semibold text-foreground truncate">
                        {regionLabel(t.name)}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {new Date(t.startDate).toLocaleDateString("pl-PL", { month: "short", day: "numeric" })}
                        {" – "}
                        {new Date(t.endDate).toLocaleDateString("pl-PL", { month: "short", day: "numeric" })}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

type TierFilter = "all" | "S" | "A" | "B" | "C";
type StatusFilter = "all" | "live" | "upcoming" | "completed";
type FormatFilter = "all" | "knockout" | "swiss+knockout" | "groups+knockout" | "major";
type ViewMode = "list" | "month" | "year";

interface TournamentListProps {
  tournaments: Tournament[];
  simResults: Record<string, TournamentSimulation>;
  onSimulateNext: () => void;
  onSimulateAll: () => void;
  onReset: () => void;
  onPlayTournament: (id: string) => void;
  dynamicRanking: TeamData[];
}

const TournamentList = ({ tournaments, simResults, onSimulateNext, onSimulateAll, onReset, onPlayTournament, dynamicRanking }: TournamentListProps) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [formatFilter, setFormatFilter] = useState<FormatFilter>("all");
  const [yearFilter, setYearFilter] = useState<number | "all">("all");
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const sorted = [...tournaments].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  const nextUpcoming = sorted.find((t) => t.status === "upcoming");
  const completedCount = tournaments.filter((t) => t.status === "completed").length;
  const totalCount = tournaments.length;

  const availableYears = useMemo(() => {
    const s = new Set<number>();
    tournaments.forEach(t => s.add(new Date(t.startDate).getFullYear()));
    return Array.from(s).sort();
  }, [tournaments]);

  const filtered = sorted.filter((t) => {
    if (tierFilter !== "all" && t.tier !== tierFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (formatFilter !== "all" && t.format !== formatFilter) return false;
    if (yearFilter !== "all" && new Date(t.startDate).getFullYear() !== yearFilter) return false;
    return true;
  });


  const grouped = filtered.reduce<Record<string, Tournament[]>>((acc, t) => {
    const key = new Date(t.startDate).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const selectedTournament = selectedId ? tournaments.find((t) => t.id === selectedId) : null;
  if (selectedTournament && simResults[selectedTournament.id]) {
    return (
      <TournamentDetail
        tournament={selectedTournament}
        simulation={simResults[selectedTournament.id]}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-primary" />
            <h2 className="text-3xl font-heading font-bold text-foreground">Turnieje — Sezon 2026</h2>
          </div>
        </div>

        {/* Season Simulation Controls */}
        <div className="bg-card border border-border rounded-lg p-4 mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-heading font-bold text-foreground text-lg mb-1">Symulacja Sezonu</h3>
              <p className="text-muted-foreground text-sm">
                Postęp: <span className="font-mono text-primary">{completedCount}/{totalCount}</span> turniejów rozegranych
                {nextUpcoming && (
                  <span> • Następny: <span className="text-foreground font-medium">{nextUpcoming.name}</span></span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onSimulateNext}
                disabled={!nextUpcoming}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm transition-all",
                  nextUpcoming
                    ? "gradient-primary text-primary-foreground hover:opacity-90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
                )}
              >
                <Play className="w-4 h-4" />
                Zagraj następny
              </button>
              <button
                onClick={onSimulateAll}
                disabled={!nextUpcoming}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm border transition-colors",
                  nextUpcoming
                    ? "border-primary/30 text-primary hover:bg-primary/10"
                    : "border-border text-muted-foreground cursor-not-allowed"
                )}
              >
                <FastForward className="w-4 h-4" />
                Zagraj wszystkie
              </button>
              <button
                onClick={onReset}
                className="flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>

          <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full gradient-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / totalCount) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* View mode switcher — prominent bar */}
        <div className="mb-3 flex items-center gap-2 bg-card border border-border rounded-lg p-1.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground pl-2 hidden sm:inline">
            Widok:
          </span>
          <div className="flex-1 grid grid-cols-3 gap-1">
            {([
              { mode: "list" as const, label: "Lista", Icon: List },
              { mode: "month" as const, label: "Kalendarz", Icon: LayoutGrid },
              { mode: "year" as const, label: "Oś roku", Icon: CalendarDays },
            ]).map(({ mode, label, Icon }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "flex items-center justify-center gap-1.5 px-2 py-2 text-xs font-mono font-semibold rounded transition-colors",
                  viewMode === mode
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {(["all", "S", "A", "B", "C"] as TierFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={cn(
                "px-2.5 py-1 text-xs font-mono rounded border transition-colors",
                tierFilter === t ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {t === "all" ? "Tier" : t}
            </button>
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          {(["all", "live", "upcoming", "completed"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-2.5 py-1 text-xs font-mono rounded border transition-colors",
                statusFilter === s ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {s === "all" ? "Status" : s === "upcoming" ? "Nadchodzące" : s === "completed" ? "Zakończone" : "LIVE"}
            </button>
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          <select
            value={formatFilter}
            onChange={(e) => setFormatFilter(e.target.value as FormatFilter)}
            className="px-2 py-1 text-xs font-mono rounded border border-border bg-secondary/40 text-foreground"
          >
            <option value="all">Format</option>
            <option value="knockout">KO</option>
            <option value="swiss+knockout">Swiss+KO</option>
            <option value="groups+knockout">Grupy+KO</option>
            <option value="major">Major</option>
          </select>
          <select
            value={yearFilter === "all" ? "all" : String(yearFilter)}
            onChange={(e) => setYearFilter(e.target.value === "all" ? "all" : parseInt(e.target.value))}
            className="px-2 py-1 text-xs font-mono rounded border border-border bg-secondary/40 text-foreground"
          >
            <option value="all">Rok</option>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Calendar views */}
        {viewMode !== "list" && (
          <TournamentCalendar
            tournaments={filtered}
            view={viewMode}
            onOpen={(id) => {
              if (simResults[id]) setSelectedId(id);
              else {
                const tt = tournaments.find(x => x.id === id);
                if (tt?.status === "upcoming") onPlayTournament(id);
              }
            }}
          />
        )}

        {/* Tournament list */}
        {viewMode === "list" && Object.entries(grouped).map(([month, monthTournaments]) => {
          // Group qualifiers under their parent major
          const isQualifier = (t: Tournament) => /elimination|qualifier|open\s*qual|closed\s*qual/i.test(t.name);
          const qualKey = (t: Tournament) => {
            // Strip "— XYZ Elimination/Qualifier" suffix to get parent group key
            return t.name.replace(/\s*[—-]\s*.*?(elimination|qualifier).*$/i, "").trim();
          };

          const qualifiers = monthTournaments.filter(isQualifier);
          const nonQualifiers = monthTournaments.filter((t) => !isQualifier(t));

          // Bundle qualifiers by parent key
          const qualBundles = qualifiers.reduce<Record<string, Tournament[]>>((acc, t) => {
            const key = qualKey(t);
            (acc[key] ??= []).push(t);
            return acc;
          }, {});

          // Build display items: non-qualifiers as cards + bundles as grouped cards
          type Item =
            | { kind: "card"; t: Tournament }
            | { kind: "bundle"; key: string; tournaments: Tournament[] };

          const items: Item[] = [
            ...nonQualifiers.map((t) => ({ kind: "card" as const, t })),
            ...Object.entries(qualBundles).map(([key, ts]) => ({ kind: "bundle" as const, key, tournaments: ts })),
          ];

          return (
            <div key={month} className="mb-8">
              <h3 className="font-heading text-lg font-bold text-primary mb-4 uppercase tracking-wider border-b border-border pb-2">
                {month}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item, i) =>
                  item.kind === "card" ? (
                    <TournamentCard
                      key={item.t.id}
                      tournament={item.t}
                      index={i}
                      hasResult={!!simResults[item.t.id]}
                      onClick={() => {
                        if (simResults[item.t.id]) {
                          setSelectedId(item.t.id);
                        } else if (item.t.status === "upcoming") {
                          onPlayTournament(item.t.id);
                        }
                      }}
                    />
                  ) : (
                    <QualifierBundleCard
                      key={item.key}
                      bundleKey={item.key}
                      tournaments={item.tournaments}
                      index={i}
                      simResults={simResults}
                      onOpen={(id) => {
                        if (simResults[id]) {
                          setSelectedId(id);
                        } else {
                          const tt = tournaments.find((x) => x.id === id);
                          if (tt?.status === "upcoming") onPlayTournament(id);
                        }
                      }}
                    />
                  )
                )}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-12 font-mono">Brak turniejów spełniających kryteria.</p>
        )}
      </div>
    </section>
  );
};

export default TournamentList;
