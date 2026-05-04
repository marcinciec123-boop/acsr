import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, RotateCcw, Save, Download, Trash2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tournament, TournamentSimulation } from "@/data/tournaments";
import { scheduleDeviceBackup } from "@/lib/deviceBackup";
import { DEVICE_STORE_REF, getCachedDeviceValue, removeDeviceValue, setDeviceValue } from "@/lib/deviceStore";
import TeamsManagementPanel from "./TeamsManagementPanel";

interface SaveSlot {
  label: string;
  tournaments: Tournament[];
  simResults: Record<string, TournamentSimulation>;
  savedAt: string;
}

interface SettingsTabProps {
  tournaments?: Tournament[];
  simResults?: Record<string, TournamentSimulation>;
  onReset?: () => void;
  onLoadState?: (tournaments: Tournament[], simResults: Record<string, TournamentSimulation>) => void;
}

const SLOT_KEYS = ["csgo_hub_save_1", "csgo_hub_save_2"];

const SettingsTab = ({
  tournaments = [],
  simResults = {},
  onReset = () => undefined,
  onLoadState = () => undefined,
}: SettingsTabProps) => {
  const [confirmReset, setConfirmReset] = useState(false);

  const getSlot = (key: string): SaveSlot | null => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === DEVICE_STORE_REF) {
        const cached = getCachedDeviceValue(key);
        return cached ? JSON.parse(cached) : null;
      }
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const [slots, setSlots] = useState<(SaveSlot | null)[]>(() =>
    SLOT_KEYS.map(k => getSlot(k))
  );

  const completedCount = tournaments.filter(t => t.status === "completed").length;
  const totalCount = tournaments.length;

  const saveToSlot = async (index: number) => {
    const slot: SaveSlot = {
      label: `Zapis ${index + 1}`,
      tournaments: tournaments.map(t => ({ ...t })),
      simResults: { ...simResults },
      savedAt: new Date().toLocaleString("pl-PL"),
    };
    const serialized = JSON.stringify(slot);
    await setDeviceValue(SLOT_KEYS[index], serialized);
    try { localStorage.setItem(SLOT_KEYS[index], serialized.length > 120_000 ? DEVICE_STORE_REF : serialized); }
    catch { try { localStorage.setItem(SLOT_KEYS[index], DEVICE_STORE_REF); } catch { /* device-only */ } }
    scheduleDeviceBackup();
    setSlots(prev => {
      const next = [...prev];
      next[index] = slot;
      return next;
    });
  };

  const loadSlot = (index: number) => {
    const slot = slots[index];
    if (!slot) return;
    onLoadState(slot.tournaments, slot.simResults);
  };

  const deleteSlot = (index: number) => {
    localStorage.removeItem(SLOT_KEYS[index]);
    void removeDeviceValue(SLOT_KEYS[index]).catch(() => undefined);
    scheduleDeviceBackup();
    setSlots(prev => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
  };

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    onReset();
    setConfirmReset(false);
  };

  return (
    <section className="py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-6 h-6 text-primary" />
          <h2 className="text-3xl font-heading font-bold text-foreground">Ustawienia</h2>
        </div>

        {/* Teams management */}
        <div className="mb-6">
          <TeamsManagementPanel />
        </div>

        {/* Season Status */}
        {totalCount > 0 && (
          <div className="bg-card border border-border rounded-lg p-6 mb-6">
            <h3 className="font-heading font-bold text-foreground mb-3">Stan sezonu</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full gradient-primary rounded-full transition-all"
                  style={{ width: `${(completedCount / totalCount) * 100}%` }}
                />
              </div>
              <span className="font-mono text-sm text-muted-foreground">{completedCount}/{totalCount}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {completedCount === 0
                ? "Sezon nie został jeszcze rozpoczęty."
                : completedCount === totalCount
                ? "Sezon zakończony! Wszystkie turnieje rozegrane."
                : `Rozegrano ${completedCount} z ${totalCount} turniejów.`}
            </p>
          </div>
        )}

        {/* Reset */}
        <div className="bg-card border border-border rounded-lg p-6 mb-6">
          <h3 className="font-heading font-bold text-foreground mb-3 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-destructive" />
            Reset sezonu
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Przywróć sezon do stanu początkowego. Wszystkie wyniki symulacji zostaną usunięte.
          </p>
          <button
            onClick={handleReset}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md font-mono text-sm transition-colors",
              confirmReset
                ? "bg-destructive text-destructive-foreground"
                : "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20"
            )}
          >
            {confirmReset ? (
              <>
                <AlertTriangle className="w-4 h-4" />
                Kliknij ponownie aby potwierdzić
              </>
            ) : (
              <>
                <RotateCcw className="w-4 h-4" />
                Resetuj sezon
              </>
            )}
          </button>
        </div>

        {/* Save Slots */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-heading font-bold text-foreground mb-4 flex items-center gap-2">
            <Save className="w-4 h-4 text-primary" />
            Sloty zapisu
          </h3>

          <div className="space-y-4">
            {slots.map((slot, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="border border-border rounded-lg p-4 bg-secondary/20"
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-heading font-bold text-foreground">Slot {i + 1}</h4>
                  {slot && (
                    <span className="text-xs font-mono text-muted-foreground">
                      Zapisano: {slot.savedAt}
                    </span>
                  )}
                </div>

                {slot ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-3">
                      {slot.tournaments.filter(t => t.status === "completed").length}/{slot.tournaments.length} turniejów rozegranych
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => loadSlot(i)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Wczytaj
                      </button>
                      <button
                        onClick={() => saveToSlot(i)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded border border-border text-foreground hover:bg-muted/30 transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" /> Nadpisz
                      </button>
                      <button
                        onClick={() => deleteSlot(i)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Usuń
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-3">Pusty slot — zapisz aktualny stan sezonu.</p>
                    <button
                      onClick={() => saveToSlot(i)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Save className="w-3.5 h-3.5" /> Zapisz tutaj
                    </button>
                  </>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SettingsTab;
