import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuthStore } from "@/stores/authStore";
import { useGameStore } from "@/stores/gameStore";
import { Game } from "@/types";
import { Gamepad2, Palette, Play, Settings, Trash2 } from "lucide-react";
import { FaSteam } from "react-icons/fa";
import { SiEpicgames } from "react-icons/si";
import { TbBrandElectronicArts } from "react-icons/tb";
import { getImageUrl } from "@/utils/imageUtils";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { DeleteCustomAppDialog } from "./DeleteCustomAppDialog";

interface LibrarySidebarGameItemProps {
  game: Game;
  isSelected: boolean;
  onClick: () => void;
}

export const LibrarySidebarGameItem: React.FC<LibrarySidebarGameItemProps> = ({
  game,
  isSelected,
  onClick,
}) => {
  const TITLE_MAX_WIDTH = 220;
  const { user } = useAuthStore();
  const { setGames } = useGameStore();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [marqueeDistance, setMarqueeDistance] = useState(0);
  const titleContainerRef = useRef<HTMLDivElement>(null);
  const titleTextRef = useRef<HTMLSpanElement>(null);
  
  // Always get customizations from Convex (for both custom and non-custom games)
  const customization = useQuery(
    api.gameCustomizations.getGameCustomization,
    user?.userId
      ? { userId: user.userId as unknown as Id<"users">, gameId: game.id }
      : "skip"
  );

  // Merge game with customizations based on game type
  const displayGame = (() => {
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
        icon: customization.customLogo || game.icon,
        coverArt: customization.customCoverArt || game.coverArt,
        gridCoverArt: customization.customGridCoverArt || game.gridCoverArt,
        logo: customization.customLogo || game.logo,
        headerArt: customization.customHeroArt || game.headerArt,
      };
    }

    // Non-custom games without customizations: Use DB artwork
    return game;
  })();

  const hasCustomizations = customization && (customization.customized || game.launcher === "custom");

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

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("create_custom_app_dialog_window", {
        action: "delete",
        gameId: game.id,
        name: game.title,
      });
    } catch (error) {
      console.debug("Custom dialog window unavailable, falling back inline", error);
      setShowDeleteDialog(true);
    }
  };

  const handleRefresh = async () => {
    try {
      const allGames = await invoke<any[]>("get_all_games");
      setGames(allGames);
    } catch (error) {
      console.error("Error refreshing games:", error);
    }
  };

  const updateMarqueeDistance = () => {
    if (!titleContainerRef.current || !titleTextRef.current) {
      setMarqueeDistance(0);
      return;
    }

    const overflowDistance =
      titleTextRef.current.scrollWidth - titleContainerRef.current.clientWidth;
    setMarqueeDistance(Math.max(0, overflowDistance));
  };

  useEffect(() => {
    updateMarqueeDistance();
    window.addEventListener("resize", updateMarqueeDistance);

    return () => {
      window.removeEventListener("resize", updateMarqueeDistance);
    };
  }, [displayGame.title]);

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={onClick}
            onMouseEnter={updateMarqueeDistance}
            onContextMenu={(e) => e.stopPropagation()}
            className={`library-sidebar-item flex flex-row items-start gap-2 p-2 w-full cursor-pointer transition-colors ${
              isSelected
                ? "bg-foreground/10"
                : "bg-foreground/5 hover:bg-foreground/10"
            }`}
          >
      {displayGame.icon ? (
        <img
          src={getImageUrl(displayGame.icon) || ''}
          alt={displayGame.title}
          width={20}
          height={20}
          style={{
            aspectRatio: '1/1',
            objectFit: 'contain',
          }}
        />
      ) : (
        <div className="flex items-center justify-center">
          <Gamepad2 size={20} />
        </div>
      )}
      <div className="flex flex-row gap-1 flex-1 min-w-0">
        <div
          ref={titleContainerRef}
          className="library-sidebar-game-title text-sm font-semibold flex items-center gap-1"
          style={{ maxWidth: `${TITLE_MAX_WIDTH}px` }}
        >
          <span
            ref={titleTextRef}
            className={`library-sidebar-game-title-text ${marqueeDistance > 0 ? "library-sidebar-game-title-text--marquee" : ""}`}
            style={{
              ["--marquee-distance" as string]: `${marqueeDistance}px`,
              animationDuration: `${Math.max(4, marqueeDistance / 25)}s`,
            }}
          >
            {displayGame.title}
          </span>
        </div>
        <div className="flex flex-row items-center gap-1 text-xs text-foreground/60" style={{
          flexShrink: 0,
          flexGrow: 1,
          justifyContent: 'flex-end',
        }}>
          {displayGame.launcher === "steam" && <FaSteam size={15} />}
          {displayGame.launcher === "epic" && <SiEpicgames size={15} />}
          {displayGame.launcher === "ea" && <TbBrandElectronicArts size={15} />}
        </div>
      </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-64 rounded-2xl space-y-2 p-2">
          <ContextMenuItem className="rounded-full p-2 bg-[var(--theme-accent)] text-white font-light hover:bg-[var(--theme-accent)]/80 cursor-pointer" onClick={handleQuickLaunch}>
            <Play className="mr-2 h-4 w-4" />
            Launch
          </ContextMenuItem>
          {game.launcher === "custom" && (
            <>
              <ContextMenuItem className="rounded-none" onClick={handleCustomize}>
                <Settings className="mr-2 h-4 w-4" />
                Customize {game?.title}
              </ContextMenuItem>
              <ContextMenuItem onClick={handleDelete} className="text-red-400 focus:text-red-400 rounded-none">
                <Trash2 className="mr-2 h-4 w-4" />
                Remove App
              </ContextMenuItem>
            </>
          )}
          {game.launcher !== "custom" && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem className="rounded-none" onClick={handleCustomize}>
                <Palette className="mr-2 h-4 w-4" />
                {hasCustomizations ? "Edit Customizations" : "Customize Artwork"}
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {game.launcher === "custom" && (
        <>
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

