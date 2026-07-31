import React, { useEffect, useState } from "react";
import { MascotOverlay } from "@/components/MascotOverlay";
import { useThemeStore } from "@/stores/themeStore";
import { listen } from "@tauri-apps/api/event";
import { useGameStore } from "@/stores/gameStore";
import { useLibraryContext } from "@/contexts/LibraryContext";
import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  Shuffle,
  Clock,
  TrendingUp,
  Star,
  Calendar,
  Gamepad2,
  Dices,
} from "lucide-react";
import { useLauncherStore } from "@/stores/launcherStore";
import { AddCustomAppDialog } from "@/components/AddCustomAppDialog";
import { GameCard } from "@/components/GameCard";
import { smartSearch } from "@/utils/smartSearch";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthStore } from "@/stores/authStore";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate } from "react-router-dom";
// @ts-ignore
import welcomeBkg from "@/public/setup-bkg.png";

interface HorizontalGameRailProps {
  games: any[];
  onCardClick?: (gameId: string) => void;
  onRefresh: () => void;
}

const HorizontalGameRail: React.FC<HorizontalGameRailProps> = ({
  games,
  onCardClick,
  onRefresh,
}) => {
  const railRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollButtons = React.useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;

    const maxScrollLeft = rail.scrollWidth - rail.clientWidth;
    setCanScrollLeft(rail.scrollLeft > 8);
    setCanScrollRight(rail.scrollLeft < maxScrollLeft - 8);
  }, []);

  useEffect(() => {
    updateScrollButtons();
  }, [games, updateScrollButtons]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    const handleScroll = () => updateScrollButtons();
    rail.addEventListener("scroll", handleScroll, { passive: true });

    const resizeObserver = new ResizeObserver(() => updateScrollButtons());
    resizeObserver.observe(rail);

    return () => {
      rail.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, [updateScrollButtons]);

  const scrollByCards = (direction: "left" | "right") => {
    const rail = railRef.current;
    if (!rail) return;
    const amount = Math.max(rail.clientWidth * 0.75, 260);
    rail.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  const handleWheelScroll = (event: React.WheelEvent<HTMLDivElement>) => {
    const rail = railRef.current;
    if (!rail) return;

    const isMostlyVertical = Math.abs(event.deltaY) > Math.abs(event.deltaX);
    if (isMostlyVertical) {
      rail.scrollBy({
        left: event.deltaY,
        behavior: "auto",
      });
      event.preventDefault();
    }
  };

  return (
    <div className="relative group">
      {canScrollLeft && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm"
          onClick={() => scrollByCards("left")}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      )}

      <div
        ref={railRef}
        className="scrollbar-hide flex flex-row gap-5 overflow-x-auto overflow-y-hidden px-5 py-5 -mx-5"
        onWheel={handleWheelScroll}
      >
        {games.map((game) => (
          <div
            key={game.id}
            onClick={() => onCardClick?.(game.id)}
            className={`flex-shrink-0 ${onCardClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
          >
            <GameCard game={game} viewMode="grid" onRefresh={onRefresh} />
          </div>
        ))}
      </div>

      {canScrollRight && (
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-sm"
          onClick={() => scrollByCards("right")}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

const Library: React.FC = () => {
  const { games, isLoading, setGames } = useGameStore();
  const { setScanning, isScanning } = useLauncherStore();
  const { searchQuery, filterLauncher, viewMode } = useLibraryContext();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  // Get all playtime data for the user
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playtimeApi = api as any;
  const allPlaytimeData = useQuery(
    playtimeApi.playtime?.getUserPlaytime,
    user?.userId ? { userId: user.userId as Id<"users"> } : "skip",
  );

  useEffect(() => {
    console.log("Games in store updated:", games.length, games);
  }, [games]);

  const handleRefreshGames = async () => {
    try {
      const allGames = await invoke<any[]>("get_all_games");
      setGames(allGames);
    } catch (error) {
      console.error("Error refreshing games:", error);
    }
  };

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      try {
        unlisten = await listen("custom-app-updated", async () => {
          await handleRefreshGames();
        });
      } catch (error) {
        console.debug("Custom app update listener unavailable", error);
      }
    };

    setup();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, []);

  const handleOpenAddCustomApp = async () => {
    try {
      await invoke("create_custom_app_dialog_window", {
        action: "add",
      });
    } catch (error) {
      console.debug("Custom dialog window unavailable, falling back inline", error);
      setShowAddDialog(true);
    }
  };

  const scanGames = async () => {
    setScanning(true);
    const result = await invoke<string>("scan_all_games");
    console.log("Scan result:", result);
    setScanning(false);
  };

  const handleGameRoulette = async () => {
    if (filteredGames.length === 0) {
      return;
    }

    // Pick a random game
    const randomIndex = Math.floor(Math.random() * filteredGames.length);
    const randomGame = filteredGames[randomIndex];

    try {
      await invoke("launch_game", { gameId: randomGame.id });
    } catch (error) {
      console.error("Failed to launch random game:", error);
    }
  };

  // Use smart search for better matching
  const searchFilteredGames = searchQuery.trim()
    ? smartSearch(games, searchQuery)
    : games;

  const filteredGames = searchFilteredGames.filter((game) => {
    const matchesLauncher =
      filterLauncher === "all" || game.launcher === filterLauncher;
    return matchesLauncher;
  });

  // Create playtime map for quick lookups
  const playtimeMap = React.useMemo(() => {
    if (!allPlaytimeData) return new Map();
    return new Map(
      allPlaytimeData.map(
        (pt: { gameId: string; totalPlaytime: number; lastPlayed: number }) => [
          pt.gameId,
          pt,
        ],
      ),
    );
  }, [allPlaytimeData]);

  // Get "Let's jump back in" games - recently played games with playtime
  const jumpBackInGames = React.useMemo(() => {
    if (!playtimeMap.size || !games.length) return [];

    // Get games that have playtime data and sort by lastPlayed
    const gamesWithPlaytime = games
      .map((game) => {
        const playtime = playtimeMap.get(game.id);
        return {
          game,
          playtime,
          lastPlayed: playtime?.lastPlayed || 0,
        };
      })
      .filter((item) => item.playtime && item.lastPlayed > 0)
      .sort((a, b) => b.lastPlayed - a.lastPlayed)
      .slice(0, 6) // Top 6 recently played games
      .map((item) => item.game);

    return gamesWithPlaytime;
  }, [games, playtimeMap]);

  // Get "Most Played" games - sorted by total playtime
  const mostPlayedGames = React.useMemo(() => {
    if (!playtimeMap.size || !games.length) return [];

    const gamesWithPlaytime = games
      .map((game) => {
        const playtime = playtimeMap.get(game.id);
        return {
          game,
          totalPlaytime: playtime?.totalPlaytime || 0,
        };
      })
      .filter((item) => item.totalPlaytime > 0)
      .sort((a, b) => b.totalPlaytime - a.totalPlaytime)
      .slice(0, 8) // Top 8 most played games
      .map((item) => item.game);

    return gamesWithPlaytime;
  }, [games, playtimeMap]);

  // Get games by launcher sections
  const gamesByLauncher = React.useMemo(() => {
    const launcherGroups: Record<string, typeof games> = {};

    filteredGames.forEach((game) => {
      const launcher = game.launcher || "other";
      if (!launcherGroups[launcher]) {
        launcherGroups[launcher] = [];
      }
      launcherGroups[launcher].push(game);
    });

    return launcherGroups;
  }, [filteredGames]);

  // Check if we should show sections (only when not searching and in grid view)
  const shouldShowSections =
    !searchQuery && filterLauncher === "all" && viewMode === "grid";

  const activeTheme = useThemeStore((s) => s.activeTheme);
  const bgImage = activeTheme?.appearance?.background_image;
  const bgOpacity = activeTheme?.appearance?.background_image_opacity ?? 0.15;

  return (
    <div className="relative flex flex-col gap-4 p-4 h-full w-full pb-8">
      {bgImage && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat pointer-events-none"
          style={{ backgroundImage: `url(${bgImage})`, opacity: bgOpacity }}
          aria-hidden="true"
        />
      )}
      {/* Game Roulette Button */}
      {!isLoading && filteredGames.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleOpenAddCustomApp}
            className="cursor-pointer rounded-full hover:text-[var(--theme-accent)] transition-colors"
            title="Add a custom game to your library"
          >
            <Plus size={14} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleGameRoulette}
            className="cursor-pointer rounded-full hover:text-[var(--theme-accent)] transition-colors"
            title="Pick a random game and launch it"
          >
            <Dices className="h-4 w-4" />
          </Button>
          <Button
            onClick={scanGames}
            disabled={isScanning}
            variant="outline"
            size="icon"
            title="Refresh your game library"
            className="cursor-pointer rounded-full hover:text-[var(--theme-accent)] transition-colors"
          >
            <RefreshCw size={14} className={isScanning ? "animate-spin" : ""} />
          </Button>
        </div>
      )}

      <AddCustomAppDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onSuccess={handleRefreshGames}
      />

      {/* Let's Jump Back In Section */}
      {!isLoading &&
        jumpBackInGames.length > 0 &&
        !searchQuery &&
        filterLauncher === "all" && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <h2
                className="text-xl font-light"
              >
                Let's jump back in
              </h2>
            </div>
            <HorizontalGameRail
              games={jumpBackInGames}
              onCardClick={(gameId) => navigate(`/game/${gameId}`)}
              onRefresh={handleRefreshGames}
            />
          </div>
        )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center w-full h-full p-6">
          <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden mb-4">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: "80%",
                background: "var(--theme-accent)",
                animation: "loading-bar-accent 1.6s infinite linear",
              }}
            ></div>
          </div>
          <style>
            {`
            @keyframes loading-bar-accent {
              0% { width: 0%; }
              60% { width: 85%; }
              100% { width: 100%; }
            }
            `}
          </style>
        </div>
      ) : filteredGames.length === 0 ? (
        <div className="w-full h-full flex flex-col items-center justify-center">
          <p className="text-white/40 text-sm">
            We didn't find any games. Byte will keep you company.
          </p>
          <Button
            variant="default"
            className="mt-4 cursor-pointer"
            onClick={scanGames}
          >
            <RefreshCw size={10} className={isScanning ? "animate-spin" : ""} />
            Scan Games
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        shouldShowSections ? (
          <div className="flex flex-col gap-8 pb-6">
            {/* Most Played Section */}
            {mostPlayedGames.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <h2
                    className="text-lg font-light"
                  >
                    Your most played games
                  </h2>
                </div>
                <HorizontalGameRail
                  games={mostPlayedGames}
                  onRefresh={handleRefreshGames}
                />
              </div>
            )}

            {/* Games by Launcher Sections */}
            {Object.entries(gamesByLauncher).map(
              ([launcher, launcherGames]) => {
                if (launcherGames.length === 0) return null;

                const launcherNames: Record<string, string> = {
                  steam: "Steam",
                  epic: "Epic Games",
                  ea: "EA Games",
                  rockstar: "Rockstar Games",
                  custom: "Games you've added",
                  other: "Other",
                };

                const launcherIcons: Record<string, React.ReactNode> = {
                  steam: <Gamepad2 className="w-5 h-5" />,
                  epic: <Gamepad2 className="w-5 h-5" />,
                  ea: <Gamepad2 className="w-5 h-5" />,
                  rockstar: <Gamepad2 className="w-5 h-5" />,
                  custom: <Gamepad2 className="w-5 h-5" />,
                  other: <Gamepad2 className="w-5 h-5" />,
                };

                return (
                  <div key={launcher}>
                    <div className="flex items-center gap-2 mb-4">
                      {launcherIcons[launcher] || (
                        <Gamepad2 className="w-5 h-5" />
                      )}
                      <h2
                        className="text-lg font-light"
                      >
                        {launcherNames[launcher] ||
                          launcher.charAt(0).toUpperCase() + launcher.slice(1)}
                      </h2>
                      <span
                        className="text-sm text-foreground/60"
                      >
                        ({launcherGames.length})
                      </span>
                    </div>
                    <div className="flex flex-row flex-wrap gap-4">
                      {launcherGames.map((game) => (
                        <GameCard
                          key={game.id}
                          game={game}
                          viewMode="grid"
                          onRefresh={handleRefreshGames}
                        />
                      ))}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        ) : (
          <div className={`flex flex-row flex-wrap gap-4 pb-6`}>
            {filteredGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                viewMode="grid"
                onRefresh={handleRefreshGames}
              />
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-0 w-full">
          {/* List View Header */}
          <div className="grid grid-cols-[60px_2fr_120px_100px_100px_120px] gap-4 px-4 py-3 border-b border-white/10 bg-black/20 sticky top-0 z-10">
            <div className="col-span-1"></div>
            <div className="col-span-1 text-sm font-semibold text-white/70 uppercase tracking-wide">
              Title
            </div>
            <div className="col-span-1 text-sm font-semibold text-white/70 uppercase tracking-wide">
              Launcher
            </div>
            <div className="col-span-1 text-sm font-semibold text-white/70 uppercase tracking-wide">
              Status
            </div>
            <div className="col-span-1 text-sm font-semibold text-white/70 uppercase tracking-wide">
              Playtime
            </div>
            <div className="col-span-1 text-sm font-semibold text-white/70 uppercase tracking-wide">
              Last Played
            </div>
          </div>

          {/* List View Items */}
          <div className="flex flex-col divide-y divide-white/5">
            {filteredGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                viewMode="list"
                onRefresh={handleRefreshGames}
              />
            ))}
          </div>
        </div>
      )}

      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      <MascotOverlay />
    </div>
  );
};

export default Library;
