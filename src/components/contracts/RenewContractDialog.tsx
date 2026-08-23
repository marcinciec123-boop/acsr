import { useEffect, useState } from "react";
import { FileSignature } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  addMonthsIso, formatDatePl, formatSalary, renewContract, suggestSalary,
  type PlayerContract,
} from "@/lib/contracts";
import { getWorldNowIso } from "@/lib/worldClock";

interface Props {
  contract?: PlayerContract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenewed?: () => void;
}

const DURATIONS = [6, 12, 18, 24, 36];

/** Modal negocjacji nowych warunków przy przedłużeniu kontraktu. */
const RenewContractDialog = ({ contract, open, onOpenChange, onRenewed }: Props) => {
  const [months, setMonths] = useState(12);
  const [salary, setSalary] = useState(0);
  const [buyout, setBuyout] = useState("");
  const [bonus, setBonus] = useState("");
  const [note, setNote] = useState("");
  const [startDate, setStartDate] = useState(getWorldNowIso().slice(0, 10));

  useEffect(() => {
    if (!open || !contract) return;
    setMonths(12);
    setSalary(Math.round(contract.salary * 1.1 / 100) * 100);
    setBuyout(contract.terms?.buyout ? String(contract.terms.buyout) : "");
    setBonus("");
    setNote(contract.terms?.note || "");
    setStartDate(getWorldNowIso().slice(0, 10));
  }, [open, contract]);

  if (!contract) return null;

  const startIso = new Date(`${startDate}T12:00:00`).toISOString();
  const endIso = addMonthsIso(startIso, months);
  const market = suggestSalary(contract.player, contract.team, "renew");

  const submit = () => {
    const res = renewContract(contract.player, {
      months,
      salary,
      startDate: startIso,
      terms: {
        buyout: buyout ? Number(buyout) : undefined,
        signingBonus: bonus ? Number(bonus) : undefined,
        note: note.trim() || undefined,
      },
    });
    if (!res.ok) {
      toast({ title: "Nie udało się odnowić kontraktu", description: res.error, variant: "destructive" });
      return;
    }
    toast({
      title: "Kontrakt odnowiony",
      description: `${contract.player} • ${formatSalary(salary)}/mies. do ${formatDatePl(endIso)}`,
    });
    onOpenChange(false);
    onRenewed?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="w-4 h-4 text-primary" /> Odnów kontrakt — {contract.player}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="rounded border border-border bg-secondary/30 p-3 text-xs font-mono text-muted-foreground space-y-1">
            <div className="flex justify-between"><span>Drużyna</span><span className="text-foreground">{contract.team}</span></div>
            <div className="flex justify-between"><span>Obecna pensja</span><span className="text-foreground">{formatSalary(contract.salary)}/mies.</span></div>
            <div className="flex justify-between"><span>Obecny koniec</span><span className="text-foreground">{formatDatePl(contract.endDate)}</span></div>
            <div className="flex justify-between"><span>Wycena rynkowa</span><span className="text-primary">{formatSalary(market)}/mies.</span></div>
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider block mb-1">Długość kontraktu</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {DURATIONS.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setMonths(d)}
                  className={`px-2 py-1 rounded border text-xs font-mono transition-colors ${
                    months === d ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d} mies.
                </button>
              ))}
            </div>
            <Input
              type="number"
              min={1}
              max={60}
              value={months || ""}
              onChange={e => setMonths(Number(e.target.value))}
              className="h-9 font-mono"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider block mb-1">Pensja / mies. (USD)</label>
              <Input type="number" value={salary || ""} onChange={e => setSalary(Number(e.target.value))} className="h-9 font-mono" />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider block mb-1">Start</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 font-mono" />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider block mb-1">Buyout (USD)</label>
              <Input type="number" value={buyout} onChange={e => setBuyout(e.target.value)} placeholder="opcjonalnie" className="h-9 font-mono" />
            </div>
            <div>
              <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider block mb-1">Bonus za podpis</label>
              <Input type="number" value={bonus} onChange={e => setBonus(e.target.value)} placeholder="opcjonalnie" className="h-9 font-mono" />
            </div>
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-muted-foreground tracking-wider block mb-1">Dodatkowe warunki</label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="np. klauzula wyjścia po sezonie" className="h-9" />
          </div>

          <div className="rounded border border-primary/30 bg-primary/5 p-3 text-xs font-mono flex justify-between">
            <span className="text-muted-foreground">Nowy koniec kontraktu</span>
            <span className="text-primary font-bold">{formatDatePl(endIso)}</span>
          </div>

          <Button className="w-full" onClick={submit} disabled={!months || !salary}>
            <FileSignature className="w-4 h-4 mr-2" /> Zatwierdź nowe warunki
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RenewContractDialog;
