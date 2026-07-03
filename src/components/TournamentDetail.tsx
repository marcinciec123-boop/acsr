import { motion } from "framer-motion";
import { ArrowLeft, Trophy, MapPin, Users, Calendar, Crown, Zap } from "lucide-react";
import { type Tournament, type TournamentSimulation, type SwissResult, type GroupResult, type KnockoutResult, type MajorStage, type MatchResult } from "@/data/tournaments";
import { cn } from "@/lib/utils";
import { useState } from "react";
import FullResultsPanel from "@/components/tournament/FullResultsPanel";

interface TournamentDetailProps {
  tournament: Tournament;
  simulation: TournamentSimulation;
  onBack: () => void;
}

// ===== Sub-components =====

const MatchRow = ({ match }: { match: MatchResult }) => (
  <div className="flex items-center bg-card border border-border rounded-md overflow-hidden text-sm">
    <div className={cn(
      "flex-1 px-3 py-2 text-right truncate font-medium",
      match.winner === match.team1 ? "text-foreground font-bold" : "text-muted-foreground"
    )}>
      {match.team1}
    </div>
    <div className="px-3 py-2 font-mono text-xs bg-secondary min-w-[60px] text-center">
      <span className={match.winner === match.team1 ? "text-primary font-bold" : "text-muted-foreground"}>{match.score1}</span>
      <span className="text-muted-foreground mx-1">:</span>
      <span className={match.winner === match.team2 ? "text-primary font-bold" : "text-muted-foreground"}>{match.score2}</span>
    </div>
    <div className={cn(
      "flex-1 px-3 py-2 truncate font-medium",
      match.winner === match.team2 ? "text-foreground font-bold" : "text-muted-foreground"
    )}>
      {match.team2}
    </div>
  </div>
);

