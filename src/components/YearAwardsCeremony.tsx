// Year-end ceremony ("Złota Piłka CS") — auto-triggers when the world
// clock reaches Dec 31 of any year that hasn't had a ceremony yet.
// Admin mode allows manual override / approval of winners per category.

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Star, Zap, Crown, Sparkles, Flame, X, ChevronRight, Users, Target, ArrowRightLeft, Award, Lock, Unlock, Check } from "lucide-react";
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
      const iso = getWorldDate();
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
  const [awards, setAwards] = useState<YearAwards | null>(null);
  const [adminMode, setAdminMode] = useState(false);
  const [replayTick, setReplayTick] = useState(0);

  useEffect(() => {
    if (activeYear == null) { setAwards(null); return; }
    const history = loadYearAwardsHistory();
    const cached = history[String(activeYear)];
    if (cached && forceYear != null) { setAwards(cached); return; }
    const fresh = computeYearAwards(activeYear);
    saveYearAwards(fresh);
    setAwards(fresh);
  }, [activeYear, forceYear, replayTick]);

  useEffect(() => { setStep(0); setDismissed(false); setAdminMode(false); }, [activeYear, replayTick]);

  if (activeYear == null || !awards || dismissed) return null;

  const update = (patch: Partial<YearAwards>) => setAwards(a => (a ? { ...a, ...patch } : a));

  const slides = buildSlides(awards, adminMode, update);
  const current = slides[step];
  const isLast = step === slides.length - 1;

  const close = () => {
    if (awards) saveYearAwards(awards);
    setDismissed(true);
    if (forceYear == null) markYearShown(activeYear);
    onClose?.();
  };

  const replay = () => { setStep(0); setReplayTick(t => t + 1); };

  const next = () => {
    if (isLast) close();
    else setStep(s => s + 1);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4"
      >
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
          className="relative w-full max-w-2xl max-h-[95vh] flex flex-col bg-gradient-to-br from-card via-card to-background border border-primary/40 rounded-xl sm:rounded-2xl shadow-2xl shadow-primary/20 overflow-hidden"
        >
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 flex items-center gap-1">
            <button
              onClick={() => setAdminMode(v => !v)}
              className={cn(
                "px-2 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1 border transition-colors",
                adminMode
                  ? "bg-primary/25 border-primary/60 text-primary"
                  : "bg-secondary/60 border-border text-muted-foreground hover:text-foreground",
              )}
              title="Tryb admina — ręczna edycja zwycięzców"
            >
              {adminMode ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              <span className="hidden sm:inline">Admin</span>
            </button>
            <button
              onClick={close}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
              title="Zamknij i zapisz"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-border bg-gradient-to-r from-primary/15 to-transparent flex items-center gap-2 pr-24 sm:pr-28">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-mono uppercase tracking-widest text-primary font-black truncate">
              Złota Piłka CS · {awards.year}
            </span>
            <span className="ml-auto text-xs font-mono text-muted-foreground shrink-0">
              {step + 1}/{slides.length}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-4 sm:py-8 flex flex-col">
            {current}
          </div>

          <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-t border-border flex items-center justify-between gap-2 bg-background/40">
            <div className="flex gap-1 flex-wrap flex-1 min-w-0">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  className={cn(
                    "h-1 rounded-full transition-all",
                    i === step ? "w-6 bg-primary" : i < step ? "w-3 bg-primary/50" : "w-3 bg-border",
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={replay}
                className="px-2.5 py-2 rounded-md bg-secondary/60 border border-border text-muted-foreground hover:text-foreground text-xs font-mono font-black uppercase tracking-wider"
                title="Odtwórz ceremonię od początku"
              >
                ↻
              </button>
              <button
                onClick={next}
                className="px-3 sm:px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-mono font-black uppercase tracking-wider hover:bg-primary/90 flex items-center gap-1"
              >
                {isLast ? (adminMode ? (<><Check className="w-3.5 h-3.5" />Zapisz</>) : "Zamknij") : "Dalej"}
                {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
              </button>
            </div>
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

const AwardHead = ({ icon, kicker, title, admin, onTitleChange }: {
  icon: React.ReactNode; kicker: string; title: string;
  admin?: boolean; onTitleChange?: (v: string) => void;
}) => (
  <div className="mb-6 text-center">
    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-xs font-mono uppercase tracking-widest text-primary mb-3">
      {icon}
      {kicker}
    </div>
    {admin && onTitleChange ? (
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        className="text-2xl font-heading font-black text-foreground text-center bg-secondary/50 border border-primary/40 rounded-md px-3 py-1 w-full max-w-md mx-auto focus:outline-none focus:border-primary"
      />
    ) : (
      <h2 className="text-2xl font-heading font-black text-foreground">{title}</h2>
    )}
  </div>
);

const AdminField = ({ label, value, onChange, wide }: { label: string; value: string; onChange: (v: string) => void; wide?: boolean }) => (
  <label className="block text-left">
    <span className="text-xs font-mono uppercase text-muted-foreground">{label}</span>
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "mt-1 w-full bg-secondary/50 border border-border rounded-md px-2 py-1 text-sm font-mono text-foreground focus:outline-none focus:border-primary",
        wide && "col-span-2",
      )}
    />
  </label>
);

const AdminNumberField = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <label className="block text-left">
    <span className="text-xs font-mono uppercase text-muted-foreground">{label}</span>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="mt-1 w-full bg-secondary/50 border border-border rounded-md px-2 py-1 text-sm font-mono text-foreground focus:outline-none focus:border-primary"
    />
  </label>
);

function buildSlides(a: YearAwards, admin: boolean, update: (patch: Partial<YearAwards>) => void): React.ReactNode[] {
  const slides: React.ReactNode[] = [];

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
      {admin && (
        <div className="mt-6 text-xs font-mono text-primary/80 bg-primary/10 border border-primary/30 rounded-md px-3 py-2 max-w-md">
          Tryb admina włączony — możesz edytować zwycięzców w każdej kategorii. Zmiany zapiszą się po zamknięciu.
        </div>
      )}
    </div>,
  );

  if (a.teamTop5 && a.teamTop5.length > 0) {
    slides.push(<TopTeamsReveal awards={a} admin={admin} update={update} />);
  }

  if (a.playerTop20 && a.playerTop20.length > 0) {
    slides.push(<TopPlayersReveal awards={a} admin={admin} update={update} />);
  }

  const simpleSlide = (
    key: keyof YearAwards,
    icon: React.ReactNode,
    kicker: string,
    obj: { player?: string; team?: string; coach?: string } | undefined,
    valueLabel: string,
    valueText: string,
    playerKey: "player" | "coach",
  ) => {
    if (!obj) return;
    const displayName = (obj as Record<string, string>)[playerKey] || "";
    slides.push(
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <AwardHead
          icon={icon}
          kicker={kicker}
          title={displayName}
          admin={admin}
          onTitleChange={(v) => update({ [key]: { ...obj, [playerKey]: v } } as Partial<YearAwards>)}
        />
        {admin ? (
          <input
            value={obj.team || ""}
            onChange={(e) => update({ [key]: { ...obj, team: e.target.value } } as Partial<YearAwards>)}
            className="mb-6 bg-secondary/50 border border-border rounded px-2 py-0.5 text-xs font-mono text-center focus:outline-none focus:border-primary"
          />
        ) : (
          <div className="text-xs font-mono text-muted-foreground mb-6">{obj.team}</div>
        )}
        {bigNumber(valueText)}
        <div className="text-xs font-mono uppercase text-muted-foreground mt-1">{valueLabel}</div>
      </div>,
    );
  };

  simpleSlide("rookieOfYear", <Zap className="w-3 h-3" />, "Odkrycie Roku", a.rookieOfYear,
    `rating · ${a.rookieOfYear?.matches ?? 0} meczów`, (a.rookieOfYear?.rating ?? 0).toFixed(2), "player");
  simpleSlide("topFragger", <Flame className="w-3 h-3" />, "Top Fragger", a.topFragger,
    `zabójstw · K/D ${(a.topFragger?.kdr ?? 0).toFixed(2)}`, (a.topFragger?.kills ?? 0).toLocaleString(), "player");
  if (a.mvpKing) simpleSlide("mvpKing", <Award className="w-3 h-3" />, "Król MVP", a.mvpKing as any,
    "tytułów MVP turnieju", String(a.mvpKing.mvps), "player");
  simpleSlide("coachOfYear", <Users className="w-3 h-3" />, "Trener Roku", a.coachOfYear as any,
    "trofeów w sezonie", String(a.coachOfYear?.trophies ?? 0), "coach");

  if (a.tournamentOfYear) {
    const t = a.tournamentOfYear;
    slides.push(
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <AwardHead
          icon={<Target className="w-3 h-3" />}
          kicker="Turniej Roku"
          title={t.name}
          admin={admin}
          onTitleChange={(v) => update({ tournamentOfYear: { ...t, name: v } })}
        />
        <div className="flex items-center justify-center gap-3 text-xs font-mono text-muted-foreground mb-6">
          <span className="px-2 py-0.5 rounded bg-primary/15 text-primary font-black">Tier {t.tier}</span>
          <span>{t.prizePool}</span>
          <span>{t.teams} drużyn</span>
        </div>
        <div className="text-xs font-mono uppercase text-muted-foreground">Zwycięzca</div>
        {admin ? (
          <input
            value={t.winner}
            onChange={(e) => update({ tournamentOfYear: { ...t, winner: e.target.value } })}
            className="mt-1 text-2xl font-heading font-black text-primary text-center bg-secondary/50 border border-primary/40 rounded-md px-3 py-1 max-w-sm focus:outline-none focus:border-primary"
          />
        ) : (
          <div className="text-2xl font-heading font-black text-primary mt-1">{t.winner}</div>
        )}
      </div>,
    );
  }

  if (a.transferOfYear) {
    const t = a.transferOfYear;
    slides.push(
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <AwardHead
          icon={<ArrowRightLeft className="w-3 h-3" />}
          kicker="Transfer Roku"
          title={t.player}
          admin={admin}
          onTitleChange={(v) => update({ transferOfYear: { ...t, player: v } })}
        />
        {admin ? (
          <div className="grid grid-cols-2 gap-2 mb-6 max-w-md mx-auto w-full">
            <AdminField label="Stara drużyna" value={t.oldTeam || ""} onChange={(v) => update({ transferOfYear: { ...t, oldTeam: v } })} />
            <AdminField label="Nowa drużyna" value={t.newTeam || ""} onChange={(v) => update({ transferOfYear: { ...t, newTeam: v } })} />
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 text-sm font-mono text-muted-foreground mb-6">
            <span>{t.oldTeam || "—"}</span>
            <ChevronRight className="w-4 h-4 text-primary" />
            <span className="text-foreground font-black">{t.newTeam}</span>
          </div>
        )}
        {bigNumber(t.postRating.toFixed(2))}
        <div className="text-xs font-mono uppercase text-muted-foreground mt-1">
          rating po transferze · {t.postMatches} meczów
        </div>
      </div>,
    );
  }

  slides.push(
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <Sparkles className="w-16 h-16 text-primary mx-auto mb-4 drop-shadow-[0_0_25px_hsl(var(--primary)/0.6)]" />
      <h2 className="text-2xl font-heading font-black text-foreground mb-2">Dziękujemy za sezon {a.year}</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {admin
          ? "Kliknij Zatwierdź, żeby zapisać wyniki edycji dla tego sezonu."
          : "Kolejny rok już się rozpoczyna. Nowe transfery, nowe składy, kolejna walka o Złotą Piłkę CS."}
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

// ===== HLTV-style Top 20 players reveal =====
const TopPlayersReveal = ({ awards, admin, update }: {
  awards: YearAwards; admin: boolean; update: (p: Partial<YearAwards>) => void;
}) => {
  const list = awards.playerTop20 || [];
  const total = list.length;
  // revealed = how many top positions from #total down to #(total - revealed + 1) are visible
  const [revealed, setRevealed] = useState(0);
  const nextRank = total - revealed; // the rank about to be revealed (e.g. 20, 19, ...)
  const done = revealed >= total;

  return (
    <div className="flex-1 flex flex-col">
      <AwardHead icon={<Star className="w-3 h-3" />} kicker={`Top ${total} graczy ${awards.year}`} title="Ranking Roku" />
      <div className="flex-1 overflow-y-auto max-h-[380px] pr-1 space-y-1.5">
        <AnimatePresence initial={false}>
          {list.slice(0, revealed).map((p, i) => {
            const rank = total - i; // reveal order: total, total-1, ...
            const isTop1 = rank === 1;
            const player = list[rank - 1]; // safer: index by rank
            return (
              <motion.div
                key={rank}
                initial={{ opacity: 0, x: -30, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.45, type: "spring" }}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2",
                  isTop1
                    ? "bg-gradient-to-r from-yellow-500/25 via-primary/15 to-transparent border-yellow-400/60 shadow-lg shadow-yellow-500/20"
                    : rank <= 3
                    ? "bg-primary/10 border-primary/40"
                    : "bg-secondary/30 border-border/60",
                )}
              >
                <div className={cn(
                  "w-10 text-center font-heading font-black tabular-nums",
                  isTop1 ? "text-2xl text-yellow-400" : rank <= 3 ? "text-lg text-primary" : "text-sm text-muted-foreground",
                )}>
                  #{rank}
                </div>
                <div className="flex-1 min-w-0">
                  {admin ? (
                    <input
                      value={player.player}
                      onChange={(e) => {
                        const copy = [...list];
                        copy[rank - 1] = { ...player, player: e.target.value };
                        update({ playerTop20: copy, playerOfYear: rank === 1 ? { ...player, player: e.target.value } : awards.playerOfYear });
                      }}
                      className="w-full bg-secondary/50 border border-border rounded px-1.5 py-0.5 text-sm font-heading font-bold focus:outline-none focus:border-primary"
                    />
                  ) : (
                    <div className={cn("truncate", isTop1 ? "text-lg font-heading font-black text-foreground" : "text-sm font-heading font-bold text-foreground")}>
                      {player.player}
                    </div>
                  )}
                  <div className="text-xs font-mono text-muted-foreground truncate">{player.team}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn("font-heading font-black tabular-nums", isTop1 ? "text-2xl text-yellow-400" : "text-base text-primary")}>
                    {player.rating.toFixed(2)}
                  </div>
                  <div className="text-[10px] font-mono uppercase text-muted-foreground">{player.matches} mecz.</div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!done && (
          <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 py-6 text-center">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Następny</div>
            <div className="text-3xl font-heading font-black text-primary">#{nextRank}</div>
          </div>
        )}
      </div>
      <div className="pt-3">
        <button
          onClick={() => setRevealed(r => Math.min(total, r + 1))}
          disabled={done}
          className={cn(
            "w-full px-4 py-2 rounded-md text-xs font-mono font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors",
            done ? "bg-secondary/50 text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {done ? "Ranking ujawniony · przejdź dalej" : `Odkryj #${nextRank}`}
        </button>
      </div>
    </div>
  );
};

// ===== HLTV-style Top 5 teams reveal =====
const TopTeamsReveal = ({ awards, admin, update }: {
  awards: YearAwards; admin: boolean; update: (p: Partial<YearAwards>) => void;
}) => {
  const list = awards.teamTop5 || [];
  const total = list.length;
  const [revealed, setRevealed] = useState(0);
  const nextRank = total - revealed;
  const done = revealed >= total;

  return (
    <div className="flex-1 flex flex-col">
      <AwardHead icon={<Crown className="w-3 h-3" />} kicker={`Top ${total} drużyn ${awards.year}`} title="Drużyny Roku" />
      <div className="flex-1 space-y-2">
        <AnimatePresence initial={false}>
          {Array.from({ length: revealed }).map((_, i) => {
            const rank = total - i;
            const team = list[rank - 1];
            const isTop1 = rank === 1;
            return (
              <motion.div
                key={rank}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, type: "spring" }}
                className={cn(
                  "flex items-center gap-4 rounded-xl border px-4 py-3",
                  isTop1
                    ? "bg-gradient-to-r from-yellow-500/25 via-primary/20 to-transparent border-yellow-400/60 shadow-xl shadow-yellow-500/20"
                    : rank <= 3
                    ? "bg-primary/10 border-primary/40"
                    : "bg-secondary/30 border-border/60",
                )}
              >
                <div className={cn(
                  "w-12 text-center font-heading font-black tabular-nums",
                  isTop1 ? "text-3xl text-yellow-400" : rank <= 3 ? "text-2xl text-primary" : "text-xl text-muted-foreground",
                )}>
                  #{rank}
                </div>
                <div className="flex-1 min-w-0">
                  {admin ? (
                    <input
                      value={team.team}
                      onChange={(e) => {
                        const copy = [...list];
                        copy[rank - 1] = { ...team, team: e.target.value };
                        update({ teamTop5: copy, teamOfYear: rank === 1 ? { ...team, team: e.target.value } : awards.teamOfYear });
                      }}
                      className="w-full bg-secondary/50 border border-border rounded px-2 py-1 text-lg font-heading font-black focus:outline-none focus:border-primary"
                    />
                  ) : (
                    <div className={cn("truncate font-heading font-black", isTop1 ? "text-2xl text-foreground" : "text-lg text-foreground")}>
                      {team.team}
                    </div>
                  )}
                  <div className="text-xs font-mono text-muted-foreground">
                    {team.trophies}🏆 · {team.finals} finałów · {team.top3} top3
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!done && (
          <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 py-8 text-center">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Następna</div>
            <div className="text-4xl font-heading font-black text-primary">#{nextRank}</div>
          </div>
        )}
      </div>
      <div className="pt-4">
        <button
          onClick={() => setRevealed(r => Math.min(total, r + 1))}
          disabled={done}
          className={cn(
            "w-full px-4 py-2 rounded-md text-xs font-mono font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-colors",
            done ? "bg-secondary/50 text-muted-foreground cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          {done ? "Wszystkie drużyny odkryte · dalej" : `Odkryj #${nextRank}`}
        </button>
      </div>
    </div>
  );
};

export default YearAwardsCeremony;
