import { useState } from "react";
import NavBar, { type Tab } from "@/components/NavBar";
import HeroSection from "@/components/HeroSection";
import OverviewSection from "@/components/OverviewSection";
import TournamentList from "@/components/TournamentList";
import EventCalendar from "@/components/EventCalendar";
import PlayerRankings from "@/components/PlayerRankings";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="min-h-screen bg-background">
      <NavBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "overview" && (
        <>
          <HeroSection onNavigate={setActiveTab} />
          <OverviewSection onNavigate={setActiveTab} />
        </>
      )}

      {activeTab === "tournaments" && <TournamentList />}
      {activeTab === "calendar" && <EventCalendar />}
      {activeTab === "rankings" && <PlayerRankings />}

      {/* Footer */}
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
