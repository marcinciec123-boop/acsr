import { isMatchDecided } from "@/lib/matchStatus";
import { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Award, ChevronDown, ChevronUp, Crown, DollarSign, Medal, Minus, Sparkles, Star, TrendingUp, Users } from "lucide-react";
import type { MapPlayerStats, MatchResult, TeamData, TournamentData } from "@/lib/types";
import { teamDatabase } from "@/data/tournaments";
import { resolvePoints } from "@/lib/customPoints";
import { getPreFinalEliminatedOrder } from "@/lib/phaseWinners";
import { TeamLink } from "@/lib/profileNav";
import { formatMoney, parsePrizePool, resolveTournamentPrizes } from "@/lib/prizeDistribution";
import { resolveLineup } from "@/lib/tournamentLineups";
import { freezeRanks, getFrozenRanks } from "@/lib/frozenRanks";
import { loadFromStorage } from "@/lib/storage";
import { countryFlag } from "@/lib/flags";
import { cn } from "@/lib/utils";
import TeamLogo from "@/components/TeamLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  tournament: TournamentData;
  onUpdateTournament?: (patch: Partial<TournamentData>) => void;
}

const isRealTeam = (team?: string) => !!team && team !== "BYE" && team !== "TBD" && !team.startsWith("TBD");

const winnerOf = (m: MatchResult) => {
  if (!isMatchDecided(m)) return "";
  return m.team1 === "BYE" ? m.team2 : m.team2 === "BYE" ? m.team1 : m.score1 > m.score2 ? m.team1 : m.team2;
};

const loserOf = (m: MatchResult) => {
  if (!isRealTeam(m.team1) || !isRealTeam(m.team2) || !isMatchDecided(m)) return "";
  return m.score1 > m.score2 ? m.team2 : m.team1;
};

const derivePlacements = (tournament: TournamentData): TournamentData["placements"] => {
  const out: TournamentData["placements"] = [];
  const placed = new Set<string>();
  const add = (team: string, placement: number) => {
    if (!isRealTeam(team) || placed.has(team)) return;
    out.push({ team, placement, points: resolvePoints(tournament, placement) });
    placed.add(team);
  };

  const finalPhase = tournament.phases[tournament.phases.length - 1];
  const bracket = finalPhase?.bracket || [];
  const rounds = Array.from(new Set(bracket.map(m => m.round || "Match")));
  const finalRound = rounds.find(r => /grand\s*final/i.test(r))
    || rounds.find(r => /^final$/i.test(r))
    || rounds.find(r => /final/i.test(r))
    || rounds[rounds.length - 1];

  bracket
    .filter(m => (m.round || "Match") === finalRound)
    .forEach(m => {
      add(winnerOf(m), 1);
      add(loserOf(m), 2);
    });

  const semiRound = rounds.find(r => /semi/i.test(r));
  if (semiRound) {
    bracket
      .filter(m => (m.round || "Match") === semiRound)
      .forEach(m => add(loserOf(m), 3));
  }

  for (let i = rounds.length - 1; i >= 0; i--) {
    bracket
      .filter(m => (m.round || "Match") === rounds[i])
      .forEach(m => add(loserOf(m), out.length + 1));
  }

  // Teams eliminated in earlier phases — order by Swiss/group standings (bilans matters).
  getPreFinalEliminatedOrder(tournament.phases).forEach(team => add(team, out.length + 1));
  tournament.participants.forEach(team => add(team, out.length + 1));
  return out.sort((a, b) => a.placement - b.placement || a.team.localeCompare(b.team));
};

const medalFor = (place: number) => {
  if (place === 1) return { Icon: Crown, className: "text-[hsl(var(--gold))]" };
  if (place === 2) return { Icon: Medal, className: "text-[hsl(var(--silver))]" };
  if (place === 3) return { Icon: Award, className: "text-[hsl(var(--bronze))]" };
  return { Icon: null, className: "text-muted-foreground" };
};

