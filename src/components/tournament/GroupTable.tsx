import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { PhaseGroup, MatchResult } from "@/lib/types";
import { computeGroupStandings } from "@/lib/tournamentBuilder";

interface Props {
  group: PhaseGroup;
  onMatchUpdate: (matchId: string, score1: number, score2: number) => void;
}

export const GroupTable = ({ group, onMatchUpdate }: Props) => {
  const standings = computeGroupStandings(group);

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
            {standings.map((s, i) => (
              <tr key={s.team} className="border-b border-border/20">
                <td className="py-1 text-muted-foreground">{i + 1}</td>
                <td className={cn("py-1", i === 0 && "font-bold text-[hsl(var(--win))]")}>{s.team}</td>
                <td className="text-center py-1 font-mono">{s.wins}-{s.losses}</td>
                <td className={cn("text-center py-1 font-mono", s.mapDiff > 0 && "text-[hsl(var(--win))]", s.mapDiff < 0 && "text-destructive")}>
                  {s.mapDiff > 0 ? `+${s.mapDiff}` : s.mapDiff}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Matches */}
      <div className="space-y-1">
        <h6 className="text-[10px] font-mono uppercase text-muted-foreground">Mecze</h6>
        {group.matches.map((m: MatchResult) => (
          <div key={m.id} className="flex items-center gap-2 text-xs">
            <span className={cn("flex-1 text-right truncate", m.score1 > m.score2 ? "text-foreground font-medium" : "text-muted-foreground")}>
              {m.team1 || "TBD"}
            </span>
            <Input
              type="number"
              min="0"
              value={m.score1}
              onChange={e => onMatchUpdate(m.id, parseInt(e.target.value) || 0, m.score2)}
              className="w-10 h-6 text-center text-xs px-1"
            />
            <span className="text-muted-foreground">:</span>
            <Input
              type="number"
              min="0"
              value={m.score2}
              onChange={e => onMatchUpdate(m.id, m.score1, parseInt(e.target.value) || 0)}
              className="w-10 h-6 text-center text-xs px-1"
            />
            <span className={cn("flex-1 truncate", m.score2 > m.score1 ? "text-foreground font-medium" : "text-muted-foreground")}>
              {m.team2 || "TBD"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
