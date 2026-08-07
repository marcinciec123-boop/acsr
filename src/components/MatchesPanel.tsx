// ===== Panel Mecze =====
// Zestawienie nadchodzących meczów (najbliższe 3 dni) oraz rozegranych
// (ostatni tydzień), pogrupowane po turniejach. Wszystko liczone względem
// fikcyjnego kalendarza (worldClock).

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarClock, Swords, History, Trophy, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MatchResult, TournamentData } from "@/lib/types";
import { loadFromStorage } from "@/lib/storage";
import { isPlaceholder } from "@/lib/teamHelpers";
import { getDisplayScore } from "@/lib/matchDisplay";
import { getWorldNow, useWorldDate } from "@/lib/worldClock";
import TeamLogo from "@/components/TeamLogo";
import { TeamLink, TournamentLink } from "@/lib/profileNav";
import PanelHeader from "@/components/PanelHeader";
import { usePersistedState } from "@/lib/uiPrefs";

interface Row {
  tournamentId: string;
  tournamentName: string;
  tier: string;
  location?: string;
  phaseName: string;
  groupName?: string;
  match: MatchResult;
  /** ISO datetime used for sorting / filtering */
  when?: string;
}

const isPlayed = (m: MatchResult) =>
  !!m.resultConfirmed || (m.score1 || 0) + (m.score2 || 0) > 0;

const collect = (tournaments: TournamentData[]): Row[] => {
  const out: Row[] = [];
  tournaments.forEach(t => {
    (t.phases || []).forEach(p => {
      const push = (m: MatchResult, groupName?: string) => {
        if (isPlaceholder(m.team1) || isPlaceholder(m.team2)) return;
        out.push({
          tournamentId: t.id,
          tournamentName: t.name,
          tier: t.tier,
          location: t.location,
          phaseName: p.name,
          groupName,
          match: m,
          when: isPlayed(m) ? (m.playedAt || m.scheduledAt) : m.scheduledAt,
        });
      };
      (p.bracket || []).forEach(m => push(m));
      (p.groups || []).forEach(g => g.matches.forEach(m => push(m, g.name)));
    });
  });
  return out;
};

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("pl-PL", { weekday: "long", day: "numeric", month: "long" });

/** Godzina rozegrania: preferuj ręcznie ustawiony termin, potem znacznik meczu. */
const timeSource = (m: MatchResult) => m.scheduledAt || m.playedAt;

const fmtTime = (iso?: string) => {
  if (!iso || iso.length <= 10) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso.slice(11, 16);
  return d.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
};


const TIER_COLOR: Record<string, string> = {
  S: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  A: "bg-primary/15 text-primary border-primary/40",
  B: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  C: "bg-muted text-muted-foreground border-border",
};

