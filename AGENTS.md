- Render trophy artwork from one 4×4 generated sprite atlas with a deterministic tournament-name variant, so the same event always has the same trophy in player and team profiles without sixteen separate downloads.
- Derive cabinet entries from each save's existing tournament placements and player career participation; never persist duplicate trophy awards, so imported saves appear automatically.

- Desktop app is a Tauri v2 shell in src-tauri bundling the built dist offline; Windows installers are built by the GitHub Actions workflow, since the sandbox cannot produce .exe files.
