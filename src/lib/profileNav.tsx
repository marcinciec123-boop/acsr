// ===== Profile navigation context =====
// Lets any deep child (participants list, match tables) open a team/player
// profile without prop-drilling. When no provider is present, hooks return
// no-ops so components fall back to plain text.

import React, { createContext, useContext, type ReactNode } from "react";

export interface ProfileNav {
  openTeam: (name: string) => void;
  openPlayer: (name: string) => void;
  /** Opens the tournaments tab on a given tournament (and optionally a match). */
  openTournament?: (tournamentId: string, matchId?: string) => void;
}

const Ctx = createContext<ProfileNav | null>(null);

export const ProfileNavProvider = ({ value, children }: { value: ProfileNav; children: ReactNode }) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
);

export const useProfileNav = (): ProfileNav | null => useContext(Ctx);

const isReal = (name?: string) =>
  !!name && name !== "TBD" && name !== "BYE" && !name.startsWith("TBD");

/** Inline clickable team name (renders a span so it can nest inside other buttons). */
export const TeamLink = ({
  name,
  className,
  children,
}: {
  name?: string;
  className?: string;
  children?: ReactNode;
}) => {
  const nav = useProfileNav();
  const content = children ?? name;
  if (!nav || !isReal(name)) return <span className={className}>{content}</span>;
  const activate = (e: React.SyntheticEvent) => { e.stopPropagation(); nav.openTeam(name!); };
  return (
    <span
      role="link"
      tabIndex={0}
      onClick={activate}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(e); } }}
      className={`${className ?? ""} hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer`}
    >
      {content}
    </span>
  );
};

/** Inline clickable player name. */
export const PlayerLink = ({
  name,
  className,
  children,
}: {
  name?: string;
  className?: string;
  children?: ReactNode;
}) => {
  const nav = useProfileNav();
  const content = children ?? name;
  if (!nav || !isReal(name)) return <span className={className}>{content}</span>;
  const activate = (e: React.SyntheticEvent) => { e.stopPropagation(); nav.openPlayer(name!); };
  return (
    <span
      role="link"
      tabIndex={0}
      onClick={activate}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(e); } }}
      className={`${className ?? ""} hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer`}
    >
      {content}
    </span>
  );
};
