import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Shuffle, Save, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TournamentPhase } from "@/lib/types";

interface Props {
  phase: TournamentPhase;
  /** All teams that should be assignable (tournament participants). */
  availableTeams: string[];
  /** Save: groupId → list of teams (in seeded order). */
  onSave: (assignment: Record<string, string[]>) => void;
  /** Random shuffle assignment using snake-seed across groups. */
  onShuffle: () => void;
}

/**
 * Manual drag-free group assignment editor:
 * - shows each group's current teams
 * - "Add team" dropdown picks from unassigned pool
 * - "X" removes team back to the pool
 * - "Save" commits, "Random" reshuffles via parent
 */
export const GroupAssignmentPanel = ({ phase, availableTeams, onSave, onShuffle }: Props) => {
  const [draft, setDraft] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    (phase.groups || []).forEach(g => { map[g.id] = [...g.teams]; });
    return map;
  });

  const teamsPerGroup = useMemo(() => {
    if (phase.format === "gsl-de-groups") return 8;
    if (phase.format === "gsl-groups") return 4;
    return undefined;
  }, [phase.format]);

  const assignedSet = useMemo(() => {
    const s = new Set<string>();
    Object.values(draft).forEach(arr => arr.forEach(t => { if (t && !t.startsWith("TBD")) s.add(t); }));
    return s;
  }, [draft]);

  const unassigned = availableTeams.filter(t => !assignedSet.has(t));

  const addTeamToGroup = (groupId: string, team: string) => {
    setDraft(d => ({ ...d, [groupId]: [...(d[groupId] || []), team] }));
  };
  const removeTeamFromGroup = (groupId: string, idx: number) => {
    setDraft(d => ({ ...d, [groupId]: (d[groupId] || []).filter((_, i) => i !== idx) }));
  };

  return (
    <div className="bg-secondary/30 border border-border rounded-md p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h5 className="text-xs font-heading font-bold text-primary">
          Przypisanie drużyn do grup
        </h5>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onShuffle}>
            <Shuffle className="w-3 h-3" /> Losuj
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => onSave(draft)}>
            <Save className="w-3 h-3" /> Zapisz
          </Button>
        </div>
      </div>

      <p className="text-[10px] font-mono text-muted-foreground">
        Pula nieprzypisanych: <span className="text-foreground">{unassigned.length}</span> dr.
        {teamsPerGroup && (
          <> · format wymaga <span className="text-foreground">{teamsPerGroup}</span> dr./grupę</>
        )}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {(phase.groups || []).map(g => {
          const teams = draft[g.id] || [];
          const overflow = teamsPerGroup ? teams.length > teamsPerGroup : false;
          const underflow = teamsPerGroup ? teams.length < teamsPerGroup : false;
          return (
            <div key={g.id} className="bg-card border border-border rounded p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <h6 className="text-xs font-heading font-bold">{g.name}</h6>
                <span className={cn(
                  "text-[10px] font-mono",
                  overflow ? "text-destructive" : underflow ? "text-muted-foreground" : "text-[hsl(var(--win))]"
                )}>
                  {teams.length}{teamsPerGroup ? `/${teamsPerGroup}` : ""}
                </span>
              </div>

              <div className="space-y-1">
                {teams.map((t, i) => (
                  <div key={`${t}-${i}`} className="flex items-center gap-1 bg-secondary/50 rounded px-1.5 py-0.5">
                    <span className="text-[10px] font-mono text-primary w-4 shrink-0">{i + 1}</span>
                    <span className="text-[11px] font-mono flex-1 truncate">{t || "—"}</span>
                    <button
                      onClick={() => removeTeamFromGroup(g.id, i)}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                      title="Usuń"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {unassigned.length > 0 && (!teamsPerGroup || teams.length < teamsPerGroup) && (
                <div className="flex items-center gap-1 pt-1">
                  <Plus className="w-3 h-3 text-muted-foreground shrink-0" />
                  <select
                    value=""
                    onChange={e => { if (e.target.value) addTeamToGroup(g.id, e.target.value); }}
                    className="flex-1 text-[10px] font-mono bg-card border border-border rounded px-1 py-0.5 h-6"
                  >
                    <option value="">+ Dodaj drużynę...</option>
                    {unassigned.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
