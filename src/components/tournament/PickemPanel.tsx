import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Trophy, Save, RotateCcw, CheckCircle2, ChevronDown, ChevronUp, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TournamentData, PhaseGroup } from "@/lib/types";
import { computeGroupStandings } from "@/lib/tournamentBuilder";
import { isPlaceholder } from "@/lib/teamHelpers";
import TeamLogo from "@/components/TeamLogo";

/** Per-group pick: top team and bottom team in final standings. */
interface GroupPick {
  first: string;
  last: string;
}

interface PickemData {
  /** groupId -> pick */
  groups: Record<string, GroupPick>;
  champion: string;
  runnerUp: string;
  /** ISO timestamp when picks were locked-in (read-only after that) */
  lockedAt?: string;
}

const STORAGE_PREFIX = "pickem-";

const SCORING = {
  groupFirst: 5,
  groupLast: 3,
  champion: 15,
  runnerUp: 8,
} as const;

const loadPicks = (tournamentId: string): PickemData => {
  if (typeof window === "undefined") return { groups: {}, champion: "", runnerUp: "" };
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + tournamentId);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { groups: {}, champion: "", runnerUp: "" };
};

const savePicks = (tournamentId: string, data: PickemData) => {
  try { localStorage.setItem(STORAGE_PREFIX + tournamentId, JSON.stringify(data)); } catch {}
};

interface Props {
  tournament: TournamentData;
}

