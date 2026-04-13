# Project Memory

## Core
CS:GO Tournament Hub — manual database app, dark theme, Polish UI. PWA installable.
Panels: Aktualności (news feed), Ranking (editable points), Turnieje (manual results), Transfery.
Data persisted in localStorage (text) + IndexedDB (images). teamDatabase in tournaments.ts is master roster.
Always use semantic color tokens. No simulation — all data is manually entered by user.

## Memories
- [Player roles](mem://design/player-roles) — 5 roles per team, role colors and icons in playerRoles.ts
