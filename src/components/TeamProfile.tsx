import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, Trophy, Users, Globe, MapPin, User, ArrowRightLeft,
  Upload, X, Calendar, Swords, Award, TrendingUp, ImageIcon,
  ArrowDownCircle, ArrowUpCircle, Armchair,
} from "lucide-react";
import { teamDatabase } from "@/data/tournaments";
import { playerNationalities } from "@/data/playerNationalities";
import { playerRealNames } from "@/data/playerRealNames";
import { playerRoles, roleColors, roleIcons } from "@/data/playerRoles";
import { countryFlag } from "@/lib/flags";
import { cn } from "@/lib/utils";
import type { TeamData, Transfer, TournamentData, MatchResult } from "@/lib/types";
import { loadFromStorage } from "@/lib/storage";
import {
  loadTeamLogo, saveTeamLogo, deleteTeamLogo, fileToLogoDataUrl,
} from "@/lib/teamLogos";
import {
  splitRoster, benchPlayer, activatePlayer,
} from "@/lib/benchedPlayers";
import TeamLogo from "@/components/TeamLogo";
import { TeamLink, TournamentLink } from "@/lib/profileNav";
import { getDisplayScore } from "@/lib/matchDisplay";
import TeamRankingTrend from "@/components/TeamRankingTrend";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { computeCareerStats } from "@/lib/playerCareerStats";
import { getRatingColor } from "@/lib/playerStats";
import { isPlaceholder } from "@/lib/teamHelpers";
import MajorBadge from "@/components/MajorBadge";
import { isMajorName, historicMajorsForTeam } from "@/lib/majors";

interface TeamProfileProps {
  teamName: string;
  onBack: () => void;
  teams?: TeamData[];
  onSelectPlayer?: (player: string) => void;
}

type TabId = "overview" | "roster" | "matches" | "trophies" | "transfers";

const placementColor = (p: number) =>
  p === 1 ? "text-accent border-accent/40 bg-accent/10"
  : p === 2 ? "text-[hsl(var(--silver))] border-[hsl(var(--silver))]/40 bg-[hsl(var(--silver))]/10"
  : p === 3 ? "text-[hsl(25,80%,55%)] border-[hsl(25,80%,55%)]/40 bg-[hsl(25,80%,55%)]/10"
  : "text-muted-foreground border-border bg-secondary/30";

const placementLabel = (p: number) =>
  p === 1 ? "🥇 1st" : p === 2 ? "🥈 2nd" : p === 3 ? "🥉 3rd" : `#${p}`;

