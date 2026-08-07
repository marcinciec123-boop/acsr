import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, Search, Filter, ArrowUpDown, Plus, UserMinus, History, Undo2, Trash2, X as XIcon, GraduationCap, Users as UsersIcon } from "lucide-react";
import {
  getFreeAgents,
  removeManualFreeAgent,
  loadFreeAgentNationalityOverrides,
  loadFreeAgentRealNameOverrides,
  loadFreeAgentRoleOverrides,
  loadManualFreeAgents,
} from "@/lib/freeAgents";
import { roleIcons } from "@/data/playerRoles";
import TeamLogo from "@/components/TeamLogo";
import PanelHeader from "@/components/PanelHeader";
import { teamDatabase } from "@/data/tournaments";
import { playerNationalities } from "@/data/playerNationalities";
import { playerRealNames } from "@/data/playerRealNames";
import { playerRoles } from "@/data/playerRoles";
import { resolvePlayerCountry } from "@/lib/playerCountry";
import { countryFlag } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Transfer, TeamData } from "@/lib/types";
import { saveToStorage, loadFromStorage } from "@/lib/storage";
import { transfers as seedTransfers, customTransfersGlobal, type Transfer as RawTransfer } from "@/data/history";
import { getWorldNowIso } from "@/lib/worldClock";
import {
  captureSnapshot, recordChange, loadChangeLog, revertTo, clearChangeLog,
  persistCurrentRosters, type ChangeLogEntry,
  persistPlayerMetadata,
} from "@/lib/changeLog";
import { removeFromAllBenches } from "@/lib/benchedPlayers";
import {
  formatMoney, getActiveContract, signContract, suggestSalary, suggestTransferFee,
} from "@/lib/contracts";
import { toast } from "@/hooks/use-toast";

type TransferType = "all" | "join" | "leave" | "move";
type Section = "transfers" | "freeAgents" | "changes";

const TRANSFERS_KEY = "transfers_data";
const RANKING_KEY = "ranking_data";
const SEED_DATES_VERSION_KEY = "transfers_seed_dates_v2";
const LATE_DATES_VERSION_KEY = "transfers_late_dates_v3";

// Transfery wpisane z fikcyjną datą 2026-07-09 i późniejszą trafiają
// deterministycznie-losowo w okno 2026-01-27 → 2026-02-02.
const LATE_CUTOFF = "2026-07-09";
const LATE_WINDOW_START = new Date(2026, 0, 27);
const LATE_WINDOW_DAYS = 7; // 27.01 - 02.02
const hashString = (value: string): number => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};
const lateWindowDate = (seed: string): string => {
  const h = hashString(seed);
  const d = new Date(LATE_WINDOW_START);
  d.setDate(d.getDate() + (h % LATE_WINDOW_DAYS));
  d.setHours(9 + (h >> 3) % 11, (h >> 7) % 60, (h >> 11) % 60, 0);
  return d.toISOString();
};

// Spread all seed transfers chronologically across 2025-06-01 → 2026-01-31.
// Late entries (roughly the last ~15%) naturally fall into the January 2026
// pre-season window, matching the fictional world clock start of 2026-01-01.
const SEED_START = new Date(2025, 5, 1); // 2025-06-01
const SEED_END = new Date(2026, 0, 31);  // 2026-01-31
const SEED_SPAN_DAYS = Math.round((SEED_END.getTime() - SEED_START.getTime()) / 86_400_000);
const seedDateForIndex = (i: number, total: number): string => {
  const denom = Math.max(1, total - 1);
  const offset = Math.round((i * SEED_SPAN_DAYS) / denom);
  const d = new Date(SEED_START);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
};

const loadLiveTeams = (): TeamData[] => {
  const rankingData = loadFromStorage<TeamData[] | null>(RANKING_KEY, null);
  return rankingData && rankingData.length > 0 ? rankingData : teamDatabase;
};


const persistPersonMetadataAfterSigning = (player: string) => {
  const manual = loadManualFreeAgents().find(f => f.player === player);
  const faNat = loadFreeAgentNationalityOverrides();
  const faNames = loadFreeAgentRealNameOverrides();
  const faRoles = loadFreeAgentRoleOverrides();

  const role = faRoles[player] || manual?.role || playerRoles[player];
  const realName = faNames[player] || (
    manual && (manual.firstName || manual.lastName)
      ? { firstName: manual.firstName || "", lastName: manual.lastName || "" }
      : playerRealNames[player]
  );
  persistPlayerMetadata(player, {
    country: faNat[player] || manual?.country || playerNationalities[player] || "",
    role: role || "",
    firstName: realName?.firstName || "",
    lastName: realName?.lastName || "",
  });
};

