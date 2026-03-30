// ===== ACSR World Ranking & Simulation Engine =====

export type TournamentFormat = "swiss+knockout" | "groups+knockout" | "knockout" | "major" | "league";

export interface TeamData {
  name: string;
  points: number;
  country: string;
  region: string;
  roster: string[];
}

export type QualifierType = "open" | "regional" | "none";

export interface QualificationConfig {
  inviteSlots: number;
  qualifierSlots: number;
  qualifierType: QualifierType;
  qualifierRegions?: string[];  // for regional qualifiers
  manualInviteSlots?: number;   // slots for manually invited teams (by user)
}

export interface Tournament {
  id: string;
  name: string;
  organizer: string;
  prizePool: string;
  startDate: string;
  endDate: string;
  status: "upcoming" | "live" | "completed";
  teams: number;
  location: string;
  tier: "S" | "A" | "B" | "C";
  participants: string[];
  description: string;
  format: TournamentFormat;
  formatDetails: string;
  qualification: QualificationConfig;
  qualifierCompleted?: boolean;
  qualifierParticipants?: string[];  // teams that entered qualifier
  qualifiedTeams?: string[];  // teams that won through qualifier
  invitedTeams?: string[];  // teams invited via ranking
  manualInvites?: string[];  // teams manually invited by user
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: "match" | "tournament-start" | "tournament-end" | "qualifier";
  description: string;
}

// ===== Match & Stage Types =====

export interface MatchResult {
  team1: string;
  team2: string;
  score1: number;
  score2: number;
  winner: string;
  bo: number;
}

export interface SwissRound { roundNumber: number; matches: MatchResult[]; }
export interface SwissStanding { team: string; wins: number; losses: number; qualified: boolean; eliminated: boolean; }
export interface SwissResult { rounds: SwissRound[]; standings: SwissStanding[]; qualified: string[]; eliminated: string[]; }
export interface GroupResult { groupName: string; teams: string[]; matches: MatchResult[]; standings: GroupStanding[]; qualified: string[]; }
export interface GroupStanding { team: string; wins: number; losses: number; roundDiff: number; }
export interface KnockoutRound { name: string; matches: MatchResult[]; }
export interface KnockoutResult { rounds: KnockoutRound[]; winner: string; }
export interface MajorStage { name: string; type: "swiss" | "knockout"; swiss?: SwissResult; knockout?: KnockoutResult; participants: string[]; }

export interface TournamentSimulation {
  tournamentId: string;
  format: TournamentFormat;
  swiss?: SwissResult;
  groups?: GroupResult[];
  knockout?: KnockoutResult;
  majorStages?: MajorStage[];
  winner: string;
  placements: TeamPlacement[];
}

export interface TeamPlacement {
  team: string;
  placement: number;
  points: number;
}

export interface SeasonTeamStanding {
  team: string;
  totalPoints: number;
  tournaments: number;
  wins: number;
  top4: number;
  bestPlacement: number;
  pointHistory: { tournamentId: string; tournamentName: string; placement: number; points: number }[];
}

// ===== ACSR Points System (from XLSX) =====

// Major tournaments
const majorPoints: Record<string, number> = {
  "win": 700, "2nd": 400, "semi": 250, "qf": 0,
  "advance_playoff": 200, "legends": 150, "challengers": 100,
};

// Minor tournaments (Tier A/B)
const minorPoints: Record<string, number> = {
  "win": 200, "2nd": 150, "semi": 100, "qf_group": 50, "group_r16": 30,
};

// Knockout tournaments
const knockoutPoints: Record<string, number> = {
  "win": 200, "2nd": 175, "semi": 125, "qf": 100,
  "r16": 50, "r32": 30, "r64": -20,
};

// League (ESL Pro League style)
const leaguePoints: Record<string, number> = {
  "win": 400, "2nd": 250, "playoff": 150, "stage2": 100, "survive": 50,
};

// Sub-50 tournaments
const sub50Points: Record<string, number> = {
  "win": 100, "2nd": 80, "semi": 70, "qf": 50, "playoff": 25, "r16": 25, "r32": 10,
};

// First-phase elimination penalty
const FIRST_PHASE_PENALTY = -20;
// Forfeit penalty
const FORFEIT_PENALTY = -30;

export function getPointsForPlacement(tier: string, placement: number, format: TournamentFormat, isSubRank50: boolean = false): number {
  if (isSubRank50) {
    if (placement === 1) return sub50Points["win"];
    if (placement === 2) return sub50Points["2nd"];
    if (placement <= 4) return sub50Points["semi"];
    if (placement <= 8) return sub50Points["qf"];
    if (placement <= 16) return sub50Points["r16"];
    if (placement <= 32) return sub50Points["r32"];
    return FIRST_PHASE_PENALTY;
  }

  if (format === "major") {
    if (placement === 1) return majorPoints["win"];
    if (placement === 2) return majorPoints["2nd"];
    if (placement <= 4) return majorPoints["semi"] + majorPoints["advance_playoff"];
    if (placement <= 8) return majorPoints["advance_playoff"];
    if (placement <= 16) return majorPoints["legends"];
    if (placement <= 24) return majorPoints["challengers"];
    return FIRST_PHASE_PENALTY;
  }

  if (format === "league") {
    if (placement === 1) return leaguePoints["win"];
    if (placement === 2) return leaguePoints["2nd"];
    if (placement <= 8) return leaguePoints["playoff"];
    if (placement <= 16) return leaguePoints["stage2"];
    return leaguePoints["survive"];
  }

  if (format === "knockout") {
    if (placement === 1) return knockoutPoints["win"];
    if (placement === 2) return knockoutPoints["2nd"];
    if (placement <= 4) return knockoutPoints["semi"];
    if (placement <= 8) return knockoutPoints["qf"];
    if (placement <= 16) return knockoutPoints["r16"];
    if (placement <= 32) return knockoutPoints["r32"];
    return FIRST_PHASE_PENALTY;
  }

  // Minor (swiss+knockout, groups+knockout)
  if (placement === 1) return minorPoints["win"];
  if (placement === 2) return minorPoints["2nd"];
  if (placement <= 4) return minorPoints["semi"];
  if (placement <= 8) return minorPoints["qf_group"];
  if (placement <= 16) return minorPoints["group_r16"];
  return FIRST_PHASE_PENALTY;
}

export function derivePlacements(sim: TournamentSimulation, tournament: Tournament): TeamPlacement[] {
  const placements: TeamPlacement[] = [];

  if (sim.knockout) {
    const rounds = sim.knockout.rounds;
    const finalMatch = rounds[rounds.length - 1]?.matches[0];
    if (finalMatch) {
      placements.push({ team: finalMatch.winner, placement: 1, points: 0 });
      const loser = finalMatch.winner === finalMatch.team1 ? finalMatch.team2 : finalMatch.team1;
      placements.push({ team: loser, placement: 2, points: 0 });
    }
    if (rounds.length >= 2) {
      const semis = rounds[rounds.length - 2].matches;
      let place = 3;
      semis.forEach(m => {
        const loser = m.winner === m.team1 ? m.team2 : m.team1;
        if (!placements.find(p => p.team === loser)) {
          placements.push({ team: loser, placement: place++, points: 0 });
        }
      });
    }
    for (let r = rounds.length - 3; r >= 0; r--) {
      const startPlace = placements.length + 1;
      rounds[r].matches.forEach(m => {
        const loser = m.winner === m.team1 ? m.team2 : m.team1;
        if (loser !== "BYE" && !placements.find(p => p.team === loser)) {
          placements.push({ team: loser, placement: startPlace, points: 0 });
        }
      });
    }
  }

  const placed = new Set(placements.map(p => p.team));
  let nextPlace = placements.length + 1;

  if (sim.swiss) {
    sim.swiss.eliminated.forEach(t => {
      if (!placed.has(t)) { placements.push({ team: t, placement: nextPlace++, points: 0 }); placed.add(t); }
    });
  }
  if (sim.groups) {
    sim.groups.forEach(g => {
      g.teams.forEach(t => {
        if (!placed.has(t)) { placements.push({ team: t, placement: nextPlace++, points: 0 }); placed.add(t); }
      });
    });
  }
  if (sim.majorStages) {
    for (let i = sim.majorStages.length - 1; i >= 0; i--) {
      const stage = sim.majorStages[i];
      if (stage.swiss) {
        stage.swiss.eliminated.forEach(t => {
          if (!placed.has(t)) { placements.push({ team: t, placement: nextPlace++, points: 0 }); placed.add(t); }
        });
      }
    }
  }

  const allTeams = new Set(tournament.participants.slice(0, tournament.teams));
  allTeams.forEach(t => {
    if (!placed.has(t)) { placements.push({ team: t, placement: nextPlace++, points: 0 }); }
  });

  placements.forEach(p => {
    p.points = getPointsForPlacement(tournament.tier, p.placement, tournament.format);
  });

  return placements;
}

