import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-shell";
import {
  Trophy,
  Settings,
  MessageSquare,
  CheckCircle2,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { MicaCard } from "@/components/MicaCard";
import { MicaButton } from "@/components/MicaButton";
import { useAuthStore } from "@/stores/authStore";
import { useRunningGameStore } from "@/stores/runningGameStore";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Game } from "@/types";
import { GameForum } from "@/components/GameForum";
import { CompatibilityChecker } from "@/components/CompatibilityChecker";
import { PrivacyNoticeDialog } from "@/components/PrivacyNoticeDialog";
import { MediaGallery } from "@/components/MediaGallery";
import { IoPlay } from "react-icons/io5";
import { X, Clock, Users, Tag, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getImageUrl } from "@/utils/imageUtils";

const GameDetails: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const {
    runningGameId,
    killGame,
    startPolling,
  } = useRunningGameStore();
  // Note: gameActivity will be available after Convex regenerates types
  const updateGameActivity = useMutation(
    (api as any).gameActivity?.updateGameActivity,
  );
  const [game, setGame] = useState<Game | null>(null);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [news, setNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "achievements" | "forum" | "compatibility" | "gallery"
  >("overview");
  const [showPrivacyDialog, setShowPrivacyDialog] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [heroHeight, setHeroHeight] = useState(0); // Default to h-64 (256px)
  const [fetchingMetadata, setFetchingMetadata] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  // Track which gameId the achievements and news belong to
  const achievementsGameIdRef = useRef<string | null>(null);
  const newsGameIdRef = useRef<string | null>(null);
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get customizations if user is logged in
  const customizations = useQuery(
    api.gameCustomizations.getGameCustomization,
    user?.userId && gameId
      ? { userId: user.userId as unknown as Id<"users">, gameId }
      : "skip",
  );

  // Get user's playtime for this game
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playtimeApi = api as any;
  const userPlaytime = useQuery(
    playtimeApi.playtime?.getGamePlaytime,
    user?.userId && gameId
      ? { userId: user.userId as Id<"users">, gameId }
      : "skip",
  );

  // Get friends' playtime for this game
  const friendsPlaytime = useQuery(
    playtimeApi.playtime?.getFriendsGamePlaytime,
    user?.userId && gameId
      ? { userId: user.userId as Id<"users">, gameId }
      : "skip",
  );

  // Helper to check if achievements belong to current game
  const achievementsBelongToCurrentGame =
    achievementsGameIdRef.current === gameId;

  const unlockedCount = achievementsBelongToCurrentGame
    ? achievements.filter((a) => a.unlocked).length
    : 0;
  const totalCount = achievementsBelongToCurrentGame ? achievements.length : 0;

  // Load game details when gameId changes
  useEffect(() => {
    if (!gameId) {
      setGame(null);
      setAchievements([]);
      achievementsGameIdRef.current = null;
      setLoading(false);
      setLoadingAchievements(false);
      // Clear any pending fetch timeout
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
      return;
    }

    // Clear achievements and news immediately when game changes
    console.log("🔄 Loading game:", gameId);
    achievementsGameIdRef.current = null;
    newsGameIdRef.current = null;
    setAchievements([]);
    setNews([]);
    setLoading(true);
    setLoadingAchievements(true);
    setLoadingNews(true);

    loadGameDetails();

    // Cleanup on unmount or game change
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
      if (newsTimeoutRef.current) {
        clearTimeout(newsTimeoutRef.current);
        newsTimeoutRef.current = null;
      }
    };
  }, [gameId]);

  // Fetch achievements from Steam API only (not from database)
  useEffect(() => {
    if (!gameId || !game) {
      return;
    }

    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    const currentGameId = gameId;
    const currentGame = game;

    // Clear achievements and wait 10 seconds before fetching for new game
    console.log("🔄 Clearing achievements for new game:", currentGameId);
    achievementsGameIdRef.current = null;
    setAchievements([]);
    setLoadingAchievements(true);

    // Wait 10 seconds, then fetch achievements
    fetchTimeoutRef.current = setTimeout(async () => {
      // Verify we're still on the same game
      if (currentGameId !== gameId) {
        console.log(
          "🚫 Skipping achievement fetch - game changed during wait",
          {
            waitedFor: currentGameId,
            currentGameId: gameId,
          },
        );
        return;
      }

      // Only fetch for Steam games with API access
      if (
        currentGame.launcher !== "steam" ||
        !user?.steamUserId ||
        !currentGame.metadata?.appId
      ) {
        console.log(
          "ℹ️ Skipping achievement fetch - not a Steam game or missing credentials",
          {
            launcher: currentGame.launcher,
            hasSteamUserId: !!user?.steamUserId,
            hasAppId: !!currentGame.metadata?.appId,
          },
        );
        if (currentGameId === gameId) {
          achievementsGameIdRef.current = currentGameId;
          setAchievements([]);
          setLoadingAchievements(false);
        }
        return;
      }

      const steamAppId = currentGame.metadata.appId;
      console.log(
        "🔍 Fetching Steam achievements from API for gameId:",
        currentGameId,
        "appId:",
        steamAppId,
      );

      try {
        // Fetch from Steam API only (no database)
        const achievementsData = await invoke<any[]>(
          "fetch_steam_achievements_no_db",
          {
            gameId: currentGameId,
            steamUserId: user.steamUserId,
            steamAppId,
          },
        );

        // Verify we're still on the same game before setting
        if (currentGameId !== gameId) {
          console.log(
            "🚫 Skipping achievement set - game changed during fetch",
            {
              fetchedFor: currentGameId,
              currentGameId: gameId,
            },
          );
          return;
        }

        console.log(
          "✅ Setting achievements from Steam API for gameId:",
          currentGameId,
          "count:",
          achievementsData.length,
        );
        achievementsGameIdRef.current = currentGameId;
        setAchievements(achievementsData);
        setLoadingAchievements(false);
      } catch (error: any) {
        const errorStr = String(error);

        // Verify we're still on the same game
        if (currentGameId !== gameId) {
          console.log(
            "🚫 Skipping error handling - game changed during fetch",
            {
              fetchedFor: currentGameId,
              currentGameId: gameId,
            },
          );
          return;
        }

        // If "no stats" error, game has no achievements
        if (
          errorStr.includes("no stats") ||
          errorStr.includes("Requested app has no stats")
        ) {
          console.log("ℹ️ Game has no achievements:", currentGameId);
          achievementsGameIdRef.current = currentGameId;
          setAchievements([]);
          setLoadingAchievements(false);
        } else {
          console.error("❌ Failed to fetch Steam achievements:", error);
          // Show privacy dialog for errors (likely privacy-related)
          setShowPrivacyDialog(true);
          achievementsGameIdRef.current = currentGameId;
          setAchievements([]);
          setLoadingAchievements(false);
        }
      }
    }, 10000); // Wait 10 seconds

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = null;
      }
    };
  }, [
    gameId,
    game?.id,
    game?.launcher,
    game?.metadata?.appId,
    user?.steamUserId,
  ]);

  // Fetch news from Steam API only (not from database)
  useEffect(() => {
    if (!gameId || !game) {
      return;
    }

    // Clear any existing timeout
    if (newsTimeoutRef.current) {
      clearTimeout(newsTimeoutRef.current);
      newsTimeoutRef.current = null;
    }

    const currentGameId = gameId;
    const currentGame = game;

    // Clear news and wait 10 seconds before fetching for new game
    console.log("🔄 Clearing news for new game:", currentGameId);
    newsGameIdRef.current = null;
    setNews([]);
    setLoadingNews(true);

    // Wait 10 seconds, then fetch news
    newsTimeoutRef.current = setTimeout(async () => {
      // Verify we're still on the same game
      if (currentGameId !== gameId) {
        console.log("🚫 Skipping news fetch - game changed during wait", {
          waitedFor: currentGameId,
          currentGameId: gameId,
        });
        return;
      }

      // Only fetch for Steam games with appId
      if (currentGame.launcher !== "steam" || !currentGame.metadata?.appId) {
        console.log(
          "ℹ️ Skipping news fetch - not a Steam game or missing appId",
          {
            launcher: currentGame.launcher,
            hasAppId: !!currentGame.metadata?.appId,
          },
        );
        if (currentGameId === gameId) {
          newsGameIdRef.current = currentGameId;
          setNews([]);
          setLoadingNews(false);
        }
        return;
      }

      const steamAppId = currentGame.metadata.appId;
      console.log(
        "🔍 Fetching Steam news from API for gameId:",
        currentGameId,
        "appId:",
        steamAppId,
      );

      try {
        // Fetch from Steam API only (no database)
        const newsData = await invoke<any[]>("fetch_steam_news", {
          appId: steamAppId,
        });

        // Verify we're still on the same game before setting
        if (currentGameId !== gameId) {
          console.log("🚫 Skipping news set - game changed during fetch", {
            fetchedFor: currentGameId,
            currentGameId: gameId,
          });
          return;
        }

        console.log(
          "✅ Setting news from Steam API for gameId:",
          currentGameId,
          "count:",
          newsData.length,
        );
        newsGameIdRef.current = currentGameId;
        console.log("🔍 News data:", newsData);
        setNews(newsData);
        setLoadingNews(false);
      } catch (error: any) {
        // Verify we're still on the same game
        if (currentGameId !== gameId) {
          console.log(
            "🚫 Skipping error handling - game changed during fetch",
            {
              fetchedFor: currentGameId,
              currentGameId: gameId,
            },
          );
          return;
        }

        console.error("❌ Failed to fetch Steam news:", error);
        newsGameIdRef.current = currentGameId;
        setNews([]);
        setLoadingNews(false);
      }
    }, 10000); // Wait 10 seconds

    // Cleanup timeout on unmount or when dependencies change
    return () => {
      if (newsTimeoutRef.current) {
        clearTimeout(newsTimeoutRef.current);
        newsTimeoutRef.current = null;
      }
    };
  }, [gameId, game?.id, game?.launcher, game?.metadata?.appId]);

  const loadGameDetails = async () => {
    if (!gameId) return;

    try {
      const gameData = await invoke<Game>("get_game_details", { gameId });
      if (gameData.id === gameId) {
        // Only set if still on same game
        setGame(gameData);
        setActiveTab(gameData.launcher === "steam" ? "overview" : "forum");
      }
    } catch (error) {
      console.error("Failed to load game details:", error);
    } finally {
      if (gameId) {
        setLoading(false);
      }
    }
  };

  const handleFetchSteamAchievements = async () => {
    if (!gameId || !game?.metadata?.appId || !user?.steamUserId) {
      alert(
        "Steam User ID not set in your account details, or game doesn't have a Steam App ID",
      );
      return;
    }

    const steamAppId = game.metadata.appId;
    console.log("🔍 Manually fetching Steam achievements:", {
      gameId,
      steamAppId,
      gameTitle: game.title,
    });

    try {
      setLoadingAchievements(true);
      // Fetch from Steam API only (no database save)
      const achievementsData = await invoke<any[]>(
        "fetch_steam_achievements_no_db",
        {
          gameId,
          steamUserId: user.steamUserId,
          steamAppId,
        },
      );

      // Only set if still on same game
      if (
        gameId === achievementsGameIdRef.current ||
        !achievementsGameIdRef.current
      ) {
        console.log(
          "✅ Manually fetched achievements for gameId:",
          gameId,
          "count:",
          achievementsData.length,
        );
        achievementsGameIdRef.current = gameId;
        setAchievements(achievementsData);
        setLoadingAchievements(false);
        alert("Achievements fetched successfully!");
      }
    } catch (error: any) {
      console.error("Failed to manually fetch Steam achievements:", error);
      const errorString = error.toString() || error.message || String(error);
      if (
        errorString.includes("no stats") ||
        errorString.includes("Requested app has no stats") ||
        errorString.includes("Bad Request")
      ) {
        alert(`This game has no achievements: ${errorString}`);
        achievementsGameIdRef.current = gameId;
        setAchievements([]);
      } else {
        // Show privacy dialog for errors (likely privacy-related)
        setShowPrivacyDialog(true);
        achievementsGameIdRef.current = gameId;
        setAchievements([]);
      }
      setLoadingAchievements(false);
    }
  };

  const handleLaunch = async () => {
    if (!gameId || !game) {
      console.error("Cannot launch: missing gameId or game", { gameId, game });
      alert("Cannot launch game: Game information is missing.");
      return;
    }

    if (launching) {
      console.log("Launch already in progress, ignoring click");
      return;
    }

    console.log("Launching game:", {
      gameId,
      gameTitle: game.title,
      launcher: game.launcher,
    });
    setLaunching(true);

    try {
      const result = await invoke("launch_game", { gameId });
      console.log("Launch game result:", result);

      // Kick centralized monitoring immediately; it will reconcile running state
      // in near-realtime without page-local process checks.
      startPolling(gameId, game);

      if (user?.userId) {
        updateGameActivity({
          userId: user.userId as unknown as Id<"users">,
          gameId: game.id,
          gameTitle: game.title,
          gameLauncher: game.launcher,
          gameIcon: game.icon,
        });
      }

      setLaunching(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to launch game:", error);
      alert(`Failed to launch game: ${errorMessage}`);
      setLaunching(false);
    }
  };

  const handleFetchMetadata = async () => {
    if (!gameId) return;
    setFetchingMetadata(true);
    try {
      const result = await invoke<any>("fetch_and_update_game_metadata", {
        gameId,
      });
      console.log("Metadata fetch result:", result);
      // Reload game data
      await loadGameDetails();
      alert("Game metadata updated successfully!");
    } catch (error) {
      console.error("Failed to fetch metadata:", error);
      alert(
        `Failed to fetch metadata: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setFetchingMetadata(false);
    }
  };

  const handleClose = async () => {
    if (!gameId) return;
    try {
      await killGame(gameId);
      // Clear game activity in Convex
      if (user?.userId) {
        updateGameActivity({
          userId: user.userId as unknown as Id<"users">,
        });
      }
    } catch (error) {
      console.error("Failed to close game:", error);
    }
  };

  // Handle scroll detection for sticky header and update hero height
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const hero = heroRef.current;
    if (!scrollContainer || !hero) return;

    const handleScroll = () => {
      const scrollTop = scrollContainer.scrollTop;
      const wasScrolled = scrollTop > 50;
      setIsScrolled(wasScrolled);

      // Update hero height for tab positioning
      if (hero) {
        const height = hero.offsetHeight;
        setHeroHeight(height);
      }
    };

    // Initial height measurement
    if (hero) {
      setHeroHeight(hero.offsetHeight);
    }

    scrollContainer.addEventListener("scroll", handleScroll);
    // Also listen for resize to update height when hero shrinks
    const resizeObserver = new ResizeObserver(() => {
      if (hero) {
        setHeroHeight(hero.offsetHeight);
      }
    });
    resizeObserver.observe(hero);

    return () => {
      scrollContainer.removeEventListener("scroll", handleScroll);
      resizeObserver.disconnect();
    };
  }, []);

  const isGameRunning = runningGameId === gameId;

  const handleOpenCustomization = async () => {
    if (!gameId) return;
    try {
      await invoke("create_game_customization_window", { gameId });
    } catch (error) {
      console.error("Failed to open customization window:", error);
    }
  };

  // Use custom art based on game type:
  // - Custom games: Always use Convex if available
  // - Non-custom games: Use Convex if customized, otherwise use DB
  const displayHeroArt = (() => {
    if (game?.launcher === "custom") {
      // Custom games: Pull from Convex
      return customizations?.customHeroArt || game?.headerArt;
    } else {
      // Non-custom games: Use Convex if customized, otherwise DB
      return (
        (customizations?.customized && customizations?.customHeroArt) ||
        game?.headerArt
      );
    }
  })();

  const collapsedHeroHeight = 72;
  const expandedHeroMinHeight = 220;
  const contentTopOffset = isScrolled
    ? collapsedHeroHeight
    : Math.max(heroHeight, expandedHeroMinHeight);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed Hero Background - sits behind everything */}
      <div
        ref={heroRef}
        className="fixed top-0 left-0 right-0 z-0 w-full flex flex-col text-white transition-all duration-300"
        style={{
          height: `${isScrolled ? collapsedHeroHeight : expandedHeroMinHeight}px`,
          background: !displayHeroArt
            ? "linear-gradient(to right, transparent, var(--background)), url('https://images.unsplash.com/photo-1677611998429-1baa4371456b?q=80&w=1332&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D') center center / cover no-repeat"
            : `linear-gradient(to right, transparent, var(--background)), url(${displayHeroArt}) center center / cover no-repeat`,
        }}
      >
        <div
          className="w-full pl-86 pr-4 flex flex-col h-full transition-all duration-300"
          style={{
            justifyContent: isScrolled ? "center" : "flex-end",
            paddingBottom: isScrolled ? "0.375rem" : "1rem",
          }}
        >
          <div className="flex flex-row items-end gap-2">
            <img
              src={getImageUrl(customizations?.customLogo || game?.icon) || "https://www.svgrepo.com/show/211746/game-controller-arcade.svg"}
              alt={`${game?.title} Icon`}
              className={`transition-all duration-300 bg-transparent backdrop-blur-xl p-2 rounded-md ${isScrolled ? "w-10 h-10" : "w-24 h-24"}`}
            />
            <div className="flex flex-col gap-1">
              <h1
                className={`font-light transition-all duration-300 ${isScrolled ? "text-base" : "text-xl"
                  }`}
              >
                {game?.title}
              </h1>
              <div className="game-actions flex gap-1">
                {isGameRunning ? (
                  <Button
                    className="font-light bg-red-300 hover:bg-red-800 text-red-700 hover:text-red-400 rounded-full border-none transition-all duration-300 cursor-pointer"
                    onClick={handleClose}
                  >
                    <X size={isScrolled ? 14 : 18} />
                    Quit
                  </Button>
                ) : (
                  <Button
                    className="font-light bg-transparent backdrop-blur-xl hover:bg-[var(--theme-button)] text-[var(--theme-button-secondary)] rounded-full border-none transition-all duration-300 cursor-pointer"
                    onClick={handleLaunch}
                  >
                    <IoPlay size={isScrolled ? 14 : 18} />
                    Play
                  </Button>
                )}
                {user && (
                  <Button
                    size="icon"
                    onClick={handleOpenCustomization}
                    className="font-light bg-transparent backdrop-blur-xl hover:bg-[var(--theme-button)] text-[var(--theme-button-secondary)] rounded-full border-none transition-all duration-300 cursor-pointer"
                  >
                    <Settings size={isScrolled ? 14 : 16} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div
        ref={scrollContainerRef}
        className="absolute left-0 right-0 bottom-0 z-[40]"
        style={{
          top: `${contentTopOffset}px`,
        }}
      >
        {/* Sticky Tabs - Appears below hero section */}
        <div
          className="relative z-[50] h-full bg-transparent min-h-0"
          style={{ top: 0 }}
        >
          {/* Now sticks to top of scrollable area */}
          <div className="absolute top-0 w-full z-[30] backdrop-blur-xl bg-[var(--theme-background)] border-y border-foreground/10 shadow-md py-1">
            <div className="flex gap-2 pl-85">
              <Button
                onClick={() => setActiveTab("overview")}
                className={`px-4 py-2 cursor-pointer font-light rounded-full bg-transparent hover:bg-[var(--theme-button)]/30 hover:backdrop-blur-md text-sm transition-colors ${activeTab === "overview"
                    ? "text-[var(--theme-accent)] hover:text-foreground bg-[var(--theme-button)] backdrop-blur-md"
                    : "text-foreground/60 hover:text-foreground"
                  }`}
              >
                Overview
              </Button>
              {game?.launcher === "steam" && (
                <Button
                  onClick={() => setActiveTab("achievements")}
                  className={`px-4 py-2 cursor-pointer font-light rounded-full bg-transparent hover:bg-[var(--theme-button)]/30 hover:backdrop-blur-md text-sm transition-colors ${activeTab === "achievements"
                      ? "text-[var(--theme-accent)] hover:text-foreground bg-[var(--theme-button)] backdrop-blur-md"
                      : "text-foreground/60 hover:text-foreground"
                    }`}
                >
                  <Trophy size={16} className="inline mr-1" />
                  Achievements
                </Button>
              )}
              <Button
                onClick={() => setActiveTab("forum")}
                className={`px-4 py-2 cursor-pointer font-light rounded-full bg-transparent hover:bg-[var(--theme-button)]/30 hover:backdrop-blur-md text-sm transition-colors ${activeTab === "forum"
                    ? "text-[var(--theme-accent)] hover:text-foreground bg-[var(--theme-button)] backdrop-blur-md"
                    : "text-foreground/60 hover:text-foreground"
                  }`}
              >
                <MessageSquare size={16} className="inline mr-1" />
                Forum
              </Button>
              {game?.launcher === "steam" && (
                <Button
                  onClick={() => setActiveTab("compatibility")}
                  className={`hidden px-4 py-2 cursor-pointer font-light rounded-full bg-transparent hover:bg-[var(--theme-button)]/30 hover:backdrop-blur-md text-sm transition-colors ${activeTab === "compatibility"
                      ? "text-[var(--theme-accent)] hover:text-foreground bg-[var(--theme-button)] backdrop-blur-md"
                      : "text-foreground/60 hover:text-foreground"
                    }`}
                >
                  <CheckCircle2 size={16} className="inline mr-1" />
                  Compatibility
                </Button>
              )}
              <Button
                onClick={() => setActiveTab("gallery")}
                className={`hidden px-4 py-2 cursor-pointer font-light rounded-full bg-transparent hover:bg-[var(--theme-button)]/30 hover:backdrop-blur-md text-sm transition-colors ${activeTab === "gallery"
                    ? "text-[var(--theme-accent)] hover:text-foreground bg-[var(--theme-button)] backdrop-blur-md"
                    : "text-foreground/60 hover:text-foreground"
                  }`}
              >
                <ImageIcon size={16} className="inline mr-1" />
                Gallery
              </Button>
            </div>
          </div>
          {/* Tab Content */}
          <div
            style={{
              background: "var(--background)",
            }}
            className="absolute top-9 bottom-0 w-full z-[20] overflow-hidden"
          >
            <div className="pl-84 w-full h-full pt-4 pr-2 bg-[var(--background)]/95 flex flex-col min-h-0">
              {activeTab === "overview" ? (
                <div className="flex flex-row gap-4 h-full min-h-0">
                    {/* Steam News Feed */}
                    {game?.launcher === "steam" && game?.metadata?.appId ? (
                      <div
                        className={`w-[50%] min-h-0 overflow-y-auto content-view-scrollbar pb-16 ${isAuthenticated && user ? "border-r border-white/10 pr-4" : ""}`}
                      >
                        {/* Only show news if it belongs to current game */}
                        {loadingNews || newsGameIdRef.current !== gameId ? (
                          <div className="flex flex-col items-center justify-center py-12">
                            <Loader2
                              size={32}
                              className="animate-spin mb-4"
                              style={{ color: "var(--theme-accent)" }}
                            />
                            <p className="text-foreground/60 text-sm">
                              Loading news...
                            </p>
                          </div>
                        ) : news.length > 0 ? (
                          <div className="flex flex-col gap-4">
                            {news
                              .filter((item: any) => {
                                // Filter by appId if available, otherwise trust newsGameIdRef
                                if (item.appId) {
                                  return (
                                    item.appId.toString() ===
                                    game.metadata?.appId?.toString()
                                  );
                                }
                                return newsGameIdRef.current === gameId;
                              })
                              .map((item: any) => (
                                <div
                                  key={item.gid}
                                  className="p-2 border-b border-foreground/10"
                                >
                                  <div className="flex items-start justify-between gap-4 mb-2">
                                    <h3 className="font-light text-foreground flex-1">
                                      {item.title}
                                    </h3>
                                    <span className="text-xs text-foreground/60 font-thin whitespace-nowrap">
                                      {item.date
                                        ? new Date(
                                          item.date * 1000,
                                        ).toLocaleDateString()
                                        : ""}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mb-2 text-sm font-thin text-foreground/70">
                                    <span>By {item.author}</span>
                                    {item.feedLabel && (
                                      <>
                                        <span>•</span>
                                        <span>{item.feedLabel}</span>
                                      </>
                                    )}
                                  </div>
                                  <div
                                    className="text-sm font-thin text-foreground/80 line-clamp-3 mb-3"
                                    dangerouslySetInnerHTML={{
                                      __html:
                                        item.contents.length > 500
                                          ? item.contents.substring(0, 500) +
                                          "..."
                                          : item.contents,
                                    }}
                                  />
                                  {item.url && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={async (e) => {
                                        e.preventDefault();
                                        try {
                                          await open(item.url);
                                        } catch (error) {
                                          console.error(
                                            "Failed to open URL:",
                                            error,
                                          );
                                        }
                                      }}
                                      className="text-sm px-2 rounded-full font-medium hover:opacity-80 transition-opacity cursor-pointer bg-transparent border-none text-left"
                                      style={{
                                        color: "var(--theme-button-secondary)",
                                      }}
                                    >
                                      Read more →
                                    </Button>
                                  )}
                                </div>
                              ))}
                          </div>
                        ) : (
                          <div className="text-center text-foreground/60 py-8">
                            <p>No news available for this game.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        className={`w-[50%] min-h-0 overflow-y-auto content-view-scrollbar pb-16 ${isAuthenticated && user ? "border-r border-white/10 pr-4" : ""}`}
                      >
                        <div className="text-center text-foreground/60 py-8">
                          <p>No news available for this game.</p>
                        </div>
                      </div>
                    )}
                    {isAuthenticated && user && (
                      <div className="flex w-[50%] min-h-0 flex-col gap-4 overflow-y-auto content-view-scrollbar pr-2 pb-16">
                        {/* Recent Playtime Section */}
                        {userPlaytime &&
                          (userPlaytime.totalPlaytime > 0 ||
                            userPlaytime.lastPlayed) && (
                            <MicaCard className="w-full mb-4">
                              <div className="flex items-center gap-2 mb-3">
                                <Clock className="w-4 h-4 text-[var(--theme-accent)]" />
                                <h2
                                  className="text-sm font-light text-foreground/90"
                                >
                                  Your playtime on {game?.title}
                                </h2>
                              </div>
                              <div className="flex flex-col gap-2">
                                {userPlaytime.totalPlaytime > 0 && (
                                  <div className="flex items-center justify-between">
                                    <span
                                      className="text-sm text-foreground/70"
                                    >
                                      You've played this game for...
                                    </span>
                                    <span
                                      className="text-sm font-medium text-foreground"
                                    >
                                      {Math.floor(
                                        userPlaytime.totalPlaytime / 3600,
                                      )}
                                      h{" "}
                                      {Math.floor(
                                        (userPlaytime.totalPlaytime % 3600) /
                                        60,
                                      )}
                                      m total
                                    </span>
                                  </div>
                                )}
                                {userPlaytime.lastPlayed && (
                                  <div className="flex items-center justify-between">
                                    <span
                                      className="text-sm text-foreground/70"
                                    >
                                      You last played this game on...
                                    </span>
                                    <span
                                      className="text-sm font-medium text-foreground"
                                    >
                                      {new Date(
                                        userPlaytime.lastPlayed,
                                      ).toLocaleDateString()}
                                    </span>
                                  </div>
                                )}
                                {userPlaytime.sessions &&
                                  userPlaytime.sessions.length > 0 && (
                                    <div className="flex items-center justify-between">
                                      <span
                                        className="text-sm text-foreground/70"
                                      >
                                        You've played this game...
                                      </span>
                                      <span
                                        className="text-sm font-medium text-foreground"
                                      >
                                        {userPlaytime.sessions.length} times
                                      </span>
                                    </div>
                                  )}
                              </div>
                            </MicaCard>
                          )}

                        {/* Friends' Playtime Section */}
                        {friendsPlaytime && friendsPlaytime.length > 0 && (
                          <MicaCard className="w-full mb-4">
                            <div className="flex items-center gap-2 mb-3">
                              <Users className="w-4 h-4 text-[var(--theme-accent)]" />
                              <h2
                                className="text-sm font-semibold text-foreground/90"
                              >
                                How much your friends have played {game?.title}
                              </h2>
                            </div>
                            <div className="flex flex-col gap-3">
                              {friendsPlaytime
                                .slice(0, 5)
                                .map((friend: any) => (
                                  <div
                                    key={friend.userId}
                                    className="flex items-center justify-between p-2 bg-foreground/5 rounded"
                                  >
                                    <div className="flex items-center gap-2">
                                      {friend.avatar ? (
                                        <img
                                          src={friend.avatar}
                                          alt={friend.username}
                                          className="w-8 h-8 rounded-full"
                                        />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-[var(--theme-accent)]/20 flex items-center justify-center">
                                          <span className="text-xs font-medium text-foreground">
                                            {(friend.username ||
                                              "U")[0]?.toUpperCase()}
                                          </span>
                                        </div>
                                      )}
                                      <div className="flex flex-col">
                                        <span
                                          className="text-sm font-medium text-foreground"
                                        >
                                          {friend.username}
                                        </span>
                                        {friend.lastPlayed && (
                                          <span
                                            className="text-xs text-foreground/60"
                                          >
                                            Last played{" "}
                                            {new Date(
                                              friend.lastPlayed,
                                            ).toLocaleDateString()}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex flex-col items-end">
                                      <span
                                        className="text-sm font-medium text-foreground"
                                      >
                                        {Math.floor(
                                          friend.totalPlaytime / 3600,
                                        )}
                                        h{" "}
                                        {Math.floor(
                                          (friend.totalPlaytime % 3600) / 60,
                                        )}
                                        m
                                      </span>
                                      {friend.sessionCount > 0 && (
                                        <span
                                          className="text-xs text-foreground/60"
                                        >
                                          {friend.sessionCount} session
                                          {friend.sessionCount !== 1 ? "s" : ""}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </MicaCard>
                        )}

                        {/* Achievements Summary */}
                        {game?.launcher === "steam" &&
                          game?.metadata?.appId &&
                          achievements.length > 0 && (
                            <div className="flex flex-col gap-1 w-full border-b border-foreground/10 pb-4 mb-4">
                              <h2
                                className="text-sm font-light mb-2 text-left text-foreground/60"
                              >
                                You've unlocked {unlockedCount} out of {totalCount} achievements
                              </h2>
                              <div className="flex flex-row flex-wrap gap-1 justify-start">
                                {achievements
                                  .map((achievement, idx) => (
                                    <img
                                      key={idx}
                                      src={achievement.icon}
                                      alt={achievement.name}
                                      className="w-8 h-8"
                                      style={{
                                        borderRadius: "4px",
                                        filter: achievement.unlocked
                                          ? "none"
                                          : "grayscale(100%) opacity(50%)",
                                        border: "1px solid green-400/20",
                                      }}
                                    />
                                  ))}
                              </div>
                            </div>
                          )}

                        {/* Forum Section */}
                        <div className="flex flex-col gap-2 w-full">
                          <h2
                            className="text-sm font-light mb-2 text-left text-foreground/60"
                          >
                            What people are saying about {game?.title}
                          </h2>
                          <GameForum gameId={gameId || ""} />
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div className="h-full w-full min-h-0 overflow-y-auto content-view-scrollbar pr-2 pb-16">

                {activeTab === "achievements" && (
                  <MicaCard className="mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Trophy size={20} />
                        Achievements
                        {loadingAchievements && (
                          <Loader2
                            size={16}
                            className="animate-spin text-foreground/60"
                          />
                        )}
                      </h2>
                      <div className="flex items-center gap-2">
                        {achievementsBelongToCurrentGame &&
                          achievements.length > 0 &&
                          !loadingAchievements && (
                            <span className="text-sm text-foreground/60">
                              {unlockedCount} / {totalCount} unlocked
                            </span>
                          )}
                        {game?.launcher === "steam" &&
                          user?.steamUserId &&
                          game?.metadata?.appId && (
                            <MicaButton
                              variant="default"
                              onClick={handleFetchSteamAchievements}
                              disabled={loadingAchievements}
                              className="text-sm"
                            >
                              {loadingAchievements ? (
                                <>
                                  <Loader2
                                    size={14}
                                    className="animate-spin inline-block mr-1"
                                  />
                                  Loading...
                                </>
                              ) : (
                                "Fetch from Steam"
                              )}
                            </MicaButton>
                          )}
                      </div>
                    </div>

                    {/* Only show achievements if they belong to the current game */}
                    {loadingAchievements || !achievementsBelongToCurrentGame ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <Loader2
                          size={32}
                          className="animate-spin text-[#4CE4B1] mb-4"
                        />
                        <p className="text-white/60 text-sm">
                          Loading achievements...
                        </p>
                        {!loadingAchievements &&
                          !achievementsBelongToCurrentGame &&
                          achievementsGameIdRef.current && (
                            <p className="text-xs text-red-400 mt-2">
                              Blocked: achievements belong to different game (
                              {achievementsGameIdRef.current} vs {gameId})
                            </p>
                          )}
                      </div>
                    ) : achievements.length > 0 ? (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* CRITICAL: Filter achievements by gameId - only show achievements that match current gameId */}
                          {achievements
                            .filter((achievement: any) => {
                              // STRICT: Only show achievements that have a gameId field matching the current gameId
                              if (
                                achievement.gameId !== undefined &&
                                achievement.gameId !== null &&
                                achievement.gameId !== ""
                              ) {
                                const matches = achievement.gameId === gameId;
                                if (!matches) {
                                  console.warn(
                                    "🚫 Filtering out achievement with wrong gameId:",
                                    {
                                      achievementId: achievement.id,
                                      achievementName: achievement.name,
                                      achievementGameId: achievement.gameId,
                                      currentGameId: gameId,
                                    },
                                  );
                                }
                                return matches;
                              }
                              // If achievement doesn't have gameId field, filter it out for safety
                              console.warn(
                                "🚫 Filtering out achievement missing gameId field:",
                                {
                                  achievementId: achievement.id,
                                  achievementName: achievement.name,
                                },
                              );
                              return false;
                            })
                            .map((achievement) => (
                              <div
                                key={achievement.id}
                                className={`p-3 rounded border ${achievement.unlocked
                                    ? "bg-[var(--theme-accent)]/10 border-[var(--theme-accent)]/30"
                                    : "bg-foreground/5 border-foreground/10"
                                  }`}
                              >
                                <div className="flex items-start gap-3">
                                  {achievement.icon ? (
                                    <img
                                      src={`${achievement.icon}`}
                                      alt={achievement.name}
                                      className="w-12 h-12 rounded"
                                    />
                                  ) : (
                                    <div
                                      className={`w-12 h-12 rounded flex items-center justify-center ${achievement.unlocked
                                          ? "bg-[var(--theme-accent)]/20"
                                          : "bg-foreground/5"
                                        }`}
                                    >
                                      {achievement.unlocked ? "✓" : "○"}
                                    </div>
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold">
                                      {achievement.name}
                                    </h3>
                                    {achievement.description && (
                                      <p className="text-sm text-foreground/70">
                                        {achievement.description}
                                      </p>
                                    )}
                                    {achievement.progress !== null &&
                                      achievement.maxProgress && (
                                        <div className="mt-2">
                                          <div className="w-full bg-foreground/10 rounded-full h-2">
                                            <div
                                              className="h-2 rounded-full"
                                              style={{
                                                backgroundColor:
                                                  "var(--theme-accent)",
                                                width: `${(achievement.progress /
                                                    achievement.maxProgress) *
                                                  100
                                                  }%`,
                                              }}
                                            />
                                          </div>
                                          <span className="text-xs text-foreground/60">
                                            {achievement.progress} /{" "}
                                            {achievement.maxProgress}
                                          </span>
                                        </div>
                                      )}
                                    {achievement.globalUnlockPercentage !==
                                      undefined && (
                                        <p className="text-xs text-foreground/50 mt-1">
                                          {achievement.globalUnlockPercentage.toFixed(
                                            1,
                                          )}
                                          % of players have this
                                        </p>
                                      )}
                                  </div>
                                </div>
                              </div>
                            ))}
                        </div>
                      </>
                    ) : (
                      <div className="text-center text-foreground/60 py-8">
                        {game?.launcher === "steam" && user?.steamUserId ? (
                          <div className="flex flex-col gap-3 items-center">
                            <p>No achievements found locally.</p>
                            <MicaButton
                              variant="primary"
                              onClick={handleFetchSteamAchievements}
                              disabled={loadingAchievements}
                            >
                              {loadingAchievements ? (
                                <>
                                  <Loader2
                                    size={14}
                                    className="animate-spin inline-block mr-1"
                                  />
                                  Loading...
                                </>
                              ) : (
                                "Fetch Achievements from Steam"
                              )}
                            </MicaButton>
                            <p className="text-xs text-foreground/60">
                              Make sure your Steam User ID is set in Settings.
                            </p>
                          </div>
                        ) : (
                          <p className="text-foreground/60">
                            {game?.launcher === "steam"
                              ? "Set your Steam User ID in Settings to fetch achievements."
                              : "No achievements available for this game."}
                          </p>
                        )}
                      </div>
                    )}
                  </MicaCard>
                )}

                {activeTab === "forum" && gameId && (
                  <GameForum gameId={gameId} />
                )}

                {activeTab === "compatibility" && (
                  <Card className="">
                    <CompatibilityChecker
                      gameId={gameId || ""}
                      gameTitle={game?.title}
                      steamAppId={game?.metadata?.appId}
                      launcher={game?.launcher}
                    />
                  </Card>
                )}

                {activeTab === "gallery" && gameId && (
                  <Card className="p-4">
                    <MediaGallery gameId={gameId} />
                  </Card>
                )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Privacy Notice Dialog */}
      <PrivacyNoticeDialog
        isOpen={showPrivacyDialog}
        onClose={() => setShowPrivacyDialog(false)}
      />
    </div>
  );
};

export default GameDetails;
