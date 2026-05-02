import { useState } from "react";
import { motion } from "framer-motion";
import { Trophy, X, Layers, Maximize2, Pencil, Sparkles, AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MatchResult } from "@/lib/types";
import {
  computeSwissStage,
  planNextSwissRound,
  swissRoundLabel,
  type SwissTeamStanding,
} from "@/lib/swissEngine";
import { getTeamFlag, isPlaceholder, teamTag } from "@/lib/teamHelpers";

interface Props {
  phaseTeams: string[];
  matches: MatchResult[];
  bo: 1 | 3 | 5;
  /** Number of teams that should advance from Swiss; defaults to half. */
  advanceCount?: number;
  /** Update a single match score / teams */
  onUpdate: (
    id: string,
    score1: number,
    score2: number,
    team1?: string,
    team2?: string,
  ) => void;
  /** Open detail page for a match */
  onOpenMatch?: (id: string) => void;
  /** Delete a match (rare; e.g. mistake) */
  onDelete?: (id: string) => void;
  /** Generate next Swiss round */
  onGenerateNextRound: (
    pairings: { team1: string; team2: string; bo: 1 | 3 | 5; round: string }[],
  ) => void;
}

const STATUS_STYLE: Record<SwissTeamStanding["status"], { row: string; pill: string; label: string }> = {
  advanced:    { row: "bg-[hsl(var(--win))]/[0.08] border-l-2 border-l-[hsl(var(--win))]", pill: "bg-[hsl(var(--win))]/20 text-[hsl(var(--win))] border-[hsl(var(--win))]/30", label: "AWANS" },
  eliminated:  { row: "bg-destructive/[0.06] border-l-2 border-l-destructive opacity-80", pill: "bg-destructive/20 text-destructive border-destructive/30", label: "OUT" },
  playing:     { row: "border-l-2 border-l-transparent", pill: "bg-secondary text-muted-foreground border-border", label: "GRA" },
};

const TeamCell = ({ name, withTag = false }: { name: string; withTag?: boolean }) => {
  if (isPlaceholder(name) || !name) {
    return <span className="italic text-muted-foreground text-xs">TBD</span>;
  }
  const flag = getTeamFlag(name);
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      {flag && <span className="text-sm leading-none shrink-0">{flag}</span>}
      {withTag && (
        <span className="text-[9px] font-mono px-1 py-0.5 bg-secondary/60 rounded text-muted-foreground shrink-0">
          {teamTag(name)}
        </span>
      )}
      <span className="truncate text-xs font-medium text-foreground">{name}</span>
    </span>
  );
};

/** Compact opponent + score cell shown in a per-round column of the overview. */
const OpponentCell = ({
  entry,
}: {
  entry: { opponent: string | null; result: "W" | "L" | ""; score: string; decisive: boolean } | undefined;
}) => {
  if (!entry || !entry.opponent) {
    return <span className="text-muted-foreground/40 text-[10px]">—</span>;
  }
  const flag = getTeamFlag(entry.opponent);
  const won = entry.result === "W";
  const pending = !entry.result;
  return (
    <div className={cn(
      "flex flex-col items-start gap-0.5 px-1.5 py-1 rounded border",
      pending && "bg-secondary/30 border-border/50",
      won && "bg-[hsl(var(--win))]/10 border-[hsl(var(--win))]/30",
      !won && !pending && "bg-destructive/10 border-destructive/30",
      entry.decisive && !pending && "ring-1 ring-[hsl(var(--gold))]/40",
    )}>
      <div className="flex items-center gap-1 min-w-0 max-w-full">
        {flag && <span className="text-[11px] leading-none shrink-0">{flag}</span>}
        <span className="text-[10px] truncate font-medium">{entry.opponent}</span>
      </div>
      <span className={cn(
        "text-[10px] font-mono font-bold tabular-nums",
        pending && "text-muted-foreground",
        won && "text-[hsl(var(--win))]",
        !won && !pending && "text-destructive",
      )}>
        {entry.score || "—"}
      </span>
    </div>
  );
};