export const PickemPanel = ({ tournament: t }: Props) => {
  // Collect all groups across phases that have been drawn (≥3 non-placeholder teams).
  const drawnGroups = useMemo(() => {
    const out: { phaseName: string; group: PhaseGroup }[] = [];
    t.phases.forEach(p => {
      p.groups?.forEach(g => {
        const real = g.teams.filter(x => x && !isPlaceholder(x));
        if (real.length >= 3) out.push({ phaseName: p.name, group: g });
      });
    });
    return out;
  }, [t.phases]);

  const champOptions = useMemo(
    () => Array.from(new Set(t.participants.filter(x => x && !isPlaceholder(x)))).sort(),
    [t.participants]
  );

  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PickemData>(() => loadPicks(t.id));
  const [draft, setDraft] = useState<PickemData>(data);
  const [editing, setEditing] = useState(false);

  // Re-load when tournament changes
  useEffect(() => {
    const fresh = loadPicks(t.id);
    setData(fresh);
    setDraft(fresh);
    setEditing(false);
  }, [t.id]);

  const isLocked = t.status !== "upcoming"; // raz turniej ruszył → blokada zmian
  const canEdit = !isLocked && (editing || !data.lockedAt);

  // ===== Scoring (after results confirmed) =====
  const scoring = useMemo(() => {
    if (!t.resultsConfirmed) return null;
    let points = 0;
    const breakdown: { label: string; got: number; max: number }[] = [];

    drawnGroups.forEach(({ phaseName, group }) => {
      const standings = computeGroupStandings(group);
      if (standings.length === 0) return;
      const actualFirst = standings[0]?.team;
      const actualLast = standings[standings.length - 1]?.team;
      const pick = data.groups[group.id];
      let got = 0;
      const max = SCORING.groupFirst + SCORING.groupLast;
      if (pick?.first && pick.first === actualFirst) { got += SCORING.groupFirst; }
      if (pick?.last && pick.last === actualLast) { got += SCORING.groupLast; }
      points += got;
      breakdown.push({ label: `${phaseName} — ${group.name}`, got, max });
    });

    const place1 = t.placements.find(p => p.placement === 1)?.team;
    const place2 = t.placements.find(p => p.placement === 2)?.team;
    let final = 0;
    const finalMax = SCORING.champion + SCORING.runnerUp;
    if (data.champion && data.champion === place1) final += SCORING.champion;
    if (data.runnerUp && data.runnerUp === place2) final += SCORING.runnerUp;
    points += final;
    breakdown.push({ label: "Finał (mistrz + wicemistrz)", got: final, max: finalMax });

    const max = breakdown.reduce((s, b) => s + b.max, 0);
    return { points, max, breakdown };
  }, [t.resultsConfirmed, t.placements, drawnGroups, data]);

  if (drawnGroups.length === 0) return null;

  const handleSave = () => {
    const locked = { ...draft, lockedAt: new Date().toISOString() };
    savePicks(t.id, locked);
    setData(locked);
    setEditing(false);
  };

  const handleReset = () => {
    const empty: PickemData = { groups: {}, champion: "", runnerUp: "" };
    savePicks(t.id, empty);
    setData(empty);
    setDraft(empty);
    setEditing(false);
  };

  const totalSlots = drawnGroups.length * 2 + 2;
  const filledSlots = drawnGroups.reduce((s, { group }) => {
    const p = data.groups[group.id];
    return s + (p?.first ? 1 : 0) + (p?.last ? 1 : 0);
  }, 0) + (data.champion ? 1 : 0) + (data.runnerUp ? 1 : 0);

  return (
    <div className="bg-card border border-border rounded-lg mb-6 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-md bg-[hsl(var(--gold))]/15 border border-[hsl(var(--gold))]/40 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-[hsl(var(--gold))]" />
          </div>
          <div className="text-left min-w-0">
            <h3 className="text-sm font-heading font-bold text-foreground leading-tight">
              Pick'em — Twoje typy
            </h3>
            <p className="text-[10px] font-mono text-muted-foreground truncate">
              {scoring
                ? `Wynik: ${scoring.points} / ${scoring.max} pkt`
                : isLocked
                  ? `Typy zablokowane • ${filledSlots}/${totalSlots} obstawionych`
                  : `${filledSlots}/${totalSlots} obstawionych • zmiany aż do startu turnieju`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {scoring && (
            <span className="text-[10px] font-mono px-2 py-1 rounded border border-[hsl(var(--gold))]/40 bg-[hsl(var(--gold))]/10 text-[hsl(var(--gold))]">
              {scoring.points} pkt
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-4 space-y-4">
              {/* Scoring overview */}
              {scoring && (
                <div className="bg-[hsl(var(--gold))]/5 border border-[hsl(var(--gold))]/30 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-4 h-4 text-[hsl(var(--gold))]" />
                    <span className="text-xs font-heading font-bold uppercase text-[hsl(var(--gold))] tracking-wider">
                      Podsumowanie Pick'ema
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                      Skuteczność: {scoring.max > 0 ? Math.round((scoring.points / scoring.max) * 100) : 0}%
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {scoring.breakdown.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] font-mono px-2 py-1 rounded bg-card border border-border">
                        <span className="text-muted-foreground truncate pr-2">{b.label}</span>
                        <span className={cn(
                          "tabular-nums shrink-0",
                          b.got === b.max ? "text-[hsl(var(--win))]" :
                          b.got > 0 ? "text-primary" : "text-muted-foreground"
                        )}>
                          {b.got}/{b.max}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Status banner */}
              {!scoring && isLocked && (
                <div className="bg-secondary/30 border border-border rounded-md p-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Turniej wystartował — typy są zablokowane do podliczenia po zatwierdzeniu wyników.
                  </p>
                </div>
              )}

              {/* Groups */}
              <div className="grid md:grid-cols-2 gap-3">
                {drawnGroups.map(({ phaseName, group }) => {
                  const teams = group.teams.filter(x => x && !isPlaceholder(x));
                  const pickSource = canEdit ? draft : data;
                  const pick = pickSource.groups[group.id] || { first: "", last: "" };
                  const standings = scoring ? computeGroupStandings(group) : null;
                  const actualFirst = standings?.[0]?.team;
                  const actualLast = standings?.[standings.length - 1]?.team;

                  const setPick = (patch: Partial<GroupPick>) => {
                    setDraft(d => ({
                      ...d,
                      groups: { ...d.groups, [group.id]: { ...pick, ...patch } as GroupPick },
                    }));
                  };

                  const Row = ({
                    label, value, onChange, actual, color,
                  }: { label: string; value: string; onChange: (v: string) => void; actual?: string; color: string }) => (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={cn("text-[10px] font-mono uppercase tracking-wider", color)}>{label}</span>
                        {scoring && actual && (
                          <span className={cn(
                            "text-[10px] font-mono",
                            value === actual ? "text-[hsl(var(--win))]" : "text-destructive"
                          )}>
                            {value === actual ? "✓ trafione" : `✗ było: ${actual}`}
                          </span>
                        )}
                      </div>
                      <select
                        disabled={!canEdit}
                        value={value}
                        onChange={e => onChange(e.target.value)}
                        className={cn(
                          "w-full px-2 py-1.5 rounded bg-secondary/50 border text-xs font-mono",
                          canEdit ? "border-border" : "border-border/50 opacity-80 cursor-not-allowed",
                          value && scoring && actual ? (value === actual ? "border-[hsl(var(--win))]/40" : "border-destructive/40") : ""
                        )}
                      >
                        <option value="">— wybierz —</option>
                        {teams.map(team => (
                          <option key={team} value={team}>{team}</option>
                        ))}
                      </select>
                    </div>
                  );

                  return (
                    <div key={group.id} className="bg-secondary/20 border border-border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-heading font-bold text-foreground">{group.name}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{phaseName}</span>
                      </div>
                      <Row
                        label={`🥇 1 miejsce (+${SCORING.groupFirst})`}
                        value={pick.first}
                        onChange={v => setPick({ first: v })}
                        actual={actualFirst}
                        color="text-[hsl(var(--gold))]"
                      />
                      <Row
                        label={`💀 Ostatnie miejsce (+${SCORING.groupLast})`}
                        value={pick.last}
                        onChange={v => setPick({ last: v })}
                        actual={actualLast}
                        color="text-destructive"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Champion / Runner-up */}
              <div className="bg-gradient-to-br from-[hsl(var(--gold))]/5 to-card border border-[hsl(var(--gold))]/30 rounded-md p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[hsl(var(--gold))]" />
                  <span className="text-xs font-heading font-bold uppercase text-[hsl(var(--gold))] tracking-wider">
                    Wielki Finał
                  </span>
                </div>
                {(() => {
                  const pickSource = canEdit ? draft : data;
                  const place1 = t.placements.find(p => p.placement === 1)?.team;
                  const place2 = t.placements.find(p => p.placement === 2)?.team;
                  const FinalRow = ({
                    label, value, onChange, actual, points,
                  }: { label: string; value: string; onChange: (v: string) => void; actual?: string; points: number }) => (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--gold))]">
                          {label} (+{points})
                        </span>
                        {scoring && actual && (
                          <span className={cn(
                            "text-[10px] font-mono",
                            value === actual ? "text-[hsl(var(--win))]" : "text-destructive"
                          )}>
                            {value === actual ? "✓ trafione" : `✗ było: ${actual}`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {value && !isPlaceholder(value) && <TeamLogo teamName={value} size={22} rounded="md" />}
                        <select
                          disabled={!canEdit}
                          value={value}
                          onChange={e => onChange(e.target.value)}
                          className={cn(
                            "flex-1 px-2 py-1.5 rounded bg-secondary/50 border text-xs font-mono",
                            canEdit ? "border-border" : "border-border/50 opacity-80 cursor-not-allowed",
                          )}
                        >
                          <option value="">— wybierz —</option>
                          {champOptions.map(team => (
                            <option key={team} value={team}>{team}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                  return (
                    <>
                      <FinalRow
                        label="🏆 Mistrz"
                        value={pickSource.champion}
                        onChange={v => setDraft(d => ({ ...d, champion: v }))}
                        actual={place1}
                        points={SCORING.champion}
                      />
                      <FinalRow
                        label="🥈 Wicemistrz"
                        value={pickSource.runnerUp}
                        onChange={v => setDraft(d => ({ ...d, runnerUp: v }))}
                        actual={place2}
                        points={SCORING.runnerUp}
                      />
                    </>
                  );
                })()}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
                {canEdit ? (
                  <>
                    <Button size="sm" onClick={handleSave} className="gap-1.5">
                      <Save className="w-3.5 h-3.5" />
                      {data.lockedAt ? "Aktualizuj typy" : "Zapisz typy"}
                    </Button>
                    {editing && (
                      <Button size="sm" variant="ghost" onClick={() => { setDraft(data); setEditing(false); }}>
                        Anuluj
                      </Button>
                    )}
                  </>
                ) : !isLocked && data.lockedAt ? (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    Edytuj typy
                  </Button>
                ) : null}
                {(data.champion || Object.keys(data.groups).length > 0) && !isLocked && (
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto gap-1.5" onClick={handleReset}>
                    <RotateCcw className="w-3.5 h-3.5" /> Resetuj
                  </Button>
                )}
              </div>

              <p className="text-[10px] font-mono text-muted-foreground">
                💡 Typuj 1. i ostatnie miejsce w każdej grupie oraz mistrza/wicemistrza turnieju. Po zatwierdzeniu wyników zobaczysz punkty.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PickemPanel;
