import { motion } from "framer-motion";
import { Zap, Trophy, Users, Calendar } from "lucide-react";
import { initialTournaments as tournaments, teamDatabase, calendarEvents, type TeamData } from "@/data/tournaments";
import { cn } from "@/lib/utils";

interface OverviewProps {
  onNavigate: (tab: "tournaments" | "calendar" | "rankings") => void;
  dynamicRanking?: TeamData[];
}

const OverviewSection = ({ onNavigate, dynamicRanking }: OverviewProps) => {
  const rankingSource = dynamicRanking && dynamicRanking.length > 0 ? dynamicRanking : teamDatabase;
  const upcomingTournaments = tournaments.filter((t) => t.status === "upcoming").slice(0, 5);
  const topTeams = rankingSource.slice(0, 5);
  const upcomingEvents = calendarEvents.slice(0, 4);

  return (
    <section className="py-12">
      <div className="container mx-auto px-4 space-y-10">
        {/* Stats Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Turnieje w sezonie", value: tournaments.length, icon: Trophy, color: "text-accent" },
            { label: "Nadchodzące", value: upcomingTournaments.length, icon: Calendar, color: "text-primary" },
            { label: "Łączna pula nagród", value: "$10M+", icon: Zap, color: "text-accent" },
            { label: "Drużyny w rankingu", value: rankingSource.length, icon: Users, color: "text-win" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card border border-border rounded-lg p-4 text-center"
            >
              <stat.icon className={cn("w-5 h-5 mx-auto mb-2", stat.color)} />
              <p className="font-heading text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Nadchodzące turnieje
              </h3>
              <button onClick={() => onNavigate("tournaments")} className="text-primary text-sm font-medium hover:underline">
                Symuluj sezon →
              </button>
            </div>
            <div className="space-y-3">
              {upcomingTournaments.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between p-4 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono px-2 py-0.5 rounded border bg-primary/10 text-primary border-primary/30">{t.tier}</span>
                      <span className="text-xs font-mono text-muted-foreground">{t.format === "major" ? "⭐ MAJOR" : t.format.toUpperCase()}</span>
                    </div>
                    <h4 className="font-heading font-bold text-foreground">{t.name}</h4>
                    <p className="text-muted-foreground text-sm">{t.location}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-primary font-bold text-sm">{t.prizePool}</p>
                    <p className="text-muted-foreground text-xs">{t.teams} drużyn</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Top Teams + Events */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
                <Trophy className="w-5 h-5 text-accent" />
                Top Drużyny (ACSR)
              </h3>
              <button onClick={() => onNavigate("rankings")} className="text-primary text-sm font-medium hover:underline">
                Pełny ranking →
              </button>
            </div>
            <div className="space-y-2">
              {topTeams.map((team, i) => (
                <motion.div
                  key={team.name}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-4 p-3 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors"
                >
                  <span className={cn(
                    "w-8 h-8 rounded flex items-center justify-center font-bold text-sm border",
                    i === 0 ? "bg-accent/20 text-accent border-accent/40" :
                    i === 1 ? "bg-silver/20 text-silver border-silver/40" :
                    i === 2 ? "bg-bronze/20 text-bronze border-bronze/40" :
                    "bg-muted text-muted-foreground border-border"
                  )}>
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <p className="font-heading font-bold text-foreground">{team.name}</p>
                    <p className="text-xs text-muted-foreground">{team.roster.join(", ")}</p>
                  </div>
                  <span className="font-mono font-bold text-primary">{team.points.toLocaleString()} pkt</span>
                </motion.div>
              ))}
            </div>

            {/* Upcoming Events */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Nadchodzące wydarzenia
                </h3>
                <button onClick={() => onNavigate("calendar")} className="text-primary text-sm font-medium hover:underline">
                  Kalendarz →
                </button>
              </div>
              <div className="space-y-2">
                {upcomingEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
                    <div className="text-center min-w-[48px]">
                      <p className="font-mono text-xs text-muted-foreground">
                        {new Date(event.date + "T12:00:00").toLocaleDateString("pl-PL", { month: "short" })}
                      </p>
                      <p className="font-heading text-xl font-bold text-primary">
                        {new Date(event.date + "T12:00:00").getDate()}
                      </p>
                    </div>
                    <div>
                      <p className="font-heading font-bold text-foreground text-sm">{event.title}</p>
                      <p className="text-muted-foreground text-xs">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OverviewSection;