const SwissView = ({ swiss, title }: { swiss: SwissResult; title?: string }) => (
  <div className="space-y-6">
    {title && <h3 className="font-heading text-lg font-bold text-foreground">{title}</h3>}

    {/* Standings */}
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-secondary/50 text-xs font-mono text-muted-foreground uppercase">
        <div className="col-span-1">#</div>
        <div className="col-span-7">Drużyna</div>
        <div className="col-span-2 text-center">W-L</div>
        <div className="col-span-2 text-center">Status</div>
      </div>
      {swiss.standings.map((s, i) => (
        <div key={s.team} className={cn(
          "grid grid-cols-12 gap-1 px-4 py-2 border-t border-border/50 items-center text-sm",
          s.qualified && "bg-win/5",
          s.eliminated && "bg-destructive/5 opacity-60"
        )}>
          <div className="col-span-1 font-mono text-muted-foreground">{i + 1}</div>
          <div className="col-span-7 font-medium text-foreground truncate">{s.team}</div>
          <div className="col-span-2 text-center font-mono">
            <span className="text-win">{s.wins}</span>
            <span className="text-muted-foreground">-</span>
            <span className="text-loss">{s.losses}</span>
          </div>
          <div className="col-span-2 text-center">
            {s.qualified && <span className="text-xs font-mono text-win bg-win/10 px-2 py-0.5 rounded border border-win/30">✓ AWA</span>}
            {s.eliminated && <span className="text-xs font-mono text-loss bg-destructive/10 px-2 py-0.5 rounded border border-destructive/30">✗ ELIM</span>}
          </div>
        </div>
      ))}
    </div>

    {/* Round-by-round matches */}
    <div className="space-y-4">
      {swiss.rounds.map((round) => (
        <div key={round.roundNumber}>
          <h4 className="font-heading text-sm font-bold text-muted-foreground mb-2 uppercase tracking-wider">
            Runda {round.roundNumber} {round.matches[0]?.bo > 1 ? `(BO${round.matches[0].bo})` : "(BO1)"}
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {round.matches.map((m, i) => <MatchRow key={i} match={m} />)}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const GroupsView = ({ groups }: { groups: GroupResult[] }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {groups.map((group) => (
      <div key={group.groupName} className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-2 bg-secondary/50 font-heading font-bold text-foreground">
          Grupa {group.groupName}
        </div>
        {group.standings.map((s, i) => {
          const isQualified = group.qualified.includes(s.team);
          return (
            <div key={s.team} className={cn(
              "grid grid-cols-12 gap-1 px-4 py-2 border-t border-border/50 items-center text-sm",
              isQualified && "bg-win/5"
            )}>
              <div className="col-span-1 font-mono text-muted-foreground">{i + 1}</div>
              <div className="col-span-6 font-medium text-foreground truncate">{s.team}</div>
              <div className="col-span-2 text-center font-mono text-sm">
                <span className="text-win">{s.wins}</span>
                <span className="text-muted-foreground">-</span>
                <span className="text-loss">{s.losses}</span>
              </div>
              <div className="col-span-1 text-center font-mono text-xs text-muted-foreground">{s.roundDiff > 0 ? "+" : ""}{s.roundDiff}</div>
              <div className="col-span-2 text-center">
                {isQualified && <span className="text-xs font-mono text-win">✓</span>}
              </div>
            </div>
          );
        })}
      </div>
    ))}
  </div>
);

const KnockoutView = ({ knockout }: { knockout: KnockoutResult }) => (
  <div className="overflow-x-auto pb-4">
    <div className="flex gap-8 min-w-max">
      {knockout.rounds.filter(r => !r.matches.every(m => m.team2 === "BYE")).map((round, ri) => (
        <div key={ri} className="flex flex-col">
          <h4 className={cn(
            "font-heading font-bold text-sm mb-4 text-center uppercase tracking-wider",
            ri === knockout.rounds.filter(r => !r.matches.every(m => m.team2 === "BYE")).length - 1 ? "text-accent" : "text-muted-foreground"
          )}>
            {round.name}
          </h4>
          <div className="flex flex-col justify-around flex-1 gap-4">
            {round.matches.filter(m => m.team2 !== "BYE").map((match, mi) => (
              <motion.div
                key={mi}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: mi * 0.05 }}
                className={cn(
                  "w-56 bg-card border rounded-lg overflow-hidden",
                  ri === knockout.rounds.filter(r => !r.matches.every(m => m.team2 === "BYE")).length - 1 ? "border-accent/30" : "border-border"
                )}
              >
                <div className={cn("flex items-center justify-between px-3 py-2 text-sm", match.winner === match.team1 ? "bg-primary/10" : "opacity-60")}>
                  <span className={cn("font-medium truncate mr-2", match.winner === match.team1 ? "text-foreground font-bold" : "text-muted-foreground")}>{match.team1}</span>
                  <span className={cn("font-mono font-bold text-sm", match.winner === match.team1 ? "text-primary" : "text-muted-foreground")}>{match.score1}</span>
                </div>
                <div className="h-px bg-border" />
                <div className={cn("flex items-center justify-between px-3 py-2 text-sm", match.winner === match.team2 ? "bg-primary/10" : "opacity-60")}>
                  <span className={cn("font-medium truncate mr-2", match.winner === match.team2 ? "text-foreground font-bold" : "text-muted-foreground")}>{match.team2}</span>
                  <span className={cn("font-mono font-bold text-sm", match.winner === match.team2 ? "text-primary" : "text-muted-foreground")}>{match.score2}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ===== Main Component =====

const TournamentDetail = ({ tournament, simulation, onBack }: TournamentDetailProps) => {
  const [activeStage, setActiveStage] = useState(0);

  const formatLabel: Record<string, string> = {
    "knockout": "Knockout",
    "swiss+knockout": "Swiss → Playoffs",
    "groups+knockout": "Grupy → Playoffs",
    "major": "Major (Challengers → Legends → Champions)",
  };

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Powrót do listy turniejów
        </button>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className={cn(
              "font-heading font-bold text-2xl",
              tournament.tier === "S" ? "text-accent" : tournament.tier === "A" ? "text-primary" : tournament.tier === "B" ? "text-silver" : "text-muted-foreground"
            )}>
              {tournament.tier}-Tier
            </span>
            <span className={cn(
              "text-xs font-mono px-2 py-1 rounded border",
              tournament.status === "completed" ? "bg-win/10 text-win border-win/30" : "bg-primary/10 text-primary border-primary/30"
            )}>
              {tournament.status === "completed" ? "ZAKOŃCZONY" : tournament.status.toUpperCase()}
            </span>
            <span className="text-xs font-mono px-2 py-1 rounded border border-border text-muted-foreground">
              {formatLabel[tournament.format]}
            </span>
          </div>

          <h2 className="text-4xl font-heading font-bold text-foreground mb-2">{tournament.name}</h2>
          <p className="text-muted-foreground text-sm mb-1">{tournament.formatDetails}</p>

          <div className="flex flex-wrap gap-6 text-sm mt-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Trophy className="w-4 h-4 text-accent" />
              <span className="font-mono text-foreground">{tournament.prizePool}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span>{tournament.teams} drużyn</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span>{tournament.location}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span className="font-mono">
                {new Date(tournament.startDate).toLocaleDateString("pl-PL", { day: "numeric", month: "short" })}
                {" — "}
                {new Date(tournament.endDate).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Winner Banner */}
        {simulation.winner && tournament.status === "completed" && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mb-8 p-6 rounded-lg border border-accent/30 bg-accent/5 text-center">
            <Crown className="w-8 h-8 text-accent mx-auto mb-2" />
            <p className="text-xs font-mono text-accent uppercase tracking-widest mb-1">Zwycięzca</p>
            <p className="text-3xl font-heading font-bold text-foreground">{simulation.winner}</p>
          </motion.div>
        )}

        {/* Major Stages tabs */}
        {tournament.format === "major" && simulation.majorStages && (
          <div className="mb-6">
            <div className="flex gap-2 flex-wrap">
              {simulation.majorStages.map((stage, i) => (
                <button
                  key={i}
                  onClick={() => setActiveStage(i)}
                  className={cn(
                    "px-4 py-2 text-sm font-heading font-bold rounded-md border transition-colors",
                    activeStage === i
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {stage.name}
                </button>
              ))}
            </div>

            <div className="mt-6">
              {simulation.majorStages[activeStage].type === "swiss" && simulation.majorStages[activeStage].swiss && (
                <SwissView swiss={simulation.majorStages[activeStage].swiss!} />
              )}
              {simulation.majorStages[activeStage].type === "knockout" && simulation.majorStages[activeStage].knockout && (
                <KnockoutView knockout={simulation.majorStages[activeStage].knockout!} />
              )}
            </div>
          </div>
        )}

        {/* Swiss + Knockout */}
        {tournament.format === "swiss+knockout" && (
          <div className="space-y-8">
            {simulation.swiss && <SwissView swiss={simulation.swiss} title="Faza Swiss" />}
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" />
                Playoffs
              </h3>
              {simulation.knockout && <KnockoutView knockout={simulation.knockout} />}
            </div>
          </div>
        )}

        {/* Groups + Knockout */}
        {tournament.format === "groups+knockout" && (
          <div className="space-y-8">
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-4">Faza Grupowa</h3>
              {simulation.groups && <GroupsView groups={simulation.groups} />}
            </div>
            <div>
              <h3 className="font-heading text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-accent" />
                Playoffs
              </h3>
              {simulation.knockout && <KnockoutView knockout={simulation.knockout} />}
            </div>
          </div>
        )}

        {/* Pure Knockout */}
        {tournament.format === "knockout" && simulation.knockout && (
          <KnockoutView knockout={simulation.knockout} />
        )}

        {/* Participants */}
        <div className="mt-10">
          <h3 className="font-heading text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Uczestnicy ({tournament.participants.length})
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {tournament.participants.map((team) => (
              <div key={team} className="bg-card border border-border rounded-md px-3 py-2 text-sm font-medium text-foreground text-center hover:border-primary/30 transition-colors">
                {team}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default TournamentDetail;
