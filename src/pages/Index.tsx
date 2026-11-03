import { lazy, Suspense, useEffect, useRef, useState } from "react";
import NavBar, { type Tab } from "@/components/NavBar";
import CommandPalette from "@/components/CommandPalette";
import WorldClockWidget from "@/components/WorldClockWidget";
import type { TeamData } from "@/lib/types";
import { loadFromStorage } from "@/lib/storage";
import { teamDatabase } from "@/data/tournaments";
import { ProfileNavProvider } from "@/lib/profileNav";
import { readUiPref, writeUiPref } from "@/lib/uiPrefs";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialNavigation, pushNavigation, backNavigation, type NavigationView, type TournamentVisit } from "@/lib/sessionNavigation";

const imports = {
  news: () => import("@/components/NewsFeed"),
  rankings: () => import("@/components/RankingPanel"),
  tournaments: () => import("@/components/TournamentPanel"),
  transfers: () => import("@/components/TransferPanel"),
  team: () => import("@/components/TeamProfile"),
  player: () => import("@/components/PlayerProfile"),
  players: () => import("@/components/PlayersPanel"),
  matches: () => import("@/components/MatchesPanel"),
  backup: () => import("@/components/DeviceBackupPanel"),
  settings: () => import("@/components/SettingsTab"),
  ceremony: () => import("@/components/YearAwardsCeremony"),
  awards: () => import("@/components/AwardsHistoryPanel"),
  stats: () => import("@/components/StatisticsPanel"),
};
const PANEL_IMPORTS = Object.values(imports);

const NewsFeed = lazy(imports.news);
const RankingPanel = lazy(imports.rankings);
const TournamentPanel = lazy(imports.tournaments);
const TransferPanel = lazy(imports.transfers);
const TeamProfile = lazy(imports.team);
const PlayerProfile = lazy(imports.player);
const PlayersPanel = lazy(imports.players);
const MatchesPanel = lazy(imports.matches);
const DeviceBackupPanel = lazy(imports.backup);
const SettingsTab = lazy(imports.settings);
const YearAwardsCeremony = lazy(imports.ceremony);
const AwardsHistoryPanel = lazy(imports.awards);
const StatisticsPanel = lazy(imports.stats);

type NavHandlers = { onSelectTeam: (n: string) => void; onSelectPlayer: (n: string) => void; tournamentSelection: TournamentVisit | null; onOpenTournament: (id: string, matchId?: string) => void; onBack: () => void };
const PANELS: Partial<Record<Tab, (h: NavHandlers) => JSX.Element>> = {
  news: () => <NewsFeed />,
  rankings: h => <RankingPanel onSelectTeam={h.onSelectTeam} onSelectPlayer={h.onSelectPlayer} />,
  players: h => <PlayersPanel onSelectPlayer={h.onSelectPlayer} onSelectTeam={h.onSelectTeam} />,
  matches: () => <MatchesPanel />,
  tournaments: h => <TournamentPanel selection={h.tournamentSelection} onNavigate={h.onOpenTournament} onBack={h.onBack} />,
  transfers: () => <TransferPanel />,
  awards: () => <AwardsHistoryPanel />,
  stats: () => <StatisticsPanel />,
  backup: () => <DeviceBackupPanel />,
  settings: () => <SettingsTab />,
};

const PanelFallback = () => (
  <div className="container mx-auto px-4 py-10 text-sm font-mono text-muted-foreground">
    Wczytywanie panelu…
  </div>
);

const loadRankingTeams = () =>
  loadFromStorage<TeamData[] | null>("ranking_data", null) || teamDatabase.map(t => ({ ...t }));

