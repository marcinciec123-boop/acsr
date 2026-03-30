import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowRightLeft, RefreshCw, XCircle, Search, Filter, ArrowUpDown } from "lucide-react";
import { nameChanges, transfers, disbands } from "@/data/history";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type HistorySection = "transfers" | "nameChanges" | "disbands";

type TransferType = "all" | "join" | "leave" | "move";

const HistoryTab = () => {
  const [section, setSection] = useState<HistorySection>("transfers");
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [reversed, setReversed] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TransferType>("all");

  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    transfers.forEach(t => {
      if (t.oldTeam !== "-") teams.add(t.oldTeam);
      if (t.newTeam !== "-") teams.add(t.newTeam);
    });
    return Array.from(teams).sort();
  }, []);

  const filteredTransfers = useMemo(() => {
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
  }, [search, teamFilter, reversed, typeFilter]);

  const sections: { id: HistorySection; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "transfers", label: "Transfery", icon: <ArrowRightLeft className="w-4 h-4" />, count: transfers.length },
    { id: "nameChanges", label: "Zmiany nazw", icon: <RefreshCw className="w-4 h-4" />, count: nameChanges.length },
    { id: "disbands", label: "Rozwiązania", icon: <XCircle className="w-4 h-4" />, count: disbands.length },
  ];

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-3 mb-6">
          <ArrowRightLeft className="w-6 h-6 text-primary" />
          <h2 className="text-3xl font-heading font-bold text-foreground">Historia — Pre-season 2026</h2>
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
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 gap-1 px-4 py-2 bg-secondary/50 text-xs font-mono text-muted-foreground uppercase">
                <div className="col-span-1">#</div>
                <div className="col-span-3">Gracz</div>
                <div className="col-span-4">Z drużyny</div>
                <div className="col-span-4">Do drużyny</div>
              </div>
              {filteredTransfers.map((t, i) => (
                <motion.div
                  key={`${t.player}-${i}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.01, 0.5) }}
                  className="grid grid-cols-12 gap-1 px-4 py-2.5 border-t border-border/50 items-center text-sm hover:bg-secondary/30 transition-colors"
                >
                  <div className="col-span-1 font-mono text-muted-foreground text-xs">{i + 1}</div>
                  <div className="col-span-3 font-medium text-foreground">{t.player}</div>
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
              ))}
              {filteredTransfers.length === 0 && (
                <div className="px-4 py-8 text-center text-muted-foreground font-mono text-sm">Brak wyników</div>
              )}
            </div>
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
