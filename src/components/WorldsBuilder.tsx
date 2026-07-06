import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Globe, Users, Trophy, Trash2, Plus, GitBranch } from "lucide-react";
import { availableCountries, playersByCountry, buildNationalTeamName, upsertNationalTeams, regionForCountry, countryName } from "@/lib/nationalTeams";
import { buildPhase, formatLabel } from "@/lib/tournamentBuilder";
import type { TournamentData, TournamentPhase, PhaseFormat, TeamData } from "@/lib/types";
import { toast } from "@/hooks/use-toast";
import { playerRoles, roleColors, roleIcons, type PlayerRole } from "@/data/playerRoles";
import { teamDatabase } from "@/data/tournaments";
import { loadFromStorage } from "@/lib/storage";

const ROLE_ORDER: PlayerRole[] = ["IGL", "AWPer", "Entry", "Lurker", "Anchor"];

/**
 * Ranked list of all players (best first) — from live ranking if present,
 * otherwise from the master teamDatabase. Sorted by team points desc.
 */
const rankedPlayers = (): string[] => {
  const teams = loadFromStorage<TeamData[] | null>("ranking_data", null) ?? teamDatabase;
  const sorted = [...teams].sort((a, b) => (b.points || 0) - (a.points || 0));
  const out: string[] = [];
  sorted.forEach(t => (t.roster || []).forEach(p => { if (!out.includes(p)) out.push(p); }));
  return out;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (tournament: TournamentData) => void;
}

interface NationDraft {
  code: string;
  label?: string;
  roster: string[];
}

interface PhaseDraft {
  name: string;
  format: PhaseFormat;
  bo: 1 | 3 | 5;
  groupCount: number;
  advanceCount: number;
  seededCount: number;
  teamCount: number;
  groupAssignment?: "random" | "manual";
}

const EMPTY_ROSTER = ["", "", "", "", ""];

const PHASE_FORMATS: { value: PhaseFormat; label: string }[] = [
  { value: "single-elim", label: "Single Elimination" },
  { value: "double-elim", label: "Double Elimination" },
  { value: "swiss", label: "Swiss System" },
  { value: "round-robin", label: "Round Robin (Groups)" },
  { value: "gsl-groups", label: "GSL Groups (4)" },
  { value: "gsl-de-groups", label: "IEM-style Groups (8, DE)" },
];

const DEFAULT_PHASES: PhaseDraft[] = [
  { name: "Group Stage", format: "round-robin", bo: 1, groupCount: 4, advanceCount: 8, seededCount: 0, teamCount: 0, groupAssignment: "random" },
  { name: "Playoffs", format: "single-elim", bo: 3, groupCount: 1, advanceCount: 0, seededCount: 0, teamCount: 0 },
];

