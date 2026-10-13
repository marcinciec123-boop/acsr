import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2, Wallet, Skull } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABEL, FINANCES_EVENT, HEALTH_LABEL, addManualEntry, getTeamFinance,
  removeManualEntry, updateFinanceSettings, type FinanceHealth,
} from "@/lib/teamFinances";
import { CONTRACTS_EVENT } from "@/lib/contracts";
import { disbandTeam } from "@/lib/teamManagement";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const money = (n: number) => (n < 0 ? "-" : "") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");

export const HEALTH_CLASS: Record<FinanceHealth, string> = {
  ok: "text-emerald-400 border-emerald-500/40 bg-emerald-500/10",
  low: "text-amber-400 border-amber-500/40 bg-amber-500/10",
  negative: "text-orange-400 border-orange-500/40 bg-orange-500/10",
  critical: "text-destructive border-destructive/50 bg-destructive/10",
};

/** Odświeża komponent po zmianach danych, wpływających na finanse. */
export function useFinanceTick() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const r = () => { clearTimeout(t); t = setTimeout(() => setTick(x => x + 1), 300); };
    const evs = [FINANCES_EVENT, CONTRACTS_EVENT, "tournaments:update", "teams:update", "worldclock:update"];
    evs.forEach(e => window.addEventListener(e, r));
    return () => { clearTimeout(t); evs.forEach(e => window.removeEventListener(e, r)); };
  }, []);
  return tick;
}

/** Wstążka ostrzegawcza w profilu drużyny — tylko informacja, bez akcji. */
export const FinanceWarningRibbon = ({ team, onOpen }: { team: string; onOpen?: () => void }) => {
  const tick = useFinanceTick();
  const f = useMemo(() => getTeamFinance(team), [team, tick]);
  if (!f || f.health === "ok") return null;
  const text = f.health === "low" ? "Budżet organizacji się kurczy"
    : f.health === "negative" ? "Kasa organizacji jest na minusie"
    : "Organizacja jest grubo pod kreską";
  return (
    <button type="button" onClick={onOpen}
      className={cn("w-full mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-mono text-left", HEALTH_CLASS[f.health])}>
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-0">{text}: <b>{money(f.balance)}</b></span>
    </button>
  );
};