export const TournamentFinalResultsPanel = ({ tournament, onUpdateTournament }: Props) => {
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [awardsDraft, setAwardsDraft] = useState(tournament.awards || {});
  const [editingAwards, setEditingAwards] = useState(false);

  useEffect(() => { setAwardsDraft(tournament.awards || {}); }, [tournament.awards, tournament.id]);

  // Collect all players that appeared in this tournament (with their team)
  const playerOptions = useMemo(() => {
    const map = new Map<string, string>();
    const collect = (list?: MapPlayerStats[], team?: string) => {
      list?.forEach(p => { if (p.playerName && team) map.set(p.playerName, team); });
    };
    for (const phase of tournament.phases || []) {
      const matches = [...(phase.bracket || []), ...(phase.groups?.flatMap(g => g.matches) || [])];
      for (const m of matches) {
        for (const mp of m.maps || []) {
          collect(mp.team1Players, m.team1);
          collect(mp.team2Players, m.team2);
        }
      }
    }
    return Array.from(map.entries()).map(([name, team]) => ({ name, team })).sort((a, b) => a.name.localeCompare(b.name));
  }, [tournament]);

  const teamOptions = useMemo(() => {
    const s = new Set<string>();
    (tournament.placements || []).forEach(p => s.add(p.team));
    (tournament.participants || []).forEach(t => s.add(t));
    return Array.from(s).sort();
  }, [tournament]);

  const placements = useMemo(() => {
    const source = tournament.placements?.length ? tournament.placements : derivePlacements(tournament);
    return source.slice().sort((a, b) => a.placement - b.placement || a.team.localeCompare(b.team));
  }, [tournament]);

  const ranking = loadFromStorage<TeamData[] | null>("ranking_data", null) || (teamDatabase as TeamData[]);
  // "Rank po" is a historical record: frozen the first time the finished
  // tournament is viewed and never recalculated afterwards.
  const rankMap = useMemo(() => {
    const frozen = getFrozenRanks(tournament.id);
    if (frozen) return new Map(Object.entries(frozen));
    const sorted = [...ranking]
      .filter(team => !team.isNational)
      .sort((a, b) => (b.points || 0) - (a.points || 0));
    const live = new Map(sorted.map((team, index) => [team.name, index + 1]));
    if (tournament.status === "completed") {
      const teamsInEvent = (tournament.placements || []).map(p => p.team);
      if (teamsInEvent.length) {
        const snapshot: Record<string, number> = {};
        teamsInEvent.forEach(name => {
          const r = live.get(name);
          if (r) snapshot[name] = r;
        });
        freezeRanks(tournament.id, snapshot);
      }
    }
    return live;
  }, [ranking, tournament.id, tournament.status, tournament.placements]);

  const teamMeta = useMemo(() => new Map([...teamDatabase, ...ranking].map(team => [team.name, team])), [ranking]);
  const totalPool = parsePrizePool(tournament.prizePool);
  const prizeMap = useMemo(
    () => resolveTournamentPrizes({
      prizePool: tournament.prizePool,
      customPrizes: (tournament as { customPrizes?: Record<string, number> }).customPrizes,
      teams: Math.max(tournament.teams || 0, placements.length),
    }),
    [placements.length, tournament],
  );

  if (tournament.status !== "completed" || placements.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden mb-6">
      <div className="px-4 py-3 border-b border-border bg-secondary/40 flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-heading font-bold uppercase text-primary tracking-wider">
          Pełne rezultaty końcowe
        </h3>
        <span className="ml-auto text-xs font-mono text-muted-foreground">
          {placements.length} miejsc • pula {tournament.prizePool || "$0"}
        </span>
      </div>

      <div className="hidden md:grid grid-cols-[70px_1fr_90px_110px_120px_36px] gap-2 px-4 py-2 bg-background/40 border-b border-border/60 text-xs font-mono uppercase tracking-wider text-muted-foreground">
        <div className="text-center">Miejsce</div>
        <div>Drużyna i skład</div>
        <div className="text-right">Pkt VRS</div>
        <div className="text-right">Wygrana</div>
        <div className="text-center">Rank po</div>
        <div />
      </div>

      <div className="divide-y divide-border/50">
        {placements.map((placement, index) => {
          const medal = medalFor(placement.placement);
          const lineup = resolveLineup(tournament.id, placement.team);
          const rank = rankMap.get(placement.team);
          const meta = teamMeta.get(placement.team);
          const prize = prizeMap[placement.placement] || 0;
          const isOpen = expandedTeam === placement.team;
          const Icon = medal.Icon;

          return (
            <motion.div
              key={`${placement.placement}-${placement.team}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(index * 0.015, 0.25) }}
              className={cn(
                placement.placement === 1 && "bg-[hsl(var(--gold))]/5",
                placement.placement === 2 && "bg-[hsl(var(--silver))]/5",
                placement.placement === 3 && "bg-[hsl(var(--bronze))]/5",
              )}
            >
              <button
                type="button"
                onClick={() => setExpandedTeam(isOpen ? null : placement.team)}
                className="w-full grid grid-cols-[42px_1fr_auto] md:grid-cols-[70px_1fr_90px_110px_120px_36px] gap-2 px-3 md:px-4 py-3 items-center text-left hover:bg-secondary/30 transition-colors"
              >
                <div className="flex items-center justify-center gap-1">
                  {Icon && <Icon className={cn("w-4 h-4", medal.className)} />}
                  <span className={cn("font-mono font-black text-xs", medal.className)}>#{placement.placement}</span>
                </div>

                <div className="min-w-0 flex items-center gap-2.5">
                  <TeamLogo teamName={placement.team} size={30} rounded="md" />
                  <div className="min-w-0">
                    <TeamLink name={placement.team} className="font-heading font-bold text-foreground truncate flex items-center gap-1.5">
                      {meta?.country && <span className="text-xs">{countryFlag(meta.country)}</span>}
                      <span className="truncate">{placement.team}</span>
                    </TeamLink>
                    <div className="text-xs font-mono text-muted-foreground truncate">
                      {lineup.length ? lineup.join(" • ") : "Brak zapisanego składu"}
                    </div>
                    <div className="md:hidden text-xs font-mono text-muted-foreground mt-0.5">
                      <span className={placement.points >= 0 ? "text-[hsl(var(--win))]" : "text-[hsl(var(--loss))]"}>
                        {placement.points > 0 ? "+" : ""}{placement.points} pkt
                      </span>
                      <span> • {formatMoney(prize)} • rank #{rank ?? "—"}</span>
                    </div>
                  </div>
                </div>

                <div className={cn(
                  "hidden md:block text-right font-mono font-bold tabular-nums",
                  placement.points > 0 ? "text-[hsl(var(--win))]" : placement.points < 0 ? "text-[hsl(var(--loss))]" : "text-muted-foreground",
                )}>
                  {placement.points > 0 ? "+" : ""}{placement.points}
                </div>

                <div className="hidden md:flex items-center justify-end gap-1 text-xs font-mono text-foreground tabular-nums">
                  {prize > 0 && <DollarSign className="w-3 h-3 text-[hsl(var(--gold))]" />}
                  {formatMoney(prize)}
                </div>

                <div className="hidden md:flex items-center justify-center gap-1.5 text-xs font-mono">
                  <span className="font-bold text-foreground">#{rank ?? "—"}</span>
                  {rank ? <Minus className="w-3 h-3 text-muted-foreground" /> : null}
                </div>

                <div className="flex justify-end">
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 pt-1">
                  <div className="flex items-center gap-1.5 mb-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    <Users className="w-3 h-3" /> Skład grający w tym turnieju
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {lineup.length ? lineup.map(player => (
                      <span key={player} className="text-xs font-mono px-2 py-1 rounded border border-border bg-secondary/50 text-foreground">
                        {player}
                      </span>
                    )) : (
                      <span className="text-xs font-mono text-muted-foreground">Brak danych o składzie.</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* === Awards / Wyróżnienia === */}
      {tournament.resultsConfirmed && (
        <div className="border-t border-border bg-gradient-to-br from-[hsl(var(--gold))]/5 to-transparent p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[hsl(var(--gold))]" />
            <h4 className="text-xs font-heading font-bold uppercase text-[hsl(var(--gold))] tracking-wider">
              Wyróżnienia turnieju
            </h4>
            {onUpdateTournament && !editingAwards && (
              <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => setEditingAwards(true)}>
                {tournament.awards ? "Edytuj" : "Dodaj"}
              </Button>
            )}
          </div>

          {editingAwards && onUpdateTournament ? (
            <div className="grid md:grid-cols-2 gap-3">
              <label className="space-y-1 text-xs">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Star className="w-3 h-3 text-[hsl(var(--gold))]" /> MVP turnieju (trafia do gablotki gracza)
                </span>
                <select
                  value={awardsDraft.mvp || ""}
                  onChange={e => {
                    const name = e.target.value;
                    const team = playerOptions.find(p => p.name === name)?.team || "";
                    setAwardsDraft(d => ({ ...d, mvp: name, mvpTeam: team }));
                  }}
                  className="w-full px-2 py-1.5 rounded bg-secondary/50 border border-border text-xs font-mono"
                >
                  <option value="">— wybierz gracza —</option>
                  {playerOptions.map(p => <option key={p.name} value={p.name}>{p.name} ({p.team})</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  🚀 Największe zaskoczenie (drużyna)
                </span>
                <select
                  value={awardsDraft.surprise || ""}
                  onChange={e => setAwardsDraft(d => ({ ...d, surprise: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded bg-secondary/50 border border-border text-xs font-mono"
                >
                  <option value="">— wybierz drużynę —</option>
                  {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  📉 Największe rozczarowanie (drużyna)
                </span>
                <select
                  value={awardsDraft.disappointment || ""}
                  onChange={e => setAwardsDraft(d => ({ ...d, disappointment: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded bg-secondary/50 border border-border text-xs font-mono"
                >
                  <option value="">— wybierz drużynę —</option>
                  {teamOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs md:col-span-2">
                <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Notatka</span>
                <Input
                  value={awardsDraft.note || ""}
                  onChange={e => setAwardsDraft(d => ({ ...d, note: e.target.value }))}
                  placeholder="np. najlepszy mecz turnieju..."
                  className="h-8 text-xs"
                />
              </label>
              <div className="md:col-span-2 flex gap-2 pt-1">
                <Button size="sm" onClick={() => { onUpdateTournament({ awards: awardsDraft }); setEditingAwards(false); }}>
                  Zapisz wyróżnienia
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAwardsDraft(tournament.awards || {}); setEditingAwards(false); }}>
                  Anuluj
                </Button>
              </div>
              <p className="md:col-span-2 text-xs font-mono text-muted-foreground">
                💡 Nagroda MVP zostanie dodana do gablotki gracza. Wyróżnienia drużynowe pozostają wyłącznie w podsumowaniu turnieju (nie są przenoszone na profil drużyny).
              </p>
            </div>
          ) : tournament.awards && (tournament.awards.mvp || tournament.awards.surprise || tournament.awards.disappointment) ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {tournament.awards.mvp && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-[hsl(var(--gold))]/40 bg-[hsl(var(--gold))]/10">
                  <Star className="w-4 h-4 text-[hsl(var(--gold))] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-mono uppercase tracking-wider text-[hsl(var(--gold))]">MVP</p>
                    <p className="text-sm font-heading font-bold text-foreground truncate">{tournament.awards.mvp}</p>
                    {tournament.awards.mvpTeam && (
                      <p className="text-xs font-mono text-muted-foreground truncate">{tournament.awards.mvpTeam}</p>
                    )}
                  </div>
                </div>
              )}
              {tournament.awards.surprise && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-primary/40 bg-primary/10">
                  <span className="text-lg leading-none">🚀</span>
                  <div className="min-w-0">
                    <p className="text-xs font-mono uppercase tracking-wider text-primary">Zaskoczenie</p>
                    <p className="text-sm font-heading font-bold text-foreground truncate">{tournament.awards.surprise}</p>
                  </div>
                </div>
              )}
              {tournament.awards.disappointment && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-destructive/40 bg-destructive/10">
                  <span className="text-lg leading-none">📉</span>
                  <div className="min-w-0">
                    <p className="text-xs font-mono uppercase tracking-wider text-destructive">Rozczarowanie</p>
                    <p className="text-sm font-heading font-bold text-foreground truncate">{tournament.awards.disappointment}</p>
                  </div>
                </div>
              )}
              {tournament.awards.note && (
                <p className="sm:col-span-2 lg:col-span-3 text-xs font-mono text-muted-foreground italic">
                  „{tournament.awards.note}"
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs font-mono text-muted-foreground italic">
              Brak zapisanych wyróżnień. {onUpdateTournament && 'Kliknij „Dodaj", aby wybrać MVP i inne nagrody.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
