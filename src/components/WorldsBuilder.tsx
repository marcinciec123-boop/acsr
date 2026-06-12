import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Globe, Users, Trophy, Trash2, Plus } from "lucide-react";
import { availableCountries, playersByCountry, buildNationalTeamName, upsertNationalTeams, regionForCountry } from "@/lib/nationalTeams";
import { buildPhase, formatLabel } from "@/lib/tournamentBuilder";
import type { TournamentData, PhaseFormat, TeamData } from "@/lib/types";
import { toast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (tournament: TournamentData) => void;
}

interface NationDraft {
  code: string;       // ISO
  label?: string;     // custom label, default "Team {CODE}"
  roster: string[];   // selected players (5)
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

export const WorldsBuilder = ({ open, onOpenChange, onCreated }: Props) => {
  // Step 1: countries
  const [nations, setNations] = useState<NationDraft[]>([]);
  const [countrySearch, setCountrySearch] = useState("");

  // Step 2: tournament meta
  const [name, setName] = useState("Mistrzostwa Świata CS:GO");
  const [organizer, setOrganizer] = useState("FIVB / Custom");
  const [prize, setPrize] = useState("$1,000,000");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [location, setLocation] = useState("");
  const [tier, setTier] = useState<"S" | "A" | "B" | "C">("S");

  // Step 3: format
  const [phaseName, setPhaseName] = useState("Playoffs");
  const [format, setFormat] = useState<PhaseFormat>("single-elim");
  const [bo, setBo] = useState<1 | 3 | 5>(3);
  const [groupCount, setGroupCount] = useState(4);
  const [advanceCount, setAdvanceCount] = useState(8);

  const countries = useMemo(() => availableCountries(), []);
  const playerPool = useMemo(() => playersByCountry(), []);

  const filteredCountries = useMemo(() => {
    const q = countrySearch.toUpperCase();
    return countries.filter(c => c.code.includes(q));
  }, [countries, countrySearch]);

  const nationCodes = new Set(nations.map(n => n.code));

  const addCountry = (code: string) => {
    if (nationCodes.has(code)) return;
    setNations(prev => [...prev, { code, roster: [...EMPTY_ROSTER] }]);
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

  const autoFill = (code: string) => {
    const pool = playerPool[code] || [];
    setNations(prev => prev.map(n =>
      n.code === code ? { ...n, roster: [...pool.slice(0, 5), "", "", "", "", ""].slice(0, 5) } : n
    ));
  };

  const reset = () => {
    setNations([]); setCountrySearch("");
    setName("Mistrzostwa Świata CS:GO"); setOrganizer("FIVB / Custom");
    setPrize("$1,000,000"); setStart(""); setEnd(""); setLocation(""); setTier("S");
    setPhaseName("Playoffs"); setFormat("single-elim"); setBo(3);
    setGroupCount(4); setAdvanceCount(8);
  };

  const canCreate = nations.length >= 2 && name.trim().length > 0;

  const handleCreate = () => {
    if (!canCreate) {
      toast({ title: "Brak danych", description: "Dodaj min. 2 reprezentacje i nazwij turniej.", variant: "destructive" });
      return;
    }
    // Build national teams
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
    const phase = buildPhase(phaseName.trim() || "Playoffs", format, teamNames, {
      bo, groupCount, advanceCount, groupAssignment: "random",
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
      format: formatLabel(format),
      status: "upcoming",
      participants: teamNames,
      phases: [phase],
      placements: [],
      kind: "worlds",
    };
    onCreated(t);
    reset();
    onOpenChange(false);
    toast({ title: "Mistrzostwa utworzone", description: `${teamNames.length} reprezentacji w drabince.` });
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
                      "text-[11px] px-2 py-1.5 rounded font-mono transition-colors flex items-center gap-1 min-w-0",
                      picked
                        ? "bg-primary/20 text-primary border border-primary/40"
                        : "bg-secondary/30 text-muted-foreground hover:bg-secondary/60 border border-transparent"
                    )}
                    title={`${c.code} • ${c.playerCount} graczy`}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="truncate flex-1">{c.code}</span>
                    <span className="text-[9px] opacity-70">{c.playerCount}</span>
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
                            placeholder={`Team ${n.code}`}
                            onChange={e => updateNation(n.code, { label: e.target.value })}
                            className="h-7 text-xs font-mono flex-1"
                          />
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">{pool.length} dost.</span>
                        </div>
                        <button
                          onClick={() => autoFill(n.code)}
                          className="text-[10px] font-mono text-primary hover:underline shrink-0"
                          title="Wstaw pierwszych 5 dostępnych"
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
                        {n.roster.map((p, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0">{i + 1}</span>
                            <select
                              value={p}
                              onChange={e => setRosterSlot(n.code, i, e.target.value)}
                              className="flex-1 text-[11px] font-mono bg-card border border-border rounded px-1.5 py-1 h-7"
                            >
                              <option value="">— wybierz gracza —</option>
                              {pool.map(pl => (
                                <option key={pl} value={pl}>{pl}</option>
                              ))}
                              {/* Allow keeping current value even if not in pool */}
                              {p && !pool.includes(p) && <option value={p}>{p}</option>}
                            </select>
                            <Input
                              value={p}
                              onChange={e => setRosterSlot(n.code, i, e.target.value)}
                              placeholder="lub wpisz..."
                              className="h-7 text-[11px] font-mono w-24 shrink-0"
                            />
                          </div>
                        ))}
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

          {/* STEP 4: format */}
          <section className="space-y-2">
            <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">4. Format</h3>
            <Input value={phaseName} onChange={e => setPhaseName(e.target.value)} placeholder="Nazwa fazy..." />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <select
                value={format}
                onChange={e => setFormat(e.target.value as PhaseFormat)}
                className="col-span-2 px-2 py-2 rounded-md bg-card border border-border text-foreground text-xs font-mono"
              >
                {PHASE_FORMATS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
              <select
                value={bo}
                onChange={e => setBo(parseInt(e.target.value) as 1 | 3 | 5)}
                className="px-2 py-2 rounded-md bg-card border border-border text-foreground text-xs font-mono"
              >
                <option value={1}>Bo1</option><option value={3}>Bo3</option><option value={5}>Bo5</option>
              </select>
              <div className="flex items-center gap-1">
                {(format === "round-robin" || format === "gsl-groups" || format === "gsl-de-groups") && (
                  <>
                    <span className="text-[10px] font-mono text-muted-foreground">Grupy</span>
                    <Input type="number" min={1} value={groupCount}
                      onChange={e => setGroupCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-8 text-xs" />
                  </>
                )}
              </div>
            </div>
            {(format === "round-robin" || format === "swiss" || format === "gsl-groups" || format === "gsl-de-groups") && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground">Awans</span>
                <Input type="number" min={0} value={advanceCount}
                  onChange={e => setAdvanceCount(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-8 text-xs w-24" />
                <span className="text-[10px] font-mono text-muted-foreground">drużyn (do następnej fazy — możesz dodać kolejne fazy później)</span>
              </div>
            )}
          </section>

          <p className="text-[10px] font-mono text-muted-foreground italic border-t border-border pt-2">
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
