import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy, MapPin, Users, Calendar, Swords, Crown } from "lucide-react";
import { type Tournament, generateBracket, type BracketMatch } from "@/data/tournaments";
import { cn } from "@/lib/utils";

interface TournamentDetailProps {
  tournament: Tournament;
  onBack: () => void;
}

const roundNames: Record<number, Record<number, string>> = {
  2: { 1: "Semi-Finals", 2: "Grand Final" },
  3: { 1: "Quarter-Finals", 2: "Semi-Finals", 3: "Grand Final" },
  4: { 1: "Round of 16", 2: "Quarter-Finals", 3: "Semi-Finals", 4: "Grand Final" },
  5: { 1: "Round of 32", 2: "Round of 16", 3: "Quarter-Finals", 4: "Semi-Finals", 5: "Grand Final" },
};

const TournamentDetail = ({ tournament, onBack }: TournamentDetailProps) => {
  const bracket = useMemo(() => generateBracket(tournament), [tournament.id]);
  const totalRounds = Math.max(...bracket.map((m) => m.round));
  const names = roundNames[totalRounds] || {};

  const winner = bracket.find((m) => m.round === totalRounds)?.winner;

  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <button onClick={onBack} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Powrót do listy turniejów
        </button>

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
              tournament.status === "live" ? "bg-destructive/20 text-destructive border-destructive/40" :
              tournament.status === "completed" ? "bg-muted text-muted-foreground border-border" :
              "bg-primary/10 text-primary border-primary/30"
            )}>
              {tournament.status === "live" ? "🔴 LIVE" : tournament.status.toUpperCase()}
            </span>
          </div>

          <h2 className="text-4xl font-heading font-bold text-foreground mb-2">{tournament.name}</h2>
          <p className="text-muted-foreground mb-4">{tournament.description}</p>

          <div className="flex flex-wrap gap-6 text-sm">
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
        {winner && tournament.status === "completed" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-8 p-6 rounded-lg border border-accent/30 bg-accent/5 text-center"
          >
            <Crown className="w-8 h-8 text-accent mx-auto mb-2" />
            <p className="text-xs font-mono text-accent uppercase tracking-widest mb-1">Zwycięzca</p>
            <p className="text-3xl font-heading font-bold text-foreground">{winner}</p>
          </motion.div>
        )}

        {/* Bracket */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-8 min-w-max">
            {Array.from({ length: totalRounds }, (_, r) => r + 1).map((round) => {
              const roundMatches = bracket.filter((m) => m.round === round);
              const roundName = names[round] || `Runda ${round}`;
              const isFinal = round === totalRounds;

              return (
                <div key={round} className="flex flex-col">
                  <h4 className={cn(
                    "font-heading font-bold text-sm mb-4 text-center uppercase tracking-wider",
                    isFinal ? "text-accent" : "text-muted-foreground"
                  )}>
                    {roundName}
                  </h4>

                  <div className="flex flex-col justify-around flex-1 gap-4">
                    {roundMatches.map((match, i) => (
                      <MatchCard key={match.id} match={match} index={i} isFinal={isFinal} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

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

const MatchCard = ({ match, index, isFinal }: { match: BracketMatch; index: number; isFinal: boolean }) => {
  const isPlayed = match.score1 !== null;
  const isTBD = match.team1 === "TBD" || match.team2 === "TBD";

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "w-56 bg-card border rounded-lg overflow-hidden",
        isFinal ? "border-accent/30" : "border-border",
        isPlayed && "neon-border"
      )}
    >
      <TeamRow
        team={match.team1}
        score={match.score1}
        isWinner={match.winner === match.team1}
        isPlayed={isPlayed}
        isTBD={isTBD}
      />
      <div className="h-px bg-border" />
      <TeamRow
        team={match.team2}
        score={match.score2}
        isWinner={match.winner === match.team2}
        isPlayed={isPlayed}
        isTBD={isTBD}
      />
    </motion.div>
  );
};

const TeamRow = ({ team, score, isWinner, isPlayed, isTBD }: {
  team: string;
  score: number | null;
  isWinner: boolean;
  isPlayed: boolean;
  isTBD: boolean;
}) => (
  <div className={cn(
    "flex items-center justify-between px-3 py-2 text-sm",
    isWinner && isPlayed ? "bg-primary/10" : "",
    !isWinner && isPlayed ? "opacity-50" : "",
    isTBD && "opacity-30"
  )}>
    <span className={cn(
      "font-medium truncate mr-2",
      isWinner ? "text-foreground font-bold" : "text-muted-foreground"
    )}>
      {team}
    </span>
    {score !== null && (
      <span className={cn(
        "font-mono font-bold text-sm min-w-[20px] text-center",
        isWinner ? "text-primary" : "text-muted-foreground"
      )}>
        {score}
      </span>
    )}
  </div>
);

export default TournamentDetail;
