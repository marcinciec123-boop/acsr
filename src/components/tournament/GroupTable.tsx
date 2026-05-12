import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PhaseGroup, MatchResult, PhaseFormat } from "@/lib/types";
import { computeGroupStandings } from "@/lib/tournamentBuilder";
import { isPlaceholder } from "@/lib/teamHelpers";
import TeamLogo from "@/components/TeamLogo";
import { DoubleElimGroupBracket } from "./DoubleElimGroupBracket";

interface Props {
  group: PhaseGroup;
  format?: PhaseFormat;
  advancePerGroup?: number;
  onMatchUpdate: (matchId: string, score1: number, score2: number) => void;
  onOpenMatch?: (matchId: string) => void;
}

const teamLabel = (name: string) => {
  if (isPlaceholder(name)) return <span className="text-muted-foreground italic">{name || "TBD"}</span>;
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 align-middle">
      <TeamLogo teamName={name} size={18} rounded="md" />
      <span className="truncate">{name}</span>
    </span>
  );
};

const renderMatchRow = (
  m: MatchResult,
  onMatchUpdate: Props["onMatchUpdate"],
  onOpenMatch: Props["onOpenMatch"],
) => {
  const decided = m.score1 + m.score2 > 0 && m.score1 !== m.score2;
  const w1 = decided && m.score1 > m.score2;
  const w2 = decided && m.score2 > m.score1;
  return (
    <div key={m.id} className="flex items-center gap-1.5 text-xs bg-card/50 rounded px-1.5 py-1 border border-border/40 hover:border-border transition-colors">
      <span className={cn("flex-1 text-right truncate min-w-0", w1 ? "text-foreground font-bold" : "text-muted-foreground")}>
        {teamLabel(m.team1)}
      </span>
      <Input
        type="number"
        min="0"
        value={m.score1}
        onChange={e => onMatchUpdate(m.id, parseInt(e.target.value) || 0, m.score2)}
        className={cn("w-9 h-6 text-center text-xs px-1 font-mono font-bold", w1 && "text-[hsl(var(--win))]")}
        disabled={isPlaceholder(m.team1) || isPlaceholder(m.team2)}
      />
      <span className="text-muted-foreground">:</span>
      <Input
        type="number"
        min="0"
        value={m.score2}
        onChange={e => onMatchUpdate(m.id, m.score1, parseInt(e.target.value) || 0)}
        className={cn("w-9 h-6 text-center text-xs px-1 font-mono font-bold", w2 && "text-[hsl(var(--win))]")}
        disabled={isPlaceholder(m.team1) || isPlaceholder(m.team2)}
      />
      <span className={cn("flex-1 truncate min-w-0", w2 ? "text-foreground font-bold" : "text-muted-foreground")}>
        {teamLabel(m.team2)}
      </span>
      {onOpenMatch && (
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-primary hover:text-primary shrink-0"
          onClick={() => onOpenMatch(m.id)}
          title="Otwórz szczegóły meczu"
        >
          <Maximize2 className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
};

export const GroupTable = ({ group, format, advancePerGroup, onMatchUpdate, onOpenMatch }: Props) => {
  const standings = computeGroupStandings(group);
  const isGSLDE = format === "gsl-de-groups";
  const isGSL4 = format === "gsl-groups";
  const isDoubleElim = isGSLDE || isGSL4;
  const advN = advancePerGroup ?? (isGSLDE ? 2 : isGSL4 ? 2 : 2);

  const groupByRound = (list: MatchResult[]) => {
    const map = new Map<string, MatchResult[]>();
    list.forEach(m => {
      const r = m.round || "Mecze";
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(m);
    });
    return map;
  };

  return (
    <div className="bg-gradient-to-br from-card to-secondary/20 border border-border rounded-lg overflow-hidden">
      {/* Group header */}
      <div className="bg-secondary/60 px-3 py-2 flex items-center justify-between border-b border-border">
        <h5 className="text-xs font-heading font-bold text-foreground uppercase tracking-wider">{group.name}</h5>
        <span className="text-[10px] font-mono text-muted-foreground">{group.teams.length} drużyn</span>
      </div>

      <div className="p-3 space-y-3">
        {/* Liquipedia-style standings table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-mono uppercase text-muted-foreground border-b border-border">
                <th className="text-left py-1.5 px-1 w-6">#</th>
                <th className="text-left py-1.5">Drużyna</th>
                <th className="text-center py-1.5 px-1.5" title="Mecze">M</th>
                <th className="text-center py-1.5 px-1.5 text-[hsl(var(--win))]" title="Wygrane">W</th>
                <th className="text-center py-1.5 px-1.5 text-destructive" title="Porażki">L</th>
                <th className="text-center py-1.5 px-1.5" title="Bilans rund (suma rund wygranych - przegranych)">RD</th>
                <th className="text-center py-1.5 px-1 w-8" title="Status"></th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => {
                const advances = i < advN;
                const eliminated = isGSLDE && i >= advN; // GSL-DE: bottom 2 eliminated
                return (
                  <tr
                    key={s.team}
                    className={cn(
                      "border-b border-border/30 hover:bg-secondary/30 transition-colors",
                      advances && "bg-[hsl(var(--win))]/5",
                      eliminated && "opacity-60"
                    )}
                  >
                    {/* Position with color bar */}
                    <td className="py-1.5 px-1 relative">
                      <div className={cn(
                        "absolute left-0 top-0 bottom-0 w-1",
                        advances ? "bg-[hsl(var(--win))]" : eliminated ? "bg-destructive" : "bg-transparent"
                      )} />
                      <span className={cn(
                        "font-mono font-bold pl-1.5",
                        advances ? "text-[hsl(var(--win))]" : "text-muted-foreground"
                      )}>
                        {i + 1}
                      </span>
                    </td>
                    <td className={cn("py-1.5", advances && "font-bold text-foreground")}>
                      {teamLabel(s.team)}
                    </td>
                    <td className="text-center py-1.5 px-1.5 font-mono tabular-nums text-muted-foreground">
                      {s.wins + s.losses}
                    </td>
                    <td className="text-center py-1.5 px-1.5 font-mono tabular-nums text-[hsl(var(--win))] font-bold">
                      {s.wins}
                    </td>
                    <td className="text-center py-1.5 px-1.5 font-mono tabular-nums text-destructive">
                      {s.losses}
                    </td>
                    <td className={cn(
                      "text-center py-1.5 px-1.5 font-mono tabular-nums",
                      s.mapDiff > 0 && "text-[hsl(var(--win))]",
                      s.mapDiff < 0 && "text-destructive",
                      s.mapDiff === 0 && "text-muted-foreground"
                    )}>
                      {s.mapDiff > 0 ? `+${s.mapDiff}` : s.mapDiff}
                    </td>
                    <td className="text-center py-1.5 px-1">
                      {advances && (
                        <span className="text-[9px] font-mono font-bold text-[hsl(var(--win))] bg-[hsl(var(--win))]/15 border border-[hsl(var(--win))]/30 rounded px-1 py-0.5">
                          AWA
                        </span>
                      )}
                      {eliminated && (
                        <span className="text-[9px] font-mono font-bold text-destructive bg-destructive/15 border border-destructive/30 rounded px-1 py-0.5">
                          ELI
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Legend */}
          <div className="flex items-center gap-3 mt-2 text-[9px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-[hsl(var(--win))] rounded-sm" /> awansuje
            </span>
            {isGSLDE && (
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-destructive rounded-sm" /> eliminacja
              </span>
            )}
          </div>
        </div>

        {isDoubleElim ? (
          /* Proper Liquipedia-style double-elim bracket */
          <div className="pt-2 border-t border-border/40">
            <DoubleElimGroupBracket
              matches={group.matches}
              format={format!}
              onMatchUpdate={onMatchUpdate}
              onOpenMatch={onOpenMatch}
            />
          </div>
        ) : (
          /* Default: matches grouped by round */
          <div className="space-y-2 pt-2 border-t border-border/40">
            {Array.from(groupByRound(group.matches).entries()).map(([roundName, ms]) => (
              <div key={roundName} className="space-y-1">
                <h6 className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider">{roundName}</h6>
                {ms.map(m => renderMatchRow(m, onMatchUpdate, onOpenMatch))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
