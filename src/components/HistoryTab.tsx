import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, RefreshCw, XCircle, Search, Filter, ArrowUpDown, Plus, UserPlus, UserMinus, X } from "lucide-react";
import { nameChanges, transfers as staticTransfers, disbands, customTransfersGlobal, type Transfer } from "@/data/history";
import { teamDatabase } from "@/data/tournaments";
import { playerNationalities } from "@/data/playerNationalities";
import { countryFlag } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type HistorySection = "transfers" | "nameChanges" | "disbands" | "freeAgents";
type TransferType = "all" | "join" | "leave" | "move";

interface HistoryTabProps {
  onRosterChange?: () => void;
}

const HistoryTab = ({ onRosterChange }: HistoryTabProps = {}) => {
  const [section, setSection] = useState<HistorySection>("transfers");
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [reversed, setReversed] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TransferType>("all");

  // Manual transfers
  const [customTransfers, setCustomTransfers] = useState<Transfer[]>([]);
  const [manualFreeAgents, setManualFreeAgents] = useState<{ player: string; previousTeam: string; firstName: string; lastName: string; nationality: string }[]>([]);

  // Compute free agents from all transfers: players whose last transfer was to "-"
  const freeAgents = useMemo(() => {
    const allT = [...staticTransfers, ...customTransfersGlobal, ...customTransfers];
    // Track last transfer for each player
    const lastTransfer: Record<string, Transfer> = {};
    allT.forEach(t => { lastTransfer[t.player] = t; });
    
    const fromHistory = Object.values(lastTransfer)
      .filter(t => t.newTeam === "-")
      .map(t => ({
        player: t.player,
        previousTeam: t.oldTeam,
        firstName: "",
        lastName: "",
        nationality: playerNationalities[t.player] || "",
      }));
    
    // Merge with manually added free agents (dedup by player name)
    const seen = new Set(fromHistory.map(f => f.player));
    const manual = manualFreeAgents.filter(f => !seen.has(f.player));
    return [...fromHistory, ...manual];
  }, [customTransfers, manualFreeAgents]);

  // Transfer dialog
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferPlayer, setTransferPlayer] = useState("");
  const [transferFrom, setTransferFrom] = useState("-");
  const [transferTo, setTransferTo] = useState("-");

  // Free agent dialog
  const [showFADialog, setShowFADialog] = useState(false);
  const [faPlayer, setFaPlayer] = useState("");
  const [faPrevTeam, setFaPrevTeam] = useState("");
  const [faFirstName, setFaFirstName] = useState("");
  const [faLastName, setFaLastName] = useState("");
  const [faNationality, setFaNationality] = useState("");

  const allTransfers = [...staticTransfers, ...customTransfers];

  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    allTransfers.forEach(t => {
      if (t.oldTeam !== "-") teams.add(t.oldTeam);
      if (t.newTeam !== "-") teams.add(t.newTeam);
    });
    teamDatabase.forEach(t => teams.add(t.name));
    return Array.from(teams).sort();
  }, [allTransfers]);

  const allPlayers = useMemo(() => {
    const players = new Set<string>();
    teamDatabase.forEach(t => t.roster.forEach(p => players.add(p)));
    return Array.from(players).sort();
  }, []);

  const filteredTransfers = useMemo(() => {
    let result = allTransfers.filter(t => {
      if (search && !t.player.toLowerCase().includes(search.toLowerCase())) return false;
      if (teamFilter && t.oldTeam !== teamFilter && t.newTeam !== teamFilter) return false;
      if (typeFilter === "join" && t.oldTeam !== "-") return false;
      if (typeFilter === "leave" && t.newTeam !== "-") return false;
      if (typeFilter === "move" && (t.oldTeam === "-" || t.newTeam === "-")) return false;
      return true;
    });
    if (reversed) result = [...result].reverse();
    return result;
  }, [search, teamFilter, reversed, typeFilter, allTransfers]);

  const handleAddTransfer = () => {
    if (!transferPlayer.trim()) return;
    const player = transferPlayer.trim();
    const newTransfer: Transfer = { player, oldTeam: transferFrom, newTeam: transferTo };
    
    // Actually update team rosters
    if (transferFrom !== "-") {
      const fromTeam = teamDatabase.find(t => t.name === transferFrom);
      if (fromTeam) {
        fromTeam.roster = fromTeam.roster.filter(p => p !== player);
      }
    }
    if (transferTo !== "-") {
      const toTeam = teamDatabase.find(t => t.name === transferTo);
      if (toTeam && !toTeam.roster.includes(player)) {
        toTeam.roster.push(player);
      }
    }
    
    customTransfersGlobal.push(newTransfer);
    setCustomTransfers(prev => [...prev, newTransfer]);
    setTransferPlayer("");
    setTransferFrom("-");
    setTransferTo("-");
    setShowTransferDialog(false);
    onRosterChange?.();
  };

  const handleAddFreeAgent = () => {
    if (!faPlayer.trim()) return;
    const player = faPlayer.trim();
    
    // Remove from previous team roster
    if (faPrevTeam) {
      const prevTeam = teamDatabase.find(t => t.name === faPrevTeam);
      if (prevTeam) {
        prevTeam.roster = prevTeam.roster.filter(p => p !== player);
      }
      const faTransfer: Transfer = { player, oldTeam: faPrevTeam, newTeam: "-" };
      customTransfersGlobal.push(faTransfer);
      setCustomTransfers(prev => [...prev, faTransfer]);
    }
    
    // Update nationality if provided
    if (faNationality) {
      playerNationalities[player] = faNationality;
    }
    
    setFreeAgents(prev => [...prev, {
      player,
      previousTeam: faPrevTeam || "Nieznana",
      firstName: faFirstName.trim(),
      lastName: faLastName.trim(),
      nationality: faNationality,
    }]);
    setFaPlayer("");
    setFaPrevTeam("");
    setFaFirstName("");
    setFaLastName("");
    setFaNationality("");
    setShowFADialog(false);
    onRosterChange?.();
  };

  const handleRemoveFreeAgent = (idx: number) => {
    setFreeAgents(prev => prev.filter((_, i) => i !== idx));
  };

  const sections: { id: HistorySection; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "transfers", label: "Transfery", icon: <ArrowRightLeft className="w-4 h-4" />, count: allTransfers.length },
    { id: "freeAgents", label: "Wolni agenci", icon: <UserMinus className="w-4 h-4" />, count: freeAgents.length },
    { id: "nameChanges", label: "Zmiany nazw", icon: <RefreshCw className="w-4 h-4" />, count: nameChanges.length },
    { id: "disbands", label: "Rozwiązania", icon: <XCircle className="w-4 h-4" />, count: disbands.length },
  ];

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <ArrowRightLeft className="w-6 h-6 text-primary" />
            <h2 className="text-3xl font-heading font-bold text-foreground">Historia — Pre-season 2026</h2>
          </div>
          <div className="flex gap-2">
            <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus className="w-3.5 h-3.5" /> Transfer
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
                        const val = e.target.value;
                        setTransferPlayer(val);
                        // Auto-detect current team
                        const team = teamDatabase.find(t => t.roster.includes(val));
                        setTransferFrom(team ? team.name : "-");
                      }}
                      list="player-list"
                    />
                    <datalist id="player-list">
                      {allPlayers.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-sm font-mono text-muted-foreground mb-1 block">Z drużyny</label>
                    <div className="w-full px-3 py-2 rounded-md bg-muted border border-border text-foreground text-sm font-mono opacity-70">
                      {transferFrom === "-" ? "Free Agent (brak drużyny)" : transferFrom}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-mono text-muted-foreground mb-1 block">Do drużyny</label>
                    <select
                      value={transferTo}
                      onChange={e => setTransferTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground text-sm font-mono"
                    >
                      <option value="-">Free Agent (brak drużyny)</option>
                      {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <Button onClick={handleAddTransfer} className="w-full">
                    <ArrowRightLeft className="w-4 h-4 mr-2" /> Dodaj transfer
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showFADialog} onOpenChange={setShowFADialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" /> Wolny agent
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dodaj wolnego agenta</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <label className="text-sm font-mono text-muted-foreground mb-1 block">Gracz</label>
                    <Input
                      placeholder="Nick gracza..."
                      value={faPlayer}
                      onChange={e => setFaPlayer(e.target.value)}
                      list="player-list-fa"
                    />
                    <datalist id="player-list-fa">
                      {allPlayers.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-sm font-mono text-muted-foreground mb-1 block">Poprzednia drużyna (opcjonalnie)</label>
                    <select
                      value={faPrevTeam}
                      onChange={e => setFaPrevTeam(e.target.value)}
                      className="w-full px-3 py-2 rounded-md bg-card border border-border text-foreground text-sm font-mono"
                    >
                      <option value="">Brak / nieznana</option>
                      {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-mono text-muted-foreground mb-1 block">Imię</label>
                      <Input placeholder="Imię..." value={faFirstName} onChange={e => setFaFirstName(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm font-mono text-muted-foreground mb-1 block">Nazwisko</label>
                      <Input placeholder="Nazwisko..." value={faLastName} onChange={e => setFaLastName(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-mono text-muted-foreground mb-1 block">Narodowość (kod ISO, np. PL, DE, US)</label>
                    <Input placeholder="PL" value={faNationality} onChange={e => setFaNationality(e.target.value.toUpperCase())} maxLength={2} />
                  </div>
                  <Button onClick={handleAddFreeAgent} className="w-full">
                    <UserPlus className="w-4 h-4 mr-2" /> Dodaj wolnego agenta
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md font-heading font-semibold text-sm border transition-colors",
                section === s.id
                  ? "bg-primary/20 text-primary border-primary/40"
                  : "text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {s.icon}
              {s.label}
              <span className="font-mono text-xs opacity-70">({s.count})</span>
            </button>
          ))}
        </div>

        {/* Transfers */}
        {section === "transfers" && (
          <div>
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Szukaj gracza..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 bg-card border-border"
                />
              </div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <select
                  value={teamFilter}
                  onChange={e => setTeamFilter(e.target.value)}
                  className="pl-9 pr-4 py-2 rounded-md bg-card border border-border text-foreground text-sm font-mono appearance-none cursor-pointer min-w-[200px]"
                >
                  <option value="">Wszystkie drużyny</option>
                  {allTeams.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value as TransferType)}
                className="px-3 py-2 rounded-md bg-card border border-border text-foreground text-sm font-mono appearance-none cursor-pointer"
              >
                <option value="all">Typ: Wszystkie</option>
                <option value="join">Dołączenia</option>
                <option value="leave">Odejścia</option>
                <option value="move">Transfery</option>
              </select>
              <button
                onClick={() => setReversed(r => !r)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-mono transition-colors",
                  reversed
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "text-muted-foreground border-border hover:text-foreground"
                )}
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {reversed ? "Najstarsze ↑" : "Najnowsze ↑"}
              </button>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-secondary/50 text-xs font-mono text-muted-foreground uppercase">
                <div className="col-span-1">#</div>
                <div className="col-span-3">Gracz</div>
                <div className="col-span-4">Z drużyny</div>
                <div className="col-span-4">Do drużyny</div>
              </div>
              {filteredTransfers.map((t, i) => {
                const isCustom = i >= staticTransfers.length - (reversed ? customTransfers.length : 0);
                return (
                  <motion.div
                    key={`${t.player}-${i}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.01, 0.5) }}
                    className={cn(
                      "grid grid-cols-12 gap-1 px-4 py-2.5 border-t border-border/50 items-center text-sm hover:bg-secondary/30 transition-colors",
                      isCustom && "bg-primary/5"
                    )}
                  >
                    <div className="col-span-1 font-mono text-muted-foreground text-xs">{i + 1}</div>
                    <div className="col-span-3 font-medium text-foreground flex items-center gap-1.5">
                      {playerNationalities[t.player] && (
                        <span className="text-xs">{countryFlag(playerNationalities[t.player])}</span>
                      )}
                      {t.player}
                    </div>
                    <div className="col-span-4">
                      {t.oldTeam === "-" ? (
                        <span className="text-muted-foreground italic">Free Agent</span>
                      ) : (
                        <span className="text-loss">{t.oldTeam}</span>
                      )}
                    </div>
                    <div className="col-span-4">
                      {t.newTeam === "-" ? (
                        <span className="text-muted-foreground italic">Free Agent</span>
                      ) : (
                        <span className="text-win">{t.newTeam}</span>
                      )}
                    </div>
                  </motion.div>
                );
              })}
              {filteredTransfers.length === 0 && (
                <div className="px-4 py-8 text-center text-muted-foreground font-mono text-sm">Brak wyników</div>
              )}
            </div>
          </div>
        )}

        {/* Free Agents */}
        {section === "freeAgents" && (
          <div>
            {freeAgents.length === 0 ? (
              <div className="bg-card border border-border rounded-lg p-12 text-center">
                <UserMinus className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground font-mono text-sm mb-4">
                  Brak wolnych agentów. Dodaj gracza przyciskiem "Wolny agent" powyżej.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {freeAgents.map((fa, i) => {
                  const country = fa.nationality || playerNationalities[fa.player];
                  return (
                    <motion.div
                      key={`${fa.player}-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-card border border-border rounded-lg p-4 flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted border border-border flex items-center justify-center text-lg font-heading font-bold text-primary shrink-0">
                        {fa.player[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-bold text-foreground text-sm flex items-center gap-1.5">
                          {country && <span className="text-xs">{countryFlag(country)}</span>}
                          {fa.player}
                        </p>
                        {(fa.firstName || fa.lastName) && (
                          <p className="text-xs text-muted-foreground">{fa.firstName} {fa.lastName}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Poprzednio: <span className="text-foreground">{fa.previousTeam}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveFreeAgent(i)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Name Changes */}
        {section === "nameChanges" && (
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-secondary/50 text-xs font-mono text-muted-foreground uppercase">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Stara nazwa</div>
              <div className="col-span-1 text-center">→</div>
              <div className="col-span-4">Nowa nazwa</div>
              <div className="col-span-2">Data</div>
            </div>
            {nameChanges.map((nc, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-12 gap-1 px-4 py-3 border-t border-border/50 items-center text-sm hover:bg-secondary/30 transition-colors"
              >
                <div className="col-span-1 font-mono text-muted-foreground">{i + 1}</div>
                <div className="col-span-4 font-medium text-loss line-through opacity-70">{nc.oldName}</div>
                <div className="col-span-1 text-center text-primary font-bold">→</div>
                <div className="col-span-4 font-medium text-win font-heading">{nc.newName}</div>
                <div className="col-span-2 font-mono text-xs text-muted-foreground">
                  {new Date(nc.date).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Disbands */}
        {section === "disbands" && (
          <div className="space-y-4">
            {disbands.map((d, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-card border border-destructive/20 rounded-lg p-5"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-heading text-xl font-bold text-foreground flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-destructive" />
                    {d.team}
                  </h3>
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(d.date).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm">
                  Powód: <span className="text-foreground">{d.reason}</span>
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default HistoryTab;
