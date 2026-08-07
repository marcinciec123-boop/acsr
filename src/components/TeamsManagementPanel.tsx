import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Plus, Edit3, Save, X, Trash2, AlertTriangle, Search, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { countryFlag } from "@/lib/flags";
import TeamLogo from "@/components/TeamLogo";
import {
  loadAllTeams, createTeam, updateTeam, disbandTeam,
  type CreateTeamInput,
} from "@/lib/teamManagement";
import { toast } from "@/hooks/use-toast";
import type { TeamData } from "@/lib/types";

const REGIONS = ["EU", "US", "LATAM", "ASIA", "OCE", "AFR"];

const TeamsManagementPanel = () => {
  const [teams, setTeams] = useState<TeamData[]>(() => loadAllTeams());
  const [search, setSearch] = useState("");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; country: string; region: string; points: string }>({
    name: "", country: "", region: "EU", points: "0",
  });
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<CreateTeamInput>({
    name: "", country: "", region: "EU", points: 0, roster: [],
  });
  const [rosterInput, setRosterInput] = useState("");
  const [confirmDisband, setConfirmDisband] = useState<{ name: string; reason: string } | null>(null);

  const refresh = () => setTeams(loadAllTeams());

  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("teams:update", handler);
    return () => window.removeEventListener("teams:update", handler);
  }, []);

  const filtered = useMemo(
    () => teams
      .filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.points - a.points),
    [teams, search],
  );

  const startEdit = (t: TeamData) => {
    setEditingName(t.name);
    setEditForm({ name: t.name, country: t.country, region: t.region, points: String(t.points) });
  };

  const cancelEdit = () => setEditingName(null);

  const saveEdit = (oldName: string) => {
    const points = parseInt(editForm.points);
    const res = updateTeam(oldName, {
      name: editForm.name.trim(),
      country: editForm.country.trim(),
      region: editForm.region,
      points: isNaN(points) ? undefined : points,
    });
    if (!res.ok) {
      toast({ title: "Nie zapisano", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Zapisano zmiany" });
    setEditingName(null);
    refresh();
  };

  const handleCreate = () => {
    const res = createTeam({
      ...createForm,
      roster: rosterInput
        .split(/[,\n]/)
        .map(p => p.trim())
        .filter(Boolean),
    });
    if (!res.ok) {
      toast({ title: "Nie utworzono", description: res.error, variant: "destructive" });
      return;
    }
    toast({ title: "Utworzono drużynę", description: createForm.name });
    setCreateForm({ name: "", country: "", region: "EU", points: 0, roster: [] });
    setRosterInput("");
    setShowCreate(false);
    refresh();
  };

  const handleDisband = () => {
    if (!confirmDisband) return;
    const res = disbandTeam(confirmDisband.name, { reason: confirmDisband.reason });
    if (!res.ok) {
      toast({ title: "Błąd", description: res.error, variant: "destructive" });
      return;
    }
    toast({
      title: "Drużyna rozwiązana",
      description: `${confirmDisband.name} — gracze trafili do wolnych agentów`,
    });
    setConfirmDisband(null);
    refresh();
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-bold text-foreground flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Zarządzanie drużynami
          <span className="text-xs font-mono text-muted-foreground">({teams.length})</span>
        </h3>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" /> Nowa drużyna
        </Button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Edytuj nazwę / kraj / region / punkty. Zmiany propagują się tylko do bieżących, nieukończonych turniejów —
        historia (transfery, zakończone wydarzenia) zostaje pod oryginalną nazwą.
      </p>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Szukaj drużyny..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-secondary/40"
        />
      </div>

      <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {filtered.map(t => {
            const editing = editingName === t.name;
            const contractsOpen = contractsFor === t.name;
            return (
              <motion.div
                key={t.name}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className={cn(
                  "border rounded-md",
                  editing ? "border-primary/50 bg-primary/5" : "border-border bg-secondary/20",
                )}
              >
                <div className="p-2.5 flex items-center gap-3">
                <TeamLogo teamName={t.name} size={32} />

                {editing ? (
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                    <Input
                      value={editForm.name}
                      onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Nazwa"
                      className="h-8 text-xs sm:col-span-2"
                    />
                    <Input
                      value={editForm.country}
                      onChange={e => setEditForm(f => ({ ...f, country: e.target.value.toUpperCase() }))}
                      placeholder="Kraj (np. POL)"
                      maxLength={4}
                      className="h-8 text-xs"
                    />
                    <select
                      value={editForm.region}
                      onChange={e => setEditForm(f => ({ ...f, region: e.target.value }))}
                      className="h-8 text-xs px-2 rounded-md border border-border bg-card"
                    >
                      {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <Input
                      type="number"
                      value={editForm.points}
                      onChange={e => setEditForm(f => ({ ...f, points: e.target.value }))}
                      placeholder="pkt"
                      className="h-8 text-xs"
                    />
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="font-heading font-bold text-sm text-foreground truncate">{t.name}</div>
                    <div className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                      <span>{countryFlag(t.country)} {t.country}</span>
                      <span className="text-border">•</span>
                      <span>{t.region}</span>
                      <span className="text-border">•</span>
                      <span>{t.points} pkt</span>
                      <span className="text-border">•</span>
                      <span>{t.roster.length} graczy</span>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1">
                  {editing ? (
                    <>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-primary" onClick={() => saveEdit(t.name)}>
                        <Save className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground" onClick={cancelEdit}>
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className={cn("h-8 w-8 p-0", contractsOpen && "text-primary bg-primary/10")}
                        onClick={() => setContractsFor(contractsOpen ? null : t.name)}
                        title="Kontrakty i wartości transferowe"
                      >
                        <FileSignature className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => startEdit(t)} title="Edytuj">
                        <Edit3 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-destructive"
                        onClick={() => setConfirmDisband({ name: t.name, reason: "" })}
                        title="Rozwiąż drużynę"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
                </div>
                {contractsOpen && !editing && <TeamContractsSection team={t} />}
              </motion.div>
            );
          })}

        </AnimatePresence>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground font-mono py-8">Brak drużyn pasujących do filtra.</p>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nowa drużyna</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Nazwa *</label>
              <Input
                value={createForm.name}
                onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                placeholder="np. Team Phoenix"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1 block">Kraj</label>
                <Input
                  value={createForm.country}
                  onChange={e => setCreateForm(f => ({ ...f, country: e.target.value.toUpperCase() }))}
                  placeholder="POL"
                  maxLength={4}
                />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1 block">Region</label>
                <select
                  value={createForm.region}
                  onChange={e => setCreateForm(f => ({ ...f, region: e.target.value }))}
                  className="w-full h-10 px-3 rounded-md border border-border bg-background text-sm"
                >
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground mb-1 block">Punkty</label>
                <Input
                  type="number"
                  value={createForm.points}
                  onChange={e => setCreateForm(f => ({ ...f, points: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block">
                Skład (opcjonalnie, oddziel przecinkami lub Enter)
              </label>
              <textarea
                value={rosterInput}
                onChange={e => setRosterInput(e.target.value)}
                placeholder="player1, player2, player3..."
                rows={3}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Anuluj</Button>
            <Button onClick={handleCreate} disabled={!createForm.name.trim()}>Utwórz drużynę</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disband Dialog */}
      <Dialog open={!!confirmDisband} onOpenChange={open => !open && setConfirmDisband(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Rozwiąż drużynę
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Drużyna <strong className="text-foreground">{confirmDisband?.name}</strong> zostanie rozwiązana.
              Wszyscy gracze trafią do wolnych agentów. Drużyna pozostanie widoczna w historii zakończonych turniejów,
              ale zostanie usunięta z bieżącego rankingu i nadchodzących wydarzeń.
            </p>
            <div>
              <label className="text-xs font-mono text-muted-foreground mb-1 block">Powód (opcjonalnie)</label>
              <Input
                value={confirmDisband?.reason || ""}
                onChange={e => setConfirmDisband(c => c ? { ...c, reason: e.target.value } : null)}
                placeholder="np. Bankructwo, brak wyników..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDisband(null)}>Anuluj</Button>
            <Button variant="destructive" onClick={handleDisband}>Rozwiąż drużynę</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamsManagementPanel;
