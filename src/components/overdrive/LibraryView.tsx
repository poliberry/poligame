import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { useGameWithCustomizations } from "@/hooks/useGameWithCustomizations";
import { useControllerStore } from "@/stores/controllerStore";
import { useOverdriveStore } from "@/stores/overdriveStore";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";
import { OverdriveHintItem } from "@/components/overdrive/OverdriveNavigationHints";
import { getImageUrl } from "@/utils/imageUtils";
import { cn } from "@/lib/utils";
import { Game } from "@/types";
import { Library, Search } from "lucide-react";
// @ts-ignore
import moveSound from "@/public/sounds/move.wav";
// @ts-ignore
import errMoveSound from "@/public/sounds/errMove.wav";

const LAUNCHER_ORDER = ["steam", "epic", "ea", "rockstar", "custom"];
const GRID_COLUMNS = 5;

const formatLauncherLabel = (launcher: string): string => {
  const n = (launcher || "unknown").toLowerCase();
  if (n === "ea") return "EA";
  if (n === "epic") return "Epic Games";
  if (n === "rockstar") return "Rockstar";
  if (n === "custom") return "Custom";
  if (n === "steam") return "Steam";
  return n.charAt(0).toUpperCase() + n.slice(1);
};

interface LibraryCardProps {
  game: Game;
  isFocused: boolean;
  onClick: () => void;
  onFocus: () => void;
}

const LibraryCard: React.FC<LibraryCardProps> = ({ game, isFocused, onClick, onFocus }) => {
  const displayGame = useGameWithCustomizations(game) || game;
  const coverArt = getImageUrl(displayGame.gridCoverArt || displayGame.coverArt || displayGame.headerArt);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={onFocus}
      className="group relative text-left focus:outline-none"
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
    >
      <div
        className={cn(
          "relative h-[300px] w-[200px] overflow-hidden ring-2 transition-all duration-200",
          isFocused
            ? "ring-[var(--theme-accent)] shadow-[0_0_24px_color-mix(in_oklab,var(--theme-accent)_55%,transparent)] scale-[1.04]"
            : "ring-white/20 group-hover:ring-[var(--theme-accent)]",
        )}
      >
        {coverArt ? (
          <img
            src={coverArt}
            alt={displayGame.title}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-background to-background" />
        )}
        <div className={cn("absolute inset-0", isFocused ? "bg-black/10" : "bg-black/25")} />
      </div>
      <div className="mt-3 max-w-[200px]">
        <p className={cn("truncate text-sm font-semibold", isFocused ? "text-white" : "text-white/80")}>
          {displayGame.title}
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.16rem] text-white/55">
          {formatLauncherLabel(String(displayGame.launcher || "custom"))}
        </p>
      </div>
    </motion.button>
  );
};

interface LibraryViewProps {
  initialSearchQuery?: string;
  onBack: () => void;
  onOpenGame: (gameId: string) => void;
  onHintsChange?: (hints: OverdriveHintItem[]) => void;
}

