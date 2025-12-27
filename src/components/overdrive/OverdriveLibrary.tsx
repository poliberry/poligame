import { Game } from "@/types";
import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { FaSteam } from "react-icons/fa";
import { SiEpicgames } from "react-icons/si";
import { TbBrandElectronicArts } from "react-icons/tb";
import { SiRockstargames } from "react-icons/si";
import { useOverdriveStore } from "@/stores/overdriveStore";
import { useControllerStore } from "@/stores/controllerStore";
import ControllerButton from "./ControllerButton";
import { motion, useMotionValue, animate } from "framer-motion";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";

interface OverdriveLibraryProps {
  games: Game[];
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}

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

// Separate component for game items
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
  const coverArt = game.gridCoverArt || game.coverArt || "";
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
        ease: [0.4, 0, 0.2, 1], // Custom cubic-bezier for smoother animation
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
            : "linear-gradient(135deg, #1a1f3a 0%, #0a0e27 100%)",
          backgroundSize: "100% 100%",
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

const OverdriveLibrary: React.FC<OverdriveLibraryProps> = ({
  games,
  selectedIndex = 0,
  onSelect,
}) => {
  const { setSelectedGame, setSelectedIndex } = useOverdriveStore();
  const { controllerType, isConnected } = useControllerStore();
  const [focusIndex, setFocusIndex] = React.useState(selectedIndex);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const gameItemRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollX = useMotionValue(0);

  // Initialize and update store when focus index changes
  React.useEffect(() => {
    setFocusIndex(selectedIndex);
  }, [selectedIndex]);

  React.useEffect(() => {
    const game = games[focusIndex];
    if (game) {
      setSelectedGame(game);
      setSelectedIndex(focusIndex);
    }
  }, [focusIndex, games, setSelectedGame, setSelectedIndex]);

  // Handle navigation with cooldown
  const lastNavigationTime = React.useRef<number>(0);
  const navigationCooldown = 150; // ms between navigations
  const lastStickDirection = React.useRef<"left" | "right" | null>(null);
  const stickHoldStartTime = React.useRef<number>(0);

  const navigateTo = React.useCallback((direction: "next" | "prev") => {
    const now = Date.now();
    if (now - lastNavigationTime.current < navigationCooldown) {
      console.log("Navigation cooldown active, skipping");
      return;
    }
    lastNavigationTime.current = now;

    console.log("Navigating", direction, "games length", games.length);

    setFocusIndex((cur) => {
      const newIndex = direction === "next" 
        ? (cur + 1) % games.length 
        : (cur - 1 + games.length) % games.length;
      console.log("Setting focus index from", cur, "to", newIndex);
      onSelect?.(newIndex);
      const game = games[newIndex];
      if (game) {
        console.log("Updating selected game to", game.title);
        setSelectedGame(game);
        setSelectedIndex(newIndex);
      }
      return newIndex;
    });
  }, [games, onSelect, setSelectedGame, setSelectedIndex]);

  // Controller support using responsive-gamepad
  // Use useRef to store the latest navigateTo function to avoid closure issues
  const navigateToRef = React.useRef(navigateTo);
  React.useEffect(() => {
    navigateToRef.current = navigateTo;
  }, [navigateTo]);

  // Use refs for callbacks to avoid closure issues
  const onButtonDownRef = React.useRef<(button: string) => void>();
  const onDPadRef = React.useRef<(direction: "UP" | "DOWN" | "LEFT" | "RIGHT") => void>();
  const handleLaunchGameRef = React.useRef<((gameId: string) => Promise<void>) | null>(null);
  const gamesRef = React.useRef(games);
  const focusIndexRef = React.useRef(focusIndex);

  React.useEffect(() => {
    gamesRef.current = games;
    focusIndexRef.current = focusIndex;
  }, [games, focusIndex]);

  useResponsiveGamepad({
    onButtonDown: (button) => {
      console.log("[OverdriveLibrary] onButtonDown called with:", button);
      if (onButtonDownRef.current) {
        onButtonDownRef.current(button);
      }
    },
    onLeftStick: (x) => {
      const now = Date.now();
      const deadzone = 0.3;
      
      // Check if stick is being held in a direction
      if (Math.abs(x) > deadzone) {
        const direction = x > 0 ? "right" : "left";
        
        // If direction changed, reset and navigate immediately
        if (lastStickDirection.current !== direction) {
          lastStickDirection.current = direction;
          stickHoldStartTime.current = now;
          navigateTo(direction === "right" ? "next" : "prev");
        } else {
          // If holding, use slower cooldown (400ms) for continuous scrolling
          const holdCooldown = now - stickHoldStartTime.current > 500 ? 400 : 1000;
          if (now - lastNavigationTime.current >= holdCooldown) {
            navigateTo(direction === "right" ? "next" : "prev");
          }
        }
      } else {
        // Stick returned to center
        lastStickDirection.current = null;
        stickHoldStartTime.current = 0;
      }
    },
    onDPad: (direction) => {
      console.log("[OverdriveLibrary] onDPad called with:", direction);
      if (onDPadRef.current) {
        onDPadRef.current(direction);
      }
    },
  });

  // Keyboard support
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (["ArrowRight", "d", "D"].includes(e.key)) {
        navigateTo("next");
      } else if (["ArrowLeft", "a", "A"].includes(e.key)) {
        navigateTo("prev");
      } else if (e.key === "Enter" || e.key === " ") {
        const game = games[focusIndex];
        if (game) {
          handleLaunchGame(game.id);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [focusIndex, games, navigateTo]);

  // Auto-scroll to focused game when focusIndex changes using Framer Motion
  React.useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const focusedElement = gameItemRefs.current.get(focusIndex);
    
    if (scrollContainer && focusedElement) {
      const containerWidth = scrollContainer.offsetWidth;
      const elementLeft = focusedElement.offsetLeft;
      const elementWidth = focusedElement.offsetWidth;
      
      // Calculate scroll position to center the focused game
      const targetScrollLeft = elementLeft - (containerWidth / 2) + (elementWidth / 2);
      
      // Animate scroll using Framer Motion
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
  }, [focusIndex, scrollX]);


  const handleLaunchGame = async (gameId: string) => {
    try {
      await invoke("launch_game", { gameId });
    } catch (error) {
      console.error("Failed to launch game:", error);
    }
  };

  // Set up callback refs after handleLaunchGame is defined
  React.useEffect(() => {
    handleLaunchGameRef.current = handleLaunchGame;
    
    onButtonDownRef.current = (button: string) => {
      // Button A (Xbox) or X (PlayStation) - Launch game
      if (button === "A" || button === "X") {
        const game = gamesRef.current[focusIndexRef.current];
        if (game && handleLaunchGameRef.current) {
          handleLaunchGameRef.current(game.id);
        }
      }
      // LB - Navigate previous
      if (button === "LB") {
        console.log("[OverdriveLibrary] LB button detected, navigating previous");
        if (typeof navigateToRef.current === "function") {
          navigateToRef.current("prev");
        }
      }
      // RB - Navigate next
      if (button === "RB") {
        console.log("[OverdriveLibrary] RB button detected, navigating next");
        if (typeof navigateToRef.current === "function") {
          navigateToRef.current("next");
        }
      }
    };

    onDPadRef.current = (direction: "UP" | "DOWN" | "LEFT" | "RIGHT") => {
      console.log("[OverdriveLibrary] D-Pad pressed:", direction);
      if (direction === "LEFT") {
        console.log("[OverdriveLibrary] D-Pad LEFT - navigating previous");
        if (typeof navigateToRef.current === "function") {
          navigateToRef.current("prev");
        }
      } else if (direction === "RIGHT") {
        console.log("[OverdriveLibrary] D-Pad RIGHT - navigating next");
        if (typeof navigateToRef.current === "function") {
          navigateToRef.current("next");
        }
      }
    };
  }, [handleLaunchGame]);

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

  if (games.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <p className="text-white/60 text-lg">No games found</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full flex flex-col z-[30]">

      {/* Main content area - Xbox style horizontal scrolling tiles */}
      <div className="flex-1 flex items-end justify-center pb-16 px-8">
        <div 
          ref={scrollContainerRef}
          className="w-full max-w-[95%] overflow-x-auto overflow-y-hidden no-scrollbar"
          style={{
            scrollbarWidth: 'none', /* Firefox */
            msOverflowStyle: 'none', /* IE and Edge */
          }}
          onScroll={(e) => {
            scrollX.set(e.currentTarget.scrollLeft);
          }}
        >
          <style>{`
            .no-scrollbar::-webkit-scrollbar {
              display: none; /* Chrome, Safari, Opera */
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
                isFocused={idx === focusIndex}
                onFocus={() => {
                  setFocusIndex(idx);
                  onSelect?.(idx);
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
                button={controllerType === "playstation" ? "x" : "a"} 
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
  );
};

export default OverdriveLibrary;
