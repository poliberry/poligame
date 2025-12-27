import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { Game } from "@/types";

interface RunningGameStore {
  runningGameId: string | null;
  runningGame: Game | null;
  isChecking: boolean;
  setRunningGame: (game: Game | null) => void;
  checkGameRunning: (gameId: string) => Promise<boolean>;
  killGame: (gameId: string) => Promise<void>;
  startPolling: (gameId: string, game: Game) => void;
  stopPolling: () => void;
}

let pollingInterval: NodeJS.Timeout | null = null;

export const useRunningGameStore = create<RunningGameStore>((set, get) => ({
  runningGameId: null,
  runningGame: null,
  isChecking: false,
  
  setRunningGame: (game) => {
    set({ 
      runningGameId: game?.id || null, 
      runningGame: game 
    });
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
      set({ runningGameId: null, runningGame: null });
      get().stopPolling();
    } catch (error) {
      console.error("Failed to kill game:", error);
      throw error;
    }
  },
  
  startPolling: (gameId: string, game: Game) => {
    // Stop any existing polling
    get().stopPolling();
    
    let checkCount = 0;
    const maxQuickChecks = 6; // 6 checks * 10 seconds = 60 seconds of quick polling
    
    const poll = async () => {
      checkCount++;
      const isRunning = await get().checkGameRunning(gameId);
      
      if (isRunning) {
        // Game is running - set state
        set({ runningGameId: gameId, runningGame: game });
        
        // After initial quick checks, switch to slower polling (3 minutes)
        if (checkCount >= maxQuickChecks && pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = setInterval(async () => {
            const stillRunning = await get().checkGameRunning(gameId);
            if (!stillRunning) {
              // Game stopped running
              set({ runningGameId: null, runningGame: null });
              get().stopPolling();
            } else {
              // Still running, ensure state is set
              set({ runningGameId: gameId, runningGame: game });
            }
          }, 3000); // 3 minutes
        }
      } else {
        // Game not running
        if (checkCount >= maxQuickChecks) {
          // After initial checks, if still not running, stop tracking
          set({ runningGameId: null, runningGame: null });
          get().stopPolling();
        }
        // During initial checks, keep checking even if not running yet
      }
    };
    
    // Start with frequent checks (every 10 seconds) to catch the game starting
    pollingInterval = setInterval(poll, 10000);
    
    // Also check immediately
    poll();
  },
  
  stopPolling: () => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
  },
}));

