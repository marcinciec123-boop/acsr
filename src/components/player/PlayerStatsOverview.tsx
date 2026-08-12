// ===== HLTV-style overview statystyk gracza =====
// Górny pas z ratingiem i metrykami jakościowymi (POOR / OKAY / GOOD / GREAT)
// oraz tabela "Statistics" w dwóch kolumnach.
// Metryki poza ratingiem są RELATYWNE — liczone na tle graczy mających klub.

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CareerStats } from "@/lib/playerCareerStats";
import { getRatingColor } from "@/lib/playerStats";
import { formatMoney } from "@/lib/prizeDistribution";
import type { EarningsSummary } from "@/lib/statsPortal";
import { getBenchmarks, percentileOf, type BenchmarkKey } from "@/lib/playerBenchmarks";

type Quality = "poor" | "okay" | "good" | "great";

const QUALITY_LABEL: Record<Quality, string> = {
  poor: "POOR", okay: "OKAY", good: "GOOD", great: "GREAT",
};

const QUALITY_BAR: Record<Quality, string> = {
  poor: "bg-[hsl(var(--loss))]",
  okay: "bg-[hsl(var(--gold))]",
  good: "bg-[hsl(var(--win))]",
  great: "bg-primary",
};

const QUALITY_TEXT: Record<Quality, string> = {
  poor: "text-[hsl(var(--loss))]",
  okay: "text-[hsl(var(--gold))]",
  good: "text-[hsl(var(--win))]",
  great: "text-primary",
};

/** Percentyl → ocena jakościowa (relatywnie do reszty ligi). */
const qualityOf = (pct: number): Quality =>
  pct < 25 ? "poor" : pct < 50 ? "okay" : pct < 80 ? "good" : "great";

/** Rating ma stałe progi i nie zależy od średniej pozostałych graczy. */
const ratingQualityOf = (rating: number): Quality =>
  rating <= 0.95 ? "poor" : rating <= 1.04 ? "okay" : rating <= 1.15 ? "good" : "great";

