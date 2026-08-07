import PlayerAvatar from "@/components/PlayerAvatar";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, User, Globe, ArrowRightLeft, Trophy, Shield, Target, Skull,
  Activity, Zap, Crosshair, BarChart3, Flame, TrendingUp, MapIcon, Users as UsersIcon,
  Award, Star, Medal, Pencil,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { teamDatabase, type SeasonTeamStanding, type TeamData } from "@/data/tournaments";
import { playerNationalities } from "@/data/playerNationalities";
import { playerRealNames } from "@/data/playerRealNames";
import { playerRoles, roleColors, roleIcons, type PlayerRole } from "@/data/playerRoles";
import { getAllTransfers } from "@/data/history";
import { countryFlag } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { computeCareerStats } from "@/lib/playerCareerStats";
import { getRatingColor } from "@/lib/playerStats";
import { setPlayerRole } from "@/lib/changeLog";
import { toast } from "@/hooks/use-toast";
import TeamLogo from "@/components/TeamLogo";
import MajorBadge from "@/components/MajorBadge";
import { isMajorName, historicMajorsForPlayer } from "@/lib/majors";
import { TournamentLink } from "@/lib/profileNav";
import { buildPlayerTeamHistory } from "@/lib/playerTeamHistory";
import { CONTRACTS_EVENT, formatRemaining, getContractInfo, type ContractInfo } from "@/lib/contracts";
import { WORLD_CLOCK_EVENT } from "@/lib/worldClock";
import { useEffect } from "react";
import { FileSignature, AlertTriangle } from "lucide-react";

const fmtDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short", year: "numeric" }) : "?";

const fmtRange = (from: string | null, to: string | null): string =>
  `${fmtDate(from)} — ${to ? fmtDate(to) : "obecnie"}`;

const ROLE_OPTIONS: PlayerRole[] = ["Entry", "Lurker", "AWPer", "Anchor", "IGL"];

interface PlayerProfileProps {
  playerName: string;
  onBack: () => void;
  onSelectTeam: (team: string) => void;
  onSelectPlayer?: (player: string) => void;
  seasonStandings: SeasonTeamStanding[];
  dynamicRanking?: TeamData[];
}

const getAvatarColor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "from-blue-500 to-blue-700",
    "from-emerald-500 to-emerald-700",
    "from-purple-500 to-purple-700",
    "from-amber-500 to-amber-700",
    "from-rose-500 to-rose-700",
    "from-cyan-500 to-cyan-700",
    "from-indigo-500 to-indigo-700",
    "from-teal-500 to-teal-700",
  ];
  return colors[Math.abs(hash) % colors.length];
};

