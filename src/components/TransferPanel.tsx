import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, Search, Filter, ArrowUpDown, Plus, UserMinus, History, Undo2, Trash2 } from "lucide-react";
import { teamDatabase } from "@/data/tournaments";
import { playerNationalities } from "@/data/playerNationalities";
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
import {
  captureSnapshot, recordChange, loadChangeLog, revertTo, clearChangeLog,
  persistCurrentRosters, type ChangeLogEntry,
} from "@/lib/changeLog";
import { removeFromAllBenches } from "@/lib/benchedPlayers";
import { toast } from "@/hooks/use-toast";

type TransferType = "all" | "join" | "leave" | "move";
type Section = "transfers" | "freeAgents" | "changes";

const TRANSFERS_KEY = "transfers_data";

const TransferPanel = () => {
  const [transfers, setTransfers] = useState<Transfer[]>(() => {
    const saved = loadFromStorage<Transfer[]>(TRANSFERS_KEY, []);
    if (saved.length > 0) return saved;
    // Seed from history.ts
    const seeded: Transfer[] = seedTransfers.map((t, i) => ({
      id: `seed-${i}`,
      player: t.player,
      oldTeam: t.oldTeam,
      newTeam: t.newTeam,
      date: new Date(2025, 5, 1 + Math.floor(i / 5)).toISOString(),
    }));
    saveToStorage(TRANSFERS_KEY, seeded);
    return seeded;
  });
  const [section, setSection] = useState<Section>("transfers");
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [reversed, setReversed] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TransferType>("all");

  const [showDialog, setShowDialog] = useState(false);
  const [transferPlayer, setTransferPlayer] = useState("");
  const [transferFrom, setTransferFrom] = useState("-");
  const [transferTo, setTransferTo] = useState("-");

  useEffect(() => { saveToStorage(TRANSFERS_KEY, transfers); }, [transfers]);

  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    transfers.forEach(t => {
      if (t.oldTeam !== "-") teams.add(t.oldTeam);
      if (t.newTeam !== "-") teams.add(t.newTeam);
    });
    teamDatabase.forEach(t => teams.add(t.name));
    return Array.from(teams).sort();
  }, [transfers]);

  const allPlayers = useMemo(() => {
    const players = new Set<string>();
    teamDatabase.forEach(t => t.roster.forEach(p => players.add(p)));
    transfers.forEach(t => players.add(t.player));
    return Array.from(players).sort();
  }, [transfers]);

  const freeAgents = useMemo(() => {
    const lastTransfer: Record<string, Transfer> = {};
    transfers.forEach(t => { lastTransfer[t.player] = t; });
    return Object.values(lastTransfer)
      .filter(t => t.newTeam === "-")
      .map(t => ({
        player: t.player,
        previousTeam: t.oldTeam,
        nationality: playerNationalities[t.player] || "",
      }));
  }, [transfers]);

  const filtered = useMemo(() => {
    let result = transfers.filter(t => {
      if (search && !t.player.toLowerCase().includes(search.toLowerCase())) return false;
      if (teamFilter && t.oldTeam !== teamFilter && t.newTeam !== teamFilter) return false;
      if (typeFilter === "join" && t.oldTeam !== "-") return false;
      if (typeFilter === "leave" && t.newTeam !== "-") return false;
      if (typeFilter === "move" && (t.oldTeam === "-" || t.newTeam === "-")) return false;
      return true;
    });
    if (reversed) result = [...result].reverse();
    return result;
  }, [search, teamFilter, reversed, typeFilter, transfers]);

  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>(() => loadChangeLog());

  const refreshChangeLog = () => setChangeLog(loadChangeLog());

  const handleAddTransfer = () => {
    if (!transferPlayer.trim()) return;
    const t: Transfer = {
      id: Date.now().toString(36),
      player: transferPlayer.trim(),
      oldTeam: transferFrom,
      newTeam: transferTo,
      date: new Date().toISOString(),
    };

    // Snapshot BEFORE applying any mutation, for the change log.
    const before = captureSnapshot();

    const isCoach = (playerRoles as Record<string, string>)[t.player] === "Coach";

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
    }

    // Mirror the transfer into the global FA log so PlayersPanel/profile stay in sync.
    const raw: RawTransfer = { player: t.player, oldTeam: t.oldTeam, newTeam: t.newTeam };
    customTransfersGlobal.push(raw);
    saveToStorage("custom_transfers", customTransfersGlobal);

    // Auto-publish a news post about the transfer.
    import("@/lib/autoNews").then(m => m.announceTransfer(t.player, t.oldTeam, t.newTeam));

    // Persist roster changes everywhere they need to live.
    persistCurrentRosters();
    const RANKING_KEY = "ranking_data";
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

    setTransfers(prev => [t, ...prev]);
    recordChange(
      "transfer",
      `Transfer: ${t.player} ${transferFrom} → ${transferTo}`,
      before,
    );
    refreshChangeLog();
    setTransferPlayer(""); setTransferFrom("-"); setTransferTo("-");
    setShowDialog(false);
  };

  const handleRevert = (id: string, label: string) => {
    if (!confirm(`Cofnąć zmianę?\n\n"${label}"\n\nTo również usunie wszystkie późniejsze zmiany.`)) return;
    const ok = revertTo(id);
    if (ok) {
      // Re-sync the local transfers list with persisted custom transfers
      // by rebuilding from seed + customTransfersGlobal.
      const rebuilt: Transfer[] = [
        ...customTransfersGlobal.map((ct, i) => ({
          id: `live-${i}`,
          player: ct.player,
          oldTeam: ct.oldTeam,
          newTeam: ct.newTeam,
          date: new Date().toISOString(),
        })),
        ...seedTransfers.map((s, i) => ({
          id: `seed-${i}`,
          player: s.player,
          oldTeam: s.oldTeam,
          newTeam: s.newTeam,
          date: new Date(2025, 5, 1 + Math.floor(i / 5)).toISOString(),
        })),
      ];
      setTransfers(rebuilt);
      saveToStorage(TRANSFERS_KEY, rebuilt);
      refreshChangeLog();
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-heading font-bold text-foreground">Transfery</h2>
          </div>
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" /> Nowy transfer
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Dodaj transfer</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-mono text-muted-foreground mb-1 block">Gracz</label>
                  <Input
                    placeholder="Nick gracza..."
                    value={transferPlayer}
                    onChange={e => {
                      setTransferPlayer(e.target.value);
                      const team = teamDatabase.find(t => t.roster.includes(e.target.value));
                      setTransferFrom(team ? team.name : "-");
                    }}
                    list="player-list-transfer"
                  />
                  <datalist id="player-list-transfer">
                    {allPlayers.map(p => <option key={p} value={p} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-sm font-mono text-muted-foreground mb-1 block">Z drużyny</label>
                  <div className="w-full px-3 py-2 rounded-md bg-muted border border-border text-foreground text-sm font-mono opacity-70">
                    {transferFrom === "-" ? "Free Agent" : transferFrom}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-mono text-muted-foreground mb-1 block">Do drużyny</label>
                  <select
                    value={transferTo}
                    onChange={e => setTransferTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground text-sm font-mono"
                  >
                    <option value="-">Free Agent</option>
                    {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <Button onClick={handleAddTransfer} className="w-full">
                  <ArrowRightLeft className="w-4 h-4 mr-2" /> Dodaj transfer
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
                <div className="col-span-3">Do drużyny</div>
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
                  </div>
                  <div className="col-span-3">
                    {t.oldTeam === "-" ? (
                      <span className="text-muted-foreground italic text-xs">Free Agent</span>
                    ) : (
                      <span className="text-[hsl(var(--loss))] text-xs font-mono">{t.oldTeam}</span>
                    )}
                  </div>
                  <div className="col-span-3">
                    {t.newTeam === "-" ? (
                      <span className="text-muted-foreground italic text-xs">Free Agent</span>
                    ) : (
                      <span className="text-[hsl(var(--win))] text-xs font-mono">{t.newTeam}</span>
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
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-primary/30 text-primary bg-primary/10">
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
