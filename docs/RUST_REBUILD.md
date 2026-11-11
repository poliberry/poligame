# PoliGame Rust rebuild

## Goal

Move PoliGame from its React/TypeScript renderer to a Rust application while
keeping the launcher fast, polished, and feature complete. The current Tauri
application already has a substantial Rust desktop layer; the main rewrite is
the renderer and its feature integrations.

## Current baseline

- Desktop shell: Tauri 2, configured in `src-tauri/tauri.conf.json`.
- Native commands and services: `src-tauri/src/main.rs` plus Rust modules for
  games, launchers, profiles, settings, themes, system information, Discord
  presence, and updates.
- Renderer: React 18, TypeScript, Vite, and Zustand (`src/`); the Tauri webview
  loads its built frontend from `dist/`.
- Marketplace: `src/pages/Marketplace.tsx` embeds the `/desktop` marketplace
  URL in an iframe.
- Social/community: friends, presence, community, notifications, and forums are
  spread across renderer pages and Convex integrations.
- Crystal checkout inspected at `C:/Users/ddeba/Documents/Developer/crystal-desktop-v2`:
  its checked-in README describes an Electron/Next.js LiveKit voice and video
  client. No Rust API or WebSocket contract is documented there yet.

### Repository audit (2026-11-10)

- The production package is still Tauri + React. `npm run build` runs the
  TypeScript frontend build before packaging `dist/`; `rust-ui/` is not part of
  the release configuration.
- Native code is grouped under `src-tauri/src/`: `games/` owns the SQLite game
  database and launch/process workflows; `launchers/` detects and scans Steam,
  EA, Epic, and Rockstar; sibling modules provide browser storage, profiles,
  settings, SteamGridDB/Steam metadata, system information, themes, Discord
  presence, and updates. The game table stores artwork, metadata, launch
  arguments, playtime, and last-played timestamps. Achievement storage exists
  but must only be populated by a real provider.
- The frontend includes library/game details, browser, profiles, settings,
  auth/account, friends, notifications, privacy, community, marketplace,
  Overdrive, overlay, tray, setup, and auxiliary-window routes. Social features
  live across `convex/` and React hooks/pages. Marketplace is currently an
  iframe to `${VITE_POLIGAME_BASE_URL}/desktop`; its code fallback is `http://localhost:3000/desktop`.
- Existing controller-first work is called Overdrive. It includes dedicated
  pages/components, controller mappings and connection stores, and native
  power, network-settings, and overlay commands. Preserve it and audit parity
  before replacing it with a separate handheld shell.
- No local scan adapter was found for GOG, Ubisoft Connect, Xbox/Microsoft
  Store, Battle.net, itch.io, or emulators. Native download/install orchestration
  and provider-neutral achievements are also absent from the audited module
  list. Online services depend on configured marketplace/Convex deployments.
- The game schema initializer previously ignored every `ALTER TABLE` error,
  masking real migration failures as duplicate-column cases. It now checks
  column presence and propagates actual migration errors. A regression test
  covers migrating a legacy database while preserving its game rows.
- `src-tauri/tauri.conf.json` disables native decorations for the main window.
  Native title-bar behavior, DPI, Wayland/X11, and macOS validation remain open.
  System information and optional integrations need capability detection before
  the UI presents them as available.

### Route migration inventory

| Existing route/flow | Existing implementation | Migration status |
| --- | --- | --- |
| `/`, library shell | Rust Dioxus Home/Library backed by native list, scan, and launch commands | First Rust slice implemented; game details/history pending |
| `/settings`, `/profiles`, `/privacy` | React settings/profiles/privacy with Tauri commands | Not ported |
| `/overdrive`, overlay routes | React controller shell and overlay windows; native support varies | Not ported; preserve capability limits |
| auth, account, friends, notifications, profile | Convex and frontend social/account flows | Not ported; requires service contracts |
| community and game discussions | Convex community/forums and React pages | Not ported |
| `/marketplace` | Remote `/desktop` iframe | Not ported; requires catalogue/entitlement API |
| browser, tray, loader, launch, setup | Browser storage, tray, onboarding, and auxiliary windows | Not ported |
| customization, SteamGridDB picker, dialogs | Secondary React windows and native commands | Not ported |