const TeamFinancePanel = ({ team, onDisbanded }: { team: string; onDisbanded?: () => void }) => {
  const tick = useFinanceTick();
  const f = useMemo(() => getTeamFinance(team), [team, tick]);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [startBal, setStartBal] = useState("");
  const [running, setRunning] = useState("");
  const [staff, setStaff] = useState("");

  useEffect(() => {
    if (!f) return;
    setStartBal(String(f.startingBalance));
    setRunning(String(f.monthlyRunning));
    setStaff(String(f.monthlyStaff));
  }, [f?.startingBalance, f?.monthlyRunning, f?.monthlyStaff]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!f) return <p className="text-sm text-muted-foreground">Brak danych finansowych.</p>;

  const add = (sign: 1 | -1) => {
    const v = Math.abs(parseInt(amount.replace(/[^\d]/g, ""), 10) || 0);
    if (!v) return;
    addManualEntry({ team, amount: sign * v, label: label.trim() || (sign > 0 ? "Dofinansowanie od CEO" : "Wydatek") });
    setAmount(""); setLabel("");
  };
  const saveSettings = () => {
    updateFinanceSettings(team, {
      startingBalance: Math.max(0, parseInt(startBal, 10) || 0),
      monthlyRunning: Math.max(0, parseInt(running, 10) || 0),
      monthlyStaff: Math.max(0, parseInt(staff, 10) || 0),
    });
  };

  const order = ["start", "prize", "transfer_in", "manual_in", "salary", "bonus", "transfer_out", "running", "staff", "manual_out"] as const;
  const ledger = showAll ? f.ledger : f.ledger.slice(0, 25);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className={cn("rounded-xl border p-3", HEALTH_CLASS[f.health])}>
          <p className="text-[10px] uppercase font-mono opacity-80">Saldo</p>
          <p className="text-xl font-heading font-black">{money(f.balance)}</p>
          <p className="text-[10px] font-mono">{HEALTH_LABEL[f.health]}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-3">
          <p className="text-[10px] uppercase font-mono text-muted-foreground">Przychody</p>
          <p className="text-lg font-heading font-bold text-emerald-400">{money(f.income)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-3">
          <p className="text-[10px] uppercase font-mono text-muted-foreground">Koszty</p>
          <p className="text-lg font-heading font-bold text-destructive">{money(-f.expenses)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card/60 p-3">
          <p className="text-[10px] uppercase font-mono text-muted-foreground">Wydatki / mies.</p>
          <p className="text-lg font-heading font-bold">{money(f.monthlyBurn)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <h4 className="font-heading font-bold text-sm mb-2 flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> Rozbicie</h4>
          <ul className="space-y-1 text-xs font-mono">
            {order.filter(c => f.byCategory[c]).map(c => (
              <li key={c} className="flex justify-between gap-2">
                <span className="text-muted-foreground">{CATEGORY_LABEL[c]}</span>
                <span className={(f.byCategory[c] || 0) >= 0 ? "text-emerald-400" : "text-destructive"}>{money(f.byCategory[c] || 0)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-card/60 p-4 space-y-3">
          <h4 className="font-heading font-bold text-sm">Dodaj operację</h4>
          <Input placeholder="Opis (np. CEO dofinansował zespół)" value={label} onChange={e => setLabel(e.target.value)} />
          <Input inputMode="numeric" placeholder="Kwota USD" value={amount} onChange={e => setAmount(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => add(1)}><Plus className="w-4 h-4" /> Wpływ</Button>
            <Button size="sm" variant="secondary" className="flex-1" onClick={() => add(-1)}>Wydatek</Button>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
            <label className="text-[10px] font-mono text-muted-foreground">Budżet startowy
              <Input inputMode="numeric" value={startBal} onChange={e => setStartBal(e.target.value)} onBlur={saveSettings} />
            </label>
            <label className="text-[10px] font-mono text-muted-foreground">Koszty bieżące / mies.
              <Input inputMode="numeric" value={running} onChange={e => setRunning(e.target.value)} onBlur={saveSettings} />
            </label>
            <label className="text-[10px] font-mono text-muted-foreground col-span-2">Personel / mies. (sztab, analitycy, fizjo, media)
              <Input inputMode="numeric" value={staff} onChange={e => setStaff(e.target.value)} onBlur={saveSettings} />
            </label>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4">
        <h4 className="font-heading font-bold text-sm mb-2">Historia operacji ({f.ledger.length})</h4>
        <ul className="divide-y divide-border/50">
          {ledger.map(e => (
            <li key={e.id} className="flex items-center gap-2 py-1.5 text-xs font-mono">
              <span className="text-muted-foreground w-20 shrink-0">{e.date}</span>
              <span className="flex-1 min-w-0 truncate">{e.label}</span>
              <span className={e.amount >= 0 ? "text-emerald-400" : "text-destructive"}>{money(e.amount)}</span>
              {e.manual && (
                <button onClick={() => removeManualEntry(e.id)} className="text-muted-foreground hover:text-destructive" aria-label="Usuń wpis">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
        {f.ledger.length > 25 && (
          <button onClick={() => setShowAll(s => !s)} className="mt-2 text-xs text-primary font-mono">
            {showAll ? "Pokaż mniej" : "Pokaż wszystkie"}
          </button>
        )}
      </div>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" size="sm"><Skull className="w-4 h-4" /> Ogłoś bankructwo</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bankructwo {team}?</AlertDialogTitle>
            <AlertDialogDescription>
              Drużyna zostanie rozwiązana, gracze trafią na listę wolnych agentów, a historia zostanie w archiwum.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const r = disbandTeam(team, { reason: "Bankructwo" }); if (r.ok) onDisbanded?.(); }}>
              Ogłoś bankructwo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamFinancePanel;
