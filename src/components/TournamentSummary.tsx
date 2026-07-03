import { motion } from "framer-motion";
import { Trophy, Crown, Medal, TrendingUp, Target, Star, ArrowRight } from "lucide-react";
import { type TournamentSimulation, type Tournament, type TeamPlacement } from "@/data/tournaments";
import { type MatchStats } from "@/lib/playerStats";
import { cn } from "@/lib/utils";
import FullResultsPanel from "@/components/tournament/FullResultsPanel";

interface TournamentSummaryProps {
  tournament: Tournament;
  simulation: TournamentSimulation;
  matchStats: Record<string, MatchStats>;
  onClose: () => void;
}

const TournamentSummary = ({ tournament, simulation, matchStats, onClose }: TournamentSummaryProps) => {
  const placements = simulation.placements.slice().sort((a, b) => a.placement - b.placement);
  const top8 = placements.slice(0, 8);

  // Calculate MVP from match stats
  const playerPerformances: Record<string, { kills: number; deaths: number; maps: number; rating: number; team: string }> = {};
  Object.values(matchStats).forEach(stats => {
    [...stats.team1Stats, ...stats.team2Stats].forEach(p => {
      if (!playerPerformances[p.playerName]) {
        playerPerformances[p.playerName] = { kills: 0, deaths: 0, maps: 0, rating: 0, team: p.team || "" };
      }
      const pp = playerPerformances[p.playerName];
      pp.kills += p.kills;
      pp.deaths += p.deaths;
      pp.maps += 1;
      pp.rating += (p.rating || 0);
      if (p.team) pp.team = p.team;
    });
  });

  const playerRankings = Object.entries(playerPerformances)
    .map(([name, stats]) => ({
      name,
      team: stats.team,
      avgRating: stats.maps > 0 ? stats.rating / stats.maps : 0,
      totalKills: stats.kills,
      totalDeaths: stats.deaths,
      kd: stats.deaths > 0 ? stats.kills / stats.deaths : stats.kills,
      maps: stats.maps,
    }))
    .filter(p => p.maps >= 2)
    .sort((a, b) => b.avgRating - a.avgRating);

  const mvp = playerRankings[0];
  const topFragger = [...playerRankings].sort((a, b) => b.totalKills - a.totalKills)[0];
  const topKD = [...playerRankings].sort((a, b) => b.kd - a.kd)[0];

  const placementColors = ["text-accent", "text-silver", "text-bronze", "text-foreground"];
  const placementIcons = [Crown, Medal, Medal, Star];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-8"
    >
      {/* Winner banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2, type: "spring" }}
        className="relative overflow-hidden rounded-xl border border-accent/30 bg-gradient-to-br from-accent/10 via-background to-primary/5 p-8 text-center"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--accent)/0.15),transparent_70%)]" />
        <div className="relative z-10">
          <Trophy className="w-16 h-16 text-accent mx-auto mb-4" />
          <p className="text-xs font-mono text-accent uppercase tracking-[0.3em] mb-2">Zwycięzca — {tournament.name}</p>
          <h2 className="text-5xl font-heading font-bold text-foreground mb-3">{simulation.winner}</h2>
          <p className="text-sm text-muted-foreground font-mono">{tournament.prizePool} • {tournament.location}</p>
        </div>
      </motion.div>

      {/* Top 4 podium */}
      <div className="grid grid-cols-4 gap-3">
        {top8.slice(0, 4).map((p, i) => {
          const Icon = placementIcons[i] || Star;
          return (
            <motion.div
              key={p.team}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className={cn(
                "bg-card border rounded-lg p-4 text-center",
                i === 0 ? "border-accent/30" : "border-border"
              )}
            >
              <Icon className={cn("w-5 h-5 mx-auto mb-2", placementColors[i] || "text-muted-foreground")} />
              <p className="text-xs font-mono text-muted-foreground">#{p.placement}</p>
              <p className="font-heading font-bold text-foreground text-sm truncate">{p.team}</p>
              <p className={cn(
                "text-xs font-mono mt-1",
                p.points >= 0 ? "text-win" : "text-loss"
              )}>
                {p.points > 0 ? "+" : ""}{p.points} pkt
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* Full placements table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-card border border-border rounded-lg overflow-hidden"
      >
        <div className="px-4 py-3 bg-secondary/50 font-heading font-bold text-foreground text-sm flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Pełna klasyfikacja
        </div>
        <div className="divide-y divide-border/50">
          {placements.map((p, i) => (
            <div key={p.team} className="flex items-center px-4 py-2 text-sm">
              <span className="w-10 font-mono text-muted-foreground text-xs">#{p.placement}</span>
              <span className={cn(
                "flex-1 font-medium truncate",
                p.placement === 1 ? "text-accent font-bold" : p.placement <= 4 ? "text-foreground" : "text-muted-foreground"
              )}>
                {p.team}
              </span>
              <span className={cn(
                "font-mono text-xs",
                p.points > 0 ? "text-win" : p.points < 0 ? "text-loss" : "text-muted-foreground"
              )}>
                {p.points > 0 ? "+" : ""}{p.points}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* MVP & Top Players */}
      {playerRankings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="space-y-4"
        >
          {/* MVP */}
          {mvp && (
            <div className="bg-gradient-to-r from-accent/10 to-primary/5 border border-accent/20 rounded-lg p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center">
                <Star className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-[10px] font-mono text-accent uppercase tracking-widest">MVP Turnieju</p>
                <p className="text-xl font-heading font-bold text-foreground">{mvp.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{mvp.team} • Rating: {mvp.avgRating.toFixed(2)} • {mvp.totalKills}K/{mvp.totalDeaths}D</p>
              </div>
            </div>
          )}

          {/* Top 10 players */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-secondary/50 font-heading font-bold text-foreground text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Top gracze turnieju
            </div>
            <div className="grid grid-cols-12 gap-1 px-4 py-2 text-[10px] font-mono text-muted-foreground uppercase bg-secondary/30">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Gracz</div>
              <div className="col-span-3">Drużyna</div>
              <div className="col-span-1 text-center">Mapy</div>
              <div className="col-span-1 text-center">Rating</div>
              <div className="col-span-2 text-center">K/D</div>
            </div>
            {playerRankings.slice(0, 10).map((p, i) => (
              <div key={p.name} className="grid grid-cols-12 gap-1 px-4 py-2 text-sm border-t border-border/30 items-center">
                <div className="col-span-1 font-mono text-xs text-muted-foreground">{i + 1}</div>
                <div className={cn("col-span-4 font-medium truncate", i === 0 ? "text-accent" : "text-foreground")}>{p.name}</div>
                <div className="col-span-3 text-muted-foreground text-xs truncate">{p.team}</div>
                <div className="col-span-1 text-center font-mono text-xs text-muted-foreground">{p.maps}</div>
                <div className={cn("col-span-1 text-center font-mono text-xs font-bold", p.avgRating >= 1.1 ? "text-win" : p.avgRating <= 0.9 ? "text-loss" : "text-foreground")}>
                  {p.avgRating.toFixed(2)}
                </div>
                <div className="col-span-2 text-center font-mono text-xs text-muted-foreground">
                  {p.totalKills}/{p.totalDeaths}
                </div>
              </div>
            ))}
          </div>

          {/* Quick stats row */}
          {topFragger && topKD && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-[10px] font-mono text-muted-foreground uppercase">Top Fragger</p>
                <p className="font-heading font-bold text-foreground">{topFragger.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{topFragger.totalKills} kills • {topFragger.team}</p>
              </div>
              <div className="bg-card border border-border rounded-lg p-3">
                <p className="text-[10px] font-mono text-muted-foreground uppercase">Najlepszy K/D</p>
                <p className="font-heading font-bold text-foreground">{topKD.name}</p>
                <p className="text-xs text-muted-foreground font-mono">{topKD.kd.toFixed(2)} K/D • {topKD.team}</p>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Continue button */}
      <div className="flex justify-center">
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-8 py-3 gradient-primary text-primary-foreground rounded-md font-heading font-semibold hover:opacity-90 transition-opacity"
        >
          Zamknij podsumowanie
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

export default TournamentSummary;
