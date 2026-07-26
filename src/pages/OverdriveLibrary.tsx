import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { useGameWithCustomizations } from "@/hooks/useGameWithCustomizations";
import OverdriveTopBar from "@/components/overdrive/OverdriveTopBar";
import OverdriveNavigationHints, { OverdriveHintItem } from "@/components/overdrive/OverdriveNavigationHints";
import { getImageUrl } from "@/utils/imageUtils";
import { cn } from "@/lib/utils";
import { Game } from "@/types";
import { Search, Library, ExternalLink } from "lucide-react";

const LAUNCHER_ORDER = ["steam", "epic", "ea", "rockstar", "custom"];

const formatLauncherLabel = (launcher: string): string => {
  const normalized = (launcher || "unknown").toLowerCase();
  if (normalized === "ea") return "EA";
  if (normalized === "epic") return "Epic Games";
  if (normalized === "rockstar") return "Rockstar";
  if (normalized === "custom") return "Custom";
  if (normalized === "steam") return "Steam";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

interface OverdriveLibraryCardProps {
  game: Game;
  onOpen: (id: string) => void;
}

const OverdriveLibraryCard: React.FC<OverdriveLibraryCardProps> = ({ game, onOpen }) => {
  const displayGame = useGameWithCustomizations(game) || game;
  const coverArt = getImageUrl(displayGame.gridCoverArt || displayGame.coverArt || displayGame.headerArt);

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(game.id)}
      className="group relative text-left"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      style={{ fontFamily: "Google Sans Flex, sans-serif" }}
    >
      <div className="relative h-[300px] w-[200px] overflow-hidden ring-2 ring-white/20 transition-all duration-200 group-hover:ring-[#107c10] group-hover:shadow-[0_0_24px_rgba(16,124,16,0.45)]">
        {coverArt ? (
          <img
            src={coverArt}
            alt={displayGame.title}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1f3a] to-[#0a0e27]" />
        )}
        <div className="absolute inset-0 bg-black/25 group-hover:bg-black/15" />
      </div>
      <div className="mt-3 max-w-[200px]">
        <p className="truncate text-sm font-semibold text-white">{displayGame.title}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.16rem] text-white/55">{formatLauncherLabel(String(displayGame.launcher || "custom"))}</p>
      </div>
    </motion.button>
  );
};

const OverdriveLibrary: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { games, setGames } = useGameStore();

  const [searchQuery, setSearchQuery] = React.useState(searchParams.get("query") || "");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const queryFromUrl = searchParams.get("query") || "";
    setSearchQuery(queryFromUrl);
  }, [searchParams]);

  React.useEffect(() => {
    if (games.length > 0) {
      return;
    }

    let cancelled = false;
    const loadGames = async () => {
      setLoading(true);
      try {
        const gameList = await invoke<Game[]>("get_all_games");
        if (cancelled) {
          return;
        }
        const normalized = gameList.map((game) => ({
          ...game,
          launcher: String(game.launcher || "custom").toLowerCase(),
        }));
        setGames(normalized);
      } catch (error) {
        console.error("Failed to load games for Overdrive library:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadGames();
    return () => {
      cancelled = true;
    };
  }, [games.length, setGames]);

  const filteredGames = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return games;
    }

    return games.filter((game) => {
      const title = game.title?.toLowerCase() || "";
      const launcher = String(game.launcher || "").toLowerCase();
      const developer = game.developer?.toLowerCase() || "";
      const publisher = game.publisher?.toLowerCase() || "";
      return title.includes(query) || launcher.includes(query) || developer.includes(query) || publisher.includes(query);
    });
  }, [games, searchQuery]);

  const groupedGames = React.useMemo(() => {
    const byLauncher = new Map<string, Game[]>();

    filteredGames.forEach((game) => {
      const key = String(game.launcher || "custom").toLowerCase();
      const list = byLauncher.get(key) || [];
      list.push(game);
      byLauncher.set(key, list);
    });

    const orderedKeys = [
      ...LAUNCHER_ORDER.filter((launcher) => byLauncher.has(launcher)),
      ...Array.from(byLauncher.keys()).filter((launcher) => !LAUNCHER_ORDER.includes(launcher)),
    ];

    return orderedKeys.map((launcher) => ({
      launcher,
      games: (byLauncher.get(launcher) || []).sort((a, b) => a.title.localeCompare(b.title)),
    }));
  }, [filteredGames]);

  const handleSearchQueryChange = React.useCallback((value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      setSearchParams({ query: value }, { replace: true });
      return;
    }
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const handleSearchSubmit = React.useCallback(() => {
    const query = searchQuery.trim();
    if (query) {
      setSearchParams({ query }, { replace: true });
      return;
    }
    setSearchParams({}, { replace: true });
  }, [searchQuery, setSearchParams]);

  const handleOpenGame = React.useCallback((id: string) => {
    navigate(`/overdrive/game/${id}`, {
      state: {
        skipOverdriveIntro: true,
        overdriveSound: "sectionChange",
      },
    });
  }, [navigate]);

  const handleBack = React.useCallback(() => {
    const state = window.history.state as { idx?: number } | null;
    if (state && typeof state.idx === "number" && state.idx > 0) {
      navigate(-1);
      return;
    }

    navigate("/overdrive", { replace: true });
  }, [navigate]);

  const hints = React.useMemo<OverdriveHintItem[]>(() => ([
    { id: "search", label: "Search", keyLabel: "Enter", controllerButton: "a" },
    { id: "open", label: "Open Game", keyLabel: "Enter", controllerButton: "a" },
    { id: "back", label: "Back", keyLabel: "Esc", controllerButton: "b", onActivate: handleBack },
  ]), [handleBack]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-950 text-white">
      <style>{`.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } .no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
      <OverdriveTopBar
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchQueryChange}
        onSearchSubmit={handleSearchSubmit}
      />

      <div className="h-full overflow-y-auto no-scrollbar px-8 pb-24 pt-20">
        <div className="mb-6 flex items-center gap-3" style={{ fontFamily: "Unbounded, sans-serif" }}>
          <Library className="h-6 w-6 text-[#9cf39c]" />
          <h1 className="text-2xl font-medium">All Games</h1>
          {searchQuery.trim() ? (
            <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.14rem] text-white/70">
              Filter: {searchQuery}
            </span>
          ) : null}
        </div>

        {loading ? (
          <div className="flex h-[45vh] flex-col items-center justify-center gap-3 text-white/60">
            <Search className="h-8 w-8 animate-pulse" />
            <p>Loading library...</p>
          </div>
        ) : groupedGames.length > 0 ? (
          <div className="space-y-10">
            {groupedGames.map((group) => (
              <section key={group.launcher}>
                <div className="mb-4 flex items-center gap-3">
                  <h2
                    className="text-sm uppercase tracking-[0.22rem] text-white/65"
                    style={{ fontFamily: "Google Sans Flex, sans-serif" }}
                  >
                    {formatLauncherLabel(group.launcher)}
                  </h2>
                  <span className="text-xs text-white/45">{group.games.length} games</span>
                </div>

                <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-6 gap-y-10">
                  {group.games.map((game) => (
                    <OverdriveLibraryCard key={game.id} game={game} onOpen={handleOpenGame} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex h-[45vh] flex-col items-center justify-center gap-3 text-white/55">
            <Search className="h-10 w-10 opacity-60" />
            <p className="text-lg">No games found for this filter.</p>
          </div>
        )}
      </div>

      <OverdriveNavigationHints items={hints} />
    </div>
  );
};

export default OverdriveLibrary;
