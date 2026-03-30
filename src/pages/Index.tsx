import { useState } from "react";
import NavBar, { type Tab } from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import OverviewSection from "@/components/OverviewSection";
import TournamentList from "@/components/TournamentList";
import TournamentPlay from "@/components/TournamentPlay";
import EventCalendar from "@/components/EventCalendar";
import PlayerRankings from "@/components/PlayerRankings";
import SeasonStandings from "@/components/SeasonStandings";
import TeamProfile from "@/components/TeamProfile";
import SettingsTab from "@/components/SettingsTab";
import { initialTournaments, type Tournament, type TournamentSimulation, simulateTournament, calculateSeasonStandings } from "@/data/tournaments";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [tournaments, setTournaments] = useState<Tournament[]>(() =>
    initialTournaments.map((t) => ({ ...t }))
  );
  const [simResults, setSimResults] = useState<Record<string, TournamentSimulation>>({});
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [playingTournamentId, setPlayingTournamentId] = useState<string | null>(null);

  const seasonStandings = calculateSeasonStandings(tournaments, simResults);

  const simulateNext = () => {
    const sorted = [...tournaments].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    const next = sorted.find((t) => t.status === "upcoming");
    if (!next) return;
    const result = simulateTournament(next);
    setSimResults((prev) => ({ ...prev, [next.id]: result }));
    setTournaments((prev) =>
      prev.map((t) => (t.id === next.id ? { ...t, status: "completed" as const } : t))
    );
  };

  const simulateAll = () => {
    const newTournaments = [...tournaments];
    const newResults = { ...simResults };
    newTournaments.forEach((t) => {
      if (t.status === "upcoming") {
        const result = simulateTournament(t);
        newResults[t.id] = result;
        t.status = "completed";
      }
    });
    setTournaments(newTournaments);
    setSimResults(newResults);
  };

  const resetSeason = () => {
    setTournaments(initialTournaments.map((t) => ({ ...t })));
    setSimResults({});
    setPlayingTournamentId(null);
  };

  const loadState = (t: Tournament[], s: Record<string, TournamentSimulation>) => {
    setTournaments(t.map(tt => ({ ...tt })));
    setSimResults({ ...s });
  };

  const handleSelectTeam = (teamName: string) => {
    setSelectedTeam(teamName);
    setActiveTab("rankings");
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setSelectedTeam(null);
    setPlayingTournamentId(null);
  };

  const handlePlayTournament = (id: string) => {
    setPlayingTournamentId(id);
  };

  const handlePlayComplete = (sim: TournamentSimulation) => {
    const id = playingTournamentId!;
    setSimResults((prev) => ({ ...prev, [id]: sim }));
    setTournaments((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: "completed" as const } : t))
    );
    setPlayingTournamentId(null);
  };

  const playingTournament = playingTournamentId ? tournaments.find(t => t.id === playingTournamentId) : null;

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
        playingTournament ? (
          <TournamentPlay
            tournament={playingTournament}
            onComplete={handlePlayComplete}
            onBack={() => setPlayingTournamentId(null)}
          />
        ) : (
          <TournamentList
            tournaments={tournaments}
            simResults={simResults}
            onSimulateNext={simulateNext}
            onSimulateAll={simulateAll}
            onReset={resetSeason}
            onPlayTournament={handlePlayTournament}
          />
        )
      )}
      {activeTab === "calendar" && <EventCalendar />}
      {activeTab === "rankings" && (
        selectedTeam ? (
          <TeamProfile
            teamName={selectedTeam}
            onBack={() => setSelectedTeam(null)}
            seasonStanding={seasonStandings.find(s => s.team === selectedTeam)}
          />
        ) : (
          <PlayerRankings onSelectTeam={handleSelectTeam} />
        )
      )}
      {activeTab === "standings" && (
        <SeasonStandings standings={seasonStandings} onSelectTeam={handleSelectTeam} />
      )}
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
