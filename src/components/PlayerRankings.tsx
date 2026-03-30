import { motion } from "framer-motion";
import { Users, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { players } from "@/data/tournaments";
import { cn } from "@/lib/utils";

const getRankBadge = (rank: number) => {
  if (rank === 1) return "bg-accent/20 text-accent border-accent/40";
  if (rank === 2) return "bg-silver/20 text-silver border-silver/40";
  if (rank === 3) return "bg-bronze/20 text-bronze border-bronze/40";
  return "bg-muted text-muted-foreground border-border";
};

const PlayerRankings = () => {
  const sortedPlayers = [...players].sort((a, b) => b.rating - a.rating);

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-8">
          <Users className="w-6 h-6 text-primary" />
          <h2 className="text-3xl font-heading font-bold text-foreground">Player Rankings</h2>
        </div>

        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-secondary/50 border-b border-border text-xs font-mono text-muted-foreground uppercase tracking-wider">
            <div className="col-span-1 text-center">#</div>
            <div className="col-span-3">Player</div>
            <div className="col-span-2">Team</div>
            <div className="col-span-1 text-center">Rating</div>
            <div className="col-span-1 text-center hidden md:block">K/D</div>
            <div className="col-span-1 text-center hidden md:block">ADR</div>
            <div className="col-span-1 text-center hidden md:block">KAST</div>
            <div className="col-span-1 text-center hidden lg:block">Maps</div>
            <div className="col-span-1 text-center hidden lg:block">Trend</div>
          </div>

          {/* Rows */}
          {sortedPlayers.map((player, index) => {
            const rank = index + 1;
            const kd = (player.kills / player.deaths).toFixed(2);
            const trend = rank <= 3 ? "up" : rank >= 8 ? "down" : "stable";

            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className={cn(
                  "grid grid-cols-12 gap-2 px-4 py-3 items-center border-b border-border/50 hover:bg-secondary/30 transition-colors",
                  rank <= 3 && "bg-primary/5"
                )}
              >
                <div className="col-span-1 text-center">
                  <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded text-sm font-bold border", getRankBadge(rank))}>
                    {rank}
                  </span>
                </div>

                <div className="col-span-3 flex items-center gap-2">
                  <span className="text-lg">{player.country}</span>
                  <div>
                    <p className="font-heading font-bold text-foreground">{player.name}</p>
                    <p className="text-xs text-muted-foreground hidden sm:block">{player.realName}</p>
                  </div>
                </div>

                <div className="col-span-2">
                  <span className="text-sm text-secondary-foreground font-medium">{player.team}</span>
                </div>

                <div className="col-span-1 text-center">
                  <span className={cn(
                    "font-mono font-bold text-sm",
                    player.rating >= 1.25 ? "text-primary neon-text" : player.rating >= 1.15 ? "text-win" : "text-foreground"
                  )}>
                    {player.rating.toFixed(2)}
                  </span>
                </div>

                <div className="col-span-1 text-center hidden md:block">
                  <span className="font-mono text-sm text-foreground">{kd}</span>
                </div>

                <div className="col-span-1 text-center hidden md:block">
                  <span className="font-mono text-sm text-foreground">{player.adr.toFixed(1)}</span>
                </div>

                <div className="col-span-1 text-center hidden md:block">
                  <span className="font-mono text-sm text-muted-foreground">{player.kast}%</span>
                </div>

                <div className="col-span-1 text-center hidden lg:block">
                  <span className="font-mono text-sm text-muted-foreground">{player.maps}</span>
                </div>

                <div className="col-span-1 text-center hidden lg:block">
                  {trend === "up" && <TrendingUp className="w-4 h-4 text-win mx-auto" />}
                  {trend === "down" && <TrendingDown className="w-4 h-4 text-loss mx-auto" />}
                  {trend === "stable" && <Minus className="w-4 h-4 text-muted-foreground mx-auto" />}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PlayerRankings;
