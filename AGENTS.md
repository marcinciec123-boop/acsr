- Render trophy artwork from one 4×4 generated sprite atlas with a deterministic tournament-name variant, so the same event always has the same trophy in player and team profiles without sixteen separate downloads.
- Derive cabinet entries from each save's existing tournament placements and player career participation; never persist duplicate trophy awards, so imported saves appear automatically.

- Desktop app is a Tauri v2 shell in src-tauri bundling the built dist offline; GitHub Actions builds a signed release on every push to main and the in-app updater pulls latest.json, since the sandbox cannot produce .exe files.
- Keep src-tauri/Cargo.lock committed and pin withdrawn (yanked) transitive crates through [patch.crates-io] in src-tauri/Cargo.toml, so CI dependency resolution keeps working when crates.io pulls a version.
- Bracket views derive match positions and connector paths through the shared graph-based bracket layout helper, so irregular lower-bracket rounds remain aligned across tournament and group views.