export function calculateSeasonStandings(
  tournaments: Tournament[],
  simResults: Record<string, TournamentSimulation>
): SeasonTeamStanding[] {
  const standings: Record<string, SeasonTeamStanding> = {};

  for (const t of tournaments) {
    const sim = simResults[t.id];
    if (!sim) continue;
    sim.placements.forEach(p => {
      if (!standings[p.team]) {
        standings[p.team] = { team: p.team, totalPoints: 0, tournaments: 0, wins: 0, top4: 0, bestPlacement: 999, pointHistory: [] };
      }
      const s = standings[p.team];
      s.totalPoints += p.points;
      s.tournaments++;
      if (p.placement === 1) s.wins++;
      if (p.placement <= 4) s.top4++;
      if (p.placement < s.bestPlacement) s.bestPlacement = p.placement;
      s.pointHistory.push({ tournamentId: t.id, tournamentName: t.name, placement: p.placement, points: p.points });
    });
  }

  return Object.values(standings).sort((a, b) => b.totalPoints - a.totalPoints);
}

// ===== Simulation Logic =====

export function simulateMatch(team1: string, team2: string, bo: number): MatchResult {
  const winsNeeded = Math.ceil(bo / 2);
  let s1 = 0, s2 = 0;
  // Strength based on ranking position
  const rank1 = teamDatabase.findIndex(t => t.name === team1);
  const rank2 = teamDatabase.findIndex(t => t.name === team2);
  const r1 = rank1 >= 0 ? rank1 : 50;
  const r2 = rank2 >= 0 ? rank2 : 50;
  // Higher ranked = lower index = stronger. Winrate range: ~40% to ~60%
  const diff = r2 - r1; // positive means team1 is better
  const baseWin = 0.5 + Math.tanh(diff / 30) * 0.12;

  while (s1 < winsNeeded && s2 < winsNeeded) {
    if (Math.random() < baseWin) s1++;
    else s2++;
  }
  return { team1, team2, score1: s1, score2: s2, winner: s1 > s2 ? team1 : team2, bo };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function simulateSwiss(teams: string[], winsToQualify = 3, lossesToEliminate = 3): SwissResult {
  const standings: SwissStanding[] = teams.map(t => ({ team: t, wins: 0, losses: 0, qualified: false, eliminated: false }));
  const rounds: SwissRound[] = [];

  for (let roundNum = 1; roundNum <= winsToQualify + lossesToEliminate - 1; roundNum++) {
    const active = standings.filter(s => !s.qualified && !s.eliminated);
    if (active.length < 2) break;

    const byRecord: Record<string, SwissStanding[]> = {};
    active.forEach(s => {
      const key = `${s.wins}-${s.losses}`;
      if (!byRecord[key]) byRecord[key] = [];
      byRecord[key].push(s);
    });

    const matches: MatchResult[] = [];
    const paired = new Set<string>();
    const records = Object.keys(byRecord).sort((a, b) => {
      const [aw] = a.split("-").map(Number);
      const [bw] = b.split("-").map(Number);
      return bw - aw;
    });

    let unpaired: SwissStanding[] = [];

    for (const record of records) {
      const pool = shuffle([...unpaired, ...byRecord[record]]);
      unpaired = [];

      for (let i = 0; i < pool.length - 1; i += 2) {
        if (paired.has(pool[i].team) || paired.has(pool[i + 1].team)) {
          if (!paired.has(pool[i].team)) unpaired.push(pool[i]);
          if (!paired.has(pool[i + 1].team)) unpaired.push(pool[i + 1]);
          continue;
        }
        const isDecider = pool[i].wins === winsToQualify - 1 || pool[i].losses === lossesToEliminate - 1;
        const bo = isDecider ? 3 : 1;
        const result = simulateMatch(pool[i].team, pool[i + 1].team, bo);
        matches.push(result);
        paired.add(pool[i].team);
        paired.add(pool[i + 1].team);

        const winnerStanding = standings.find(s => s.team === result.winner)!;
        const loserTeam = result.winner === result.team1 ? result.team2 : result.team1;
        const loserStanding = standings.find(s => s.team === loserTeam)!;
        winnerStanding.wins++;
        loserStanding.losses++;
        if (winnerStanding.wins >= winsToQualify) winnerStanding.qualified = true;
        if (loserStanding.losses >= lossesToEliminate) loserStanding.eliminated = true;
      }

      if (pool.length % 2 === 1 && !paired.has(pool[pool.length - 1].team)) {
        unpaired.push(pool[pool.length - 1]);
      }
    }

    if (matches.length > 0) rounds.push({ roundNumber: roundNum, matches });
    const remaining = standings.filter(s => !s.qualified && !s.eliminated);
    if (remaining.length < 2) break;
  }

  return {
    rounds,
    standings: standings.sort((a, b) => b.wins - a.wins || a.losses - b.losses),
    qualified: standings.filter(s => s.qualified).map(s => s.team),
    eliminated: standings.filter(s => s.eliminated).map(s => s.team),
  };
}

export function simulateGroups(teams: string[], groupCount: number, advancePerGroup: number): GroupResult[] {
  const shuffled = shuffle(teams);
  const perGroup = Math.ceil(shuffled.length / groupCount);
  const groups: GroupResult[] = [];

  for (let g = 0; g < groupCount; g++) {
    const groupTeams = shuffled.slice(g * perGroup, (g + 1) * perGroup);
    const groupName = String.fromCharCode(65 + g);
    const matches: MatchResult[] = [];
    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        matches.push(simulateMatch(groupTeams[i], groupTeams[j], 1));
      }
    }
    const standingsMap: Record<string, GroupStanding> = {};
    groupTeams.forEach(t => { standingsMap[t] = { team: t, wins: 0, losses: 0, roundDiff: 0 }; });
    matches.forEach(m => {
      standingsMap[m.winner].wins++;
      const loser = m.winner === m.team1 ? m.team2 : m.team1;
      standingsMap[loser].losses++;
      standingsMap[m.team1].roundDiff += m.score1 - m.score2;
      standingsMap[m.team2].roundDiff += m.score2 - m.score1;
    });
    const sorted = Object.values(standingsMap).sort((a, b) => b.wins - a.wins || b.roundDiff - a.roundDiff);
    const qualified = sorted.slice(0, advancePerGroup).map(s => s.team);
    groups.push({ groupName, teams: groupTeams, matches, standings: sorted, qualified });
  }
  return groups;
}

export function simulateKnockout(teams: string[], startBo = 3): KnockoutResult {
  const rounds: KnockoutRound[] = [];
  let currentTeams = [...teams];
  let size = 2;
  while (size < currentTeams.length) size *= 2;
  while (currentTeams.length < size) currentTeams.push("BYE");
  const totalRounds = Math.log2(size);
  const roundNameMap: Record<number, string> = {};
  for (let r = 1; r <= totalRounds; r++) {
    const remaining = size / Math.pow(2, r - 1);
    if (remaining === 2) roundNameMap[r] = "Grand Final";
    else if (remaining === 4) roundNameMap[r] = "Półfinały";
    else if (remaining === 8) roundNameMap[r] = "Ćwierćfinały";
    else if (remaining === 16) roundNameMap[r] = "1/8 Finału";
    else roundNameMap[r] = `Runda ${r}`;
  }
  for (let r = 1; r <= totalRounds; r++) {
    const matches: MatchResult[] = [];
    const bo = r === totalRounds ? 5 : r >= totalRounds - 1 ? 3 : startBo;
    for (let i = 0; i < currentTeams.length; i += 2) {
      const t1 = currentTeams[i];
      const t2 = currentTeams[i + 1] || "BYE";
      if (t2 === "BYE") {
        matches.push({ team1: t1, team2: "BYE", score1: 2, score2: 0, winner: t1, bo });
      } else {
        matches.push(simulateMatch(t1, t2, bo));
      }
    }
    rounds.push({ name: roundNameMap[r] || `Runda ${r}`, matches });
    currentTeams = matches.map(m => m.winner);
  }
  return { rounds, winner: currentTeams[0] };
}

