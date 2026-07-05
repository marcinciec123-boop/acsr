import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Trophy, Save, RotateCcw, CheckCircle2, ChevronDown, ChevronUp, Award, Zap, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TournamentData, PhaseGroup, TournamentPhase, MatchResult } from "@/lib/types";
import { computeGroupStandings } from "@/lib/tournamentBuilder";
import { computeSwissStage } from "@/lib/swissEngine";
import { isPlaceholder } from "@/lib/teamHelpers";
import TeamLogo from "@/components/TeamLogo";

interface GroupPick { first: string; last: string; }
/** Swiss picks: recordKey (e.g. "3-0") -> array of team names (fixed length). */
type SwissPhasePicks = Record<string, string[]>;
/** Bracket picks: matchId -> team the user thinks wins. */
type BracketPhasePicks = Record<string, string>;

interface PickemData {
  groups: Record<string, GroupPick>;
  /** phaseId -> record buckets */
  swiss: Record<string, SwissPhasePicks>;
  /** phaseId -> match winner picks */
  bracket: Record<string, BracketPhasePicks>;
  champion: string;
  runnerUp: string;
  lockedAt?: string;
}

const STORAGE_PREFIX = "pickem-";

const SCORING = {
  groupFirst: 5,
  groupLast: 3,
  swissRecord: 3,          // per correctly picked team in a swiss bucket
  bracketMatch: 4,          // per correctly picked bracket match winner
  champion: 15,
  runnerUp: 8,
} as const;

const emptyPicks = (): PickemData => ({
  groups: {}, swiss: {}, bracket: {}, champion: "", runnerUp: "",
});

const loadPicks = (id: string): PickemData => {
  if (typeof window === "undefined") return emptyPicks();
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + id);
    if (raw) return { ...emptyPicks(), ...JSON.parse(raw) };
  } catch {}
  return emptyPicks();
};

const savePicks = (id: string, data: PickemData) => {
  try { localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(data)); } catch {}
};

/** For winCap N, define bucket slots: advance side (N-0,N-1,...N-(N-1)) and elim mirror. */
const swissBuckets = (winCap: number): { key: string; slots: number; type: "advance" | "elim" }[] => {
  const out: { key: string; slots: number; type: "advance" | "elim" }[] = [];
  // Advance side: N-k losses, k=0..N-1. Slots = k+1 (1,2,3,...)
  for (let k = 0; k < winCap; k++) out.push({ key: `${winCap}-${k}`, slots: k + 1, type: "advance" });
  // Elim side: k wins, N losses
  for (let k = 0; k < winCap; k++) out.push({ key: `${k}-${winCap}`, slots: k + 1, type: "elim" });
  return out;
};

interface Props { tournament: TournamentData; }