const Metric = ({
  label, value, pct, avg,
}: { label: string; value: string; pct: number; avg: string }) => {
  const quality = qualityOf(pct);
  return (
    <div className="flex-1 min-w-[110px] px-3 py-2">
      <div className="flex items-baseline justify-center gap-1.5">
        <span className="text-2xl font-heading font-bold tabular-nums text-foreground">{value}</span>
      </div>
      <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground text-center mt-0.5">
        {label}
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-secondary/70 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", QUALITY_BAR[quality])}
          style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
        />
      </div>
      <p className={cn("text-2xs font-mono text-center mt-1", QUALITY_TEXT[quality])}>
        {QUALITY_LABEL[quality]}
      </p>
      <p className="text-2xs font-mono text-center text-muted-foreground/70">śr. {avg}</p>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 last:border-0 odd:bg-secondary/20">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="text-sm font-mono font-semibold tabular-nums text-foreground">{value}</span>
  </div>
);

interface Props {
  career: CareerStats;
  earnings: EarningsSummary;
}

const PlayerStatsOverview = ({ career, earnings }: Props) => {
  const rounds = career.totalRounds || 0;
  const udr = rounds ? career.totalUd / rounds : 0;
  const efr = rounds ? career.totalEf / rounds : 0;

  const bench = useMemo(() => getBenchmarks(), [career.player]);
  const pct = useMemo(() => {
    const p = (k: BenchmarkKey, v: number, lowerBetter = false) => percentileOf(k, v, lowerBetter);
    return {
      dpr: p("dpr", career.dpr, true),
      kpr: p("kpr", career.kpr),
      kast: p("kast", career.avgKast),
      adr: p("adr", career.avgAdr),
      udr: p("udr", udr),
    };
  }, [career.careerRating, career.dpr, career.kpr, career.avgKast, career.avgAdr, udr]);

  const ratingQ = ratingQualityOf(career.careerRating);

  return (
    <div className="space-y-4 mb-6">
      {/* === Pas ratingowy === */}
      <div className="rounded-xl border border-border bg-gradient-to-br from-card via-card to-secondary/30 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center">
          <div className="md:w-52 shrink-0 p-5 text-center border-b md:border-b-0 md:border-r border-border/60 bg-secondary/20">
            <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground">Rating 3.0</p>
            <p className={cn("text-5xl font-heading font-black tabular-nums leading-none mt-1", getRatingColor(career.careerRating))}>
              {career.careerRating > 0 ? career.careerRating.toFixed(2) : "—"}
            </p>
            <p className={cn("text-xs font-mono mt-1", QUALITY_TEXT[ratingQ])}>
              {QUALITY_LABEL[ratingQ]}
            </p>
            <p className="text-2xs font-mono text-muted-foreground mt-2">
              {career.mapsPlayed} map • {career.matchesPlayed} meczów
            </p>
            <p className="text-2xs font-mono text-muted-foreground/70">stałe progi oceny ratingu</p>
          </div>
          <div className="flex flex-wrap flex-1 divide-x divide-border/40 py-2">
            <Metric label="DPR" value={career.dpr.toFixed(2)} pct={pct.dpr} avg={bench.avg.dpr.toFixed(2)} />
            <Metric label="KPR" value={career.kpr.toFixed(2)} pct={pct.kpr} avg={bench.avg.kpr.toFixed(2)} />
            <Metric label="KAST" value={`${career.avgKast}%`} pct={pct.kast} avg={`${bench.avg.kast.toFixed(1)}%`} />
            <Metric label="ADR" value={career.avgAdr.toFixed(0)} pct={pct.adr} avg={bench.avg.adr.toFixed(0)} />
            <Metric label="UD / runda" value={udr.toFixed(1)} pct={pct.udr} avg={bench.avg.udr.toFixed(1)} />
          </div>
        </div>
      </div>


      {/* === Statistics === */}
      <div>
        <h2 className="text-sm font-heading font-bold text-foreground mb-2">Statystyki</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <div className="rounded-lg border border-border bg-card/60 overflow-hidden">
            <Row label="Zabójstwa łącznie" value={career.totalKills.toLocaleString()} />
            <Row label="Śmierci łącznie" value={career.totalDeaths.toLocaleString()} />
            <Row label="Asysty łącznie" value={career.totalAssists.toLocaleString()} />
            <Row label="K/D Ratio" value={career.kdRatio.toFixed(2)} />
            <Row label="Damage / runda" value={career.avgAdr.toFixed(1)} />
            <Row label="Rozegrane mapy" value={career.mapsPlayed.toLocaleString()} />
            <Row label="Bilans W-L" value={`${career.wins}-${career.losses}`} />
          </div>
          <div className="rounded-lg border border-border bg-card/60 overflow-hidden">
            <Row label="Rozegrane rundy" value={rounds.toLocaleString()} />
            <Row label="Zabójstwa / runda" value={career.kpr.toFixed(2)} />
            <Row label="Asysty / runda" value={career.apr.toFixed(2)} />
            <Row label="Śmierci / runda" value={career.dpr.toFixed(2)} />
            <Row label="KAST%" value={`${career.avgKast}%`} />
            <Row label="Utility dmg / runda" value={udr.toFixed(1)} />
            <Row label="Oślepieni / runda" value={efr.toFixed(2)} />
          </div>
        </div>
      </div>

      {/* === Zarobki === */}
      <div className="rounded-lg border border-[hsl(var(--gold))]/40 bg-gradient-to-r from-[hsl(var(--gold))]/10 to-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-2xs font-mono uppercase tracking-widest text-muted-foreground">Zarobki (kariera)</p>
          <p className="text-2xl font-heading font-black tabular-nums text-[hsl(var(--gold))]">
            {earnings.earnings > 0 ? formatMoney(earnings.earnings) : "—"}
          </p>
        </div>
        <div className="flex gap-4 text-xs font-mono text-muted-foreground">
          <span>Turnieje: <b className="text-foreground">{earnings.events}</b></span>
          <span>Tytuły: <b className="text-foreground">{earnings.gold}</b></span>
          {earnings.rank && <span>Miejsce: <b className="text-foreground">#{earnings.rank}</b></span>}
        </div>
      </div>
    </div>
  );
};

export default memo(PlayerStatsOverview);
