import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shuffle, Play, Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface GroupDrawCeremonyProps {
  teams: string[];
  groupCount: number;
  onComplete: (groups: string[][]) => void;
  onSkip: () => void;
}

const GroupDrawCeremony = ({ teams, groupCount, onComplete, onSkip }: GroupDrawCeremonyProps) => {
  const perGroup = Math.ceil(teams.length / groupCount);
  const [phase, setPhase] = useState<"idle" | "drawing" | "done">("idle");
  const [groups, setGroups] = useState<string[][]>(() => Array.from({ length: groupCount }, () => []));
  const [currentTeamIdx, setCurrentTeamIdx] = useState(0);
  const [currentGroupIdx, setCurrentGroupIdx] = useState<number | null>(null);
  const [shuffledTeams, setShuffledTeams] = useState<string[]>([]);
  const [animatingBall, setAnimatingBall] = useState(false);

  const startDraw = useCallback(() => {
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    setShuffledTeams(shuffled);
    setPhase("drawing");
    setCurrentTeamIdx(0);
    setGroups(Array.from({ length: groupCount }, () => []));
  }, [teams, groupCount]);

  // Draw next team
  const drawNext = useCallback(() => {
    if (currentTeamIdx >= shuffledTeams.length) {
      setPhase("done");
      return;
    }

    setAnimatingBall(true);

    // Find eligible group (not full)
    const eligible = groups
      .map((g, i) => ({ idx: i, len: g.length }))
      .filter(g => g.len < perGroup);

    if (eligible.length === 0) {
      setPhase("done");
      return;
    }

    const targetGroup = eligible[Math.floor(Math.random() * eligible.length)].idx;
    setCurrentGroupIdx(targetGroup);

    setTimeout(() => {
      setGroups(prev => {
        const next = prev.map(g => [...g]);
        next[targetGroup].push(shuffledTeams[currentTeamIdx]);
        return next;
      });
      setCurrentTeamIdx(prev => prev + 1);
      setAnimatingBall(false);
      setCurrentGroupIdx(null);
    }, 800);
  }, [currentTeamIdx, shuffledTeams, groups, perGroup]);

  // Auto-draw all remaining
  const drawAll = useCallback(() => {
    const remaining = shuffledTeams.slice(currentTeamIdx);
    const newGroups = groups.map(g => [...g]);

    remaining.forEach(team => {
      const eligible = newGroups
        .map((g, i) => ({ idx: i, len: g.length }))
        .filter(g => g.len < perGroup);
      if (eligible.length > 0) {
        const target = eligible[Math.floor(Math.random() * eligible.length)].idx;
        newGroups[target].push(team);
      }
    });

    setGroups(newGroups);
    setCurrentTeamIdx(shuffledTeams.length);
    setPhase("done");
  }, [shuffledTeams, currentTeamIdx, groups, perGroup]);

  const groupLabels = Array.from({ length: groupCount }, (_, i) => String.fromCharCode(65 + i));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Shuffle className="w-10 h-10 text-primary mx-auto mb-2" />
          <h3 className="text-2xl font-heading font-bold text-foreground">Losowanie grup</h3>
          <p className="text-sm text-muted-foreground font-mono">
            {teams.length} drużyn → {groupCount} grupy po {perGroup}
          </p>
        </motion.div>
      </div>

      {/* Groups display */}
      <div className={cn(
        "grid gap-4",
        groupCount <= 2 ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"
      )}>
        {groups.map((group, gi) => (
          <motion.div
            key={gi}
            className={cn(
              "bg-card border rounded-lg overflow-hidden transition-all",
              currentGroupIdx === gi ? "border-primary shadow-lg shadow-primary/20" : "border-border"
            )}
            animate={currentGroupIdx === gi ? { scale: 1.02 } : { scale: 1 }}
          >
            <div className={cn(
              "px-4 py-2 font-heading font-bold text-sm text-center transition-colors",
              currentGroupIdx === gi ? "bg-primary/20 text-primary" : "bg-secondary/50 text-foreground"
            )}>
              Grupa {groupLabels[gi]}
            </div>
            <div className="p-3 space-y-1 min-h-[120px]">
              <AnimatePresence>
                {group.map((team, ti) => (
                  <motion.div
                    key={team}
                    initial={{ opacity: 0, x: -20, scale: 0.8 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="flex items-center gap-2 px-2 py-1.5 bg-secondary/30 rounded text-sm"
                  >
                    <span className="text-xs font-mono text-muted-foreground w-4">{ti + 1}.</span>
                    <span className="font-medium text-foreground truncate">{team}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {group.length === 0 && phase !== "idle" && (
                <div className="flex items-center justify-center h-20 text-muted-foreground text-xs font-mono">
                  Oczekiwanie...
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Current team being drawn */}
      {phase === "drawing" && currentTeamIdx < shuffledTeams.length && (
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentTeamIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="inline-flex items-center gap-3 px-6 py-3 bg-primary/10 border border-primary/30 rounded-lg"
            >
              <Users className="w-4 h-4 text-primary" />
              <span className="font-heading font-bold text-foreground">{shuffledTeams[currentTeamIdx]}</span>
              {animatingBall && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full"
                />
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}

      {/* Remaining teams pool */}
      {phase === "drawing" && currentTeamIdx < shuffledTeams.length && (
        <div className="bg-secondary/30 border border-border rounded-lg p-3">
          <p className="text-xs font-mono text-muted-foreground uppercase mb-2">
            Pozostałe drużyny ({shuffledTeams.length - currentTeamIdx})
          </p>
          <div className="flex flex-wrap gap-1">
            {shuffledTeams.slice(currentTeamIdx).map((team, i) => (
              <span
                key={team}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-mono transition-all",
                  i === 0 ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary text-muted-foreground"
                )}
              >
                {team}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex justify-center gap-3">
        {phase === "idle" && (
          <>
            <button
              onClick={startDraw}
              className="flex items-center gap-2 px-6 py-3 gradient-primary text-primary-foreground rounded-md font-heading font-semibold hover:opacity-90 transition-opacity"
            >
              <Shuffle className="w-4 h-4" />
              Rozpocznij losowanie
            </button>
            <button
              onClick={onSkip}
              className="flex items-center gap-2 px-6 py-3 border border-border text-muted-foreground rounded-md font-heading font-semibold hover:bg-secondary/50 transition-colors"
            >
              Pomiń losowanie
            </button>
          </>
        )}

        {phase === "drawing" && !animatingBall && currentTeamIdx < shuffledTeams.length && (
          <>
            <button
              onClick={drawNext}
              className="flex items-center gap-2 px-6 py-3 gradient-primary text-primary-foreground rounded-md font-heading font-semibold hover:opacity-90 transition-opacity"
            >
              <Play className="w-4 h-4" />
              Losuj następną
            </button>
            <button
              onClick={drawAll}
              className="flex items-center gap-2 px-4 py-3 border border-primary/30 text-primary rounded-md font-heading font-semibold hover:bg-primary/10 transition-colors"
            >
              Dolosuj wszystkie
            </button>
          </>
        )}

        {phase === "done" && (
          <button
            onClick={() => onComplete(groups)}
            className="flex items-center gap-2 px-8 py-3 gradient-primary text-primary-foreground rounded-md font-heading font-semibold hover:opacity-90 transition-opacity"
          >
            <Check className="w-4 h-4" />
            Zatwierdź grupy
          </button>
        )}
      </div>
    </motion.div>
  );
};

export default GroupDrawCeremony;
