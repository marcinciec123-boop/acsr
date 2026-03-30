import { useState } from "react";
import { motion } from "framer-motion";
import { Crosshair, Trophy, Calendar, Users, Zap, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "overview" | "tournaments" | "calendar" | "rankings" | "standings" | "settings";

interface NavBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Crosshair className="w-4 h-4" /> },
  { id: "tournaments", label: "Tournaments", icon: <Trophy className="w-4 h-4" /> },
  { id: "calendar", label: "Calendar", icon: <Calendar className="w-4 h-4" /> },
  { id: "rankings", label: "Rankings", icon: <Users className="w-4 h-4" /> },
  { id: "standings", label: "Standings", icon: <Trophy className="w-4 h-4" /> },
  { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
];

const NavBar = ({ activeTab, onTabChange }: NavBarProps) => {
  return (
    <nav className="sticky top-0 z-50 border-b border-border glass-surface">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            <span className="font-heading text-xl font-bold tracking-wider text-foreground">
              CS:GO <span className="text-primary">HUB</span>
            </span>
          </div>

          <div className="flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors rounded-md",
                  activeTab === tab.id
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-md bg-primary/10 border border-primary/30"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default NavBar;
export type { Tab };