const TransferPanel = () => {
  const [transfers, setTransfers] = useState<Transfer[]>(() => {
    const total = seedTransfers.length;
    const saved = loadFromStorage<Transfer[]>(TRANSFERS_KEY, []);
    const seedDatesMigrated = loadFromStorage<boolean>(SEED_DATES_VERSION_KEY, false);
    if (saved.length > 0) {
      // One-shot migration: re-space `seed-*` entries across 2025-06 → 2026-01
      // so the pre-season batch lands in January 2026 and dates stay ordered.
      if (!seedDatesMigrated) {
        const migrated = saved.map(t => {
          if (typeof t.id === "string" && t.id.startsWith("seed-")) {
            const idx = Number(t.id.slice(5));
            if (Number.isFinite(idx)) {
              return { ...t, date: seedDateForIndex(idx, total) };
            }
          }
          return t;
        });
        saveToStorage(TRANSFERS_KEY, migrated);
        saveToStorage(SEED_DATES_VERSION_KEY, true);
        return migrated;
      }
      const lateMigrated = loadFromStorage<boolean>(LATE_DATES_VERSION_KEY, false);
      if (!lateMigrated) {
        const remapped = saved.map(t => (
          (t.date || "").slice(0, 10) >= LATE_CUTOFF
            ? { ...t, date: lateWindowDate(`${t.id}|${t.player}|${t.oldTeam}|${t.newTeam}`) }
            : t
        ));
        saveToStorage(TRANSFERS_KEY, remapped);
        saveToStorage(LATE_DATES_VERSION_KEY, true);
        return remapped;
      }
      return saved;
    }
    // Seed from history.ts
    const seeded: Transfer[] = seedTransfers.map((t, i) => ({
      id: `seed-${i}`,
      player: t.player,
      oldTeam: t.oldTeam,
      newTeam: t.newTeam,
      date: seedDateForIndex(i, total),
    }));
    saveToStorage(TRANSFERS_KEY, seeded);
    saveToStorage(SEED_DATES_VERSION_KEY, true);
    saveToStorage(LATE_DATES_VERSION_KEY, true);
    return seeded;
  });

  const [section, setSection] = useState<Section>("transfers");
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [reversed, setReversed] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TransferType>("all");
  const [dataVersion, setDataVersion] = useState(0);

  const [showDialog, setShowDialog] = useState(false);
  const [transferPlayer, setTransferPlayer] = useState("");
  const [transferFrom, setTransferFrom] = useState("-");
  const [transferTo, setTransferTo] = useState("-");
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerKind, setPickerKind] = useState<"all" | "player" | "coach" | "fa">("all");

  useEffect(() => { saveToStorage(TRANSFERS_KEY, transfers); }, [transfers]);

  useEffect(() => {
    const refresh = () => setDataVersion(v => v + 1);
    window.addEventListener("teams:update", refresh);
    window.addEventListener("ranking:update", refresh);
    window.addEventListener("transfers:update", refresh);
    return () => {
      window.removeEventListener("teams:update", refresh);
      window.removeEventListener("ranking:update", refresh);
      window.removeEventListener("transfers:update", refresh);
    };
  }, []);

  const liveTeams = useMemo(() => loadLiveTeams(), [dataVersion, transfers]);

  const allTeams = useMemo(() => {
    const nationalNames = new Set(liveTeams.filter(t => t.isNational).map(t => t.name));
    const teams = new Set<string>();
    transfers.forEach(t => {
      if (t.oldTeam !== "-" && !nationalNames.has(t.oldTeam)) teams.add(t.oldTeam);
      if (t.newTeam !== "-" && !nationalNames.has(t.newTeam)) teams.add(t.newTeam);
    });
    liveTeams.forEach(t => { if (!t.isNational) teams.add(t.name); });
    return Array.from(teams).sort();
  }, [liveTeams, transfers]);

  const allPlayers = useMemo(() => {
    const players = new Set<string>();
    liveTeams.forEach(t => {
      t.roster.forEach(p => players.add(p));
      if (t.coach) players.add(t.coach);
    });
    transfers.forEach(t => players.add(t.player));
    return Array.from(players).sort();
  }, [liveTeams, transfers]);

  /** Unified catalog of every person that can be transferred. */
  interface PickerEntry {
    name: string;
    kind: "player" | "coach" | "fa";
    team?: string;
    teamCountry?: string;
    role?: string;
    country?: string;
  }
  const pickerCatalog = useMemo<PickerEntry[]>(() => {
    const out: PickerEntry[] = [];
    const seen = new Set<string>();
    for (const t of liveTeams) {
      if (t.coach && !seen.has(t.coach)) {
        seen.add(t.coach);
        out.push({
          name: t.coach, kind: "coach", team: t.name, teamCountry: t.country,
          role: "Coach", country: playerNationalities[t.coach],
        });
      }
      for (const p of t.roster) {
        if (seen.has(p)) continue;
        seen.add(p);
        out.push({
          name: p, kind: "player", team: t.name, teamCountry: t.country,
          role: playerRoles[p], country: playerNationalities[p],
        });
      }
    }
    for (const fa of getFreeAgents()) {
      if (seen.has(fa.player)) continue;
      seen.add(fa.player);
      out.push({
        name: fa.player,
        kind: fa.role === "Coach" ? "coach" : "fa",
        role: fa.role,
        country: fa.country || playerNationalities[fa.player],
      });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, [liveTeams, transfers]);

  const filteredPicker = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return pickerCatalog.filter(e => {
      if (pickerKind !== "all") {
        if (pickerKind === "coach" && e.kind !== "coach") return false;
        if (pickerKind === "player" && e.kind !== "player") return false;
        if (pickerKind === "fa" && e.kind !== "fa") return false;
      }
      if (q) {
        const hay = `${e.name} ${e.team || ""} ${e.role || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).slice(0, 200);
  }, [pickerCatalog, pickerSearch, pickerKind]);

  const selectedEntry = pickerCatalog.find(e => e.name === transferPlayer);
  const isCoachPick = selectedEntry?.role === "Coach";
  const targetTeamHasCoach = useMemo(() => {
    if (!isCoachPick || transferTo === "-") return null;
    const tt = liveTeams.find(t => t.name === transferTo);
    return tt?.coach && tt.coach !== transferPlayer ? tt.coach : null;
  }, [isCoachPick, liveTeams, transferTo, transferPlayer]);



  const freeAgents = useMemo(() => (
    getFreeAgents().map(fa => ({
      player: fa.player,
      previousTeam: fa.previousTeam,
      nationality: fa.country || playerNationalities[fa.player] || "",
    }))
  ), [dataVersion, transfers]);

  const filtered = useMemo(() => {
    let result = transfers.filter(t => {
      if (search && !t.player.toLowerCase().includes(search.toLowerCase())) return false;
      if (teamFilter && t.oldTeam !== teamFilter && t.newTeam !== teamFilter) return false;
      if (typeFilter === "join" && t.oldTeam !== "-") return false;
      if (typeFilter === "leave" && t.newTeam !== "-") return false;
      if (typeFilter === "move" && (t.oldTeam === "-" || t.newTeam === "-")) return false;
      return true;
    });
    // Chronological: newest first by default, oldest first when "reversed".
    result = [...result].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    if (reversed) result.reverse();
    return result;
  }, [search, teamFilter, reversed, typeFilter, transfers]);


  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>(() => loadChangeLog());

  const refreshChangeLog = () => setChangeLog(loadChangeLog());

  // ===== Warunki kontraktu przy nowym transferze =====
  const prevContract = useMemo(
    () => (transferPlayer ? getActiveContract(transferPlayer) : null),
    [transferPlayer, showDialog],
  );
  const [contractMonths, setContractMonths] = useState(24);
  const [salaryInput, setSalaryInput] = useState("");
  const [feeInput, setFeeInput] = useState("");

  const suggestedSalary = useMemo(
    () => (transferPlayer && transferTo !== "-" ? suggestSalary(transferPlayer, transferTo) : 0),
    [transferPlayer, transferTo],
  );
  const suggestedFee = useMemo(
    () => (transferPlayer && transferFrom !== "-" && transferTo !== "-"
      ? suggestTransferFee(transferPlayer, transferFrom, transferTo)
      : 0),
    [transferPlayer, transferFrom, transferTo],
  );

  // Prefill warunków po zmianie gracza/celu.
  useEffect(() => {
    setSalaryInput(suggestedSalary ? String(suggestedSalary) : "");
    setFeeInput(suggestedFee ? String(suggestedFee) : "");
  }, [suggestedSalary, suggestedFee]);

  const salaryValue = Number(salaryInput) || 0;
  const feeValue = Number(feeInput) || 0;
  const salaryDelta = prevContract?.salary ? salaryValue - prevContract.salary : 0;

  const handleAddTransfer = () => {
    if (!transferPlayer.trim()) return;
    const t: Transfer = {
      id: Date.now().toString(36),
      player: transferPlayer.trim(),
      oldTeam: transferFrom,
      newTeam: transferTo,
      date: getWorldNowIso(),
      ...(transferTo !== "-" ? { contractMonths, salary: salaryValue } : {}),
      ...(transferFrom !== "-" && transferTo !== "-" ? { fee: feeValue } : {}),
    };

    // Snapshot BEFORE applying any mutation, for the change log.
    const before = captureSnapshot();

    const isCoach = selectedEntry?.kind === "coach" || (playerRoles as Record<string, string>)[t.player] === "Coach";

    // Update teamDatabase rosters (runtime)
    if (transferFrom !== "-") {
      const fromTeam = teamDatabase.find(td => td.name === transferFrom);
      if (fromTeam) {
        fromTeam.roster = fromTeam.roster.filter(p => p !== t.player);
        if (fromTeam.coach === t.player) fromTeam.coach = undefined;
      }
      removeFromAllBenches(t.player);
    }
    if (transferTo !== "-") {
      const toTeam = teamDatabase.find(td => td.name === transferTo);
      if (toTeam) {
        if (isCoach) toTeam.coach = t.player;
        else if (!toTeam.roster.includes(t.player)) toTeam.roster.push(t.player);
      }
      // If the player was a manual free agent, remove that entry so they no
      // longer appear as FA after joining a team, but keep/copy their database
      // metadata (nationality, real name, role) as normal player overrides.
      persistPersonMetadataAfterSigning(t.player);
      removeManualFreeAgent(t.player, { clearOverrides: false });
    }


    // Mirror the transfer into the global FA log so PlayersPanel/profile stay in sync.
    const raw: RawTransfer = { player: t.player, oldTeam: t.oldTeam, newTeam: t.newTeam };
    customTransfersGlobal.push(raw);
    saveToStorage("custom_transfers", customTransfersGlobal);

    // Auto-publish a news post about the transfer.
    import("@/lib/autoNews").then(m => m.announceTransfer(t.player, t.oldTeam, t.newTeam));

    // Persist roster changes everywhere they need to live.
    persistCurrentRosters();
    const rankingData = loadFromStorage<TeamData[] | null>(RANKING_KEY, null);
    if (rankingData) {
      const updated = rankingData.map(team => {
        if (team.name === transferFrom) {
          return {
            ...team,
            roster: team.roster.filter(p => p !== t.player),
            coach: team.coach === t.player ? undefined : team.coach,
          };
        }
        if (team.name === transferTo) {
          if (isCoach) return { ...team, coach: t.player };
          if (!team.roster.includes(t.player)) return { ...team, roster: [...team.roster, t.player] };
        }
        return team;
      });
      saveToStorage(RANKING_KEY, updated);
    }
    window.dispatchEvent(new CustomEvent("teams:update"));
    window.dispatchEvent(new CustomEvent("ranking:update"));

    // Nowy kontrakt na ustalonych warunkach (lub wygaszenie przy zwolnieniu do FA).
    signContract(t.player, transferTo, { months: contractMonths, salary: salaryValue });

    setTransfers(prev => [t, ...prev]);
    recordChange(
      "transfer",
      `Transfer: ${t.player} ${transferFrom} → ${transferTo}`,
      before,
    );
    refreshChangeLog();
    setTransferPlayer(""); setTransferFrom("-"); setTransferTo("-");
    setContractMonths(24); setSalaryInput(""); setFeeInput("");
    setShowDialog(false);
  };

  const handleRevert = (id: string, label: string) => {
    if (!confirm(`Cofnąć zmianę?\n\n"${label}"\n\nTo również usunie wszystkie późniejsze zmiany.`)) return;
    const ok = revertTo(id);
    if (ok) {
      // Re-sync the local transfers list with persisted custom transfers
      // by rebuilding from seed + customTransfersGlobal.
      const prevByKey = new Map(
        transfers.map(t => [`${t.player}|${t.oldTeam}|${t.newTeam}`, t.date])
      );
      const rebuilt: Transfer[] = [
        ...customTransfersGlobal.map((ct, i) => {
          const key = `${ct.player}|${ct.oldTeam}|${ct.newTeam}`;
          return {
            id: `live-${i}`,
            player: ct.player,
            oldTeam: ct.oldTeam,
            newTeam: ct.newTeam,
            date: prevByKey.get(key) ?? getWorldNowIso(),
          };
        }),
        ...seedTransfers.map((s, i) => ({
          id: `seed-${i}`,
          player: s.player,
          oldTeam: s.oldTeam,
          newTeam: s.newTeam,
          date: seedDateForIndex(i, seedTransfers.length),
        })),

      ];
      setTransfers(rebuilt);
      saveToStorage(TRANSFERS_KEY, rebuilt);
      refreshChangeLog();
      window.dispatchEvent(new CustomEvent("teams:update"));
      window.dispatchEvent(new CustomEvent("ranking:update"));
      window.dispatchEvent(new CustomEvent("transfers:update"));
      toast({ title: "Cofnięto zmianę", description: label });
    }
  };

  const handleClearLog = () => {
    if (!confirm("Wyczyścić całą historię zmian? Aktualny stan bazy zostanie zachowany, ale nie będzie można już cofnąć poprzednich zmian.")) return;
    clearChangeLog();
    refreshChangeLog();
  };

  return (
    <section className="py-6">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-xl border border-primary/25 bg-gradient-to-br from-primary/12 via-primary/[0.04] to-transparent p-4 sm:p-5 mb-5 flex items-center justify-between flex-wrap gap-3">
          <div className="absolute -top-12 -right-12 w-44 h-44 bg-primary/15 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center shadow-[0_0_20px_hsl(var(--primary)/0.15)]">
              <ArrowRightLeft className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-heading font-bold text-foreground leading-tight tracking-tight">Transfery</h2>
              <p className="text-xs text-muted-foreground font-mono mt-1">{transfers.length} zapisanych ruchów</p>
            </div>
          </div>
          <div className="relative">
          <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (o) { setPickerSearch(""); setPickerKind("all"); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" /> Nowy transfer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="w-4 h-4 text-primary" /> Nowy transfer
                </DialogTitle>
              </DialogHeader>
              <div className="grid md:grid-cols-2 gap-4 pt-2">
                {/* LEFT: searchable picker */}
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider">Wybierz osobę</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      autoFocus
                      placeholder="Szukaj nicku, drużyny, roli..."
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      className="pl-8 h-9 bg-secondary/40"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {([
                      { v: "all", label: "Wszyscy", n: pickerCatalog.length },
                      { v: "player", label: "Zawodnicy", n: pickerCatalog.filter(e => e.kind === "player").length },
                      { v: "coach", label: "🎓 Trenerzy", n: pickerCatalog.filter(e => e.kind === "coach").length },
                      { v: "fa", label: "FA", n: pickerCatalog.filter(e => e.kind === "fa").length },
                    ] as { v: typeof pickerKind; label: string; n: number }[]).map(o => (
                      <button
                        key={o.v}
                        onClick={() => setPickerKind(o.v)}
                        className={cn(
                          "px-2 py-1 text-xs font-mono rounded border transition-colors",
                          pickerKind === o.v
                            ? "bg-primary/20 text-primary border-primary/40"
                            : "text-muted-foreground border-border hover:text-foreground",
                        )}
                      >
                        {o.label} <span className="opacity-60">({o.n})</span>
                      </button>
                    ))}
                  </div>
                  <div className="h-72 overflow-y-auto rounded border border-border bg-secondary/20">
                    {filteredPicker.length === 0 ? (
                      <div className="p-6 text-center text-xs font-mono text-muted-foreground">Brak wyników</div>
                    ) : filteredPicker.map(e => {
                      const active = transferPlayer === e.name;
                      return (
                        <button
                          key={e.name}
                          type="button"
                          onClick={() => {
                            setTransferPlayer(e.name);
                            setTransferFrom(e.team || "-");
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-2.5 py-1.5 text-left border-b border-border/40 last:border-b-0 transition-colors",
                            active ? "bg-primary/15" : "hover:bg-secondary/50",
                            e.kind === "coach" && "bg-sky-500/[0.04]",
                          )}
                        >
                          <span className="w-4 text-center text-xs shrink-0">
                            {e.country ? countryFlag(e.country) : "🏳️"}
                          </span>
                          <span className="text-sm font-heading text-foreground truncate flex-1">{e.name}</span>
                          {e.role && (
                            <span className={cn(
                              "text-xs font-mono px-1 py-0.5 rounded border shrink-0",
                              e.role === "Coach"
                                ? "border-sky-500/40 text-sky-300 bg-sky-500/10"
                                : "border-border text-muted-foreground",
                            )}>
                              {roleIcons[e.role] || ""} {e.role}
                            </span>
                          )}
                          {e.team ? (
                            <span className="text-xs font-mono text-muted-foreground truncate max-w-[110px] shrink-0">{e.team}</span>
                          ) : (
                            <span className="text-xs font-mono text-amber-400 shrink-0">FA</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT: destination + summary */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider block mb-1">Wybrany</label>
                    {transferPlayer ? (
                      <div className={cn(
                        "flex items-center gap-2 p-2 rounded border",
                        isCoachPick ? "border-sky-500/40 bg-sky-500/5" : "border-border bg-secondary/40",
                      )}>
                        <span className="text-lg">{selectedEntry?.country ? countryFlag(selectedEntry.country) : "🏳️"}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-heading font-bold text-sm truncate">{transferPlayer}</p>
                          <p className="text-xs font-mono text-muted-foreground truncate">
                            {isCoachPick && "🎓 Trener • "}
                            {transferFrom === "-" ? "Free Agent" : transferFrom}
                            {selectedEntry?.role && !isCoachPick && ` • ${selectedEntry.role}`}
                          </p>
                        </div>
                        <button
                          onClick={() => { setTransferPlayer(""); setTransferFrom("-"); }}
                          className="text-muted-foreground hover:text-destructive"
                          title="Wyczyść wybór"
                        >
                          <XIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="p-3 rounded border border-dashed border-border text-center text-xs font-mono text-muted-foreground">
                        Wybierz osobę z listy →
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider block mb-1">
                      {isCoachPick ? "Nowy klub trenera" : "Do drużyny"}
                    </label>
                    <select
                      value={transferTo}
                      onChange={e => setTransferTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground text-sm font-mono"
                    >
                      <option value="-">— Free Agent</option>
                      {allTeams.map(t => {
                        const td = liveTeams.find(x => x.name === t);
                        const suffix = isCoachPick && td?.coach && td.coach !== transferPlayer
                          ? `  (obecny trener: ${td.coach})`
                          : "";
                        return <option key={t} value={t}>{t}{suffix}</option>;
                      })}
                    </select>
                    {targetTeamHasCoach && (
                      <p className="mt-1 text-xs font-mono text-amber-400">
                        ⚠ {transferTo} ma już trenera ({targetTeamHasCoach}). Zostanie zastąpiony.
                      </p>
                    )}
                  </div>

                  {transferPlayer && transferTo !== "-" && (
                    <div className="rounded-lg border border-border bg-secondary/25 p-3 space-y-3">
                      <p className="text-xs font-mono uppercase text-muted-foreground tracking-wider">
                        Warunki kontraktu
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs font-mono text-muted-foreground block mb-1">Długość</label>
                          <select
                            value={contractMonths}
                            onChange={e => setContractMonths(Number(e.target.value))}
                            className="w-full px-2 py-1.5 rounded-md bg-card border border-border text-foreground text-sm font-mono"
                          >
                            {[6, 12, 18, 24, 30, 36].map(m => (
                              <option key={m} value={m}>{m} mies.</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-mono text-muted-foreground block mb-1">Płaca / mies. (€)</label>
                          <Input
                            type="number"
                            value={salaryInput}
                            onChange={e => setSalaryInput(e.target.value)}
                            className="h-[34px] bg-card font-mono text-sm"
                          />
                        </div>
                      </div>

                      {transferFrom !== "-" && (
                        <div>
                          <label className="text-xs font-mono text-muted-foreground block mb-1">Kwota transferu (€)</label>
                          <div className="flex gap-2">
                            <Input
                              type="number"
                              value={feeInput}
                              onChange={e => setFeeInput(e.target.value)}
                              className="h-[34px] bg-card font-mono text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setFeeInput(String(suggestTransferFee(transferPlayer, transferFrom, transferTo)))}
                              className="px-2 rounded border border-border text-xs font-mono text-muted-foreground hover:text-foreground shrink-0"
                              title="Wylosuj kwotę"
                            >
                              Losuj
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Porównanie warunków */}
                      <div className="rounded border border-border/60 bg-card/60 p-2">
                        <div className="grid grid-cols-3 gap-1 text-xs font-mono">
                          <span className="text-muted-foreground">Warunki</span>
                          <span className="text-muted-foreground text-right">Obecne</span>
                          <span className="text-muted-foreground text-right">Nowe</span>

                          <span className="text-muted-foreground">Klub</span>
                          <span className="text-right truncate">{prevContract?.team || "—"}</span>
                          <span className="text-right truncate text-foreground">{transferTo}</span>

                          <span className="text-muted-foreground">Płaca</span>
                          <span className="text-right">{prevContract?.salary ? formatMoney(prevContract.salary) : "—"}</span>
                          <span className={cn(
                            "text-right font-bold",
                            salaryDelta > 0 ? "text-[hsl(var(--win))]" : salaryDelta < 0 ? "text-[hsl(var(--loss))]" : "text-foreground",
                          )}>
                            {salaryValue ? formatMoney(salaryValue) : "—"}
                            {salaryDelta !== 0 && prevContract?.salary ? ` (${salaryDelta > 0 ? "+" : "-"}${formatMoney(Math.abs(salaryDelta))})` : ""}
                          </span>

                          <span className="text-muted-foreground">Koniec</span>
                          <span className="text-right">
                            {prevContract ? new Date(prevContract.end_date).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          </span>
                          <span className="text-right text-foreground">{contractMonths} mies.</span>

                          {transferFrom !== "-" && (
                            <>
                              <span className="text-muted-foreground">Odstępne</span>
                              <span className="text-right">—</span>
                              <span className="text-right text-amber-400 font-bold">{feeValue ? formatMoney(feeValue) : "—"}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {transferPlayer && transferFrom !== "-" && (
                    <button
                      onClick={() => setTransferTo("-")}
                      className="w-full text-xs font-mono py-1.5 rounded border border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                    >
                      Zwolnij do FA
                    </button>
                  )}

                  <Button
                    onClick={handleAddTransfer}
                    disabled={!transferPlayer || (transferFrom === transferTo)}
                    className="w-full"
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-2" />
                    {transferFrom === "-" && transferTo !== "-" ? "Podpisz" :
                      transferTo === "-" ? "Zwolnij" : "Przenieś"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setSection("transfers")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md font-heading font-semibold text-sm border transition-colors",
              section === "transfers" ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" /> Transfery
            <span className="font-mono text-xs opacity-70">({transfers.length})</span>
          </button>
          <button
            onClick={() => setSection("freeAgents")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md font-heading font-semibold text-sm border transition-colors",
              section === "freeAgents" ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <UserMinus className="w-3.5 h-3.5" /> Wolni agenci
            <span className="font-mono text-xs opacity-70">({freeAgents.length})</span>
          </button>
          <button
            onClick={() => { refreshChangeLog(); setSection("changes"); }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-md font-heading font-semibold text-sm border transition-colors",
              section === "changes" ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground border-border hover:text-foreground"
            )}
          >
            <History className="w-3.5 h-3.5" /> Historia zmian
            <span className="font-mono text-xs opacity-70">({changeLog.length})</span>
          </button>
        </div>

        {section === "transfers" && (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Szukaj gracza..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-card border-border" />
              </div>
              <select
                value={teamFilter}
                onChange={e => setTeamFilter(e.target.value)}
                className="px-3 py-2 rounded-md bg-card border border-border text-foreground text-sm font-mono min-w-[180px]"
              >
                <option value="">Wszystkie drużyny</option>
                {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as TransferType)}
                className="px-3 py-2 rounded-md bg-card border border-border text-foreground text-sm font-mono"
              >
                <option value="all">Wszystkie</option>
                <option value="join">Dołączenia</option>
                <option value="leave">Odejścia</option>
                <option value="move">Transfery</option>
              </select>
              <button
                onClick={() => setReversed(r => !r)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-mono transition-colors",
                  reversed ? "bg-primary/20 text-primary border-primary/40" : "text-muted-foreground border-border hover:text-foreground"
                )}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {reversed ? "Najstarsze ↑" : "Najnowsze ↑"}
              </button>
            </div>

            {/* List */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-secondary/50 text-xs font-mono text-muted-foreground uppercase">
                <div className="col-span-1">#</div>
                <div className="col-span-3">Gracz</div>
                <div className="col-span-3">Z drużyny</div>
                <div className="col-span-2">Do drużyny</div>
                <div className="col-span-2">Kwota</div>
                <div className="col-span-2">Data</div>
              </div>
              {filtered.length === 0 && (
                <div className="px-4 py-8 text-center text-muted-foreground text-sm font-mono">Brak transferów</div>
              )}
              {filtered.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-12 gap-1 px-4 py-2.5 border-t border-border/50 items-center text-sm hover:bg-secondary/30 transition-colors"
                >
                  <div className="col-span-1 font-mono text-muted-foreground text-xs">{i + 1}</div>
                  <div className="col-span-3 font-medium text-foreground flex items-center gap-1.5">
                    {(() => { const c = resolvePlayerCountry(t.player); return c && <span className="text-xs">{countryFlag(c)}</span>; })()}
                    {t.player}
                    {playerRoles[t.player] === "Coach" && (
                      <span className="text-xs font-mono px-1 py-0.5 rounded border border-sky-500/40 text-sky-300 bg-sky-500/10">🎓</span>
                    )}
                  </div>
                  <div className="col-span-3">
                    {t.oldTeam === "-" ? (
                      <span className="text-muted-foreground italic text-xs">Free Agent</span>
                    ) : (
                      <span className="text-[hsl(var(--loss))] text-xs font-mono">{t.oldTeam}</span>
                    )}
                  </div>
                  <div className="col-span-2">
                    {t.newTeam === "-" ? (
                      <span className="text-muted-foreground italic text-xs">Free Agent</span>
                    ) : (
                      <span className="text-[hsl(var(--win))] text-xs font-mono">{t.newTeam}</span>
                    )}
                  </div>
                  <div className="col-span-2 text-xs font-mono">
                    {t.oldTeam !== "-" && t.newTeam !== "-" ? (
                      <span className="text-amber-400">
                        {formatMoney(t.fee ?? suggestTransferFee(t.player, t.oldTeam, t.newTeam))}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                  <div className="col-span-2 text-xs text-muted-foreground font-mono">
                    {new Date(t.date).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}

        {section === "freeAgents" && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-secondary/50 text-xs font-mono text-muted-foreground uppercase">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Gracz</div>
              <div className="col-span-6">Poprzednia drużyna</div>
            </div>
            {freeAgents.length === 0 && (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm font-mono">Brak wolnych agentów</div>
            )}
            {freeAgents.map((fa, i) => (
              <div key={fa.player} className="grid grid-cols-12 gap-1 px-4 py-2.5 border-t border-border/50 items-center text-sm">
                <div className="col-span-1 font-mono text-muted-foreground text-xs">{i + 1}</div>
                <div className="col-span-5 font-medium text-foreground flex items-center gap-1.5">
                  {fa.nationality && <span className="text-xs">{countryFlag(fa.nationality)}</span>}
                  {fa.player}
                </div>
                <div className="col-span-6 text-muted-foreground text-xs font-mono">{fa.previousTeam}</div>
              </div>
            ))}
          </div>
        )}

        {section === "changes" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground font-mono">
                Każda edycja bazy (transfer, FA, rola, narodowość) zostaje tu zapisana. Cofnięcie wybranego punktu przywróci stan sprzed niego — wszystkie późniejsze zmiany zostaną usunięte.
              </p>
              {changeLog.length > 0 && (
                <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={handleClearLog}>
                  <Trash2 className="w-3.5 h-3.5" /> Wyczyść log
                </Button>
              )}
            </div>
            {changeLog.length === 0 ? (
              <div className="bg-card border border-dashed border-border rounded-lg p-10 text-center">
                <History className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm font-mono text-muted-foreground">Brak zarejestrowanych zmian.</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-secondary/50 text-xs font-mono text-muted-foreground uppercase">
                  <div className="col-span-2">Kiedy</div>
                  <div className="col-span-2">Typ</div>
                  <div className="col-span-6">Opis</div>
                  <div className="col-span-2 text-right">Akcja</div>
                </div>
                {[...changeLog].reverse().map(entry => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="grid grid-cols-12 gap-2 px-4 py-2.5 border-t border-border/50 items-center text-sm hover:bg-secondary/30"
                  >
                    <div className="col-span-2 font-mono text-xs text-muted-foreground">
                      {new Date(entry.ts).toLocaleString("pl-PL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="col-span-2">
                      <span className="text-xs font-mono uppercase px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/10">
                        {entry.kind}
                      </span>
                    </div>
                    <div className="col-span-6 text-foreground text-sm">{entry.description}</div>
                    <div className="col-span-2 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-7"
                        onClick={() => handleRevert(entry.id, entry.description)}
                      >
                        <Undo2 className="w-3 h-3" /> Cofnij do tego punktu
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default TransferPanel;
