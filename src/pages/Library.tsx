import React, { useEffect, useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useLibraryContext } from "@/contexts/LibraryContext";
import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import { RefreshCw, Plus, Shuffle, Clock, TrendingUp, Star, Calendar, Gamepad2 } from "lucide-react";
import { useLauncherStore } from "@/stores/launcherStore";
import { AddCustomAppDialog } from "@/components/AddCustomAppDialog";
import { GameCard } from "@/components/GameCard";
import { smartSearch } from "@/utils/smartSearch";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthStore } from "@/stores/authStore";
import { Id } from "../../convex/_generated/dataModel";
import { useNavigate } from "react-router-dom";

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
    user?.userId ? { userId: user.userId as Id<"users"> } : "skip"
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
    const matchesLauncher = filterLauncher === "all" || game.launcher === filterLauncher;
    return matchesLauncher;
  });

  // Create playtime map for quick lookups
  const playtimeMap = React.useMemo(() => {
    if (!allPlaytimeData) return new Map();
    return new Map(allPlaytimeData.map((pt: { gameId: string; totalPlaytime: number; lastPlayed: number }) => [pt.gameId, pt]));
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
  const shouldShowSections = !searchQuery && filterLauncher === "all" && viewMode === "grid";

  return (
    <div className="flex flex-col gap-4 p-4 h-full w-full pb-8">
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
      <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@200..900&display=swap" rel="stylesheet"></link>

      {/* Let's Jump Back In Section */}
      {!isLoading && jumpBackInGames.length > 0 && !searchQuery && filterLauncher === "all" && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-[var(--theme-accent)]" />
            <h2 className="text-xl font-bold uppercase italic" style={{ fontFamily: 'Unbounded, sans-serif' }}>
              Let's jump back in
            </h2>
          </div>
          <div className="flex flex-row gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {jumpBackInGames.map((game) => (
              <div
                key={game.id}
                onClick={() => navigate(`/game/${game.id}`)}
                className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <GameCard game={game} viewMode="grid" onRefresh={handleRefreshGames} />
              </div>
            ))}
          </div>
          <style>{`
            .scrollbar-hide {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
          `}</style>
        </div>
      )}

      {/* Game Roulette Button */}
      {!isLoading && filteredGames.length > 0 && (
        <div className="flex justify-end">
          <Button
            variant="default"
            onClick={handleGameRoulette}
            className="cursor-pointer"
            title="Pick a random game and launch it"
          >
            <Shuffle className="mr-2 h-4 w-4" />
            Game Roulette
          </Button>
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
                animation: "loading-bar-accent 1.6s infinite linear"
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
            <p className="text-white/40 text-sm">We didn't find any games. Byte will keep you company.</p>
            <Button variant="default" className="mt-4 cursor-pointer" onClick={scanGames}>
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
                    <TrendingUp className="w-5 h-5 text-[var(--theme-accent)]" />
                    <h2 className="text-lg font-bold uppercase italic" style={{ fontFamily: 'Unbounded, sans-serif' }}>
                      Most Played
                    </h2>
                  </div>
                  <div className="flex flex-row flex-wrap gap-4">
                    {mostPlayedGames.map((game) => (
                      <GameCard key={game.id} game={game} viewMode="grid" onRefresh={handleRefreshGames} />
                    ))}
                  </div>
                </div>
              )}

              {/* Games by Launcher Sections */}
              {Object.entries(gamesByLauncher).map(([launcher, launcherGames]) => {
                if (launcherGames.length === 0) return null;
                
                const launcherNames: Record<string, string> = {
                  steam: "Steam",
                  epic: "Epic Games",
                  ea: "EA Games",
                  rockstar: "Rockstar Games",
                  custom: "Custom Games",
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
                      {launcherIcons[launcher] || <Gamepad2 className="w-5 h-5" />}
                      <h2 className="text-lg font-bold uppercase italic" style={{ fontFamily: 'Unbounded, sans-serif' }}>
                        {launcherNames[launcher] || launcher.charAt(0).toUpperCase() + launcher.slice(1)}
                      </h2>
                      <span className="text-sm text-foreground/60" style={{ fontFamily: 'Livvic, sans-serif' }}>
                        ({launcherGames.length})
                      </span>
                    </div>
                    <div className="flex flex-row flex-wrap gap-4">
                      {launcherGames.map((game) => (
                        <GameCard key={game.id} game={game} viewMode="grid" onRefresh={handleRefreshGames} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`flex flex-row flex-wrap gap-4 pb-6`}>
              {filteredGames.map((game) => (
                <GameCard key={game.id} game={game} viewMode="grid" onRefresh={handleRefreshGames} />
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-0 w-full">
            {/* List View Header */}
            <div className="grid grid-cols-[60px_2fr_120px_100px_100px_120px] gap-4 px-4 py-3 border-b border-white/10 bg-black/20 sticky top-0 z-10">
              <div className="col-span-1"></div>
              <div className="col-span-1 text-sm font-semibold text-white/70 uppercase tracking-wide">Title</div>
              <div className="col-span-1 text-sm font-semibold text-white/70 uppercase tracking-wide">Launcher</div>
              <div className="col-span-1 text-sm font-semibold text-white/70 uppercase tracking-wide">Status</div>
              <div className="col-span-1 text-sm font-semibold text-white/70 uppercase tracking-wide">Playtime</div>
              <div className="col-span-1 text-sm font-semibold text-white/70 uppercase tracking-wide">Last Played</div>
            </div>
            
            {/* List View Items */}
            <div className="flex flex-col divide-y divide-white/5">
              {filteredGames.map((game) => (
                <GameCard key={game.id} game={game} viewMode="list" onRefresh={handleRefreshGames} />
              ))}
            </div>
          </div>
        )}
    </div>
  );
};

export default Library;
