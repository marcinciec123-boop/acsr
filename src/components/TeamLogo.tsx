import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { loadTeamLogo } from "@/lib/teamLogos";
import { teamTag } from "@/lib/teamHelpers";
import { teamDatabase } from "@/data/tournaments";
import { loadFromStorage } from "@/lib/storage";
import { countryFlag } from "@/lib/flags";
import type { TeamData } from "@/lib/types";

interface TeamLogoProps {
  teamName: string;
  size?: number;
  className?: string;
  rounded?: "md" | "lg" | "xl" | "full";
}

const gradientFor = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const palette = [
    "from-blue-500 to-indigo-700",
    "from-emerald-500 to-teal-700",
    "from-purple-500 to-fuchsia-700",
    "from-amber-500 to-orange-700",
    "from-rose-500 to-red-700",
    "from-cyan-500 to-sky-700",
    "from-lime-500 to-green-700",
    "from-pink-500 to-rose-700",
  ];
  return palette[Math.abs(hash) % palette.length];
};

const TeamLogo = ({ teamName, size = 48, className, rounded = "lg" }: TeamLogoProps) => {
  const [logo, setLogo] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadTeamLogo(teamName).then(url => { if (active) setLogo(url); });
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail as { teamName?: string };
      if (!detail?.teamName || detail.teamName === teamName) {
        loadTeamLogo(teamName).then(url => { if (active) setLogo(url); });
      }
    };
    window.addEventListener("teamlogo:update", onUpdate);
    return () => { active = false; window.removeEventListener("teamlogo:update", onUpdate); };
  }, [teamName]);

  const radius =
    rounded === "full" ? "rounded-full" :
    rounded === "xl" ? "rounded-xl" :
    rounded === "lg" ? "rounded-lg" : "rounded-md";

  // National team detection: name begins with a regional-indicator flag emoji.
  const firstCp = teamName ? teamName.codePointAt(0) ?? 0 : 0;
  const isNationalFlag =
    !logo &&
    ((firstCp >= 0x1F1E6 && firstCp <= 0x1F1FF) || teamName.startsWith("🇽🇰"));

  if (logo) {
    return (
      <div
        style={{ width: size, height: size }}
        className={cn("bg-secondary/40 border border-border flex items-center justify-center overflow-hidden shrink-0", radius, className)}
      >
        <img src={logo} alt={`${teamName} logo`} className="w-full h-full object-contain" />
      </div>
    );
  }

  if (isNationalFlag) {
    // Take the leading flag (one regional-indicator pair, or Kosovo special case)
    const flag = teamName.startsWith("🇽🇰") ? "🇽🇰" : String.fromCodePoint(...[...teamName].slice(0, 2).map(c => c.codePointAt(0) ?? 0));
    return (
      <div
        style={{ width: size, height: size, fontSize: Math.max(14, Math.round(size * 0.85)) }}
        className={cn("flex items-center justify-center shrink-0 leading-none select-none", radius, className)}
        aria-label={`${teamName} flag`}
      >
        {flag}
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.32)) }}
      className={cn(
        "bg-gradient-to-br text-white font-heading font-black flex items-center justify-center shrink-0 shadow-md",
        gradientFor(teamName),
        radius,
        className,
      )}
    >
      {teamTag(teamName)}
    </div>
  );
};

export default TeamLogo;
