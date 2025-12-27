import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Game } from "@/types";
import { useAuthStore } from "@/stores/authStore";

/**
 * Hook to get a game with its customizations applied
 * For custom apps: artwork comes from Convex
 * For launcher games: checks Convex customizations if customized, otherwise uses DB
 */
export const useGameWithCustomizations = (game: Game | null) => {
  const { user } = useAuthStore();
  
  const customization = useQuery(
    api.gameCustomizations.getGameCustomization,
    user?.userId && game
      ? { userId: user.userId as unknown as Id<"users">, gameId: game.id }
      : "skip"
  );

  if (!game) return null;

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
};

/**
 * Utility function to merge game with customization data
 * This can be used outside of React components
 */
export const mergeGameWithCustomization = (game: Game, customization: any): Game => {
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
};

