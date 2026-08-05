import { useState } from "react";
import { Map as MapIcon, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ALL_MAPS, ACTIVE_POOL_SIZE, DEFAULT_ACTIVE_MAPS, getActiveMaps, setActiveMaps } from "@/lib/mapPool";

const MapPoolPanel = () => {
  const [selected, setSelected] = useState<string[]>(() => getActiveMaps());

  const toggle = (map: string) => {
    setSelected(prev => prev.includes(map) ? prev.filter(m => m !== map) : [...prev, map]);
  };

  const save = () => {
    if (selected.length !== ACTIVE_POOL_SIZE) {
      toast.error(`Pula aktywna musi mieć dokładnie ${ACTIVE_POOL_SIZE} map (masz ${selected.length}).`);
      return;
    }
    setActiveMaps(selected);
    toast.success("Zapisano aktywną pulę map");
  };

  const reset = () => {
    setSelected([...DEFAULT_ACTIVE_MAPS]);
    setActiveMaps(DEFAULT_ACTIVE_MAPS);
    toast.success("Przywrócono domyślną pulę");
  };

  const count = selected.length;
  const ok = count === ACTIVE_POOL_SIZE;

  return (
    <div className="bg-card border border-border rounded-lg p-6 mb-6">
      <h3 className="font-heading font-bold text-foreground mb-1 flex items-center gap-2">
        <MapIcon className="w-4 h-4 text-primary" />
        Pula map
      </h3>
      <p className="text-xs font-mono text-muted-foreground mb-4">
        Wybierz dokładnie {ACTIVE_POOL_SIZE} map aktywnych — pozostałe 2 są poza pulą. Aktywne mapy są używane w vecie,
        symulacjach i wyborze map w meczach.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {ALL_MAPS.map(map => {
          const active = selected.includes(map);
          return (
            <button
              key={map}
              type="button"
              onClick={() => toggle(map)}
              className={cn(
                "flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-sm font-mono transition-colors",
                active
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/60",
              )}
            >
              <span>{map}</span>
              {active ? <Check className="w-3.5 h-3.5" /> : <span className="text-xs opacity-60">poza pulą</span>}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("text-xs font-mono", ok ? "text-primary" : "text-destructive")}>
          Wybrano {count}/{ACTIVE_POOL_SIZE}
        </span>
        <button
          onClick={save}
          disabled={!ok}
          className={cn(
            "ml-auto px-3 py-1.5 text-xs font-mono rounded border transition-colors",
            ok
              ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
              : "border-border text-muted-foreground opacity-50 cursor-not-allowed",
          )}
        >
          Zapisz pulę
        </button>
        <button
          onClick={reset}
          className="px-3 py-1.5 text-xs font-mono rounded border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Domyślna
        </button>
      </div>
    </div>
  );
};

export default MapPoolPanel;
