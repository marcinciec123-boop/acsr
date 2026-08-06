import { useEffect, useRef, useState } from "react";
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
import { readUiPref, writeUiPref } from "@/lib/uiPrefs";

const loadRankingTeams = () =>
  loadFromStorage<TeamData[] | null>("ranking_data", null) || teamDatabase.map(t => ({ ...t }));

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("news");
  // Stack lets us open Team → Player → Team… and step back through history.
  const [profileStack, setProfileStack] = useState<Array<{ kind: "team" | "player"; name: string }>>([]);
  const top = profileStack[profileStack.length - 1] || null;
  // Remember where the user was in the underlying list (ranking, players…)
  // so closing a profile returns to the exact same scroll position.
  const listScrollRef = useRef<number>(0);

  const rememberScroll = () => {
    if (profileStack.length === 0) {
      listScrollRef.current = window.scrollY;
      writeUiPref(`scroll_tab_${activeTab}`, { x: 0, y: window.scrollY });
    }
  };

  const handleSelectTeam = (name: string) => {
    rememberScroll();
    setProfileStack(s => [...s, { kind: "team", name }]);
  };

  const handleSelectPlayer = (name: string) => {
    rememberScroll();
    setProfileStack(s => [...s, { kind: "player", name }]);
  };

  const handleOpenTournament = (tournamentId: string, matchId?: string) => {
    rememberScroll();
    setProfileStack([]);
    setActiveTab("tournaments");
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("tournament:open", { detail: { tournamentId, matchId } }));
      window.scrollTo({ top: 0 });
    }, 30);
  };

  const handleBack = () => {
    setProfileStack(s => {
      const next = s.slice(0, -1);
      if (next.length === 0) {
        const y = listScrollRef.current;
        requestAnimationFrame(() => window.scrollTo({ top: y }));
        setTimeout(() => window.scrollTo({ top: y }), 80);
      }
      return next;
    });
  };

  const handleTabChange = (tab: Tab) => {
    rememberScroll();
    setProfileStack([]);
    setActiveTab(tab);
    const saved = readUiPref<{ x: number; y: number } | null>(`scroll_tab_${tab}`, null);
    requestAnimationFrame(() => window.scrollTo({ top: saved?.y || 0 }));
    setTimeout(() => window.scrollTo({ top: saved?.y || 0 }), 120);
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

  // Keep the per-tab scroll offset in the save so reloading lands in place.
  useEffect(() => {
    if (profileOpen) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        listScrollRef.current = window.scrollY;
        writeUiPref(`scroll_tab_${activeTab}`, { x: 0, y: window.scrollY });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [activeTab, profileOpen]);

  return (
    <ProfileNavProvider value={{ openTeam: handleSelectTeam, openPlayer: handleSelectPlayer, openTournament: handleOpenTournament }}>
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
          {activeTab === "matches" && <MatchesPanel />}
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
