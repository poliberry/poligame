import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "convex/react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuthStore } from "@/stores/authStore";
import { useGameStore } from "@/stores/gameStore";
import { Game } from "@/types";
import { FaSteam } from "react-icons/fa";
import { SiEpicgames } from "react-icons/si";
import { TbBrandElectronicArts } from "react-icons/tb";
import { Play, Settings, Trash2, Edit, Palette } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { EditCustomAppNameDialog } from "./EditCustomAppNameDialog";
import { DeleteCustomAppDialog } from "./DeleteCustomAppDialog";
import { toast } from "sonner";
import { getImageUrl } from "@/utils/imageUtils";
import { Button } from "./ui/button";

interface GameCardProps {
  game: Game;
  viewMode?: "grid" | "list";
  onRefresh?: () => void;
}

export const GameCard: React.FC<GameCardProps> = ({
  game,
  viewMode = "grid",
  onRefresh,
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { setGames, setActiveHoverGame } = useGameStore();
  const [showEditNameDialog, setShowEditNameDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Always get customizations from Convex (for both custom and non-custom games)
  const customization = useQuery(
    api.gameCustomizations.getGameCustomization,
    user?.userId
      ? { userId: user.userId as unknown as Id<"users">, gameId: game.id }
      : "skip",
  );

  // Merge game with customizations based on game type
  const displayGame: Game = (() => {
    // For custom games: Always pull artwork from Convex if available
    if (game.launcher === "custom") {
      if (customization) {
        return {
          ...game,
          icon: customization.customLogo || game.icon,
          coverArt: customization.customCoverArt || game.coverArt,
          gridCoverArt: customization.customGridCoverArt || game.gridCoverArt,
          logo: customization.customLogo || game.logo,
          headerArt: customization.customHeroArt || game.headerArt,
        };
      }
      // Fallback to DB if no Convex customization
      return game;
    }

    // For non-custom games: Use Convex if customized, otherwise use DB
    if (customization && customization.customized) {
      return {
        ...game,
        coverArt: customization.customCoverArt || game.coverArt,
        gridCoverArt: customization.customGridCoverArt || game.gridCoverArt,
        logo: customization.customLogo || game.logo,
        headerArt: customization.customHeroArt || game.headerArt,
        icon: customization.customLogo || game.icon,
      };
    }

    // Non-custom games without customizations: Use DB artwork
    return game;
  })();

  const hasCustomizations =
    customization && (customization.customized || game.launcher === "custom");

  const handleQuickLaunch = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("launch_game", { gameId: game.id });
      toast.success(`Launching ${game.title}...`);
    } catch (error: any) {
      console.error("Error launching game:", error);
      toast.error(error.message || "Failed to launch game");
    }
  };

  const handleCustomize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("create_game_customization_window", { gameId: game.id });
    } catch (error: any) {
      console.error("Error opening customization window:", error);
      toast.error("Failed to open customization window");
    }
  };

  const handleEditName = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEditNameDialog(true);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const handleRefresh = async () => {
    try {
      const allGames = await invoke<any[]>("get_all_games");
      setGames(allGames);
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error("Error refreshing games:", error);
    }
  };

  const cardContent =
    viewMode === "grid" ? (
      <div
        onContextMenu={(e) => e.stopPropagation()}
        onClick={() => navigate(`/game/${game.id}`)}
        onMouseEnter={() => setActiveHoverGame(game)}
        onMouseLeave={() => setActiveHoverGame(null)}
        className="game-card relative flex flex-row gap-2 cursor-pointer justify-end items-end overflow-hidden rounded-lg"
        style={{
          background: !displayGame.gridCoverArt
            ? "var(--background)"
            : `url(${getImageUrl(displayGame.gridCoverArt) || ""})`,
          backgroundSize: displayGame.gridCoverArt ? "contain" : "100% 100%",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          width: "200px",
          height: "300px",
        }}
      >
        {/* Shimmer overlay - now uses CSS class */}
        <div className="game-card-shimmer" />

        {/* Card content */}
        <div className="relative flex flex-col gap-2 text-white h-full flex flex-col rounded-lg justify-between w-full z-10">
          <div
            style={{
              background:
                displayGame.launcher === "steam"
                  ? "linear-gradient(to bottom , rgb(44, 87, 112), transparent)"
                  : displayGame.launcher === "epic"
                    ? "linear-gradient(to bottom, rgb(0, 0, 0), transparent)"
                    : displayGame.launcher === "ea"
                      ? "linear-gradient(to bottom, rgb(110, 52, 235), transparent)"
                      : displayGame.launcher === "custom"
                        ? "transparent"
                        : "transparent",
              color:
                displayGame.launcher === "steam"
                  ? "white"
                  : displayGame.launcher === "ea"
                    ? "white"
                    : "white",
              fontSize: "0.85rem",
              fontFamily: "Google Sans Flex, sans-serif",
            }}
            className={`text-sm font-light flex flex-row gap-1 items-center p-2 max-w-md`}
          >
            {displayGame.launcher === "steam" && <FaSteam size={18} />}{" "}
            {displayGame.launcher === "epic" && <SiEpicgames size={18} />}{" "}
            {displayGame.launcher === "ea" && (
              <TbBrandElectronicArts size={18} />
            )}{" "}
            {displayGame.launcher === "custom"
              ? ""
              : displayGame.launcher.charAt(0).toUpperCase() +
                displayGame.launcher.slice(1)}
          </div>
        </div>
      </div>
    ) : (
      <div
        onContextMenu={(e) => e.stopPropagation()}
        onClick={() => navigate(`/game/${game.id}`)}
        className="grid grid-cols-[60px_2fr_120px_100px_100px_120px] gap-4 px-4 py-3 cursor-pointer transition-colors hover:bg-white/5 items-center group"
      >
        {/* Icon */}
        <div className="col-span-1 flex items-center justify-center">
          {displayGame.launcher === "custom" ? (
            <div className="w-12 h-12 bg-white/10 rounded flex items-center justify-center">
              <span className="text-xs text-white/40">Custom</span>
            </div>
          ) : displayGame.icon ? (
            <img
              src={getImageUrl(displayGame.icon) || ""}
              alt={displayGame.title}
              width={48}
              height={48}
              className="rounded"
              style={{
                aspectRatio: "1/1",
                objectFit: "contain",
              }}
            />
          ) : (
            <div className="w-12 h-12 bg-white/10 rounded flex items-center justify-center">
              <span className="text-xs text-white/40">No Icon</span>
            </div>
          )}
        </div>

        {/* Title */}
        <div className="col-span-1 min-w-0">
          <div
            className="text-base font-semibold text-white truncate group-hover:text-white/90 flex items-center gap-2"
            style={{ fontFamily: "Unbounded, sans-serif" }}
          >
            {displayGame.title}
            {hasCustomizations && <Palette className="h-3 w-3 text-white/60" />}
          </div>
        </div>

        {/* Launcher */}
        <div className="col-span-1 flex items-center gap-2">
          {displayGame.launcher === "steam" && (
            <FaSteam size={16} className="text-white/80" />
          )}
          {displayGame.launcher === "epic" && (
            <SiEpicgames size={16} className="text-white/80" />
          )}
          {displayGame.launcher === "ea" && (
            <TbBrandElectronicArts size={16} className="text-white/80" />
          )}
          <span className="text-sm text-white/70">
            {displayGame.launcher === "custom"
              ? "Custom"
              : displayGame.launcher.charAt(0).toUpperCase() +
                displayGame.launcher.slice(1)}
          </span>
        </div>

        {/* Status */}
        <div className="col-span-1">
          <span
            className={`inline-block text-xs px-2 py-1 rounded font-medium ${
              displayGame.installed
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-gray-500/20 text-gray-400 border border-gray-500/30"
            }`}
          >
            {displayGame.installed ? "Installed" : "Not Installed"}
          </span>
        </div>

        {/* Playtime */}
        <div className="col-span-1 text-sm text-white/60">
          {displayGame.playtime ? (
            <span>
              {Math.floor(displayGame.playtime / 60)}h{" "}
              {displayGame.playtime % 60}m
            </span>
          ) : (
            <span className="text-white/30">—</span>
          )}
        </div>

        {/* Last Played */}
        <div className="col-span-1 text-xs text-white/60">
          {displayGame.lastPlayed ? (
            <span>{new Date(displayGame.lastPlayed).toLocaleDateString()}</span>
          ) : (
            <span className="text-white/30">—</span>
          )}
        </div>
      </div>
    );

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{cardContent}</ContextMenuTrigger>
        <ContextMenuContent className="w-56 rounded-none">
          <ContextMenuItem
            className="rounded-none p-2 bg-[var(--theme-accent)] text-white uppercase italic font-bold hover:bg-[var(--theme-accent)]/80 cursor-pointer"
            style={{ fontFamily: "Unbounded, sans-serif" }}
            onClick={handleQuickLaunch}
          >
            <Play className="mr-2 h-4 w-4" />
            Launch
          </ContextMenuItem>
          {game.launcher === "custom" && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="rounded-none"
                onClick={handleEditName}
              >
                <Edit className="mr-2 h-4 w-4" />
                Change Name
              </ContextMenuItem>
              <ContextMenuItem
                className="rounded-none"
                onClick={handleCustomize}
              >
                <Settings className="mr-2 h-4 w-4" />
                Customize Properties
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onClick={handleDelete}
                className="text-red-400 focus:text-red-400 rounded-none"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove App
              </ContextMenuItem>
            </>
          )}
          {game.launcher !== "custom" && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="rounded-none"
                onClick={handleCustomize}
              >
                <Palette className="mr-2 h-4 w-4" />
                {hasCustomizations
                  ? "Edit Customizations"
                  : "Customize Artwork"}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {game.launcher === "custom" && (
        <>
          <EditCustomAppNameDialog
            isOpen={showEditNameDialog}
            onClose={() => setShowEditNameDialog(false)}
            gameId={game.id}
            currentName={game.title}
            onSuccess={handleRefresh}
          />
          <DeleteCustomAppDialog
            isOpen={showDeleteDialog}
            onClose={() => setShowDeleteDialog(false)}
            gameId={game.id}
            appName={game.title}
            onSuccess={handleRefresh}
          />
        </>
      )}
    </>
  );
};
