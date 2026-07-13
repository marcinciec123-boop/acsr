import { useState } from "react";
import { motion } from "framer-motion";
import { Newspaper, Trophy, Users, ArrowRightLeft, Zap, Menu, X, User, HardDrive, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tab = "news" | "rankings" | "tournaments" | "transfers" | "teams" | "players" | "backup" | "settings";

interface NavBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "news", label: "Aktualności", icon: <Newspaper className="w-4 h-4" /> },
  { id: "rankings", label: "Ranking", icon: <Users className="w-4 h-4" /> },
  { id: "players", label: "Gracze", icon: <User className="w-4 h-4" /> },
  { id: "tournaments", label: "Turnieje", icon: <Trophy className="w-4 h-4" /> },
  { id: "transfers", label: "Transfery", icon: <ArrowRightLeft className="w-4 h-4" /> },
  { id: "backup", label: "Zapis", icon: <HardDrive className="w-4 h-4" /> },
  { id: "settings", label: "Ustawienia", icon: <Settings className="w-4 h-4" /> },
];

const NavBar = ({ activeTab, onTabChange }: NavBarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 glass-surface shadow-[0_4px_20px_-12px_hsl(var(--primary)/0.4)]">
      <div className="absolute bottom-0 inset-x-0 h-px hairline-primary opacity-70 pointer-events-none" />
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <button onClick={() => onTabChange("news")} className="flex items-center gap-2 group">
            <span className="relative flex items-center justify-center w-8 h-8 rounded-md bg-primary/15 border border-primary/40 group-hover:bg-primary/25 transition-colors">
              <Zap className="w-4 h-4 text-primary" />
              <span className="absolute inset-0 rounded-md bg-primary/20 blur-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </span>
            <span className="font-heading text-lg font-bold tracking-wider text-foreground">
              CS:GO <span className="text-primary neon-text">HUB</span>
            </span>
          </button>

          {/* Desktop tabs */}
          <div className="hidden sm:flex items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "relative flex items-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors rounded-md",
                  activeTab === tab.id
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
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

          {/* Mobile hamburger */}
          <button className="sm:hidden p-2 text-muted-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="sm:hidden pb-3 space-y-1"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { onTabChange(tab.id); setMobileOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </nav>
  );
};

export default NavBar;
export type { NavBarProps };
