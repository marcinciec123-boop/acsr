import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Trophy, Medal, DollarSign, Users, Gamepad2, Crown, Flame } from "lucide-react";
import PanelHeader from "@/components/PanelHeader";
import TeamLogo from "@/components/TeamLogo";
import MajorBadge from "@/components/MajorBadge";
import { PlayerLink, TeamLink, useProfileNav } from "@/lib/profileNav";
import { computePortalStats, type Tier } from "@/lib/statsPortal";
import { formatMoney } from "@/lib/prizeDistribution";
import { resolvePlayerCountry } from "@/lib/playerCountry";
import { countryFlag } from "@/lib/flags";
import { cn } from "@/lib/utils";

const tierColor: Record<Tier, string> = {
  S: "text-primary border-primary/40 bg-primary/10",
  A: "text-accent border-accent/40 bg-accent/10",
  B: "text-foreground border-border bg-muted/40",
  C: "text-muted-foreground border-border bg-muted/20",
};

const Card = ({ icon: Icon, label, value, sub }: { icon: typeof Trophy; label: string; value: string; sub?: string }) => (
  <div className="rounded-xl border border-border/60 bg-card/60 p-4 relative overflow-hidden">
    <div className="absolute -top-8 -right-8 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
    <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono uppercase tracking-wide">
      <Icon className="w-4 h-4 text-primary" /> {label}
    </div>
    <div className="mt-2 text-2xl font-heading font-bold text-foreground">{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
  </div>
);

const Section = ({ title, icon: Icon, children }: { title: string; icon: typeof Trophy; children: React.ReactNode }) => (
  <section className="mb-8">
    <h3 className="flex items-center gap-2 text-lg font-heading font-bold text-foreground mb-3">
      <Icon className="w-5 h-5 text-primary" /> {title}
    </h3>
    {children}
  </section>
);

const StatisticsPanel = () => {
  const [year, setYear] = useState<string | "total">("total");
  const [orgLimit, setOrgLimit] = useState(15);
  const [playerLimit, setPlayerLimit] = useState(15);
  const nav = useProfileNav();

  const stats = useMemo(() => computePortalStats(year), [year]);
  const tabs = useMemo(() => ["total", ...stats.years], [stats.years]);

  const prizeTotal = Math.max(1, stats.lanPrize + stats.onlinePrize);
  const lanPct = (stats.lanPrize / prizeTotal) * 100;

  const maxOrg = stats.orgs[0]?.earnings || 1;

  return (
    <div className="container mx-auto px-4 py-6">
      <PanelHeader
        icon={BarChart3}
        title="Statystyki"
        meta="Pule nagród, zarobki organizacji i graczy, medale i największe turnieje"
        chips={
          <span className="text-xs font-mono px-2 py-0.5 rounded border border-primary/40 text-primary bg-primary/10">
            {year === "total" ? "CAŁA HISTORIA" : year}
          </span>
        }
      />

      {/* Year tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setYear(t as string)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-mono border transition-colors",
              year === t
                ? "border-primary/50 bg-primary/15 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/30",
            )}
          >
            {t === "total" ? "Total" : t}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Card icon={DollarSign} label="Pula nagród" value={formatMoney(stats.totalPrize)} sub={`${stats.tournamentCount} turniejów`} />
        <Card icon={Trophy} label="Majory" value={String(stats.majorCount)} sub="turnieje rangi Major" />
        <Card icon={Gamepad2} label="Mecze / mapy" value={`${stats.matchCount} / ${stats.mapCount}`} sub="rozegrane" />
        <Card icon={Users} label="Organizacje" value={String(stats.orgs.length)} sub={`${stats.players.length} graczy z zarobkami`} />
      </div>

      {/* Tier distribution */}
      <Section title="Turnieje wg tieru" icon={Medal}>
        <div className="rounded-xl border border-border/60 bg-card/60 overflow-hidden">
          <div className="grid grid-cols-5 divide-x divide-border/60">
            {(["S", "A", "B", "C"] as Tier[]).map(t => (
              <div key={t} className="p-3 text-center">
                <div className={cn("inline-block px-2 py-0.5 rounded border text-xs font-mono mb-1", tierColor[t])}>{t}-Tier</div>
                <div className="text-xl font-heading font-bold text-foreground">{stats.tierCounts[t] || 0}</div>
              </div>
            ))}
            <div className="p-3 text-center">
              <div className="inline-block px-2 py-0.5 rounded border border-primary/40 bg-primary/10 text-primary text-xs font-mono mb-1">Total</div>
              <div className="text-xl font-heading font-bold text-primary">{stats.tournamentCount}</div>
            </div>
          </div>
        </div>
      </Section>

      {/* LAN vs Online */}
      <Section title="Rozkład nagród: LAN vs Online" icon={DollarSign}>
        <div className="rounded-xl border border-border/60 bg-card/60 p-4">
          <div className="h-3 w-full rounded-full overflow-hidden bg-muted/40 flex">
            <motion.div initial={{ width: 0 }} animate={{ width: `${lanPct}%` }} className="bg-primary" />
            <motion.div initial={{ width: 0 }} animate={{ width: `${100 - lanPct}%` }} className="bg-accent" />
          </div>
          <div className="flex justify-between mt-2 text-xs font-mono">
            <span className="text-primary">LAN {formatMoney(stats.lanPrize)}</span>
            <span className="text-accent">Online {formatMoney(stats.onlinePrize)}</span>
          </div>
        </div>
      </Section>

      {/* Organizations */}
      <Section title="Zarobki wg organizacji" icon={Trophy}>
        <div className="rounded-xl border border-border/60 bg-card/60 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-mono uppercase text-muted-foreground border-b border-border/60">
                <th className="text-left p-2 w-10">#</th>
                <th className="text-left p-2">Organizacja</th>
                <th className="text-center p-2">🥇</th>
                <th className="text-center p-2">🥈</th>
                <th className="text-center p-2">🥉</th>
                <th className="text-right p-2">Zarobki</th>
              </tr>
            </thead>
            <tbody>
              {stats.orgs.slice(0, orgLimit).map((o, i) => (
                <tr key={o.team} className="border-b border-border/40 last:border-0 hover:bg-primary/5">
                  <td className="p-2 font-mono text-muted-foreground">{i + 1}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <TeamLogo teamName={o.team} size={22} />
                      <TeamLink name={o.team} className="font-semibold text-foreground truncate" />
                      {o.titles.some(t => t.major) && <MajorBadge compact />}
                    </div>
                    <div className="relative h-1 mt-1 rounded-full bg-muted/40 overflow-hidden max-w-[220px]">
                      <div className="absolute inset-y-0 left-0 bg-primary/60" style={{ width: `${(o.earnings / maxOrg) * 100}%` }} />
                    </div>
                  </td>
                  <td className="p-2 text-center font-mono">{o.gold || "—"}</td>
                  <td className="p-2 text-center font-mono">{o.silver || "—"}</td>
                  <td className="p-2 text-center font-mono">{o.bronze || "—"}</td>
                  <td className="p-2 text-right font-mono text-primary">{formatMoney(o.earnings)}</td>
                </tr>
              ))}
              {stats.orgs.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-muted-foreground text-sm">Brak danych za ten okres.</td></tr>
              )}
            </tbody>
          </table>
          {stats.orgs.length > orgLimit && (
            <button onClick={() => setOrgLimit(l => l + 25)} className="w-full py-2 text-xs font-mono text-muted-foreground hover:text-primary border-t border-border/60">
              Pokaż więcej
            </button>
          )}
        </div>
      </Section>

      {/* Players */}
      <Section title="Zarobki wg graczy" icon={Users}>
        <div className="rounded-xl border border-border/60 bg-card/60 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-mono uppercase text-muted-foreground border-b border-border/60">
                <th className="text-left p-2 w-10">#</th>
                <th className="text-left p-2">Gracz</th>
                <th className="text-center p-2">Tytuły</th>
                <th className="text-center p-2">Turnieje</th>
                <th className="text-right p-2">Zarobki</th>
              </tr>
            </thead>
            <tbody>
              {stats.players.slice(0, playerLimit).map((p, i) => (
                <tr key={p.player} className="border-b border-border/40 last:border-0 hover:bg-primary/5">
                  <td className="p-2 font-mono text-muted-foreground">{i + 1}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span>{countryFlag(resolvePlayerCountry(p.player))}</span>
                      <PlayerLink name={p.player} className="font-semibold text-foreground truncate" />
                      <span className="text-xs text-muted-foreground truncate hidden sm:inline">{p.teams[p.teams.length - 1]}</span>
                    </div>
                  </td>
                  <td className="p-2 text-center font-mono">{p.gold || "—"}</td>
                  <td className="p-2 text-center font-mono text-muted-foreground">{p.events}</td>
                  <td className="p-2 text-right font-mono text-primary">{formatMoney(p.earnings)}</td>
                </tr>
              ))}
              {stats.players.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground text-sm">Brak danych — dodaj składy turniejowe.</td></tr>
              )}
            </tbody>
          </table>
          {stats.players.length > playerLimit && (
            <button onClick={() => setPlayerLimit(l => l + 25)} className="w-full py-2 text-xs font-mono text-muted-foreground hover:text-primary border-t border-border/60">
              Pokaż więcej
            </button>
          )}
        </div>
      </Section>

      {/* Biggest prize pools */}
      <Section title="Największe pule nagród" icon={Crown}>
        <div className="rounded-xl border border-border/60 bg-card/60 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-mono uppercase text-muted-foreground border-b border-border/60">
                <th className="text-left p-2 w-10">#</th>
                <th className="text-left p-2">Turniej</th>
                <th className="text-left p-2 hidden sm:table-cell">Zwycięzca</th>
                <th className="text-right p-2">Pula</th>
              </tr>
            </thead>
            <tbody>
              {stats.biggestPools.map((t, i) => (
                <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-primary/5">
                  <td className="p-2 font-mono text-muted-foreground">{i + 1}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => nav?.openTournament?.(t.id)}
                        className="font-semibold text-foreground hover:text-primary hover:underline underline-offset-2 text-left"
                      >
                        {t.name}
                      </button>
                      {t.major && <MajorBadge compact />}
                      <span className={cn("px-1.5 py-0.5 rounded border text-2xs font-mono", tierColor[t.tier])}>{t.tier}</span>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{t.startDate} · {t.location}</div>
                  </td>
                  <td className="p-2 hidden sm:table-cell">
                    {t.winner ? (
                      <span className="flex items-center gap-2">
                        <TeamLogo teamName={t.winner} size={20} />
                        <TeamLink name={t.winner} className="text-foreground" />
                      </span>
                    ) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-2 text-right font-mono text-primary">{formatMoney(t.pool)}</td>
                </tr>
              ))}
              {stats.biggestPools.length === 0 && (
                <tr><td colSpan={4} className="p-6 text-center text-muted-foreground text-sm">Brak turniejów z pulą nagród.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
};

export default StatisticsPanel;
