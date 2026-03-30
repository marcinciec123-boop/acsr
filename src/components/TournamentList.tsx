import { motion } from "framer-motion";
import { MapPin, Users, Trophy, Zap } from "lucide-react";
import { tournaments, type Tournament } from "@/data/tournaments";
import { cn } from "@/lib/utils";

const statusConfig = {
  live: { label: "LIVE", className: "bg-destructive/20 text-destructive border-destructive/40" },
  upcoming: { label: "UPCOMING", className: "bg-primary/10 text-primary border-primary/30" },
  completed: { label: "COMPLETED", className: "bg-muted text-muted-foreground border-border" },
};

const tierColors = {
  S: "text-accent gradient-accent bg-clip-text",
  A: "text-primary",
  B: "text-silver",
};

const TournamentCard = ({ tournament, index }: { tournament: Tournament; index: number }) => {
  const status = statusConfig[tournament.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className={cn(
        "group relative bg-card border border-border rounded-lg p-5 hover:border-primary/40 transition-all duration-300",
        tournament.status === "live" && "border-destructive/30 neon-border"
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
          </div>
          <h3 className="font-heading text-xl font-bold text-foreground group-hover:text-primary transition-colors">
            {tournament.name}
          </h3>
          <p className="text-muted-foreground text-sm">{tournament.organizer}</p>
        </div>
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
          <span>{tournament.location}</span>
        </div>
        <div className="text-sm text-muted-foreground font-mono">
          {new Date(tournament.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          {" – "}
          {new Date(tournament.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
      </div>
    </motion.div>
  );
};

const TournamentList = () => {
  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-8">
          <Trophy className="w-6 h-6 text-primary" />
          <h2 className="text-3xl font-heading font-bold text-foreground">Tournaments</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournaments.map((t, i) => (
            <TournamentCard key={t.id} tournament={t} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TournamentList;
