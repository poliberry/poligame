import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useAuthStore } from "@/stores/authStore";
import { useControllerStore } from "@/stores/controllerStore";
import { useOverdriveStore } from "@/stores/overdriveStore";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";
import { useGameWithCustomizations } from "@/hooks/useGameWithCustomizations";
import { useRunningGameStore } from "@/stores/runningGameStore";
import ControllerButton from "@/components/overdrive/ControllerButton";
import { OverdriveHintItem } from "@/components/overdrive/OverdriveNavigationHints";
import { Button } from "@/components/ui/button";
import { getImageUrl } from "@/utils/imageUtils";
import { Game } from "@/types";
import { ArrowLeft, Play, Rocket, Square } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
// @ts-ignore
import moveSound from "@/public/sounds/move.wav";
// @ts-ignore
import gameLaunchSound from "@/public/sounds/gameLaunch.wav";

interface GameDetailsViewProps {
  gameId: string;
  onBack: () => void;
  onHintsChange?: (hints: OverdriveHintItem[]) => void;
}

const GameDetailsView: React.FC<GameDetailsViewProps> = ({ gameId, onBack, onHintsChange }) => {
  const { user } = useAuthStore();
  const { controllerType, isConnected } = useControllerStore();
  const { toggleMenu, setTopBarFocused, isTopBarFocused } = useOverdriveStore();
  const {
    runningGameId, killGame, startPolling,
    setKnownGames, startRealtimeMonitoring, stopRealtimeMonitoring, syncCurrentGame,
  } = useRunningGameStore();

  const [game, setGame] = React.useState<Game | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [launching, setLaunching] = React.useState(false);
  const [focusedAction, setFocusedAction] = React.useState<"play" | "back">("play");

  const moveAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const launchAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const displayGame = useGameWithCustomizations(game);
  const isGameRunning = game?.id != null && runningGameId === game.id;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playtimeData = useQuery(
    (api as any).playtime.getGamePlaytime,
    user?.userId && gameId ? { userId: user.userId as Id<"users">, gameId } : "skip",
  );

  React.useEffect(() => {
    const move = new Audio(moveSound);
    move.preload = "auto";
    move.volume = 0.35;
    moveAudioRef.current = move;
    const launch = new Audio(gameLaunchSound);
    launch.preload = "auto";
    launch.volume = 0.4;
    launchAudioRef.current = launch;
    return () => {
      move.pause();
      launch.pause();
      moveAudioRef.current = null;
      launchAudioRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    return () => { setTopBarFocused(false); };
  }, [setTopBarFocused]);

  React.useEffect(() => {
    if (!gameId) { setLoading(false); return; }
    let cancelled = false;
    const load = async () => {
      try {
        const data = await invoke<Game>("get_game_details", { gameId });
        if (!cancelled) setGame(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [gameId]);

  React.useEffect(() => {
    if (game) setKnownGames([game]);
  }, [game, setKnownGames]);

  React.useEffect(() => {
    startRealtimeMonitoring();
    void syncCurrentGame();
    return () => { stopRealtimeMonitoring(); };
  }, [startRealtimeMonitoring, stopRealtimeMonitoring, syncCurrentGame]);

  const playtimeMinutes = React.useMemo(() => Math.floor((playtimeData?.totalPlaytime || 0) / 60), [playtimeData]);
  const playtimeLabel = playtimeMinutes > 0 ? `${playtimeMinutes.toLocaleString()} minutes` : "0 minutes";

  const playMove = React.useCallback(() => {
    const a = moveAudioRef.current;
    if (!a) return;
    a.currentTime = 0;
    void a.play().catch(() => {});
  }, []);

  const handleLaunch = React.useCallback(async () => {
    if (!game?.id || launching) return;
    if (isGameRunning) {
      try { await killGame(game.id); } catch (e) { console.error(e); }
      return;
    }
    setLaunching(true);
    const a = launchAudioRef.current;
    if (a) { a.currentTime = 0; void a.play().catch(() => {}); }
    try {
      await invoke("launch_game_overdrive", { gameId: game.id });
      startPolling(game.id, game);
    } catch (e) {
      console.error(e);
    } finally {
      setLaunching(false);
    }
  }, [game, launching, isGameRunning, killGame, startPolling]);

  const moveFocusLeft = React.useCallback(() => {
    setFocusedAction((p) => { if (p === "back") return p; playMove(); return "back"; });
  }, [playMove]);

  const moveFocusRight = React.useCallback(() => {
    setFocusedAction((p) => { if (p === "play") return p; playMove(); return "play"; });
  }, [playMove]);

  const activateFocused = React.useCallback(() => {
    if (focusedAction === "back") { onBack(); return; }
    void handleLaunch();
  }, [focusedAction, handleLaunch, onBack]);

  useResponsiveGamepad({
    onButtonDown: (button) => {
      if (isTopBarFocused) return;
      if (button === "A") activateFocused();
      else if (button === "B") onBack();
      else if (button === "LB" || button === "LEFT" || button === "X") moveFocusLeft();
      else if (button === "RB" || button === "RIGHT" || button === "Y") moveFocusRight();
    },
    onDPad: (dir) => {
      if (isTopBarFocused) return;
      if (dir === "LEFT" || dir === "UP") moveFocusLeft();
      else if (dir === "RIGHT" || dir === "DOWN") moveFocusRight();
    },
  });

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTopBarFocused) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); moveFocusLeft(); }
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); moveFocusRight(); }
      else if (e.key === "Tab") { e.preventDefault(); setFocusedAction((p) => p === "play" ? "back" : "play"); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activateFocused(); }
      else if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); onBack(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activateFocused, isTopBarFocused, moveFocusLeft, moveFocusRight, onBack]);

  const hints = React.useMemo<OverdriveHintItem[]>(() => [
    { id: "launch", label: isGameRunning ? "Quit" : "Launch", keyLabel: "Enter", controllerButton: "a", onActivate: () => void handleLaunch() },
    { id: "back", label: "Back", keyLabel: "Esc", controllerButton: "b", onActivate: onBack },
    { id: "focus", label: "Switch Focus", keyLabel: "Arrows", controllerButton: "lb" },
    { id: "menu", label: "Menu", keyLabel: "M", controllerButton: "menu", onActivate: toggleMenu },
  ], [handleLaunch, isGameRunning, onBack, toggleMenu]);

  React.useEffect(() => { onHintsChange?.(hints); }, [hints, onHintsChange]);

  if (loading) {
    return (
      <div className="w-full h-screen bg-black text-white flex items-center justify-center">
        <p className="text-xl text-white/70">Loading game details...</p>
      </div>
    );
  }

  if (!displayGame) {
    return (
      <div className="w-full h-screen bg-black text-white flex flex-col items-center justify-center gap-6 px-6">
        <p className="text-2xl font-semibold">Game not found</p>
        <Button onClick={onBack} className="text-base px-6 py-5 rounded-xl">Back</Button>
      </div>
    );
  }

  const heroImage = getImageUrl(displayGame.headerArt || displayGame.gridCoverArt || displayGame.coverArt) || "";
  const iconImage = getImageUrl(displayGame.icon || displayGame.logo) || "";

  return (
    <motion.div
      className="relative w-full h-screen overflow-hidden bg-gray-900 text-white"
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="absolute inset-0">
        <div
          className={cn("absolute inset-x-0 top-0", launching ? "h-full" : "h-[44vh]")}
          style={{
            background: heroImage
              ? `url(${heroImage}) center center / cover no-repeat`
              : "var(--background)",
          }}
        />
        <div className={cn("absolute inset-x-0 top-0 bg-gradient-to-b from-transparent to-gray-900", launching ? "h-full" : "h-[44vh]")} />
        {launching && <div className="absolute inset-x-0 top-0 h-full backdrop-blur-md bg-black/35" />}
        {!launching && (
          <div className="w-full absolute h-[42vh] px-4 flex flex-row gap-2 items-end">
            <div className="w-32 h-32 rounded-2xl overflow-hidden border border-white/20 bg-black/40 flex-shrink-0">
              {iconImage ? (
                <img src={iconImage} alt={`${displayGame.title} icon`} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Rocket className="w-16 h-16 text-white/45" />
                </div>
              )}
            </div>
            <h1 className="text-4xl font-semibold leading-tight">
              {displayGame.title}
            </h1>
          </div>
        )}
      </div>

      {!launching && (
        <div className="absolute top-[44vh] inset-x-0">
          <div className="w-full h-16 bg-gray-800 px-2 shadow-md border-y border-white/10 flex flex-row items-center gap-2">
            <motion.div
              animate={focusedAction === "back" ? { scale: 1, opacity: 1, y: 0, filter: "brightness(1)" } : { scale: 0.97, opacity: 0.82, y: 2, filter: "brightness(0.88)" }}
              transition={{ duration: 0.2 }}
            >
              <Button
                onMouseEnter={() => setFocusedAction("back")}
                onClick={onBack}
                variant="outline"
                className={cn("cursor-pointer p-6 text-base border-white/20 bg-card/50 hover:bg-card/70", focusedAction === "back" && "ring-2 ring-[var(--theme-accent)]")}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
            </motion.div>

            <motion.div
              animate={focusedAction === "play" ? { scale: 1, opacity: 1, y: 0, filter: "brightness(1)" } : { scale: 0.97, opacity: 0.82, y: 2, filter: "brightness(0.9)" }}
              transition={{ duration: 0.2 }}
            >
              <Button
                onMouseEnter={() => setFocusedAction("play")}
                onClick={() => void handleLaunch()}
                disabled={launching || (!displayGame.installed && !isGameRunning)}
                className={cn(
                  "cursor-pointer p-6 text-xl text-white hover:scale-105 hover:shadow-md",
                  isGameRunning ? "bg-gradient-to-br from-red-600 to-red-700" : "bg-[var(--theme-button)]",
                  focusedAction === "play" && "ring-2 ring-[var(--theme-accent)]",
                )}
              >
                {isGameRunning ? <Square className="w-6 h-6 mr-3" /> : <Play className="w-6 h-6 mr-3" />}
                {launching ? "Playing..." : isGameRunning ? "Quit" : "Play"}
              </Button>
            </motion.div>

            <div className="flex flex-col gap-0 items-start">
              <p className="text-xs text-white/60 uppercase tracking-[0.16em]">Playtime</p>
              <p className="text-2xl font-semibold">{playtimeLabel}</p>
            </div>
          </div>
        </div>
      )}

      {launching && (
        <div className="absolute inset-0 z-40 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28 }}
            className="px-10 py-8 flex flex-col items-center gap-4"
          >
            <p className="text-md font-thin text-white/70">LAUNCHING...</p>
            <p className="text-2xl text-white">{displayGame.title}</p>
            <svg width="48" height="48" stroke="var(--theme-accent)" viewBox="0 0 24 24">
              <g><circle cx="12" cy="12" r="9.5" fill="none" strokeWidth="3" strokeLinecap="round">
                <animate attributeName="stroke-dasharray" dur="1.5s" calcMode="spline" values="0 150;42 150;42 150;42 150" keyTimes="0;0.475;0.95;1" keySplines="0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1" repeatCount="indefinite" />
                <animate attributeName="stroke-dashoffset" dur="1.5s" calcMode="spline" values="0;-16;-59;-59" keyTimes="0;0.475;0.95;1" keySplines="0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1" repeatCount="indefinite" />
              </circle>
                <animateTransform attributeName="transform" type="rotate" dur="2s" values="0 12 12;360 12 12" repeatCount="indefinite" />
              </g>
            </svg>
          </motion.div>
        </div>
      )}

    </motion.div>
  );
};

export default GameDetailsView;
