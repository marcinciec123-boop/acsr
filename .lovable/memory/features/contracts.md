---
name: Player contracts
description: Contract module — salaries, durations, statuses, renewals, auto-expiry to free agency
type: feature
---
`src/lib/contracts.ts` (storage key `player_contracts`, event `contracts:update`):
- Contract: player, team, startDate, endDate, salary (monthly USD), signedAt, terms (buyout, signingBonus, note, role).
- Status computed live from world clock: active / warning (≤90d) / critical (≤30d) / expired / terminated.
- `suggestSalary` = team rank base × player rating factor × role multiplier (IGL 1.18, AWPer 1.15, Entry 1.05, Lurker 1.0, Anchor 0.98, Coach 0.7) × deterministic seeded random.
- `seedMissingContracts()` gives every rostered player/coach a 4–24 month contract; never duplicates.
- `signContract` / `renewContract` / `terminateContract` validate and archive the previous contract into history.
- `src/lib/contractExpiry.ts`: expired contracts release the player to FA (roster removal + transfer to "-" + change log entry). Runs at startup and on `worldclock:update`.
UI: `contracts/TeamContractsPanel` (team tab "Kontrakty"), `ContractsWidget` (team overview), `PlayerContractCard` (player profile), `RenewContractDialog`, `ContractStatusBadge`. TransferPanel negotiates salary/duration/buyout when signing.
