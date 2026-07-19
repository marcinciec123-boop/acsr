// Year-end ceremony ("Złota Piłka CS") — auto-triggers when the world
// clock reaches Dec 31 of any year that hasn't had a ceremony yet.

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Zap, Crown, Sparkles, Flame, X, ChevronRight, Users, Target, ArrowRightLeft, Award } from "lucide-react";
import {
  computeYearAwards,
  getShownYears,
  loadYearAwardsHistory,
  markYearShown,
  saveYearAwards,
  type YearAwards,
} from "@/lib/yearAwards";
import { getWorldDate, WORLD_CLOCK_EVENT } from "@/lib/worldClock";
import { cn } from "@/lib/utils";

interface Props {
  /** Manual re-open — pass a year to view its cached ceremony. */
  forceYear?: number | null;
  onClose?: () => void;
}

const useTriggerYear = (forceYear?: number | null): number | null => {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    if (forceYear != null) { setYear(forceYear); return; }

    const check = () => {
      const iso = getWorldDate(); // YYYY-MM-DD
      const [y, m, d] = iso.split("-").map(Number);
      if (m === 12 && d === 31) {
        const shown = new Set(getShownYears());
        if (!shown.has(y)) setYear(y);
      }
    };
    check();
    window.addEventListener(WORLD_CLOCK_EVENT, check);
    return () => window.removeEventListener(WORLD_CLOCK_EVENT, check);
  }, [forceYear]);

  return year;
};

