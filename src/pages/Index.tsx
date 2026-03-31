import { useState } from "react";
import NavBar, { type Tab } from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import OverviewSection from "@/components/OverviewSection";
import TournamentList from "@/components/TournamentList";
import TournamentPlay from "@/components/TournamentPlay";
import QualifierPlay from "@/components/QualifierPlay";
import EventCalendar from "@/components/EventCalendar";
import PlayerRankings from "@/components/PlayerRankings";
import PlayerRatingRankings from "@/components/PlayerRatingRankings";
import SeasonStandings from "@/components/SeasonStandings";
import TeamProfile from "@/components/TeamProfile";
import PlayerProfile from "@/components/PlayerProfile";
import SettingsTab from "@/components/SettingsTab";
import HistoryTab from "@/components/HistoryTab";
import { type MatchStats } from "@/lib/playerStats";
import {
  initialTournaments,
  type Tournament,
  type TournamentSimulation,
  simulateTournament,
  calculateSeasonStandings,
  teamDatabase,
  getDynamicRanking,
  getInvitedTeamsByRanking,
  getQualifierPool,
  getRegionalSlotDistribution,
  getRegionalQualifierPool,
} from "@/data/tournaments";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [tournaments, setTournaments] = useState<Tournament[]>(() =>
    initialTournaments.map((t) => ({ ...t }))
  );
  const [simResults, setSimResults] = useState<Record<string, TournamentSimulation>>({});
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [playingTournamentId, setPlayingTournamentId] = useState<string | null>(null);
  const [qualifyingTournamentId, setQualifyingTournamentId] = useState<string | null>(null);
  const [rosterVersion, setRosterVersion] = useState(0);
  const [globalMatchStats, setGlobalMatchStats] = useState<Record<string, MatchStats>>({});

  const seasonStandings = calculateSeasonStandings(tournaments, simResults);

  // Dynamic ranking based on completed tournament results
  const dynamicRanking = getDynamicRanking(teamDatabase, simResults, tournaments);

  // Get participants for a tournament based on ranking + qualifier results
  const getParticipants = (tournament: Tournament): string[] => {
    if (tournament.participants.length > 0) return tournament.participants;

    const config = tournament.qualification;
    const invited = getInvitedTeamsByRanking(tournament, dynamicRanking);
    const qualified = tournament.qualifiedTeams || [];

    if (config.qualifierType === "none") {
      // B-tier: all from ranking
      return dynamicRanking.slice(0, tournament.teams).map(t => t.name);
    }

    return [...invited, ...qualified].slice(0, tournament.teams);
  };

  // Check if tournament needs qualification
  const needsQualification = (tournament: Tournament): boolean => {
    if (tournament.status === "completed") return false;
    if (tournament.qualifierCompleted) return false;
    if (tournament.qualification.qualifierType === "none") return false;
    if (tournament.qualification.qualifierSlots <= 0) return false;
    return true;
  };

  const playNext = () => {
    const sorted = [...tournaments].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const next = sorted.find((t) => t.status === "upcoming");
    if (!next) return;
    handlePlayTournament(next.id);
  };

  const simulateAll = () => {
    const newTournaments = [...tournaments].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const newResults = { ...simResults };

    newTournaments.forEach((t, idx) => {
      if (t.status === "upcoming") {
        const currentRanking = getDynamicRanking(teamDatabase, newResults, newTournaments);

        // Resolve qualification
        if (t.qualification.qualifierType !== "none" && !t.qualifierCompleted) {
          const invited = getInvitedTeamsByRanking(t, currentRanking);
          const pool = getQualifierPool(t, currentRanking, invited);
          const qualifiedTeams = pool.slice(0, t.qualification.qualifierSlots);
          t.qualifierCompleted = true;
          t.qualifiedTeams = qualifiedTeams;
          t.invitedTeams = invited;
          t.participants = [...invited, ...qualifiedTeams].slice(0, t.teams);
        } else if (t.qualification.qualifierType === "none") {
          t.participants = currentRanking.slice(0, t.teams).map(td => td.name);
        }

        const result = simulateTournament(t);
        newResults[t.id] = result;
        t.status = "completed";
      }
    });

    setTournaments([...newTournaments]);
    setSimResults(newResults);
  };

  const resetSeason = () => {
    setTournaments(initialTournaments.map((t) => ({ ...t })));
    setSimResults({});
    setPlayingTournamentId(null);
    setQualifyingTournamentId(null);
  };

  const loadState = (t: Tournament[], s: Record<string, TournamentSimulation>) => {
    setTournaments(t.map(tt => ({ ...tt })));
    setSimResults({ ...s });
  };

  const handleSelectTeam = (teamName: string) => {
    setSelectedTeam(teamName);
    setSelectedPlayer(null);
    setActiveTab("rankings");
  };

  const handleSelectPlayer = (playerName: string) => {
    setSelectedPlayer(playerName);
    setSelectedTeam(null);
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSelectedTeam(null);
    setSelectedPlayer(null);
    setPlayingTournamentId(null);
    setQualifyingTournamentId(null);
  };

  const handlePlayTournament = (id: string) => {
    const tournament = tournaments.find(t => t.id === id);
    if (!tournament) return;

    // If needs qualification, start qualifier first
    if (needsQualification(tournament)) {
      setQualifyingTournamentId(id);
    } else {
      // Fill participants from ranking for B-tier
      if (tournament.qualification.qualifierType === "none" && tournament.participants.length === 0) {
        setTournaments(prev => prev.map(t =>
          t.id === id ? { ...t, participants: dynamicRanking.slice(0, t.teams).map(td => td.name) } : t
        ));
      }
      setPlayingTournamentId(id);
    }
  };

  const handleQualifierComplete = (qualifiedTeams: string[], manualInvites?: string[]) => {
    const id = qualifyingTournamentId!;
    const tournament = tournaments.find(t => t.id === id)!;
    const invited = getInvitedTeamsByRanking(tournament, dynamicRanking);
    const allInvited = [...invited, ...(manualInvites || [])];

    setTournaments(prev => prev.map(t =>
      t.id === id ? {
        ...t,
        qualifierCompleted: true,
        qualifiedTeams,
        invitedTeams: invited,
        manualInvites: manualInvites || [],
        participants: [...allInvited, ...qualifiedTeams].slice(0, t.teams),
      } : t
    ));
    setQualifyingTournamentId(null);
    setPlayingTournamentId(id);
  };

  const handlePlayComplete = (sim: TournamentSimulation, matchStats?: Record<string, MatchStats>) => {
    const id = playingTournamentId!;
    setSimResults((prev) => ({ ...prev, [id]: sim }));
    setTournaments((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "completed" as const } : t))
    );
    if (matchStats) {
      setGlobalMatchStats(prev => ({ ...prev, ...matchStats }));
    }
    setPlayingTournamentId(null);
  };

  const playingTournament = playingTournamentId ? tournaments.find(t => t.id === playingTournamentId) : null;
  const qualifyingTournament = qualifyingTournamentId ? tournaments.find(t => t.id === qualifyingTournamentId) : null;

  // Ensure playing tournament has participants
  const playingTournamentWithParticipants = playingTournament ? {
    ...playingTournament,
    participants: getParticipants(playingTournament),
  } : null;

  return (
    <div className="min-h-screen bg-background">
      <NavBar activeTab={activeTab} onTabChange={handleTabChange} />

      {activeTab === "overview" && (
        <>
          <HeroSection onNavigate={handleTabChange} />
          <OverviewSection onNavigate={handleTabChange} />
        </>
      )}

      {activeTab === "tournaments" && (
        qualifyingTournament ? (
          <QualifierPlay
            tournament={qualifyingTournament}
            invitedTeams={getInvitedTeamsByRanking(qualifyingTournament, dynamicRanking)}
            qualifierPool={getQualifierPool(qualifyingTournament, dynamicRanking, getInvitedTeamsByRanking(qualifyingTournament, dynamicRanking))}
            qualifierSlots={qualifyingTournament.qualification.qualifierSlots}
            onComplete={handleQualifierComplete}
            onBack={() => setQualifyingTournamentId(null)}
            dynamicRanking={dynamicRanking}
          />
        ) : playingTournamentWithParticipants ? (
          <TournamentPlay
            tournament={playingTournamentWithParticipants}
            onComplete={handlePlayComplete}
            onBack={() => setPlayingTournamentId(null)}
          />
        ) : (
          <TournamentList
            tournaments={tournaments}
            simResults={simResults}
            onSimulateNext={playNext}
            onSimulateAll={simulateAll}
            onReset={resetSeason}
            onPlayTournament={handlePlayTournament}
            dynamicRanking={dynamicRanking}
          />
        )
      )}
      {activeTab === "calendar" && <EventCalendar tournaments={tournaments} simResults={simResults} />}
      {activeTab === "rankings" && (
        selectedPlayer ? (
          <PlayerProfile
            playerName={selectedPlayer}
            onBack={() => { setSelectedPlayer(null); }}
            onSelectTeam={handleSelectTeam}
            seasonStandings={seasonStandings}
          />
        ) : selectedTeam ? (
          <TeamProfile
            teamName={selectedTeam}
            onBack={() => setSelectedTeam(null)}
            seasonStanding={seasonStandings.find(s => s.team === selectedTeam)}
            onSelectPlayer={handleSelectPlayer}
          />
        ) : (
          <PlayerRankings onSelectTeam={handleSelectTeam} onSelectPlayer={handleSelectPlayer} />
        )
      )}
      {activeTab === "player-ratings" && (
        <PlayerRatingRankings
          simResults={simResults}
          tournaments={tournaments}
          allMatchStats={globalMatchStats}
          onSelectPlayer={handleSelectPlayer}
        />
      )}
      {activeTab === "standings" && (
        <SeasonStandings standings={seasonStandings} onSelectTeam={handleSelectTeam} />
      )}
      {activeTab === "history" && <HistoryTab onRosterChange={() => setRosterVersion(v => v + 1)} />}
      {activeTab === "settings" && (
        <SettingsTab
          tournaments={tournaments}
          simResults={simResults}
          onReset={resetSeason}
          onLoadState={loadState}
        />
      )}

      <footer className="border-t border-border py-8 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm font-mono">
            CS:GO Tournament Hub © 2026 — All match data is simulated
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
