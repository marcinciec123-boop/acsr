import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Ban, Check, Map, Shuffle, Undo2, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveMaps } from "@/lib/mapPool";
import { computeTeamMapStats, predictVeto, vetoSequence } from "@/lib/mapAnalysis";
import type { VetoRecord } from "@/lib/types";

export interface VetoAction {
  team: string;
  action: "ban" | "pick";
  map: string;
}

export interface VetoMapResult { map: string; team1StartSide?: "T" | "CT" }

interface MapVetoProps {
  team1: string;
  team2: string;
  bo: number;
  matchId?: string;
  onComplete: (pickedMaps: string[], veto: VetoRecord[], maps: VetoMapResult[]) => void;
  onSkip?: () => void;
}

const flip = (s: "T" | "CT"): "T" | "CT" => (s === "T" ? "CT" : "T");

/** Buduje wynik (mapy w kolejności gry + strony) z rekordów veto. */
function buildResult(records: VetoRecord[]): VetoMapResult[] {
  return records.filter(r => r.action !== "ban").map(r => ({ map: r.map, team1StartSide: r.team1StartSide }));
}

const MapVeto = ({ team1, team2, bo, matchId, onComplete, onSkip }: MapVetoProps) => {
  const pool = useMemo(() => getActiveMaps(), []);
  const sequence = useMemo(() => vetoSequence(bo, pool.length), [bo, pool.length]);
  const [records, setRecords] = useState<VetoRecord[]>([]);
  const [deciderSide, setDeciderSide] = useState<"T" | "CT" | undefined>(undefined);
  const name = (t: 1 | 2 | 0) => (t === 1 ? team1 : t === 2 ? team2 : "Decider");

  const used = new Set(records.map(r => r.map));
  const available = pool.filter(m => !used.has(m));
  const mapSteps = records.filter(r => r.action !== "decider").length;
  const lastPick = [...records].reverse().find(r => r.action === "pick");
  const pendingSide = bo > 1 && lastPick && !lastPick.team1StartSide ? lastPick : null;
  const currentStep = !pendingSide && mapSteps < sequence.length ? sequence[mapSteps] : null;
  const deciderReady = !pendingSide && mapSteps >= sequence.length && available.length === 1;
  const deciderRecord: VetoRecord | null = deciderReady
    ? { team: 0, action: "decider", map: available[0], team1StartSide: deciderSide }
    : null;

  const finish = (recs: VetoRecord[]) => {
    const maps = buildResult(recs);
    onComplete(maps.map(m => m.map), recs, maps);
  };

  const handleMapClick = (map: string) => {
    if (!currentStep) return;
    setRecords(r => [...r, { team: currentStep.team, action: currentStep.action, map }]);
  };

  const chooseSide = (sideForChooser: "T" | "CT") => {
    if (!pendingSide) return;
    const chooser = pendingSide.team === 1 ? 2 : 1;
    const t1 = chooser === 1 ? sideForChooser : flip(sideForChooser);
    setRecords(r => r.map(x => (x === pendingSide ? { ...x, team1StartSide: t1 } : x)));
  };

  const undo = () => {
    setDeciderSide(undefined);
    setRecords(r => {
      if (!r.length) return r;
      const last = r[r.length - 1];
      if (last.action === "pick" && last.team1StartSide && bo > 1) {
        return [...r.slice(0, -1), { ...last, team1StartSide: undefined }];
      }
      return r.slice(0, -1);
    });
  };

  const autoVeto = () => {
    const s1 = computeTeamMapStats(team1, pool, 0, 0, matchId);
    const s2 = computeTeamMapStats(team2, pool, 0, 0, matchId);
    const steps = predictVeto(team1, team2, bo, pool, s1, s2);
    const rnd = (): "T" | "CT" => (Math.random() < 0.5 ? "T" : "CT");
    const recs: VetoRecord[] = steps.map(s => ({
      team: s.action === "decider" ? 0 : s.team === team1 ? 1 : 2,
      action: s.action,
      map: s.map,
      team1StartSide: bo > 1 && s.action === "pick" ? rnd() : undefined,
    }));
    finish(recs);
  };

  const sideChooserName = pendingSide ? name(pendingSide.team === 1 ? 2 : 1) : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-lg p-4 space-y-4"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
          <Map className="w-4 h-4 text-primary" />
          Map Veto — BO{bo}
        </h3>
        <div className="flex gap-2">
          <button onClick={undo} disabled={!records.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-border text-muted-foreground rounded hover:bg-secondary transition-colors disabled:opacity-40">
            <Undo2 className="w-3 h-3" /> Cofnij
          </button>
          <button onClick={autoVeto}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-primary/30 text-primary rounded hover:bg-primary/10 transition-colors"
            title="Veto na podstawie statystyk map drużyn">
            <Shuffle className="w-3 h-3" /> Auto
          </button>
          {onSkip && (
            <button onClick={onSkip}
              className="px-3 py-1.5 text-xs font-mono text-muted-foreground border border-border rounded hover:bg-secondary transition-colors">
              Pomiń
            </button>
          )}
        </div>
      </div>

      {currentStep && (
        <div className="text-center py-2">
          <span className="text-sm font-heading">
            <span className="font-bold text-foreground">{name(currentStep.team)}</span>{" "}
            <span className={currentStep.action === "ban" ? "text-destructive" : "text-win"}>
              {currentStep.action === "ban" ? "banuje" : "wybiera"}
            </span>{" mapę"}
          </span>
        </div>
      )}

      {pendingSide && (
        <div className="text-center space-y-2 py-1">
          <p className="text-sm font-heading">
            <span className="font-bold text-foreground">{sideChooserName}</span> wybiera stronę startową na <span className="text-win font-bold">{pendingSide.map}</span>
          </p>
          <div className="flex justify-center gap-2">
            {(["T", "CT"] as const).map(s => (
              <button key={s} onClick={() => chooseSide(s)}
                className="px-5 py-2 rounded-md border border-primary/40 text-primary bg-primary/10 font-mono text-sm hover:bg-primary/20">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {deciderRecord && (
        <div className="text-center space-y-2 py-1">
          <p className="text-sm font-heading flex items-center justify-center gap-1.5">
            <Swords className="w-4 h-4 text-primary" /> Decider: <span className="text-primary font-bold">{deciderRecord.map}</span> — nożówka o stronę
          </p>
          <div className="flex justify-center gap-2 flex-wrap">
            {(["T", "CT"] as const).map(s => (
              <button key={s} onClick={() => setDeciderSide(s)}
                className={cn("px-3 py-1.5 rounded-md border text-xs font-mono",
                  deciderSide === s ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                {team1} startuje {s}
              </button>
            ))}
            <button onClick={() => setDeciderSide(undefined)}
              className={cn("px-3 py-1.5 rounded-md border text-xs font-mono",
                !deciderSide ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
              Rozstrzygnie się w grze
            </button>
          </div>
          <button onClick={() => finish([...records, deciderRecord])}
            className="mt-1 px-5 py-2 rounded-md bg-primary text-primary-foreground font-heading text-sm font-bold hover:opacity-90">
            Zatwierdź veto
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {pool.map(map => {
          const rec = records.find(r => r.map === map);
          const banned = rec?.action === "ban";
          const picked = rec?.action === "pick";
          const isDecider = deciderRecord?.map === map;
          const isAvailable = !!currentStep && !rec;
          return (
            <button key={map} onClick={() => handleMapClick(map)} disabled={!isAvailable}
              className={cn(
                "relative px-2 py-3 rounded-md border text-sm font-mono transition-all text-center",
                banned && "bg-destructive/10 border-destructive/30 text-destructive/60 line-through opacity-50",
                picked && "bg-win/10 border-win/30 text-win font-bold",
                isDecider && "bg-primary/10 border-primary/40 text-primary font-bold",
                !rec && !isDecider && isAvailable && "bg-secondary/50 border-border hover:border-primary hover:bg-primary/10 text-foreground cursor-pointer",
                !rec && !isDecider && !isAvailable && "bg-secondary/30 border-border/30 text-muted-foreground opacity-40",
              )}>
              {map}
              {rec && <span className="block text-2xs font-normal no-underline opacity-80 truncate">{name(rec.team)}{picked && rec.team1StartSide ? ` · ${team1} ${rec.team1StartSide}` : ""}</span>}
              {banned && <Ban className="absolute top-0.5 right-0.5 w-3 h-3 text-destructive" />}
              {picked && <Check className="absolute top-0.5 right-0.5 w-3 h-3 text-win" />}
            </button>
          );
        })}
      </div>

      {records.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Historia veto</p>
          <div className="flex flex-wrap gap-1">
            {records.map((v, i) => (
              <span key={i} className={cn("text-xs font-mono px-2 py-0.5 rounded border",
                v.action === "ban" ? "text-destructive/80 bg-destructive/5 border-destructive/20" : "text-win bg-win/5 border-win/20")}>
                {i + 1}. {name(v.team)}: {v.action === "ban" ? "✗" : "✓"} {v.map}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default MapVeto;