const YearAwardsCeremony = ({ forceYear, onClose }: Props) => {
  const activeYear = useTriggerYear(forceYear);
  const [step, setStep] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const awards: YearAwards | null = useMemo(() => {
    if (activeYear == null) return null;
    const history = loadYearAwardsHistory();
    const cached = history[String(activeYear)];
    if (cached && forceYear != null) return cached;
    // Compute fresh on trigger (so awards reflect latest data)
    const fresh = computeYearAwards(activeYear);
    saveYearAwards(fresh);
    return fresh;
  }, [activeYear, forceYear]);

  useEffect(() => { setStep(0); setDismissed(false); }, [activeYear]);

  if (activeYear == null || !awards || dismissed) return null;

  const slides = buildSlides(awards);
  const current = slides[step];
  const isLast = step === slides.length - 1;

  const close = () => {
    setDismissed(true);
    if (forceYear == null) markYearShown(activeYear);
    onClose?.();
  };

  const next = () => {
    if (isLast) close();
    else setStep(s => s + 1);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
      >
        {/* Ambient particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-primary/70"
              initial={{ x: `${Math.random() * 100}%`, y: `${Math.random() * 100}%`, opacity: 0 }}
              animate={{ opacity: [0, 1, 0], y: [`${Math.random() * 100}%`, `${Math.random() * 100 - 20}%`] }}
              transition={{ duration: 4 + Math.random() * 4, repeat: Infinity, delay: Math.random() * 4 }}
            />
          ))}
        </div>

        <motion.div
          key={step}
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={{ duration: 0.4 }}
          className="relative w-full max-w-2xl bg-gradient-to-br from-card via-card to-background border border-primary/40 rounded-2xl shadow-2xl shadow-primary/20 overflow-hidden"
        >
          <button
            onClick={close}
            className="absolute top-3 right-3 z-10 p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
            title="Zamknij"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="px-6 py-3 border-b border-border bg-gradient-to-r from-primary/15 to-transparent flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono uppercase tracking-widest text-primary font-black">
              Złota Piłka CS · Podsumowanie {awards.year}
            </span>
            <span className="ml-auto text-xs font-mono text-muted-foreground">
              {step + 1} / {slides.length}
            </span>
          </div>

          <div className="px-6 py-8 min-h-[360px] flex flex-col">
            {current}
          </div>

          <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-background/40">
            <div className="flex gap-1">
              {slides.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-1 rounded-full transition-all",
                    i === step ? "w-6 bg-primary" : i < step ? "w-3 bg-primary/50" : "w-3 bg-border",
                  )}
                />
              ))}
            </div>
            <button
              onClick={next}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-mono font-black uppercase tracking-wider hover:bg-primary/90 flex items-center gap-1"
            >
              {isLast ? "Zamknij ceremonię" : "Dalej"}
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ----- Slide builders -----

const bigNumber = (n: number | string) => (
  <div className="text-4xl font-heading font-black text-primary tabular-nums">{n}</div>
);

const AwardHead = ({ icon, kicker, title }: { icon: React.ReactNode; kicker: string; title: string }) => (
  <div className="mb-6 text-center">
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-mono uppercase tracking-widest text-primary mb-3">
      {icon}
      {kicker}
    </div>
    <h2 className="text-2xl font-heading font-black text-foreground">{title}</h2>
  </div>
);

function buildSlides(a: YearAwards): React.ReactNode[] {
  const slides: React.ReactNode[] = [];

  // Intro
  slides.push(
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}>
        <Trophy className="w-20 h-20 text-primary mx-auto mb-4 drop-shadow-[0_0_25px_hsl(var(--primary)/0.6)]" />
      </motion.div>
      <h1 className="text-4xl font-heading font-black text-foreground mb-2">Sezon {a.year} zakończony</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        Nadszedł czas na podsumowanie roku i rozdanie nagród dla najlepszych drużyn, graczy i trenerów sceny CS.
      </p>
      <div className="mt-8 flex gap-6 text-center">
        <div>
          <div className="text-2xl font-heading font-black text-primary tabular-nums">{a.totalTournaments}</div>
          <div className="text-xs font-mono uppercase text-muted-foreground">turniejów</div>
        </div>
        <div className="w-px bg-border" />
        <div>
          <div className="text-2xl font-heading font-black text-primary tabular-nums">{a.totalMatches}</div>
          <div className="text-xs font-mono uppercase text-muted-foreground">meczów</div>
        </div>
      </div>
    </div>,
  );

  // Team of the Year
  if (a.teamOfYear) {
    slides.push(
      <div className="flex-1 flex flex-col">
        <AwardHead icon={<Crown className="w-3 h-3" />} kicker="Drużyna Roku" title={a.teamOfYear.team} />
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatBox label="Trofea" value={a.teamOfYear.trophies} />
          <StatBox label="Finały" value={a.teamOfYear.finals} />
          <StatBox label="Top 3" value={a.teamOfYear.top3} />
        </div>
        <div className="mt-auto">
          <div className="text-xs font-mono uppercase text-muted-foreground mb-2">Podium roku</div>
          {a.teamTop3.map((t, i) => (
            <div key={t.team} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <div className={cn("w-6 text-center font-heading font-black", i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : "text-orange-400")}>
                {i + 1}
              </div>
              <div className="flex-1 text-sm font-mono">{t.team}</div>
              <div className="text-xs font-mono text-muted-foreground">{t.trophies}🏆 · {t.top3} top3</div>
            </div>
          ))}
        </div>
      </div>,
    );
  }

  // Player of the Year
  if (a.playerOfYear) {
    slides.push(
      <div className="flex-1 flex flex-col">
        <AwardHead icon={<Star className="w-3 h-3" />} kicker="Gracz Roku · MVP" title={a.playerOfYear.player} />
        <div className="text-center text-xs font-mono text-muted-foreground mb-4">
          {a.playerOfYear.team}
        </div>
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatBox label="Rating" value={a.playerOfYear.rating.toFixed(2)} />
          <StatBox label="Mecze" value={a.playerOfYear.matches} />
          <StatBox label="K/D" value={a.playerOfYear.kdr.toFixed(2)} />
          <StatBox label="ADR" value={a.playerOfYear.adr} />
        </div>
        <div className="mt-auto">
          <div className="text-xs font-mono uppercase text-muted-foreground mb-2">Top 5 rankingu</div>
          {a.playerTop5.map((p, i) => (
            <div key={p.player} className="flex items-center gap-3 py-1.5 text-sm">
              <div className={cn("w-6 text-center font-heading font-black text-xs", i === 0 ? "text-yellow-400" : "text-muted-foreground")}>
                #{i + 1}
              </div>
              <div className="flex-1 font-mono">{p.player}</div>
              <div className="text-xs font-mono text-muted-foreground">{p.team}</div>
              <div className="w-14 text-right font-heading font-black text-primary tabular-nums">{p.rating.toFixed(2)}</div>
            </div>
          ))}
        </div>
      </div>,
    );
  }

  if (a.rookieOfYear) {
    slides.push(
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <AwardHead icon={<Zap className="w-3 h-3" />} kicker="Odkrycie Roku" title={a.rookieOfYear.player} />
        <div className="text-xs font-mono text-muted-foreground mb-6">{a.rookieOfYear.team}</div>
        {bigNumber(a.rookieOfYear.rating.toFixed(2))}
        <div className="text-xs font-mono uppercase text-muted-foreground mt-1">
          rating · {a.rookieOfYear.matches} meczów
        </div>
        <p className="mt-6 text-xs text-muted-foreground max-w-sm">
          Debiutant sezonu z najwyższym ratingiem przy ograniczonej liczbie meczów.
        </p>
      </div>,
    );
  }

  if (a.topFragger) {
    slides.push(
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <AwardHead icon={<Flame className="w-3 h-3" />} kicker="Top Fragger" title={a.topFragger.player} />
        <div className="text-xs font-mono text-muted-foreground mb-6">{a.topFragger.team}</div>
        {bigNumber(a.topFragger.kills.toLocaleString())}
        <div className="text-xs font-mono uppercase text-muted-foreground mt-1">
          zabójstw w sezonie · K/D {a.topFragger.kdr.toFixed(2)}
        </div>
      </div>,
    );
  }

  if (a.mvpKing) {
    slides.push(
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <AwardHead icon={<Award className="w-3 h-3" />} kicker="Król MVP" title={a.mvpKing.player} />
        <div className="text-xs font-mono text-muted-foreground mb-6">{a.mvpKing.team}</div>
        {bigNumber(a.mvpKing.mvps)}
        <div className="text-xs font-mono uppercase text-muted-foreground mt-1">
          tytułów MVP turnieju
        </div>
      </div>,
    );
  }

  if (a.coachOfYear) {
    slides.push(
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <AwardHead icon={<Users className="w-3 h-3" />} kicker="Trener Roku" title={a.coachOfYear.coach} />
        <div className="text-xs font-mono text-muted-foreground mb-6">{a.coachOfYear.team}</div>
        {bigNumber(a.coachOfYear.trophies)}
        <div className="text-xs font-mono uppercase text-muted-foreground mt-1">
          trofeów w sezonie
        </div>
      </div>,
    );
  }

  if (a.tournamentOfYear) {
    slides.push(
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <AwardHead icon={<Target className="w-3 h-3" />} kicker="Turniej Roku" title={a.tournamentOfYear.name} />
        <div className="flex items-center justify-center gap-3 text-xs font-mono text-muted-foreground mb-6">
          <span className="px-2 py-0.5 rounded bg-primary/15 text-primary font-black">Tier {a.tournamentOfYear.tier}</span>
          <span>{a.tournamentOfYear.prizePool}</span>
          <span>{a.tournamentOfYear.teams} drużyn</span>
        </div>
        <div className="text-xs font-mono uppercase text-muted-foreground">Zwycięzca</div>
        <div className="text-2xl font-heading font-black text-primary mt-1">{a.tournamentOfYear.winner}</div>
      </div>,
    );
  }

  if (a.transferOfYear) {
    slides.push(
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <AwardHead icon={<ArrowRightLeft className="w-3 h-3" />} kicker="Transfer Roku" title={a.transferOfYear.player} />
        <div className="flex items-center justify-center gap-3 text-sm font-mono text-muted-foreground mb-6">
          <span>{a.transferOfYear.oldTeam || "—"}</span>
          <ChevronRight className="w-4 h-4 text-primary" />
          <span className="text-foreground font-black">{a.transferOfYear.newTeam}</span>
        </div>
        {bigNumber(a.transferOfYear.postRating.toFixed(2))}
        <div className="text-xs font-mono uppercase text-muted-foreground mt-1">
          rating po transferze · {a.transferOfYear.postMatches} meczów
        </div>
      </div>,
    );
  }

  // Outro
  slides.push(
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <Sparkles className="w-16 h-16 text-primary mx-auto mb-4 drop-shadow-[0_0_25px_hsl(var(--primary)/0.6)]" />
      <h2 className="text-2xl font-heading font-black text-foreground mb-2">Dziękujemy za sezon {a.year}</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Kolejny rok już się rozpoczyna. Nowe transfery, nowe składy, kolejna walka o Złotą Piłkę CS.
      </p>
    </div>,
  );

  return slides;
}

const StatBox = ({ label, value }: { label: string; value: number | string }) => (
  <div className="rounded-lg border border-border bg-secondary/30 py-3 text-center">
    <div className="text-2xl font-heading font-black text-primary tabular-nums">{value}</div>
    <div className="text-xs font-mono uppercase text-muted-foreground mt-1">{label}</div>
  </div>
);

export default YearAwardsCeremony;
