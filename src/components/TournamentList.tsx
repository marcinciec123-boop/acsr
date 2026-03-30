import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Users, Trophy, Zap, ChevronRight, Filter, Play, RotateCcw, FastForward, SkipForward } from "lucide-react";
import { initialTournaments, type Tournament, type TournamentSimulation, simulateTournament } from "@/data/tournaments";
import { cn } from "@/lib/utils";
import TournamentDetail from "./TournamentDetail";

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
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("font-heading font-bold text-lg", tierColors[tournament.tier])}>
              {tournament.tier}
            </span>
            <span className={cn("text-xs font-mono px-2 py-0.5 rounded border", status.className)}>
              {status.label}
            </span>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded border border-border text-muted-foreground">
              {formatLabels[tournament.format]}
            </span>
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

type TierFilter = "all" | "S" | "A" | "B" | "C";
type StatusFilter = "all" | "live" | "upcoming" | "completed";

const TournamentList = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>(() =>
    initialTournaments.map((t) => ({ ...t }))
  );
  const [simResults, setSimResults] = useState<Record<string, TournamentSimulation>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const sorted = [...tournaments].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  // Find next upcoming tournament
  const nextUpcoming = sorted.find((t) => t.status === "upcoming");

  const simulateNext = () => {
    if (!nextUpcoming) return;
    const result = simulateTournament(nextUpcoming);
    setSimResults((prev) => ({ ...prev, [nextUpcoming.id]: result }));
    setTournaments((prev) =>
      prev.map((t) => (t.id === nextUpcoming.id ? { ...t, status: "completed" as const } : t))
    );
  };

  const simulateAll = () => {
    const newTournaments = [...tournaments];
    const newResults = { ...simResults };
    newTournaments.forEach((t) => {
      if (t.status === "upcoming") {
        const result = simulateTournament(t);
        newResults[t.id] = result;
        t.status = "completed";
      }
    });
    setTournaments(newTournaments);
    setSimResults(newResults);
  };

  const resetSeason = () => {
    setTournaments(initialTournaments.map((t) => ({ ...t })));
    setSimResults({});
    setSelectedId(null);
  };

  const completedCount = tournaments.filter((t) => t.status === "completed").length;
  const totalCount = tournaments.length;

  const filtered = sorted.filter((t) => {
    if (tierFilter !== "all" && t.tier !== tierFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, Tournament[]>>((acc, t) => {
    const key = new Date(t.startDate).toLocaleDateString("pl-PL", { month: "long", year: "numeric" });
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  // Selected tournament detail view
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
        {/* Header */}
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
                onClick={simulateNext}
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
                onClick={simulateAll}
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
                onClick={resetSeason}
                className="flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-2 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full gradient-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(completedCount / totalCount) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {(["all", "S", "A", "B", "C"] as TierFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={cn(
                "px-3 py-1 text-xs font-mono rounded border transition-colors",
                tierFilter === t ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {t === "all" ? "Wszystkie" : `Tier ${t}`}
            </button>
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          {(["all", "upcoming", "completed"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1 text-xs font-mono rounded border transition-colors",
                statusFilter === s ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {s === "all" ? "Status" : s === "upcoming" ? "Nadchodzące" : "Zakończone"}
            </button>
          ))}
        </div>

        {/* Tournament list */}
        {Object.entries(grouped).map(([month, monthTournaments]) => (
          <div key={month} className="mb-8">
            <h3 className="font-heading text-lg font-bold text-primary mb-4 uppercase tracking-wider border-b border-border pb-2">
              {month}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monthTournaments.map((t, i) => (
                <TournamentCard
                  key={t.id}
                  tournament={t}
                  index={i}
                  hasResult={!!simResults[t.id]}
                  onClick={() => {
                    if (simResults[t.id]) {
                      setSelectedId(t.id);
                    }
                  }}
                />
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-12 font-mono">Brak turniejów spełniających kryteria.</p>
        )}
      </div>
    </section>
  );
};

export default TournamentList;
