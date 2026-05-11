import { motion } from "framer-motion";
import { Trophy, Crown } from "lucide-react";
import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { type MatchResult, type KnockoutRound } from "@/data/tournaments";
import { cn } from "@/lib/utils";

interface PlayoffBracketProps {
  completedRounds: KnockoutRound[];
  currentMatches: MatchResult[];
  currentRoundName: string;
  winner: string;
  finished: boolean;
  onMatchClick?: (roundIdx: number, matchIdx: number, isCurrent: boolean) => void;
}

// Helper to get display scores
const getDisplayScores = (m: MatchResult): [number | string, number | string] => {
  if (m.bo === 1 && m.mapScore1 !== undefined && m.mapScore2 !== undefined) {
    return [m.mapScore1, m.mapScore2];
  }
  return [m.score1, m.score2];
};

const BracketMatch = ({
  match,
  isResolved,
  onClick,
  size = "normal",
}: {
  match: MatchResult;
  isResolved: boolean;
  onClick?: () => void;
  size?: "normal" | "large";
}) => {
  if (match.team2 === "BYE") return null;

  const [ds1, ds2] = getDisplayScores(match);
  const isLarge = size === "large";

  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-card border rounded-md overflow-hidden text-left transition-all hover:border-primary/50 w-full",
        isResolved ? "border-win/20" : "border-border",
        isLarge ? "min-w-[220px]" : "min-w-[180px]"
      )}
    >
      {/* Team 1 */}
      <div className={cn(
        "flex items-center justify-between px-2 py-1.5 border-b border-border/30",
        isResolved && match.winner === match.team1 ? "bg-win/5" : ""
      )}>
        <span className={cn(
          "text-xs font-medium truncate flex-1",
          isResolved && match.winner === match.team1 ? "text-foreground font-bold" : "text-muted-foreground"
        )}>
          {match.team1}
        </span>
        <span className={cn(
          "font-mono text-xs ml-2 min-w-[20px] text-right",
          isResolved && match.winner === match.team1 ? "text-primary font-bold" : "text-muted-foreground"
        )}>
          {isResolved ? ds1 : "-"}
        </span>
      </div>
      {/* Team 2 */}
      <div className={cn(
        "flex items-center justify-between px-2 py-1.5",
        isResolved && match.winner === match.team2 ? "bg-win/5" : ""
      )}>
        <span className={cn(
          "text-xs font-medium truncate flex-1",
          isResolved && match.winner === match.team2 ? "text-foreground font-bold" : "text-muted-foreground"
        )}>
          {match.team2}
        </span>
        <span className={cn(
          "font-mono text-xs ml-2 min-w-[20px] text-right",
          isResolved && match.winner === match.team2 ? "text-primary font-bold" : "text-muted-foreground"
        )}>
          {isResolved ? ds2 : "-"}
        </span>
      </div>
      {/* BO indicator */}
      <div className="bg-secondary/50 px-2 py-0.5 text-center">
        <span className="text-[9px] font-mono text-muted-foreground">BO{match.bo}</span>
      </div>
    </button>
  );
};

const PlayoffBracket = ({
  completedRounds,
  currentMatches,
  currentRoundName,
  winner,
  finished,
  onMatchClick,
}: PlayoffBracketProps) => {
  const celebratedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!finished || !winner) return;
    if (celebratedRef.current === winner) return;
    celebratedRef.current = winner;

    const fire = (particleRatio: number, opts: confetti.Options) => {
      confetti({
        origin: { y: 0.7 },
        particleCount: Math.floor(220 * particleRatio),
        ...opts,
      });
    };
    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  }, [finished, winner]);

  // Combine all rounds for bracket display
  const allRounds = [
    ...completedRounds.map((r, i) => ({ name: r.name, matches: r.matches, isCompleted: true, roundIdx: i })),
    ...(currentMatches.length > 0 ? [{ name: currentRoundName, matches: currentMatches, isCompleted: false, roundIdx: completedRounds.length }] : []),
  ];

  if (allRounds.length === 0) return null;

  // Calculate bracket dimensions
  const totalRounds = allRounds.length + (finished ? 0 : 1); // approximate remaining

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
    >
      {/* Winner display */}
      {finished && winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-4 rounded-lg border border-accent/30 bg-accent/5 text-center"
        >
          <Crown className="w-8 h-8 text-accent mx-auto mb-2" />
          <p className="text-xs font-mono text-accent uppercase tracking-widest mb-1">Zwycięzca</p>
          <p className="text-3xl font-heading font-bold text-foreground">{winner}</p>
        </motion.div>
      )}

      {/* Bracket visualization */}
      <div className="overflow-x-auto">
        <div className="flex gap-3 items-start min-w-max p-4">
          {allRounds.map((round, ri) => {
            const realMatches = round.matches.filter(m => m.team2 !== "BYE");
            // Liquipedia-style centering: each round's matches sit between their feeders
            const MATCH_H = 56;
            const BASE_GAP = 14;
            const gap = BASE_GAP + (Math.pow(2, ri) - 1) * (MATCH_H + BASE_GAP);
            const offset = ri === 0
              ? 0
              : Math.pow(2, ri - 1) * (MATCH_H + BASE_GAP) - BASE_GAP / 2 - MATCH_H / 2;

            return (
              <div key={ri} className="flex flex-col items-stretch">
                {/* Round header */}
                <div className="mb-3 text-center h-6">
                  <p className={cn(
                    "text-xs font-mono uppercase tracking-wider",
                    round.isCompleted ? "text-muted-foreground" : "text-primary"
                  )}>
                    {round.name}
                  </p>
                </div>

                {/* Matches with bracket-aligned vertical spacing */}
                <div className="flex flex-col" style={{ paddingTop: offset, gap: `${gap}px` }}>
                  {realMatches.map((m, mi) => (
                    <BracketMatch
                      key={mi}
                      match={m}
                      isResolved={!!m.winner}
                      size={realMatches.length <= 2 ? "large" : "normal"}
                      onClick={() => onMatchClick?.(ri, mi, !round.isCompleted)}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Trophy column */}
          {finished && winner && (
            <div className="flex flex-col items-center justify-center ml-4">
              <Trophy className="w-10 h-10 text-accent" />
              <p className="text-xs font-heading font-bold text-accent mt-2">{winner}</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default PlayoffBracket;