const TeamProfile = ({ teamName, onBack, teams, onSelectPlayer }: TeamProfileProps) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [hasLogo, setHasLogo] = useState(false);
  const [benchTick, setBenchTick] = useState(0);

  useEffect(() => {
    const onBench = () => setBenchTick(t => t + 1);
    window.addEventListener("bench:update", onBench);
    return () => window.removeEventListener("bench:update", onBench);
  }, []);

  const rankingSource = teams && teams.length > 0 ? teams : teamDatabase;
  const sorted = useMemo(() => [...rankingSource].sort((a, b) => b.points - a.points), [rankingSource]);
  const team = sorted.find((t) => t.name === teamName);
  const globalRank = team ? sorted.indexOf(team) + 1 : 0;
  const tier = globalRank <= 10 ? "Tier S" : globalRank <= 25 ? "Tier A" : globalRank <= 50 ? "Tier B" : globalRank <= 100 ? "Tier C" : "Poza rankingiem";
  const tierColor = globalRank <= 10 ? "text-accent" : globalRank <= 25 ? "text-primary" : globalRank <= 50 ? "text-[hsl(var(--silver))]" : "text-muted-foreground";

  // Refresh logo presence flag
  useEffect(() => {
    let active = true;
    loadTeamLogo(teamName).then(url => { if (active) setHasLogo(!!url); });
    const onUpdate = () => loadTeamLogo(teamName).then(url => { if (active) setHasLogo(!!url); });
    window.addEventListener("teamlogo:update", onUpdate);
    return () => { active = false; window.removeEventListener("teamlogo:update", onUpdate); };
  }, [teamName]);

  // Transfers
  const teamTransfers = useMemo(() => {
    const transfers = loadFromStorage<Transfer[]>("transfers_data", []);
    return transfers.filter(t => t.oldTeam === teamName || t.newTeam === teamName);
  }, [teamName]);

  // Tournaments / matches / trophies aggregated from saved data
  const { trophies, recentMatches, totals, upcomingMatches, mapStats } = useMemo(() => {
    const tournaments = loadFromStorage<TournamentData[]>("tournaments_data", []);
    const trophies: { id: string; name: string; placement: number; points: number; endDate: string; tier?: string }[] = [];
    const matches: {
      id: string; tournamentId: string; tournamentName: string; date: string;
      opponent: string; ownScore: number; oppScore: number; won: boolean; bo?: number; round?: string;
      playedAt?: string;
    }[] = [];
    const upcoming: {
      id: string; tournamentId: string; tournamentName: string; tier?: string;
      opponent: string; bo?: number; round?: string; scheduledAt?: string;
    }[] = [];
    let wins = 0, losses = 0, mapsW = 0, mapsL = 0;
    const mapEvents: { map: string; won: boolean; date: string }[] = [];



    for (const t of tournaments) {
      const placement = t.placements?.find(p => p.team === teamName);
      if (placement) {
        trophies.push({
          id: t.id, name: t.name,
          placement: placement.placement, points: placement.points,
          endDate: t.endDate, tier: t.tier,
        });
      }
      const all: MatchResult[] = [];
      for (const phase of t.phases || []) {
        if (phase.bracket) all.push(...phase.bracket);
        if (phase.groups) for (const g of phase.groups) all.push(...g.matches);
      }
      if (t.matches) all.push(...t.matches);

      for (const m of all) {
        const isT1 = m.team1 === teamName;
        const isT2 = m.team2 === teamName;
        if (!isT1 && !isT2) continue;
        const ownScore = isT1 ? m.score1 : m.score2;
        const oppScore = isT1 ? m.score2 : m.score1;
        const opponent = isT1 ? m.team2 : m.team1;
        if (ownScore + oppScore <= 0) {
          // Mecz wylosowany, ale jeszcze nierozegrany.
          if (opponent && opponent !== "BYE" && !isPlaceholder(opponent)) {
            upcoming.push({
              id: m.id, tournamentId: t.id, tournamentName: t.name, tier: t.tier,
              opponent, bo: m.bo, round: m.round, scheduledAt: m.scheduledAt,
            });
          }
          continue;
        }
        const won = ownScore > oppScore;

        if (won) wins++; else losses++;
        if (m.maps?.length) {
          for (const mp of m.maps) {
            const o = isT1 ? mp.score1 : mp.score2;
            const d = isT1 ? mp.score2 : mp.score1;
            if (o + d <= 0) continue;
            if (o > d) mapsW++; else mapsL++;
            mapEvents.push({ map: mp.map || "?", won: o > d, date: (m.playedAt || t.endDate || "").slice(0, 10) });
          }
        }

        // Bo1 → pokazujemy realny wynik rund (13:6), nie wynik map (1:0).
        const [d1, d2] = getDisplayScore(m);
        matches.push({
          id: m.id,
          tournamentId: t.id,
          tournamentName: t.name,
          date: t.endDate,
          opponent: isT1 ? m.team2 : m.team1,
          ownScore: isT1 ? d1 : d2,
          oppScore: isT1 ? d2 : d1,
          won,
          bo: m.bo, round: m.round,
          playedAt: m.playedAt,
        });
      }
    }

    trophies.sort((a, b) => (b.endDate || "").localeCompare(a.endDate || ""));
    // Chronological: newest first by `playedAt`, fallback to tournament endDate.
    matches.sort((a, b) => {
      const ka = a.playedAt || a.date || "";
      const kb = b.playedAt || b.date || "";
      return kb.localeCompare(ka);
    });
    const totalMatches = wins + losses;
    const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

    // Zaplanowane najpierw (chronologicznie), potem mecze bez terminu.
    upcoming.sort((a, b) => {
      if (a.scheduledAt && b.scheduledAt) return a.scheduledAt.localeCompare(b.scheduledAt);
      if (a.scheduledAt) return -1;
      if (b.scheduledAt) return 1;
      return 0;
    });

    return {
      trophies,
      recentMatches: matches,
      upcomingMatches: upcoming,
      mapEvents,


      totals: {
        wins, losses, totalMatches, winRate,
        mapsW, mapsL,
        firsts: trophies.filter(t => t.placement === 1).length,
        podiums: trophies.filter(t => t.placement <= 3).length,
        events: trophies.length,
        prizePoints: trophies.reduce((s, t) => s + (t.points || 0), 0),
      },
    };
  }, [teamName]);

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: "Plik za duży", description: "Maksymalnie 4 MB.", variant: "destructive" });
      return;
    }
    try {
      const dataUrl = await fileToLogoDataUrl(file, 256);
      await saveTeamLogo(teamName, dataUrl);
      toast({ title: "Logo zaktualizowane", description: teamName });
    } catch {
      toast({ title: "Nie udało się wczytać obrazu", variant: "destructive" });
    }
  };
  const handleRemoveLogo = async () => {
    await deleteTeamLogo(teamName);
    toast({ title: "Logo usunięte" });
  };

  if (!team) {
    return (
      <section className="py-12">
        <div className="container mx-auto px-4">
          <button onClick={onBack} className="flex items-center gap-2 text-primary mb-6 hover:underline">
            <ArrowLeft className="w-4 h-4" /> Powrót
          </button>
          <p className="text-muted-foreground">Drużyna nie znaleziona.</p>
        </div>
      </section>
    );
  }

  const tabs: { id: TabId; label: string; icon: typeof Users; count?: number }[] = [
    { id: "overview", label: "Przegląd", icon: TrendingUp },
    { id: "roster", label: "Skład", icon: Users, count: team.roster.length },
    { id: "matches", label: "Mecze", icon: Swords, count: recentMatches.length },
    { id: "trophies", label: "Trofea", icon: Trophy, count: totals.events },
    { id: "transfers", label: "Transfery", icon: ArrowRightLeft, count: teamTransfers.length },
  ];

  return (
    <section className="py-6">
      <div className="container mx-auto px-4 max-w-[1200px]">
        <button onClick={onBack} className="flex items-center gap-2 text-primary mb-4 hover:underline font-mono text-sm">
          <ArrowLeft className="w-4 h-4" /> Powrót do rankingu
        </button>

        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-gradient-to-br from-card via-card to-secondary/30 border border-border rounded-xl p-6 mb-4"
        >
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
               style={{ backgroundImage: "radial-gradient(circle at 20% 20%, hsl(var(--primary)) 0%, transparent 50%)" }} />

          <div className="relative flex flex-col md:flex-row items-start gap-6">
            {/* Logo + upload */}
            <div className="relative group">
              <TeamLogo teamName={team.name} size={112} rounded="xl" className="shadow-xl" />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleLogoChange}
                className="hidden"
              />
              <div className="absolute inset-0 rounded-xl bg-background/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                <button
                  type="button"
                  onClick={handleUploadClick}
                  className="text-xs font-mono uppercase text-foreground bg-primary/90 hover:bg-primary text-primary-foreground px-2 py-1 rounded flex items-center gap-1"
                >
                  <Upload className="w-3 h-3" /> Logo
                </button>
                {hasLogo && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-xs font-mono uppercase text-destructive bg-destructive/10 hover:bg-destructive/20 px-2 py-1 rounded flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Usuń
                  </button>
                )}
              </div>
            </div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-3xl md:text-4xl font-heading font-black text-foreground tracking-tight">{team.name}</h1>
                <span className={cn("text-xs font-heading font-bold px-2 py-0.5 rounded border", tierColor,
                  globalRank <= 10 ? "border-accent/40 bg-accent/10" : globalRank <= 30 ? "border-primary/40 bg-primary/10" : "border-border bg-muted"
                )}>
                  {tier}
                </span>
              </div>
              <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> {team.region}</span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="text-base">{countryFlag(team.country)}</span> {team.country}
                </span>
                <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {team.roster.length} graczy</span>
                {!hasLogo && (
                  <button
                    onClick={handleUploadClick}
                    className="flex items-center gap-1.5 text-primary hover:underline text-xs font-mono"
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> Dodaj logo
                  </button>
                )}
              </div>

              {/* Stat strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatCell label="Mecze" value={`${totals.wins}-${totals.losses}`} accent={totals.winRate >= 50 ? "win" : "loss"} sub={`${totals.winRate}% WR`} />
                <StatCell label="Mapy" value={`${totals.mapsW}-${totals.mapsL}`} sub="W-L" />
                <StatCell label="Trofea" value={`${totals.firsts}🥇 ${totals.podiums}🏅`} sub={`${totals.events} eventów`} />
                <StatCell label="Punkty" value={team.points.toLocaleString()} sub="ranking ACS" accent="primary" />
              </div>
            </div>

            {/* Rank badge */}
            <div className="text-right shrink-0 w-full md:w-auto">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">World Rank</p>
              <p className={cn("text-5xl font-heading font-black", globalRank <= 3 ? "text-accent" : globalRank <= 10 ? "text-primary" : "text-foreground")}>
                #{globalRank}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-border overflow-x-auto">
          {tabs.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-heading font-bold whitespace-nowrap border-b-2 transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {typeof t.count === "number" && t.count > 0 && (
                  <span className={cn(
                    "text-xs font-mono px-1.5 py-0.5 rounded-full",
                    active ? "bg-primary/20 text-primary" : "bg-secondary/50 text-muted-foreground"
                  )}>
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Nadchodzące mecze — osobne okienko na wierzchu, nad panelami */}
        {upcomingMatches.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky top-16 z-30 mb-4 rounded-xl border border-primary/40 glass-surface shadow-[0_8px_30px_-12px_hsl(var(--primary)/0.5)] overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/25 bg-primary/10">
              <Swords className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-mono uppercase tracking-wider text-primary font-bold">
                Nadchodzące mecze
              </span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded-full bg-primary/20 text-primary">
                {upcomingMatches.length}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto p-2">
              {upcomingMatches.slice(0, 8).map(m => (
                <div
                  key={m.id}
                  className="min-w-[210px] shrink-0 rounded-lg border border-border bg-card/70 p-2.5 hover-lift"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <TeamLogo teamName={m.opponent} size={22} rounded="md" />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">
                        vs <TeamLink name={m.opponent} />
                      </p>

                      <p className="text-xs font-mono text-muted-foreground truncate">
                        {m.round || "Mecz"} • BO{m.bo || 1}
                      </p>
                    </div>
                  </div>
                  <TournamentLink
                    tournamentId={m.tournamentId}
                    matchId={m.id}
                    title={m.tournamentName}
                    className="block text-xs font-mono text-muted-foreground truncate"
                  >
                    {m.tier ? `[${m.tier}] ` : ""}{m.tournamentName}
                  </TournamentLink>
                  <p className="text-xs font-mono mt-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-primary" />
                    {m.scheduledAt
                      ? <span className="text-foreground">{m.scheduledAt.slice(0, 10)} {m.scheduledAt.slice(11, 16)}</span>
                      : <span className="text-muted-foreground">termin nieustalony</span>}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}



        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "overview" && (
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-4">
                {team.coach && (
                  <Card title="Trener" icon={<span className="text-base leading-none">🎓</span>}>
                    <button
                      type="button"
                      onClick={() => onSelectPlayer?.(team.coach!)}
                      className="flex items-center gap-3 w-full text-left p-2 rounded-lg bg-sky-500/5 border border-sky-500/30 hover:border-sky-400/60 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full bg-sky-500/15 border border-sky-500/40 flex items-center justify-center text-base shrink-0">🎓</div>
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-bold text-foreground text-sm truncate">{team.coach}</p>
                        {playerRealNames[team.coach] && (
                          <p className="text-xs text-muted-foreground truncate">
                            {playerRealNames[team.coach].firstName} {playerRealNames[team.coach].lastName}
                          </p>
                        )}
                      </div>
                      {playerNationalities[team.coach] && (
                        <span className="text-lg shrink-0">{countryFlag(playerNationalities[team.coach])}</span>
                      )}
                      <span className="text-xs font-mono font-bold uppercase px-2 py-1 rounded border border-sky-500/40 text-sky-300 bg-sky-500/10 shrink-0">
                        Coach
                      </span>
                    </button>
                  </Card>
                )}
                <Card title="Aktualny skład" icon={<Users className="w-4 h-4 text-primary" />}>
                  <RosterGrid players={splitRoster(team).active} team={team} compact onSelectPlayer={onSelectPlayer} />
                </Card>
                <TeamRankingTrend teamName={teamName} />
                <Card title="Ostatnie mecze" icon={<Swords className="w-4 h-4 text-primary" />}>
                  {recentMatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Brak rozegranych meczów.</p>
                  ) : (
                    <MatchList matches={recentMatches.slice(0, 6)} teamName={teamName} />
                  )}
                </Card>
              </div>
              <div className="space-y-4">
                <Card title="Ostatnie osiągnięcia" icon={<Award className="w-4 h-4 text-accent" />}>
                  {trophies.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Brak trofeów.</p>
                  ) : (
                    <ul className="space-y-2">
                      {trophies.slice(0, 6).map(tr => (
                        <li key={tr.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/30 border border-border/50">
                          <span className={cn("text-xs font-heading font-bold px-2 py-0.5 rounded border shrink-0", placementColor(tr.placement))}>
                            {placementLabel(tr.placement)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <TournamentLink tournamentId={tr.id} title={tr.name} className="block text-sm font-heading text-foreground truncate">{tr.name}</TournamentLink>
                            <p className="text-xs text-muted-foreground font-mono">
                              {tr.endDate || "—"} {tr.tier ? `• Tier ${tr.tier}` : ""}
                            </p>
                          </div>
                          <span className="text-xs font-mono text-primary shrink-0">+{tr.points}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card title="Region" icon={<Globe className="w-4 h-4 text-primary" />}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{countryFlag(team.country)}</span>
                    <div>
                      <p className="font-heading text-foreground">{team.country}</p>
                      <p className="text-xs text-muted-foreground font-mono">{team.region}</p>
                    </div>
                  </div>
                </Card>
                <Card title="Win % na mapach" icon={<Swords className="w-4 h-4 text-primary" />}>
                  {mapStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Brak rozegranych map.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {mapStats.map(ms => (
                        <li key={ms.map} className="flex items-center gap-2">
                          <span className="text-xs font-heading text-foreground w-20 shrink-0 truncate">{ms.map}</span>
                          <div className="flex-1 h-2 rounded-full bg-secondary/60 overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                ms.winRate >= 60 ? "bg-[hsl(var(--win))]" : ms.winRate >= 40 ? "bg-primary" : "bg-destructive",
                              )}
                              style={{ width: `${ms.winRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono tabular-nums text-foreground w-10 text-right">{ms.winRate}%</span>
                          <span className="text-xs font-mono tabular-nums text-muted-foreground w-12 text-right">{ms.wins}-{ms.losses}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </div>
          )}

          {activeTab === "roster" && (
            <RosterTabContent team={team} onSelectPlayer={onSelectPlayer} />
          )}

          {activeTab === "matches" && (
            <Card title={`Wszystkie mecze (${recentMatches.length})`} icon={<Swords className="w-4 h-4 text-primary" />}>
              {recentMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Brak rozegranych meczów.</p>
              ) : (
                <MatchList matches={recentMatches} teamName={teamName} />
              )}
            </Card>
          )}

          {activeTab === "trophies" && (
            <Card title={`Trofea i osiągnięcia (${totals.events})`} icon={<Trophy className="w-4 h-4 text-accent" />}>
              {trophies.length === 0 && historicMajorsForTeam(teamName).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Brak trofeów.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {historicMajorsForTeam(teamName).map(hm => (
                    <div key={hm.id} className="flex items-center gap-3 p-3 rounded-lg border border-[hsl(var(--gold))]/60 bg-gradient-to-r from-[hsl(var(--gold))]/15 to-transparent shadow-[0_0_20px_hsl(var(--gold)/0.25)]">
                      <span className="text-xl leading-none">🏆</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-heading font-black text-foreground text-sm truncate">{hm.name}</span>
                          <MajorBadge compact />
                        </div>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          Mistrz {hm.year} · jako {hm.team} · {hm.roster.join(", ")}
                        </p>
                      </div>
                    </div>
                  ))}
                  {trophies.map(tr => (
                    <div key={tr.id} className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-colors",
                      isMajorName(tr.name) && tr.placement === 1
                        ? "border-[hsl(var(--gold))]/60 bg-gradient-to-r from-[hsl(var(--gold))]/15 to-transparent shadow-[0_0_20px_hsl(var(--gold)/0.25)]"
                        : "bg-secondary/30 border-border/50 hover:border-primary/40",
                    )}>
                      <span className={cn("text-xs font-heading font-bold px-2.5 py-1 rounded border shrink-0", placementColor(tr.placement))}>
                        {placementLabel(tr.placement)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <TournamentLink tournamentId={tr.id} title={tr.name} className="block font-heading text-foreground text-sm truncate">{tr.name}</TournamentLink>
                        <p className="text-xs text-muted-foreground font-mono flex items-center gap-2">
                          <Calendar className="w-3 h-3" />{tr.endDate || "—"}
                          {isMajorName(tr.name) ? <MajorBadge compact /> : tr.tier && <span className="px-1 rounded bg-muted">Tier {tr.tier}</span>}
                        </p>
                      </div>
                      <span className="text-sm font-mono font-bold text-primary shrink-0">+{tr.points}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === "transfers" && (
            <Card title={`Ruchy kadrowe (${teamTransfers.length})`} icon={<ArrowRightLeft className="w-4 h-4 text-primary" />}>
              {teamTransfers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Brak transferów.</p>
              ) : (
                <div className="space-y-2">
                  {teamTransfers.map(t => {
                    const isJoin = t.newTeam === teamName;
                    return (
                      <div key={t.id} className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg border border-border/50">
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          isJoin ? "bg-[hsl(var(--win))]/20 text-[hsl(var(--win))]" : "bg-[hsl(var(--loss))]/20 text-[hsl(var(--loss))]"
                        )}>{isJoin ? "+" : "−"}</div>
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => onSelectPlayer?.(t.player)}
                            className={cn("font-heading font-bold text-foreground text-sm text-left",
                              onSelectPlayer && "hover:text-primary transition-colors")}
                          >
                            {playerNationalities[t.player] && (
                              <span className="mr-1">{countryFlag(playerNationalities[t.player])}</span>
                            )}
                            {t.player}
                          </button>
                          <p className="text-xs text-muted-foreground">
                            {isJoin
                              ? t.oldTeam === "-" ? "Free Agent → Dołączył" : `z ${t.oldTeam}`
                              : t.newTeam === "-" ? "Odszedł → Free Agent" : `do ${t.newTeam}`}
                          </p>
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{t.date}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

        </motion.div>
      </div>
    </section>
  );
};

/* ----- subcomponents ----- */

const StatCell = ({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "win" | "loss" | "primary" }) => (
  <div className="bg-secondary/40 border border-border/50 rounded-lg px-3 py-2">
    <p className="text-xs font-mono uppercase text-muted-foreground tracking-wider">{label}</p>
    <p className={cn(
      "text-lg font-heading font-bold",
      accent === "win" && "text-[hsl(var(--win))]",
      accent === "loss" && "text-[hsl(var(--loss))]",
      accent === "primary" && "text-primary",
      !accent && "text-foreground",
    )}>{value}</p>
    {sub && <p className="text-xs font-mono text-muted-foreground">{sub}</p>}
  </div>
);

const Card = ({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <h3 className="text-sm font-heading font-bold text-foreground mb-3 flex items-center gap-2 uppercase tracking-wide">
      {icon}{title}
    </h3>
    {children}
  </div>
);

const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = [
    "from-blue-500 to-blue-700", "from-emerald-500 to-emerald-700",
    "from-purple-500 to-purple-700", "from-amber-500 to-amber-700",
    "from-rose-500 to-rose-700", "from-cyan-500 to-cyan-700",
    "from-indigo-500 to-indigo-700", "from-teal-500 to-teal-700",
  ];
  return colors[Math.abs(hash) % colors.length];
};

const RosterGrid = ({
  team, compact, onSelectPlayer, players, benched, onBench, onActivate, canBench,
}: {
  team: TeamData;
  compact?: boolean;
  onSelectPlayer?: (p: string) => void;
  players?: string[];
  benched?: boolean;
  onBench?: (p: string) => void;
  onActivate?: (p: string) => void;
  /** When provided, hides the bench button if it would drop active below 5. */
  canBench?: boolean;
}) => {
  const list = players ?? team.roster;
  const playerStats = useMemo(() => {
    const map = new Map<string, { rating: number; kd: number; adr: number; matches: number }>();
    list.forEach(p => {
      try {
        const s = computeCareerStats(p);
        map.set(p, { rating: s.careerRating, kd: s.kdRatio, adr: s.avgAdr, matches: s.matchesPlayed });
      } catch {
        map.set(p, { rating: 0, kd: 0, adr: 0, matches: 0 });
      }
    });
    return map;
  }, [list.join("|")]);
  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}>
      {list.map((player, i) => {
        const playerCountry = playerNationalities[player] || team.country;
        const realName = playerRealNames[player];
        const stats = playerStats.get(player);
        return (
          <motion.div
            key={player}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.04 }}
            className={cn(
              "relative bg-secondary/30 border border-border rounded-lg p-3 text-center transition-all",
              benched && "opacity-70 border-dashed",
              onSelectPlayer && "hover:border-primary/50 hover:bg-secondary/50",
            )}
          >
            <button
              type="button"
              onClick={() => onSelectPlayer?.(player)}
              className={cn("w-full", onSelectPlayer && "cursor-pointer")}
            >
              <div className="mx-auto mb-2 w-fit relative">
                <TeamLogo teamName={team.name} size={48} rounded="full" />
                {benched && (
                  <span className="absolute -bottom-1 -right-1 bg-muted text-muted-foreground border border-border rounded-full p-0.5">
                    <Armchair className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="font-heading font-bold text-foreground text-xs sm:text-sm truncate">{player}</p>
              {realName && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {realName.firstName} {realName.lastName}
                </p>
              )}
              {playerRoles[player] && (
                <span className={cn("inline-flex items-center gap-1 text-xs font-mono font-bold mt-1 px-1.5 py-0.5 rounded-full border", roleColors[playerRoles[player]])}>
                  {roleIcons[playerRoles[player]]} {playerRoles[player]}
                </span>
              )}
              <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
                <span>{countryFlag(playerCountry)}</span>
                <span className="truncate">{playerCountry}</span>
              </p>
              {stats && stats.matches > 0 ? (
                <div className="mt-2 pt-2 border-t border-border/40 grid grid-cols-3 gap-0.5 text-xs font-mono">
                  <div className="flex flex-col items-center" title={`Rating (${stats.matches} meczów)`}>
                    <span className="text-muted-foreground uppercase">Rtg</span>
                    <span className={cn("font-bold tabular-nums", getRatingColor(stats.rating))}>{stats.rating.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col items-center" title="K/D">
                    <span className="text-muted-foreground uppercase">K/D</span>
                    <span className="font-bold tabular-nums text-foreground">{stats.kd.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col items-center" title="ADR">
                    <span className="text-muted-foreground uppercase">ADR</span>
                    <span className="font-bold tabular-nums text-foreground">{Math.round(stats.adr)}</span>
                  </div>
                </div>
              ) : (
                <div className="mt-2 pt-2 border-t border-border/40 text-xs font-mono text-muted-foreground/60 text-center">
                  Brak statystyk
                </div>
              )}
            </button>
            {onBench && !benched && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onBench(player); }}
                disabled={canBench === false}
                className="mt-2 w-full inline-flex items-center justify-center gap-1 text-xs font-mono uppercase px-2 py-1 rounded border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={canBench === false ? "Skład musi mieć min. 1 aktywnego gracza" : "Wyślij na ławkę"}
              >
                <ArrowDownCircle className="w-3 h-3" /> Na ławkę
              </button>
            )}
            {onActivate && benched && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onActivate(player); }}
                className="mt-2 w-full inline-flex items-center justify-center gap-1 text-xs font-mono uppercase px-2 py-1 rounded border border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
              >
                <ArrowUpCircle className="w-3 h-3" /> Wstaw do składu
              </button>
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

const RosterTabContent = ({
  team, onSelectPlayer,
}: { team: TeamData; onSelectPlayer?: (p: string) => void }) => {
  const { active, bench } = splitRoster(team);
  const { toast } = useToast();

  const handleBench = (p: string) => {
    if (active.length <= 1) {
      toast({ title: "Nie można wysłać na ławkę", description: "Drużyna musi mieć min. 1 aktywnego gracza." });
      return;
    }
    benchPlayer(team.name, p);
    toast({ title: "Gracz na ławce", description: `${p} został przeniesiony na ławkę.` });
  };
  const handleActivate = (p: string) => {
    activatePlayer(team.name, p);
    toast({ title: "Gracz w składzie", description: `${p} wraca do aktywnej piątki.` });
  };

  return (
    <div className="space-y-4">
      {team.coach && (
        <Card
          title="Trener"
          icon={<span className="text-base leading-none">🎓</span>}
        >
          <button
            type="button"
            onClick={() => onSelectPlayer?.(team.coach!)}
            className="flex items-center gap-3 w-full text-left p-2 rounded-lg bg-sky-500/5 border border-sky-500/30 hover:border-sky-400/60 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-sky-500/15 border border-sky-500/40 flex items-center justify-center text-lg shrink-0">
              🎓
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-heading font-bold text-foreground text-sm truncate">{team.coach}</p>
              {playerRealNames[team.coach] && (
                <p className="text-xs text-muted-foreground truncate">
                  {playerRealNames[team.coach].firstName} {playerRealNames[team.coach].lastName}
                </p>
              )}
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                {playerNationalities[team.coach] && (
                  <span>{countryFlag(playerNationalities[team.coach])} {playerNationalities[team.coach]}</span>
                )}
              </p>
            </div>
            <span className="text-xs font-mono font-bold uppercase px-2 py-1 rounded border border-sky-500/40 text-sky-300 bg-sky-500/10">
              Coach
            </span>
          </button>
        </Card>
      )}
      <Card
        title={`Aktywny skład (${active.length}/5)`}
        icon={<Users className="w-4 h-4 text-primary" />}
      >
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Brak aktywnych graczy.</p>
        ) : (
          <RosterGrid
            team={team}
            players={active}
            onSelectPlayer={onSelectPlayer}
            onBench={handleBench}
            canBench={active.length > 1}
          />
        )}
      </Card>
      <Card
        title={`Ławka (${bench.length})`}
        icon={<Armchair className="w-4 h-4 text-muted-foreground" />}
      >
        {bench.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Brak graczy na ławce. Użyj przycisku „Na ławkę" przy aktywnym graczu, aby go odsunąć od składu.</p>
        ) : (
          <RosterGrid
            team={team}
            players={bench}
            benched
            onSelectPlayer={onSelectPlayer}
            onActivate={handleActivate}
          />
        )}
      </Card>
    </div>
  );
};

const MatchList = ({
  matches, teamName,
}: {
  matches: { id: string; tournamentId?: string; tournamentName: string; date: string; opponent: string; ownScore: number; oppScore: number; won: boolean; bo?: number; round?: string; playedAt?: string }[];
  teamName: string;
}) => (
  <ul className="divide-y divide-border/60">
    {matches.map(m => (
      <li key={m.id} className="py-2 flex items-center gap-3 flex-wrap">
        <span className={cn(
          "w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold shrink-0",
          m.won ? "bg-[hsl(var(--win))]/15 text-[hsl(var(--win))]" : "bg-[hsl(var(--loss))]/15 text-[hsl(var(--loss))]",
        )}>{m.won ? "W" : "L"}</span>
        <TeamLogo teamName={teamName} size={22} rounded="md" />
        <span className="font-mono text-xs text-muted-foreground">vs</span>
        <TeamLogo teamName={m.opponent} size={22} rounded="md" />
        <TeamLink name={m.opponent} className="text-sm font-heading text-foreground truncate flex-1 min-w-[80px]" />
        <TournamentLink
          tournamentId={m.tournamentId}
          matchId={m.id}
          title="Otwórz mecz"
          className={cn(
            "text-sm font-mono font-bold tabular-nums shrink-0",
            m.won ? "text-[hsl(var(--win))]" : "text-[hsl(var(--loss))]",
          )}
        >
          {m.ownScore}–{m.oppScore}
        </TournamentLink>
        {m.bo && (
          <span className="text-xs font-mono text-muted-foreground border border-border rounded px-1 shrink-0">BO{m.bo}</span>
        )}
        {m.round && (
          <span className="text-xs font-mono text-primary/80 border border-primary/30 bg-primary/5 rounded px-1.5 py-0.5 shrink-0 truncate max-w-[160px]" title={m.round}>
            {m.round}
          </span>
        )}
        <TournamentLink
          tournamentId={m.tournamentId}
          title={m.tournamentName}
          className="text-xs text-muted-foreground font-mono hidden sm:inline truncate max-w-[180px]"
        >
          {m.tournamentName}
        </TournamentLink>
      </li>
    ))}
  </ul>
);

export default TeamProfile;
