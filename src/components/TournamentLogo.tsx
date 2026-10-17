import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCachedTournamentLogo, loadTournamentLogo } from "@/lib/tournamentLogos";

interface Props {
  id: string;
  name?: string;
  size?: number;
  className?: string;
  /** Hide the trophy fallback when no logo has been set. */
  hideFallback?: boolean;
}

const TournamentLogo = ({ id, name, size = 32, className, hideFallback }: Props) => {
  const [logo, setLogo] = useState<string | null>(() => getCachedTournamentLogo(id) ?? null);

  useEffect(() => {
    let active = true;
    loadTournamentLogo(id).then(u => { if (active) setLogo(u); });
    const onUpdate = (e: Event) => {
      const d = (e as CustomEvent).detail as { id?: string };
      if (!d?.id || d.id === id) loadTournamentLogo(id).then(u => { if (active) setLogo(u); });
    };
    window.addEventListener("tournamentlogo:update", onUpdate);
    return () => { active = false; window.removeEventListener("tournamentlogo:update", onUpdate); };
  }, [id]);

  if (logo) {
    return (
      <span style={{ width: size, height: size }} className={cn("inline-flex items-center justify-center shrink-0 overflow-hidden rounded", className)}>
        <img src={logo} alt={name ? `${name} logo` : "logo turnieju"} className="w-full h-full object-contain" />
      </span>
    );
  }
  if (hideFallback) return null;
  return (
    <span style={{ width: size, height: size }} className={cn("inline-flex items-center justify-center shrink-0 rounded bg-primary/15 border border-primary/30 text-primary", className)}>
      <Trophy style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );
};

export default TournamentLogo;
