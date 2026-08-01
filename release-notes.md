## PoliGame v1.3.1

### New features

**Theme system**
- **Theme asset loading** — background images and mascots stored inside user-theme asset folders are now resolved to data URLs at load/switch time via `get_theme_asset_base64`, so custom themes render correctly without a page reload.
- **`.pgtheme` export/import** — user themes can be exported as a portable zip archive bundling the YAML manifest plus all asset files. The Theme Gallery exposes a per-theme Export button; Install/Import accepts both `.pgtheme` archives and raw YAML files.
- **Mascot image picker** — the Theme Editor now has a dedicated mascot picker with inline preview that preserves the original file extension (JPEG/WebP/GIF, not just PNG).
- **Open themes folder** — the themes-folder button is wired to a new `open_path_in_explorer` Tauri command.
- **Real version in About** — a `get_app_version` Tauri command surfaces the version from `tauri.conf.json` so the About section always shows the correct number.
- **MascotOverlay user-theme support** — the mascot overlay loads assets from user-theme folders, not just built-in official themes.

**Epic Games integration**
- **Epic Games Launcher auto-start** — if Epic Games Launcher is not already running when a user launches an Epic title, PoliGame now locates and starts it (`-nosplashscreen`), waits up to 15 s for initialisation, then sends the deep-link. Resolves silent launch failures on a cold machine.
- **Epic launch URL** — the `com.epicgames.launcher://` deep-link requires the `AppName` field from the manifest (e.g. `"Sugar"` for Rocket League), not the `DisplayName`. `AppName` is now parsed and stored in `metadata_json`; existing library entries fall back to `launcher_game_id`.

### Bug fixes

**Game detection & Rich Presence**
- **Wrong-game detection** — the substring `contains` check in `process_matches_executable` matched unrelated running processes when the stored executable had a short name. Exact matches are preserved; `contains` is now gated behind a 5-character minimum on the bare stem (`.exe`/`.app` stripped before comparison).
- **Unicode process-name gate** — the 5-character guard previously used `.len()` (byte count), so multi-byte CJK stems passed the threshold and reintroduced false-positive matches. Switched to `.chars().count()`.
- **Rich Presence flickering** — `syncCurrentGame` cleared `runningGame` on the first null poll, causing a brief "Browsing launcher" flash during transient gaps in process detection. Two consecutive null results are now required before clearing (~3 s window).
- **`runningGameStore` stale counter** — `consecutiveNullPolls` was module-level and not reset on `setRunningGame`. A stale count from a prior session could clear a freshly-set game after a single null observation. Counter now resets at the top of `setRunningGame`.

**Theme editor & import**
- **Font dropdown** — replaced the native `<select>` in the Font Family row with the project's shadcn/ui `Select` component; each option is previewed in its own font.
- **`import_pgtheme` clean re-import** — the existing `assets/<id>` directory is removed before writing new files, so a re-import yields exactly the archive contents instead of a stale merge.
- **Mascot extension preservation** — ThemeEditor stores JPEG/WebP/GIF mascots with their correct extension instead of hardcoding `.png`.
- **Stale async callbacks** — functional `setState` updaters guard resolved data URLs with a stale-filename check, preventing an in-flight Tauri IPC callback from overwriting a Remove or Replace action.
- **`themeStore` rapid-switch race** — `setActiveThemeId` is applied synchronously first; the async background-image resolution is guarded by a stale-ID check so a slower resolution cannot overwrite a newer theme selection.
- **`get_theme_asset_base64` failure handling** — on error, `bgImage`/`mascotFile` are left as bare filenames rather than cleared, preventing a subsequent save from permanently deleting the value from the manifest.
- **`is_safe_filename` dot rejection** — the validator now rejects `"."` so a theme ID of `"."` cannot route assets into the shared `assets/` root, and `delete_theme(".")` cannot wipe all assets.

### Security hardening

- **Path-traversal prevention** (`import_pgtheme`) — manifest ID and asset relative paths containing `..`, `/`, `\`, or absolute prefixes are rejected at import time.
- **Zip-bomb mitigation** (`import_pgtheme`) — each decompressed archive entry is capped at 50 MB (`size()` pre-checked, then wrapped with `.take()` during read).
- **Write order** (`import_pgtheme`) — assets are written before the YAML manifest so a failed asset write does not leave a partially installed theme on disk.

### Other
- Removed mouse-wheel horizontal scroll from library game strips — navigation is arrow-button only.
- Subtle nav button animation polish.
