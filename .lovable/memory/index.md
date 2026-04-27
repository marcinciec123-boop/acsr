# Project Memory

## Core
CS:GO Tournament Hub — manual database app, dark theme, Polish UI. PWA installable.
Panels: Aktualności (news feed), Ranking (editable points), Turnieje, Transfery, Gracze.
Data persisted in localStorage (text) + IndexedDB (images). teamDatabase in tournaments.ts is master roster.
Always use semantic color tokens. No simulation — all data is manually entered by user.
Database mutations (transfers, rosters, FAs, roles, nationality, real names) persist across sessions
and are logged in `change_log` (lib/changeLog.ts) with snapshot-based revert. Bootstrapped via main.tsx.

## Memories
- [Player roles](mem://design/player-roles) — 5 roles per team, role colors and icons in playerRoles.ts
- [Change log](mem://features/change-log) — Snapshot-based change history + revert-to-point in TransferPanel