const Index = () => {
  const [navigation, setNavigation] = useState(initialNavigation);
  const navigationRef = useRef(navigation);
  const profileKey = useRef(0);
  const { tab: activeTab, profiles: profileStack, tournament } = navigation.current.view;
  const top = profileStack.at(-1) || null;

  const go = (view: NavigationView, nextScrollY = 0) => {
    const current = navigationRef.current;
    if (!current.current.view.profiles.length && !current.current.view.tournament) {
      writeUiPref(`scroll_tab_${current.current.view.tab}`, { x: 0, y: window.scrollY });
    }
    const next = pushNavigation(current, view, window.scrollY, nextScrollY);
    navigationRef.current = next;
    setNavigation(next);
  };

  const handleSelectTeam = (name: string) => {
    const view = navigationRef.current.current.view;
    go({ ...view, profiles: [...view.profiles, { kind: "team", name, key: ++profileKey.current }] });
  };
  const handleSelectPlayer = (name: string) => {
    const view = navigationRef.current.current.view;
    go({ ...view, profiles: [...view.profiles, { kind: "player", name, key: ++profileKey.current }] });
  };
  const handleOpenTournament = (tournamentId: string, matchId?: string) => {
    go({ tab: "tournaments", profiles: [], tournament: { tournamentId, matchId } });
  };
  const handleBack = () => {
    const next = backNavigation(navigationRef.current);
    navigationRef.current = next;
    setNavigation(next);
  };
  const handleTabChange = (tab: Tab) => {
    const saved = readUiPref<{ x: number; y: number } | null>(`scroll_tab_${tab}`, null);
    go({ tab, profiles: [], tournament: null }, saved?.y || 0);
  };

  // Each entry owns its scroll, independent of the underlying panel's offset.
  useEffect(() => {
    const y = navigation.current.scrollY;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: y }));
    const retry = window.setTimeout(() => window.scrollTo({ top: y }), 280);
    return () => { cancelAnimationFrame(frame); window.clearTimeout(retry); };
  }, [navigation]);

  const [teams, setTeams] = useState<TeamData[]>(loadRankingTeams);
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set<Tab>(["news"]));
  useEffect(() => {
    setVisited(v => (v.has(activeTab) ? v : new Set(v).add(activeTab)));
  }, [activeTab]);

  // Preload every panel's code in idle time so the first open is instant too.
  useEffect(() => {
    const idle = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 1500));
    idle(() => { PANEL_IMPORTS.forEach(load => { void load(); }); });
  }, []);

  useEffect(() => {
    let refreshFrame = 0;
    const refreshTeams = () => {
      if (refreshFrame) return;
      refreshFrame = requestAnimationFrame(() => {
        refreshFrame = 0;
        setTeams(loadRankingTeams());
      });
    };
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
      if (refreshFrame) cancelAnimationFrame(refreshFrame);
    };
  }, []);

  const profileOpen = !!top;

  // Keep the per-tab scroll offset in the save so reloading lands in place.
  useEffect(() => {
    if (profileOpen || tournament) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        writeUiPref(`scroll_tab_${activeTab}`, { x: 0, y: window.scrollY });
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [activeTab, profileOpen, tournament]);

  return (
    <ProfileNavProvider value={{ openTeam: handleSelectTeam, openPlayer: handleSelectPlayer, openTournament: handleOpenTournament }}>
      <div className="min-h-screen bg-background">
        <NavBar activeTab={activeTab} onTabChange={handleTabChange} />
        <CommandPalette
          onTabChange={handleTabChange}
          onSelectTeam={handleSelectTeam}
          onSelectPlayer={handleSelectPlayer}
        />

        <div className="container mx-auto px-4 pt-2">
          <Button variant="ghost" size="icon" onClick={handleBack} disabled={!navigation.past.length}
            aria-label="Wstecz" title="Wstecz" className="h-8 w-8 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Keep-alive: every visited panel stays mounted (hidden) so switching
            tabs is instant — no remount, no recomputation. */}
        <Suspense fallback={<PanelFallback />}>
        <div style={profileOpen ? { display: "none" } : undefined}>
          {(Object.keys(PANELS) as Tab[]).map(tab => {
            if (!visited.has(tab) || !PANELS[tab]) return null;
            return (
              <div key={tab} style={tab === activeTab ? undefined : { display: "none" }}>
                {PANELS[tab]?.({ onSelectTeam: handleSelectTeam, onSelectPlayer: handleSelectPlayer, tournamentSelection: tournament, onOpenTournament: handleOpenTournament, onBack: handleBack })}
              </div>
            );
          })}
        </div>

        {profileStack.map(profile => (
          <div key={profile.key} style={profile.key === top?.key ? undefined : { display: "none" }}>
            {profile.kind === "player" ? (
              <PlayerProfile playerName={profile.name} onBack={handleBack}
                onSelectTeam={handleSelectTeam} onSelectPlayer={handleSelectPlayer}
                seasonStandings={[]} dynamicRanking={teams} />
            ) : (
              <TeamProfile teamName={profile.name} onBack={handleBack} teams={teams}
                onSelectPlayer={handleSelectPlayer} />
            )}
          </div>
        ))}
        </Suspense>

        <footer className="border-t border-border py-6 mt-12">
          <div className="container mx-auto px-4 text-center">
            <p className="text-muted-foreground text-xs font-mono">
              CS:GO Tournament Hub © 2026
            </p>
          </div>
        </footer>

        <WorldClockWidget />
        <Suspense fallback={null}><YearAwardsCeremony /></Suspense>
      </div>
    </ProfileNavProvider>
  );
};

export default Index;
