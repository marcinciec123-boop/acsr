// ===== Match Compare Panel =====
// Separate tab on the match detail page (NOT the main scoreboard).
// Contains two HLTV-style modules:
//   1. Player vs Player comparator (rating, K/D, ADR, KAST, multi-kill)
//   2. Bookmaker odds derived from VRS expected-winner probability + map handicap.

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Users, Coins, ArrowLeftRight, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import TeamLogo from "@/components/TeamLogo";
import { resolveLineup } from "@/lib/tournamentLineups";
import { teamDatabase } from "@/data/tournaments";
import { computeCareerStats } from "@/lib/playerCareerStats";
import { getRatingColor } from "@/lib/playerStats";
import { predictBothOutcomes, getRankingSnapshot, getTeamRank } from "@/lib/vrsFormula";
import { resolvePlayerCountry } from "@/lib/playerCountry";
import { countryFlag } from "@/lib/flags";
import { playerRoles, roleColors, roleIcons, type PlayerRole } from "@/data/playerRoles";
import { PlayerLink } from "@/lib/profileNav";

interface Props {
  team1: string;
  team2: string;
  tier: string;
  bo: 1 | 3 | 5;
  tournamentId?: string;
}

const getRoster = (teamName: string, tournamentId?: string): string[] => {
  const lineup = resolveLineup(tournamentId, teamName);
  if (lineup.length > 0) return lineup.slice(0, 5);
  const team = teamDatabase.find(t => t.name === teamName);
  return (team?.roster || []).slice(0, 5);
};

// Decimal-odds from probability with a realistic bookmaker margin (~5% overround).
// Probabilities are shrunk toward 0.5 so extreme mismatches don't blow the price
// into 40+ territory — real CS markets rarely go past ~15-20 on the underdog.
const oddsFromProb = (p: number, opts?: { floor?: number }) => {
  const margin = 1.05;
  const floor = opts?.floor ?? 0.06; // ~15.9 max odds after margin
  const clamped = Math.max(floor, Math.min(1 - floor, p));
  return Math.max(1.02, 1 / (clamped * margin));
};

// Shrink match-winner probability toward 0.5 (markets are far less confident than pure Elo).
const shrinkProb = (p: number, factor = 0.6) => 0.5 + (p - 0.5) * factor;

const fmtOdds = (o: number) => o.toFixed(2);

