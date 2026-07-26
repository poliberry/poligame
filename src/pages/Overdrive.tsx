import React, { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { Power, X, LogOut, MessageSquare, Calendar, ClockIcon, Users, ChevronRight, TrendingUp, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
// @ts-ignore
import logo from "@/public/poligame-logo.svg";
import { useGameStore } from "@/stores/gameStore";
import { useOverdriveStore } from "@/stores/overdriveStore";
import { Game } from "@/types";
import { LauncherType } from "@/types";
import { Clock } from "@/components/Clock";
import ControllerButton from "@/components/overdrive/ControllerButton";
import ControllerIcon from "@/components/overdrive/ControllerIcon";
import OverdriveMenu, { OverdriveMenuItem } from "@/components/overdrive/OverdriveMenu";
import OverdrivePowerDialog from "@/components/overdrive/OverdrivePowerDialog";
import { useControllerStore, detectControllerType } from "@/stores/controllerStore";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";
// @ts-ignore
import connectionSound from "@/public/sounds/launch.wav";
// @ts-ignore
import disconnectSound from "@/public/sounds/launchNo.wav";
// @ts-ignore
import navigateSound from "@/public/sounds/move.wav";
// @ts-ignore
import dialogOpenSound from "@/public/sounds/menuOpen.wav";
// @ts-ignore
import menuOpenSound from "@/public/sounds/menuOpen.wav";
// @ts-ignore
import menuCloseSound from "@/public/sounds/menuClose.wav";
// @ts-ignore
import sectionChangeSound from "@/public/sounds/pageOpen.wav";
// @ts-ignore
import errMoveSound from "@/public/sounds/errMove.wav";
// @ts-ignore
import videoUrl from "@/public/video/overdrive-intro.mp4";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { getImageUrl } from "@/utils/imageUtils";
import { useGameWithCustomizations } from "@/hooks/useGameWithCustomizations";
import { useRunningGameStore } from "@/stores/runningGameStore";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Trophy } from "lucide-react";
import Marketplace from "./Marketplace";
import Community from "./Community";
import { cn } from "@/lib/utils";

// GameItem component
interface GameItemProps {
  game: Game;
  index: number;
  isFocused: boolean;
  isHero?: boolean;
  playtimeMinutes?: number;
  onFocus: () => void;
  onLaunch: () => void;
  onOpenDetails: () => void;
  gameItemRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
}

const GameItem: React.FC<GameItemProps> = ({
  game,
  index,
  isFocused,
  isHero = false,
  playtimeMinutes = 0,
  onFocus,
  onLaunch,
  onOpenDetails,
  gameItemRefs,
}) => {
  // Get game with customizations applied
  const displayGame = useGameWithCustomizations(game) || game;
  const coverArt = isHero
    ? getImageUrl(displayGame.headerArt || displayGame.coverArt || displayGame.gridCoverArt) || ""
    : getImageUrl(displayGame.gridCoverArt || displayGame.coverArt) || "";
  const itemRef = React.useRef<HTMLDivElement>(null);
  const tileWidth = isHero ? 600 : 200;
  const tileHeight = 300;
  const tileBackgroundPosition = isHero ? "center center" : "top center";
  const [isHovered, setIsHovered] = React.useState(false);
  const isActive = isFocused || isHovered;

  const playtimeLabel = React.useMemo(() => {
    if (!playtimeMinutes || playtimeMinutes <= 0) {
      return "No playtime yet";
    }

    return `${Math.round(playtimeMinutes)} minutes played`;
  }, [playtimeMinutes]);

  // Sync refs
  React.useEffect(() => {
    if (itemRef.current) {
      gameItemRefs.current.set(index, itemRef.current);
    }
  }, [index, gameItemRefs]);

  return (
    <motion.div
      key={game.id}
      ref={itemRef}
      tabIndex={0}
      initial={false}
      animate={{
        width: tileWidth,
        height: tileHeight,
        scale: isActive ? 1 : 0.98,
        opacity: isActive ? 1 : 0.92,
      }}
      transition={{
        duration: 0.35,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="relative cursor-pointer shrink-0"
      style={{
        outline: "none",
        zIndex: isFocused ? 20 : 10,
        fontFamily: "Google Sans Flex, sans-serif",
      }}
      onClick={() => {
        onFocus();
      }}
      onDoubleClick={() => onOpenDetails()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" />
      <link href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@6..144,1..1000&display=swap" rel="stylesheet"></link>
      {/* Game tile */}
      <motion.div
        className={`relative w-full h-full overflow-hidden shadow-2xl ${isActive
          ? "ring-4 ring-[#107c10] shadow-[#107c10]/50"
          : "ring-2 ring-white/20"
          }`}
      >
        {coverArt ? (
          <img
            src={coverArt}
            alt={displayGame.title}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: tileBackgroundPosition }}
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, #1a1f3a 0%, #0a0e27 100%)",
            }}
          />
        )}
        <div className={`absolute inset-0 ${isActive ? "bg-black/15" : "bg-black/30"}`} />
      </motion.div>

      <AnimatePresence>
        {isActive && (
          <motion.div
            key={`card-label-${game.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-0 top-full mt-3 px-1 text-left"
            style={{ fontFamily: "Google Sans Flex, sans-serif" }}
          >
            <p className="max-w-full text-sm font-semibold text-white">
              {displayGame.title}
            </p>
            <p className="text-xs text-white/70 tabular-nums">{playtimeLabel}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Focus indicator - Xbox style glow */}
      {isFocused && (
        <div
          className={cn("absolute -inset-2 rounded-lg pointer-events-none", isActive ? "animate-pulse" : "")}
          style={{
            background: `url(${getImageUrl(displayGame.headerArt || displayGame.coverArt || displayGame.gridCoverArt)}) center center / cover no-repeat`,
            filter: "blur(32px)",
            zIndex: -1,
          }}
        />
      )}
    </motion.div>
  );
};

const Overdrive: React.FC = () => {
  const { user, isAuthenticated, signOut } = useAuthStore();
  const { selectedGame, setSelectedGame, setSelectedIndex } = useOverdriveStore();
  const { games, setGames, setLoading } = useGameStore();
  const {
    runningGameId,
    killGame,
    startPolling,
    setKnownGames,
    startRealtimeMonitoring,
    stopRealtimeMonitoring,
    syncCurrentGame,
  } = useRunningGameStore();
  const location = useLocation();
  const navigate = useNavigate();

  // Get selected game with customizations
  const displaySelectedGame = useGameWithCustomizations(selectedGame);

  // Get playtime and achievements data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playtimeApi = api as any;
  const userPlaytime = useQuery(
    playtimeApi.playtime.getUserPlaytime,
    user?.userId
      ? {
        userId: user.userId as Id<"users">,
      }
      : "skip",
  );

  useEffect(() => {
    const getGameAchievements = async () => {
      if (selectedGame?.launcher === "steam") {
        const achievements = await invoke<any[]>("get_game_achievements", {
          gameId: selectedGame.id,
        });
        setAchievements(achievements);
      }
    };
    getGameAchievements();
  }, [selectedGame]);

  const playtimeByGameId = React.useMemo(() => {
    const playtimeByGameId = new Map<string, number>();
    (userPlaytime || []).forEach((record: any) => {
      playtimeByGameId.set(record.gameId, record.totalPlaytime || 0);
    });

    return playtimeByGameId;
  }, [userPlaytime]);

  const sortedGames = React.useMemo(() => {
    if (!games.length) {
      return games;
    }

    return [...games].sort((a, b) => {
      const aPlaytime = playtimeByGameId.get(a.id) || 0;
      const bPlaytime = playtimeByGameId.get(b.id) || 0;
      return bPlaytime - aPlaytime;
    });
  }, [games, playtimeByGameId]);

  const isSelectedGameRunning =
    selectedGame != null && runningGameId === selectedGame.id;

  const playtimeData = useQuery(
    playtimeApi.playtime.getGamePlaytime,
    selectedGame && user?.userId
      ? {
        userId: user.userId as Id<"users">,
        gameId: selectedGame.id,
      }
      : "skip"
  );

  // Get achievements (if Steam game)
  const [achievements, setAchievements] = React.useState<any[]>([]);

  // ======== MOVE ALL STATE DECLARATIONS HERE, BEFORE ANY HOOKS THAT USE THEM ========

  // Background and UI states
  const [backgroundLayers, setBackgroundLayers] = React.useState<
    Array<{ id: number; src: string }>
  >(() => {
    const initial = getImageUrl(
      displaySelectedGame?.headerArt ||
      displaySelectedGame?.gridCoverArt ||
      displaySelectedGame?.coverArt,
    );
    return initial ? [{ id: 0, src: initial }] : [];
  });

  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<"library" | "store" | "community">("library");
  const [videoEnded, setVideoEnded] = React.useState(() => {
    const skipFromRouteState = Boolean((location.state as { skipOverdriveIntro?: boolean } | null)?.skipOverdriveIntro);
    const introAlreadySeen = sessionStorage.getItem("overdriveIntroSeen") === "1";
    return skipFromRouteState || introAlreadySeen;
  });

  // Library states
  const [libraryFocusIndex, setLibraryFocusIndex] = React.useState(0);
  const [isNavigationFocusActive, setIsNavigationFocusActive] = React.useState(true);

  // TAB NAVIGATION STATES - MUST BE DECLARED BEFORE useResponsiveGamepad
  const [isFullView, setIsFullView] = React.useState(false);
  const [navigationMode, setNavigationMode] = React.useState<'library' | 'tabs' | 'tabContent'>('library');
  const [activeTab, setActiveTab] = React.useState<'achievements' | 'timeline' | 'community'>('achievements');
  const [tabContentIndex, setTabContentIndex] = React.useState(0);
  const [isTabSectionFocused, setIsTabSectionFocused] = React.useState(false);

  // Refs
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const gameItemRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const tabContentRefs = React.useRef<Map<number, HTMLElement>>(new Map());
  const fullViewScrollRef = React.useRef<HTMLDivElement>(null);
  const scrollX = useMotionValue(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const backgroundTransitionRef = React.useRef(0);
  const lastNavigationTime = React.useRef<number>(0);
  const navigationCooldown = 150;
  const lastStickDirection = React.useRef<"left" | "right" | null>(null);
  const stickHoldStartTime = React.useRef<number>(0);
  const previousControllerConnectedRef = React.useRef<boolean>(false);
  const suppressMenuUntilRef = React.useRef<number>(0);
  const tabCooldownRef = React.useRef<number>(0);
  const handledRouteSoundKeyRef = React.useRef<string | null>(null);
  const reopenDrawerAfterPowerDialogRef = React.useRef(false);

  // Audio refs
  const navigateAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const dialogOpenAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const menuOpenAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const menuCloseAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const sectionChangeAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const errMoveAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isUiAudioReady, setIsUiAudioReady] = React.useState(false);

  const { controllerType, isConnected, setControllerType, setIsConnected } = useControllerStore();

  // ======== END STATE DECLARATIONS ========

  // Fetch achievements effect
  React.useEffect(() => {
    const fetchAchievements = async () => {
      if (selectedGame?.launcher === "steam" && selectedGame.id) {
        try {
          const steamAchievements = await invoke<any[]>("get_game_achievements", {
            gameId: selectedGame.id,
          });
          setAchievements(steamAchievements || []);
        } catch (error) {
          console.error("Failed to fetch achievements:", error);
          setAchievements([]);
        }
      } else {
        setAchievements([]);
      }
    };
    fetchAchievements();
  }, [selectedGame?.id, selectedGame?.launcher]);

  // ... keep all your existing audio callback definitions (playNavigateSound, etc.) ...

  const playNavigateSound = React.useCallback(() => {
    const audio = navigateAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.debug("Failed to play navigation sound", error);
    });
  }, []);

  const playMenuOpenSound = React.useCallback(() => {
    const audio = menuOpenAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.debug("Failed to play menu open sound", error);
    });
  }, []);

  const playMenuCloseSound = React.useCallback(() => {
    const audio = menuCloseAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.debug("Failed to play menu close sound", error);
    });
  }, []);

  const playSectionChangeSound = React.useCallback(() => {
    const audio = sectionChangeAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.debug("Failed to play section change sound", error);
    });
  }, []);

  // ... keep existing useEffect for audio initialization ...

  useEffect(() => {
    const navigationAudio = new Audio(navigateSound);
    navigationAudio.preload = "auto";
    navigationAudio.volume = 0.35;
    navigateAudioRef.current = navigationAudio;

    const dialogAudio = new Audio(dialogOpenSound);
    dialogAudio.preload = "auto";
    dialogAudio.volume = 0.35;
    dialogOpenAudioRef.current = dialogAudio;

    const menuOpenAudio = new Audio(menuOpenSound);
    menuOpenAudio.preload = "auto";
    menuOpenAudio.volume = 0.35;
    menuOpenAudioRef.current = menuOpenAudio;

    const menuCloseAudio = new Audio(menuCloseSound);
    menuCloseAudio.preload = "auto";
    menuCloseAudio.volume = 0.35;
    menuCloseAudioRef.current = menuCloseAudio;

    const sectionAudio = new Audio(sectionChangeSound);
    sectionAudio.preload = "auto";
    sectionAudio.volume = 0.35;
    sectionChangeAudioRef.current = sectionAudio;

    const errAudio = new Audio(errMoveSound);
    errAudio.preload = "auto";
    errAudio.volume = 0.35;
    errMoveAudioRef.current = errAudio;
    setIsUiAudioReady(true);

    return () => {
      navigationAudio.pause();
      dialogAudio.pause();
      menuOpenAudio.pause();
      menuCloseAudio.pause();
      sectionAudio.pause();
      errAudio.pause();
      navigateAudioRef.current = null;
      dialogOpenAudioRef.current = null;
      menuOpenAudioRef.current = null;
      menuCloseAudioRef.current = null;
      sectionChangeAudioRef.current = null;
      errMoveAudioRef.current = null;
      setIsUiAudioReady(false);
    };
  }, []);

  // ... keep existing handlers (toggleDrawerWithSound, etc.) ...

  const toggleDrawerWithSound = React.useCallback(() => {
    setIsDrawerOpen((prev) => {
      if (Date.now() < suppressMenuUntilRef.current) return prev;
      if (prev) playMenuCloseSound(); else playMenuOpenSound();
      return !prev;
    });
  }, [playMenuCloseSound, playMenuOpenSound]);

  const openDrawerWithSound = React.useCallback(() => {
    setIsDrawerOpen((prev) => {
      if (Date.now() < suppressMenuUntilRef.current) return prev;
      if (!prev) playMenuOpenSound();
      return true;
    });
  }, [playMenuOpenSound]);

  const closeDrawerWithSound = React.useCallback(() => {
    setIsDrawerOpen((prev) => {
      if (prev) playMenuCloseSound();
      return false;
    });
  }, [playMenuCloseSound]);

  // ... keep existing useEffects for popstate, initialization, etc. ...

  useEffect(() => {
    let isHandlingPopState = false;
    const handlePopState = () => {
      if (isHandlingPopState) return;
      if (window.location.pathname !== '/overdrive') {
        isHandlingPopState = true;
        window.history.pushState(null, '', '/overdrive');
        setTimeout(() => { isHandlingPopState = false; }, 0);
      }
    };
    if (window.location.pathname !== '/overdrive') {
      window.history.pushState(null, '', '/overdrive');
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  React.useEffect(() => {
    if (sortedGames.length > 0 && libraryFocusIndex === 0) {
      const game = sortedGames[0];
      if (game) {
        setSelectedGame(game);
        setSelectedIndex(0);
      }
    }
  }, [sortedGames, libraryFocusIndex, setSelectedGame, setSelectedIndex]);

  React.useEffect(() => {
    const game = sortedGames[libraryFocusIndex];
    if (game) {
      setSelectedGame(game);
      setSelectedIndex(libraryFocusIndex);
    }
  }, [libraryFocusIndex, sortedGames, setSelectedGame, setSelectedIndex]);

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

  React.useEffect(() => {
    setKnownGames(sortedGames);
  }, [sortedGames, setKnownGames]);

  React.useEffect(() => {
    startRealtimeMonitoring();
    void syncCurrentGame();
    return () => { stopRealtimeMonitoring(); };
  }, [startRealtimeMonitoring, stopRealtimeMonitoring, syncCurrentGame]);

  // ... keep existing controller connection handling ...

  useEffect(() => {
    const gamepads = navigator.getGamepads();
    const connectedGamepad = Array.from(gamepads).find((gp) => gp !== null);
    previousControllerConnectedRef.current = connectedGamepad !== null;
    if (connectedGamepad) {
      setIsConnected(true);
      setControllerType(detectControllerType(connectedGamepad));
    } else {
      setIsConnected(false);
      setControllerType(null);
    }

    const handleControllerConnect = (e: GamepadEvent) => {
      const gamepad = e.gamepad;
      if (gamepad) {
        const playConnectionSound = new Audio(connectionSound);
        playConnectionSound.volume = 0.5;
        playConnectionSound.play();
        toast.success("Controller connected", {
          description: `Controller connected: ${gamepad.id}`,
          duration: 3000,
          position: "bottom-center",
        });
        previousControllerConnectedRef.current = true;
        setIsConnected(true);
        setControllerType(detectControllerType(gamepad));
      }
    };

    const handleControllerDisconnect = (e: GamepadEvent) => {
      const gamepad = e.gamepad;
      const gamepadId = gamepad?.id || "Unknown Controller";
      const currentGamepads = navigator.getGamepads();
      const stillConnected = Array.from(currentGamepads).some((gp) => gp !== null);
      if (previousControllerConnectedRef.current || !stillConnected) {
        const playDisconnectSound = new Audio(disconnectSound);
        playDisconnectSound.volume = 0.5;
        playDisconnectSound.play();
        toast.error("Controller disconnected", {
          description: `Controller disconnected: ${gamepadId}`,
          duration: 3000,
          position: "bottom-center",
        });
        previousControllerConnectedRef.current = false;
        setIsConnected(false);
        setControllerType(null);
      }
    };

    let lastGamepadCount = Array.from(navigator.getGamepads()).filter((gp) => gp !== null).length;
    const pollInterval = setInterval(() => {
      const currentGamepads = navigator.getGamepads();
      const currentGamepadCount = Array.from(currentGamepads).filter((gp) => gp !== null).length;
      if (lastGamepadCount > 0 && currentGamepadCount === 0 && previousControllerConnectedRef.current) {
        const playDisconnectSound = new Audio(disconnectSound);
        playDisconnectSound.volume = 0.5;
        playDisconnectSound.play();
        toast.error("Controller disconnected", {
          description: "Controller disconnected",
          duration: 3000,
          position: "bottom-center",
        });
        previousControllerConnectedRef.current = false;
        setIsConnected(false);
        setControllerType(null);
      }
      if (currentGamepadCount > 0) {
        previousControllerConnectedRef.current = true;
        const firstGamepad = Array.from(currentGamepads).find((gp) => gp !== null);
        if (firstGamepad) {
          setIsConnected(true);
          setControllerType(detectControllerType(firstGamepad));
        }
      } else if (currentGamepadCount === 0 && lastGamepadCount > 0) {
        setIsConnected(false);
        setControllerType(null);
      }
      lastGamepadCount = currentGamepadCount;
    }, 1000);

    window.addEventListener("gamepadconnected", handleControllerConnect);
    window.addEventListener("gamepaddisconnected", handleControllerDisconnect);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("gamepadconnected", handleControllerConnect);
      window.removeEventListener("gamepaddisconnected", handleControllerDisconnect);
    };
  }, []);

  useEffect(() => {
    loadGames();
    const gamesInterval = setInterval(() => {
      loadGames();
    }, 15 * 60 * 1000);
    return () => clearInterval(gamesInterval);
  }, []);

  // ... keep existing background effect ...

  useEffect(() => {
    const targetImage = getImageUrl(
      displaySelectedGame?.headerArt ||
      displaySelectedGame?.gridCoverArt ||
      displaySelectedGame?.coverArt,
    );

    if (!targetImage) {
      setBackgroundLayers([]);
      return;
    }

    const transitionId = backgroundTransitionRef.current + 1;
    backgroundTransitionRef.current = transitionId;

    const image = new Image();
    image.onload = () => {
      if (backgroundTransitionRef.current !== transitionId) return;
      setBackgroundLayers((previousLayers) => {
        const latestLayer = previousLayers[previousLayers.length - 1];
        if (latestLayer?.src === targetImage) return previousLayers;
        return [...previousLayers, { id: transitionId, src: targetImage }].slice(-2);
      });
    };

    image.onerror = () => {
      if (backgroundTransitionRef.current !== transitionId) return;
      setBackgroundLayers((previousLayers) => {
        const latestLayer = previousLayers[previousLayers.length - 1];
        if (latestLayer?.src === targetImage) return previousLayers;
        return [...previousLayers, { id: transitionId, src: targetImage }].slice(-2);
      });
    };

    image.src = targetImage;
  }, [
    selectedGame?.id,
    displaySelectedGame?.headerArt,
    displaySelectedGame?.gridCoverArt,
    displaySelectedGame?.coverArt,
  ]);

  // ... keep existing handlers ...

  const handleExitOverdrive = async () => {
    try {
      await invoke("exit_overdrive_mode");
      closeDrawerWithSound();
      navigate("/");
    } catch (error) {
      console.error("Failed to exit Overdrive mode:", error);
    }
  };

  const handleExitPoliGame = async () => {
    try {
      reopenDrawerAfterPowerDialogRef.current = false;
      await invoke("exit_overdrive_mode");
      await invoke("close_window");
    } catch (error) {
      console.error("Failed to exit PoliGame:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      reopenDrawerAfterPowerDialogRef.current = false;
      await signOut();
      closeDrawerWithSound();
      navigate("/auth");
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  const [isPowerDialogOpen, setIsPowerDialogOpen] = React.useState(false);

  const handlePowerDialogOpenChange = React.useCallback((open: boolean) => {
    setIsPowerDialogOpen(open);
    if (open) {
      closeDrawerWithSound();
      return;
    }
    if (reopenDrawerAfterPowerDialogRef.current) {
      reopenDrawerAfterPowerDialogRef.current = false;
      openDrawerWithSound();
    }
  }, [closeDrawerWithSound, openDrawerWithSound]);

  const handleOpenPowerOptions = React.useCallback(() => {
    reopenDrawerAfterPowerDialogRef.current = true;
    handlePowerDialogOpenChange(true);
  }, [handlePowerDialogOpenChange]);

  const menuItems = React.useMemo<OverdriveMenuItem[]>(() => {
    return [
      {
        id: "power-options",
        label: "Power Options",
        icon: Power,
        onSelect: handleOpenPowerOptions,
      },
    ];
  }, [handleOpenPowerOptions]);

  const handleOpenGameDetails = React.useCallback(
    (gameId: string) => {
      navigate(`/overdrive/game/${gameId}`, {
        state: {
          skipOverdriveIntro: true,
          overdriveSound: "sectionChange",
        },
      });
    },
    [navigate],
  );

  React.useEffect(() => {
    if (videoEnded) {
      sessionStorage.setItem("overdriveIntroSeen", "1");
    }
  }, [videoEnded]);

  const navigateLibrary = React.useCallback((direction: "next" | "prev") => {
    const now = Date.now();
    if (now - lastNavigationTime.current < navigationCooldown) return;
    if (sortedGames.length === 0) return;

    setIsNavigationFocusActive(true);
    playNavigateSound();
    lastNavigationTime.current = now;

    setLibraryFocusIndex((cur) => {
      const newIndex = direction === "next"
        ? (cur + 1) % sortedGames.length
        : (cur - 1 + sortedGames.length) % sortedGames.length;
      const game = sortedGames[newIndex];
      if (game) {
        setSelectedGame(game);
        setSelectedIndex(newIndex);
      }
      return newIndex;
    });
  }, [sortedGames, setSelectedGame, setSelectedIndex, playNavigateSound]);

  const handleLaunchGame = async (gameId: string) => {
    try {
      if (isDrawerOpen) closeDrawerWithSound();
      if (runningGameId === gameId) {
        await killGame(gameId);
        return;
      }
      await invoke("launch_game", { gameId });
      const launchedGame = sortedGames.find((entry) => entry.id === gameId);
      if (launchedGame) {
        startPolling(gameId, launchedGame);
      }
    } catch (error) {
      console.error("Failed to launch game:", error);
    }
  };

  React.useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const focusedElement = gameItemRefs.current.get(libraryFocusIndex);
    if (scrollContainer && focusedElement) {
      const containerWidth = scrollContainer.offsetWidth;
      const elementLeft = focusedElement.offsetLeft;
      const elementWidth = focusedElement.offsetWidth;
      const targetScrollLeft = elementLeft - (containerWidth / 2) + (elementWidth / 2);
      animate(scrollX, targetScrollLeft, {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
        onUpdate: (latest: any) => {
          if (scrollContainer) scrollContainer.scrollLeft = latest;
        },
      });
    }
  }, [libraryFocusIndex, scrollX]);

  // ======== TAB NAVIGATION HELPERS ========

  const getTabContentLength = React.useCallback(() => {
    switch (activeTab) {
      case 'achievements':
        return achievements.length;
      case 'timeline':
        return (playtimeData?.sessions || []).length;
      case 'community':
        return 6; // Forum threads
      default:
        return 0;
    }
  }, [activeTab, achievements, playtimeData]);

  const scrollToTabContent = React.useCallback((index: number) => {
    const element = tabContentRefs.current.get(index);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  const activateTabContent = React.useCallback((index: number) => {
    if (activeTab === 'achievements') {
      const achievement = achievements[index];
      if (achievement) {
        toast.info(achievement.name, { description: achievement.description });
      }
    } else if (activeTab === 'community') {
      toast.info("Opening forum...", { description: "Navigating to community forum" });
    }
  }, [activeTab, achievements]);

  // ======== CONTROLLER HOOK ========

  useResponsiveGamepad({
    onButtonDown: (button) => {
      if (isDrawerOpen || isPowerDialogOpen) return;
      const now = Date.now();
      if (now - lastNavigationTime.current < navigationCooldown) return;

      // FULL VIEW: Tab Content
      if (isFullView && navigationMode === 'tabContent') {
        const contentLength = getTabContentLength();

        if (button === 'B' || button === 'CIRCLE') {
          setNavigationMode('tabs');
          setTabContentIndex(0);
          playNavigateSound();
          lastNavigationTime.current = now;
          return;
        }

        if (button === 'A' || button === 'X') {
          activateTabContent(tabContentIndex);
          lastNavigationTime.current = now;
          return;
        }

        if (activeTab === 'achievements') {
          const cols = window.innerWidth > 1280 ? 4 : window.innerWidth > 1024 ? 3 : 2;
          if (button === 'RIGHT') {
            if ((tabContentIndex + 1) % cols !== 0 && tabContentIndex < contentLength - 1) {
              setTabContentIndex(prev => prev + 1);
              playNavigateSound();
              lastNavigationTime.current = now;
            }
            return;
          }
          if (button === 'LEFT') {
            if (tabContentIndex % cols !== 0) {
              setTabContentIndex(prev => prev - 1);
              playNavigateSound();
              lastNavigationTime.current = now;
            }
            return;
          }
          if (button === 'DOWN') {
            const newIndex = tabContentIndex + cols;
            if (newIndex < contentLength) {
              setTabContentIndex(newIndex);
              playNavigateSound();
              lastNavigationTime.current = now;
              scrollToTabContent(newIndex);
            }
            return;
          }
          if (button === 'UP') {
            const newIndex = tabContentIndex - cols;
            if (newIndex >= 0) {
              setTabContentIndex(newIndex);
              playNavigateSound();
              lastNavigationTime.current = now;
              scrollToTabContent(newIndex);
            } else {
              setNavigationMode('tabs');
              playNavigateSound();
              lastNavigationTime.current = now;
            }
            return;
          }
        } else {
          if (button === 'DOWN') {
            if (tabContentIndex < contentLength - 1) {
              setTabContentIndex(prev => prev + 1);
              playNavigateSound();
              lastNavigationTime.current = now;
              scrollToTabContent(tabContentIndex + 1);
            }
            return;
          }
          if (button === 'UP') {
            if (tabContentIndex > 0) {
              setTabContentIndex(prev => prev - 1);
              playNavigateSound();
              lastNavigationTime.current = now;
              scrollToTabContent(tabContentIndex - 1);
            } else {
              setNavigationMode('tabs');
              playNavigateSound();
              lastNavigationTime.current = now;
            }
            return;
          }
        }
        return;
      }

      // FULL VIEW: Tabs
      if (isFullView && navigationMode === 'tabs') {
        if (button === 'B' || button === 'CIRCLE') {
          setIsFullView(false);
          setNavigationMode('library');
          setTabContentIndex(0);
          playNavigateSound();
          lastNavigationTime.current = now;
          return;
        }

        if (button === 'DOWN' || button === 'A' || button === 'X') {
          const contentLength = getTabContentLength();
          if (contentLength > 0) {
            setNavigationMode('tabContent');
            setTabContentIndex(0);
            playNavigateSound();
            lastNavigationTime.current = now;
            scrollToTabContent(0);
          }
          return;
        }

        const tabs = ['achievements', 'timeline', 'community'] as const;
        const currentIdx = tabs.indexOf(activeTab);

        if (button === 'RIGHT') {
          const nextTab = tabs[(currentIdx + 1) % tabs.length];
          setActiveTab(nextTab);
          setTabContentIndex(0);
          playNavigateSound();
          lastNavigationTime.current = now;
          return;
        }

        if (button === 'LEFT') {
          const prevTab = tabs[(currentIdx - 1 + tabs.length) % tabs.length];
          setActiveTab(prevTab);
          setTabContentIndex(0);
          playNavigateSound();
          lastNavigationTime.current = now;
          return;
        }
        return;
      }

      // NORMAL VIEW: Library
      if (!isFullView && navigationMode === 'library') {
        if (button === "START") {
          toggleDrawerWithSound();
          return;
        }

        if ((button === "A" || button === "X")) {
          const game = sortedGames[libraryFocusIndex];
          if (game) handleOpenGameDetails(game.id);
          return;
        }

        if (button === "DOWN") {
          if (sortedGames.length > 0) {
            setIsFullView(true);
            setNavigationMode('tabs');
            setTabContentIndex(0);
            playNavigateSound();
            lastNavigationTime.current = now;
          }
          return;
        }

        if (button === "LB") {
          navigateLibrary("prev");
          return;
        }

        if (button === "RB") {
          navigateLibrary("next");
          return;
        }
      }
    },

    onLeftStick: (x, y) => {
      if (isDrawerOpen || isPowerDialogOpen) return;
      const now = Date.now();
      const deadzone = 0.5;

      if (Math.abs(y) > deadzone && now - stickHoldStartTime.current > 200) {
        if (!isFullView && navigationMode === 'library' && y > 0.5) {
          setIsFullView(true);
          setNavigationMode('tabs');
          setTabContentIndex(0);
          playNavigateSound();
          stickHoldStartTime.current = now;
          return;
        }
        if (isFullView && navigationMode === 'tabs' && y < -0.5) {
          setIsFullView(false);
          setNavigationMode('library');
          setTabContentIndex(0);
          playNavigateSound();
          stickHoldStartTime.current = now;
          return;
        }
        if (isFullView && navigationMode === 'tabs' && y > 0.5) {
          const contentLength = getTabContentLength();
          if (contentLength > 0) {
            setNavigationMode('tabContent');
            setTabContentIndex(0);
            playNavigateSound();
            stickHoldStartTime.current = now;
            scrollToTabContent(0);
          }
          return;
        }
        if (isFullView && navigationMode === 'tabContent' && y < -0.5) {
          setNavigationMode('tabs');
          setTabContentIndex(0);
          playNavigateSound();
          stickHoldStartTime.current = now;
          return;
        }
      }

      if (Math.abs(x) > deadzone) {
        if (!isFullView && navigationMode === 'library') {
          setIsNavigationFocusActive(true);
          const direction = x > 0 ? "right" : "left";
          if (lastStickDirection.current !== direction) {
            lastStickDirection.current = direction;
            navigateLibrary(direction === "right" ? "next" : "prev");
          } else if (now - lastNavigationTime.current >= 400) {
            navigateLibrary(direction === "right" ? "next" : "prev");
          }
        } else if (isFullView && navigationMode === 'tabs') {
          const tabs = ['achievements', 'timeline', 'community'] as const;
          const currentIdx = tabs.indexOf(activeTab);
          if (now - lastNavigationTime.current >= 300) {
            if (x > 0) {
              setActiveTab(tabs[(currentIdx + 1) % tabs.length]);
              setTabContentIndex(0);
            } else {
              setActiveTab(tabs[(currentIdx - 1 + tabs.length) % tabs.length]);
              setTabContentIndex(0);
            }
            playNavigateSound();
            lastNavigationTime.current = now;
          }
        }
      } else {
        lastStickDirection.current = null;
      }
    },
  });

  // ======== KEYBOARD HANDLER ========

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isDrawerOpen || isPowerDialogOpen) return;

      const now = Date.now();
      if (now - lastNavigationTime.current < navigationCooldown) return;

      // FULL VIEW: Tab Content
      if (isFullView && navigationMode === 'tabContent') {
        const contentLength = getTabContentLength();

        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          if (tabContentIndex > 0) {
            setTabContentIndex(prev => prev - 1);
            playNavigateSound();
            lastNavigationTime.current = now;
            scrollToTabContent(tabContentIndex - 1);
          } else {
            setNavigationMode('tabs');
            setTabContentIndex(0);
            playNavigateSound();
            lastNavigationTime.current = now;
          }
          return;
        }

        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          if (tabContentIndex < contentLength - 1) {
            setTabContentIndex(prev => prev + 1);
            playNavigateSound();
            lastNavigationTime.current = now;
            scrollToTabContent(tabContentIndex + 1);
          }
          return;
        }

        if (activeTab === 'achievements') {
          const cols = window.innerWidth > 1280 ? 4 : window.innerWidth > 1024 ? 3 : 2;
          if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            if ((tabContentIndex + 1) % cols !== 0 && tabContentIndex < contentLength - 1) {
              setTabContentIndex(prev => prev + 1);
              playNavigateSound();
              lastNavigationTime.current = now;
              scrollToTabContent(tabContentIndex + 1);
            }
            return;
          }
          if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            if (tabContentIndex % cols !== 0) {
              setTabContentIndex(prev => prev - 1);
              playNavigateSound();
              lastNavigationTime.current = now;
              scrollToTabContent(tabContentIndex - 1);
            }
            return;
          }
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          activateTabContent(tabContentIndex);
          return;
        }

        if (e.key === 'Backspace' || e.key === 'Escape') {
          e.preventDefault();
          setNavigationMode('tabs');
          setTabContentIndex(0);
          playNavigateSound();
          return;
        }
        return;
      }

      // FULL VIEW: Tabs
      if (isFullView && navigationMode === 'tabs') {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          setIsFullView(false);
          setNavigationMode('library');
          setTabContentIndex(0);
          playNavigateSound();
          lastNavigationTime.current = now;
          return;
        }

        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          const contentLength = getTabContentLength();
          if (contentLength > 0) {
            setNavigationMode('tabContent');
            setTabContentIndex(0);
            playNavigateSound();
            lastNavigationTime.current = now;
            scrollToTabContent(0);
          }
          return;
        }

        const tabs = ['achievements', 'timeline', 'community'] as const;
        const currentIdx = tabs.indexOf(activeTab);

        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          const nextTab = tabs[(currentIdx + 1) % tabs.length];
          setActiveTab(nextTab);
          setTabContentIndex(0);
          playNavigateSound();
          lastNavigationTime.current = now;
          return;
        }

        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          const prevTab = tabs[(currentIdx - 1 + tabs.length) % tabs.length];
          setActiveTab(prevTab);
          setTabContentIndex(0);
          playNavigateSound();
          lastNavigationTime.current = now;
          return;
        }
        return;
      }

      // LIBRARY NAVIGATION
      if (!isFullView && navigationMode === 'library' && activeSection === "library") {
        if (["ArrowRight", "d", "D"].includes(e.key)) {
          e.preventDefault();
          navigateLibrary("next");
          return;
        }

        if (["ArrowLeft", "a", "A"].includes(e.key)) {
          e.preventDefault();
          navigateLibrary("prev");
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          const game = sortedGames[libraryFocusIndex];
          if (game) handleOpenGameDetails(game.id);
          return;
        }

        if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
          e.preventDefault();
          if (sortedGames.length > 0) {
            setIsFullView(true);
            setNavigationMode('tabs');
            setTabContentIndex(0);
            playNavigateSound();
            lastNavigationTime.current = now;
          }
          return;
        }
      }

      if (e.key === "m" || e.key === "M") {
        toggleDrawerWithSound();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isDrawerOpen, isPowerDialogOpen, activeSection, libraryFocusIndex,
    sortedGames, navigateLibrary, handleOpenGameDetails, navigationMode,
    activeTab, tabContentIndex, playNavigateSound, isFullView
  ]);

  // ... keep existing video handlers ...

  const handleVideoEnd = () => {
    setTimeout(() => {
      setVideoEnded(true);
    }, 500);
  };

  React.useEffect(() => {
    if (videoRef.current && !videoEnded) {
      const video = videoRef.current;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'MediaPlayPause') {
          e.preventDefault();
          e.stopPropagation();
          if (video.paused) video.play();
        }
      };
      const handleContextMenu = (e: MouseEvent) => { e.preventDefault(); };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('contextmenu', handleContextMenu);
      video.play().catch((error) => {
        console.error("Error playing video:", error);
        setTimeout(() => setVideoEnded(true), 1000);
      });
      const checkVideoPlaying = setInterval(() => {
        if (video.paused && !videoEnded) video.play();
      }, 100);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('contextmenu', handleContextMenu);
        clearInterval(checkVideoPlaying);
      };
    }
  }, [videoEnded]);

  React.useEffect(() => {
    if (!videoEnded) {
      const timer = setTimeout(() => setVideoEnded(true), 9000);
      return () => clearTimeout(timer);
    }
  }, [videoEnded]);

  // ======== RENDER ========

  return (
    <>
      {/* Video */}
      {!videoEnded && (
        <div className="fixed inset-0 w-full h-screen bg-black flex items-center justify-center overflow-hidden z-[200]">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            onEnded={handleVideoEnd}
            onError={() => { setVideoEnded(true); }}
            onContextMenu={(e) => e.preventDefault()}
            onPause={(e) => { e.currentTarget.play(); }}
            playsInline muted={false} autoPlay controls={false}
            disablePictureInPicture disableRemotePlayback
          >
            <source src={videoUrl} type="video/mp4" />
          </video>
        </div>
      )}

      {videoEnded && (
        <motion.div
          className="w-full h-screen bg-black text-white overflow-hidden"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
        >
          <style>{`
            @keyframes fade-pop-in {
              from { opacity: 0; transform: scale(1.05); }
              to { opacity: 1; transform: scale(1); }
            }
            .no-scrollbar::-webkit-scrollbar { display: none; }
          `}</style>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Livvic:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,900&family=Unbounded:wght@200..900&display=swap" rel="stylesheet" />

          {/* Header */}
          <div className={cn(isDrawerOpen ? "bg-black" : "", "absolute top-0 left-0 right-0 z-[999] flex items-center justify-end p-4 transition-all duration-300")}>
            <div className="flex items-center gap-4">
              <Clock showSeconds={false} className="flex items-center" />
              {isAuthenticated && user && (
                <div className="flex items-center gap-2">
                  {user.avatar ? (
                    <img src={user.avatar} alt="User Avatar" className="w-8 h-8" />
                  ) : (
                    <div className="w-8 h-8 bg-white/20 flex items-center justify-center">
                      <span className="text-xs font-bold">
                        {(user.username || user.email || "U")[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
              )}
              <Button onClick={openDrawerWithSound} variant="ghost" className="flex items-center gap-2 dark">
                <Power className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Main Content */}
          <div className="relative w-full h-full overflow-hidden bg-gray-900">

            {/* Background */}
            <div className="absolute inset-0 w-full h-[350px]">
              <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #1a1f3a 0%, #0a0e27 100%)" }} />
              <AnimatePresence>
                {backgroundLayers.map((layer, index) => {
                  const isTopLayer = index === backgroundLayers.length - 1;
                  return (
                    <motion.div
                      key={layer.id}
                      initial={isTopLayer ? { opacity: 0, scale: 1 } : { opacity: 1, scale: 1 }}
                      animate={isTopLayer ? { opacity: 1, scale: 1.06 } : { opacity: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 1 }}
                      transition={isTopLayer ? { opacity: { duration: 0.2 }, scale: { duration: 12, ease: "linear" } } : { duration: 0.2 }}
                      onAnimationComplete={() => {
                        if (!isTopLayer) {
                          setBackgroundLayers((prev) => prev.filter((entry) => entry.id !== layer.id));
                        }
                      }}
                      className="absolute inset-0"
                      style={{ backgroundImage: `url(${layer.src})`, backgroundSize: "cover", backgroundPosition: "center" }}
                    />
                  );
                })}
              </AnimatePresence>
              <div className="absolute inset-0 w-full h-[360px] bg-gray-900/70 z-[2]" />
              <div className="absolute inset-0 w-full h-[365px] bg-gradient-to-b from-transparent to-gray-900 z-[3]" />
            </div>

            {/* Library Section */}
            <div className="absolute inset-0 z-[31]" style={{ paddingTop: "88px" }}>
              <div className="relative w-full h-full flex flex-col z-[30]">

                {/* Games Strip - Hidden in full view */}
                <AnimatePresence>
                  {!isFullView && (
                    <motion.div
                      className="flex-1 flex items-start justify-start px-12"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, y: -50 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div
                        ref={scrollContainerRef}
                        className="w-full overflow-x-auto overflow-y-hidden no-scrollbar"
                        onMouseMove={() => setIsNavigationFocusActive(false)}
                        onScroll={(e) => scrollX.set(e.currentTarget.scrollLeft)}
                      >
                        <div className="flex w-max gap-4 p-2 items-start" style={{ paddingTop: "70px", paddingLeft: "70px", paddingBottom: "130px" }}>
                          {sortedGames.map((game, idx) => (
                            <GameItem
                              key={game.id}
                              game={game}
                              index={idx}
                              isHero={idx === 0}
                              playtimeMinutes={playtimeByGameId.get(game.id) || 0}
                              isFocused={isNavigationFocusActive && idx === libraryFocusIndex}
                              onFocus={() => {
                                setIsNavigationFocusActive(false);
                                setLibraryFocusIndex(idx);
                                setSelectedGame(game);
                                setSelectedIndex(idx);
                              }}
                              onLaunch={() => handleLaunchGame(game.id)}
                              onOpenDetails={() => handleOpenGameDetails(game.id)}
                              gameItemRefs={gameItemRefs}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tabbed Interface */}
                <AnimatePresence mode="wait">
                  {(isFullView || isNavigationFocusActive) && (
                    <motion.div
                      key="tabbed-interface"
                      initial={{ opacity: 0, y: 50 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      className={cn(
                        "absolute left-0 right-0 z-[40] flex flex-col bg-gray-900/40 backdrop-blur-xl",
                        isFullView ? "-top-[90px] bottom-[60px]" : "top-[44vh] bottom-0"
                      )}
                    >
                      {/* Tab Navigation */}
                      <div className={cn("flex items-center justify-center gap-2 mb-4 shrink-0", isFullView ? "mt-16" : "mt-4")}>
                        <button>
                          <ArrowLeft className={cn(
                            "w-6 h-6 text-white/60 hover:text-white/90 transition-colors duration-200",
                            isFullView && navigationMode === 'tabs' ? "text-white" : ""
                          )} />
                        </button>
                        {[
                          { id: 'achievements', label: 'Achievements', icon: Trophy },
                          { id: 'timeline', label: 'Timeline', icon: ClockIcon },
                          { id: 'community', label: 'Community', icon: Users },
                        ].map((tab) => {
                          const Icon = tab.icon;
                          const isActive = activeTab === tab.id;
                          const isTabFocused = navigationMode === 'tabs' && isActive && isFullView;

                          return (
                            <motion.button
                              key={tab.id}
                              onClick={() => {
                                setActiveTab(tab.id as typeof activeTab);
                                if (!isFullView) setIsFullView(true);
                                setNavigationMode('tabs');
                              }}
                              className={cn(
                                "flex tracking-[0.15rem] items-center gap-2 px-6 py-3 border-2 border-transparent uppercase text-sm font-medium transition-all duration-200 rounded-full outline-none",
                                isTabFocused
                                  ? "bg-white text-black shadow-lg border-[var(--theme-accent)] animate-pulse"
                                  : isActive
                                    ? "bg-white/90 text-black"
                                    : "text-white/60 hover:text-white/90 hover:bg-white/10"
                              )}
                              style={{ fontFamily: 'Google Sans Flex, sans-serif' }}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Icon className="w-4 h-4" />
                              {tab.label}
                            </motion.button>
                          );
                        })}
                        <button>
                          <ArrowRight className={cn(
                            "w-6 h-6 text-white/60 hover:text-white/90 transition-colors duration-200",
                            isFullView && navigationMode === 'tabs' ? "text-white" : ""
                          )} />
                        </button>
                      </div>

                      {/* Tab Content */}
                      <div
                        ref={fullViewScrollRef}
                        className={cn(
                          "flex-1 overflow-y-auto border-y transition-all duration-300",
                          isFullView ? "bg-gray-900/40 border-white/20" : "bg-gray-900/60 border-white/10 max-h-[36vh]"
                        )}
                      >
                        <div className="p-6">

                          {/* Achievements */}
                          {activeTab === 'achievements' && (
                            <div className={isFullView ? "pb-20" : ""}>
                              {selectedGame?.launcher === 'steam' ? (
                                achievements.length > 0 ? (
                                  <div className={cn(
                                    "grid gap-4",
                                    isFullView ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
                                  )}>
                                    {achievements.map((achievement, idx) => {
                                      const isItemFocused = isFullView && navigationMode === 'tabContent' && tabContentIndex === idx;
                                      return (
                                        <motion.div
                                          key={achievement.id || idx}
                                          ref={(el) => { if (el) tabContentRefs.current.set(idx, el); }}
                                          initial={{ opacity: 0, y: 20 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{ delay: idx * 0.02 }}
                                          className={cn(
                                            "flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-200",
                                            isItemFocused
                                              ? "bg-white/15 border-white shadow-lg scale-[1.02]"
                                              : achievement.achieved
                                                ? "bg-white/5 border-white/10"
                                                : "bg-black/40 border-white/5 opacity-40"
                                          )}
                                        >
                                          <img src={achievement.icon || '/default-achievement.png'} alt={achievement.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-base font-semibold text-white mb-1">{achievement.name}</p>
                                            <p className="text-sm text-white/60 line-clamp-2">{achievement.description}</p>
                                            {achievement.achieved && achievement.unlockTime && (
                                              <p className="text-sm text-[#107c10] mt-2">✓ Unlocked {new Date(achievement.unlockTime).toLocaleDateString()}</p>
                                            )}
                                          </div>
                                        </motion.div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-64 text-white/40">
                                    <Trophy className="w-16 h-16 mb-4 opacity-50" />
                                    <p className="text-lg">No achievements available</p>
                                  </div>
                                )
                              ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-white/40">
                                  <p className="text-lg">Achievements only available for Steam games</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Timeline */}
                          {activeTab === 'timeline' && (
                            <div style={{ fontFamily: 'Google Sans Flex, sans-serif' }} className={isFullView ? "pb-20 max-w-4xl mx-auto" : "max-w-4xl mx-auto"}>
                              {playtimeData ? (
                                <>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                    <div className="bg-white/5 p-4 border border-white/10">
                                      <p className="text-xs uppercase font-thin text-white/50 tracking-[0.15rem]">Total Playtime</p>
                                      <p className="text-3xl font-light text-white">{Math.round((playtimeData.totalPlaytime || 0) / 60)}h</p>
                                    </div>
                                    <div className="bg-white/5 p-4 border border-white/10">
                                      <p className="text-xs uppercase font-thin text-white/50 tracking-[0.15rem]">Sessions</p>
                                      <p className="text-3xl font-light text-white">{playtimeData.sessions?.length || 0}</p>
                                    </div>
                                    <div className="bg-white/5 p-4 border border-white/10">
                                      <p className="text-xs uppercase font-thin text-white/50 tracking-[0.15rem]">Avg Session</p>
                                      <p className="text-3xl font-light text-white">{Math.round(((playtimeData.totalPlaytime || 0) / Math.max(playtimeData.sessions?.length || 1, 1)))}m</p>
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    {(playtimeData.sessions || []).map((session: any, idx: number) => {
                                      const isItemFocused = isFullView && navigationMode === 'tabContent' && tabContentIndex === idx;
                                      return (
                                        <motion.div
                                          key={idx}
                                          ref={(el) => { if (el) tabContentRefs.current.set(idx, el); }}
                                          initial={{ opacity: 0, x: -20 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: idx * 0.03 }}
                                          className={cn(
                                            "flex items-center gap-4 p-4 border-2 transition-all",
                                            isItemFocused ? "bg-white/10 border-[var(--theme-accent)] scale-[1.01] animate-pulse shadow-lg" : "bg-white/5 border-transparent"
                                          )}
                                        >
                                          <div className="flex-1">
                                            <p className="text-white text-md">{new Date(session.startTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                            <p className="text-white/50 text-xs font-thin uppercase tracking-[0.15rem]">Session #{idx + 1}</p>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-2xl font-light text-white">{Math.round(session.duration / 60)}m</p>
                                            <p className="text-white/50 text-xs font-thin uppercase tracking-[0.15rem]">{new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                          </div>
                                        </motion.div>
                                      );
                                    })}
                                  </div>
                                </>
                              ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-white/40">
                                  <ClockIcon className="w-16 h-16 mb-4 opacity-50" />
                                  <p className="text-lg">No playtime data available</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Community */}
                          {activeTab === 'community' && (
                            <div className={cn("max-w-4xl mx-auto", isFullView && "pb-20")}>
                              <div className="space-y-3">
                                {[
                                  { title: "General Discussion", replies: 234, lastActive: "2 hours ago", tag: "Hot", color: "bg-red-500/20 text-red-400" },
                                  { title: "Tips & Tricks", replies: 89, lastActive: "5 hours ago", tag: "Guide", color: "bg-blue-500/20 text-blue-400" },
                                  { title: "Technical Support", replies: 45, lastActive: "1 day ago", tag: "Help", color: "bg-green-500/20 text-green-400" },
                                  { title: "Modding", replies: 156, lastActive: "3 days ago", tag: "Mod", color: "bg-purple-500/20 text-purple-400" },
                                  { title: "Showcase", replies: 312, lastActive: "4 hours ago", tag: "Media", color: "bg-yellow-500/20 text-yellow-400" },
                                  { title: "Bug Reports", replies: 28, lastActive: "12 hours ago", tag: "Bug", color: "bg-orange-500/20 text-orange-400" },
                                ].map((forum, idx) => {
                                  const isItemFocused = isFullView && navigationMode === 'tabContent' && tabContentIndex === idx;
                                  return (
                                    <motion.div
                                      key={forum.title}
                                      ref={(el) => { if (el) tabContentRefs.current.set(idx, el); }}
                                      initial={{ opacity: 0, y: 10 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: idx * 0.05 }}
                                      className={cn(
                                        "flex items-center justify-between p-5 border-2 cursor-pointer transition-all",
                                        isItemFocused ? "bg-white/10 border-[var(--theme-accent)] scale-[1.01] animate-pulse shadow-lg" : "bg-white/5 border-transparent"
                                      )}
                                    >
                                      <div className="flex items-center gap-4">
                                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", forum.color)}>
                                          <MessageSquare className="w-6 h-6" />
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-3 mb-1">
                                            <p className="text-lg font-medium text-white">{forum.title}</p>
                                            <span className={cn("text-xs px-2 py-1 rounded-full font-medium", forum.color)}>{forum.tag}</span>
                                          </div>
                                          <p className="text-sm text-white/50">{forum.replies} replies • Last active {forum.lastActive}</p>
                                        </div>
                                      </div>
                                      <ChevronRight className={cn("w-6 h-6 transition-all", isItemFocused ? "text-white translate-x-1" : "text-white/30")} />
                                    </motion.div>
                                  );
                                })}
                              </div>
                              <button className="w-full mt-6 py-4 rounded-xl bg-[#107c10]/20 border border-[#107c10]/50 text-[#107c10] font-medium hover:bg-[#107c10]/30 transition-colors flex items-center justify-center gap-2">
                                View Full Forum <ChevronRight className="w-5 h-5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="z-[999] absolute bottom-0 w-full">
            <div className={cn("flex items-center justify-between gap-3 px-6 py-2 backdrop-blur-md border-t border-white/10", isDrawerOpen ? "bg-black" : "bg-black/60")} style={{ fontFamily: "'Livvic', 'Unbounded', Arial, sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
              <button onClick={() => toggleDrawerWithSound()} className="hover:bg-white/10 py-1 px-2 rounded-full transition-colors">
                <div className="flex items-center gap-2">
                  {isConnected && controllerType ? (
                    <ControllerButton controllerType={controllerType} button="menu" size="sm" />
                  ) : (
                    <kbd className="p-1.5 rounded-full bg-white/90 text-black font-bold text-sm shadow-md" style={{ fontFamily: 'Livvic, sans-serif' }}>M</kbd>
                  )}
                  <span className="text-white/90 text-sm font-medium">Menu</span>
                </div>
              </button>
              <button onClick={() => handleOpenGameDetails(selectedGame?.id as string)} className="hover:bg-white/10 py-1 px-2 rounded-full transition-colors">
                <div className="flex items-center gap-2">
                  {isConnected && controllerType ? (
                    <ControllerButton controllerType={controllerType} button="a" size="sm" />
                  ) : (
                    <kbd className="px-3 py-1.5 rounded-full bg-white/90 text-black font-bold uppercase text-sm shadow-md" style={{ fontFamily: 'Google Sans Flex, sans-serif' }}>Enter</kbd>
                  )}
                  <span className="text-white/90 text-sm font-medium">Open</span>
                </div>
              </button>
            </div>
          </div>

          <OverdriveMenu isOpen={isDrawerOpen} onClose={closeDrawerWithSound} items={menuItems} controllerType={controllerType} isControllerConnected={isConnected} />
          <OverdrivePowerDialog open={isPowerDialogOpen} onOpenChange={handlePowerDialogOpenChange} onExitOverdrive={handleExitOverdrive} onExitPoliGame={handleExitPoliGame} onSignOut={isAuthenticated ? handleSignOut : undefined} controllerType={controllerType} isControllerConnected={isConnected} />
          <Toaster />
        </motion.div>
      )}
    </>
  );
};

export default Overdrive;

