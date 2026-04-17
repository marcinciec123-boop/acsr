import { Trash2, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState } from "react";
import type { MatchResult } from "@/lib/types";

interface Props {
  matches: MatchResult[];
  onUpdate: (id: string, score1: number, score2: number, team1?: string, team2?: string) => void;
  onDelete?: (id: string) => void;
  allTeams?: string[];
}

/** Groups matches by round for column-style bracket display */
export const BracketView = ({ matches, onUpdate, onDelete, allTeams = [] }: Props) => {
  const [editingId, setEditingId] = useState<string | null>(null);

  // Group by round name preserving insertion order
  const grouped = matches.reduce<Record<string, MatchResult[]>>((acc, m) => {
    const key = m.round || "Match";
    if (!acc[key]) acc[key] = [];
    acc[key].push(m);
    return acc;
  }, {});
  const rounds = Object.keys(grouped);

  if (matches.length === 0) {
    return <p className="text-xs text-muted-foreground font-mono">Brak meczów w drabince</p>;
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex gap-4 min-w-fit">
        {rounds.map(round => (
          <div key={round} className="flex flex-col gap-2 min-w-[220px]">
            <h5 className="text-[10px] font-mono uppercase text-primary font-bold tracking-wider">
              {round}
            </h5>
            <div className="flex flex-col gap-2 justify-around flex-1">
              {grouped[round].map(m => {
                const isEditing = editingId === m.id;
                const winner1 = m.score1 > m.score2 && (m.score1 + m.score2 > 0);
                const winner2 = m.score2 > m.score1 && (m.score1 + m.score2 > 0);
                return (
                  <div
                    key={m.id}
                    className="bg-secondary/40 border border-border rounded-md overflow-hidden text-xs"
                  >
                    {isEditing ? (
                      <div className="p-2 space-y-1.5">
                        <div className="flex gap-1 items-center">
                          <select
                            value={m.team1}
                            onChange={e => onUpdate(m.id, m.score1, m.score2, e.target.value, m.team2)}
                            className="flex-1 px-1.5 py-1 rounded bg-card border border-border text-[11px] font-mono"
                          >
                            <option value="">—</option>
                            <option value="BYE">BYE</option>
                            {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <Input
                            type="number"
                            min="0"
                            value={m.score1}
                            onChange={e => onUpdate(m.id, parseInt(e.target.value) || 0, m.score2)}
                            className="w-12 h-7 text-center text-xs"
                          />
                        </div>
                        <div className="flex gap-1 items-center">
                          <select
                            value={m.team2}
                            onChange={e => onUpdate(m.id, m.score1, m.score2, m.team1, e.target.value)}
                            className="flex-1 px-1.5 py-1 rounded bg-card border border-border text-[11px] font-mono"
                          >
                            <option value="">—</option>
                            <option value="BYE">BYE</option>
                            {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <Input
                            type="number"
                            min="0"
                            value={m.score2}
                            onChange={e => onUpdate(m.id, m.score1, parseInt(e.target.value) || 0)}
                            className="w-12 h-7 text-center text-xs"
                          />
                        </div>
                        <div className="flex gap-1 justify-end">
                          {onDelete && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive"
                              onClick={() => onDelete(m.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px]"
                            onClick={() => setEditingId(null)}
                          >
                            OK
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingId(m.id)}
                        className="w-full text-left hover:bg-secondary/60 transition-colors"
                      >
                        <div className={cn(
                          "flex justify-between items-center px-2 py-1 border-b border-border/40",
                          winner1 && "bg-[hsl(var(--win))]/10"
                        )}>
                          <span className={cn("truncate", winner1 ? "font-bold text-foreground" : "text-muted-foreground")}>
                            {m.team1 || "TBD"}
                          </span>
                          <span className="font-mono font-bold ml-2">{m.score1}</span>
                        </div>
                        <div className={cn(
                          "flex justify-between items-center px-2 py-1",
                          winner2 && "bg-[hsl(var(--win))]/10"
                        )}>
                          <span className={cn("truncate", winner2 ? "font-bold text-foreground" : "text-muted-foreground")}>
                            {m.team2 || "TBD"}
                          </span>
                          <span className="font-mono font-bold ml-2">{m.score2}</span>
                        </div>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
