import { useMemo } from "react";
import { motion } from "framer-motion";
import { Flame, Skull, Map as MapIcon, Crosshair } from "lucide-react";
import TeamLogo from "@/components/TeamLogo";
import { PlayerLink, TeamLink } from "@/lib/profileNav";
import { computeStreaks } from "@/lib/hotStreaks";
import { countryFlag } from "@/lib/flags";
import { resolvePlayerCountry } from "@/lib/playerCountry";
import { cn } from "@/lib/utils";

const Row = ({
  index,
  icon,
  main,
  sub,
  value,
  tone,
}: {
  index: number;
  icon: React.ReactNode;
  main: React.ReactNode;
  sub?: string;
  value: string;
  tone: "hot" | "cold";
}) => (
  <motion.div
    initial={{ opacity: 0, x: -8 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.03 }}
    className="flex items-center gap-2 px-3 py-2 border-b border-border/40 last:border-0 hover:bg-primary/5"
  >
    <span className="text-xs">{tone === "hot" ? "🔥" : "💀"}</span>
    {icon}
    <div className="min-w-0 flex-1">
      <div className="truncate text-sm font-semibold text-foreground">{main}</div>
      {sub && <div className="text-2xs font-mono text-muted-foreground truncate">{sub}</div>}
    </div>
    <span
      className={cn(
        "font-mono text-sm font-bold whitespace-nowrap",
        tone === "hot" ? "text-primary" : "text-destructive",
      )}
    >
      {value}
    </span>
  </motion.div>
);

const Block = ({
  title,
  icon: Icon,
  tone = "hot",
  children,
  empty,
}: {
  title: string;
  icon: typeof Flame;
  tone?: "hot" | "cold";
  children: React.ReactNode;
  empty: boolean;
}) => (
  <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 border-b border-border/60 font-mono text-xs uppercase tracking-wide",
        tone === "hot" ? "text-primary bg-primary/5" : "text-destructive bg-destructive/5",
      )}
    >
      <Icon className="w-4 h-4" /> {title}
    </div>
    {empty ? (
      <div className="p-5 text-center text-xs text-muted-foreground">Brak aktywnych serii.</div>
    ) : (
      children
    )}
  </div>
);

const HotStreaksPanel = () => {
  const s = useMemo(() => computeStreaks(), []);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="Current streaks — zwycięstwa" icon={Flame} empty={s.winStreaks.length === 0}>
          {s.winStreaks.map((t, i) => (
            <Row
              key={t.team}
              index={i}
              tone="hot"
              icon={<TeamLogo teamName={t.team} size={20} />}
              main={<TeamLink name={t.team} className="hover:text-primary" />}
              sub={t.lastDate ? `ostatni mecz ${t.lastDate}` : undefined}
              value={`${t.count} wins`}
            />
          ))}
        </Block>

        <Block title="Losing streaks" icon={Skull} tone="cold" empty={s.lossStreaks.length === 0}>
          {s.lossStreaks.map((t, i) => (
            <Row
              key={t.team}
              index={i}
              tone="cold"
              icon={<TeamLogo teamName={t.team} size={20} />}
              main={<TeamLink name={t.team} className="hover:text-primary" />}
              sub={t.lastDate ? `ostatni mecz ${t.lastDate}` : undefined}
              value={`${t.count} losses`}
            />
          ))}
        </Block>

        <Block title="Serie graczy (rating 1.20+)" icon={Crosshair} empty={s.playerStreaks.length === 0}>
          {s.playerStreaks.map((p, i) => (
            <Row
              key={p.player}
              index={i}
              tone="hot"
              icon={<span className="text-sm">{countryFlag(resolvePlayerCountry(p.player))}</span>}
              main={<PlayerLink name={p.player} className="hover:text-primary" />}
              sub={p.team}
              value={`${p.count} map${p.count === 1 ? "a" : ""} 1.20+`}
            />
          ))}
        </Block>

        <Block title="Serie na mapach" icon={MapIcon} empty={s.mapStreaks.length === 0}>
          {s.mapStreaks.map((m, i) => (
            <Row
              key={`${m.team}-${m.map}`}
              index={i}
              tone="hot"
              icon={<TeamLogo teamName={m.team} size={20} />}
              main={<TeamLink name={m.team} className="hover:text-primary" />}
              sub={`${m.map}${m.lastDate ? ` · ${m.lastDate}` : ""}`}
              value={`${m.count}× ${m.map}`}
            />
          ))}
        </Block>
      </div>
    </div>
  );
};

export default HotStreaksPanel;