export function simulateTournament(tournament: Tournament): TournamentSimulation {
  const teams = tournament.participants.slice(0, tournament.teams);
  let sim: TournamentSimulation;

  if (tournament.format === "knockout") {
    const knockout = simulateKnockout(teams);
    sim = { tournamentId: tournament.id, format: "knockout", knockout, winner: knockout.winner, placements: [] };
  } else if (tournament.format === "swiss+knockout") {
    const swiss = simulateSwiss(teams, 3, 3);
    const knockout = simulateKnockout(swiss.qualified.slice(0, 8));
    sim = { tournamentId: tournament.id, format: "swiss+knockout", swiss, knockout, winner: knockout.winner, placements: [] };
  } else if (tournament.format === "groups+knockout") {
    const groupCount = teams.length <= 8 ? 2 : teams.length <= 16 ? 4 : 4;
    const groups = simulateGroups(teams, groupCount, 2);
    const advancedTeams = groups.flatMap(g => g.qualified);
    const knockout = simulateKnockout(advancedTeams);
    sim = { tournamentId: tournament.id, format: "groups+knockout", groups, knockout, winner: knockout.winner, placements: [] };
  } else if (tournament.format === "league") {
    const swiss = simulateSwiss(teams, 3, 3);
    const knockout = simulateKnockout(swiss.qualified.slice(0, 8));
    sim = { tournamentId: tournament.id, format: "league", swiss, knockout, winner: knockout.winner, placements: [] };
  } else if (tournament.format === "major") {
    const allTeams = shuffle(teams);
    const challengerTeams = allTeams.slice(8, 24).length >= 16 ? allTeams.slice(8, 24) : allTeams.slice(Math.max(0, allTeams.length - 16));
    const stage1Swiss = simulateSwiss(challengerTeams.slice(0, 16), 3, 3);
    const legendTeams = [...allTeams.slice(0, 8), ...stage1Swiss.qualified.slice(0, 8)];
    const stage2Swiss = simulateSwiss(legendTeams, 3, 3);
    const playoffTeams = stage2Swiss.qualified.slice(0, 8);
    const playoffs = simulateKnockout(playoffTeams, 3);
    const majorStages: MajorStage[] = [
      { name: "Stage 1: Challengers", type: "swiss", swiss: stage1Swiss, participants: challengerTeams.slice(0, 16) },
      { name: "Stage 2: Legends", type: "swiss", swiss: stage2Swiss, participants: legendTeams },
      { name: "Stage 3: Champions (Playoffs)", type: "knockout", knockout: playoffs, participants: playoffTeams },
    ];
    sim = { tournamentId: tournament.id, format: "major", majorStages, winner: playoffs.winner, placements: [] };
  } else {
    const knockout = simulateKnockout(teams);
    sim = { tournamentId: tournament.id, format: "knockout", knockout, winner: knockout.winner, placements: [] };
  }

  sim.placements = derivePlacements(sim, tournament);
  return sim;
}

// ===== ACSR Team Database (100 teams) =====

