// ===== Profile navigation context =====
// Lets any deep child (participants list, match tables) open a team/player
// profile without prop-drilling. When no provider is present, hooks return
// no-ops so components fall back to plain text.

import { createContext, useContext, type ReactNode } from "react";

export interface ProfileNav {
  openTeam: (name: string) => void;
  openPlayer: (name: string) => void;
}

const Ctx = createContext<ProfileNav | null>(null);

export const ProfileNavProvider = ({ value, children }: { value: ProfileNav; children: ReactNode }) => (
  <Ctx.Provider value={value}>{children}</Ctx.Provider>
);

export const useProfileNav = (): ProfileNav | null => useContext(Ctx);

const isReal = (name?: string) =>
  !!name && name !== "TBD" && name !== "BYE" && !name.startsWith("TBD");

/** Inline clickable team name. Falls back to plain span when no nav is active. */
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
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); nav.openTeam(name!); }}
      className={`${className ?? ""} hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer text-left`}
    >
      {content}
    </button>
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
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); nav.openPlayer(name!); }}
      className={`${className ?? ""} hover:text-primary hover:underline underline-offset-2 transition-colors cursor-pointer text-left`}
    >
      {content}
    </button>
  );
};
