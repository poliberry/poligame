import React, { useEffect } from "react";
import { useParams } from "react-router-dom";
import { LibrarySidebar } from "./LibrarySidebar";
import { LibraryProvider, useLibraryContext } from "@/contexts/LibraryContext";
import { useGameStore } from "@/stores/gameStore";
import { LauncherType } from "@/types";
import { invoke } from "@tauri-apps/api/core";
import { Game } from "@/types";

interface LibraryLayoutInnerProps {
  children: React.ReactNode;
}

const LibraryLayoutInner: React.FC<LibraryLayoutInnerProps> = ({
  children,
}) => {
  const params = useParams<{ gameId?: string }>();
  const { games, setGames, setLoading } = useGameStore();
  const { searchQuery, setSearchQuery, filterLauncher, setFilterLauncher } =
    useLibraryContext();

  // Get the current game ID from the route
  const selectedGameId = params.gameId;

  const loadGames = async () => {
    setLoading(true);
    try {
      const gameList = await invoke<Game[]>("get_all_games");
      const normalizedGames = gameList.map((game) => ({
        ...game,
        launcher: game.launcher.toLowerCase() as LauncherType,
      }));
      setGames(normalizedGames);
    } catch (error) {
      console.error("Error loading games:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Load games immediately on mount
    loadGames();

    // Set up periodic refresh every 5 minutes (300,000 milliseconds)
    const refreshInterval = setInterval(
      () => {
        loadGames();
      },
      5 * 60 * 1000,
    );

    // Cleanup interval on unmount
    return () => {
      clearInterval(refreshInterval);
    };
  }, []);

  return (
    <div className="flex flex-row h-full w-full">
      {/* Sidebar - always visible on library pages */}
      <div className="p-2 z-[50]">
        <LibrarySidebar
          games={games}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          filterLauncher={filterLauncher}
          onFilterLauncherChange={setFilterLauncher}
          selectedGameId={selectedGameId}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 overflow-y-auto content-view-scrollbar" style={{ scrollBehavior: 'smooth' }}>
        {children}
      </div>
    </div>
  );
};

interface LibraryLayoutProps {
  children: React.ReactNode;
}

export const LibraryLayout: React.FC<LibraryLayoutProps> = ({ children }) => {
  return (
    <LibraryProvider>
      <LibraryLayoutInner>{children}</LibraryLayoutInner>
    </LibraryProvider>
  );
};
