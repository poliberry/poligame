import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Filter, X, Grid, List, RefreshCw, Plus, Search } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useLibraryContext } from "@/contexts/LibraryContext";
import { useGameStore } from "@/stores/gameStore";
import { useLauncherStore } from "@/stores/launcherStore";
import { Game, LauncherType } from "@/types";
import { handleError } from "@/utils/errorHandler";
import { FaSteam } from "react-icons/fa";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { toast } from "sonner";
import { LibrarySidebarGameItem } from "./LibrarySidebarGameItem";
import { AddCustomAppDialog } from "./AddCustomAppDialog";
import { smartSearch } from "@/utils/smartSearch";

interface LibrarySidebarProps {
  games: Game[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterLauncher: LauncherType | "all";
  onFilterLauncherChange: (launcher: LauncherType | "all") => void;
  selectedGameId?: string;
  onGameSelect?: (gameId: string) => void;
}

export const LibrarySidebar: React.FC<LibrarySidebarProps> = ({
  games,
  searchQuery,
  onSearchChange,
  filterLauncher,
  onFilterLauncherChange,
  selectedGameId,
  onGameSelect,
}) => {
  const navigate = useNavigate();
  const { viewMode, setViewMode } = useLibraryContext();
  const { setGames } = useGameStore();
  const { setScanning, isScanning } = useLauncherStore();
  const [showFilters, setShowFilters] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const scanGames = async () => {
    setScanning(true);
    try {
      const scanLoadToast = toast.loading("Scanning games...", {
        description:
          "The more games you have, the longer this may take. Grab a coffee while you wait.",
      });
      setTimeout(() => {
        toast.dismiss(scanLoadToast);
      }, 5000);
      // First detect launchers
      await invoke("scan_all_launchers");
      // Then scan for games and add them to database
      const result = await invoke<string>("scan_all_games");
      console.log("Scan result:", result);
      // Reload games from database
      const gameList = await invoke<Game[]>("get_all_games");
      const normalizedGames = gameList.map((game) => ({
        ...game,
        launcher: game.launcher.toLowerCase() as LauncherType,
      }));
      setGames(normalizedGames);
      toast.success("Games scanned successfully!", {
        description: "Your games have been scanned and are ready to use.",
      });
    } catch (error) {
      toast.error("Failed to scan games!", {
        description: "Please try again.",
      });
      handleError(error, "scanGames");
    } finally {
      setScanning(false);
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

  const handleGameClick = (gameId: string) => {
    if (onGameSelect) {
      onGameSelect(gameId);
    } else {
      navigate(`/game/${gameId}`);
    }
  };

  const handleRefreshGames = async () => {
    try {
      const gameList = await invoke<Game[]>("get_all_games");
      const normalizedGames = gameList.map((game) => ({
        ...game,
        launcher: game.launcher.toLowerCase() as LauncherType,
      }));
      setGames(normalizedGames);
    } catch (error) {
      console.error("Error refreshing games:", error);
      handleError(error, "handleRefreshGames");
    }
  };

  return (
    <Card
      className="flex flex-col gap-1 bg-transparent backdrop-blur-xl h-full border-2 rounded-3xl"
      style={{
        width: "320px",
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=Livvic:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,900&family=Unbounded:wght@200..900&display=swap"
        rel="stylesheet"
      />
      {/* Search Bar */}
      <div className="-mt-4 border-b-2">
        <Search
          className="absolute ml-3 mt-2.75 text-foreground/60"
          size={16}
        />
        <Input
          type="text"
          placeholder="Search games..."
          value={searchQuery}
          style={{ fontFamily: "Google Sans Flex, sans-serif" }}
          onChange={(e) => onSearchChange(e.target.value)}
          className="flex-1 pl-8 text-sm font-light rounded-t-2xl h-10 border-none"
        />
      </div>

      {/* Filters Section */}
      <div className="flex flex-col items-center justify-between p-2">
        <div className="flex flex-row items-center justify-between w-full gap-2">
          <div className="flex flex-row items-center gap-2">
            <Badge
              variant="ghost"
              className="text-foreground/60 uppercase p-0"
              style={{
                fontFamily: "Livvic, sans-serif",
                fontWeight: 600,
                paddingTop: "8px",
                paddingBottom: "8px",
                paddingRight: "8px",
                textAlign: "right",
                fontSize: "12px",
              }}
            >
              {filteredGames.length} games
            </Badge>
          </div>
          <div className="flex flex-row items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              onClick={() => setViewMode("grid")}
              className="py-0.5 px-2 h-fit cursor-pointer"
              title="Grid View"
            >
              <Grid size={14} />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              onClick={() => setViewMode("list")}
              className="py-0.5 px-2 h-fit cursor-pointer"
              title="List View"
            >
              <List size={14} />
            </Button>
            <Button
              variant="default"
              onClick={() => setShowFilters(!showFilters)}
              className="py-0.5 px-2 h-fit cursor-pointer"
            >
              {showFilters ? <X size={14} /> : <Filter size={14} />}
            </Button>
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex flex-row flex-wrap gap-2">
              <Button
                variant={filterLauncher === "all" ? "default" : "outline"}
                onClick={() => onFilterLauncherChange("all")}
                className="text-xs px-2 py-1"
              >
                All
              </Button>
              {Object.values(LauncherType).map((launcher) => (
                <Button
                  key={launcher}
                  variant={filterLauncher === launcher ? "default" : "outline"}
                  onClick={() => onFilterLauncherChange(launcher)}
                  className="text-xs px-2 py-1"
                >
                  {launcher === "steam" && (
                    <FaSteam size={10} className="mr-1" />
                  )}
                  {launcher.charAt(0).toUpperCase() + launcher.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Game List */}
      <div className="flex-1 overflow-y-auto content-view-scrollbar">
        <div>
          <div className="flex flex-col gap-1">
            {filteredGames.map((game) => (
              <LibrarySidebarGameItem
                key={game.id}
                game={game}
                isSelected={selectedGameId === game.id}
                onClick={() => handleGameClick(game.id)}
              />
            ))}
          </div>
          {filteredGames.length === 0 && (
            <div className="text-center text-white/40 text-sm py-8 px-12">
              No games here! Click the "Scan Games" button to find your games.
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
