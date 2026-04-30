import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PhaseGroup, MatchResult, PhaseFormat } from "@/lib/types";
import { computeGroupStandings } from "@/lib/tournamentBuilder";

interface Props {
  group: PhaseGroup;
  /** Phase format — affects whether we render UB/LB columns (gsl-de-groups). */
  format?: PhaseFormat;
  /** How many teams advance from this group (per group, not total). Defaults: 2 for groups, 1 for SE-like. */
  advancePerGroup?: number;
  onMatchUpdate: (matchId: string, score1: number, score2: number) => void;
  onOpenMatch?: (matchId: string) => void;
}

const renderMatchRow = (
  m: MatchResult,
  onMatchUpdate: Props["onMatchUpdate"],
  onOpenMatch: Props["onOpenMatch"],
) => (
  <div key={m.id} className="flex items-center gap-1.5 text-xs">
    <span className={cn(
      "flex-1 text-right truncate",
      m.score1 > m.score2 ? "text-foreground font-medium" : "text-muted-foreground"
    )}>
      {m.team1 || "TBD"}
    </span>
    <Input
      type="number"
      min="0"
      value={m.score1}
      onChange={e => onMatchUpdate(m.id, parseInt(e.target.value) || 0, m.score2)}
      className="w-10 h-6 text-center text-xs px-1"
      disabled={!m.team1 || !m.team2 || m.team1 === "TBD" || m.team2 === "TBD"}
    />
    <span className="text-muted-foreground">:</span>
    <Input
      type="number"
      min="0"
      value={m.score2}
      onChange={e => onMatchUpdate(m.id, m.score1, parseInt(e.target.value) || 0)}
      className="w-10 h-6 text-center text-xs px-1"
      disabled={!m.team1 || !m.team2 || m.team1 === "TBD" || m.team2 === "TBD"}
    />
    <span className={cn(
      "flex-1 truncate",
      m.score2 > m.score1 ? "text-foreground font-medium" : "text-muted-foreground"
    )}>
      {m.team2 || "TBD"}
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

export const GroupTable = ({ group, format, advancePerGroup, onMatchUpdate, onOpenMatch }: Props) => {
  const standings = computeGroupStandings(group);
  const isGSLDE = format === "gsl-de-groups";
  const advN = advancePerGroup ?? (isGSLDE ? 2 : format === "gsl-groups" ? 2 : 2);

  // For IEM/GSL-DE: split matches into Upper / Lower bracket columns based on bracketSlot prefix
  const ubMatches = isGSLDE
    ? group.matches.filter(m => (m.bracketSlot || "").startsWith("IEM-UB"))
    : [];
  const lbMatches = isGSLDE
    ? group.matches.filter(m => (m.bracketSlot || "").startsWith("IEM-LB"))
    : [];

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
    <div className="bg-secondary/30 border border-border rounded-md p-3 space-y-3">
      <h5 className="text-xs font-heading font-bold text-primary">{group.name}</h5>

      {/* Standings */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[10px] font-mono uppercase text-muted-foreground border-b border-border/50">
              <th className="text-left py-1">#</th>
              <th className="text-left py-1">Team</th>
              <th className="text-center py-1">W-L</th>
              <th className="text-center py-1">Diff</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, i) => {
              const advances = i < advN;
              return (
              <tr key={s.team} className={cn("border-b border-border/20", advances && "bg-[hsl(var(--win))]/5")}>
                <td className={cn("py-1 text-muted-foreground", advances && "text-[hsl(var(--win))] font-bold")}>{i + 1}</td>
                <td className={cn("py-1", advances && "font-bold text-[hsl(var(--win))]")}>{s.team}</td>
                <td className="text-center py-1 font-mono">{s.wins}-{s.losses}</td>
                <td className={cn("text-center py-1 font-mono", s.mapDiff > 0 && "text-[hsl(var(--win))]", s.mapDiff < 0 && "text-destructive")}>
                  {s.mapDiff > 0 ? `+${s.mapDiff}` : s.mapDiff}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isGSLDE ? (
        /* UB / LB column layout for IEM-style DE groups */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <h6 className="text-[10px] font-mono uppercase text-[hsl(var(--win))] font-bold border-b border-[hsl(var(--win))]/30 pb-1">
              ↑ Upper Bracket
            </h6>
            {Array.from(groupByRound(ubMatches).entries()).map(([roundName, ms]) => (
              <div key={roundName} className="space-y-1">
                <h6 className="text-[10px] font-mono uppercase text-muted-foreground">{roundName}</h6>
                {ms.map(m => renderMatchRow(m, onMatchUpdate, onOpenMatch))}
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <h6 className="text-[10px] font-mono uppercase text-destructive font-bold border-b border-destructive/30 pb-1">
              ↓ Lower Bracket
            </h6>
            {Array.from(groupByRound(lbMatches).entries()).map(([roundName, ms]) => (
              <div key={roundName} className="space-y-1">
                <h6 className="text-[10px] font-mono uppercase text-muted-foreground">{roundName}</h6>
                {ms.map(m => renderMatchRow(m, onMatchUpdate, onOpenMatch))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Default: matches grouped by round name (RR / GSL-4) */
        <div className="space-y-2">
          {Array.from(groupByRound(group.matches).entries()).map(([roundName, ms]) => (
            <div key={roundName} className="space-y-1">
              <h6 className="text-[10px] font-mono uppercase text-muted-foreground">{roundName}</h6>
              {ms.map(m => renderMatchRow(m, onMatchUpdate, onOpenMatch))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

