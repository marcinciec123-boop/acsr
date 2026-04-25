import { useState } from "react";
import NavBar, { type Tab } from "@/components/NavBar";
import NewsFeed from "@/components/NewsFeed";
import RankingPanel from "@/components/RankingPanel";
import TournamentPanel from "@/components/TournamentPanel";
import TransferPanel from "@/components/TransferPanel";
import TeamProfile from "@/components/TeamProfile";
import PlayerProfile from "@/components/PlayerProfile";
import PlayersPanel from "@/components/PlayersPanel";
import type { TeamData } from "@/lib/types";
import { loadFromStorage } from "@/lib/storage";
import { teamDatabase } from "@/data/tournaments";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("news");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);

  const handleSelectTeam = (name: string) => {
    setSelectedPlayer(null);
    setSelectedTeam(name);
  };

  const handleSelectPlayer = (name: string) => {
    setSelectedTeam(null);
    setSelectedPlayer(name);
  };

  const handleBackFromTeam = () => setSelectedTeam(null);
  const handleBackFromPlayer = () => setSelectedPlayer(null);

  const handleTabChange = (tab: Tab) => {
    setSelectedTeam(null);
    setSelectedPlayer(null);
    setActiveTab(tab);
  };

  // Get current ranking data for profiles
  const teams = loadFromStorage<TeamData[] | null>("ranking_data", null) || teamDatabase.map(t => ({ ...t }));

  return (
    <div className="min-h-screen bg-background">
      <NavBar activeTab={activeTab} onTabChange={handleTabChange} />

      {selectedPlayer ? (
        <PlayerProfile
          playerName={selectedPlayer}
          onBack={handleBackFromPlayer}
          onSelectTeam={handleSelectTeam}
          onSelectPlayer={handleSelectPlayer}
          seasonStandings={[]}
          dynamicRanking={teams}
        />
      ) : selectedTeam ? (
        <TeamProfile
          teamName={selectedTeam}
          onBack={handleBackFromTeam}
          teams={teams}
          onSelectPlayer={handleSelectPlayer}
        />
      ) : (
        <>
          {activeTab === "news" && <NewsFeed />}
          {activeTab === "rankings" && (
            <RankingPanel
              onSelectTeam={handleSelectTeam}
              onSelectPlayer={handleSelectPlayer}
            />
          )}
          {activeTab === "tournaments" && <TournamentPanel />}
          {activeTab === "transfers" && <TransferPanel />}
        </>
      )}

      <footer className="border-t border-border py-6 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground text-xs font-mono">
            CS:GO Tournament Hub © 2026
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