The Rust UI was initially a static Dioxus prototype; it has since been replaced with a live local-library shell. It calls the existing Tauri commands for listing, scanning, and launching games. Account, social, marketplace, settings, and secondary-window flows still need Rust UI equivalents.

## Migration approach

Keep the current app as the working reference while replacing one feature slice
at a time. Each slice should have a Rust UI, Rust-owned state and persistence,
and explicit service interfaces. Avoid a flag-day rewrite that strands existing
user data or removes working launcher features before their replacements exist.

1. **Foundation (selected):** use Dioxus for Rust-authored UI hosted by the
   existing Tauri 2 shell. This keeps current desktop integrations and update
   packaging while replacing React route by route. Use typed Rust service
   interfaces for UI data; keep any Tauri JavaScript bridge as a narrow,
   temporary native-platform boundary. Define navigation, theme,
   accessibility, error handling, and persistence before porting screens.
2. **Launcher core:** port app shell, library, search, game details, launch
   progress, setup, and settings. Reuse or extract the Rust services already in
   `src-tauri` instead of rewriting working platform integrations.
3. **Account and social:** isolate identity, profiles, friends, presence,
   notifications, and community behind Rust service traits. Implement an
   authenticated HTTP/WebSocket adapter when Crystal publishes its API
   contract; retain a separate adapter for any social services that remain
   external.
4. **Marketplace:** replace the embedded page with a native catalogue and
   detail/install flows backed by a versioned marketplace API. Keep purchase,
   entitlement, and install verification on the server side.
5. **Retire the old renderer:** migrate every route and secondary window,
   verify existing data/settings survive, then remove React/Vite dependencies
   and the old frontend build from release packaging.

## First implementation slice

Start with the Rust app foundation and library shell, since it validates the
toolkit, navigation, visual system, and reuse of the existing launcher service
before social and marketplace work depend on those choices. Keep feature parity
visible in a route inventory so omissions are deliberate and trackable. Once
the final route has moved, evaluate whether Tauri remains the right shell; the
first migration phase is focused on making the full application UI Rust-authored.

The Rust UI in `rust-ui/` now builds as a WebAssembly renderer for the existing Tauri shell. Its first working slice uses a typed Tauri command bridge to read the local game database, scan installed launchers, search the library, and launch installed games. The Dioxus renderer has separate `dev:rust-ui` and `build:rust-ui` scripts plus `src-tauri/tauri.rust-ui.conf.json`; the default release still uses React until route, social, marketplace, settings, and secondary-window parity is migrated. This keeps the migration testable while making the Rust-authored application executable rather than a static mockup.

**Current migration status:** the Rust foundation and live library slice are implemented. Rust-authored social/account, marketplace, downloads, settings, Overdrive, overlay, auxiliary windows, and route parity remain in progress. The next slices should port game details and launch history, then account/friends and marketplace against existing service contracts, keeping those services live through the renderer transition.

## Crystal integration contract to settle

Before wiring social flows, document the API base URL and environment routing,
authentication/token refresh, user/profile identifiers, friend and presence
events, reconnect/backoff behavior, WebSocket message schemas, and versioning.
The client should consume a stable protocol and must not depend on Crystal's
current Electron renderer internals. LiveKit voice/video should remain a
separate capability with its own token and room lifecycle.

## Exit criteria

- All user-facing PoliGame routes and secondary windows have Rust UI
  equivalents, including marketplace and social flows.
- Game detection, launch, profiles, themes, controller/Overdrive support,
  notifications, updates, and settings retain their existing behavior.
- User data and settings migrate safely, with a rollback path during rollout.
- The release build no longer packages or executes the React/TypeScript
  frontend.
- Crystal integration uses documented, versioned HTTP/WebSocket contracts and
  has explicit offline, authentication-expired, and reconnect states.

