---
name: Change log
description: Snapshot-based change history with revert-to-point for the manual database
type: feature
---
Every mutation to the persistent database goes through `src/lib/changeLog.ts`:
- `captureSnapshot()` grabs rosters, custom transfers, manual FAs, all overrides.
- `recordChange(kind, description, before)` appends an entry (capped at 500) to `change_log`.
- `revertTo(id)` restores the snapshot from that entry and drops it + everything after.
- `bootstrapPersistedState()` runs in main.tsx to rehydrate from localStorage.
- TransferPanel exposes the log under "Historia zmian" tab with per-entry "Cofnij" button.
- Mutators that log: transfers (TransferPanel), FA add/edit/remove (PlayersPanel), role/nationality changes (PlayerProfile, PlayersPanel).
- Persistence keys: `csgo_hub_change_log`, `csgo_hub_custom_transfers`, `csgo_hub_roster_overrides`, `csgo_hub_player_role_overrides`, `csgo_hub_player_nat_overrides`, `csgo_hub_player_realname_overrides`.
