import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { Game } from "@/types";

interface CurrentGamePayload {
  gameId: string;
  name: string;
}

interface RunningGameStore {
  runningGameId: string | null;
  runningGame: Game | null;
  runningGameStartedAt: number | null;
  isChecking: boolean;
  isMonitoring: boolean;
  setRunningGame: (game: Game | null) => void;
  setKnownGames: (games: Game[]) => void;
  syncCurrentGame: () => Promise<void>;
  startRealtimeMonitoring: () => void;
  stopRealtimeMonitoring: () => void;
  checkGameRunning: (gameId: string) => Promise<boolean>;
  killGame: (gameId: string) => Promise<void>;
  startPolling: (gameId: string, game: Game) => void;
  stopPolling: () => void;
}

let monitoringInterval: ReturnType<typeof setInterval> | null = null;
let monitoringInFlight = false;
let pendingSyncRequested = false;
let knownGames: Game[] = [];
// How many consecutive polls have returned null while a game was thought to be
// running. We clear the running game only after STOP_DEBOUNCE_COUNT consecutive
// nulls to avoid flicker from transient process detection gaps.
let consecutiveNullPolls = 0;
const STOP_DEBOUNCE_COUNT = 2;

const MONITOR_INTERVAL_MS = 1500;

function resolveRunningGame(payload: CurrentGamePayload): Game {
  const known = knownGames.find((game) => game.id === payload.gameId);
  if (known) {
    return known;
  }

  return {
    id: payload.gameId,
    title: payload.name,
    launcher: "unknown",
    installed: true,
  };
}

export const useRunningGameStore = create<RunningGameStore>((set, get) => ({
  runningGameId: null,
  runningGame: null,
  runningGameStartedAt: null,
  isChecking: false,
  isMonitoring: false,
  
  setRunningGame: (game) => {
    const previousGameId = get().runningGameId;
    set({ 
      runningGameId: game?.id || null, 
      runningGame: game,
      runningGameStartedAt:
        game === null
          ? null
          : previousGameId === game.id
            ? get().runningGameStartedAt
            : Date.now(),
    });
  },

  setKnownGames: (games) => {
    knownGames = games;
  },

  syncCurrentGame: async () => {
    if (monitoringInFlight) {
      pendingSyncRequested = true;
      return;
    }

    monitoringInFlight = true;
    pendingSyncRequested = false;

    try {
      const currentGame = await invoke<CurrentGamePayload | null>("get_current_game");

      if (!currentGame) {
        if (get().runningGameId !== null) {
          consecutiveNullPolls++;
          if (consecutiveNullPolls >= STOP_DEBOUNCE_COUNT) {
            consecutiveNullPolls = 0;
            set({ runningGameId: null, runningGame: null, runningGameStartedAt: null });
          }
        } else {
          consecutiveNullPolls = 0;
        }
        return;
      }

      consecutiveNullPolls = 0;
      const resolvedGame = resolveRunningGame(currentGame);
      const previous = get().runningGame;

      const shouldUpdate =
        get().runningGameId !== resolvedGame.id ||
        !previous ||
        previous.title !== resolvedGame.title ||
        previous.icon !== resolvedGame.icon;

      if (shouldUpdate) {
        const isSameGame = get().runningGameId === resolvedGame.id;
        set({
          runningGameId: resolvedGame.id,
          runningGame: resolvedGame,
          runningGameStartedAt: isSameGame
            ? get().runningGameStartedAt
            : Date.now(),
        });
      }
    } catch (error) {
      console.error("Failed to sync current game:", error);
    } finally {
      monitoringInFlight = false;

      // If a sync was requested while this run was in-flight, run one more pass
      // immediately so state transitions are not dropped between intervals.
      if (pendingSyncRequested) {
        pendingSyncRequested = false;
        void get().syncCurrentGame();
      }
    }
  },

  startRealtimeMonitoring: () => {
    if (monitoringInterval) {
      return;
    }

    set({ isMonitoring: true });

    monitoringInterval = setInterval(() => {
      void get().syncCurrentGame();
    }, MONITOR_INTERVAL_MS);

    void get().syncCurrentGame();
  },

  stopRealtimeMonitoring: () => {
    if (monitoringInterval) {
      clearInterval(monitoringInterval);
      monitoringInterval = null;
    }
    set({ isMonitoring: false });
  },
  
  checkGameRunning: async (gameId: string) => {
    try {
      set({ isChecking: true });
      const isRunning = await invoke<boolean>("check_game_running", { gameId });
      return isRunning;
    } catch (error) {
      console.error("Failed to check if game is running:", error);
      return false;
    } finally {
      set({ isChecking: false });
    }
  },
  
  killGame: async (gameId: string) => {
    try {
      await invoke("kill_game_process", { gameId });
      set({ runningGameId: null, runningGame: null, runningGameStartedAt: null });
      void get().syncCurrentGame();
    } catch (error) {
      console.error("Failed to kill game:", error);
      throw error;
    }
  },
  
  startPolling: (_gameId: string, game: Game) => {
    // Legacy API kept for compatibility with existing call sites.
    set({ runningGameId: game.id, runningGame: game, runningGameStartedAt: Date.now() });
    get().startRealtimeMonitoring();
    void get().syncCurrentGame();
  },
  
  stopPolling: () => {
    // Legacy no-op to avoid accidentally disabling app-wide monitoring.
  },
}));

