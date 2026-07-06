import { useMemo } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { predictBothOutcomes, getRankingSnapshot } from "@/lib/vrsFormula";
import { isPlaceholder } from "@/lib/teamHelpers";

interface Props {
  team1: string;
  team2: string;
  tier: string;
  /** Hide if match is already decided. */
  decided?: boolean;
  compact?: boolean;
}

/**
 * Tiny inline preview shown on bracket / Swiss cards before a match is played.
 * Shows the VRS points each side would gain/lose if they won.
 */
export const MatchPredictionBadge = ({ team1, team2, tier, decided, compact }: Props) => {
  const ranking = useMemo(() => getRankingSnapshot(), []);
  if (decided) return null;
  if (!team1 || !team2 || team1 === "BYE" || team2 === "BYE") return null;
  if (isPlaceholder(team1) || isPlaceholder(team2)) return null;
  const isNat1 = !!ranking.find(t => t.name === team1)?.isNational;
  const isNat2 = !!ranking.find(t => t.name === team2)?.isNational;
  if (isNat1 || isNat2) return null;

  const { team1Wins, team2Wins } = predictBothOutcomes(team1, team2, tier, ranking);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 text-xs font-mono px-2 py-1 bg-secondary/30 border-t border-border/40",
        compact && "py-0.5",
      )}
      title={`VRS: jeśli ${team1} wygra +${team1Wins.winPoints}/−${team1Wins.lossPoints} • jeśli ${team2} wygra +${team2Wins.winPoints}/−${team2Wins.lossPoints}`}
    >
      <span className="flex items-center gap-0.5 text-[hsl(var(--win))]/90">
        <TrendingUp className="w-2.5 h-2.5" />+{team1Wins.winPoints}
        <span className="text-destructive/70 ml-1">
          <TrendingDown className="w-2.5 h-2.5 inline" />−{team2Wins.lossPoints}
        </span>
      </span>
      <span className="text-muted-foreground/60 text-xs uppercase tracking-wider">VRS</span>
      <span className="flex items-center gap-0.5 text-[hsl(var(--win))]/90">
        +{team2Wins.winPoints}
        <TrendingUp className="w-2.5 h-2.5" />
        <span className="text-destructive/70 ml-1">
          −{team1Wins.lossPoints}
          <TrendingDown className="w-2.5 h-2.5 inline" />
        </span>
      </span>
    </div>
  );
};

export default MatchPredictionBadge;
