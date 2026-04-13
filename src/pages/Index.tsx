import { useState } from "react";
import NavBar, { type Tab } from "@/components/NavBar";
import NewsFeed from "@/components/NewsFeed";
import RankingPanel from "@/components/RankingPanel";
import TournamentPanel from "@/components/TournamentPanel";
import TransferPanel from "@/components/TransferPanel";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("news");

  return (
    <div className="min-h-screen bg-background">
      <NavBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "news" && <NewsFeed />}
      {activeTab === "rankings" && <RankingPanel />}
      {activeTab === "tournaments" && <TournamentPanel />}
      {activeTab === "transfers" && <TransferPanel />}

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
