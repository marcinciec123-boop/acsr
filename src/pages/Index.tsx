import { useState } from "react";
import NavBar, { type Tab } from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import OverviewSection from "@/components/OverviewSection";
import TournamentList from "@/components/TournamentList";
import EventCalendar from "@/components/EventCalendar";
import PlayerRankings from "@/components/PlayerRankings";
import SeasonStandings from "@/components/SeasonStandings";
import { initialTournaments, type Tournament, type TournamentSimulation, simulateTournament, calculateSeasonStandings } from "@/data/tournaments";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [tournaments, setTournaments] = useState<Tournament[]>(() =>
    initialTournaments.map((t) => ({ ...t }))
  );
  const [simResults, setSimResults] = useState<Record<string, TournamentSimulation>>({});

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
  };

  return (
    <div className="min-h-screen bg-background">
      <NavBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "overview" && (
        <>
          <HeroSection onNavigate={setActiveTab} />
          <OverviewSection onNavigate={setActiveTab} />
        </>
      )}

      {activeTab === "tournaments" && (
        <TournamentList
          tournaments={tournaments}
          simResults={simResults}
          onSimulateNext={simulateNext}
          onSimulateAll={simulateAll}
          onReset={resetSeason}
        />
      )}
      {activeTab === "calendar" && <EventCalendar />}
      {activeTab === "rankings" && <PlayerRankings />}
      {activeTab === "standings" && <SeasonStandings standings={seasonStandings} />}

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
