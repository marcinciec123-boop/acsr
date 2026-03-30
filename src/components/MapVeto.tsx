import { useState } from "react";
import { motion } from "framer-motion";
import { Ban, Check, Map, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";

const MAP_POOL = ["Anubis", "Ancient", "Cache", "Dust II", "Inferno", "Mirage", "Nuke", "Overpass", "Train", "Tuscan", "Vertigo"];

export interface VetoAction {
  team: string;
  action: "ban" | "pick";
  map: string;
}

interface MapVetoProps {
  team1: string;
  team2: string;
  bo: number;
  onComplete: (pickedMaps: string[]) => void;
  onSkip?: () => void;
}

// Veto sequences per format
function getVetoSequence(bo: number, team1: string, team2: string): { team: string; action: "ban" | "pick" }[] {
  if (bo === 1) {
    // Ban-Ban-Ban-Ban-Ban-Ban → last map is decider
    return [
      { team: team1, action: "ban" }, { team: team2, action: "ban" },
      { team: team1, action: "ban" }, { team: team2, action: "ban" },
      { team: team1, action: "ban" }, { team: team2, action: "ban" },
      { team: team1, action: "ban" }, { team: team2, action: "ban" },
      { team: team1, action: "ban" }, { team: team2, action: "ban" },
    ];
  }
  if (bo === 3) {
    // Ban-Ban-Pick-Pick-Ban-Ban → decider
    return [
      { team: team1, action: "ban" }, { team: team2, action: "ban" },
      { team: team1, action: "pick" }, { team: team2, action: "pick" },
      { team: team1, action: "ban" }, { team: team2, action: "ban" },
      { team: team1, action: "ban" }, { team: team2, action: "ban" },
    ];
  }
  // Bo5: Ban-Ban-Pick-Pick-Pick-Pick → decider
  return [
    { team: team1, action: "ban" }, { team: team2, action: "ban" },
    { team: team1, action: "pick" }, { team: team2, action: "pick" },
    { team: team1, action: "pick" }, { team: team2, action: "pick" },
    { team: team1, action: "ban" }, { team: team2, action: "ban" },
  ];
}

const MapVeto = ({ team1, team2, bo, onComplete, onSkip }: MapVetoProps) => {
  const [availableMaps, setAvailableMaps] = useState([...MAP_POOL]);
  const [vetoHistory, setVetoHistory] = useState<VetoAction[]>([]);
  const [pickedMaps, setPickedMaps] = useState<string[]>([]);
  const sequence = getVetoSequence(bo, team1, team2);
  const currentStep = vetoHistory.length;
  const mapsNeeded = bo === 1 ? 1 : bo;

  const isFinished = pickedMaps.length >= mapsNeeded || availableMaps.length <= 1;

  const handleMapClick = (map: string) => {
    if (isFinished) return;
    if (currentStep >= sequence.length) {
      // Last map remaining = decider
      return;
    }

    const step = sequence[currentStep];
    const newHistory = [...vetoHistory, { team: step.team, action: step.action, map }];
    const newAvailable = availableMaps.filter(m => m !== map);

    setVetoHistory(newHistory);
    setAvailableMaps(newAvailable);

    if (step.action === "pick") {
      const newPicked = [...pickedMaps, map];
      setPickedMaps(newPicked);

      if (newPicked.length >= mapsNeeded) {
        onComplete(newPicked);
        return;
      }
    }

    // Check if remaining maps = needed deciders
    const picksLeft = mapsNeeded - (step.action === "pick" ? pickedMaps.length + 1 : pickedMaps.length);
    if (newAvailable.length <= picksLeft) {
      const finalMaps = [...(step.action === "pick" ? [...pickedMaps, map] : pickedMaps), ...newAvailable];
      onComplete(finalMaps.slice(0, mapsNeeded));
    }
  };

  const autoVeto = () => {
    let avail = [...MAP_POOL];
    const history: VetoAction[] = [];
    const picked: string[] = [];

    for (const step of sequence) {
      if (picked.length >= mapsNeeded || avail.length <= (mapsNeeded - picked.length)) break;
      const randomIdx = Math.floor(Math.random() * avail.length);
      const map = avail[randomIdx];
      history.push({ team: step.team, action: step.action, map });
      avail = avail.filter(m => m !== map);
      if (step.action === "pick") picked.push(map);
    }

    // Add remaining as deciders
    while (picked.length < mapsNeeded && avail.length > 0) {
      picked.push(avail.shift()!);
    }

    onComplete(picked);
  };

  const currentAction = currentStep < sequence.length ? sequence[currentStep] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-4 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
          <Map className="w-4 h-4 text-primary" />
          Map Veto — BO{bo}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={autoVeto}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-primary/30 text-primary rounded hover:bg-primary/10 transition-colors"
          >
            <Shuffle className="w-3 h-3" /> Auto
          </button>
          {onSkip && (
            <button
              onClick={onSkip}
              className="px-3 py-1.5 text-xs font-mono text-muted-foreground border border-border rounded hover:bg-secondary transition-colors"
            >
              Pomiń
            </button>
          )}
        </div>
      </div>

      {/* Current action indicator */}
      {currentAction && !isFinished && (
        <div className="text-center py-2">
          <span className="text-sm font-heading">
            <span className="font-bold text-foreground">{currentAction.team}</span>
            {" "}
            <span className={currentAction.action === "ban" ? "text-destructive" : "text-win"}>
              {currentAction.action === "ban" ? "banuje" : "wybiera"}
            </span>
            {" mapę"}
          </span>
        </div>
      )}

      {/* Map grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {MAP_POOL.map(map => {
          const banned = vetoHistory.find(v => v.map === map && v.action === "ban");
          const picked = vetoHistory.find(v => v.map === map && v.action === "pick");
          const isAvailable = availableMaps.includes(map) && !isFinished;

          return (
            <button
              key={map}
              onClick={() => isAvailable ? handleMapClick(map) : undefined}
              disabled={!isAvailable}
              className={cn(
                "relative px-3 py-3 rounded-md border text-sm font-mono transition-all text-center",
                banned && "bg-destructive/10 border-destructive/30 text-destructive/60 line-through opacity-50",
                picked && "bg-win/10 border-win/30 text-win font-bold",
                !banned && !picked && isAvailable && "bg-secondary/50 border-border hover:border-primary hover:bg-primary/10 text-foreground cursor-pointer",
                !banned && !picked && !isAvailable && "bg-secondary/30 border-border/30 text-muted-foreground opacity-40",
              )}
            >
              {map}
              {banned && (
                <span className="absolute top-0.5 right-0.5 text-[8px] font-mono text-destructive">
                  <Ban className="w-3 h-3" />
                </span>
              )}
              {picked && (
                <span className="absolute top-0.5 right-0.5 text-[8px] font-mono text-win">
                  <Check className="w-3 h-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Veto history */}
      {vetoHistory.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Historia veto</p>
          <div className="flex flex-wrap gap-1">
            {vetoHistory.map((v, i) => (
              <span
                key={i}
                className={cn(
                  "text-[10px] font-mono px-2 py-0.5 rounded border",
                  v.action === "ban"
                    ? "text-destructive/80 bg-destructive/5 border-destructive/20"
                    : "text-win bg-win/5 border-win/20"
                )}
              >
                {v.team}: {v.action === "ban" ? "✗" : "✓"} {v.map}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Picked maps summary */}
      {pickedMaps.length > 0 && (
        <div className="pt-2 border-t border-border/50">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Wybrane mapy</p>
          <div className="flex gap-2">
            {pickedMaps.map((m, i) => (
              <span key={i} className="text-xs font-mono font-bold text-win bg-win/10 px-2 py-1 rounded border border-win/20">
                Mapa {i + 1}: {m}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default MapVeto;