/** Match card – click anywhere to open the full match panel. */
const RoundMatchCard = ({
  match,
  decisive,
  onOpenMatch,
  onDelete,
}: {
  match: MatchResult;
  decisive: boolean;
  onUpdate: (id: string, s1: number, s2: number) => void;
  onOpenMatch?: (id: string) => void;
  onDelete?: (id: string) => void;
}) => {
  const played = match.score1 + match.score2 > 0;
  const inProgress = (match.maps?.length || 0) > 0 && !played;
  const winner: 1 | 2 | 0 = !played ? 0 : match.score1 > match.score2 ? 1 : 2;

  const handleOpen = () => onOpenMatch?.(match.id);

  return (
    <div
      onClick={handleOpen}
      className={cn(
        "border rounded-md overflow-hidden bg-card text-xs transition-colors",
        onOpenMatch && "cursor-pointer hover:border-primary/60 hover:bg-card/80",
        decisive ? "border-[hsl(var(--gold))]/40 shadow-[0_0_0_1px_hsl(var(--gold)/0.15)]" : "border-border",
      )}
      title={onOpenMatch ? "Otwórz panel meczu" : undefined}
    >
      <div className="flex items-center justify-between px-2 py-1 bg-secondary/40 border-b border-border/50">
        <span className="text-[9px] font-mono text-muted-foreground tracking-wider">
          BO{match.bo || 1}
          {decisive && <span className="ml-1.5 text-[hsl(var(--gold))]">★ KLUCZOWY</span>}
          {inProgress && <span className="ml-1.5 text-primary">● W TRAKCIE</span>}
        </span>
        <div className="flex gap-0.5" onClick={(e) => e.stopPropagation()}>
          {onOpenMatch && (
            <button onClick={handleOpen} className="p-0.5 hover:bg-secondary rounded" title="Otwórz panel meczu">
              <Maximize2 className="w-2.5 h-2.5" />
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(match.id)} className="p-0.5 hover:bg-destructive/20 rounded text-destructive" title="Usuń">
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
      </div>
      {[1, 2].map((slot) => {
        const name = slot === 1 ? match.team1 : match.team2;
        const score = slot === 1 ? match.score1 : match.score2;
        const isWinner = winner === slot;
        return (
          <div key={slot} className={cn(
            "flex items-center justify-between px-2 py-1.5 border-b border-border/40 last:border-b-0",
            isWinner && "bg-[hsl(var(--win))]/10",
          )}>
            <TeamCell name={name} />
            <span className={cn(
              "font-mono font-bold tabular-nums text-sm ml-2",
              isWinner ? "text-[hsl(var(--win))]" : "text-muted-foreground",
            )}>
              {score}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export const SwissView = ({
  phaseTeams,
  matches,
  bo,
  advanceCount,
  onUpdate,
  onOpenMatch,
  onDelete,
  onGenerateNextRound,
}: Props) => {
  // Cap = wins required to advance. Default = ceil(rounds_target/2 + 1) ~ derive from advanceCount
  // For 16-team Major Swiss, Liquipedia uses 3 wins / 3 losses.
  const winCap = (() => {
    // If user set advanceCount = half the field, classic 3-X format → cap = 3
    const n = phaseTeams.length;
    if (n >= 14 && n <= 18) return 3;
    if (n >= 6 && n <= 10) return 2;
    if (n >= 26) return 4;
    return 3;
  })();

  const stage = computeSwissStage(phaseTeams, matches, { winCap });
  const advancedCount = stage.standings.filter(s => s.status === "advanced").length;
  const eliminatedCount = stage.standings.filter(s => s.status === "eliminated").length;
  const playingCount = stage.standings.filter(s => s.status === "playing").length;

  const handleGenerate = () => {
    const plan = planNextSwissRound(stage, { defaultBo: bo === 1 ? 1 : 1, decisiveBo: 3 });
    if (plan.error || plan.pairings.length === 0) return;
    onGenerateNextRound(
      plan.pairings.map(p => ({
        team1: p.team1,
        team2: p.team2,
        bo: p.bo,
        round: swissRoundLabel(plan.round),
      })),
    );
  };

  const nextPlan = planNextSwissRound(stage, { decisiveBo: 3 });
  const canGenerate = !nextPlan.error && nextPlan.pairings.length > 0;
  const allRounds = stage.rounds;
  const maxRound = Math.max(stage.currentRound, 5);

  return (
    <div className="space-y-5">
      {/* Header / counters / generate next */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 rounded-md bg-gradient-to-r from-primary/10 via-secondary/30 to-transparent border border-border">
        <div className="flex items-center gap-3 flex-wrap">
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-xs font-heading font-bold tracking-wide">SWISS STAGE</span>
          <span className="text-[10px] font-mono text-muted-foreground">
            Cel: {winCap} zwycięstw → awans • {winCap} porażek → eliminacja
          </span>
          <div className="flex gap-1.5">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[hsl(var(--win))]/15 text-[hsl(var(--win))] border border-[hsl(var(--win))]/30">
              <Trophy className="w-2.5 h-2.5 inline -mt-0.5 mr-0.5" />
              {advancedCount} awans
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border">
              {playingCount} w grze
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-destructive/15 text-destructive border border-destructive/30">
              <X className="w-2.5 h-2.5 inline -mt-0.5 mr-0.5" />
              {eliminatedCount} odpadło
            </span>
          </div>
        </div>
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="gap-1.5 h-8"
          title={nextPlan.error || `Wygeneruj rundę ${nextPlan.round}`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {stage.finished
            ? "Swiss zakończony"
            : canGenerate
              ? `Wygeneruj rundę ${nextPlan.round}`
              : nextPlan.error || "Brak dostępnych par"}
        </Button>
      </div>

      {nextPlan.error && stage.currentRound > 0 && !stage.finished && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {nextPlan.error}
        </div>
      )}

      {/* Overview table — Liquipedia style */}
      <div className="border border-border rounded-md overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-secondary/60 border-b border-border">
            <tr className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">
              <th className="px-2 py-2 text-left w-8">#</th>
              <th className="px-2 py-2 text-left">Drużyna</th>
              <th className="px-2 py-2 text-center w-14">W-L</th>
              <th className="px-2 py-2 text-center w-14" title="Round difference (mapy)">RD</th>
              <th className="px-2 py-2 text-center w-12" title="Buchholz (suma zwycięstw przeciwników)">BU</th>
              <th className="px-2 py-2 text-center w-16">Status</th>
              {Array.from({ length: maxRound }, (_, i) => (
                <th key={i} className="px-1 py-2 text-center w-[88px] border-l border-border/50">
                  R{i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stage.standings.map((s, i) => {
              const style = STATUS_STYLE[s.status];
              return (
                <motion.tr
                  key={s.team}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.015, 0.2) }}
                  className={cn("border-b border-border/40 last:border-b-0 hover:bg-secondary/30 transition-colors", style.row)}
                >
                  <td className="px-2 py-1.5 text-center font-mono font-bold text-muted-foreground tabular-nums">{i + 1}.</td>
                  <td className="px-2 py-1.5">
                    <TeamCell name={s.team} withTag />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={cn(
                      "font-mono font-bold tabular-nums text-xs",
                      s.status === "advanced" && "text-[hsl(var(--win))]",
                      s.status === "eliminated" && "text-destructive",
                    )}>
                      {s.wins}-{s.losses}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono tabular-nums text-muted-foreground">
                    {s.roundDiff > 0 ? `+${s.roundDiff}` : s.roundDiff}
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono tabular-nums text-muted-foreground">{s.buchholz}</td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border", style.pill)}>
                      {style.label}
                    </span>
                  </td>
                  {Array.from({ length: maxRound }, (_, ri) => {
                    const entry = s.history.find(h => h.round === ri + 1);
                    return (
                      <td key={ri} className="px-1 py-1 border-l border-border/40 align-top">
                        <OpponentCell entry={entry} />
                      </td>
                    );
                  })}
                </motion.tr>
              );
            })}
            {stage.standings.length === 0 && (
              <tr>
                <td colSpan={6 + maxRound} className="px-3 py-6 text-center text-muted-foreground text-xs italic">
                  Brak drużyn w fazie Swiss.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Per-round detailed match sections */}
      {allRounds.length > 0 && (
        <div className="space-y-4">
          {allRounds.map(({ round, matches: rm }) => {
            const decisiveSomewhere = rm.some(m => (m.bo || 1) >= 3);
            return (
              <div key={round} className="border border-border rounded-md overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-secondary/40 border-b border-border">
                  <h5 className="text-xs font-heading font-bold tracking-wide">
                    Runda {round}
                    {decisiveSomewhere && (
                      <span className="ml-2 text-[10px] font-mono text-[hsl(var(--gold))]">
                        ★ zawiera mecze decydujące
                      </span>
                    )}
                  </h5>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {rm.length} {rm.length === 1 ? "mecz" : "meczów"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 p-3">
                  {rm.map(m => (
                    <RoundMatchCard
                      key={m.id}
                      match={m}
                      decisive={(m.bo || 1) >= 3}
                      onUpdate={onUpdate}
                      onOpenMatch={onOpenMatch}
                      onDelete={onDelete}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {allRounds.length === 0 && (
        <div className="text-center py-8 border border-dashed border-border rounded-md">
          <p className="text-xs text-muted-foreground font-mono">
            Brak meczów. Faza Swiss potrzebuje pierwszej rundy.
          </p>
        </div>
      )}
    </div>
  );
};

export default SwissView;