const LibraryView: React.FC<LibraryViewProps> = ({ initialSearchQuery = "", onBack, onOpenGame, onHintsChange }) => {
  const { games, setGames } = useGameStore();
  const { isTopBarFocused, setTopBarFocused } = useOverdriveStore();
  const { isConnected } = useControllerStore();

  const [searchQuery, setSearchQuery] = React.useState(initialSearchQuery);
  const [loading, setLoading] = React.useState(false);
  const [focusedIndex, setFocusedIndex] = React.useState(0);

  const moveAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const errAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const move = new Audio(moveSound);
    move.preload = "auto";
    move.volume = 0.35;
    moveAudioRef.current = move;
    const err = new Audio(errMoveSound);
    err.preload = "auto";
    err.volume = 0.35;
    errAudioRef.current = err;
    return () => {
      move.pause();
      err.pause();
      moveAudioRef.current = null;
      errAudioRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    return () => {
      setTopBarFocused(false);
    };
  }, [setTopBarFocused]);

  const playMove = React.useCallback(() => {
    const a = moveAudioRef.current;
    if (!a) return;
    a.currentTime = 0;
    void a.play().catch(() => {});
  }, []);

  const playErr = React.useCallback(() => {
    const a = errAudioRef.current;
    if (!a) return;
    a.currentTime = 0;
    void a.play().catch(() => {});
  }, []);

  React.useEffect(() => {
    if (games.length > 0) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const list = await invoke<Game[]>("get_all_games");
        if (cancelled) return;
        setGames(list.map((g) => ({ ...g, launcher: String(g.launcher || "custom").toLowerCase() })));
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [games.length, setGames]);

  const filteredGames = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return games;
    return games.filter((g) =>
      (g.title?.toLowerCase() || "").includes(q) ||
      String(g.launcher || "").toLowerCase().includes(q) ||
      (g.developer?.toLowerCase() || "").includes(q),
    );
  }, [games, searchQuery]);

  const groupedGames = React.useMemo(() => {
    const byLauncher = new Map<string, Game[]>();
    filteredGames.forEach((g) => {
      const key = String(g.launcher || "custom").toLowerCase();
      byLauncher.set(key, [...(byLauncher.get(key) || []), g]);
    });
    const ordered = [
      ...LAUNCHER_ORDER.filter((l) => byLauncher.has(l)),
      ...Array.from(byLauncher.keys()).filter((l) => !LAUNCHER_ORDER.includes(l)),
    ];
    return ordered.map((l) => ({
      launcher: l,
      games: (byLauncher.get(l) || []).sort((a, b) => a.title.localeCompare(b.title)),
    }));
  }, [filteredGames]);

  const scrollToFocused = React.useCallback((index: number) => {
    const el = document.querySelector<HTMLElement>(`[data-library-index="${index}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, []);

  const moveFocus = React.useCallback((direction: "up" | "down" | "left" | "right") => {
    if (isTopBarFocused) return;
    const total = filteredGames.length;
    if (!total) return;

    setFocusedIndex((prev) => {
      let next = prev;
      if (direction === "left") next = prev - 1;
      else if (direction === "right") next = prev + 1;
      else if (direction === "up") {
        if (prev < GRID_COLUMNS) {
          setTopBarFocused(true);
          return prev;
        }
        next = prev - GRID_COLUMNS;
      } else if (direction === "down") {
        next = prev + GRID_COLUMNS;
      }

      if (next < 0 || next >= total) {
        playErr();
        return prev;
      }
      playMove();
      scrollToFocused(next);
      return next;
    });
  }, [filteredGames.length, isTopBarFocused, playErr, playMove, scrollToFocused, setTopBarFocused]);

  useResponsiveGamepad({
    onButtonDown: (button) => {
      if (isTopBarFocused) return;
      if (button === "B") { onBack(); return; }
      if (button === "A" || button === "X") {
        const g = filteredGames[focusedIndex];
        if (g) onOpenGame(g.id);
        return;
      }
    },
    onDPad: (dir) => {
      if (isTopBarFocused) return;
      moveFocus(dir.toLowerCase() as "up" | "down" | "left" | "right");
    },
    onLeftStick: (x, y) => {
      if (isTopBarFocused) return;
      const dead = 0.5;
      if (x <= -dead) moveFocus("left");
      else if (x >= dead) moveFocus("right");
      else if (y <= -dead) moveFocus("up");
      else if (y >= dead) moveFocus("down");
    },
  });

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTopBarFocused) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); onBack(); return; }
      if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault(); moveFocus("left"); return; }
      if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault(); moveFocus("right"); return; }
      if (e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); moveFocus("up"); return; }
      if (e.key === "ArrowDown" || e.key === "s") { e.preventDefault(); moveFocus("down"); return; }
      if (e.key === "Enter") {
        e.preventDefault();
        const g = filteredGames[focusedIndex];
        if (g) onOpenGame(g.id);
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filteredGames, focusedIndex, isTopBarFocused, moveFocus, onBack, onOpenGame]);

  const handleSearchSubmit = React.useCallback(() => {
    setFocusedIndex(0);
  }, []);

  const hints = React.useMemo<OverdriveHintItem[]>(() => [
    { id: "open", label: "Open Game", keyLabel: "Enter", controllerButton: "a" },
    { id: "back", label: "Back", keyLabel: "Esc", controllerButton: "b", onActivate: onBack },
    { id: "nav", label: "Navigate", keyLabel: "Arrows", controllerButton: "lb" },
  ], [onBack]);

  React.useEffect(() => { onHintsChange?.(hints); }, [hints, onHintsChange]);

  let globalIndex = -1;

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-950 text-white">
      <style>{`.no-scrollbar{-ms-overflow-style:none;scrollbar-width:none}.no-scrollbar::-webkit-scrollbar{display:none}`}</style>

      <div ref={scrollContainerRef} className="h-full overflow-y-auto no-scrollbar px-8 pb-24 pt-20">
        <div className="mb-6 flex items-center gap-3">
          <Library className="h-6 w-6 text-[var(--theme-accent)]" />
          <h1 className="text-2xl font-medium">All Games</h1>
          {searchQuery.trim() && (
            <span className="rounded-full border border-white/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.14rem] text-white/70">
              Filter: {searchQuery}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex h-[45vh] flex-col items-center justify-center gap-3 text-white/60">
            <Search className="h-8 w-8 animate-pulse" />
            <p>Loading library...</p>
          </div>
        ) : groupedGames.length > 0 ? (
          <div className="space-y-10">
            {groupedGames.map((group) => (
              <section key={group.launcher}>
                <div className="mb-4 flex items-center gap-3">
                  <h2 className="text-sm uppercase tracking-[0.22rem] text-white/65">
                    {formatLauncherLabel(group.launcher)}
                  </h2>
                  <span className="text-xs text-white/45">{group.games.length} games</span>
                </div>
                <div className={`grid grid-cols-${GRID_COLUMNS} gap-x-6 gap-y-10`} style={{ gridTemplateColumns: `repeat(${GRID_COLUMNS}, 200px)` }}>
                  {group.games.map((game) => {
                    globalIndex++;
                    const idx = globalIndex;
                    return (
                      <div key={game.id} data-library-index={idx}>
                        <LibraryCard
                          game={game}
                          isFocused={!isTopBarFocused && focusedIndex === idx}
                          onClick={() => onOpenGame(game.id)}
                          onFocus={() => { if (!isTopBarFocused) setFocusedIndex(idx); }}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="flex h-[45vh] flex-col items-center justify-center gap-3 text-white/55">
            <Search className="h-10 w-10 opacity-60" />
            <p className="text-lg">No games found.</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default LibraryView;
