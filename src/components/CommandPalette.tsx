import { useEffect, useState, useMemo } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Newspaper, Trophy, Users, ArrowRightLeft, User, HardDrive, Settings, Shield, UserCircle2, XCircle,
} from "lucide-react";
import type { Tab } from "@/components/NavBar";
import { teamDatabase } from "@/data/tournaments";
import { disbands as staticDisbands } from "@/data/history";
import { loadFromStorage } from "@/lib/storage";
import { loadExtraDisbands } from "@/lib/teamManagement";
import type { TeamData } from "@/lib/types";

interface Props {
  onTabChange: (tab: Tab) => void;
  onSelectTeam: (name: string) => void;
  onSelectPlayer: (name: string) => void;
}

const tabItems: { id: Tab; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: "news", label: "Aktualności", icon: <Newspaper className="w-4 h-4" />, hint: "G N" },
  { id: "rankings", label: "Ranking", icon: <Users className="w-4 h-4" />, hint: "G R" },
  { id: "players", label: "Gracze", icon: <User className="w-4 h-4" />, hint: "G P" },
  { id: "tournaments", label: "Turnieje", icon: <Trophy className="w-4 h-4" />, hint: "G T" },
  { id: "transfers", label: "Transfery", icon: <ArrowRightLeft className="w-4 h-4" />, hint: "G F" },
  { id: "backup", label: "Zapis", icon: <HardDrive className="w-4 h-4" />, hint: "G B" },
  { id: "settings", label: "Ustawienia", icon: <Settings className="w-4 h-4" />, hint: "G S" },
];

const CommandPalette = ({ onTabChange, onSelectTeam, onSelectPlayer }: Props) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const { teams, players, disbanded } = useMemo(() => {
    const teamSrc = loadFromStorage<TeamData[] | null>("ranking_data", null) || teamDatabase;
    const sorted = [...teamSrc].sort((a, b) => (b.points || 0) - (a.points || 0));
    const playerSet = new Set<string>();
    teamSrc.forEach(t => (t.roster || []).forEach(p => playerSet.add(p)));
    const activeNames = new Set(teamSrc.map(t => t.name.toLowerCase()));
    const disbandedSet = new Map<string, string>();
    loadExtraDisbands().forEach(d => disbandedSet.set(d.team.toLowerCase(), d.team));
    staticDisbands.forEach(d => disbandedSet.set(d.team.toLowerCase(), d.team));
    const disbanded = Array.from(disbandedSet.values())
      .filter(name => !activeNames.has(name.toLowerCase()))
      .sort();
    return { teams: sorted, players: Array.from(playerSet).sort(), disbanded };
  }, [open]);

  const run = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 0);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Szukaj zakładki, drużyny lub gracza... (⌘K)" />
      <CommandList>
        <CommandEmpty>Brak wyników.</CommandEmpty>
        <CommandGroup heading="Nawigacja">
          {tabItems.map(t => (
            <CommandItem key={t.id} value={`tab ${t.label}`} onSelect={() => run(() => onTabChange(t.id))}>
              {t.icon}
              <span className="ml-2">{t.label}</span>
              <span className="ml-auto text-xs text-muted-foreground font-mono">{t.hint}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Drużyny">
          {teams.slice(0, 30).map((t, i) => (
            <CommandItem key={t.name} value={`team ${t.name}`} onSelect={() => run(() => onSelectTeam(t.name))}>
              <Shield className="w-4 h-4 text-primary" />
              <span className="ml-2">{t.name}</span>
              <span className="ml-auto text-xs text-muted-foreground font-mono">#{i + 1}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Gracze">
          {players.slice(0, 40).map(p => (
            <CommandItem key={p} value={`player ${p}`} onSelect={() => run(() => onSelectPlayer(p))}>
              <UserCircle2 className="w-4 h-4 text-accent" />
              <span className="ml-2">{p}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
};

export default CommandPalette;
