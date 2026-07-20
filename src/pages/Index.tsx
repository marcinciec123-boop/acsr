import { useEffect, useState } from "react";
import NavBar, { type Tab } from "@/components/NavBar";
import NewsFeed from "@/components/NewsFeed";
import RankingPanel from "@/components/RankingPanel";
import TournamentPanel from "@/components/TournamentPanel";
import TransferPanel from "@/components/TransferPanel";
import TeamProfile from "@/components/TeamProfile";
import PlayerProfile from "@/components/PlayerProfile";
import PlayersPanel from "@/components/PlayersPanel";
import DeviceBackupPanel from "@/components/DeviceBackupPanel";
import SettingsTab from "@/components/SettingsTab";
import CommandPalette from "@/components/CommandPalette";
import WorldClockWidget from "@/components/WorldClockWidget";
import YearAwardsCeremony from "@/components/YearAwardsCeremony";
import AwardsHistoryPanel from "@/components/AwardsHistoryPanel";
import type { TeamData } from "@/lib/types";
import { loadFromStorage } from "@/lib/storage";
import { teamDatabase } from "@/data/tournaments";
import { ProfileNavProvider } from "@/lib/profileNav";

const loadRankingTeams = () =>
  loadFromStorage<TeamData[] | null>("ranking_data", null) || teamDatabase.map(t => ({ ...t }));

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("news");
  // Stack lets us open Team → Player → Team… and step back through history.
  const [profileStack, setProfileStack] = useState<Array<{ kind: "team" | "player"; name: string }>>([]);
  const top = profileStack[profileStack.length - 1] || null;

  const handleSelectTeam = (name: string) => {
    setProfileStack(s => [...s, { kind: "team", name }]);
  };

  const handleSelectPlayer = (name: string) => {
    setProfileStack(s => [...s, { kind: "player", name }]);
  };

  const handleBack = () => {
    setProfileStack(s => s.slice(0, -1));
  };

  const handleTabChange = (tab: Tab) => {
    setProfileStack([]);
    setActiveTab(tab);
  };

  const [teams, setTeams] = useState<TeamData[]>(loadRankingTeams);

  useEffect(() => {
    const refreshTeams = () => setTeams(loadRankingTeams());
    const onStorage = (event: StorageEvent) => {
      if (event.key === "csgo_hub_ranking_data") refreshTeams();
    };
    window.addEventListener("teams:update", refreshTeams);
    window.addEventListener("ranking:update", refreshTeams);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("teams:update", refreshTeams);
      window.removeEventListener("ranking:update", refreshTeams);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const profileOpen = !!top;

  return (
    <ProfileNavProvider value={{ openTeam: handleSelectTeam, openPlayer: handleSelectPlayer }}>
      <div className="min-h-screen bg-background">
        <NavBar activeTab={activeTab} onTabChange={handleTabChange} />
        <CommandPalette
          onTabChange={handleTabChange}
          onSelectTeam={handleSelectTeam}
          onSelectPlayer={handleSelectPlayer}
        />

        {/* Tab contents stay mounted so state (e.g. selected tournament / match) is
            preserved when the user opens a profile and clicks back. */}
        <div style={profileOpen ? { display: "none" } : undefined}>
          {activeTab === "news" && <NewsFeed />}
          {activeTab === "rankings" && (
            <RankingPanel
              onSelectTeam={handleSelectTeam}
              onSelectPlayer={handleSelectPlayer}
            />
          )}
          {activeTab === "players" && (
            <PlayersPanel onSelectPlayer={handleSelectPlayer} onSelectTeam={handleSelectTeam} />
          )}
          {activeTab === "tournaments" && <TournamentPanel />}
          {activeTab === "transfers" && <TransferPanel />}
          {activeTab === "awards" && <AwardsHistoryPanel />}
          {activeTab === "backup" && <DeviceBackupPanel />}
          {activeTab === "settings" && <SettingsTab />}
        </div>

        {top?.kind === "player" && (
          <PlayerProfile
            key={`p-${profileStack.length}-${top.name}`}
            playerName={top.name}
            onBack={handleBack}
            onSelectTeam={handleSelectTeam}
            onSelectPlayer={handleSelectPlayer}
            seasonStandings={[]}
            dynamicRanking={teams}
          />
        )}
        {top?.kind === "team" && (
          <TeamProfile
            key={`t-${profileStack.length}-${top.name}`}
            teamName={top.name}
            onBack={handleBack}
            teams={teams}
            onSelectPlayer={handleSelectPlayer}
          />
        )}

        <footer className="border-t border-border py-6 mt-12">
          <div className="container mx-auto px-4 text-center">
            <p className="text-muted-foreground text-xs font-mono">
              CS:GO Tournament Hub © 2026
            </p>
          </div>
        </footer>

        <WorldClockWidget />
        <YearAwardsCeremony />
      </div>
    </ProfileNavProvider>
  );
};

export default Index;
