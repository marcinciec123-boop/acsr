import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Camera, Trash2 } from "lucide-react";
import { fileToLogoDataUrl, loadTeamLogo } from "@/lib/teamLogos";
import {
  PLAYER_PHOTO_EVENT,
  deletePlayerPhoto,
  jerseyColors,
  loadPlayerPhoto,
  savePlayerPhoto,
} from "@/lib/playerPhotos";
import { loadFromStorage } from "@/lib/storage";
import { teamDatabase } from "@/data/tournaments";
import type { TeamData } from "@/lib/types";

interface PlayerAvatarProps {
  playerName: string;
  teamName?: string;
  size?: number;
  className?: string;
  rounded?: "lg" | "xl" | "2xl" | "full";
  /** Shows upload / remove controls on hover. */
  editable?: boolean;
  /** Fills the parent container (full width/height) instead of a fixed square. */
  fill?: boolean;
}

const initialsOf = (name: string): string => {
  const clean = name.replace(/[^\p{L}\p{N} ]/gu, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return clean.slice(0, 2).toUpperCase() || "?";
};

/**
 * Procedural player avatar: a bust silhouette wearing a jersey in the team's
 * deterministic colours. Can be replaced by a custom uploaded photo.
 */
const PlayerAvatar = ({
  playerName, teamName: teamNameProp, size = 48, className, rounded = "xl", editable = false, fill = false,
}: PlayerAvatarProps) => {
  // Resolve the player's club when not supplied, so the jersey shows the crest.
  const teamName = useMemo(() => {
    if (teamNameProp) return teamNameProp;
    const teams = loadFromStorage<TeamData[] | null>("ranking_data", null) ?? teamDatabase;
    return teams.find(t => !t.isNational && (t.roster?.includes(playerName) || t.coach === playerName))?.name;
  }, [teamNameProp, playerName]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [teamLogo, setTeamLogo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;
    loadPlayerPhoto(playerName).then(url => { if (active) setPhoto(url); });
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail as { player?: string } | undefined;
      if (!detail?.player || detail.player === playerName) {
        loadPlayerPhoto(playerName).then(url => { if (active) setPhoto(url); });
      }
    };
    window.addEventListener(PLAYER_PHOTO_EVENT, onUpdate);
    return () => { active = false; window.removeEventListener(PLAYER_PHOTO_EVENT, onUpdate); };
  }, [playerName]);

  useEffect(() => {
    let active = true;
    if (!teamName) { setTeamLogo(null); return; }
    loadTeamLogo(teamName).then(url => { if (active) setTeamLogo(url); });
    const onLogo = (e: Event) => {
      const detail = (e as CustomEvent).detail as { teamName?: string } | undefined;
      if (!detail?.teamName || detail.teamName === teamName) {
        loadTeamLogo(teamName).then(url => { if (active) setTeamLogo(url); });
      }
    };
    window.addEventListener("teamlogo:update", onLogo);
    return () => { active = false; window.removeEventListener("teamlogo:update", onLogo); };
  }, [teamName]);

  const handleFile = useCallback(async (file: File | undefined) => {
    if (!file) return;
    try {
      const dataUrl = await fileToLogoDataUrl(file, 320);
      await savePlayerPhoto(playerName, dataUrl);
    } catch (e) {
      console.error("Player photo upload failed:", e);
    }
  }, [playerName]);

  const radius =
    rounded === "full" ? "rounded-full" :
    rounded === "2xl" ? "rounded-2xl" :
    rounded === "xl" ? "rounded-xl" : "rounded-lg";

  const colors = jerseyColors(teamName || playerName);
  const uid = `${playerName}-${teamName || ""}`.replace(/[^a-zA-Z0-9]/g, "");
  const initials = initialsOf(playerName);

  return (
    <div
      style={fill ? undefined : { width: size, height: size }}
      className={cn(fill && "w-full h-full", "relative overflow-hidden shrink-0 bg-secondary/40 group", radius, className)}
    >
      {photo ? (
        <img src={photo} alt={`${playerName}`} className="w-full h-full object-cover" />
      ) : (
        <svg viewBox="0 0 100 100" className="w-full h-full" role="img" aria-label={`${playerName} avatar`}>
          <defs>
            <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors.dark} />
              <stop offset="100%" stopColor="hsl(220 26% 10%)" />
            </linearGradient>
            <linearGradient id={`jersey-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={colors.base} />
              <stop offset="100%" stopColor={colors.dark} />
            </linearGradient>
          </defs>

          <rect width="100" height="100" fill={`url(#bg-${uid})`} />
          {/* subtle spotlight */}
          <ellipse cx="50" cy="34" rx="34" ry="30" fill={colors.accent} opacity="0.14" />

          {/* head + neck silhouette */}
          <circle cx="50" cy="36" r="17" fill="hsl(220 18% 82%)" opacity="0.9" />
          <rect x="43" y="49" width="14" height="10" rx="4" fill="hsl(220 16% 70%)" />

          {/* jersey shoulders */}
          <path
            d="M50 55 C33 55 20 65 16 80 L14 100 L86 100 L84 80 C80 65 67 55 50 55 Z"
            fill={`url(#jersey-${uid})`}
          />
          {/* collar */}
          <path d="M40 56 L50 68 L60 56 C56 54 44 54 40 56 Z" fill={colors.accent} />
          {/* shoulder stripes */}
          <path d="M18 74 C24 66 31 61 39 58 L41 64 C34 67 28 71 23 78 Z" fill={colors.accent} opacity="0.85" />
          <path d="M82 74 C76 66 69 61 61 58 L59 64 C66 67 72 71 77 78 Z" fill={colors.accent} opacity="0.85" />
          {/* chest crest: team logo, fallback to initials */}
          {teamLogo ? (
            <image
              href={teamLogo}
              x="34" y="70" width="32" height="26"
              preserveAspectRatio="xMidYMid meet"
              opacity="0.97"
            />
          ) : (
            <text
              x="50" y="90" textAnchor="middle"
              fontSize="15" fontWeight="700" letterSpacing="1"
              fill="hsl(0 0% 100%)" opacity="0.92"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            >
              {initials}
            </text>
          )}
        </svg>
      )}

      {editable && (
        <div
          className="absolute inset-0 flex items-center justify-center gap-1 bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title="Wgraj zdjęcie"
            onClick={() => inputRef.current?.click()}
            className="p-1.5 rounded-md bg-primary/20 text-primary hover:bg-primary/30 transition-colors"
          >
            <Camera className="w-4 h-4" />
          </button>
          {photo && (
            <button
              type="button"
              title="Usuń zdjęcie"
              onClick={() => { void deletePlayerPhoto(playerName); }}
              className="p-1.5 rounded-md bg-destructive/20 text-destructive hover:bg-destructive/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>
      )}
    </div>
  );
};

export default PlayerAvatar;