export const teamDatabase: TeamData[] = [
  { name: "Team Falcons", points: 2440, country: "EU", region: "EU", roster: ["blameF", "TeSeS", "ZywOo", "apEX", "kyxsan"] },
  { name: "Windigo", points: 1925, country: "BUL", region: "EU", roster: ["bubble", "nukkye", "ArtFr0sT", "dem0n", "sh1ro"] },
  { name: "GalactiC", points: 1620, country: "USA", region: "US", roster: ["firaXi", "TaReX", "svaipZ", "PlesseN", "EliGE"] },
  { name: "AVANGAR", points: 1370, country: "KAZ", region: "EU", roster: ["SANJI", "bl3nd", "MazloV", "zont1x", "VolTage"] },
  { name: "Vitality", points: 1330, country: "FRA", region: "EU", roster: ["hantZ", "JACKZ", "mezii", "ropz", "AcilioN"] },
  { name: "LT Twisted Minds", points: 1285, country: "LTU", region: "EU", roster: ["ToKsin", "EspiranTo", "SanTeliS", "jL", "Horus"] },
  { name: "FunPlus Phoenix", points: 1215, country: "FRA", region: "EU", roster: ["xms", "to1nou", "myez", "Lucky", "Kursy"] },
  { name: "FURIA", points: 1150, country: "BRA", region: "LATAM", roster: ["molodoy", "arT", "KSCERATO", "yuurih", "FalleN"] },
  { name: "Team Liquid", points: 1090, country: "USA", region: "US", roster: ["NAF", "Twistzz", "YEKINDAR", "maden", "ultimate"] },
  { name: "The MongolZ", points: 1085, country: "MNG", region: "ASIA", roster: ["dazLoco", "Mzinho", "Senzu", "Techno4k", "bLitz"] },
  { name: "Vision Gaming", points: 1000, country: "SWE", region: "EU", roster: ["nats", "dennis", "draken", "KeZi", "RusTy"] },
  { name: "FaZe Clan", points: 970, country: "EU", region: "EU", roster: ["SunPayus", "frozen", "NiKo", "AcreoN", "iM"] },
  { name: "Movistar Riders", points: 925, country: "ESP", region: "EU", roster: ["MuTiRiS", "loWel", "dav1g", "cadmo", "iNSTiNCT"] },
  { name: "NRG eSports", points: 925, country: "USA", region: "US", roster: ["CeRq", "nitr0", "Xyp9x", "ottoNd", "KmZ"] },
  { name: "North", points: 870, country: "DEN", region: "EU", roster: ["exxon", "cadiaN", "HUNDEN", "Magisk", "nicoodoz"] },
  { name: "Sprout", points: 830, country: "GER", region: "EU", roster: ["dantamax", "iSt3s", "Spiidi", "teNzki", "Tr1xie"] },
  { name: "Grayhound", points: 795, country: "AUS", region: "OCE", roster: ["malta", "Fairlii", "angeL", "INS", "satoshi"] },
  { name: "Team Spirit", points: 795, country: "RUS", region: "EU", roster: ["donk", "iDISBALANCE", "FL1T", "chopper", "m0NESY"] },
  { name: "MVP Project", points: 765, country: "KOR", region: "ASIA", roster: ["xcurrate", "jBk", "henox", "derkos", "XigN"] },
  { name: "Complexity", points: 735, country: "USA", region: "US", roster: ["elemeNt", "sjuush", "aproTo", "oBo", "NikkeZ"] },
  { name: "MOUZ", points: 695, country: "GER", region: "EU", roster: ["kRYSTAL", "syrsoN", "Spinx", "huNter", "REZ"] },
  { name: "Astralis", points: 615, country: "DEN", region: "EU", roster: ["jabbi", "dev1ce", "v4lde", "Snappi", "HooXi"] },
  { name: "Bravado Gaming", points: 585, country: "RSA", region: "AFR", roster: ["Bizzy", "bLiZzard", "arkiN", "MisteM", "EleTrick"] },
  { name: "OG eSports", points: 580, country: "EU", region: "EU", roster: ["mantuu", "hutji", "SHiPZ", "es3tag", "dexter"] },
  { name: "VOX Eminor", points: 555, country: "AUS", region: "OCE", roster: ["dither", "scarra", "proSeN", "f1nest", "Gratisfaction"] },
  { name: "Eternal Fire", points: 550, country: "TUR", region: "ASIA", roster: ["MAJ3R", "Wicadia", "Calyx", "XANTARES", "w0xic"] },
  { name: "Natus Vincere", points: 530, country: "UKR", region: "EU", roster: ["b1t", "poizon", "Makazze", "electronic", "malbsMd"] },
  { name: "Astana Dragons", points: 520, country: "KAZ", region: "EU", roster: ["KrizzeN", "qikert", "griff", "frontales", "neaLaN"] },
  { name: "ENCE", points: 505, country: "FIN", region: "EU", roster: ["Aleksib", "allu", "Kaaymos", "xseveN", "LETN1"] },
  { name: "Ijsberen eSports", points: 500, country: "NED", region: "EU", roster: ["sefa", "PCK", "MissK8", "ElStaK", "ZykloN"] },
  { name: "FlyQuest", points: 490, country: "AUS", region: "OCE", roster: ["liazz", "jks", "AZR", "USTILO", "Nifty"] },
  { name: "Amkal", points: 485, country: "RUS", region: "EU", roster: ["hypr", "v1tal", "keshandr", "gr1ks", "kyousuke"] },
  { name: "Pollen Tantrum", points: 475, country: "NZL", region: "OCE", roster: ["xertz", "RaZ", "aslan", "sterling", "nebet"] },
  { name: "Parivision", points: 460, country: "SRB", region: "EU", roster: ["sdy", "KaiR0N-", "Neityu", "torzsi", "Magnojez"] },
  { name: "x6tence galaxy", points: 455, country: "SWE", region: "EU", roster: ["coRoZz", "spyder", "shimari", "Polen", "LoReN"] },
  { name: "NiP", points: 455, country: "SWE", region: "EU", roster: ["hampus", "Lekr0", "ZyTre", "KRIMZ", "Benzn"] },
  { name: "Inner Circle", points: 445, country: "SVN", region: "EU", roster: ["saveey", "jR", "NEOFRAG", "jank0", "stressarN"] },
  { name: "IHC eSports", points: 430, country: "MNG", region: "ASIA", roster: ["kabal", "sk0r", "ANNIHILA", "hasteka", "910"] },
  { name: "Splyce", points: 430, country: "USA", region: "US", roster: ["zOOt", "deficit", "Kila", "primaL", "RFX"] },
  { name: "3Dmax", points: 415, country: "BEL", region: "EU", roster: ["VirreN", "Ex3rcice", "ryL", "TrusT", "Graviti"] },
  { name: "Entropiq", points: 400, country: "EU", region: "EU", roster: ["MariX", "syco", "h0bbit", "Krimbo", "MaXi"] },
  { name: "paiN Gaming", points: 400, country: "BRA", region: "LATAM", roster: ["felps", "cerdaN", "biguzera", "snow", "abone"] },
  { name: "Sinister5", points: 400, country: "RSA", region: "AFR", roster: ["scheeR", "Chappy", "ruben", "godspeed", "tr1ton"] },
  { name: "Gamers2", points: 390, country: "KOR", region: "ASIA", roster: ["xeta", "iKo", "ryuk", "poL1tz", "DD"] },
  { name: "Keyd Stars", points: 390, country: "BRA", region: "LATAM", roster: ["t9rnay", "abr", "brnz4n", "insani", "kye"] },
  { name: "Ancient", points: 385, country: "USA", region: "US", roster: ["shroud", "aykeN", "DeadFox", "jasonR", "craen"] },
  { name: "Syman Gaming", points: 385, country: "MNG", region: "ASIA", roster: ["erkaSt", "MagnumZ", "lucid", "cool4st", "laxiee"] },
  { name: "KRU eSports", points: 385, country: "ARG", region: "LATAM", roster: ["Noktse", "yeL", "meyern", "kriT", "kinho"] },
  { name: "Game Agents", points: 380, country: "HUN", region: "EU", roster: ["kolor", "ngiN", "eLiVe", "Zero", "paz"] },
  { name: "Rogue", points: 380, country: "DEN", region: "EU", roster: ["SkerZ", "playn", "double", "quaKe", "xprt"] },
  { name: "ATK", points: 375, country: "LBY", region: "AFR", roster: ["mendo", "vice", "yukar", "Pot1on", "pOp"] },
  { name: "Apeks", points: 375, country: "NOR", region: "EU", roster: ["jkaem", "hallzerk", "isak", "crusaDe", "Xander"] },
  { name: "Renegades", points: 375, country: "AUS", region: "OCE", roster: ["vexite", "cam1x", "xsepower", "nettik", "oSee"] },
  { name: "Evil Geniuses", points: 370, country: "USA", region: "US", roster: ["skyhe", "zanz", "st1ch", "JDC", "zyoN"] },
  { name: "Dream Eaters", points: 370, country: "NED", region: "EU", roster: ["addicT", "s1mke", "FASHR", "PakG", "vince"] },
  { name: "Got200 Gaming", points: 370, country: "GER", region: "EU", roster: ["vanisch", "Qwickshel", "davy", "lynX", "flame"] },
  { name: "9ine", points: 370, country: "POL", region: "EU", roster: ["KEi", "Demho", "KMX", "Prism", "hades"] },
  { name: "Valhalla", points: 370, country: "ISL", region: "EU", roster: ["diaXuuN", "HUNDZi", "EdezeNNN", "em3radic", "Bjarni"] },
  { name: "Legacy", points: 365, country: "BRA", region: "LATAM", roster: ["dumau", "latto", "saadziN", "danoCo", "lux"] },
  { name: "Space Soldiers", points: 365, country: "TUR", region: "ASIA", roster: ["DESPE", "imoRR", "TuGuX", "EMSTAR", "hardstyle"] },
  { name: "Cr4zy", points: 365, country: "EU", region: "EU", roster: ["Woro2k", "DemQQ", "rain", "ISSAA", "stanislaw"] },
  { name: "Heroic", points: 360, country: "DEN", region: "EU", roster: ["Alkaren", "tn1R", "stavn", "aizy", "LNZ"] },
  { name: "Portal", points: 355, country: "PAK", region: "ASIA", roster: ["HSB", "traNz", "PokemoN", "Yaqob", "StoraX"] },
  { name: "Bad News Eagles", points: 345, country: "KOS", region: "EU", roster: ["SENER1", "gxx-", "Krabeni", "sinopsyy", "rigoN"] },
  { name: "Quantum Bellator", points: 340, country: "EGY", region: "AFR", roster: ["x1ron", "kasya", "saRRafi", "raizo", "pa1nkiller"] },
  { name: "BIG", points: 340, country: "GER", region: "EU", roster: ["gob b", "keev", "xfl0ud", "hippo", "k1to"] },
  { name: "Imperial", points: 335, country: "BRA", region: "LATAM", roster: ["boltz", "VINI", "chelo", "skullz", "zakk"] },
  { name: "fnatic", points: 335, country: "SWE", region: "EU", roster: ["Brollan", "Xizt", "kyuubii", "modurist", "sheddaN"] },
  { name: "9z Team", points: 330, country: "ARG", region: "LATAM", roster: ["dgt", "max", "dav1deuS", "buda", "try"] },
  { name: "Team Immunity", points: 315, country: "AUS", region: "OCE", roster: ["bURNRUOk", "MoeycQ", "james", "MAGIKKK", "gazR"] },
  { name: "Marsborne", points: 310, country: "USA", region: "US", roster: ["GriZz", "gonzo", "ToraTTi", "Pengu1n", "mst"] },
  { name: "GODSENT", points: 300, country: "SWE", region: "EU", roster: ["eXpeL", "zehN", "pr1metapz", "stan", "polaroid"] },
  { name: "GamerLegion", points: 300, country: "SWE", region: "EU", roster: ["ztr", "PR", "faveN", "MATYS", "hypex"] },
  { name: "M80", points: 300, country: "USA", region: "US", roster: ["wonder", "maNkz", "dazzLe", "Lake", "reck"] },
  { name: "Penta Sports", points: 295, country: "GER", region: "EU", roster: ["awzek", "s1n", "PANIX", "innocent", "hyped"] },
  { name: "Wildcard", points: 290, country: "USA", region: "US", roster: ["JBa", "Swisher", "br0", "XotiC", "nicx"] },
  { name: "Vexed Gaming", points: 290, country: "USA", region: "US", roster: ["coSbo", "AciDiC", "redge0", "RitZy", "depthSpider"] },
  { name: "TyLoo", points: 280, country: "CHN", region: "ASIA", roster: ["Moseyuh", "BnTeT", "fancy", "JamYoung", "Jee"] },
  { name: "Epsilon eSports", points: 265, country: "EU", region: "EU", roster: ["NaqeLi", "maka", "mKadin", "antika", "Creo"] },
  { name: "Nexus", points: 265, country: "ROU", region: "EU", roster: ["arc", "regali", "lauNX", "kavenTo", "ZetioN"] },
  { name: "Betclic Apogee", points: 255, country: "POL", region: "EU", roster: ["TaZ", "hfah", "jcobbb", "Kylar", "Melavi"] },
  { name: "Nemiga", points: 255, country: "EST", region: "EU", roster: ["Jyo", "Frynaut", "botez", "boX", "evire"] },
  { name: "OpTic Gaming", points: 255, country: "USA", region: "US", roster: ["JUGi", "gade", "jdm64", "Skadoodle", "FreakZ"] },
  { name: "Lazarus eSports", points: 250, country: "CAN", region: "US", roster: ["FNS", "Subroza", "yay", "infinite", "wardell"] },
  { name: "NoLimit Gaming", points: 250, country: "EU", region: "EU", roster: ["s4nzy", "GaXe", "rasmus", "basiq", "toggler"] },
  { name: "Endpoint", points: 250, country: "UK", region: "EU", roster: ["spektra", "jeLLo", "sl3nd", "KanOx", "CRUC1AL"] },
  { name: "Parallax", points: 240, country: "NZL", region: "OCE", roster: ["Hatz", "Lonsdale", "yellow", "sico", "kyoto"] },
  { name: "Astra Vendetta", points: 235, country: "FJI", region: "OCE", roster: ["kaarT", "filian", "5erene5", "SkarmaT", "leveni"] },
  { name: "Fluxo", points: 235, country: "MEX", region: "US", roster: ["v$m", "astera", "PuFFy", "chuti", "Spamzzy"] },
  { name: "Third Impact", points: 235, country: "USA", region: "US", roster: ["RZU", "grape", "DaneJoris", "mont4na", "xCeeD"] },
  { name: "Mythic", points: 235, country: "CAN", region: "US", roster: ["fl0m", "hate", "cooper", "freakazoid", "cxzi"] },
  { name: "FUT eSports", points: 235, country: "EU", region: "EU", roster: ["eclyon", "SparkZ", "kriMp", "v1caR", "Xaka"] },
  { name: "Renevant eSports", points: 230, country: "MYS", region: "ASIA", roster: ["3nable", "argenT", "fluckZ", "GFi", "kaZe"] },
  { name: "9Pandas", points: 230, country: "CHN", region: "ASIA", roster: ["r3salt", "d1Ledez", "zhoKing", "Krad", "s1kura"] },
  { name: "Tengri", points: 225, country: "KGY", region: "ASIA", roster: ["SNk", "ProjeksT", "Ramz1k", "enzero", "yaqK"] },
  { name: "Rare Atom", points: 225, country: "IND", region: "ASIA", roster: ["nJta", "baLi", "enlai", "kaito", "abiLo"] },
  { name: "ZIGMA", points: 225, country: "THA", region: "ASIA", roster: ["RoLEX", "NIFFY", "GeniusSs", "j9", "hxskxth"] },
  { name: "Lynn Vision", points: 220, country: "CHN", region: "ASIA", roster: ["EmiliaQaQ", "Su3", "z4kr", "Starry", "westmelon"] },
  { name: "InSilio", points: 220, country: "AZE", region: "ASIA", roster: ["sugaR", "t0rick", "veslaR", "tokuzo", "zanxxX"] },
  { name: "Sharks", points: 220, country: "BRA", region: "LATAM", roster: ["chay", "drg", "Gafolo", "rdnzao", "n1ssim"] },
];