export const MatchComparePanel = ({ team1, team2, tier, bo, tournamentId }: Props) => {
  const roster1 = useMemo(() => getRoster(team1, tournamentId), [team1, tournamentId]);
  const roster2 = useMemo(() => getRoster(team2, tournamentId), [team2, tournamentId]);

  const [p1, setP1] = useState<string>(roster1[0] || "");
  const [p2, setP2] = useState<string>(roster2[0] || "");

  // Keep selections in sync when lineups change
  const currentP1 = roster1.includes(p1) ? p1 : roster1[0] || "";
  const currentP2 = roster2.includes(p2) ? p2 : roster2[0] || "";

  const stats1 = useMemo(() => currentP1 ? computeCareerStats(currentP1) : null, [currentP1]);
  const stats2 = useMemo(() => currentP2 ? computeCareerStats(currentP2) : null, [currentP2]);

  const ranking = useMemo(() => getRankingSnapshot(), [team1, team2]);
  const rank1 = useMemo(() => getTeamRank(team1, ranking), [team1, ranking]);
  const rank2 = useMemo(() => getTeamRank(team2, ranking), [team2, ranking]);

  const previews = useMemo(() => predictBothOutcomes(team1, team2, tier, ranking), [team1, team2, tier, ranking]);

  // Match-winner odds — use shrunk probabilities for realism.
  const probWin1 = shrinkProb(previews.team1Wins.expectedWinner);
  const probWin2 = 1 - probWin1;
  const odds1 = oddsFromProb(probWin1);
  const odds2 = oddsFromProb(probWin2);

  // Correct-score / handicap odds — per-outcome floor keeps prices in a realistic band.
  const csOdds = (p: number) => oddsFromProb(p, { floor: 0.025 }); // ~38 max
  const correctScores = useMemo(() => {
    const out: { label: string; prob: number; odds: number; favored: "t1" | "t2" }[] = [];
    if (bo === 1) {
      out.push({ label: "1 – 0", prob: probWin1, odds: csOdds(probWin1), favored: "t1" });
      out.push({ label: "0 – 1", prob: probWin2, odds: csOdds(probWin2), favored: "t2" });
      return out;
    }
    if (bo === 3) {
      // 2-0: p^2, 2-1: 2 * p^2 * (1-p), and mirror.
      const p = probWin1;
      const q = probWin2;
      const t1_20 = p * p;
      const t1_21 = 2 * p * p * q;
      const t2_02 = q * q;
      const t2_12 = 2 * q * q * p;
      out.push({ label: "2 – 0", prob: t1_20, odds: csOdds(t1_20), favored: "t1" });
      out.push({ label: "2 – 1", prob: t1_21, odds: csOdds(t1_21), favored: "t1" });
      out.push({ label: "1 – 2", prob: t2_12, odds: csOdds(t2_12), favored: "t2" });
      out.push({ label: "0 – 2", prob: t2_02, odds: csOdds(t2_02), favored: "t2" });
      return out;
    }
    // BO5
    const p = probWin1, q = probWin2;
    // 3-0 = p^3, 3-1 = C(3,1) p^3 q, 3-2 = C(4,2) p^3 q^2
    const t1_30 = Math.pow(p, 3);
    const t1_31 = 3 * Math.pow(p, 3) * q;
    const t1_32 = 6 * Math.pow(p, 3) * q * q;
    const t2_03 = Math.pow(q, 3);
    const t2_13 = 3 * Math.pow(q, 3) * p;
    const t2_23 = 6 * Math.pow(q, 3) * p * p;
    out.push({ label: "3 – 0", prob: t1_30, odds: csOdds(t1_30), favored: "t1" });
    out.push({ label: "3 – 1", prob: t1_31, odds: csOdds(t1_31), favored: "t1" });
    out.push({ label: "3 – 2", prob: t1_32, odds: csOdds(t1_32), favored: "t1" });
    out.push({ label: "2 – 3", prob: t2_23, odds: csOdds(t2_23), favored: "t2" });
    out.push({ label: "1 – 3", prob: t2_13, odds: csOdds(t2_13), favored: "t2" });
    out.push({ label: "0 – 3", prob: t2_03, odds: csOdds(t2_03), favored: "t2" });
    return out;
  }, [probWin1, probWin2, bo]);

  return (
    <div className="space-y-6">
      {/* ===== Player comparator ===== */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-gradient-to-br from-card via-card to-secondary/30 border border-border rounded-xl overflow-hidden shadow-lg"
      >
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[220px] rounded-full bg-primary/20 blur-3xl" />
        </div>

        <div className="relative px-4 py-3 bg-secondary/50 border-b border-border/50 flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-primary">
            Porównanie graczy
          </h3>
          <div className="mx-3 flex-1 h-px bg-gradient-to-r from-primary/40 via-border to-primary/40" />
          <span className="text-xs font-mono text-muted-foreground">
            Statystyki kariery
          </span>
        </div>

        {/* Roster pickers */}
        <div className="relative grid grid-cols-2 gap-px bg-border/50">
          <PlayerPicker team={team1} roster={roster1} selected={currentP1} onSelect={setP1} align="left" />
          <PlayerPicker team={team2} roster={roster2} selected={currentP2} onSelect={setP2} align="right" />
        </div>

        {/* Selected players hero */}
        {stats1 && stats2 && (
          <div className="relative grid grid-cols-[1fr_auto_1fr] items-stretch gap-0 border-b border-border/50 bg-background/30">
            <PlayerHero name={currentP1} team={team1} stats={stats1} align="left" />
            <div className="flex flex-col items-center justify-center px-2 py-4 gap-2 border-x border-border/40 bg-background/40">
              <Swords className="w-5 h-5 text-primary" />
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">vs</span>
            </div>
            <PlayerHero name={currentP2} team={team2} stats={stats2} align="right" />
          </div>
        )}

        {stats1 && stats2 && (
          <div className="relative p-4">
            <CompareRow label="RATING" v1={stats1.careerRating} v2={stats2.careerRating} fmt={v => v.toFixed(2)} higherBetter accent />
            <CompareRow label="K / D" v1={stats1.kdRatio} v2={stats2.kdRatio} fmt={v => v.toFixed(2)} higherBetter />
            <CompareRow label="KPR" v1={stats1.kpr} v2={stats2.kpr} fmt={v => v.toFixed(2)} higherBetter />
            <CompareRow label="DPR" v1={stats1.dpr} v2={stats2.dpr} fmt={v => v.toFixed(2)} higherBetter={false} />
            <CompareRow label="ADR" v1={stats1.avgAdr} v2={stats2.avgAdr} fmt={v => v.toString()} higherBetter />
            <CompareRow label="KAST %" v1={stats1.avgKast} v2={stats2.avgKast} fmt={v => `${v}%`} higherBetter />
            <CompareRow label="MAPY" v1={stats1.mapsPlayed} v2={stats2.mapsPlayed} fmt={v => v.toString()} higherBetter={null} />
            <CompareRow label="MECZE" v1={stats1.matchesPlayed} v2={stats2.matchesPlayed} fmt={v => v.toString()} higherBetter={null} />
            <CompareRow
              label="WIN %"
              v1={stats1.matchesPlayed > 0 ? Math.round((stats1.wins / stats1.matchesPlayed) * 100) : 0}
              v2={stats2.matchesPlayed > 0 ? Math.round((stats2.wins / stats2.matchesPlayed) * 100) : 0}
              fmt={v => `${v}%`}
              higherBetter
            />
          </div>
        )}
      </motion.div>


      {/* ===== Bookmaker odds ===== */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card border border-border rounded-xl overflow-hidden"
      >
        <div className="px-4 py-3 bg-secondary/40 border-b border-border/50 flex items-center gap-2">
          <Coins className="w-4 h-4 text-[hsl(var(--gold))]" />
          <h3 className="text-xs font-heading font-bold uppercase tracking-wider text-[hsl(var(--gold))]">
            Kursy bukmacherskie
          </h3>
          <span className="text-xs font-mono text-muted-foreground ml-auto">
            Tier {tier} • BO{bo} • margin 6%
          </span>
        </div>

        {/* Match winner 1X2 (no draw in CS, so just 1/2) */}
        <div className="p-4 space-y-3">
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Zwycięzca meczu
          </div>
          <div className="grid grid-cols-2 gap-3">
            <OddsCard
              team={team1}
              rank={rank1}
              prob={probWin1}
              odds={odds1}
              favored={probWin1 >= probWin2}
            />
            <OddsCard
              team={team2}
              rank={rank2}
              prob={probWin2}
              odds={odds2}
              favored={probWin2 > probWin1}
            />
          </div>

          {/* Correct score */}
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground pt-2 flex items-center gap-1.5">
            <ArrowLeftRight className="w-3 h-3" /> Dokładny wynik
          </div>
          <div className="grid grid-cols-2 gap-2">
            {correctScores.map(cs => (
              <div
                key={cs.label}
                className={cn(
                  "flex items-center justify-between gap-2 px-3 py-2 rounded-md border text-xs font-mono",
                  cs.favored === "t1"
                    ? "bg-primary/5 border-primary/20"
                    : "bg-destructive/5 border-destructive/20",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <TeamLogo teamName={cs.favored === "t1" ? team1 : team2} size={16} rounded="md" />
                  <span className="truncate">{cs.label}</span>
                </div>
                <span className="font-bold text-foreground tabular-nums">{fmtOdds(cs.odds)}</span>
              </div>
            ))}
          </div>

          <p className="text-xs font-mono text-muted-foreground/70 pt-1">
            Kursy generowane na podstawie różnicy w rankingu VRS. To nie są prawdziwe kursy bukmacherskie.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// ----- subcomponents -----

const PlayerPicker = ({
  team, roster, selected, onSelect, align,
}: {
  team: string; roster: string[]; selected: string;
  onSelect: (n: string) => void; align: "left" | "right";
}) => {
  return (
    <div className={cn("p-3 bg-card/60 backdrop-blur-sm space-y-2", align === "right" ? "text-right" : "text-left")}>
      <div className={cn("flex items-center gap-2", align === "right" && "flex-row-reverse")}>
        <TeamLogo teamName={team} size={22} rounded="md" />
        <span className="text-xs font-bold truncate">{team}</span>
      </div>
      <div className={cn("flex flex-wrap gap-1.5", align === "right" && "justify-end")}>
        {roster.map(name => {
          const country = resolvePlayerCountry(name);
          const flag = country ? countryFlag(country) : "";
          const isSelected = name === selected;
          const role = playerRoles[name] as PlayerRole | undefined;
          return (
            <button
              key={name}
              onClick={() => onSelect(name)}
              title={role ? `${role}` : undefined}
              className={cn(
                "group px-2 py-1 rounded text-xs font-mono border transition-all flex items-center gap-1",
                isSelected
                  ? "bg-primary/20 text-primary border-primary/60 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]"
                  : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:border-primary/40",
              )}
            >
              {flag && <span>{flag}</span>}
              <span>{name}</span>
              {role && (
                <span
                  className={cn(
                    "ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-sm text-xs leading-none border",
                    roleColors[role],
                  )}
                >
                  {roleIcons[role]}
                </span>
              )}
            </button>
          );
        })}
        {roster.length === 0 && (
          <span className="text-xs font-mono text-muted-foreground">Brak składu</span>
        )}
      </div>
    </div>
  );
};

// Deterministic gradient per player name (adds a jersey-like visual identity).
const heroGradient = (name: string) => {
  const palettes = [
    "from-indigo-500/40 via-fuchsia-500/25 to-transparent",
    "from-amber-500/40 via-red-500/25 to-transparent",
    "from-emerald-500/40 via-cyan-500/25 to-transparent",
    "from-sky-500/40 via-violet-500/25 to-transparent",
    "from-rose-500/40 via-orange-500/25 to-transparent",
    "from-teal-500/40 via-lime-500/25 to-transparent",
  ];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palettes[h % palettes.length];
};

const PlayerHero = ({
  name, team, stats, align,
}: {
  name: string;
  team: string;
  stats: ReturnType<typeof computeCareerStats>;
  align: "left" | "right";
}) => {
  const role = playerRoles[name] as PlayerRole | undefined;
  const country = resolvePlayerCountry(name);
  const flag = country ? countryFlag(country) : "";
  const initial = (name || "?").charAt(0).toUpperCase();
  const ratingColor = getRatingColor(stats.careerRating);
  const winPct = stats.matchesPlayed > 0 ? Math.round((stats.wins / stats.matchesPlayed) * 100) : 0;

  return (
    <div className={cn(
      "relative overflow-hidden p-4 flex items-center gap-3",
      align === "right" ? "flex-row-reverse text-right" : "text-left",
    )}>
      {/* Gradient backdrop */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-70",
        heroGradient(name),
        align === "right" ? "bg-gradient-to-bl" : "bg-gradient-to-br",
      )} />
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />

      {/* Jersey-style initial */}
      <div className="relative shrink-0 w-16 h-16 rounded-xl border border-border/60 bg-background/60 backdrop-blur-sm flex items-center justify-center shadow-inner">
        <span className="font-heading font-black text-3xl text-foreground/90 leading-none">{initial}</span>
        <TeamLogo teamName={team} size={18} rounded="md" className="absolute -bottom-1.5 -right-1.5 border-2 border-background rounded-md" />
      </div>

      <div className={cn("relative min-w-0 flex-1 space-y-1", align === "right" && "items-end flex flex-col")}>
        <div className={cn("flex items-center gap-1.5", align === "right" && "flex-row-reverse")}>
          {flag && <span className="text-sm leading-none">{flag}</span>}
          <PlayerLink name={name} className="text-base font-heading font-bold text-foreground truncate">
            {name}
          </PlayerLink>
        </div>
        <div className={cn("flex items-center gap-1.5 flex-wrap", align === "right" && "justify-end")}>
          {role ? (
            <span className={cn(
              "inline-flex items-center gap-1 text-xs font-mono font-bold px-1.5 py-0.5 rounded border",
              roleColors[role],
            )}>
              <span>{roleIcons[role]}</span>
              <span>{role}</span>
            </span>
          ) : (
            <span className="text-xs font-mono text-muted-foreground/70 uppercase tracking-wider">Rola nieznana</span>
          )}
          <span className={cn(
            "inline-flex items-center gap-1 text-xs font-mono font-bold px-1.5 py-0.5 rounded border border-border bg-background/60",
            ratingColor,
          )}>
            {stats.careerRating.toFixed(2)} rtg
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            {stats.matchesPlayed}m • {winPct}% W
          </span>
        </div>
      </div>
    </div>
  );
};

const CompareRow = ({
  label, v1, v2, fmt, higherBetter, accent = false,
}: {
  label: string;
  v1: number;
  v2: number;
  fmt: (v: number) => string;
  /** true = higher is better, false = lower is better, null = no winner */
  higherBetter: boolean | null;
  accent?: boolean;
}) => {
  let w1 = false, w2 = false;
  if (higherBetter !== null && v1 !== v2) {
    if (higherBetter) { w1 = v1 > v2; w2 = v2 > v1; }
    else { w1 = v1 < v2; w2 = v2 < v1; }
  }
  // Bar visualization: proportion of each value
  const total = Math.max(v1 + v2, 0.0001);
  const pct1 = Math.max(4, Math.min(96, (v1 / total) * 100));
  return (
    <div className={cn(
      "grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 border-b border-border/30 last:border-0",
      accent && "-mx-4 px-4 bg-primary/[0.03]",
    )}>
      <div className={cn(
        "text-right font-mono tabular-nums",
        accent ? "text-lg" : "text-sm",
        w1 ? "font-bold text-foreground" : "text-muted-foreground",
      )}>
        {fmt(v1)}
      </div>
      <div className="flex flex-col items-center gap-1 min-w-[110px]">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="w-24 h-1 rounded-full bg-border/60 overflow-hidden flex">
          <div
            className={cn("h-full transition-all", w1 ? "bg-primary" : "bg-muted-foreground/50")}
            style={{ width: `${pct1}%` }}
          />
          <div
            className={cn("h-full transition-all", w2 ? "bg-primary" : "bg-muted-foreground/50", "opacity-60")}
            style={{ width: `${100 - pct1}%` }}
          />
        </div>
      </div>
      <div className={cn(
        "text-left font-mono tabular-nums",
        accent ? "text-lg" : "text-sm",
        w2 ? "font-bold text-foreground" : "text-muted-foreground",
      )}>
        {fmt(v2)}
      </div>
    </div>
  );
};

const OddsCard = ({
  team, rank, prob, odds, favored,
}: {
  team: string; rank?: number | null; prob: number; odds: number; favored: boolean;
}) => {
  return (
    <div className={cn(
      "rounded-lg border p-3 space-y-2",
      favored
        ? "bg-[hsl(var(--gold))]/5 border-[hsl(var(--gold))]/40"
        : "bg-secondary/20 border-border",
    )}>
      <div className="flex items-center gap-2 min-w-0">
        <TeamLogo teamName={team} size={24} rounded="md" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold truncate">{team}</div>
          <div className="text-xs font-mono text-muted-foreground">{rank != null ? `#${rank} • ` : ""}{Math.round(prob * 100)}% szans</div>
        </div>
      </div>
      <div className={cn(
        "text-2xl font-mono font-bold tabular-nums text-center py-1 rounded",
        favored ? "text-[hsl(var(--gold))]" : "text-foreground",
      )}>
        {fmtOdds(odds)}
      </div>
    </div>
  );
};
