import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { Clock } from "@/components/Clock";
import { useAuthStore } from "@/stores/authStore";
import { useGameStore } from "@/stores/gameStore";
import { useOverdriveStore } from "@/stores/overdriveStore";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";
import { cn } from "@/lib/utils";
import { Game } from "@/types";
import { getImageUrl } from "@/utils/imageUtils";
import { Battery, Search, Settings2, Wifi } from "lucide-react";
// @ts-ignore
import moveSound from "@/public/sounds/move.wav";
// @ts-ignore
import errMoveSound from "@/public/sounds/errMove.wav";
// @ts-ignore
import menuOpenSound from "@/public/sounds/menuOpen.wav";
// @ts-ignore
import menuCloseSound from "@/public/sounds/menuClose.wav";

interface OverdriveTopBarProps {
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  onSearchSubmit?: () => void;
  className?: string;
  rightSlot?: React.ReactNode;
}

interface BrowserBatteryManager {
  level: number;
  charging: boolean;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
}

interface NavigatorWithBattery extends Navigator {
  getBattery?: () => Promise<BrowserBatteryManager>;
}

const LAUNCHER_ORDER = ["steam", "epic", "ea", "rockstar", "custom"];

const formatLauncherLabel = (launcher: string): string => {
  const normalized = (launcher || "unknown").toLowerCase();
  if (normalized === "ea") return "EA";
  if (normalized === "epic") return "Epic Games";
  if (normalized === "rockstar") return "Rockstar";
  if (normalized === "custom") return "Custom";
  if (normalized === "steam") return "Steam";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const OverdriveTopBar: React.FC<OverdriveTopBarProps> = ({
  searchQuery = "",
  onSearchQueryChange,
  onSearchSubmit,
  className,
  rightSlot,
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { games, setGames } = useGameStore();
  const { showBatteryIndicator, isTopBarFocused, setTopBarFocused } = useOverdriveStore();
  const [isSearchActive, setIsSearchActive] = React.useState(false);
  const [isNetworkOpen, setIsNetworkOpen] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState<boolean>(navigator.onLine);
  const [batteryLevel, setBatteryLevel] = React.useState<number | null>(null);
  const [isCharging, setIsCharging] = React.useState(false);
  const [focusedItemIndex, setFocusedItemIndex] = React.useState(0);
  const [isLoadingGames, setIsLoadingGames] = React.useState(false);
  const [libraryFocusIndex, setLibraryFocusIndex] = React.useState(0);
  const lastControllerNavRef = React.useRef(0);
  const lastLibraryControllerNavRef = React.useRef(0);
  const searchInputRef = React.useRef<HTMLInputElement | null>(null);
  const searchModalRef = React.useRef<HTMLDivElement | null>(null);
  const moveAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const errMoveAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const menuOpenAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const menuCloseAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const topBarItems = React.useMemo(() => {
    const items = [
      { id: "search" },
      { id: "network" },
    ];

    if (showBatteryIndicator) {
      items.push({ id: "battery" });
    }

    items.push({ id: "settings" });
    return items;
  }, [showBatteryIndicator]);

  React.useEffect(() => {
    if (games.length > 0) {
      return;
    }

    let cancelled = false;

    const loadGames = async () => {
      setIsLoadingGames(true);
      try {
        const gameList = await invoke<Game[]>("get_all_games");
        if (cancelled) {
          return;
        }
        const normalized = gameList.map((game) => ({
          ...game,
          launcher: String(game.launcher || "custom").toLowerCase(),
        }));
        setGames(normalized);
      } catch (error) {
        console.error("Failed to load games for topbar search:", error);
      } finally {
        if (!cancelled) {
          setIsLoadingGames(false);
        }
      }
    };

    void loadGames();

    return () => {
      cancelled = true;
    };
  }, [games.length, setGames]);

  const filteredGames = React.useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return [] as Game[];
    }

    return games
      .filter((game) => {
        const title = game.title?.toLowerCase() || "";
        const launcher = String(game.launcher || "").toLowerCase();
        const developer = game.developer?.toLowerCase() || "";
        const publisher = game.publisher?.toLowerCase() || "";
        return title.includes(query) || launcher.includes(query) || developer.includes(query) || publisher.includes(query);
      })
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [games, searchQuery]);

  const groupedFilteredGames = React.useMemo(() => {
    const byLauncher = new Map<string, Game[]>();
    filteredGames.forEach((game) => {
      const key = String(game.launcher || "custom").toLowerCase();
      const list = byLauncher.get(key) || [];
      list.push(game);
      byLauncher.set(key, list);
    });

    const orderedKeys = [
      ...LAUNCHER_ORDER.filter((launcher) => byLauncher.has(launcher)),
      ...Array.from(byLauncher.keys()).filter((launcher) => !LAUNCHER_ORDER.includes(launcher)),
    ];

    return orderedKeys.map((launcher) => ({
      launcher,
      games: (byLauncher.get(launcher) || []).slice(0, 12),
    }));
  }, [filteredGames]);

  const modalGames = React.useMemo(() => {
    return groupedFilteredGames.flatMap((group) => group.games);
  }, [groupedFilteredGames]);

  const isSearchInputFocused = React.useMemo(() => {
    return document.activeElement === searchInputRef.current;
  }, [isSearchActive, searchQuery, isTopBarFocused]);

  const isLibraryModalOpen = React.useMemo(() => {
    return isSearchActive && isTopBarFocused && searchQuery.trim().length > 0;
  }, [isSearchActive, isTopBarFocused, searchQuery]);

  React.useEffect(() => {
    setLibraryFocusIndex(0);
  }, [searchQuery]);

  React.useEffect(() => {
    setLibraryFocusIndex((current) => {
      if (!modalGames.length) {
        return 0;
      }
      return Math.min(current, modalGames.length - 1);
    });
  }, [modalGames]);

  const isSearchSelectedInTopBar = React.useMemo(() => {
    if (!isTopBarFocused) {
      return false;
    }
    return topBarItems[focusedItemIndex]?.id === "search";
  }, [focusedItemIndex, isTopBarFocused, topBarItems]);

  const focusTopBarItem = React.useCallback((itemId: string) => {
    const target = document.querySelector<HTMLElement>(`[data-topbar-item="${itemId}"]`);
    if (target) {
      target.focus();
    }
  }, []);

  React.useEffect(() => {
    setFocusedItemIndex((current) => {
      if (!topBarItems.length) {
        return 0;
      }
      return Math.min(current, topBarItems.length - 1);
    });
  }, [topBarItems]);

  React.useEffect(() => {
    if (!isTopBarFocused) {
      return;
    }

    const item = topBarItems[focusedItemIndex];
    if (item) {
      focusTopBarItem(item.id);
    }
  }, [focusTopBarItem, focusedItemIndex, isTopBarFocused, topBarItems]);

  React.useEffect(() => {
    // Search should visually activate whenever topbar navigation selects it.
    if (isSearchSelectedInTopBar) {
      setIsSearchActive(true);
      return;
    }

    // Keep active only while the input itself still has DOM focus.
    if (document.activeElement !== searchInputRef.current) {
      setIsSearchActive(false);
    }
  }, [isSearchSelectedInTopBar]);

  const moveTopBarFocus = React.useCallback((direction: 1 | -1) => {
    if (!topBarItems.length) {
      return;
    }

    setFocusedItemIndex((current) => {
      const next = current + direction;
      if (next < 0 || next >= topBarItems.length) {
        const errAudio = errMoveAudioRef.current;
        if (errAudio) {
          errAudio.currentTime = 0;
          void errAudio.play().catch((error) => {
            console.debug("Failed to play error move sound", error);
          });
        }
        return current;
      }

      const moveAudio = moveAudioRef.current;
      if (moveAudio) {
        moveAudio.currentTime = 0;
        void moveAudio.play().catch((error) => {
          console.debug("Failed to play move sound", error);
        });
      }

      const item = topBarItems[next];
      if (item) {
        focusTopBarItem(item.id);
      }
      return next;
    });
  }, [focusTopBarItem, topBarItems]);

  const playMoveSound = React.useCallback(() => {
    const moveAudio = moveAudioRef.current;
    if (!moveAudio) {
      return;
    }

    moveAudio.currentTime = 0;
    void moveAudio.play().catch((error) => {
      console.debug("Failed to play move sound", error);
    });
  }, []);

  const leaveTopBarFocus = React.useCallback((withSound = false) => {
    if (withSound) {
      playMoveSound();
    }
    setTopBarFocused(false);
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  }, [playMoveSound, setTopBarFocused]);

  const activateFocusedTopBarItem = React.useCallback(() => {
    const item = topBarItems[focusedItemIndex];
    if (!item) {
      return;
    }

    if (item.id === "search") {
      setIsSearchActive(true);
      focusTopBarItem("search");
      return;
    }

    const element = document.querySelector<HTMLElement>(`[data-topbar-item="${item.id}"]`);
    if (element instanceof HTMLButtonElement) {
      element.click();
    }
  }, [focusTopBarItem, focusedItemIndex, topBarItems]);

  const navigateWithPageSounds = React.useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  const openGameFromSearch = React.useCallback((index: number) => {
    const game = modalGames[index];
    if (!game) {
      return;
    }

    setIsSearchActive(false);
    setTopBarFocused(false);
    navigate(`/overdrive/game/${game.id}`, {
      state: {
        skipOverdriveIntro: true,
      },
    });
  }, [modalGames, navigate, setTopBarFocused]);

  const moveLibraryFocus = React.useCallback((direction: "left" | "right" | "up" | "down") => {
    if (!modalGames.length) {
      return;
    }

    const columns = 4;
    setLibraryFocusIndex((current) => {
      let next = current;

      if (direction === "left") {
        next = current - 1;
      } else if (direction === "right") {
        next = current + 1;
      } else if (direction === "up") {
        next = current - columns;
      } else if (direction === "down") {
        next = current + columns;
      }

      if (next < 0 || next >= modalGames.length) {
        const errAudio = errMoveAudioRef.current;
        if (errAudio) {
          errAudio.currentTime = 0;
          void errAudio.play().catch((error) => {
            console.debug("Failed to play error move sound", error);
          });
        }
        return current;
      }

      playMoveSound();
      return next;
    });
  }, [modalGames.length, playMoveSound]);

  useResponsiveGamepad({
    onButtonDown: (button) => {
      if (!isTopBarFocused) {
        return;
      }

      if (isLibraryModalOpen) {
        if (button === "A") {
          openGameFromSearch(libraryFocusIndex);
          return;
        }

        if (button === "B") {
          setIsSearchActive(false);
          leaveTopBarFocus();
          return;
        }

        if (button === "LEFT" || button === "LB") {
          moveLibraryFocus("left");
          return;
        }

        if (button === "RIGHT" || button === "RB") {
          moveLibraryFocus("right");
          return;
        }

        if (button === "UP") {
          moveLibraryFocus("up");
          return;
        }

        if (button === "DOWN") {
          moveLibraryFocus("down");
          return;
        }
      }

      if (button === "A") {
        activateFocusedTopBarItem();
        return;
      }

      if (button === "DOWN") {
        leaveTopBarFocus(true);
        return;
      }

      if (button === "B") {
        leaveTopBarFocus();
        return;
      }

      if (button === "LEFT" || button === "LB") {
        moveTopBarFocus(-1);
        return;
      }

      if (button === "RIGHT" || button === "RB") {
        moveTopBarFocus(1);
      }
    },
    onDPad: (direction) => {
      if (!isTopBarFocused) {
        return;
      }

      if (isLibraryModalOpen) {
        if (direction === "LEFT") {
          moveLibraryFocus("left");
          return;
        }

        if (direction === "RIGHT") {
          moveLibraryFocus("right");
          return;
        }

        if (direction === "UP") {
          moveLibraryFocus("up");
          return;
        }

        if (direction === "DOWN") {
          moveLibraryFocus("down");
          return;
        }
      }

      if (direction === "LEFT") {
        moveTopBarFocus(-1);
        return;
      }

      if (direction === "RIGHT") {
        moveTopBarFocus(1);
        return;
      }

      if (direction === "DOWN") {
        leaveTopBarFocus(true);
      }
    },
    onLeftStick: (x, y) => {
      if (!isTopBarFocused) {
        return;
      }

      if (isLibraryModalOpen) {
        const now = Date.now();
        if (now - lastLibraryControllerNavRef.current < 180) {
          return;
        }

        const deadzone = 0.55;
        if (x <= -deadzone) {
          moveLibraryFocus("left");
          lastLibraryControllerNavRef.current = now;
          return;
        }

        if (x >= deadzone) {
          moveLibraryFocus("right");
          lastLibraryControllerNavRef.current = now;
          return;
        }

        if (y <= -deadzone) {
          moveLibraryFocus("up");
          lastLibraryControllerNavRef.current = now;
          return;
        }

        if (y >= deadzone) {
          moveLibraryFocus("down");
          lastLibraryControllerNavRef.current = now;
          return;
        }
      }

      const now = Date.now();
      if (now - lastControllerNavRef.current < 180) {
        return;
      }

      const deadzone = 0.55;
      if (x <= -deadzone) {
        moveTopBarFocus(-1);
        lastControllerNavRef.current = now;
        return;
      }

      if (x >= deadzone) {
        moveTopBarFocus(1);
        lastControllerNavRef.current = now;
        return;
      }

      if (y >= deadzone) {
        leaveTopBarFocus(true);
        lastControllerNavRef.current = now;
      }
    },
  });

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopBarFocused) {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (isSearchInputFocused) {
        if (event.key === "Escape") {
          event.preventDefault();
          setIsSearchActive(false);
          leaveTopBarFocus();
          return;
        }

        if (event.key === "ArrowRight") {
          event.preventDefault();
          moveTopBarFocus(1);
        }

        if (event.key === "ArrowLeft") {
          event.preventDefault();
          moveTopBarFocus(-1);
          return;
        }

        if (event.key === "ArrowDown") {
          event.preventDefault();
          leaveTopBarFocus(true);
          return;
        }

        if (isLibraryModalOpen) {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            moveLibraryFocus("left");
            return;
          }

          if (event.key === "ArrowRight") {
            event.preventDefault();
            moveLibraryFocus("right");
            return;
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            moveLibraryFocus("up");
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            moveLibraryFocus("down");
            return;
          }

          if (event.key === "Enter") {
            event.preventDefault();
            openGameFromSearch(libraryFocusIndex);
            return;
          }
        }

        // While typing in search, do not hijack WASD/topbar navigation.
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
        event.preventDefault();
        moveTopBarFocus(-1);
        return;
      }

      if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
        event.preventDefault();
        moveTopBarFocus(1);
        return;
      }

      if (event.key === "ArrowDown" || event.key === "s" || event.key === "S" || event.key === "Escape") {
        event.preventDefault();
        leaveTopBarFocus(event.key !== "Escape");
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateFocusedTopBarItem();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activateFocusedTopBarItem,
    isLibraryModalOpen,
    isSearchInputFocused,
    isTopBarFocused,
    leaveTopBarFocus,
    libraryFocusIndex,
    moveLibraryFocus,
    moveTopBarFocus,
    openGameFromSearch,
  ]);

  React.useEffect(() => {
    const moveAudio = new Audio(moveSound);
    moveAudio.preload = "auto";
    moveAudio.volume = 0.35;
    moveAudioRef.current = moveAudio;

    const errAudio = new Audio(errMoveSound);
    errAudio.preload = "auto";
    errAudio.volume = 0.35;
    errMoveAudioRef.current = errAudio;

    const menuOpenAudio = new Audio(menuOpenSound);
    menuOpenAudio.preload = "auto";
    menuOpenAudio.volume = 0.35;
    menuOpenAudioRef.current = menuOpenAudio;

    const menuCloseAudio = new Audio(menuCloseSound);
    menuCloseAudio.preload = "auto";
    menuCloseAudio.volume = 0.35;
    menuCloseAudioRef.current = menuCloseAudio;

    return () => {
      moveAudio.pause();
      errAudio.pause();
      menuOpenAudio.pause();
      menuCloseAudio.pause();
      moveAudioRef.current = null;
      errMoveAudioRef.current = null;
      menuOpenAudioRef.current = null;
      menuCloseAudioRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const syncSearchFocusState = () => {
      setIsSearchActive(document.activeElement === searchInputRef.current);
    };

    window.addEventListener("focusin", syncSearchFocusState);
    window.addEventListener("focusout", syncSearchFocusState);
    syncSearchFocusState();

    return () => {
      window.removeEventListener("focusin", syncSearchFocusState);
      window.removeEventListener("focusout", syncSearchFocusState);
    };
  }, []);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  React.useEffect(() => {
    let manager: BrowserBatteryManager | null = null;

    const updateBattery = () => {
      if (!manager) {
        return;
      }
      setBatteryLevel(Math.round(manager.level * 100));
      setIsCharging(manager.charging);
    };

    const load = async () => {
      const nav = navigator as NavigatorWithBattery;
      if (!nav.getBattery) {
        return;
      }

      try {
        manager = await nav.getBattery();
        updateBattery();
        manager.addEventListener("levelchange", updateBattery);
        manager.addEventListener("chargingchange", updateBattery);
      } catch (error) {
        console.debug("Battery API unavailable", error);
      }
    };

    void load();

    return () => {
      if (!manager) {
        return;
      }
      manager.removeEventListener("levelchange", updateBattery);
      manager.removeEventListener("chargingchange", updateBattery);
    };
  }, []);

  return (
    <div className={cn("absolute left-0 right-0 top-0 z-[999]", className)}>
      <div className="bg-transparent">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "group flex min-w-[200px] items-center gap-2 px-3 py-3 transition-all duration-300",
              isSearchActive ? "flex-1 bg-white text-black" : "max-w-full hover:flex-1 hover:bg-white text-black",
            )}
          >
            <Search className={cn("h-4 w-4 text-white group-hover:text-black", isSearchActive ? "text-black" : "")} />
            <input
              ref={searchInputRef}
              data-topbar-item="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange?.(event.target.value)}
              onFocus={() => {
                setIsSearchActive(true);
                setTopBarFocused(true);
              }}
              onBlur={() => {
                setIsSearchActive(false);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  // Enter behavior is handled by the global keydown to support modal selection.
                  event.preventDefault();
                }
              }}
              placeholder="Search games, posts, settings..."
              className={cn(isSearchActive ? "text-black placeholder:text-black/40" : "text-transparent placeholder:text-transparent hover:placeholder:text-black/40", "w-full bg-transparent text-sm focus:outline-none")}
              style={{ fontFamily: "Google Sans Flex, sans-serif" }}
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button
              data-topbar-item="network"
              type="button"
              onClick={() => {
                const willOpen = !isNetworkOpen;
                const audio = willOpen ? menuOpenAudioRef.current : menuCloseAudioRef.current;
                if (audio) {
                  audio.currentTime = 0;
                  void audio.play().catch((error) => {
                    console.debug("Failed to play menu toggle sound", error);
                  });
                }

                void invoke("open_network_settings").catch((error) => {
                  console.error("Failed opening network settings:", error);
                });
              }}
              className={cn(
                "inline-flex items-center gap-2 rounded-full p-2 text-xs transition-colors",
                isOnline
                  ? "text-emerald-200"
                  : "text-red-200",
                isTopBarFocused && topBarItems[focusedItemIndex]?.id === "network" && "animate-pulse bg-[var(--theme-accent)]/50",
              )}
            >
              <Wifi className="h-3.5 w-3.5" />
            </button>

            {showBatteryIndicator && (
              <button
                data-topbar-item="battery"
                type="button"
                onClick={() => navigateWithPageSounds("/overdrive/settings?section=interface")}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10",
                  isTopBarFocused && topBarItems[focusedItemIndex]?.id === "battery" && "ring-2 ring-[var(--theme-accent)]",
                )}
                title="Battery visibility setting"
              >
                <Battery className="h-3.5 w-3.5" />
                {batteryLevel != null ? `${batteryLevel}%${isCharging ? " charging" : ""}` : "Battery"}
              </button>
            )}

            <button
              data-topbar-item="settings"
              type="button"
              onClick={() => navigateWithPageSounds("/overdrive/settings")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10",
                isTopBarFocused && topBarItems[focusedItemIndex]?.id === "settings" && "ring-2 ring-[var(--theme-accent)]",
              )}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </button>

            <Clock showSeconds={false} className="flex items-center" />

            {user && (
              <div className="flex items-center gap-2 pr-2">
                {user.avatar ? (
                  <img src={user.avatar} alt="User Avatar" className="h-8 w-8" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center bg-white/20">
                    <span className="text-xs font-bold">
                      {(user.username || user.email || "U")[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isLibraryModalOpen && (
          <div
            ref={searchModalRef}
            className="mt-3 rounded-2xl border border-white/15 bg-black/85 p-4 shadow-[0_20px_40px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
          >
            <style>{`.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; } .no-scrollbar::-webkit-scrollbar { display: none; }`}</style>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.16rem] text-white/65">Library Search</p>
              <p className="text-xs text-white/45">{modalGames.length} results</p>
            </div>

            {isLoadingGames ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/65">Loading games...</div>
            ) : modalGames.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
                No matching games found.
              </div>
            ) : (
              <div className="max-h-[64vh] overflow-hidden no-scrollbar">
                <div className="space-y-5">
                  {groupedFilteredGames.map((group) => (
                    <section key={group.launcher}>
                      <p className="mb-2 text-[11px] uppercase tracking-[0.18rem] text-white/55">{formatLauncherLabel(group.launcher)}</p>
                      <div className="grid grid-cols-4 gap-3">
                        {group.games.map((game) => {
                          const focusIndex = modalGames.findIndex((entry) => entry.id === game.id);
                          const coverArt = getImageUrl(game.gridCoverArt || game.coverArt || game.headerArt);
                          const isFocused = focusIndex === libraryFocusIndex;

                          return (
                            <button
                              key={game.id}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                              }}
                              onMouseEnter={() => setLibraryFocusIndex(focusIndex)}
                              onClick={() => openGameFromSearch(focusIndex)}
                              className={cn(
                                "group text-left",
                                isFocused && "outline-none"
                              )}
                            >
                              <div className={cn(
                                "relative h-[180px] overflow-hidden rounded-lg border border-white/15 bg-[#1a1f3a]",
                                isFocused ? "ring-2 ring-[#9cf39c] border-[#9cf39c]/80" : "group-hover:border-[#107c10]/70"
                              )}>
                                {coverArt ? (
                                  <img src={coverArt} alt={game.title} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                                ) : (
                                  <div className="absolute inset-0 bg-gradient-to-br from-[#1a1f3a] to-[#0a0e27]" />
                                )}
                                <div className="absolute inset-0 bg-black/25" />
                              </div>
                              <p className="mt-2 truncate text-xs font-semibold text-white">{game.title}</p>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div >
  );
};

export default OverdriveTopBar;
