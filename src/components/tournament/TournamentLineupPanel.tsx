import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, ChevronDown, ChevronUp, Armchair, Check, RotateCcw, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { teamDatabase } from "@/data/tournaments";
import { playerNationalities } from "@/data/playerNationalities";
import { playerRoles, roleColors, roleIcons } from "@/data/playerRoles";
import { countryFlag } from "@/lib/flags";
import { resolvePlayerCountry } from "@/lib/playerCountry";
import { cn } from "@/lib/utils";
import { isPlaceholder } from "@/lib/teamHelpers";
import { splitRoster } from "@/lib/benchedPlayers";
import {
  getTournamentLineup, setTournamentLineup, clearTournamentLineup,
} from "@/lib/tournamentLineups";
import { toast } from "@/hooks/use-toast";
import TeamLogo from "@/components/TeamLogo";

interface Props {
  tournamentId: string;
  participants: string[];
}

/**
 * Per-tournament lineup picker. For each participating team that has at
 * least one benched player, the user can substitute who actually plays
 * in this event. If no custom lineup is set, the team's active roster
 * (bench excluded) is used by the simulator.
 */
export const TournamentLineupPanel = ({ tournamentId, participants }: Props) => {
  const [open, setOpen] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onUpdate = () => setTick(t => t + 1);
    window.addEventListener("lineup:update", onUpdate);
    window.addEventListener("bench:update", onUpdate);
    return () => {
      window.removeEventListener("lineup:update", onUpdate);
      window.removeEventListener("bench:update", onUpdate);
    };
  }, []);

  const eligibleTeams = useMemo(() => {
    return participants
      .filter(p => !isPlaceholder(p))
      .map(name => {
        const team = teamDatabase.find(t => t.name === name);
        if (!team) return null;
        const { active, bench } = splitRoster(team);
        const explicit = getTournamentLineup(tournamentId, name);
        return {
          team,
          active,
          bench,
          hasBench: bench.length > 0,
          customised: explicit.length > 0,
          lineup: explicit.length > 0 ? explicit : active.slice(0, 5),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    // re-evaluate on tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, tournamentId, tick]);

  const teamsWithBench = eligibleTeams.filter(e => e.hasBench);
  const customisedCount = eligibleTeams.filter(e => e.customised).length;

  if (teamsWithBench.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg mb-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">
            Składy na turniej
          </h3>
          <span className="text-xs font-mono text-muted-foreground">
            {teamsWithBench.length} {teamsWithBench.length === 1 ? "drużyna z ławką" : "drużyn z ławką"}
            {customisedCount > 0 && (
              <span className="ml-2 text-accent">• {customisedCount} z zastępstwem</span>
            )}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-border/50"
          >
            <div className="p-4 space-y-3">
              {teamsWithBench.map(entry => (
                <TeamLineupRow
                  key={entry.team.name}
                  tournamentId={tournamentId}
                  teamName={entry.team.name}
                  active={entry.active}
                  bench={entry.bench}
                  customised={entry.customised}
                  currentLineup={entry.lineup}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TeamLineupRow = ({
  tournamentId, teamName, active, bench, customised, currentLineup,
}: {
  tournamentId: string;
  teamName: string;
  active: string[];
  bench: string[];
  customised: boolean;
  currentLineup: string[];
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(currentLineup);

  useEffect(() => { setDraft(currentLineup); }, [currentLineup.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps

  const fullPool = [...active, ...bench];

  const togglePlayer = (p: string) => {
    setDraft(prev => {
      if (prev.includes(p)) return prev.filter(x => x !== p);
      if (prev.length >= 5) {
        toast({ title: "Skład pełny", description: "Możesz wybrać max. 5 graczy. Odznacz kogoś najpierw." });
        return prev;
      }
      return [...prev, p];
    });
  };

  const save = () => {
    if (draft.length !== 5) {
      toast({
        title: "Nieprawidłowy skład",
        description: "Wybierz dokładnie 5 graczy.",
        variant: "destructive",
      });
      return;
    }
    setTournamentLineup(tournamentId, teamName, draft);
    toast({ title: "Skład zapisany", description: `${teamName} → ${draft.join(", ")}` });
    setEditing(false);
  };

  const reset = () => {
    clearTournamentLineup(tournamentId, teamName);
    toast({ title: "Skład zresetowany", description: `${teamName} wraca do aktywnej piątki.` });
    setEditing(false);
  };

  return (
    <div className={cn(
      "border rounded-lg p-3 transition-colors",
      customised ? "border-accent/40 bg-accent/5" : "border-border bg-secondary/20",
    )}>
      <div className="flex items-center gap-3 mb-2">
        <TeamLogo teamName={teamName} size={32} rounded="md" />
        <div className="flex-1 min-w-0">
          <p className="font-heading font-bold text-foreground text-sm truncate">{teamName}</p>
          <p className="text-xs font-mono text-muted-foreground">
            {customised ? "Zastępstwo aktywne" : "Domyślny skład"} • Ławka: {bench.length}
          </p>
        </div>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => { setDraft(currentLineup); setEditing(true); }}>
            <Pencil className="w-3 h-3 mr-1" /> Edytuj skład
          </Button>
        ) : (
          <div className="flex gap-1">
            {customised && (
              <Button size="sm" variant="outline" onClick={reset}>
                <RotateCcw className="w-3 h-3 mr-1" /> Reset
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
              Anuluj
            </Button>
            <Button size="sm" onClick={save} disabled={draft.length !== 5}>
              <Check className="w-3 h-3 mr-1" /> Zapisz ({draft.length}/5)
            </Button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="flex flex-wrap gap-1.5">
          {currentLineup.map(p => {
            const onBench = bench.includes(p);
            const role = playerRoles[p];
            const country = resolvePlayerCountry(p);
            return (
              <span
                key={p}
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-mono px-2 py-1 rounded border",
                  onBench
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-border bg-background text-foreground",
                )}
              >
                {country && <span>{countryFlag(country)}</span>}
                {p}
                {onBench && <Armchair className="w-3 h-3" />}
                {role && (
                  <span className={cn("text-xs px-1 rounded border", roleColors[role])}>
                    {roleIcons[role]} {role}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {fullPool.map(p => {
            const selected = draft.includes(p);
            const onBench = bench.includes(p);
            const country = resolvePlayerCountry(p);
            const role = playerRoles[p];
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePlayer(p)}
                className={cn(
                  "relative text-left p-2 rounded-md border transition-all",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-primary/40",
                  onBench && !selected && "opacity-70 border-dashed",
                )}
              >
                <div className="flex items-center gap-1.5">
                  {selected && <Check className="w-3 h-3 text-primary shrink-0" />}
                  {country && <span className="text-xs">{countryFlag(country)}</span>}
                  <span className="font-heading font-bold text-foreground text-xs truncate flex-1">{p}</span>
                  {onBench && <Armchair className="w-3 h-3 text-muted-foreground shrink-0" />}
                </div>
                {role && (
                  <span className={cn("inline-block mt-1 text-xs font-mono px-1 rounded border", roleColors[role])}>
                    {roleIcons[role]} {role}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TournamentLineupPanel;