export const WorldsBuilder = ({ open, onOpenChange, onCreated }: Props) => {
  const [nations, setNations] = useState<NationDraft[]>([]);
  const [countrySearch, setCountrySearch] = useState("");

  const [name, setName] = useState("Mistrzostwa Świata CS:GO");
  const [organizer, setOrganizer] = useState("FIVB / Custom");
  const [prize, setPrize] = useState("$1,000,000");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [tier, setTier] = useState<"S" | "A" | "B" | "C">("S");

  const [phaseDrafts, setPhaseDrafts] = useState<PhaseDraft[]>(DEFAULT_PHASES);

  const countries = useMemo(() => availableCountries(), []);
  const playerPool = useMemo(() => playersByCountry(), []);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.toUpperCase();
    return countries.filter(c => c.code.includes(q));
  }, [countries, countrySearch]);

  const nationCodes = new Set(nations.map(n => n.code));

  const addCountry = (code: string) => {
    if (nationCodes.has(code)) return;
    setNations(prev => [...prev, { code, label: countryName(code), roster: [...EMPTY_ROSTER] }]);
  };
  const removeCountry = (code: string) =>
    setNations(prev => prev.filter(n => n.code !== code));

  const updateNation = (code: string, patch: Partial<NationDraft>) =>
    setNations(prev => prev.map(n => n.code === code ? { ...n, ...patch } : n));

  const setRosterSlot = (code: string, idx: number, player: string) =>
    setNations(prev => prev.map(n => {
      if (n.code !== code) return n;
      const r = [...n.roster];
      r[idx] = player;
      return { ...n, roster: r };
    }));

  /**
   * Best-of-country pick: for each of the 5 roles, take the highest-ranked
   * player of that country holding that role. Falls back to remaining top
   * players from the country pool to fill any missing slots.
   */
  const autoFill = (code: string) => {
    const pool = new Set(playerPool[code] || []);
    const ranking = rankedPlayers();
    const chosen: string[] = [];
    ROLE_ORDER.forEach(role => {
      const best = ranking.find(p => pool.has(p) && playerRoles[p] === role && !chosen.includes(p));
      if (best) chosen.push(best);
    });
    if (chosen.length < 5) {
      for (const p of ranking) {
        if (chosen.length >= 5) break;
        if (pool.has(p) && !chosen.includes(p)) chosen.push(p);
      }
    }
    if (chosen.length < 5) {
      for (const p of pool) {
        if (chosen.length >= 5) break;
        if (!chosen.includes(p)) chosen.push(p);
      }
    }
    const filled = [...chosen, "", "", "", "", ""].slice(0, 5);
    setNations(prev => prev.map(n => n.code === code ? { ...n, roster: filled } : n));
  };

  const addPhaseDraft = () => {
    setPhaseDrafts(prev => [
      ...prev,
      { name: `Phase ${prev.length + 1}`, format: "single-elim", bo: 3, groupCount: 2, advanceCount: 4, seededCount: 0, teamCount: 0 },
    ]);
  };
  const updatePhaseDraft = (idx: number, patch: Partial<PhaseDraft>) => {
    setPhaseDrafts(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));
  };
  const removePhaseDraft = (idx: number) => {
    setPhaseDrafts(prev => prev.filter((_, i) => i !== idx));
  };

  const reset = () => {
    setNations([]); setCountrySearch("");
    setName("Mistrzostwa Świata CS:GO"); setOrganizer("FIVB / Custom");
    setPrize("$1,000,000"); setStart(""); setEnd(""); setLocation(""); setTier("S");
    setPhaseDrafts(DEFAULT_PHASES);
  };

  const canCreate = nations.length >= 2 && name.trim().length > 0 && phaseDrafts.length > 0;

  const handleCreate = () => {
    if (!canCreate) {
      toast({ title: "Brak danych", description: "Dodaj min. 2 reprezentacje, nazwij turniej i dodaj fazę.", variant: "destructive" });
      return;
    }
    const teamRecords: TeamData[] = nations.map(n => ({
      name: buildNationalTeamName(n.code, n.label),
      points: 0,
      country: n.code,
      region: regionForCountry(n.code),
      roster: n.roster.filter(p => p.trim().length > 0),
      isNational: true,
    }));
    upsertNationalTeams(teamRecords);

    const teamNames = teamRecords.map(t => t.name);

    // Build phases like normal tournaments (with TBD propagation)
    const phases: TournamentPhase[] = [];
    let teamsForPhase = [...teamNames];
    phaseDrafts.forEach((draft, idx) => {
      const incomingSize = teamsForPhase.length;
      const phaseSize = draft.teamCount > 0 ? draft.teamCount : incomingSize;
      const realCount = draft.seededCount > 0
        ? Math.min(draft.seededCount, phaseSize, incomingSize)
        : Math.min(incomingSize, phaseSize);
      const realPart = teamsForPhase.slice(0, realCount);
      const tbdPart = Array.from(
        { length: Math.max(0, phaseSize - realCount) },
        (_, i) => `TBD-P${idx}-${i + 1}`,
      );
      const phaseTeams = [...realPart, ...tbdPart];
      const phase = buildPhase(draft.name.trim() || `Phase ${idx + 1}`, draft.format, phaseTeams, {
        bo: draft.bo,
        groupCount: draft.groupCount,
        advanceCount: draft.advanceCount,
        groupAssignment: draft.groupAssignment ?? "random",
      });
      phases.push(phase);
      if (idx < phaseDrafts.length - 1) {
        const nextCount = draft.advanceCount || phaseTeams.length;
        teamsForPhase = Array.from({ length: nextCount }, (_, i) => `TBD-${idx}-${i + 1}`);
      }
    });

    const t: TournamentData = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: name.trim(),
      organizer: organizer.trim(),
      prizePool: prize.trim() || "$0",
      startDate: start,
      endDate: end,
      location: location.trim(),
      tier,
      teams: teamNames.length,
      format: phases.map(p => formatLabel(p.format)).join(" → "),
      status: "upcoming",
      participants: teamNames,
      phases,
      placements: [],
      kind: "worlds",
    };
    onCreated(t);
    reset();
    onOpenChange(false);
    toast({ title: "Mistrzostwa utworzone", description: `${teamNames.length} reprezentacji • ${phases.length} faz.` });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Kreator Mistrzostw Świata
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* STEP 1: countries */}
          <section className="space-y-2">
            <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">
              1. Wybór reprezentacji ({nations.length})
            </h3>
            <Input
              placeholder="Szukaj kraju (ISO np. PL, US)..."
              value={countrySearch}
              onChange={e => setCountrySearch(e.target.value)}
            />
            <div className="max-h-44 overflow-y-auto border border-border rounded-md p-2 grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 gap-1 bg-card/50">
              {filteredCountries.map(c => {
                const picked = nationCodes.has(c.code);
                return (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => picked ? removeCountry(c.code) : addCountry(c.code)}
                    className={cn(
                      "text-xs px-2 py-1.5 rounded font-mono transition-colors flex items-center gap-1 min-w-0",
                      picked
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60 border border-transparent"
                    )}
                    title={`${c.code} • ${c.playerCount} graczy`}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="truncate flex-1">{c.code}</span>
                    <span className="text-xs opacity-70">{c.playerCount}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* STEP 2: rosters */}
          {nations.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> 2. Składy reprezentacji
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {nations.map(n => {
                  const pool = playerPool[n.code] || [];
                  return (
                    <div key={n.code} className="bg-secondary/30 border border-border rounded p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <Input
                            value={n.label ?? ""}
                            placeholder={countryName(n.code)}
                            onChange={e => updateNation(n.code, { label: e.target.value })}
                            className="h-7 text-xs font-mono flex-1"
                          />
                          <span className="text-xs font-mono text-muted-foreground shrink-0">{pool.length} dost.</span>
                        </div>
                        <button
                          onClick={() => autoFill(n.code)}
                          className="text-xs font-mono text-primary hover:underline shrink-0"
                          title="Najlepszy gracz na każdą z 5 pozycji"
                        >auto</button>
                        <button
                          onClick={() => removeCountry(n.code)}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                          title="Usuń reprezentację"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        {n.roster.map((p, i) => {
                          const role = p ? playerRoles[p] : undefined;
                          return (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                            <select
                              value={p}
                              onChange={e => setRosterSlot(n.code, i, e.target.value)}
                              className="flex-1 text-xs font-mono bg-card border border-border rounded px-1.5 py-1 h-7"
                            >
                              <option value="">— wybierz gracza —</option>
                              {pool.map(pl => {
                                const r = playerRoles[pl];
                                return (
                                  <option key={pl} value={pl}>
                                    {pl}{r ? ` — ${roleIcons[r]} ${r}` : ""}
                                  </option>
                                );
                              })}
                              {p && !pool.includes(p) && <option value={p}>{p}</option>}
                            </select>
                            {role && (
                              <span
                                className={cn(
                                  "text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0",
                                  roleColors[role],
                                )}
                                title={role}
                              >
                                {roleIcons[role]} {role}
                              </span>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* STEP 3: meta */}
          <section className="space-y-2">
            <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider flex items-center gap-2">
              <Trophy className="w-3.5 h-3.5" /> 3. Dane turnieju
            </h3>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nazwa turnieju..." />
            <div className="grid grid-cols-2 gap-2">
              <Input value={organizer} onChange={e => setOrganizer(e.target.value)} placeholder="Organizator..." />
              <Input value={prize} onChange={e => setPrize(e.target.value)} placeholder="Pula nagród..." />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={start} onChange={e => setStart(e.target.value)} />
              <Input type="date" value={end} onChange={e => setEnd(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Lokalizacja..." />
              <select
                value={tier}
                onChange={e => setTier(e.target.value as "S" | "A" | "B" | "C")}
                className="px-3 py-2 rounded-md bg-card border border-border text-foreground text-sm font-mono"
              >
                <option value="S">Tier S</option><option value="A">Tier A</option>
                <option value="B">Tier B</option><option value="C">Tier C</option>
              </select>
            </div>
          </section>

          {/* STEP 4: custom multi-phase format */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider flex items-center gap-2">
                <GitBranch className="w-3.5 h-3.5" /> 4. Format (fazy: {phaseDrafts.length})
              </h3>
              <Button size="sm" variant="outline" onClick={addPhaseDraft} className="h-7 gap-1 text-xs">
                <Plus className="w-3 h-3" /> Dodaj fazę
              </Button>
            </div>

            {phaseDrafts.map((draft, idx) => {
              const hasGroups = draft.format === "round-robin" || draft.format === "gsl-groups" || draft.format === "gsl-de-groups";
              const hasAdvance = hasGroups || draft.format === "swiss";
              return (
                <div key={idx} className="bg-secondary/30 border border-border rounded p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground w-10 shrink-0">#{idx + 1}</span>
                    <Input
                      value={draft.name}
                      onChange={e => updatePhaseDraft(idx, { name: e.target.value })}
                      placeholder="Nazwa fazy..."
                      className="h-8 text-xs flex-1"
                    />
                    {phaseDrafts.length > 1 && (
                      <button
                        onClick={() => removePhaseDraft(idx)}
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        title="Usuń fazę"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <select
                      value={draft.format}
                      onChange={e => updatePhaseDraft(idx, { format: e.target.value as PhaseFormat })}
                      className="col-span-2 px-2 py-1.5 rounded bg-card border border-border text-foreground text-xs font-mono h-8"
                    >
                      {PHASE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <select
                      value={draft.bo}
                      onChange={e => updatePhaseDraft(idx, { bo: parseInt(e.target.value) as 1 | 3 | 5 })}
                      className="px-2 py-1.5 rounded bg-card border border-border text-foreground text-xs font-mono h-8"
                    >
                      <option value={1}>Bo1</option><option value={3}>Bo3</option><option value={5}>Bo5</option>
                    </select>
                    {hasGroups ? (
                      <label className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                        Grupy
                        <Input
                          type="number" min={1} value={draft.groupCount}
                          onChange={e => updatePhaseDraft(idx, { groupCount: Math.max(1, parseInt(e.target.value) || 1) })}
                          className="h-8 text-xs"
                        />
                      </label>
                    ) : <div />}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {hasAdvance && (
                      <label className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                        Awans
                        <Input
                          type="number" min={0} value={draft.advanceCount}
                          onChange={e => updatePhaseDraft(idx, { advanceCount: Math.max(0, parseInt(e.target.value) || 0) })}
                          className="h-8 text-xs"
                        />
                      </label>
                    )}
                    <label className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                      Seed
                      <Input
                        type="number" min={0} value={draft.seededCount}
                        onChange={e => updatePhaseDraft(idx, { seededCount: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="h-8 text-xs"
                        title="Ile drużyn wchodzi z poprzedniej fazy (0 = wszystkie)"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                      Rozmiar
                      <Input
                        type="number" min={0} value={draft.teamCount}
                        onChange={e => updatePhaseDraft(idx, { teamCount: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="h-8 text-xs"
                        title="Całkowita liczba miejsc w fazie (0 = auto)"
                      />
                    </label>
                  </div>

                  {hasGroups && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">Losowanie grup:</span>
                      <select
                        value={draft.groupAssignment ?? "random"}
                        onChange={e => updatePhaseDraft(idx, { groupAssignment: e.target.value as "random" | "manual" })}
                        className="px-2 py-1 rounded bg-card border border-border text-foreground text-xs font-mono h-7"
                      >
                        <option value="random">Losowo (snake-seed)</option>
                        <option value="manual">Ręcznie (po utworzeniu)</option>
                      </select>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <p className="text-xs font-mono text-muted-foreground italic border-t border-border pt-2">
            ℹ️ Mistrzostwa świata <strong>nie wpływają na klubowy ranking</strong>. Reprezentacje są oddzielnie oznaczone i nie pojawią się na liście Pro Teams.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anuluj</Button>
          <Button onClick={handleCreate} disabled={!canCreate} className="gap-1.5">
            <Plus className="w-4 h-4" /> Utwórz mistrzostwa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
