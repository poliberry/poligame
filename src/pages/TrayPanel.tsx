import React, { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  Library,
  UserRound,
  Users,
  Settings,
  Power,
  Play,
  ChevronRight,
  History,
} from "lucide-react";

type TrayRecentGame = {
  id: string;
  title: string;
  launcher: string;
  playtimeMinutes: number;
  lastPlayed?: string;
  coverArt?: string;
  gridCoverArt?: string;
  icon?: string;
};

const NAV_ITEMS = [
  { label: "Library", route: "/", icon: Library },
  { label: "Profile", route: "/profile", icon: UserRound },
  { label: "Community", route: "/community", icon: Users },
  { label: "Settings", route: "/settings", icon: Settings },
];

function formatRelativeDate(value?: string): string {
  if (!value) {
    return "No recent session";
  }

  const date = new Date(value);
  const deltaMs = Date.now() - date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (deltaMs < dayMs) {
    return "Today";
  }

  if (deltaMs < dayMs * 2) {
    return "Yesterday";
  }

  const days = Math.floor(deltaMs / dayMs);
  if (days < 7) {
    return `${days}d ago`;
  }

  return date.toLocaleDateString();
}

function formatPlaytime(minutes: number): string {
  if (minutes <= 0) {
    return "0m";
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours <= 0) {
    return `${mins}m`;
  }

  if (mins <= 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}m`;
}

const TrayPanel: React.FC = () => {
  const [recentGames, setRecentGames] = useState<TrayRecentGame[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const games = await invoke<TrayRecentGame[]>("get_recently_played_games", {
          limit: 5,
        });
        setRecentGames(games);
      } catch (error) {
        console.error("Failed to load recently played games:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRecent();
  }, []);

  useEffect(() => {
    const onEscape = async (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        await invoke("hide_tray_panel");
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  const panelStyle = useMemo(
    () => ({
      fontFamily:
        '"Google Sans Flex", "Google Sans Text", "Roboto Flex", "Segoe UI Variable", "Segoe UI", sans-serif',
      background:
        "linear-gradient(180deg, color-mix(in oklab, var(--theme-panel, var(--card)) 92%, black 8%) 0%, color-mix(in oklab, var(--theme-background, var(--background)) 96%, black 4%) 100%)",
      color: "var(--foreground)",
      borderColor: "color-mix(in oklab, var(--theme-accent, var(--ring)) 28%, transparent)",
    }),
    [],
  );

  const openRoute = async (route: string) => {
    await invoke("open_main_route", { route });
  };

  const openGame = async (gameId: string) => {
    await invoke("open_main_route", { route: `/game/${gameId}` });
  };

  const playGame = async (gameId: string) => {
    await invoke("launch_game", { gameId });
    await invoke("hide_tray_panel");
  };

  const quitApp = async () => {
    await invoke("quit_application");
  };

  return (
    <div className="h-screen w-screen overflow-hidden">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Roboto+Flex:opsz,wght@8..144,300..800&display=swap"
        rel="stylesheet"
      />

      <div
        className="h-full w-full border rounded-2xl backdrop-blur-xl shadow-[0_24px_64px_rgba(0,0,0,0.4)] p-4 flex flex-col gap-4"
        style={panelStyle}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/60">PoliGame</p>
            <h1 className="text-xl font-semibold">Quick Hub</h1>
            <p className="text-xs text-foreground/60">Running in background</p>
          </div>
          <button
            type="button"
            onClick={() => void openRoute("/")}
            className="px-3 py-2 rounded-xl bg-[var(--theme-button-secondary)]/80 hover:bg-[var(--theme-button)]/80 text-sm transition-colors cursor-pointer"
          >
            Open App
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => void openRoute(item.route)}
                className="group rounded-xl px-3 py-2 text-left border border-white/10 bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className="text-[var(--theme-accent)]" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  <ChevronRight size={14} className="text-foreground/40 group-hover:text-foreground/70" />
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 mt-1">
          <History size={15} className="text-[var(--theme-accent)]" />
          <h2 className="text-sm font-medium">Recently Played</h2>
        </div>

        <div className="flex-1 overflow-auto pr-1 content-view-scrollbar">
          {loading && <p className="text-sm text-foreground/60">Loading recent games...</p>}

          {!loading && recentGames.length === 0 && (
            <p className="text-sm text-foreground/60">No recent games yet. Launch a game to see activity here.</p>
          )}

          <div className="space-y-2">
            {recentGames.map((game) => {
              const image = game.gridCoverArt || game.coverArt || game.icon;

              return (
                <div
                  key={game.id}
                  className="group rounded-xl border border-white/10 bg-black/20 hover:bg-black/30 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => void openGame(game.id)}
                    className="w-full px-2.5 pt-2.5 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-lg overflow-hidden bg-white/10 flex items-center justify-center shrink-0">
                        {image ? (
                          <img src={image} alt={game.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold text-foreground/70">
                            {game.title.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{game.title}</p>
                        <p className="text-[11px] text-foreground/60">
                          {formatRelativeDate(game.lastPlayed)} • {formatPlaytime(game.playtimeMinutes)}
                        </p>
                      </div>
                    </div>
                  </button>

                  <div className="px-2.5 pb-2.5 pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => void playGame(game.id)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--theme-accent)]/20 hover:bg-[var(--theme-accent)]/30 text-xs text-foreground transition-colors cursor-pointer"
                    >
                      <Play size={12} />
                      Play
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => void quitApp()}
          className="w-full mt-1 rounded-xl px-3 py-2 text-sm font-medium bg-red-500/20 hover:bg-red-500/30 text-red-100 border border-red-400/20 transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
        >
          <Power size={14} />
          Fully Quit PoliGame
        </button>
      </div>
    </div>
  );
};

export default TrayPanel;