// Tier helpers
export const tier1Teams = teamDatabase.slice(0, 10).map(t => t.name);
export const tier2Teams = teamDatabase.slice(10, 30).map(t => t.name);
export const tier3Teams = teamDatabase.slice(30, 60).map(t => t.name);
export const tier4Teams = teamDatabase.slice(60).map(t => t.name);

export function teamsByRegion(region: string): string[] {
  return teamDatabase.filter(t => t.region === region).map(t => t.name);
}

// Region display names
export const regionNames: Record<string, string> = {
  EU: "Europa",
  US: "Ameryka Północna",
  LATAM: "Ameryka Południowa",
  ASIA: "Azja",
  OCE: "Oceania",
  AFR: "Afryka",
};

// Calculate regional slot distribution based on region strength in ranking
export function getRegionalSlotDistribution(
  qualifierSlots: number,
  regions: string[],
  dynamicRanking: TeamData[]
): Record<string, number> {
  if (regions.length === 0) return {};
  
  // Calculate strength per region: sum of (maxRank - rank) for top teams
  const regionStrength: Record<string, number> = {};
  const maxRank = dynamicRanking.length;
  
  regions.forEach(region => {
    const regionTeams = dynamicRanking.filter(t => t.region === region);
    // Strength = sum of points of all region teams
    regionStrength[region] = regionTeams.reduce((sum, t) => sum + t.points, 0);
  });
  
  const totalStrength = Object.values(regionStrength).reduce((a, b) => a + b, 0);
  if (totalStrength === 0) {
    // Equal distribution
    const perRegion = Math.floor(qualifierSlots / regions.length);
    const result: Record<string, number> = {};
    regions.forEach((r, i) => {
      result[r] = perRegion + (i < qualifierSlots % regions.length ? 1 : 0);
    });
    return result;
  }
  
  // Proportional distribution, minimum 1 slot per region
  const result: Record<string, number> = {};
  let remaining = qualifierSlots;
  
  // Sort by strength descending
  const sorted = [...regions].sort((a, b) => (regionStrength[b] || 0) - (regionStrength[a] || 0));
  
  // First pass: assign proportional slots
  const rawSlots: Record<string, number> = {};
  sorted.forEach(region => {
    const proportion = (regionStrength[region] || 0) / totalStrength;
    rawSlots[region] = Math.max(1, Math.round(qualifierSlots * proportion));
  });
  
  // Adjust to match total
  let total = Object.values(rawSlots).reduce((a, b) => a + b, 0);
  while (total > qualifierSlots) {
    // Remove from weakest region (but keep min 1)
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (rawSlots[sorted[i]] > 1) {
        rawSlots[sorted[i]]--;
        total--;
        if (total <= qualifierSlots) break;
      }
    }
  }
  while (total < qualifierSlots) {
    // Add to strongest region
    rawSlots[sorted[0]]++;
    total++;
  }
  
  return rawSlots;
}

// Get qualifier pool for a specific region
export function getRegionalQualifierPool(
  tournament: Tournament,
  dynamicRanking: TeamData[],
  invitedTeams: string[],
  region: string
): string[] {
  const invitedSet = new Set(invitedTeams);
  let pool = dynamicRanking.filter(t => !invitedSet.has(t.name) && t.region === region);
  
  const tierSkip: Record<string, number> = { 'S': 0, 'A': 2, 'B': 0, 'C': 4 };
  const skip = tierSkip[tournament.tier] || 0;
  if (skip > 0) pool = pool.slice(skip);
  
  return pool.slice(0, 32).map(t => t.name);
}


// ===== Qualification System =====