export const PickemPanel = ({ tournament: t }: Props) => {
  // Drawn RR/GSL groups
  const drawnGroups = useMemo(() => {
    const out: { phaseName: string; group: PhaseGroup }[] = [];
    t.phases.forEach(p => {
      if (p.format !== "round-robin" && p.format !== "gsl-groups" && p.format !== "gsl-de-groups") return;
      p.groups?.forEach(g => {
        const real = g.teams.filter(x => x && !isPlaceholder(x));
        if (real.length >= 3) out.push({ phaseName: p.name, group: g });
      });
    });
    return out;
  }, [t.phases]);

  // Swiss phases (with a set roster)
  const swissPhases = useMemo(() => {
    return t.phases.filter(p => {
      if (p.format !== "swiss") return false;
      const teams = (p.teams || []).filter(x => x && !isPlaceholder(x));
      return teams.length >= 4;
    });
  }, [t.phases]);

  // Bracket phases (SE/DE) with drawn matches
  const bracketPhases = useMemo(() => {
    return t.phases.filter(p => {
      if (p.format !== "single-elim" && p.format !== "double-elim") return false;
      const matches = (p.bracket || []).filter(m => m.team1 && m.team2 && !isPlaceholder(m.team1) && !isPlaceholder(m.team2));
      return matches.length > 0;
    });
  }, [t.phases]);

  const champOptions = useMemo(
    () => Array.from(new Set(t.participants.filter(x => x && !isPlaceholder(x)))).sort(),
    [t.participants]
  );

  const [open, setOpen] = useState(false);
  const [data, setData] = useState<PickemData>(() => loadPicks(t.id));
  const [draft, setDraft] = useState<PickemData>(data);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const fresh = loadPicks(t.id);
    setData(fresh);
    setDraft(fresh);
    setEditing(false);
  }, [t.id]);

  // Tournament-level lock only when results have been confirmed.
  const isLocked = !!t.resultsConfirmed;
  const canEdit = !isLocked && (editing || !data.lockedAt);

  // Per-group lock: locked once ANY match in the group has been played.
  const groupLocked = (group: PhaseGroup) =>
    (group.matches || []).some(m => (m.score1 + m.score2) > 0);

  // Per-swiss-phase lock: locked once ANY swiss match has been played
  // (records can only meaningfully be predicted before the phase starts).
  const swissPhaseLocked = (phase: TournamentPhase) =>
    (phase.bracket || []).some(m => (m.score1 + m.score2) > 0);

  // Per-bracket-match lock: only lock that specific match once it has been played.
  const matchLocked = (m: MatchResult) => (m.score1 + m.score2) > 0;

  // Champion/runnerUp: unlock until results are confirmed (still adjustable during playoffs).
  const finalLocked = isLocked;

  // ===== Scoring =====
  const scoring = useMemo(() => {
    if (!t.resultsConfirmed) return null;
    let points = 0;
    const breakdown: { label: string; got: number; max: number }[] = [];

    drawnGroups.forEach(({ phaseName, group }) => {
      const standings = computeGroupStandings(group);
      if (!standings.length) return;
      const actualFirst = standings[0]?.team;
      const actualLast = standings[standings.length - 1]?.team;
      const pick = data.groups[group.id];
      let got = 0;
      const max = SCORING.groupFirst + SCORING.groupLast;
      if (pick?.first === actualFirst) got += SCORING.groupFirst;
      if (pick?.last === actualLast) got += SCORING.groupLast;
      points += got;
      breakdown.push({ label: `${phaseName} — ${group.name}`, got, max });
    });

    swissPhases.forEach(p => {
      const stage = computeSwissStage(p.teams, p.bracket || [], { winCap: 3 });
      const buckets = swissBuckets(3);
      const actualByRec = new Map<string, string[]>();
      stage.standings.forEach(s => {
        const key = `${s.wins}-${s.losses}`;
        if (!actualByRec.has(key)) actualByRec.set(key, []);
        actualByRec.get(key)!.push(s.team);
      });
      const phasePicks = data.swiss[p.id] || {};
      let got = 0; let max = 0;
      buckets.forEach(b => {
        const actual = new Set(actualByRec.get(b.key) || []);
        max += b.slots * SCORING.swissRecord;
        (phasePicks[b.key] || []).forEach(team => {
          if (team && actual.has(team)) got += SCORING.swissRecord;
        });
      });
      points += got;
      breakdown.push({ label: `${p.name} — Swiss rekordy`, got, max });
    });

    bracketPhases.forEach(p => {
      const phasePicks = data.bracket[p.id] || {};
      let got = 0; let max = 0;
      (p.bracket || []).forEach(m => {
        if (!m.team1 || !m.team2 || isPlaceholder(m.team1) || isPlaceholder(m.team2)) return;
        const played = (m.score1 + m.score2) > 0;
        if (!played) return;
        max += SCORING.bracketMatch;
        const actualWinner = m.score1 > m.score2 ? m.team1 : m.team2;
        if (phasePicks[m.id] && phasePicks[m.id] === actualWinner) got += SCORING.bracketMatch;
      });
      if (max > 0) {
        points += got;
        breakdown.push({ label: `${p.name} — mecze`, got, max });
      }
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
  }, [t.resultsConfirmed, t.placements, drawnGroups, swissPhases, bracketPhases, data]);

  const hasContent = drawnGroups.length > 0 || swissPhases.length > 0 || bracketPhases.length > 0;
  if (!hasContent) return null;

  const handleSave = () => {
    const locked = { ...draft, lockedAt: new Date().toISOString() };
    savePicks(t.id, locked);
    setData(locked);
    setEditing(false);
  };
  const handleReset = () => {
    const empty = emptyPicks();
    savePicks(t.id, empty);
    setData(empty); setDraft(empty); setEditing(false);
  };

  // Filled/total counter
  const totalSlots = (() => {
    let n = drawnGroups.length * 2 + 2;
    swissPhases.forEach(() => swissBuckets(3).forEach(b => { n += b.slots; }));
    bracketPhases.forEach(p => {
      (p.bracket || []).forEach(m => {
        if (m.team1 && m.team2 && !isPlaceholder(m.team1) && !isPlaceholder(m.team2)) n += 1;
      });
    });
    return n;
  })();
  const filledSlots = (() => {
    let n = 0;
    drawnGroups.forEach(({ group }) => {
      const p = data.groups[group.id];
      n += (p?.first ? 1 : 0) + (p?.last ? 1 : 0);
    });
    swissPhases.forEach(p => {
      const picks = data.swiss[p.id] || {};
      swissBuckets(3).forEach(b => {
        (picks[b.key] || []).forEach(v => { if (v) n += 1; });
      });
    });
    bracketPhases.forEach(p => {
      const picks = data.bracket[p.id] || {};
      Object.values(picks).forEach(v => { if (v) n += 1; });
    });
    n += (data.champion ? 1 : 0) + (data.runnerUp ? 1 : 0);
    return n;
  })();

  const pickSource = canEdit ? draft : data;

  const setSwissPick = (phaseId: string, bucketKey: string, slotIdx: number, value: string) => {
    setDraft(d => {
      const phase = { ...(d.swiss[phaseId] || {}) };
      const arr = [...(phase[bucketKey] || [])];
      arr[slotIdx] = value;
      phase[bucketKey] = arr;
      return { ...d, swiss: { ...d.swiss, [phaseId]: phase } };
    });
  };

  const setBracketPick = (phaseId: string, matchId: string, value: string) => {
    setDraft(d => {
      const phase = { ...(d.bracket[phaseId] || {}) };
      phase[matchId] = value;
      return { ...d, bracket: { ...d.bracket, [phaseId]: phase } };
    });
  };

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
            <h3 className="text-sm font-heading font-bold text-foreground leading-tight">Pick'em — Twoje typy</h3>
            <p className="text-[10px] font-mono text-muted-foreground truncate">
              {scoring ? `Wynik: ${scoring.points} / ${scoring.max} pkt`
                : isLocked ? `Typy zablokowane • ${filledSlots}/${totalSlots} obstawionych`
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
              {scoring && (
                <div className="bg-[hsl(var(--gold))]/5 border border-[hsl(var(--gold))]/30 rounded-md p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-4 h-4 text-[hsl(var(--gold))]" />
                    <span className="text-xs font-heading font-bold uppercase text-[hsl(var(--gold))] tracking-wider">Podsumowanie Pick'ema</span>
                    <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                      Skuteczność: {scoring.max > 0 ? Math.round((scoring.points / scoring.max) * 100) : 0}%
                    </span>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {scoring.breakdown.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] font-mono px-2 py-1 rounded bg-card border border-border">
                        <span className="text-muted-foreground truncate pr-2">{b.label}</span>
                        <span className={cn("tabular-nums shrink-0",
                          b.got === b.max ? "text-[hsl(var(--win))]" :
                          b.got > 0 ? "text-primary" : "text-muted-foreground"
                        )}>{b.got}/{b.max}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!scoring && isLocked && (
                <div className="bg-secondary/30 border border-border rounded-md p-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Turniej wystartował — typy są zablokowane do podliczenia po zatwierdzeniu wyników.
                  </p>
                </div>
              )}

              {/* RR/GSL Groups */}
              {drawnGroups.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Grupy</div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {drawnGroups.map(({ phaseName, group }) => {
                      const teams = group.teams.filter(x => x && !isPlaceholder(x));
                      const pick = pickSource.groups[group.id] || { first: "", last: "" };
                      const standings = scoring ? computeGroupStandings(group) : null;
                      const actualFirst = standings?.[0]?.team;
                      const actualLast = standings?.[standings.length - 1]?.team;
                      const locked = !canEdit || groupLocked(group);
                      const setPick = (patch: Partial<GroupPick>) => {
                        setDraft(d => ({
                          ...d,
                          groups: { ...d.groups, [group.id]: { ...pick, ...patch } as GroupPick },
                        }));
                      };
                      const Row = ({ label, value, onChange, actual, color }: any) => (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className={cn("text-[10px] font-mono uppercase tracking-wider", color)}>{label}</span>
                            {scoring && actual && (
                              <span className={cn("text-[10px] font-mono", value === actual ? "text-[hsl(var(--win))]" : "text-destructive")}>
                                {value === actual ? "✓ trafione" : `✗ było: ${actual}`}
                              </span>
                            )}
                          </div>
                          <select
                            disabled={locked}
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            className={cn("w-full px-2 py-1.5 rounded bg-secondary/50 border text-xs font-mono",
                              !locked ? "border-border" : "border-border/50 opacity-80 cursor-not-allowed")}
                          >
                            <option value="">— wybierz —</option>
                            {teams.map(team => <option key={team} value={team}>{team}</option>)}
                          </select>
                        </div>
                      );
                      return (
                        <div key={group.id} className="bg-secondary/20 border border-border rounded-md p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-heading font-bold text-foreground">{group.name}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {phaseName}{locked && groupLocked(group) ? " • 🔒" : ""}
                            </span>
                          </div>
                          <Row label={`🥇 1 miejsce (+${SCORING.groupFirst})`} value={pick.first} onChange={(v: string) => setPick({ first: v })} actual={actualFirst} color="text-[hsl(var(--gold))]" />
                          <Row label={`💀 Ostatnie miejsce (+${SCORING.groupLast})`} value={pick.last} onChange={(v: string) => setPick({ last: v })} actual={actualLast} color="text-destructive" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Swiss records */}
              {swissPhases.map(phase => {
                const teams = (phase.teams || []).filter(x => x && !isPlaceholder(x));
                const buckets = swissBuckets(3);
                const stage = scoring ? computeSwissStage(phase.teams, phase.bracket || [], { winCap: 3 }) : null;
                const actualByRec = new Map<string, string[]>();
                stage?.standings.forEach(s => {
                  const key = `${s.wins}-${s.losses}`;
                  if (!actualByRec.has(key)) actualByRec.set(key, []);
                  actualByRec.get(key)!.push(s.team);
                });
                const phasePicks = pickSource.swiss[phase.id] || {};
                const phaseLocked = !canEdit || swissPhaseLocked(phase);
                return (
                  <div key={phase.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-primary" />
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {phase.name} — Swiss rekordy (+{SCORING.swissRecord} pkt za trafienie){phaseLocked && swissPhaseLocked(phase) ? " 🔒" : ""}
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-3">
                      {(["advance", "elim"] as const).map(side => (
                        <div key={side} className={cn("border rounded-md p-3 space-y-2",
                          side === "advance" ? "bg-[hsl(var(--win))]/5 border-[hsl(var(--win))]/30" : "bg-destructive/5 border-destructive/30"
                        )}>
                          <div className={cn("text-xs font-heading font-bold uppercase tracking-wider",
                            side === "advance" ? "text-[hsl(var(--win))]" : "text-destructive"
                          )}>
                            {side === "advance" ? "✅ Awans" : "❌ Eliminacja"}
                          </div>
                          {buckets.filter(b => b.type === side).map(b => {
                            const picks = phasePicks[b.key] || [];
                            const actual = new Set(actualByRec.get(b.key) || []);
                            return (
                              <div key={b.key} className="space-y-1">
                                <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                                  Rekord {b.key} ({b.slots} {b.slots === 1 ? "drużyna" : "drużyny"})
                                </div>
                                <div className="grid grid-cols-1 gap-1.5">
                                  {Array.from({ length: b.slots }).map((_, slotIdx) => {
                                    const value = picks[slotIdx] || "";
                                    const hit = scoring && value && actual.has(value);
                                    return (
                                      <select
                                        key={slotIdx}
                                        disabled={phaseLocked}
                                        value={value}
                                        onChange={e => setSwissPick(phase.id, b.key, slotIdx, e.target.value)}
                                        className={cn("w-full px-2 py-1.5 rounded bg-secondary/50 border text-xs font-mono",
                                          !phaseLocked ? "border-border" : "border-border/50 opacity-80 cursor-not-allowed",
                                          scoring && value ? (hit ? "border-[hsl(var(--win))]/40 text-[hsl(var(--win))]" : "border-destructive/40 text-destructive") : ""
                                        )}
                                      >
                                        <option value="">— wybierz —</option>
                                        {teams.map(team => <option key={team} value={team}>{team}</option>)}
                                      </select>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Bracket match picks */}
              {bracketPhases.map(phase => {
                const matches = (phase.bracket || []).filter(m => m.team1 && m.team2 && !isPlaceholder(m.team1) && !isPlaceholder(m.team2));
                const phasePicks = pickSource.bracket[phase.id] || {};
                // Group by round label if present
                const byRound = new Map<string, MatchResult[]>();
                matches.forEach(m => {
                  const key = m.round || "Runda";
                  if (!byRound.has(key)) byRound.set(key, []);
                  byRound.get(key)!.push(m);
                });
                return (
                  <div key={phase.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-3.5 h-3.5 text-primary" />
                      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        {phase.name} — mecze (+{SCORING.bracketMatch} pkt za trafienie)
                      </div>
                    </div>
                    <div className="space-y-3">
                      {Array.from(byRound.entries()).map(([roundLabel, ms]) => (
                        <div key={roundLabel} className="bg-secondary/20 border border-border rounded-md p-3">
                          <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-2">{roundLabel}</div>
                          <div className="grid sm:grid-cols-2 gap-2">
                            {ms.map(m => {
                              const value = phasePicks[m.id] || "";
                              const played = matchLocked(m);
                              const actualWinner = played ? (m.score1 > m.score2 ? m.team1 : m.team2) : "";
                              const hit = scoring && value && actualWinner && value === actualWinner;
                              const wrong = scoring && value && actualWinner && value !== actualWinner;
                              const mLocked = !canEdit || played;
                              return (
                                <div key={m.id} className={cn("border rounded p-2 space-y-1.5 bg-card",
                                  hit ? "border-[hsl(var(--win))]/40" : wrong ? "border-destructive/40" : "border-border"
                                )}>
                                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                                    <span className="flex items-center gap-1.5"><TeamLogo teamName={m.team1} size={16} rounded="md" />{m.team1}</span>
                                    <span>{played ? "🔒" : "vs"}</span>
                                    <span className="flex items-center gap-1.5">{m.team2}<TeamLogo teamName={m.team2} size={16} rounded="md" /></span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-1">
                                    {[m.team1, m.team2].map(team => {
                                      const selected = value === team;
                                      return (
                                        <button
                                          key={team}
                                          type="button"
                                          disabled={mLocked}
                                          onClick={() => setBracketPick(phase.id, m.id, selected ? "" : team)}
                                          className={cn("px-2 py-1 rounded text-[11px] font-mono border transition-colors",
                                            selected
                                              ? "bg-primary/20 border-primary text-primary"
                                              : "bg-secondary/40 border-border text-muted-foreground hover:border-primary/40",
                                            mLocked && "opacity-70 cursor-not-allowed",
                                            hit && selected && "border-[hsl(var(--win))] text-[hsl(var(--win))] bg-[hsl(var(--win))]/10",
                                            wrong && selected && "border-destructive text-destructive bg-destructive/10"
                                          )}
                                        >
                                          {team}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  {scoring && played && (
                                    <div className={cn("text-[9px] font-mono text-right",
                                      hit ? "text-[hsl(var(--win))]" : "text-muted-foreground"
                                    )}>
                                      wygrał: {actualWinner} ({m.score1}:{m.score2})
                                    </div>
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
              })}

              {/* Finał */}
              <div className="bg-gradient-to-br from-[hsl(var(--gold))]/5 to-card border border-[hsl(var(--gold))]/30 rounded-md p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[hsl(var(--gold))]" />
                  <span className="text-xs font-heading font-bold uppercase text-[hsl(var(--gold))] tracking-wider">Wielki Finał</span>
                </div>
                {(() => {
                  const place1 = t.placements.find(p => p.placement === 1)?.team;
                  const place2 = t.placements.find(p => p.placement === 2)?.team;
                  const FinalRow = ({ label, value, onChange, actual, points }: any) => (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[hsl(var(--gold))]">{label} (+{points})</span>
                        {scoring && actual && (
                          <span className={cn("text-[10px] font-mono", value === actual ? "text-[hsl(var(--win))]" : "text-destructive")}>
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
                          className={cn("flex-1 px-2 py-1.5 rounded bg-secondary/50 border text-xs font-mono",
                            canEdit ? "border-border" : "border-border/50 opacity-80 cursor-not-allowed")}
                        >
                          <option value="">— wybierz —</option>
                          {champOptions.map(team => <option key={team} value={team}>{team}</option>)}
                        </select>
                      </div>
                    </div>
                  );
                  return (
                    <>
                      <FinalRow label="🏆 Mistrz" value={pickSource.champion} onChange={(v: string) => setDraft(d => ({ ...d, champion: v }))} actual={place1} points={SCORING.champion} />
                      <FinalRow label="🥈 Wicemistrz" value={pickSource.runnerUp} onChange={(v: string) => setDraft(d => ({ ...d, runnerUp: v }))} actual={place2} points={SCORING.runnerUp} />
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
                      <Button size="sm" variant="ghost" onClick={() => { setDraft(data); setEditing(false); }}>Anuluj</Button>
                    )}
                  </>
                ) : !isLocked && data.lockedAt ? (
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Edytuj typy</Button>
                ) : null}
                {(data.champion || Object.keys(data.groups).length > 0 || Object.keys(data.swiss).length > 0 || Object.keys(data.bracket).length > 0) && !isLocked && (
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive ml-auto gap-1.5" onClick={handleReset}>
                    <RotateCcw className="w-3.5 h-3.5" /> Resetuj
                  </Button>
                )}
              </div>

              <p className="text-[10px] font-mono text-muted-foreground">
                💡 Typuj w stylu CS Major: wyniki Swiss (3-0, 3-1, 3-2, 0-3, 1-3, 2-3), zwycięzców meczów w playoff, oraz mistrza/wicemistrza. Punkty naliczają się po zatwierdzeniu wyników.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PickemPanel;
