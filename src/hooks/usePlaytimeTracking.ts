import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthStore } from "@/stores/authStore";
import { invoke } from "@tauri-apps/api/core";
import { Id } from "../../convex/_generated/dataModel";

/**
 * Hook to track game playtime
 * Monitors game state and updates Convex with playtime data
 */
export function usePlaytimeTracking() {
  const { user } = useAuthStore();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playtimeApi = api as any;
  const startSession = useMutation(playtimeApi.playtime.startPlaytimeSession);
  const endSession = useMutation(playtimeApi.playtime.endPlaytimeSession);
  
  const currentGameRef = useRef<{ gameId: string; sessionStartTime: number } | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user?.userId) return;

    const checkGameState = async () => {
      try {
        // Get current game state from Tauri
        const currentGame = await invoke<{ gameId: string; name: string } | null>("get_current_game");
        
        if (currentGame) {
          // Game is running
          if (!currentGameRef.current || currentGameRef.current.gameId !== currentGame.gameId) {
            // New game started or different game
            if (currentGameRef.current) {
              // End previous session
              try {
                await endSession({
                  userId: user.userId as Id<"users">,
                  gameId: currentGameRef.current.gameId,
                  sessionStartTime: currentGameRef.current.sessionStartTime,
                });
              } catch (error) {
                console.error("Failed to end playtime session:", error);
              }
            }
            
            // Start new session
            try {
              const result = await startSession({
                userId: user.userId as Id<"users">,
                gameId: currentGame.gameId,
              });
              
              if (result.success && result.sessionStartTime) {
                currentGameRef.current = {
                  gameId: currentGame.gameId,
                  sessionStartTime: result.sessionStartTime,
                };
              }
            } catch (error) {
              console.error("Failed to start playtime session:", error);
            }
          }
        } else {
          // No game running
          if (currentGameRef.current) {
            // End current session
            try {
              await endSession({
                userId: user.userId as Id<"users">,
                gameId: currentGameRef.current.gameId,
                sessionStartTime: currentGameRef.current.sessionStartTime,
              });
            } catch (error) {
              console.error("Failed to end playtime session:", error);
            }
            currentGameRef.current = null;
          }
        }
      } catch (error) {
        console.error("Error checking game state:", error);
      }
    };

    // Check game state every 5 seconds
    checkIntervalRef.current = setInterval(checkGameState, 5000);
    
    // Initial check
    checkGameState();

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      
      // End session on unmount if game is still running
      if (currentGameRef.current) {
        endSession({
          userId: user.userId as Id<"users">,
          gameId: currentGameRef.current.gameId,
          sessionStartTime: currentGameRef.current.sessionStartTime,
        }).catch(console.error);
      }
    };
  }, [user?.userId, startSession, endSession]);
}