export function getDefaultQualification(tier: 'S' | 'A' | 'B' | 'C', teams: number): QualificationConfig {
  switch (tier) {
    case 'S': return { inviteSlots: Math.min(8, Math.floor(teams / 2)), qualifierSlots: teams - Math.min(8, Math.floor(teams / 2)), qualifierType: 'regional', qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'] };
    case 'A': return { inviteSlots: Math.min(12, Math.floor(teams * 0.75)), qualifierSlots: teams - Math.min(12, Math.floor(teams * 0.75)), qualifierType: 'regional', qualifierRegions: ['EU', 'US'] };
    case 'B': return { inviteSlots: teams, qualifierSlots: 0, qualifierType: 'none' };
    case 'C': return { inviteSlots: 0, qualifierSlots: teams, qualifierType: 'open' };
  }
}

export function getDynamicRanking(
  baseTeams: TeamData[],
  simResults: Record<string, TournamentSimulation>,
  tournaments: Tournament[]
): TeamData[] {
  const pointsMap: Record<string, number> = {};
  baseTeams.forEach(t => { pointsMap[t.name] = t.points; });
  
  // Add placement points + ELO match points
  for (const t of tournaments) {
    const sim = simResults[t.id];
    if (!sim) continue;
    const tournament = tournaments.find(tr => tr.id === t.id);
    if (!tournament) continue;

    // Placement points
    sim.placements.forEach(p => {
      if (!pointsMap[p.team]) pointsMap[p.team] = 0;
      pointsMap[p.team] += p.points;
    });

    // ELO match points
    const allMatches = collectAllSimMatches(sim);
    const tempRanking = [...baseTeams]
      .map(team => ({ ...team, points: pointsMap[team.name] || team.points }))
      .sort((a, b) => b.points - a.points);
    
    const kFactor = tournament.tier === "S" ? 40 : tournament.tier === "A" ? 30 : tournament.tier === "B" ? 20 : 12;
    
    for (const match of allMatches) {
      if (match.winner === "" || match.team2 === "BYE") continue;
      const rank1 = tempRanking.findIndex(t => t.name === match.team1) + 1 || 50;
      const rank2 = tempRanking.findIndex(t => t.name === match.team2) + 1 || 50;
      const loser = match.winner === match.team1 ? match.team2 : match.team1;
      const winnerRank = match.winner === match.team1 ? rank1 : rank2;
      const loserRank = match.winner === match.team1 ? rank2 : rank1;
      
      const s1 = 100 - Math.min(winnerRank, 100);
      const s2 = 100 - Math.min(loserRank, 100);
      const expected = 1 / (1 + Math.pow(10, -(s1 - s2) / 40));
      const winPts = Math.round(kFactor * (1 - expected));
      const losePts = Math.round(kFactor * (0 - (1 - expected)));
      
      if (!pointsMap[match.winner]) pointsMap[match.winner] = 0;
      if (!pointsMap[loser]) pointsMap[loser] = 0;
      pointsMap[match.winner] += winPts;
      pointsMap[loser] += losePts;
    }
  }
  
  return [...baseTeams]
    .map(t => ({ ...t, points: Math.max(0, pointsMap[t.name] || t.points) }))
    .sort((a, b) => b.points - a.points);
}

function collectAllSimMatches(sim: TournamentSimulation): { team1: string; team2: string; winner: string }[] {
  const all: { team1: string; team2: string; winner: string }[] = [];
  if (sim.swiss) sim.swiss.rounds.forEach(r => all.push(...r.matches));
  if (sim.groups) sim.groups.forEach(g => all.push(...g.matches));
  if (sim.knockout) sim.knockout.rounds.forEach(r => all.push(...r.matches));
  if (sim.majorStages) {
    sim.majorStages.forEach(stage => {
      if (stage.swiss) stage.swiss.rounds.forEach(r => all.push(...r.matches));
      if (stage.knockout) stage.knockout.rounds.forEach(r => all.push(...r.matches));
    });
  }
  return all.filter(m => m.team2 !== "BYE" && m.winner !== "");
}

export function getInvitedTeamsByRanking(
  tournament: Tournament,
  dynamicRanking: TeamData[]
): string[] {
  const config = tournament.qualification;
  if (config.inviteSlots <= 0) return [];
  return dynamicRanking.slice(0, config.inviteSlots).map(t => t.name);
}

export function getQualifierPool(
  tournament: Tournament,
  dynamicRanking: TeamData[],
  invitedTeams: string[]
): string[] {
  const config = tournament.qualification;
  if (config.qualifierSlots <= 0) return [];
  
  const invitedSet = new Set(invitedTeams);
  let pool = dynamicRanking.filter(t => !invitedSet.has(t.name));
  
  if (config.qualifierType === 'regional' && config.qualifierRegions) {
    const regions = new Set(config.qualifierRegions);
    pool = pool.filter(t => regions.has(t.region));
  }
  
  // Lower tiers → skip top-ranked teams so qualifiers feature weaker teams
  const tierSkip: Record<string, number> = {
    'S': 0,        // Tier S qualifiers: best available non-invited teams
    'A': 4,        // Tier A: skip top 4 non-invited
    'B': 0,        // Tier B: ranking-only, no qualifiers
    'C': 12,       // Tier C: skip top 12, open for lower-ranked teams
  };
  const skip = tierSkip[tournament.tier] || 0;
  if (skip > 0) {
    pool = pool.slice(skip);
  }
  
  // Return more teams than needed for qualifier bracket
  const qualifierSize = Math.max(config.qualifierSlots * 4, 16);
  return pool.slice(0, qualifierSize).map(t => t.name);
}

export function isQualificationReady(tournament: Tournament, allTournaments: Tournament[], simResults: Record<string, TournamentSimulation>): boolean {
  if (tournament.status === 'completed') return true;
  if (tournament.qualifierCompleted) return true;
  if (tournament.qualification.qualifierType === 'none') return true;
  
  // Check if 2 months before start date
  const startDate = new Date(tournament.startDate);
  const twoMonthsBefore = new Date(startDate);
  twoMonthsBefore.setMonth(twoMonthsBefore.getMonth() - 2);
  
  // Check all earlier tournaments are completed
  const earlier = allTournaments.filter(t => 
    new Date(t.endDate) <= twoMonthsBefore && t.status === 'upcoming'
  );
  
  return earlier.length === 0;
}

// ===== Full 2026 Season =====
export const initialTournaments: Tournament[] = [
  // JANUARY
  { id: "1", name: "BLAST Premier Spring Groups", organizer: "BLAST", prizePool: "$300,000", startDate: "2026-01-05", endDate: "2026-01-18", status: "upcoming", teams: 12, location: "Copenhagen, Denmark", tier: "S", participants: [], description: "Season opener — top 12 in groups.", format: "groups+knockout", formatDetails: "3 grupy po 4 → playoffs", qualification: { inviteSlots: 8, qualifierSlots: 4, qualifierType: "regional", qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'], manualInviteSlots: 2 } },
  { id: "2", name: "CCT Season 5 Europe", organizer: "CCT", prizePool: "$75,000", startDate: "2026-01-10", endDate: "2026-01-16", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: [], description: "Regional EU circuit.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },
  { id: "3", name: "ESL Challenger League S1", organizer: "ESL", prizePool: "$100,000", startDate: "2026-01-15", endDate: "2026-01-28", status: "upcoming", teams: 16, location: "Online", tier: "B", participants: [], description: "Challenger league — promotion to Pro League.", format: "swiss+knockout", formatDetails: "Swiss → top 8 playoffs", qualification: { inviteSlots: 16, qualifierSlots: 0, qualifierType: "none" } },
  { id: "4", name: "Pinnacle Cup #1", organizer: "Pinnacle", prizePool: "$20,000", startDate: "2026-01-22", endDate: "2026-01-25", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: [], description: "Monthly Pinnacle cup.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },
  { id: "5", name: "ESEA Advanced S48", organizer: "ESEA", prizePool: "$25,000", startDate: "2026-01-28", endDate: "2026-02-02", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: [], description: "ESEA Advanced.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },

  // FEBRUARY
  { id: "6", name: "IEM Katowice 2026", organizer: "ESL", prizePool: "$1,000,000", startDate: "2026-02-03", endDate: "2026-02-16", status: "upcoming", teams: 16, location: "Katowice, Poland", tier: "S", participants: [], description: "Legendary venue, $1M.", format: "swiss+knockout", formatDetails: "Swiss 16 → top 8 playoffs BO3/BO5", qualification: { inviteSlots: 8, qualifierSlots: 8, qualifierType: "regional", qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'], manualInviteSlots: 2 } },
  { id: "7", name: "FACEIT League Season 1", organizer: "FACEIT", prizePool: "$250,000", startDate: "2026-02-10", endDate: "2026-02-22", status: "upcoming", teams: 16, location: "Online", tier: "A", participants: [], description: "Online league with LAN finals.", format: "groups+knockout", formatDetails: "4 grupy po 4 → playoffs", qualification: { inviteSlots: 6, qualifierSlots: 2, qualifierType: "regional", qualifierRegions: ['EU', 'US'] } },
  { id: "8", name: "YaLLa Compass Dubai", organizer: "YaLLa", prizePool: "$40,000", startDate: "2026-02-14", endDate: "2026-02-18", status: "upcoming", teams: 8, location: "Dubai, UAE", tier: "C", participants: [], description: "Middle East showcase.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },
  { id: "9", name: "RES Regional Series EU #1", organizer: "RES", prizePool: "$15,000", startDate: "2026-02-25", endDate: "2026-02-28", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: [], description: "EU regional series.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },

  // MARCH
  { id: "10", name: "ESL Pro League Season 23", organizer: "ESL", prizePool: "$850,000", startDate: "2026-03-02", endDate: "2026-03-22", status: "upcoming", teams: 24, location: "Malta", tier: "S", participants: [], description: "24 teams, $850K.", format: "league", formatDetails: "Swiss → top 8 playoffs", qualification: { inviteSlots: 16, qualifierSlots: 8, qualifierType: "regional", qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'] } },
  { id: "11", name: "CCT Season 5 Finals", organizer: "CCT", prizePool: "$150,000", startDate: "2026-03-08", endDate: "2026-03-14", status: "upcoming", teams: 8, location: "Online", tier: "B", participants: [], description: "CCT circuit finals.", format: "knockout", formatDetails: "Single elimination BO3, finał BO5", qualification: { inviteSlots: 16, qualifierSlots: 0, qualifierType: "none" } },
  { id: "12", name: "Elisa Masters Espoo", organizer: "Elisa", prizePool: "$200,000", startDate: "2026-03-15", endDate: "2026-03-20", status: "upcoming", teams: 8, location: "Espoo, Finland", tier: "A", participants: [], description: "Nordic tournament.", format: "groups+knockout", formatDetails: "2 grupy po 4 → playoffs", qualification: { inviteSlots: 6, qualifierSlots: 2, qualifierType: "regional", qualifierRegions: ['EU', 'US'] } },
  { id: "13", name: "Pinnacle Cup #2", organizer: "Pinnacle", prizePool: "$20,000", startDate: "2026-03-25", endDate: "2026-03-28", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: [], description: "Monthly cup.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },
  { id: "14", name: "Skyesports Championship", organizer: "Skyesports", prizePool: "$60,000", startDate: "2026-03-28", endDate: "2026-03-31", status: "upcoming", teams: 8, location: "Mumbai, India", tier: "B", participants: [], description: "Asian CS showcase.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 16, qualifierSlots: 0, qualifierType: "none" } },

  // APRIL
  { id: "15", name: "BLAST Premier Spring Finals", organizer: "BLAST", prizePool: "$425,000", startDate: "2026-04-01", endDate: "2026-04-06", status: "upcoming", teams: 8, location: "Copenhagen, Denmark", tier: "S", participants: [], description: "Top 8 clash.", format: "knockout", formatDetails: "Single elimination BO3, Grand Final BO5", qualification: { inviteSlots: 8, qualifierSlots: 8, qualifierType: "regional", qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'] } },
  { id: "16", name: "BetBoom Dacha Belgrade", organizer: "BetBoom", prizePool: "$200,000", startDate: "2026-04-08", endDate: "2026-04-14", status: "upcoming", teams: 12, location: "Belgrade, Serbia", tier: "A", participants: [], description: "CIS-flavored LAN.", format: "groups+knockout", formatDetails: "3 grupy po 4 → playoffs", qualification: { inviteSlots: 8, qualifierSlots: 4, qualifierType: "regional", qualifierRegions: ['EU', 'US'] } },
  { id: "17", name: "GamerLegion Invitational", organizer: "GamerLegion", prizePool: "$50,000", startDate: "2026-04-10", endDate: "2026-04-15", status: "upcoming", teams: 8, location: "Berlin, Germany", tier: "B", participants: [], description: "Rising European teams.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 16, qualifierSlots: 0, qualifierType: "none" } },
  { id: "18", name: "IEM Dallas 2026", organizer: "ESL", prizePool: "$500,000", startDate: "2026-04-20", endDate: "2026-04-28", status: "upcoming", teams: 16, location: "Dallas, USA", tier: "S", participants: [], description: "North American IEM stop.", format: "swiss+knockout", formatDetails: "Swiss → top 8 playoffs", qualification: { inviteSlots: 8, qualifierSlots: 8, qualifierType: "regional", qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'] } },
  { id: "19", name: "Dust2.dk Masters", organizer: "Dust2.dk", prizePool: "$35,000", startDate: "2026-04-25", endDate: "2026-04-28", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: [], description: "Danish org cup.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },

  // MAY — RMRs + MAJOR
  { id: "20", name: "RMR Europe A", organizer: "PGL", prizePool: "$75,000", startDate: "2026-05-01", endDate: "2026-05-03", status: "upcoming", teams: 16, location: "Online", tier: "A", participants: [], description: "European RMR.", format: "swiss+knockout", formatDetails: "Swiss → top 8", qualification: { inviteSlots: 6, qualifierSlots: 2, qualifierType: "regional", qualifierRegions: ['EU', 'US'] } },
  { id: "21", name: "RMR Americas", organizer: "PGL", prizePool: "$50,000", startDate: "2026-05-01", endDate: "2026-05-03", status: "upcoming", teams: 8, location: "Online", tier: "B", participants: [], description: "Americas RMR.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 16, qualifierSlots: 0, qualifierType: "none" } },
  { id: "22", name: "PGL Major Antwerp", organizer: "PGL", prizePool: "$1,250,000", startDate: "2026-05-05", endDate: "2026-05-25", status: "upcoming", teams: 24, location: "Antwerp, Belgium", tier: "S", participants: [], description: "THE MAJOR — $1.25M.", format: "major", formatDetails: "Challengers Swiss → Legends Swiss → Champions Playoffs", qualification: { inviteSlots: 16, qualifierSlots: 8, qualifierType: "regional", qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'], manualInviteSlots: 4 } },
  { id: "23", name: "Thunderpick World Championship", organizer: "Thunderpick", prizePool: "$1,000,000", startDate: "2026-05-28", endDate: "2026-06-08", status: "upcoming", teams: 16, location: "Istanbul, Turkey", tier: "S", participants: [], description: "$1M championship.", format: "swiss+knockout", formatDetails: "Swiss → top 8 playoffs", qualification: { inviteSlots: 8, qualifierSlots: 8, qualifierType: "regional", qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'], manualInviteSlots: 2 } },

  // JUNE
  { id: "24", name: "BLAST Premier Spring Showdown", organizer: "BLAST", prizePool: "$162,500", startDate: "2026-06-08", endDate: "2026-06-14", status: "upcoming", teams: 8, location: "Online", tier: "A", participants: [], description: "BLAST showdown.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 6, qualifierSlots: 2, qualifierType: "regional", qualifierRegions: ['EU', 'US'] } },
  { id: "25", name: "FACEIT League Season 2", organizer: "FACEIT", prizePool: "$250,000", startDate: "2026-06-15", endDate: "2026-06-28", status: "upcoming", teams: 16, location: "Online", tier: "A", participants: [], description: "Second FACEIT League.", format: "groups+knockout", formatDetails: "4 grupy po 4 → playoffs", qualification: { inviteSlots: 6, qualifierSlots: 2, qualifierType: "regional", qualifierRegions: ['EU', 'US'] } },
  { id: "26", name: "WePlay Academy League S7", organizer: "WePlay", prizePool: "$30,000", startDate: "2026-06-10", endDate: "2026-06-20", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: [], description: "Academy-level.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },
  { id: "27", name: "ESL Challenger League S2", organizer: "ESL", prizePool: "$100,000", startDate: "2026-06-20", endDate: "2026-07-05", status: "upcoming", teams: 16, location: "Online", tier: "B", participants: [], description: "Challenger League S2.", format: "swiss+knockout", formatDetails: "Swiss → top 8 playoffs", qualification: { inviteSlots: 16, qualifierSlots: 0, qualifierType: "none" } },
  { id: "28", name: "Pinnacle Cup #3", organizer: "Pinnacle", prizePool: "$20,000", startDate: "2026-06-28", endDate: "2026-06-30", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: [], description: "Monthly cup.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },

  // JULY
  { id: "29", name: "IEM Cologne 2026", organizer: "ESL", prizePool: "$1,000,000", startDate: "2026-07-06", endDate: "2026-07-20", status: "upcoming", teams: 16, location: "Cologne, Germany", tier: "S", participants: [], description: "Cathedral of CS — $1M.", format: "swiss+knockout", formatDetails: "Swiss 16 → top 8 playoffs", qualification: { inviteSlots: 8, qualifierSlots: 8, qualifierType: "regional", qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'] } },
  { id: "30", name: "Roobet Cup", organizer: "Roobet", prizePool: "$250,000", startDate: "2026-07-10", endDate: "2026-07-16", status: "upcoming", teams: 8, location: "Online", tier: "A", participants: [], description: "High-stakes online cup.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 6, qualifierSlots: 2, qualifierType: "regional", qualifierRegions: ['EU', 'US'] } },
  { id: "31", name: "Gamers8 Riyadh", organizer: "Saudi Esports", prizePool: "$400,000", startDate: "2026-07-20", endDate: "2026-07-28", status: "upcoming", teams: 12, location: "Riyadh, Saudi Arabia", tier: "A", participants: [], description: "Saudi esports festival.", format: "groups+knockout", formatDetails: "3 grupy po 4 → playoffs", qualification: { inviteSlots: 8, qualifierSlots: 4, qualifierType: "regional", qualifierRegions: ['EU', 'US'] } },
  { id: "32", name: "DreamHack Open Valencia", organizer: "DreamHack", prizePool: "$60,000", startDate: "2026-07-28", endDate: "2026-07-31", status: "upcoming", teams: 8, location: "Valencia, Spain", tier: "B", participants: [], description: "DreamHack LAN.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 16, qualifierSlots: 0, qualifierType: "none" } },
  { id: "33", name: "CCT South America", organizer: "CCT", prizePool: "$45,000", startDate: "2026-07-22", endDate: "2026-07-26", status: "upcoming", teams: 8, location: "São Paulo, Brazil", tier: "C", participants: [], description: "South American circuit.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },

  // AUGUST
  { id: "34", name: "BLAST Premier Fall Groups", organizer: "BLAST", prizePool: "$300,000", startDate: "2026-08-01", endDate: "2026-08-14", status: "upcoming", teams: 12, location: "Copenhagen, Denmark", tier: "S", participants: [], description: "Fall season begins.", format: "groups+knockout", formatDetails: "3 grupy po 4 → playoffs", qualification: { inviteSlots: 8, qualifierSlots: 4, qualifierType: "regional", qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'] } },
  { id: "35", name: "ESL Challenger League S3", organizer: "ESL", prizePool: "$100,000", startDate: "2026-08-05", endDate: "2026-08-18", status: "upcoming", teams: 16, location: "Online", tier: "B", participants: [], description: "Challenger League S3.", format: "swiss+knockout", formatDetails: "Swiss → top 8 playoffs", qualification: { inviteSlots: 16, qualifierSlots: 0, qualifierType: "none" } },
  { id: "36", name: "FACEIT League Season 3", organizer: "FACEIT", prizePool: "$250,000", startDate: "2026-08-10", endDate: "2026-08-22", status: "upcoming", teams: 16, location: "Online", tier: "A", participants: [], description: "Third FACEIT League.", format: "groups+knockout", formatDetails: "4 grupy po 4 → playoffs", qualification: { inviteSlots: 6, qualifierSlots: 2, qualifierType: "regional", qualifierRegions: ['EU', 'US'] } },
  { id: "37", name: "WePlay Academy League S8", organizer: "WePlay", prizePool: "$30,000", startDate: "2026-08-15", endDate: "2026-08-22", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: [], description: "Academy League.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },
  { id: "38", name: "Pinnacle Cup #4", organizer: "Pinnacle", prizePool: "$20,000", startDate: "2026-08-25", endDate: "2026-08-28", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: [], description: "Monthly cup.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },

  // SEPTEMBER
  { id: "39", name: "ESL Pro League Season 24", organizer: "ESL", prizePool: "$850,000", startDate: "2026-09-01", endDate: "2026-09-22", status: "upcoming", teams: 24, location: "Malta", tier: "S", participants: [], description: "Season 24.", format: "league", formatDetails: "Swiss → top 8 playoffs", qualification: { inviteSlots: 16, qualifierSlots: 8, qualifierType: "regional", qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'] } },
  { id: "40", name: "BetBoom Dacha Moscow", organizer: "BetBoom", prizePool: "$150,000", startDate: "2026-09-08", endDate: "2026-09-14", status: "upcoming", teams: 8, location: "Moscow, Russia", tier: "A", participants: [], description: "CIS autumn event.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 6, qualifierSlots: 2, qualifierType: "regional", qualifierRegions: ['EU', 'US'] } },
  { id: "41", name: "DreamHack Open Atlanta", organizer: "DreamHack", prizePool: "$75,000", startDate: "2026-09-18", endDate: "2026-09-22", status: "upcoming", teams: 8, location: "Atlanta, USA", tier: "B", participants: [], description: "DreamHack NA stop.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 16, qualifierSlots: 0, qualifierType: "none" } },
  { id: "42", name: "ESEA Advanced S49", organizer: "ESEA", prizePool: "$25,000", startDate: "2026-09-20", endDate: "2026-09-28", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: [], description: "ESEA Advanced.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },

  // OCTOBER — RMRs + BLAST World Final
  { id: "43", name: "RMR Europe B", organizer: "PGL", prizePool: "$75,000", startDate: "2026-10-01", endDate: "2026-10-05", status: "upcoming", teams: 16, location: "Online", tier: "A", participants: [], description: "Second European RMR.", format: "swiss+knockout", formatDetails: "Swiss → top 8", qualification: { inviteSlots: 6, qualifierSlots: 2, qualifierType: "regional", qualifierRegions: ['EU', 'US'] } },
  { id: "44", name: "RMR Asia", organizer: "PGL", prizePool: "$40,000", startDate: "2026-10-01", endDate: "2026-10-04", status: "upcoming", teams: 8, location: "Shanghai, China", tier: "B", participants: [], description: "Asian RMR.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 16, qualifierSlots: 0, qualifierType: "none" } },
  { id: "45", name: "Elisa Masters Helsinki", organizer: "Elisa", prizePool: "$200,000", startDate: "2026-10-08", endDate: "2026-10-14", status: "upcoming", teams: 8, location: "Helsinki, Finland", tier: "A", participants: [], description: "Nordic LAN.", format: "groups+knockout", formatDetails: "2 grupy po 4 → playoffs", qualification: { inviteSlots: 6, qualifierSlots: 2, qualifierType: "regional", qualifierRegions: ['EU', 'US'] } },
  { id: "46", name: "BLAST Premier World Final", organizer: "BLAST", prizePool: "$1,000,000", startDate: "2026-10-15", endDate: "2026-10-27", status: "upcoming", teams: 8, location: "Abu Dhabi, UAE", tier: "S", participants: [], description: "BLAST World Final.", format: "knockout", formatDetails: "Single elimination BO3, Grand Final BO5", qualification: { inviteSlots: 8, qualifierSlots: 8, qualifierType: "regional", qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'] } },
  { id: "47", name: "BLAST Premier Fall Showdown", organizer: "BLAST", prizePool: "$162,500", startDate: "2026-10-28", endDate: "2026-10-31", status: "upcoming", teams: 8, location: "Online", tier: "A", participants: [], description: "BLAST fall showdown.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 6, qualifierSlots: 2, qualifierType: "regional", qualifierRegions: ['EU', 'US'] } },
  { id: "48", name: "Pinnacle Cup #5", organizer: "Pinnacle", prizePool: "$20,000", startDate: "2026-10-20", endDate: "2026-10-23", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: [], description: "Monthly cup.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },

  // NOVEMBER — FALL MAJOR
  { id: "49", name: "PGL Major Copenhagen", organizer: "PGL", prizePool: "$1,250,000", startDate: "2026-11-03", endDate: "2026-11-24", status: "upcoming", teams: 24, location: "Copenhagen, Denmark", tier: "S", participants: [], description: "Fall Major — $1.25M.", format: "major", formatDetails: "Challengers Swiss → Legends Swiss → Champions Playoffs", qualification: { inviteSlots: 16, qualifierSlots: 8, qualifierType: "regional", qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'], manualInviteSlots: 4 } },
  { id: "50", name: "DreamHack Open Winter", organizer: "DreamHack", prizePool: "$100,000", startDate: "2026-11-10", endDate: "2026-11-14", status: "upcoming", teams: 8, location: "Jönköping, Sweden", tier: "B", participants: [], description: "DreamHack classic.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 16, qualifierSlots: 0, qualifierType: "none" } },
  { id: "51", name: "LOOT.BET Season 9", organizer: "LOOT.BET", prizePool: "$15,000", startDate: "2026-11-15", endDate: "2026-11-20", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: [], description: "Online league.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },

  // DECEMBER
  { id: "52", name: "BLAST Premier Fall Finals", organizer: "BLAST", prizePool: "$425,000", startDate: "2026-12-01", endDate: "2026-12-06", status: "upcoming", teams: 8, location: "Copenhagen, Denmark", tier: "S", participants: [], description: "BLAST Fall Finals.", format: "knockout", formatDetails: "Single elimination BO3, Grand Final BO5", qualification: { inviteSlots: 8, qualifierSlots: 8, qualifierType: "regional", qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'] } },
  { id: "53", name: "IEM Chengdu", organizer: "ESL", prizePool: "$500,000", startDate: "2026-12-08", endDate: "2026-12-15", status: "upcoming", teams: 16, location: "Chengdu, China", tier: "S", participants: [], description: "Asian IEM stop.", format: "swiss+knockout", formatDetails: "Swiss → top 8 playoffs", qualification: { inviteSlots: 8, qualifierSlots: 8, qualifierType: "regional", qualifierRegions: ['EU', 'US', 'ASIA', 'LATAM'] } },
  { id: "54", name: "CCT Season 6 Finals", organizer: "CCT", prizePool: "$100,000", startDate: "2026-12-10", endDate: "2026-12-14", status: "upcoming", teams: 8, location: "Online", tier: "B", participants: [], description: "CCT year-end finals.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 16, qualifierSlots: 0, qualifierType: "none" } },
  { id: "55", name: "Pinnacle Cup Grand Final", organizer: "Pinnacle", prizePool: "$40,000", startDate: "2026-12-18", endDate: "2026-12-20", status: "upcoming", teams: 8, location: "Online", tier: "C", participants: [], description: "Year-end showdown.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 0, qualifierSlots: 8, qualifierType: "open" } },
  { id: "56", name: "WePlay Invitational", organizer: "WePlay", prizePool: "$150,000", startDate: "2026-12-20", endDate: "2026-12-23", status: "upcoming", teams: 8, location: "Kyiv, Ukraine", tier: "A", participants: [], description: "Year-end exhibition.", format: "knockout", formatDetails: "Single elimination BO3", qualification: { inviteSlots: 6, qualifierSlots: 2, qualifierType: "regional", qualifierRegions: ['EU', 'US'] } },
];

// Calendar events auto-generated from tournaments
export const calendarEvents: CalendarEvent[] = initialTournaments
  .filter(t => t.tier === "S" || t.tier === "A")
  .map((t, i) => ({
    id: String(i + 1),
    title: t.name,
    date: t.startDate,
    type: "tournament-start" as const,
    description: `${t.prizePool} — ${t.location}`,
  }));