const MatchesPanel = () => {
  const worldDate = useWorldDate();
  const [mode, setMode] = usePersistedState<"upcoming" | "results">("matches_panel_mode", "upcoming");
  const [tournaments, setTournaments] = useState<TournamentData[]>(
    () => loadFromStorage<TournamentData[]>("tournaments_data", []),
  );

  useEffect(() => {
    const refresh = () => setTournaments(loadFromStorage<TournamentData[]>("tournaments_data", []));
    window.addEventListener("tournaments:update", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("tournaments:update", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const { upcoming, results, noDate } = useMemo(() => {
    const rows = collect(tournaments);
    const now = getWorldNow();
    const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
    const in3 = new Date(dayStart); in3.setDate(in3.getDate() + 4); // dziś + 3 pełne dni
    const weekAgo = new Date(dayStart); weekAgo.setDate(weekAgo.getDate() - 7);

    const up: Row[] = [];
    const res: Row[] = [];
    const nd: Row[] = [];

    rows.forEach(r => {
      const played = isPlayed(r.match);
      if (!r.when) {
        if (!played) nd.push(r);
        return;
      }
      const ts = new Date(r.when).getTime();
      if (played) {
        if (ts >= weekAgo.getTime() && ts <= in3.getTime()) res.push(r);
      } else if (ts >= weekAgo.getTime() && ts < in3.getTime()) {
        up.push(r);
      }
    });

    up.sort((a, b) => (a.when || "").localeCompare(b.when || ""));
    res.sort((a, b) => (b.when || "").localeCompare(a.when || ""));
    return { upcoming: up, results: res, noDate: nd };
  }, [tournaments, worldDate]);

  const active = mode === "upcoming" ? upcoming : results;

  // Grupowanie: dzień → turniej
  const grouped = useMemo(() => {
    const byDay = new Map<string, Map<string, Row[]>>();
    active.forEach(r => {
      const day = (r.when || "").slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, new Map());
      const byT = byDay.get(day)!;
      const key = r.tournamentId;
      if (!byT.has(key)) byT.set(key, []);
      byT.get(key)!.push(r);
    });
    return Array.from(byDay.entries());
  }, [active]);

  return (
    <section className="py-6">
      <div className="container mx-auto px-4 max-w-4xl">
        <PanelHeader
          icon={Swords}
          title="Mecze"
          meta={`Nadchodzące: ${upcoming.length} · Ostatni tydzień: ${results.length}`}
        />

        {/* Przełącznik */}
        <div className="inline-flex rounded-lg border border-border bg-secondary/30 p-1 mb-5">
          <button
            onClick={() => setMode("upcoming")}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              mode === "upcoming" ? "bg-primary/15 text-primary border border-primary/40" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CalendarClock className="w-4 h-4" /> Nadchodzące (3 dni)
          </button>
          <button
            onClick={() => setMode("results")}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              mode === "results" ? "bg-primary/15 text-primary border border-primary/40" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <History className="w-4 h-4" /> Rezultaty (7 dni)
          </button>
        </div>

        {grouped.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Swords className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-mono text-sm">
              {mode === "upcoming"
                ? "Brak zaplanowanych meczów w najbliższych 3 dniach."
                : "Brak rozegranych meczów w ostatnim tygodniu."}
            </p>
          </div>
        )}

        <div className="space-y-6">
          {grouped.map(([day, byTournament], di) => (
            <motion.div
              key={day}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(di * 0.05, 0.25) }}
            >
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-heading font-bold text-foreground text-sm uppercase tracking-wider">
                  {day ? fmtDay(day) : "Bez terminu"}
                </h3>
                {day === worldDate && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/40">
                    dziś
                  </span>
                )}
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="space-y-3">
                {Array.from(byTournament.entries()).map(([tid, rows]) => {
                  const head = rows[0];
                  return (
                    <div key={tid} className="bg-card border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 bg-secondary/20 flex-wrap">
                        <Trophy className="w-3.5 h-3.5 text-primary shrink-0" />
                        <TournamentLink
                          tournamentId={tid}
                          className="text-sm font-heading font-bold text-foreground"
                        >
                          {head.tournamentName}
                        </TournamentLink>
                        <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded border", TIER_COLOR[head.tier] || TIER_COLOR.C)}>
                          Tier {head.tier}
                        </span>
                        {head.location && (
                          <span className="text-xs font-mono text-muted-foreground inline-flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {head.location}
                          </span>
                        )}
                        <span className="ml-auto text-xs font-mono text-muted-foreground">
                          {rows.length} {rows.length === 1 ? "mecz" : "meczów"}
                        </span>
                      </div>

                      <div className="divide-y divide-border/40">
                        {rows.map(r => {
                          const m = r.match;
                          const [s1, s2] = getDisplayScore(m);
                          const played = isPlayed(m);
                          const win1 = played && s1 > s2;
                          const win2 = played && s2 > s1;
                          return (
                            <TournamentLink
                              key={`${tid}-${m.id}`}
                              tournamentId={tid}
                              matchId={m.id}
                              className="block px-3 py-2 hover:bg-secondary/30 transition-colors"
                              title="Otwórz mecz"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-muted-foreground w-11 shrink-0">
                                  {fmtTime(timeSource(m)) }
                                </span>
                                <span className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                                  <TeamLink
                                    name={m.team1}
                                    className={cn("text-sm truncate", win1 ? "font-bold text-foreground" : "text-muted-foreground")}
                                  />
                                  <TeamLogo teamName={m.team1} size={20} rounded="md" />
                                </span>
                                <span className="text-sm font-mono font-bold shrink-0 px-2">
                                  {played ? (
                                    <>
                                      <span className={win1 ? "text-emerald-400" : win2 ? "text-red-400" : "text-foreground"}>{s1}</span>
                                      <span className="text-muted-foreground"> : </span>
                                      <span className={win2 ? "text-emerald-400" : win1 ? "text-red-400" : "text-foreground"}>{s2}</span>
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">vs</span>
                                  )}
                                </span>

                                <span className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <TeamLogo teamName={m.team2} size={20} rounded="md" />
                                  <TeamLink
                                    name={m.team2}
                                    className={cn("text-sm truncate", win2 ? "font-bold text-foreground" : "text-muted-foreground")}
                                  />
                                </span>
                              </div>
                              <div className="mt-1 text-xs font-mono text-muted-foreground truncate">
                                {r.groupName || r.phaseName}
                                {m.round ? ` • ${m.round}` : ""} • Bo{m.bo || 1}
                                {played && (m.maps?.length || 0) > 0 && (
                                  <span className="ml-1 opacity-80">
                                    ({m.maps!.map(mp => `${mp.map} ${mp.score1}:${mp.score2}`).join(", ")})
                                  </span>
                                )}
                              </div>
                            </TournamentLink>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>

        {mode === "upcoming" && noDate.length > 0 && (
          <p className="mt-6 text-xs font-mono text-muted-foreground">
            {noDate.length} meczów bez ustawionego terminu — ustaw daty w panelu turnieju, żeby pojawiły się tutaj.
          </p>
        )}
      </div>
    </section>
  );
};

export default MatchesPanel;
