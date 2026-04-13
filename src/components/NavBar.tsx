import { useState } from "react";
import { motion } from "framer-motion";
import { Newspaper, Trophy, Users, ArrowRightLeft, Zap, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tab = "news" | "rankings" | "tournaments" | "transfers" | "teams";

interface NavBarProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "news", label: "Aktualności", icon: <Newspaper className="w-4 h-4" /> },
  { id: "rankings", label: "Ranking", icon: <Users className="w-4 h-4" /> },
  { id: "tournaments", label: "Turnieje", icon: <Trophy className="w-4 h-4" /> },
  { id: "transfers", label: "Transfery", icon: <ArrowRightLeft className="w-4 h-4" /> },
];

const NavBar = ({ activeTab, onTabChange }: NavBarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-border glass-surface">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          <button onClick={() => onTabChange("news")} className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <span className="font-heading text-lg font-bold tracking-wider text-foreground">
              CS:GO <span className="text-primary">HUB</span>
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
