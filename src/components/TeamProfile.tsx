import { useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Trophy, Users, Globe, TrendingUp, Medal, MapPin, User, ArrowRightLeft } from "lucide-react";
import { teamDatabase } from "@/data/tournaments";
import { playerNationalities } from "@/data/playerNationalities";
import { playerRealNames } from "@/data/playerRealNames";
import { playerRoles, roleColors, roleIcons } from "@/data/playerRoles";
import { countryFlag } from "@/lib/flags";
import { cn } from "@/lib/utils";
import type { TeamData, Transfer } from "@/lib/types";
import { loadFromStorage } from "@/lib/storage";

interface TeamProfileProps {
  teamName: string;
  onBack: () => void;
  teams?: TeamData[];
}

const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "from-blue-500 to-blue-700",
    "from-emerald-500 to-emerald-700",
    "from-purple-500 to-purple-700",
    "from-amber-500 to-amber-700",
    "from-rose-500 to-rose-700",
    "from-cyan-500 to-cyan-700",
    "from-indigo-500 to-indigo-700",
    "from-teal-500 to-teal-700",
  ];
  return colors[Math.abs(hash) % colors.length];
};

const TeamProfile = ({ teamName, onBack, teams }: TeamProfileProps) => {
  const rankingSource = teams && teams.length > 0 ? teams : teamDatabase;
  const sorted = [...rankingSource].sort((a, b) => b.points - a.points);
  const team = sorted.find((t) => t.name === teamName);
  const globalRank = team ? sorted.indexOf(team) + 1 : 0;
  const tier = globalRank <= 10 ? "Tier 1" : globalRank <= 30 ? "Tier 2" : globalRank <= 60 ? "Tier 3" : "Tier 4";
  const tierColor = globalRank <= 10 ? "text-accent" : globalRank <= 30 ? "text-primary" : globalRank <= 60 ? "text-[hsl(var(--silver))]" : "text-muted-foreground";

  // Load transfers from storage
  const teamTransfers = useMemo(() => {
    const transfers = loadFromStorage<Transfer[]>("transfers_data", []);
    return transfers.filter(t => t.oldTeam === teamName || t.newTeam === teamName);
  }, [teamName]);

  if (!team) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4">
          <button onClick={onBack} className="flex items-center gap-2 text-primary mb-6 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Powrót
          </button>
          <p className="text-muted-foreground">Drużyna nie znaleziona.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6">
      <div className="container mx-auto px-4 max-w-4xl">
        <button onClick={onBack} className="flex items-center gap-2 text-primary mb-6 hover:underline font-mono text-sm">
          <ArrowLeft className="w-4 h-4" /> Powrót do rankingu
        </button>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-6 mb-6"
        >
          <div className="flex items-start gap-4 sm:gap-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-secondary/50 border border-border flex items-center justify-center text-3xl sm:text-4xl shrink-0">
              {countryFlag(team.country)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground">{team.name}</h1>
                <span className={cn("text-xs font-heading font-bold px-2 py-0.5 rounded border", tierColor,
                  globalRank <= 10 ? "border-accent/40 bg-accent/10" : globalRank <= 30 ? "border-primary/40 bg-primary/10" : "border-border bg-muted"
                )}>
                  {tier}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" /> {team.region}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {countryFlag(team.country)} {team.country}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-mono text-muted-foreground uppercase">Ranking</p>
              <p className={cn("text-3xl sm:text-4xl font-heading font-bold", globalRank <= 3 ? "text-accent" : "text-primary")}>#{globalRank}</p>
              <p className="font-mono text-primary font-bold text-sm sm:text-lg">{team.points.toLocaleString()} pkt</p>
            </div>
          </div>
        </motion.div>

        {/* Roster */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card border border-border rounded-lg p-4 sm:p-6 mb-6"
        >
          <h2 className="text-lg font-heading font-bold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Roster ({team.roster.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {team.roster.map((player, i) => {
              const playerCountry = playerNationalities[player] || team.country;
              const realName = playerRealNames[player];
              const avatarGradient = getAvatarColor(player);
              return (
                <motion.div
                  key={player}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.15 + i * 0.05 }}
                  className="bg-secondary/30 border border-border rounded-lg p-3 sm:p-4 text-center"
                >
                  <div className={cn(
                    "w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white bg-gradient-to-br shadow-lg",
                    avatarGradient
                  )}>
                    <User className="w-5 h-5" />
                  </div>
                  <p className="font-heading font-bold text-foreground text-xs sm:text-sm">{player}</p>
                  {realName && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {realName.firstName} {realName.lastName}
                    </p>
                  )}
                  {playerRoles[player] && (
                    <span className={cn("inline-flex items-center gap-1 text-[10px] font-mono font-bold mt-1 px-1.5 py-0.5 rounded-full border", roleColors[playerRoles[player]])}>
                      {roleIcons[playerRoles[player]]} {playerRoles[player]}
                    </span>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center justify-center gap-1">
                    <span>{countryFlag(playerCountry)}</span>
                    <span>{playerCountry}</span>
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Transfer History */}
        {teamTransfers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-card border border-border rounded-lg p-4 sm:p-6"
          >
            <h2 className="text-lg font-heading font-bold text-foreground mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary" /> Ruchy kadrowe
            </h2>
            <div className="space-y-2">
              {teamTransfers.map((t) => {
                const isJoin = t.newTeam === teamName;
                return (
                  <div key={t.id} className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg border border-border/50">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      isJoin ? "bg-[hsl(var(--win))]/20 text-[hsl(var(--win))]" : "bg-[hsl(var(--loss))]/20 text-[hsl(var(--loss))]"
                    )}>
                      {isJoin ? "+" : "−"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-heading font-bold text-foreground text-sm">
                        {playerNationalities[t.player] && (
                          <span className="mr-1">{countryFlag(playerNationalities[t.player])}</span>
                        )}
                        {t.player}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isJoin
                          ? t.oldTeam === "-" ? "Free Agent → Dołączył" : `z ${t.oldTeam}`
                          : t.newTeam === "-" ? "Odszedł → Free Agent" : `do ${t.newTeam}`
                        }
                      </p>
                    </div>
                    <span className={cn(
                      "text-xs font-mono font-bold px-2 py-0.5 rounded",
                      isJoin ? "bg-[hsl(var(--win))]/10 text-[hsl(var(--win))]" : "bg-[hsl(var(--loss))]/10 text-[hsl(var(--loss))]"
                    )}>
                      {isJoin ? "IN" : "OUT"}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default TeamProfile;
