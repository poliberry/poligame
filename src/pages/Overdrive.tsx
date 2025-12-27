import React, { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { Power, Settings, User, X, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
// @ts-ignore
import logo from "@/public/poligame-logo.svg";
import { useGameStore } from "@/stores/gameStore";
import { useOverdriveStore } from "@/stores/overdriveStore";
import { Badge } from "@/components/ui/badge";
import { Game } from "@/types";
import { LauncherType } from "@/types";
import { Clock } from "@/components/Clock";
import ControllerButton from "@/components/overdrive/ControllerButton";
import ControllerIcon from "@/components/overdrive/ControllerIcon";
import { useControllerStore, detectControllerType } from "@/stores/controllerStore";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";
import { FaSteam } from "react-icons/fa";
import { SiEpicgames } from "react-icons/si";
import { TbBrandElectronicArts } from "react-icons/tb";
import { SiRockstargames } from "react-icons/si";
// @ts-ignore
import connectionSound from "@/public/sounds/launch.wav";
// @ts-ignore
import disconnectSound from "@/public/sounds/launchNo.wav";
// @ts-ignore
import videoUrl from "@/public/video/overdrive-intro.mp4";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { getImageUrl } from "@/utils/imageUtils";
import { useGameWithCustomizations } from "@/hooks/useGameWithCustomizations";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Trophy } from "lucide-react";
import Marketplace from "./Marketplace";
import Community from "./Community";

// GameItem component
interface GameItemProps {
  game: Game;
  index: number;
  isFocused: boolean;
  onFocus: () => void;
  onLaunch: () => void;
  getLauncherIcon: (launcher: string) => React.ReactNode;
  getLauncherBadgeColor: (launcher: string) => string;
  gameItemRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
}

const GameItem: React.FC<GameItemProps> = ({
  game,
  index,
  isFocused,
  onFocus,
  onLaunch,
  getLauncherIcon,
  getLauncherBadgeColor,
  gameItemRefs,
}) => {
  // Get game with customizations applied
  const displayGame = useGameWithCustomizations(game) || game;
  const coverArt = getImageUrl(displayGame.gridCoverArt || displayGame.coverArt) || "";
  const itemRef = React.useRef<HTMLDivElement>(null);
  
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
        scale: isFocused ? 0.9 : 1,
        opacity: isFocused ? 1 : 0.6,
        width: isFocused ? 280 : 200,
        marginBottom: isFocused ? 0 : 20,
      }}
      transition={{
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
      }}
      className={`relative flex flex-col items-center cursor-pointer z-${isFocused ? 20 : 10} hover:opacity-80`}
      style={{
        outline: "none",
      }}
      onClick={() => {
        onFocus();
      }}
      onDoubleClick={() => onLaunch()}
    >
      {/* Game tile - Xbox style */}
      <motion.div
        className={`relative overflow-hidden rounded-lg shadow-2xl ${
          isFocused
            ? "ring-4 ring-[#107c10] shadow-[#107c10]/50"
            : "ring-2 ring-white/20"
        }`}
        animate={{
          width: isFocused ? 280 : 200,
          height: isFocused ? 380 : 270,
        }}
        transition={{
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1],
        }}
              style={{
                background: coverArt
                  ? `url(${coverArt})`
                  : game.icon
                    ? `url(${getImageUrl(game.icon)})`
                    : "linear-gradient(135deg, #1a1f3a 0%, #0a0e27 100%)",
                backgroundSize: coverArt || game.icon ? "cover" : "100% 100%",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat"
              }}
      >
        {/* Launcher badge - top left */}
        <div
          className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-tight ${getLauncherBadgeColor(
            game.launcher
          )}`}
          style={{
            backdropFilter: "blur(8px)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          {getLauncherIcon(game.launcher)}
          <span>{game.launcher.charAt(0).toUpperCase() + game.launcher.slice(1)}</span>
        </div>
      </motion.div>

      {/* Focus indicator - Xbox style glow */}
      {isFocused && (
        <div
          className="absolute -inset-2 rounded-lg pointer-events-none"
          style={{
            background: "linear-gradient(135deg, rgba(16,124,16,0.3) 0%, rgba(16,124,16,0.1) 100%)",
            filter: "blur(12px)",
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
  const navigate = useNavigate();
  
  // Get selected game with customizations
  const displaySelectedGame = useGameWithCustomizations(selectedGame);

  // Get playtime and achievements data
  // Note: playtime module needs to be added to generated API types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playtimeApi = api as any;
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
  
  const [currentImage, setCurrentImage] = React.useState<string | undefined>(
    getImageUrl(displaySelectedGame?.headerArt)
  );
  const [nextImage, setNextImage] = React.useState<string | undefined>();
  const [isAnimating, setIsAnimating] = React.useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [activeSection, setActiveSection] = React.useState<"library" | "store" | "community">("library");
  const prevGameIdRef = React.useRef<string | undefined>(selectedGame?.id);
  const { controllerType, isConnected, setControllerType, setIsConnected } = useControllerStore();
  const [videoEnded, setVideoEnded] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  
  // Library state and refs
  const [libraryFocusIndex, setLibraryFocusIndex] = React.useState(0);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const gameItemRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollX = useMotionValue(0);
  const lastNavigationTime = React.useRef<number>(0);
  const navigationCooldown = 150;
  const lastStickDirection = React.useRef<"left" | "right" | null>(null);
  const stickHoldStartTime = React.useRef<number>(0);
  const previousControllerConnectedRef = React.useRef<boolean>(false);


  useEffect(() => {
    // Prevent browser back button from leaving Overdrive
    let isHandlingPopState = false;

    const handlePopState = () => {
      if (isHandlingPopState) return;

      // Only prevent if we're trying to go back from Overdrive
      if (window.location.pathname !== '/overdrive') {
        isHandlingPopState = true;
        window.history.pushState(null, '', '/overdrive');
        // Use setTimeout to reset the flag after the state is pushed
        setTimeout(() => {
          isHandlingPopState = false;
        }, 0);
      }
    };

    // Push initial state to prevent back navigation (only if not already on /overdrive)
    if (window.location.pathname !== '/overdrive') {
      window.history.pushState(null, '', '/overdrive');
    }

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const { games, setGames, setLoading } = useGameStore();

  // Initialize library focus index
  React.useEffect(() => {
    if (games.length > 0 && libraryFocusIndex === 0) {
      const game = games[0];
      if (game) {
        setSelectedGame(game);
        setSelectedIndex(0);
      }
    }
  }, [games, libraryFocusIndex, setSelectedGame, setSelectedIndex]);

  // Update store when library focus index changes
  React.useEffect(() => {
    const game = games[libraryFocusIndex];
    if (game) {
      setSelectedGame(game);
      setSelectedIndex(libraryFocusIndex);
    }
  }, [libraryFocusIndex, games, setSelectedGame, setSelectedIndex]);

  // Load games function
  const loadGames = async () => {
    setLoading(true);
    try {
      const gameList = await invoke<Game[]>("get_all_games");
      const normalizedGames = gameList.map((game) => ({
        ...game,
        launcher: game.launcher.toLowerCase() as LauncherType,
      }));
      setGames(normalizedGames);
      console.log("Games refreshed in Overdrive mode");
    } catch (error) {
      console.error("Error loading games in Overdrive mode:", error);
    } finally {
      setLoading(false);
    }
  };

  // Handle controller connection and disconnection
  useEffect(() => {
    // Initialize state - check if controller is already connected on mount
    const gamepads = navigator.getGamepads();
    const connectedGamepad = Array.from(gamepads).find((gp) => gp !== null);
    previousControllerConnectedRef.current = connectedGamepad !== null;
    
    // Update store with initial state
    if (connectedGamepad) {
      setIsConnected(true);
      setControllerType(detectControllerType(connectedGamepad));
    } else {
      setIsConnected(false);
      setControllerType(null);
    }
    
    console.log("Initial controller state:", previousControllerConnectedRef.current ? "Connected" : "Disconnected");

    // Handle controller connection
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
        console.log("Controller connected:", gamepad.id);
        previousControllerConnectedRef.current = true;
        
        // Update store state
        setIsConnected(true);
        setControllerType(detectControllerType(gamepad));
      }
    };

    // Handle controller disconnection
    const handleControllerDisconnect = (e: GamepadEvent) => {
      console.log("Disconnect event fired", e);
      // The gamepad property might be null in some browsers, but the event still fires
      const gamepad = e.gamepad;
      const gamepadId = gamepad?.id || "Unknown Controller";
      const gamepadIndex = gamepad?.index ?? (e as any).gamepad?.index ?? -1;
      
      // Always check current state to verify disconnection
      const currentGamepads = navigator.getGamepads();
      const stillConnected = Array.from(currentGamepads).some((gp) => gp !== null);
      
      console.log("Disconnect check - Previous:", previousControllerConnectedRef.current, "Current:", stillConnected);
      
      // Play sound if we had a controller before OR if no controllers are currently connected
      if (previousControllerConnectedRef.current || !stillConnected) {
        const playDisconnectSound = new Audio(disconnectSound);
        playDisconnectSound.volume = 0.5;
        playDisconnectSound.play();
        toast.error("Controller disconnected", {
          description: `Controller disconnected: ${gamepadId}`,
          duration: 3000,
          position: "bottom-center",
        });
        console.log("Controller disconnected:", gamepadId, "index:", gamepadIndex);
        previousControllerConnectedRef.current = false;
        
        // Update store state
        setIsConnected(false);
        setControllerType(null);
      }
    };

    // Fallback polling to detect disconnections (some browsers don't fire events reliably)
    let lastGamepadCount = Array.from(navigator.getGamepads()).filter((gp) => gp !== null).length;
    const pollInterval = setInterval(() => {
      const currentGamepads = navigator.getGamepads();
      const currentGamepadCount = Array.from(currentGamepads).filter((gp) => gp !== null).length;
      
      // If we had gamepads before and now we don't, trigger disconnect
      if (lastGamepadCount > 0 && currentGamepadCount === 0 && previousControllerConnectedRef.current) {
        console.log("Polling detected disconnection");
        const playDisconnectSound = new Audio(disconnectSound);
        playDisconnectSound.volume = 0.5;
        playDisconnectSound.play();
        toast.error("Controller disconnected", {
          description: "Controller disconnected",
          duration: 3000,
          position: "bottom-center",
        });
        previousControllerConnectedRef.current = false;
        
        // Update store state
        setIsConnected(false);
        setControllerType(null);
      }
      
      // Update count and store state
      if (currentGamepadCount > 0) {
        previousControllerConnectedRef.current = true;
        // Update store if we detect a new connection via polling
        const firstGamepad = Array.from(currentGamepads).find((gp) => gp !== null);
        if (firstGamepad) {
          setIsConnected(true);
          setControllerType(detectControllerType(firstGamepad));
        }
      } else if (currentGamepadCount === 0 && lastGamepadCount > 0) {
        // Just disconnected - already handled above, but ensure store is updated
        setIsConnected(false);
        setControllerType(null);
      }
      lastGamepadCount = currentGamepadCount;
    }, 1000); // Check every second

    // Listen for controller connection
    window.addEventListener("gamepadconnected", handleControllerConnect);
    
    // Listen for controller disconnection
    window.addEventListener("gamepaddisconnected", handleControllerDisconnect);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("gamepadconnected", handleControllerConnect);
      window.removeEventListener("gamepaddisconnected", handleControllerDisconnect);
    };
  }, []);

  // Periodic updates: Refresh games every 15 minutes
  useEffect(() => {
    // Load games initially
    loadGames();

    // Set up interval to refresh games every 15 minutes (900000 ms)
    const gamesInterval = setInterval(() => {
      console.log("Refreshing games in Overdrive mode (15min interval)");
      loadGames();
    }, 15 * 60 * 1000); // 15 minutes

    return () => {
      clearInterval(gamesInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount


  // Handle image transition when game changes (using customized artwork)
  useEffect(() => {
    const headerArt = displaySelectedGame?.headerArt;
    if (selectedGame?.id !== prevGameIdRef.current && headerArt) {
      // Set the next image and trigger animation
      const processedHeaderArt = getImageUrl(headerArt);
      setNextImage(processedHeaderArt);
      setIsAnimating(true);

      // After animation completes, update current image
      const timer = setTimeout(() => {
        setCurrentImage(processedHeaderArt);
        setNextImage(undefined);
        setIsAnimating(false);
        if (selectedGame) {
          prevGameIdRef.current = selectedGame.id;
        }
      }, 600); // Match animation duration

      return () => clearTimeout(timer);
    } else if (headerArt && !currentImage && selectedGame) {
      // Initial load
      setCurrentImage(getImageUrl(headerArt));
      prevGameIdRef.current = selectedGame.id;
    }
  }, [selectedGame?.id, displaySelectedGame?.headerArt, currentImage]);

  const handleExitOverdrive = async () => {
    try {
      await invoke("exit_overdrive_mode");
      setIsDrawerOpen(false);
      // Navigate back to main library
      navigate("/");
    } catch (error) {
      console.error("Failed to exit Overdrive mode:", error);
    }
  };

  const handleExitPoliGame = async () => {
    try {
      await invoke("exit_overdrive_mode");
      await invoke("close_window");
    } catch (error) {
      console.error("Failed to exit PoliGame:", error);
    }
  };

  const handleOpenAccountDetails = async () => {
    try {
      await invoke("create_account_details_window");
      setIsDrawerOpen(false);
    } catch (error) {
      console.error("Failed to open account details:", error);
    }
  };

  const handleOpenSettings = () => {
    setIsDrawerOpen(false);
    navigate("/settings");
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setIsDrawerOpen(false);
      navigate("/auth");
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  // Navigation function for library
  const navigateLibrary = React.useCallback((direction: "next" | "prev") => {
    const now = Date.now();
    if (now - lastNavigationTime.current < navigationCooldown) {
      return;
    }
    lastNavigationTime.current = now;

    setLibraryFocusIndex((cur) => {
      const newIndex = direction === "next" 
        ? (cur + 1) % games.length 
        : (cur - 1 + games.length) % games.length;
      const game = games[newIndex];
      if (game) {
        setSelectedGame(game);
        setSelectedIndex(newIndex);
      }
      return newIndex;
    });
  }, [games, setSelectedGame, setSelectedIndex]);

  // Handle launch game
  const handleLaunchGame = async (gameId: string) => {
    try {
      // Close drawer if open when launching game
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
      }
      await invoke("launch_game", { gameId });
    } catch (error) {
      console.error("Failed to launch game:", error);
    }
  };

  // Get launcher icon component
  const getLauncherIcon = (launcher: string) => {
    switch (launcher.toLowerCase()) {
      case "steam":
        return <FaSteam size={16} />;
      case "epic":
        return <SiEpicgames size={16} />;
      case "ea":
        return <TbBrandElectronicArts size={16} />;
      case "rockstar":
        return <SiRockstargames size={16} />;
      default:
        return null;
    }
  };

  // Get launcher badge color
  const getLauncherBadgeColor = (launcher: string) => {
    switch (launcher.toLowerCase()) {
      case "steam":
        return "bg-[#1b2838] text-white";
      case "epic":
        return "bg-black text-white";
      case "ea":
        return "bg-[#6e34eb] text-white";
      case "rockstar":
        return "bg-[#ff0000] text-white";
      default:
        return "bg-gray-600 text-white";
    }
  };

  // Auto-scroll to focused game when focusIndex changes
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
        onUpdate: (latest) => {
          if (scrollContainer) {
            scrollContainer.scrollLeft = latest;
          }
        },
      });
    }
  }, [libraryFocusIndex, scrollX]);

  // Controller support - consolidated into one hook
  useResponsiveGamepad({
    onButtonDown: (button) => {
      // START/Menu button to toggle drawer
      if (button === "START") {
        setIsDrawerOpen((prev) => !prev);
      }
      // Button A (Xbox) or X (PlayStation) - Launch game (only in library section)
      else if ((button === "A" || button === "A") && activeSection === "library") {
        const game = games[libraryFocusIndex];
        if (game) {
          handleLaunchGame(game.id);
        }
      }
      // LB - Navigate previous (only in library section)
      else if (button === "LB" && activeSection === "library") {
        navigateLibrary("prev");
      }
      // RB - Navigate next (only in library section)
      else if (button === "RB" && activeSection === "library") {
        navigateLibrary("next");
      }
    },
    onDPad: (direction) => {
      // D-Pad Up/Down for section navigation: library -> store -> community -> library
      if (direction === "DOWN") {
        if (activeSection === "library") {
          setActiveSection("store");
        } else if (activeSection === "store") {
          setActiveSection("community");
        }
      } else if (direction === "UP") {
        if (activeSection === "community") {
          setActiveSection("store");
        } else if (activeSection === "store") {
          setActiveSection("library");
        }
      }
      // D-Pad Left/Right for game navigation (only in library section)
      else if (direction === "LEFT" && activeSection === "library") {
        navigateLibrary("prev");
      } else if (direction === "RIGHT" && activeSection === "library") {
        navigateLibrary("next");
      }
    },
    onLeftStick: (x) => {
      if (activeSection !== "library") return;
      
      const now = Date.now();
      const deadzone = 0.3;
      
      if (Math.abs(x) > deadzone) {
        const direction = x > 0 ? "right" : "left";
        
        if (lastStickDirection.current !== direction) {
          lastStickDirection.current = direction;
          stickHoldStartTime.current = now;
          navigateLibrary(direction === "right" ? "next" : "prev");
        } else {
          const holdCooldown = now - stickHoldStartTime.current > 500 ? 400 : 1000;
          if (now - lastNavigationTime.current >= holdCooldown) {
            navigateLibrary(direction === "right" ? "next" : "prev");
          }
        }
      } else {
        lastStickDirection.current = null;
        stickHoldStartTime.current = 0;
      }
    },
  });

  // Keyboard support for drawer, section navigation, and library navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      // Handle section navigation with ArrowUp/Down: library -> store -> community -> library
      if (e.key === "ArrowDown") {
        if (activeSection === "library") {
          setActiveSection("store");
        } else if (activeSection === "store") {
          setActiveSection("community");
        }
        e.preventDefault();
        return;
      }
      if (e.key === "ArrowUp") {
        if (activeSection === "community") {
          setActiveSection("store");
        } else if (activeSection === "store") {
          setActiveSection("library");
        }
        e.preventDefault();
        return;
      }
      
      // Library navigation (only when in library section)
      if (activeSection === "library") {
        if (["ArrowRight", "d", "D"].includes(e.key)) {
          navigateLibrary("next");
          e.preventDefault();
          return;
        } else if (["ArrowLeft", "a", "A"].includes(e.key)) {
          navigateLibrary("prev");
          e.preventDefault();
          return;
        } else if (e.key === "Enter" || e.key === " ") {
          const game = games[libraryFocusIndex];
          if (game) {
            handleLaunchGame(game.id);
          }
          e.preventDefault();
          return;
        }
      }
      
      // Escape key to close drawer
      if (e.key === "Escape" && isDrawerOpen) {
        setIsDrawerOpen(false);
        return;
      }
      // M key to toggle drawer
      if (e.key === "m" || e.key === "M") {
        setIsDrawerOpen((prev) => !prev);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDrawerOpen, activeSection, libraryFocusIndex, games, navigateLibrary, handleLaunchGame]);

  // Handle video end
  const handleVideoEnd = () => {
    setVideoEnded(true);
  };

  // Request fullscreen for video and handle playback
  React.useEffect(() => {
    if (videoRef.current && !videoEnded) {
      const video = videoRef.current;
      
      // Prevent keyboard shortcuts from pausing video
      const handleKeyDown = (e: KeyboardEvent) => {
        // Prevent spacebar, arrow keys, and other media keys from pausing
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' || 
            e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'MediaPlayPause') {
          e.preventDefault();
          e.stopPropagation();
          // Force video to continue playing
          if (video.paused) {
            video.play();
          }
        }
      };
      
      // Prevent context menu (right-click)
      const handleContextMenu = (e: MouseEvent) => {
        e.preventDefault();
      };
      
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('contextmenu', handleContextMenu);
      
      // Play video
      video.play().catch((error) => {
        console.error("Error playing video:", error);
        // If video fails to play, skip to content after a delay
        setTimeout(() => {
          setVideoEnded(true);
        }, 1000);
      });
      
      // Continuously check if video is paused and resume it
      const checkVideoPlaying = setInterval(() => {
        if (video.paused && !videoEnded) {
          video.play();
        }
      }, 100);
      
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('contextmenu', handleContextMenu);
        clearInterval(checkVideoPlaying);
      };
    }
  }, [videoEnded]);

  // Keep fullscreen after video ends - don't exit fullscreen

  // Fallback: if video doesn't load, skip after 5 seconds
  React.useEffect(() => {
    if (!videoEnded) {
      const timer = setTimeout(() => {
        setVideoEnded(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [videoEnded]);

  // Show video first, then content
  return (
    <>
      {/* Video */}
      {!videoEnded && (
        <div className="fixed inset-0 w-full h-screen bg-black flex items-center justify-center overflow-hidden z-[200]">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            onEnded={handleVideoEnd}
            onError={() => {
              console.error("Video failed to load");
              setVideoEnded(true);
            }}
            onContextMenu={(e) => e.preventDefault()}
            onPause={(e) => {
              // Prevent pausing - immediately resume
              e.currentTarget.play();
            }}
            playsInline
            muted={false}
            autoPlay
            controls={false}
            disablePictureInPicture
            disableRemotePlayback
          >
            <source src={videoUrl} type="video/mp4" />
            Your browser does not support the video tag.
          </video>
        </div>
      )}

      {/* Content with fade in animation - only show after video ends */}
      {videoEnded && (
        <motion.div
          className="w-full h-screen bg-black text-white overflow-hidden"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
        >
      <style>{`
        @keyframes fade-pop-in {
          from {
            opacity: 0;
            transform: scale(1.05);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes fade-out {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.95);
          }
        }
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-fade-pop-in {
          animation: fade-pop-in 0.6s ease-out forwards;
        }
        .animate-fade-out {
          animation: fade-out 0.6s ease-in forwards;
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out forwards;
        }
      `}</style>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Livvic:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,900&family=Unbounded:wght@200..900&display=swap" rel="stylesheet" />
      {/* Overdrive Header Bar */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <img src={logo} alt="PoliGame" className="w-8 h-8" />
        </div>
        <div className="flex items-center gap-4">
          {/* Clock */}
          <Clock showSeconds={false} className="flex items-center" />
          
          {isAuthenticated && user && (
            <div className="flex items-center gap-2">
              {user.avatar ? (
                <img src={user.avatar} alt="User Avatar" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-xs font-bold">
                    {(user.username || user.email || "U")[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-sm" style={{ fontFamily: 'Livvic, sans-serif' }}>
                {user.username || user.email}
              </span>
            </div>
          )}
          <Button
            onClick={() => setIsDrawerOpen(true)}
            variant="ghost"
            className="flex items-center gap-2 dark"
          >
            <Power className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div
        className="relative w-full h-full overflow-hidden"
      >
        {/* Background images with Framer Motion */}
        <AnimatePresence>
          {/* Current image - fades out when animating */}
          {(currentImage || !displaySelectedGame?.headerArt) && (
            <motion.div
              key={`current-${currentImage || 'default'}`}
              initial={{ opacity: 1, scale: 1 }}
              animate={{ 
                opacity: isAnimating ? 0 : 1, 
                scale: isAnimating ? 0.95 : 1 
              }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute inset-0"
              style={{
                backgroundImage: currentImage 
                  ? `url(${currentImage})`
                  : displaySelectedGame?.gridCoverArt || displaySelectedGame?.coverArt
                    ? `url(${getImageUrl(displaySelectedGame?.gridCoverArt || displaySelectedGame?.coverArt)})`
                    : "linear-gradient(135deg, #1a1f3a 0%, #0a0e27 100%)",
                backgroundSize: currentImage || displaySelectedGame?.gridCoverArt || displaySelectedGame?.coverArt ? "cover" : "100% 100%",
                backgroundPosition: "center",
              }}
            />
          )}
          {/* Next image - fades in when animating */}
          {isAnimating && nextImage && (
            <motion.div
              key={`next-${nextImage}`}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${nextImage || ''})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                zIndex: 2,
              }}
            />
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-black/50 w-full h-full z-[30]">
          <div className="w-full h-full bg-gradient-to-b from-transparent to-green-900">
            <motion.div
              key={selectedGame?.id}
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="flex items-center gap-4 h-full px-21 pb-12"
            >
              {displaySelectedGame?.gridCoverArt || displaySelectedGame?.coverArt || displaySelectedGame?.icon ? (
                <img 
                  src={getImageUrl(displaySelectedGame?.gridCoverArt || displaySelectedGame?.coverArt || displaySelectedGame?.icon) || ''} 
                  alt="Game Logo" 
                  className="w-28 rounded"
                  onError={(e) => {
                    // Fallback to default image if all fail
                    e.currentTarget.src = '/default-game-icon.png';
                  }}
                />
              ) : (
                <div className="w-28 h-28 rounded bg-white/10 flex items-center justify-center">
                  <span className="text-4xl font-bold">
                    {(displaySelectedGame?.title || '?')[0]?.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex flex-col justify-center">
                <h1 className="text-4xl font-bold uppercase italic" style={{ fontFamily: 'Unbounded, sans-serif' }}>{displaySelectedGame?.title}</h1>
                <p className="text-sm text-gray-400 flex gap-2 items-center mt-2">
                  {displaySelectedGame?.launcher && (
                    <Badge variant="default" className="text-md dark">
                      {displaySelectedGame.launcher.charAt(0).toUpperCase() + displaySelectedGame.launcher.slice(1)}
                    </Badge>
                  )}
                </p>
                {/* Last Played and Achievements */}
                <div className="flex gap-4 items-center mt-3">
                  {playtimeData && playtimeData.lastPlayed && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-300">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Last played: {new Date(playtimeData.lastPlayed).toLocaleDateString()}</span>
                    </div>
                  )}
                  {displaySelectedGame?.launcher === "steam" && achievements.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-300">
                      <Trophy className="h-3.5 w-3.5" />
                      <span>
                        {achievements.filter((a) => a.unlocked).length} / {achievements.length} achievements
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
        
        {/* Library Section - Always accessible */}
        <div className="absolute inset-0 z-[31]" style={{ paddingTop: '75px' }}>
          <div className="relative w-full h-full flex flex-col z-[30]">
            {/* Main content area - Xbox style horizontal scrolling tiles */}
            <div className="flex-1 flex items-end justify-center pb-16 px-8">
              <div 
                ref={scrollContainerRef}
                className="w-full max-w-[95%] overflow-x-auto overflow-y-hidden no-scrollbar"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
                onScroll={(e) => {
                  scrollX.set(e.currentTarget.scrollLeft);
                }}
              >
                <style>{`
                  .no-scrollbar::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>
                <div
                  className="flex gap-6 items-end"
                  style={{
                    paddingBottom: "20px",
                  }}
                >
                  {games.map((game, idx) => (
                    <GameItem
                      key={game.id}
                      game={game}
                      index={idx}
                      isFocused={idx === libraryFocusIndex}
                      onFocus={() => {
                        setLibraryFocusIndex(idx);
                        setSelectedGame(game);
                        setSelectedIndex(idx);
                      }}
                      onLaunch={() => handleLaunchGame(game.id)}
                      getLauncherIcon={getLauncherIcon}
                      getLauncherBadgeColor={getLauncherBadgeColor}
                      gameItemRefs={gameItemRefs}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Navigation hints - bottom center */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-none select-none">
              <div
                className="flex items-center gap-3 px-6 py-3 bg-black/80 rounded-lg backdrop-blur-md border border-white/10"
                style={{
                  fontFamily: "'Livvic', 'Unbounded', Arial, sans-serif",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                }}
              >
                {/* Launch button */}
                <div className="flex items-center gap-2">
                  {isConnected && controllerType ? (
                    <ControllerButton 
                      controllerType={controllerType} 
                      button="a" 
                      size="sm" 
                    />
                  ) : (
                    <kbd className="px-3 py-1.5 rounded bg-white/90 text-black font-bold text-sm shadow-md" style={{ fontFamily: 'Livvic, sans-serif' }}>
                      Enter
                    </kbd>
                  )}
                  <span className="text-white/90 text-sm font-medium">Launch</span>
                </div>
                <div className="flex items-center gap-2">
                  {isConnected && controllerType ? (
                    <ControllerButton controllerType={controllerType} button="menu" size="sm" />
                  ) : (
                    <kbd className="px-3 py-1.5 rounded bg-white/90 text-black font-bold text-sm shadow-md" style={{ fontFamily: 'Livvic, sans-serif' }}>
                      M
                    </kbd>
                  )}
                  <span className="text-white/90 text-sm font-medium">Menu</span>
                </div>
                <div className="w-px h-6 bg-white/20" />
                {/* Navigation buttons */}
                <div className="flex items-center gap-2" style={{ fontFamily: 'Livvic, sans-serif' }}>
                  {isConnected && controllerType ? (
                    <>
                      <ControllerButton controllerType={controllerType} button="lb" size="sm" />
                      <ControllerButton controllerType={controllerType} button="rb" size="sm" />
                    </>
                  ) : (
                    <>
                      <kbd className="px-3 py-1.5 rounded bg-white/80 text-black font-mono font-bold text-sm shadow-md">
                        ←
                      </kbd>
                      <kbd className="px-3 py-1.5 rounded bg-white/80 text-black font-mono font-bold text-sm shadow-md">
                        →
                      </kbd>
                    </>
                  )}
                  <span className="text-white/90 text-sm font-medium">Navigate</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Store Section - Slides on top with push effect */}
        <section 
          className={`fixed top-0 left-0 right-0 w-full h-full bg-black/95 backdrop-blur-xl border-t border-white/10 transition-transform duration-500 ${
            activeSection === "store" ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ 
            zIndex: 32,
          }}
        >
          <div className="flex flex-col h-full w-full">
            <div className="flex-1 w-full">
              <Marketplace />
            </div>
          </div>
        </section>

        {/* Community Section - Slides on top with push effect */}
        <section 
          className={`fixed top-0 left-0 right-0 w-full h-full bg-black/95 backdrop-blur-xl border-t border-white/10 transition-transform duration-500 ${
            activeSection === "community" ? "translate-y-0" : "translate-y-full"
          }`}
          style={{ 
            zIndex: 33,
          }}
        >
          <div className="flex flex-col h-full w-full">
            <div className="flex-1 w-full">
              <Community />
            </div>
          </div>
        </section>
      </div>

      {/* Drawer Overlay */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[100] transition-opacity duration-300"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Clock on left side when drawer is open */}
      {isDrawerOpen && (
        <div className={`fixed right-96 top-0 h-full w-64 z-[102] flex items-start justify-center pt-6 transition-transform duration-300 ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}>
          <Clock showSeconds={true} className="flex flex-col items-center" />
        </div>
      )}

      {/* Drawer from right */}
      <div
        className={`fixed top-0 right-0 h-full w-96 bg-black/95 backdrop-blur-xl border-l border-white/10 z-[101] transition-transform duration-300 ${
          isDrawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          fontFamily: "'Livvic', 'Unbounded', Arial, sans-serif",
        }}
      >
        <div className="flex flex-col h-full">
          {/* Drawer Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="text-2xl font-bold uppercase italic" style={{ fontFamily: 'Unbounded, sans-serif' }}>
              Menu
            </h2>
            <Button
              onClick={() => setIsDrawerOpen(false)}
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Profile Section */}
            {isAuthenticated && user && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold uppercase text-white/80" style={{ fontFamily: 'Unbounded, sans-serif' }}>
                  Profile
                </h3>
                <div className="flex items-center gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt="User Avatar"
                      className="w-16 h-16 rounded-full border-2 border-white/20"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/20 flex items-center justify-center">
                      <span className="text-2xl font-bold">
                        {(user.username || user.email || "U")[0]?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-semibold truncate" style={{ fontFamily: 'Livvic, sans-serif' }}>
                      {user.username || user.email}
                    </p>
                    <p className="text-sm text-white/60 truncate">{user.email}</p>
                  </div>
                </div>
                <Button
                  onClick={handleOpenAccountDetails}
                  variant="outline"
                  className="w-full justify-start gap-3 bg-white/5 border-white/10 hover:bg-white/10"
                >
                  <User className="w-4 h-4" />
                  Manage Profile
                </Button>
              </div>
            )}

            {/* Settings Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold uppercase text-white/80" style={{ fontFamily: 'Unbounded, sans-serif' }}>
                Settings
              </h3>
              <Button
                onClick={handleOpenSettings}
                variant="outline"
                className="w-full justify-start gap-3 bg-white/5 border-white/10 hover:bg-white/10"
              >
                <Settings className="w-4 h-4" />
                Settings
              </Button>
            </div>

            {/* Power Options Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold uppercase text-white/80" style={{ fontFamily: 'Unbounded, sans-serif' }}>
                Power Options
              </h3>
              <div className="space-y-2">
                <Button
                  onClick={handleExitOverdrive}
                  variant="outline"
                  className="w-full justify-start gap-3 bg-white/5 border-white/10 hover:bg-white/10 hover:border-[#107c10]"
                >
                  <Power className="w-4 h-4" />
                  Exit Overdrive Mode
                </Button>
                <Button
                  onClick={handleExitPoliGame}
                  variant="outline"
                  className="w-full justify-start gap-3 bg-white/5 border-white/10 hover:bg-white/10 hover:border-red-500/50"
                >
                  <LogOut className="w-4 h-4" />
                  Exit PoliGame
                </Button>
                {isAuthenticated && (
                  <Button
                    onClick={handleSignOut}
                    variant="outline"
                    className="w-full justify-start gap-3 bg-white/5 border-white/10 hover:bg-white/10 hover:border-red-500/50"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Toaster />
        </motion.div>
      )}
    </>
  );
};

export default Overdrive;

