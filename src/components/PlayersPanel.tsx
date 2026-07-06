import { useState, useMemo } from "react";
import { User, Search, UserMinus, X as XIcon, UserPlus, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { TeamData } from "@/lib/types";
import { loadFromStorage } from "@/lib/storage";
import { teamDatabase } from "@/data/tournaments";
import { countryFlag, normalizeCountry } from "@/lib/flags";
import { playerNationalities } from "@/data/playerNationalities";
import { playerRealNames } from "@/data/playerRealNames";
import { playerRoles, roleColors, roleIcons, type PlayerRole } from "@/data/playerRoles";
import { computeCareerStats } from "@/lib/playerCareerStats";
import { computePlayerRatingForPeriod, type RatingPeriod } from "@/lib/playerCareerStats";
import { getRatingColor } from "@/lib/playerStats";
import {
  getFreeAgents, setFreeAgentNationality, addManualFreeAgent,
  removeManualFreeAgent, updateManualFreeAgent, loadManualFreeAgents,
} from "@/lib/freeAgents";
import { captureSnapshot, recordChange, setPlayerRole } from "@/lib/changeLog";
import { toast } from "@/hooks/use-toast";

const ROLE_OPTIONS: PlayerRole[] = ["Entry", "Lurker", "AWPer", "Anchor", "IGL", "Coach"];

type RegionFilter = "all" | "EU" | "US" | "LATAM" | "ASIA" | "OCE" | "AFR";
type TeamStatusFilter = "all" | "team" | "fa";
type SortMode = "rating" | "matches" | "team" | "name";

interface PlayersPanelProps {
  onSelectPlayer: (name: string) => void;
  onSelectTeam?: (name: string) => void;
}

interface PlayerRow {
  name: string;
  /** Undefined for free agents */
  team?: TeamData;
  /** "FA" for free agents, otherwise team region */
  region: string;
  /** Last team if FA */
  previousTeam?: string;
  isFA: boolean;
  isManualFA?: boolean;
  country: string;
  realName?: { firstName: string; lastName: string };
  role?: string;
  rating: number;
  matches: number;
  kdr: number;
  adr: number;
}

interface FAFormState {
  player: string;
  firstName: string;
  lastName: string;
  country: string;
  role: PlayerRole | "";
}

const emptyFAForm = (): FAFormState => ({
  player: "", firstName: "", lastName: "", country: "", role: "",
});

const PlayersPanel = ({ onSelectPlayer, onSelectTeam }: PlayersPanelProps) => {
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState<RegionFilter>("all");
  const [teamStatus, setTeamStatus] = useState<TeamStatusFilter>("all");
  const [nationality, setNationality] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortMode>("rating");
  const [ratingPeriod, setRatingPeriod] = useState<RatingPeriod>("all");
  const [onlyWithStats, setOnlyWithStats] = useState(false);
  // Bump to force re-read after a nationality edit on a FA card
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingFA, setEditingFA] = useState<string | null>(null);
  const [faCountryDraft, setFaCountryDraft] = useState("");

  // Full FA add/edit dialog
  const [faDialogOpen, setFaDialogOpen] = useState(false);
  /** When set we're editing an existing manual FA. */
  const [editingFANick, setEditingFANick] = useState<string | null>(null);
  const [faForm, setFaForm] = useState<FAFormState>(emptyFAForm());

  const teams = useMemo(() => {
    const stored = loadFromStorage<TeamData[] | null>("ranking_data", null);
    return stored && stored.length > 0 ? stored : teamDatabase.map(t => ({ ...t }));
  }, []);

  const rows = useMemo<PlayerRow[]>(() => {
    const out: PlayerRow[] = [];
    const seen = new Set<string>();
    for (const t of teams) {
      for (const p of t.roster) {
        if (seen.has(p)) continue;
        seen.add(p);
        const career = computeCareerStats(p);
        out.push({
          name: p,
          team: t,
          region: t.region,
          isFA: false,
          country: normalizeCountry(playerNationalities[p] || t.country),
          realName: playerRealNames[p],
          role: playerRoles[p],
          rating: career.careerRating,
          matches: career.matchesPlayed,
          kdr: career.kdRatio,
          adr: career.avgAdr,
        });
      }
    }
    // Free agents (manual + transfer-derived)
    for (const fa of getFreeAgents()) {
      if (seen.has(fa.player)) continue;
      seen.add(fa.player);
      const career = computeCareerStats(fa.player);
      out.push({
        name: fa.player,
        team: undefined,
        region: "FA",
        previousTeam: fa.previousTeam,
        isFA: true,
        isManualFA: fa.manual,
        country: normalizeCountry(fa.country),
        realName: fa.realName,
        role: fa.role || playerRoles[fa.player],
        rating: career.careerRating,
        matches: career.matchesPlayed,
        kdr: career.kdRatio,
        adr: career.avgAdr,
      });
    }
    return out;
  // refreshKey forces recompute after a nationality edit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams, refreshKey]);

  const allNationalities = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.country) set.add(r.country); });
    return Array.from(set).sort();
  }, [rows]);

  const allRoles = useMemo(() => {
    const set = new Set<string>();
    rows.forEach(r => { if (r.role) set.add(r.role); });
    return Array.from(set).sort();
  }, [rows]);

  const counts = useMemo(() => ({
    total: rows.length,
    fa: rows.filter(r => r.isFA).length,
  }), [rows]);

  // When a non-default period is picked, recompute rating/matches per player.
  const periodRows = useMemo<PlayerRow[]>(() => {
    if (ratingPeriod === "all") return rows;
    return rows.map(r => {
      const { rating, matches } = computePlayerRatingForPeriod(r.name, ratingPeriod);
      return { ...r, rating, matches };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ratingPeriod, refreshKey]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = periodRows.filter(r => {
      if (q) {
        const real = r.realName ? `${r.realName.firstName} ${r.realName.lastName}`.toLowerCase() : "";
        const teamName = r.team?.name.toLowerCase() || "";
        if (!r.name.toLowerCase().includes(q) && !real.includes(q) && !teamName.includes(q)) return false;
      }
      if (teamStatus === "fa" && !r.isFA) return false;
      if (teamStatus === "team" && r.isFA) return false;
      if (region !== "all" && r.region !== region) return false;
      if (nationality !== "all" && r.country !== nationality) return false;
      if (roleFilter !== "all" && r.role !== roleFilter) return false;
      if (onlyWithStats && r.matches === 0) return false;
      return true;
    });
    list.sort((a, b) => {
      switch (sort) {
        case "rating": {
          if (a.matches === 0 && b.matches > 0) return 1;
          if (b.matches === 0 && a.matches > 0) return -1;
          return b.rating - a.rating;
        }
        case "matches": return b.matches - a.matches;
        case "team": {
          const at = a.team?.name || "ZZZ-FA";
          const bt = b.team?.name || "ZZZ-FA";
          return at.localeCompare(bt);
        }
        case "name": return a.name.localeCompare(b.name);
      }
    });
    return list;
  }, [periodRows, search, region, teamStatus, nationality, roleFilter, sort, onlyWithStats]);

  const saveFANationality = (player: string, codeOverride?: string) => {
    const raw = (codeOverride ?? faCountryDraft).trim().toUpperCase().slice(0, 2);
    if (raw.length === 2) {
      const before = captureSnapshot();
      const old = playerNationalities[player] || "—";
      setFreeAgentNationality(player, raw);
      recordChange("nationality", `Narodowość: ${player} ${old} → ${raw}`, before);
      setEditingFA(null);
      setFaCountryDraft("");
      setRefreshKey(k => k + 1);
    }
  };

  // ===== Manual FA dialog handlers =====
  const openCreateFA = () => {
    setEditingFANick(null);
    setFaForm(emptyFAForm());
    setFaDialogOpen(true);
  };
  const openEditFA = (nick: string) => {
    const manual = loadManualFreeAgents().find(f => f.player === nick);
    const country = manual?.country || playerNationalities[nick] || "";
    const role = (manual?.role || playerRoles[nick] || "") as PlayerRole | "";
    const real = playerRealNames[nick];
    setEditingFANick(nick);
    setFaForm({
      player: nick,
      firstName: manual?.firstName ?? real?.firstName ?? "",
      lastName: manual?.lastName ?? real?.lastName ?? "",
      country,
      role,
    });
    setFaDialogOpen(true);
  };
  const submitFAForm = () => {
    const nick = faForm.player.trim();
    if (!nick) {
      toast({ title: "Brak nicku", description: "Podaj nick wolnego agenta.", variant: "destructive" });
      return;
    }
    const before = captureSnapshot();
    if (editingFANick) {
      updateManualFreeAgent(editingFANick, {
        firstName: faForm.firstName.trim(),
        lastName: faForm.lastName.trim(),
        country: faForm.country.trim().toUpperCase().slice(0, 2),
        role: faForm.role || undefined,
      });
      recordChange("fa-edit", `Edytowano FA: ${editingFANick}`, before);
      toast({ title: "Zapisano", description: `Zaktualizowano profil ${editingFANick}.` });
    } else {
      const ok = addManualFreeAgent({
        player: nick,
        firstName: faForm.firstName.trim() || undefined,
        lastName: faForm.lastName.trim() || undefined,
        country: faForm.country.trim() || undefined,
        role: faForm.role || undefined,
      });
      if (!ok) {
        toast({
          title: "Nick zajęty",
          description: `Gracz ${nick} już istnieje (na rosterze lub jako FA).`,
          variant: "destructive",
        });
        return;
      }
      recordChange("fa-add", `Dodano FA: ${nick}`, before);
      toast({ title: "Dodano FA", description: `${nick} dołączył do wolnych agentów.` });
    }
    setFaDialogOpen(false);
    setRefreshKey(k => k + 1);
  };
  const deleteManualFA = (nick: string) => {
    if (!confirm(`Usunąć wolnego agenta ${nick}?`)) return;
    const before = captureSnapshot();
    removeManualFreeAgent(nick);
    recordChange("fa-remove", `Usunięto FA: ${nick}`, before);
    setRefreshKey(k => k + 1);
    toast({ title: "Usunięto", description: `${nick} został usunięty.` });
  };

  // Role editor (works for any player — rostered or FA)
  const [roleEditFor, setRoleEditFor] = useState<string | null>(null);
  const handleSetRole = (player: string, role: PlayerRole | "") => {
    setPlayerRole(player, role);
    setRoleEditFor(null);
    setRefreshKey(k => k + 1);
    toast({ title: "Rola zaktualizowana", description: `${player}: ${role || "—"}` });
  };

  const openCreateCoach = () => {
    setEditingFANick(null);
    setFaForm({ ...emptyFAForm(), role: "Coach" });
    setFaDialogOpen(true);
  };

  const coachCount = useMemo(
    () => rows.filter(r => r.role === "Coach").length,
    [rows],
  );

  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <User className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-heading font-bold text-foreground">Gracze</h2>
            <span className="text-xs font-mono text-muted-foreground">
              ({filtered.length}/{counts.total})
            </span>
            {counts.fa > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
                <UserMinus className="w-3 h-3" /> {counts.fa} FA
              </span>
            )}
            {coachCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase text-sky-300 bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 rounded">
                🎓 {coachCount} trenerów
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={openCreateCoach} className="gap-1.5">
              🎓 Dodaj trenera
            </Button>
            <Button size="sm" onClick={openCreateFA} className="gap-1.5">
              <UserPlus className="w-4 h-4" /> Dodaj FA
            </Button>
          </div>
        </div>

        {/* Filters card */}
        <div className="bg-card border border-border rounded-lg p-3 mb-4 space-y-3">
          {/* Row 1: search + sort + only-with-stats */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj nicku, imienia lub drużyny..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 bg-secondary/40 border-border h-9"
              />
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortMode)}
              className="h-9 px-2 text-xs font-mono rounded border border-border bg-secondary/40 text-foreground"
            >
              <option value="rating">↕ Rating</option>
              <option value="matches">↕ Mecze</option>
              <option value="team">↕ Drużyna</option>
              <option value="name">↕ Nick A-Z</option>
            </select>
            <select
              value={nationality}
              onChange={e => setNationality(e.target.value)}
              className="h-9 px-2 text-xs font-mono rounded border border-border bg-secondary/40 text-foreground max-w-[180px]"
            >
              <option value="all">🌍 Wszystkie narodowości</option>
              {allNationalities.map(n => (
                <option key={n} value={n}>{countryFlag(n)} {n}</option>
              ))}
            </select>
            {allRoles.length > 0 && (
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="h-9 px-2 text-xs font-mono rounded border border-border bg-secondary/40 text-foreground"
              >
                <option value="all">Wszystkie role</option>
                {allRoles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            )}
            <label className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground cursor-pointer select-none px-2">
              <input
                type="checkbox"
                checked={onlyWithStats}
                onChange={e => setOnlyWithStats(e.target.checked)}
                className="accent-primary"
              />
              Ze statystykami
            </label>
          </div>

          {/* Row 2: chip filter groups */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] font-mono uppercase text-muted-foreground/70 tracking-wider mr-1">Status</span>
              {([
                { v: "all", label: "Wszyscy" },
                { v: "team", label: `Z drużyną`, icon: <UserPlus className="w-3 h-3" /> },
                { v: "fa", label: `FA`, icon: <UserMinus className="w-3 h-3" /> },
              ] as { v: TeamStatusFilter; label: string; icon?: JSX.Element }[]).map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setTeamStatus(opt.v)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-mono rounded border transition-colors inline-flex items-center gap-1",
                    teamStatus === opt.v
                      ? opt.v === "fa"
                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                        : opt.v === "team"
                          ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                          : "bg-primary/20 text-primary border-primary/40"
                      : "text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] font-mono uppercase text-muted-foreground/70 tracking-wider mr-1">Region</span>
              {(["all", "EU", "US", "LATAM", "ASIA", "OCE", "AFR"] as RegionFilter[]).map(r => (
                <button
                  key={r}
                  onClick={() => setRegion(r)}
                  className={cn(
                    "px-2 py-1 text-[11px] font-mono rounded border transition-colors",
                    region === r
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  {r === "all" ? "Wszystkie" : r}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] font-mono uppercase text-muted-foreground/70 tracking-wider mr-1">Rating</span>
              {([
                { v: "all", label: "Kariera" },
                { v: "year", label: "Rok" },
                { v: "month", label: "Miesiąc" },
                { v: "lastTournament", label: "Ost. turniej" },
              ] as { v: RatingPeriod; label: string }[]).map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setRatingPeriod(opt.v)}
                  className={cn(
                    "px-2 py-1 text-[11px] font-mono rounded border transition-colors",
                    ratingPeriod === opt.v
                      ? "bg-primary/20 text-primary border-primary/40"
                      : "text-muted-foreground border-border hover:text-foreground",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-lg p-10 text-center">
            <User className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm font-mono text-muted-foreground">Brak graczy spełniających filtry.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {filtered.map((p, i) => {
              const isEditingThis = editingFA === p.name;
              return (
                <motion.div
                  key={`${p.team?.name || "FA"}-${p.name}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.005, 0.4) }}
                  onClick={() => { if (!isEditingThis) onSelectPlayer(p.name); }}
                  className={cn(
                    "group bg-card border rounded-lg p-3 text-left hover:border-primary/50 hover:bg-secondary/40 transition-all cursor-pointer",
                    p.isFA ? "border-amber-500/30" : "border-border",
                  )}
                >
                  <div className="flex items-start justify-between mb-2 gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {p.country
                        ? <span className="text-base shrink-0">{countryFlag(p.country)}</span>
                        : <span className="text-base shrink-0 text-muted-foreground/40">🏳️</span>}
                      <span className="font-heading font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {p.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {p.isFA && (
                        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-400 bg-amber-500/10">
                          FA
                        </span>
                      )}
                      {roleEditFor === p.name ? (
                        <select
                          autoFocus
                          value={p.role || ""}
                          onChange={(e) => handleSetRole(p.name, e.target.value as PlayerRole | "")}
                          onBlur={() => setRoleEditFor(null)}
                          className="text-[9px] font-mono px-1 py-0.5 rounded border border-primary/40 bg-card text-foreground"
                        >
                          <option value="">—</option>
                          {ROLE_OPTIONS.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      ) : p.role ? (
                        <button
                          onClick={() => setRoleEditFor(p.name)}
                          title="Kliknij aby zmienić rolę"
                          className={cn(
                            "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border hover:opacity-80",
                            roleColors[p.role] || "border-border text-muted-foreground",
                          )}
                        >
                          {roleIcons[p.role]}
                        </button>
                      ) : (
                        <button
                          onClick={() => setRoleEditFor(p.name)}
                          title="Dodaj rolę"
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/40"
                        >
                          + rola
                        </button>
                      )}
                    </div>
                  </div>
                  {p.realName && (
                    <p className="text-[10px] text-muted-foreground font-mono truncate mb-1">
                      {p.realName.firstName} {p.realName.lastName}
                    </p>
                  )}

                  {p.isFA ? (
                    <div className="mb-2">
                      <p className="text-[11px] font-mono text-amber-400/80 italic flex items-center gap-1">
                        <UserMinus className="w-3 h-3" /> Wolny agent
                      </p>
                      {p.previousTeam && p.previousTeam !== "-" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectTeam?.(p.previousTeam!); }}
                          className="text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors truncate block w-full text-left"
                          title={`Poprzednio: ${p.previousTeam}`}
                        >
                          ex-{p.previousTeam}
                        </button>
                      )}
                      {/* Inline nationality editor — always available for FAs */}
                      {!isEditingThis && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingFA(p.name);
                            setFaCountryDraft(p.country || "");
                          }}
                          className="mt-1 text-[10px] font-mono text-amber-400 hover:text-amber-300 underline decoration-dotted"
                        >
                          {p.country ? "✎ zmień narodowość" : "+ dodaj narodowość"}
                        </button>
                      )}
                      {isEditingThis && (
                        <div className="mt-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input
                            autoFocus
                            placeholder="PL"
                            maxLength={2}
                            value={faCountryDraft}
                            onChange={(e) => {
                              const next = e.target.value.toUpperCase().slice(0, 2);
                              setFaCountryDraft(next);
                              // Auto-save the moment we have a full 2-letter code
                              if (next.length === 2) saveFANationality(p.name, next);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveFANationality(p.name);
                              if (e.key === "Escape") { setEditingFA(null); setFaCountryDraft(""); }
                            }}
                            className="h-6 w-12 text-[10px] font-mono px-1.5 text-center uppercase"
                          />
                          <span className="text-base">{faCountryDraft.length === 2 ? countryFlag(faCountryDraft) : ""}</span>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => { setEditingFA(null); setFaCountryDraft(""); }}
                          >
                            <XIcon className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                      {/* Edit / delete (always available for FAs) */}
                      <div className="mt-1.5 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openEditFA(p.name)}
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-primary transition-colors"
                          title="Edytuj profil"
                        >
                          <Pencil className="w-2.5 h-2.5" /> edytuj
                        </button>
                        {p.isManualFA && (
                          <button
                            onClick={() => deleteManualFA(p.name)}
                            className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground hover:text-destructive transition-colors ml-2"
                            title="Usuń wolnego agenta"
                          >
                            <Trash2 className="w-2.5 h-2.5" /> usuń
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelectTeam?.(p.team!.name); }}
                      className="text-[11px] font-mono text-muted-foreground hover:text-primary transition-colors truncate block w-full text-left mb-2"
                      title={p.team!.name}
                    >
                      {countryFlag(p.team!.country)} {p.team!.name}
                    </button>
                  )}

                  <div className="flex items-center justify-between gap-1 pt-2 border-t border-border/40">
                    {p.matches > 0 ? (
                      <>
                        <div className="text-center">
                          <p className="text-[9px] font-mono uppercase text-muted-foreground/60">Rating</p>
                          <p className={cn("text-sm font-bold tabular-nums leading-tight", getRatingColor(p.rating))}>
                            {p.rating.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-mono uppercase text-muted-foreground/60">K/D</p>
                          <p className="text-sm font-bold tabular-nums text-foreground leading-tight">
                            {p.kdr.toFixed(2)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-[9px] font-mono uppercase text-muted-foreground/60">M</p>
                          <p className="text-sm font-bold tabular-nums text-foreground leading-tight">
                            {p.matches}
                          </p>
                        </div>
                      </>
                    ) : (
                      <p className="text-[10px] font-mono text-muted-foreground/50 italic mx-auto">
                        Brak meczów
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Add / edit free-agent dialog */}
        <Dialog open={faDialogOpen} onOpenChange={setFaDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="font-heading">
                {editingFANick ? `Edytuj wolnego agenta: ${editingFANick}` : "Dodaj wolnego agenta"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block mb-1">
                  Nick *
                </label>
                <Input
                  placeholder="np. s1mple"
                  value={faForm.player}
                  disabled={!!editingFANick}
                  onChange={e => setFaForm(f => ({ ...f, player: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block mb-1">
                    Imię
                  </label>
                  <Input
                    placeholder="Aleksandr"
                    value={faForm.firstName}
                    onChange={e => setFaForm(f => ({ ...f, firstName: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block mb-1">
                    Nazwisko
                  </label>
                  <Input
                    placeholder="Kostyliev"
                    value={faForm.lastName}
                    onChange={e => setFaForm(f => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block mb-1">
                    Narodowość (2-literowy kod ISO, np. PL, DE)
                  </label>
                  <Input
                    placeholder="PL"
                    maxLength={2}
                    value={faForm.country}
                    onChange={e => {
                      const next = e.target.value.toUpperCase().slice(0, 2);
                      setFaForm(f => ({ ...f, country: next }));
                      // Live-persist for existing FAs the moment we have a complete code
                      if (editingFANick && next.length === 2) {
                        const before = captureSnapshot();
                        const old = playerNationalities[editingFANick] || "—";
                        updateManualFreeAgent(editingFANick, { country: next });
                        recordChange("nationality", `Narodowość: ${editingFANick} ${old} → ${next}`, before);
                      }
                    }}
                    className="uppercase"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block mb-1">
                    Rola
                  </label>
                  <select
                    value={faForm.role}
                    onChange={e => {
                      const next = e.target.value as PlayerRole | "";
                      setFaForm(f => ({ ...f, role: next }));
                      // Live-persist role for existing FAs too
                      if (editingFANick) {
                        setPlayerRole(editingFANick, next);
                        setRefreshKey(k => k + 1);
                      }
                    }}
                    className="w-full h-10 px-3 rounded-md bg-card border border-border text-sm font-mono"
                  >
                    <option value="">— brak —</option>
                    {ROLE_OPTIONS.map(r => (
                      <option key={r} value={r}>{roleIcons[r]} {r}</option>
                    ))}
                  </select>
                </div>
              </div>
              {faForm.country.length === 2 && (
                <p className="text-[11px] font-mono text-muted-foreground">
                  Podgląd flagi: <span className="text-base">{countryFlag(faForm.country)}</span> {faForm.country}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setFaDialogOpen(false)}>Anuluj</Button>
              <Button onClick={submitFAForm}>
                {editingFANick ? "Zapisz zmiany" : "Dodaj wolnego agenta"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
};

export default PlayersPanel;