const PlayerProfile = ({
  playerName, onBack, onSelectTeam, onSelectPlayer, seasonStandings, dynamicRanking,
}: PlayerProfileProps) => {
  const country = playerNationalities[playerName] || "??";
  const realName = playerRealNames[playerName];
  const rankingSource = dynamicRanking && dynamicRanking.length > 0 ? dynamicRanking : teamDatabase;
  const sortedRanking = useMemo(
    () => [...rankingSource].filter(t => !t.isNational).sort((a, b) => b.points - a.points),
    [rankingSource],
  );

  const currentTeam = useMemo(
    () => rankingSource.find(t => !t.isNational && (t.roster.includes(playerName) || t.coach === playerName)),
    [playerName, rankingSource],
  );
  const isCoachOfTeam = !!(currentTeam && currentTeam.coach === playerName);
  const teamRank = currentTeam && !currentTeam.isNational
    ? sortedRanking.findIndex(t => t.name === currentTeam.name) + 1 || null
    : null;

  const playerTransfers = useMemo(
    () => getAllTransfers().filter(t => t.player === playerName),
    [playerName],
  );

  const teamHistory = useMemo(
    () => buildPlayerTeamHistory(playerName, rankingSource),
    [playerName, rankingSource],
  );

  const [contract, setContract] = useState<ContractInfo | null>(() => getContractInfo(playerName));
  useEffect(() => {
    const sync = () => setContract(getContractInfo(playerName));
    sync();
    window.addEventListener(CONTRACTS_EVENT, sync);
    window.addEventListener(WORLD_CLOCK_EVENT, sync);
    return () => {
      window.removeEventListener(CONTRACTS_EVENT, sync);
      window.removeEventListener(WORLD_CLOCK_EVENT, sync);
    };
  }, [playerName]);


  const teamStanding = currentTeam
    ? seasonStandings.find(s => s.team === currentTeam.name)
    : null;

  // ===== Career stats from all manually-entered tournament match data =====
  const career = useMemo(() => computeCareerStats(playerName), [playerName]);

  const avatarGradient = getAvatarColor(playerName);
  const [role, setRoleState] = useState<PlayerRole | "">((playerRoles[playerName] || "") as PlayerRole | "");
  const [editingRole, setEditingRole] = useState(false);

  const handleRoleChange = (next: PlayerRole | "") => {
    setPlayerRole(playerName, next);
    setRoleState(next);
    setEditingRole(false);
    toast({ title: "Rola zaktualizowana", description: `${playerName}: ${next || "—"}` });
  };

  return (
    <section className="py-6">
      <div className="container mx-auto px-4 max-w-5xl">
        <button onClick={onBack} className="flex items-center gap-2 text-primary mb-6 hover:underline font-mono text-sm">
          <ArrowLeft className="w-4 h-4" /> Powrót
        </button>

        {/* === Hero header === */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-card via-card to-secondary/30 border border-border rounded-xl overflow-hidden mb-6"
        >
          <div className="p-6 flex flex-wrap items-center gap-6">
            <div className="shrink-0 flex items-center gap-4">
              <PlayerAvatar
                playerName={playerName}
                teamName={currentTeam?.name}
                size={112}
                rounded="2xl"
                editable
                className="ring-4 ring-background/50 shadow-xl"
              />
              {currentTeam && (
                <button
                  onClick={() => onSelectTeam(currentTeam.name)}
                  title={`Przejdź do ${currentTeam.name}`}
                  className="shrink-0 ring-2 ring-background/50 rounded-xl shadow-lg hover:ring-primary/40 transition-all"
                >
                  <TeamLogo teamName={currentTeam.name} size={64} rounded="xl" />
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-4xl font-heading font-bold text-foreground tracking-tight">{playerName}</h1>
                <span className="text-2xl">{countryFlag(country)}</span>
                {editingRole ? (
                  <select
                    autoFocus
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value as PlayerRole | "")}
                    onBlur={() => setEditingRole(false)}
                    className="text-xs font-mono px-2 py-1 rounded-full border border-primary/40 bg-card text-foreground"
                  >
                    <option value="">— brak roli —</option>
                    {ROLE_OPTIONS.map(r => (
                      <option key={r} value={r}>{roleIcons[r]} {r}</option>
                    ))}
                  </select>
                ) : role ? (
                  <button
                    onClick={() => setEditingRole(true)}
                    title="Kliknij aby zmienić rolę"
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border hover:opacity-80 transition-opacity",
                      roleColors[role],
                    )}
                  >
                    {roleIcons[role]} {role}
                    <Pencil className="w-2.5 h-2.5 ml-1 opacity-60" />
                  </button>
                ) : (
                  <button
                    onClick={() => setEditingRole(true)}
                    className="inline-flex items-center gap-1 text-xs font-mono px-2.5 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
                  >
                    <Pencil className="w-3 h-3" /> Dodaj rolę
                  </button>
                )}
              </div>
              {realName && (
                <p className="text-muted-foreground text-base mt-1">
                  {realName.firstName} <span className="font-bold text-foreground/80">"{playerName}"</span> {realName.lastName}
                </p>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5" /> {country}
                </span>
                {currentTeam ? (
                  <button
                    onClick={() => onSelectTeam(currentTeam.name)}
                    className="flex items-center gap-1 hover:text-primary transition-colors group"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    {countryFlag(currentTeam.country)}
                    <span className="font-bold text-foreground group-hover:text-primary">{currentTeam.name}</span>
                    {contract?.urgency === "critical" && (
                      <span
                        title={`Kontrakt wygasa za ${formatRemaining(contract.daysLeft)}`}
                        className="text-[hsl(var(--loss))] font-bold text-xs leading-none"
                      >
                        !
                      </span>
                    )}
                    {teamRank && <span className="font-mono text-xs">(#{teamRank})</span>}
                    {isCoachOfTeam && (
                      <span className="ml-1 text-xs font-mono uppercase px-1.5 py-0.5 rounded border border-sky-500/40 text-sky-300 bg-sky-500/10">
                        🎓 Coach
                      </span>
                    )}
                  </button>
                ) : (
                  <span className="flex items-center gap-1 italic">
                    <Shield className="w-3.5 h-3.5" /> Free Agent
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  {career.matchesPlayed} mecz(ów) • {career.mapsPlayed} map
                </span>
              </div>
            </div>

            {/* Big career rating badge */}
            <div className="bg-card/60 border border-border rounded-xl p-4 text-center min-w-[120px]">
              <p className="text-xs font-mono uppercase text-muted-foreground tracking-wider mb-1">Rating 3.0</p>
              <p className={cn("text-4xl font-heading font-bold tabular-nums", getRatingColor(career.careerRating))}>
                {career.careerRating > 0 ? career.careerRating.toFixed(2) : "—"}
              </p>
              {career.matchesPlayed > 0 && (
                <p className="text-xs font-mono text-muted-foreground mt-1">
                  W-L: <span className="text-[hsl(var(--win))] font-bold">{career.wins}</span>
                  <span className="mx-0.5">/</span>
                  <span className="text-[hsl(var(--loss))] font-bold">{career.losses}</span>
                </p>
              )}
            </div>
          </div>
        </motion.div>

        {/* === Stats grid === */}
        {career.matchesPlayed > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
              <StatCell icon={Crosshair} label="K/D" value={career.kdRatio.toFixed(2)} accent={career.kdRatio >= 1 ? "win" : "loss"} />
              <StatCell icon={Zap} label="KPR" value={career.kpr.toFixed(2)} />
              <StatCell icon={Skull} label="DPR" value={career.dpr.toFixed(2)} />
              <StatCell icon={Activity} label="ADR" value={career.avgAdr.toString()} />
              <StatCell icon={Target} label="KAST%" value={`${career.avgKast}`} />
              <StatCell icon={Flame} label="UD" value={career.totalUd.toString()} subtitle="utility dmg" />
              <StatCell icon={Zap} label="EF" value={career.totalEf.toString()} subtitle="enemies flashed" />
            </div>

            {/* === Trophies + best individual moments === */}
            {(career.trophies.length > 0 || career.mvpAwards.length > 0 || career.bestMatchRating || career.bestMapKills) && (
              <div className="grid lg:grid-cols-3 gap-4 mb-6">
                {career.mvpAwards.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="lg:col-span-3 bg-gradient-to-br from-[hsl(var(--gold))]/10 to-card border border-[hsl(var(--gold))]/40 rounded-lg p-4"
                  >
                    <h2 className="text-sm font-heading font-bold text-foreground mb-3 flex items-center gap-2">
                      <Star className="w-4 h-4 text-[hsl(var(--gold))]" /> Nagrody MVP ({career.mvpAwards.length})
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {career.mvpAwards.map(a => (
                        <div key={a.tournamentId} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[hsl(var(--gold))]/50 bg-[hsl(var(--gold))]/15">
                          <span className="text-lg leading-none">⭐</span>
                          <div className="min-w-0">
                            <p className="text-xs font-heading font-bold text-foreground truncate max-w-[220px]">{a.tournamentName}</p>
                            <p className="text-xs font-mono text-muted-foreground truncate">
                              {a.team}{a.endDate ? ` • ${new Date(a.endDate).getFullYear()}` : ""}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
                {(career.trophies.length > 0 || historicMajorsForPlayer(playerName).length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="lg:col-span-2 bg-card border border-border rounded-lg p-4"
                  >
                    <h2 className="text-sm font-heading font-bold text-foreground mb-3 flex items-center gap-2">
                      <Award className="w-4 h-4 text-[hsl(var(--gold))]" /> Osiągnięcia ({career.trophies.length})
                    </h2>
                    <div className="flex flex-wrap gap-2">
                      {historicMajorsForPlayer(playerName).map(hm => (
                        <div
                          key={hm.id}
                          title={`Mistrz ${hm.name} z ${hm.team}`}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-[hsl(var(--gold))]/60 bg-gradient-to-r from-[hsl(var(--gold))]/20 to-transparent shadow-[0_0_18px_hsl(var(--gold)/0.35)]"
                        >
                          <span className="text-lg leading-none">🏆</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-heading font-black text-foreground truncate max-w-[160px]">{hm.name}</span>
                              <MajorBadge compact />
                            </div>
                            <p className="text-xs font-mono text-muted-foreground truncate">{hm.team} • {hm.year}</p>
                          </div>
                        </div>
                      ))}
                      {career.trophies.map(tr => {
                        const icon = tr.placement === 1 ? "🥇"
                          : tr.placement === 2 ? "🥈"
                          : tr.placement <= 4 ? "🥉" : `#${tr.placement}`;
                        const isMajorWin = isMajorName(tr.tournamentName) && tr.placement === 1;
                        const ringClass = isMajorWin ? "border-[hsl(var(--gold))]/70 bg-gradient-to-r from-[hsl(var(--gold))]/20 to-transparent shadow-[0_0_18px_hsl(var(--gold)/0.35)]"
                          : tr.placement === 1 ? "border-[hsl(var(--gold))]/50 bg-[hsl(var(--gold))]/10"
                          : tr.placement === 2 ? "border-[hsl(var(--silver))]/40 bg-[hsl(var(--silver))]/5"
                          : "border-[hsl(var(--bronze))]/40 bg-[hsl(var(--bronze))]/5";
                        return (
                          <div
                            key={tr.tournamentId}
                            className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md border", ringClass)}
                            title={`${tr.tournamentName} z ${tr.team}`}
                          >
                            <span className="text-lg leading-none">{icon}</span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <TournamentLink tournamentId={tr.tournamentId} className="block text-xs font-heading font-bold text-foreground truncate max-w-[200px]">
                                  {tr.tournamentName}
                                </TournamentLink>
                                {isMajorName(tr.tournamentName) && <MajorBadge compact />}
                              </div>
                              <p className="text-xs font-mono text-muted-foreground truncate">
                                {tr.team}{tr.endDate ? ` • ${new Date(tr.endDate).getFullYear()}` : ""}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                  className="space-y-3"
                >
                  {career.bestMatchRating && (
                    <div className="bg-card border border-primary/30 rounded-lg p-3 flex items-center gap-3">
                      <Star className="w-5 h-5 text-[hsl(var(--gold))] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-mono uppercase text-muted-foreground tracking-wider">Najlepszy mecz</p>
                        <p className={cn("text-lg font-heading font-bold tabular-nums", getRatingColor(career.bestMatchRating.rating))}>
                          {career.bestMatchRating.rating.toFixed(2)}
                          <span className="text-xs font-mono text-muted-foreground ml-1.5">vs {career.bestMatchRating.opponent}</span>
                        </p>
                      </div>
                    </div>
                  )}
                  {career.bestMapKills && (
                    <div className="bg-card border border-border rounded-lg p-3 flex items-center gap-3">
                      <Medal className="w-5 h-5 text-[hsl(var(--win))] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-mono uppercase text-muted-foreground tracking-wider">Najwięcej killi (mapa)</p>
                        <p className="text-lg font-heading font-bold tabular-nums text-foreground">
                          {career.bestMapKills.kills}
                          <span className="text-xs font-mono text-muted-foreground ml-1.5">
                            {career.bestMapKills.map} • vs {career.bestMapKills.opponent}
                          </span>
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>
            )}

            {/* === Form chart (last N matches rating) === */}
            {career.recentMatches.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="bg-card border border-border rounded-lg p-4 mb-6"
              >
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-heading font-bold text-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" /> Forma — ostatnie {Math.min(career.recentMatches.length, 15)} meczów
                  </h2>
                  <p className="text-xs font-mono text-muted-foreground">
                    Średnia: <span className={cn("font-bold", getRatingColor(career.careerRating))}>{career.careerRating.toFixed(2)}</span>
                  </p>
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={career.recentMatches.slice(0, 15).slice().reverse().map((m, i) => ({
                        idx: i + 1,
                        rating: m.rating,
                        opp: m.opponent,
                        score: m.mapScores.length > 1 ? m.mapScores.join(" | ") : (m.mapScores[0] || `${m.ownRounds}:${m.oppRounds}`),
                        won: m.won,
                      }))}
                      margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                    >
                      <XAxis dataKey="idx" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        tickLine={false}
                        domain={[(dataMin: number) => Math.min(0.5, Math.floor(dataMin * 10) / 10), (dataMax: number) => Math.max(1.5, Math.ceil(dataMax * 10) / 10)]}
                      />
                      <ReferenceLine y={1.0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" strokeOpacity={0.4} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 6,
                          fontSize: 11,
                          fontFamily: "monospace",
                        }}
                        formatter={(_v, _n, p) => {
                          const d = p.payload as { rating: number; opp: string; score: string; won: boolean };
                          return [`${d.rating.toFixed(2)} • ${d.score} ${d.won ? "W" : "L"} vs ${d.opp}`, "Rating"];
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="rating"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "hsl(var(--primary))" }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            )}

            <div className="grid lg:grid-cols-3 gap-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="lg:col-span-2 bg-card border border-border rounded-lg p-4"
              >
                <h2 className="text-sm font-heading font-bold text-foreground mb-3 flex items-center gap-2">
                  <MapIcon className="w-4 h-4 text-primary" /> Statystyki per mapa
                </h2>
                {career.perMap.length === 0 ? (
                  <p className="text-xs font-mono text-muted-foreground italic">Brak rozegranych map</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border/50">
                          <th className="text-left py-1.5 font-mono uppercase tracking-wider text-xs">Mapa</th>
                          <th className="text-center py-1.5 font-mono uppercase tracking-wider text-xs">Map</th>
                          <th className="text-center py-1.5 font-mono uppercase tracking-wider text-xs">Rating</th>
                          <th className="text-center py-1.5 font-mono uppercase tracking-wider text-xs">KPR</th>
                          <th className="text-center py-1.5 font-mono uppercase tracking-wider text-xs">ADR</th>
                          <th className="text-right py-1.5 font-mono uppercase tracking-wider text-xs">Win%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {career.perMap.map(m => (
                          <tr key={m.map} className="border-b border-border/30 hover:bg-secondary/20">
                            <td className="py-1.5 font-bold text-foreground">{m.map}</td>
                            <td className="text-center py-1.5 text-muted-foreground">{m.mapsPlayed}</td>
                            <td className={cn("text-center py-1.5 font-bold tabular-nums", getRatingColor(m.avgRating))}>
                              {m.avgRating.toFixed(2)}
                            </td>
                            <td className="text-center py-1.5 text-foreground">{m.kpr.toFixed(2)}</td>
                            <td className="text-center py-1.5 text-foreground">{m.adr}</td>
                            <td className={cn(
                              "text-right py-1.5 tabular-nums",
                              m.winRate >= 60 ? "text-[hsl(var(--win))]" : m.winRate >= 40 ? "text-foreground" : "text-[hsl(var(--loss))]",
                            )}>
                              {m.winRate}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="space-y-3"
              >
                {career.bestMap && (
                  <div className="bg-card border border-[hsl(var(--win))]/30 rounded-lg p-4">
                    <p className="text-xs font-mono uppercase text-[hsl(var(--win))] tracking-wider mb-1 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> Najlepsza mapa
                    </p>
                    <p className="text-2xl font-heading font-bold text-foreground">{career.bestMap.map}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      Rating <span className={cn("font-bold", getRatingColor(career.bestMap.rating))}>{career.bestMap.rating.toFixed(2)}</span> • {career.bestMap.mapsPlayed} map
                    </p>
                  </div>
                )}
                {career.worstMap && career.worstMap.map !== career.bestMap?.map && (
                  <div className="bg-card border border-[hsl(var(--loss))]/30 rounded-lg p-4">
                    <p className="text-xs font-mono uppercase text-[hsl(var(--loss))] tracking-wider mb-1 flex items-center gap-1">
                      <BarChart3 className="w-3 h-3" /> Słabsza mapa
                    </p>
                    <p className="text-2xl font-heading font-bold text-foreground">{career.worstMap.map}</p>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      Rating <span className={cn("font-bold", getRatingColor(career.worstMap.rating))}>{career.worstMap.rating.toFixed(2)}</span> • {career.worstMap.mapsPlayed} map
                    </p>
                  </div>
                )}

                {/* Top teammates */}
                {career.topTeammates.length > 0 && onSelectPlayer && (
                  <div className="bg-card border border-border rounded-lg p-4">
                    <p className="text-xs font-mono uppercase text-primary tracking-wider mb-2 flex items-center gap-1">
                      <UsersIcon className="w-3 h-3" /> Częsti koledzy
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {career.topTeammates.map(tm => (
                        <button
                          key={tm.teammate}
                          onClick={() => onSelectPlayer(tm.teammate)}
                          className="text-xs font-mono px-2 py-1 rounded border border-border bg-secondary/40 text-foreground hover:border-primary/50 hover:text-primary transition-colors"
                        >
                          {tm.teammate} <span className="text-muted-foreground">({tm.matches})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </div>

            {/* === Recent matches === */}
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="bg-card border border-border rounded-lg p-4 mb-6"
            >
              <h2 className="text-sm font-heading font-bold text-foreground mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" /> Ostatnie mecze ({career.recentMatches.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/50 text-xs uppercase tracking-wider">
                      <th className="text-left py-1.5">Turniej</th>
                      <th className="text-left py-1.5">Runda</th>
                      <th className="text-left py-1.5">Data</th>
                      <th className="text-left py-1.5">Przeciwnik</th>
                      <th className="text-center py-1.5">Wynik</th>
                      <th className="text-center py-1.5">K-D-A</th>
                      <th className="text-center py-1.5">ADR</th>
                      <th className="text-center py-1.5">KAST</th>
                      <th className="text-right py-1.5">Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {career.recentMatches.map(m => (
                      <tr key={m.matchId} className="border-b border-border/30 hover:bg-secondary/20">
                        <td className="py-2 text-muted-foreground truncate max-w-[160px]">
                          <TournamentLink tournamentId={m.tournamentId} title={m.tournamentName} className="block truncate">
                            {m.tournamentName}
                          </TournamentLink>
                        </td>
                        <td className="py-2 text-xs text-primary/80 truncate max-w-[120px]" title={m.round || "—"}>
                          {m.round || "—"}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {m.playedAt ? m.playedAt.slice(0, 10) : "—"}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => onSelectTeam(m.opponent)}
                            className="text-foreground hover:text-primary transition-colors font-bold"
                          >
                            vs {m.opponent}
                          </button>
                        </td>
                        <td className="text-center py-2">
                          <TournamentLink
                            tournamentId={m.tournamentId}
                            matchId={m.matchId}
                            title="Otwórz mecz"
                            className={cn(
                              "inline-block px-1.5 py-0.5 rounded font-bold tabular-nums",
                              m.won
                                ? "bg-[hsl(var(--win))]/15 text-[hsl(var(--win))]"
                                : "bg-[hsl(var(--loss))]/15 text-[hsl(var(--loss))]",
                            )}
                          >
                            {/* Bo1 → realny wynik rund zamiast 1-0 */}
                            {m.bo === 1
                              ? (m.mapScores[0]?.replace(":", "-") || `${m.ownRounds}-${m.oppRounds}`)
                              : `${m.ownScore}-${m.oppScore}`}
                          </TournamentLink>
                        </td>
                        <td className="text-center py-2 text-foreground tabular-nums">
                          {m.kills}–{m.deaths}–{m.assists}
                        </td>
                        <td className="text-center py-2 text-foreground tabular-nums">{m.adr}</td>
                        <td className="text-center py-2 text-foreground tabular-nums">{m.kast}%</td>
                        <td className={cn("text-right py-2 font-bold tabular-nums", getRatingColor(m.rating))}>
                          {m.rating.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* === Top opponents === */}
            {career.topOpponents.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="bg-card border border-border rounded-lg p-4 mb-6"
              >
                <h2 className="text-sm font-heading font-bold text-foreground mb-3 flex items-center gap-2">
                  <Crosshair className="w-4 h-4 text-primary" /> Najczęstsi przeciwnicy
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {career.topOpponents.map(op => {
                    const winRate = op.matches > 0 ? Math.round((op.wins / op.matches) * 100) : 0;
                    return (
                      <button
                        key={op.opponent}
                        onClick={() => onSelectTeam(op.opponent)}
                        className="bg-secondary/30 border border-border rounded p-2 text-center hover:border-primary/50 transition-colors"
                      >
                        <p className="text-xs font-heading font-bold text-foreground truncate">{op.opponent}</p>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                          {op.matches} mecz(ów) •
                          <span className={cn("ml-1 font-bold", winRate >= 50 ? "text-[hsl(var(--win))]" : "text-[hsl(var(--loss))]")}>
                            {winRate}%
                          </span>
                        </p>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </>
        ) : (
          <div className="bg-card border border-dashed border-border rounded-lg p-8 text-center mb-6">
            <BarChart3 className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-mono text-muted-foreground">
              Brak rozegranych meczów ze statystykami.
            </p>
            <p className="text-xs font-mono text-muted-foreground/60 mt-1">
              Wpisz wyniki i statystyki w panelu meczu, aby zobaczyć profil HLTV-style.
            </p>
          </div>
        )}

        {/* === Team season stats === */}
        {teamStanding && teamStanding.pointHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="bg-card border border-border rounded-lg p-4 mb-6"
          >
            <h2 className="text-sm font-heading font-bold text-foreground mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" /> Wyniki z drużyną (sezon 2026)
            </h2>
            <div className="space-y-1.5">
              {teamStanding.pointHistory.map(h => (
                <div key={h.tournamentId} className="flex items-center justify-between p-2 bg-secondary/20 rounded border border-border/50">
                  <div className="flex items-center gap-3">
                    <span className="text-base">{h.placement === 1 ? "🥇" : h.placement === 2 ? "🥈" : h.placement <= 4 ? "🥉" : `#${h.placement}`}</span>
                    <div>
                      <p className="font-heading font-bold text-foreground text-xs">{h.tournamentName}</p>
                      <p className="text-xs text-muted-foreground font-mono">Miejsce: #{h.placement}</p>
                    </div>
                  </div>
                  <span className={cn("font-mono font-bold text-xs", h.points >= 0 ? "text-primary" : "text-destructive")}>
                    {h.points >= 0 ? "+" : ""}{h.points} pkt
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* === Team history (stints + bench periods) === */}
        {teamHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
            className="bg-card border border-border rounded-lg p-4 mb-6"
          >
            <h2 className="text-sm font-heading font-bold text-foreground mb-3 flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-primary" /> Historia drużyn
            </h2>
            <div className="space-y-2">
              {teamHistory.map((s, i) => (
                <div key={`${s.team}-${i}`} className="p-2.5 bg-secondary/20 rounded border border-border/50">
                  <div className="flex items-center gap-2.5">
                    <TeamLogo teamName={s.team} size={24} rounded="md" />
                    <button
                      onClick={() => onSelectTeam(s.team)}
                      className="font-heading font-bold text-foreground text-sm hover:underline hover:text-primary"
                    >
                      {s.team}
                    </button>
                    <span className="ml-auto text-xs font-mono text-muted-foreground">
                      {fmtRange(s.from, s.to)}
                    </span>
                    {s.current && (
                      <span className="text-xs font-mono uppercase px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                        Obecnie
                      </span>
                    )}
                  </div>
                  {s.segments.some(seg => seg.inactive) && (
                    <div className="mt-1.5 pl-8 space-y-1">
                      {s.segments.filter(seg => seg.inactive).map((seg, j) => (
                        <div key={j} className="flex items-center gap-2 text-xs font-mono">
                          <span className="px-1.5 py-0.5 rounded bg-[hsl(var(--loss))]/15 text-[hsl(var(--loss))] uppercase">
                            Inactive
                          </span>
                          <span className="text-muted-foreground">{fmtRange(seg.from, seg.to)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* === Transfer history === */}

        {playerTransfers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-card border border-border rounded-lg p-4"
          >
            <h2 className="text-sm font-heading font-bold text-foreground mb-3 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-primary" /> Historia transferów ({playerTransfers.length})
            </h2>
            <div className="space-y-1.5">
              {playerTransfers.map((t, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-secondary/20 rounded border border-border/50">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs">
                      {t.oldTeam === "-" ? (
                        <span className="text-muted-foreground italic">Free Agent</span>
                      ) : (
                        <button
                          onClick={() => onSelectTeam(t.oldTeam)}
                          className="text-[hsl(var(--loss))] font-heading font-bold hover:underline"
                        >
                          {t.oldTeam}
                        </button>
                      )}
                      <span className="text-primary font-bold">→</span>
                      {t.newTeam === "-" ? (
                        <span className="text-muted-foreground italic">Free Agent</span>
                      ) : (
                        <button
                          onClick={() => onSelectTeam(t.newTeam)}
                          className="text-[hsl(var(--win))] font-heading font-bold hover:underline"
                        >
                          {t.newTeam}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
};

interface StatCellProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtitle?: string;
  accent?: "win" | "loss";
}

const StatCell = ({ icon: Icon, label, value, subtitle, accent }: StatCellProps) => (
  <div className="bg-card border border-border rounded-lg p-3 text-center">
    <Icon className={cn(
      "w-4 h-4 mx-auto mb-1",
      accent === "win" ? "text-[hsl(var(--win))]" : accent === "loss" ? "text-[hsl(var(--loss))]" : "text-primary",
    )} />
    <p className="text-xs font-mono uppercase text-muted-foreground tracking-wider">{label}</p>
    <p className="text-xl font-heading font-bold text-foreground tabular-nums">{value}</p>
    {subtitle && <p className="text-xs font-mono text-muted-foreground/70">{subtitle}</p>}
  </div>
);

export default PlayerProfile;
