import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthStore } from "@/stores/authStore";
import { useRunningGameStore } from "@/stores/runningGameStore";
import { Id } from "../../convex/_generated/dataModel";

/**
 * Hook to track game playtime
 * Monitors game state and updates Convex with playtime data
 */
export function usePlaytimeTracking(enabled: boolean = true) {
  const { user } = useAuthStore();
  const { runningGame } = useRunningGameStore();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playtimeApi = api as any;
  const startSession = useMutation(playtimeApi.playtime.startPlaytimeSession);
  const endSession = useMutation(playtimeApi.playtime.endPlaytimeSession);
  
  const currentGameRef = useRef<{ gameId: string; sessionStartTime: number } | null>(null);

  useEffect(() => {
    if (!enabled || !user?.userId) return;

    let cancelled = false;

    const reconcileSession = async () => {
      const nextGameId = runningGame?.id ?? null;
      const activeSession = currentGameRef.current;

      if (nextGameId && activeSession?.gameId === nextGameId) {
        return;
      }

      if (activeSession) {
        try {
          await endSession({
            userId: user.userId as Id<"users">,
            gameId: activeSession.gameId,
            sessionStartTime: activeSession.sessionStartTime,
          });
        } catch (error) {
          console.error("Failed to end playtime session:", error);
        }

        if (!cancelled) {
          currentGameRef.current = null;
        }
      }

      if (!nextGameId || cancelled) {
        return;
      }

      try {
        const result = await startSession({
          userId: user.userId as Id<"users">,
          gameId: nextGameId,
        });

        if (!cancelled && result.success && result.sessionStartTime) {
          currentGameRef.current = {
            gameId: nextGameId,
            sessionStartTime: result.sessionStartTime,
          };
        }
      } catch (error) {
        console.error("Failed to start playtime session:", error);
      }
    };

    void reconcileSession();

    return () => {
      cancelled = true;
      
      // End session on unmount if game is still running
      if (currentGameRef.current) {
        endSession({
          userId: user.userId as Id<"users">,
          gameId: currentGameRef.current.gameId,
          sessionStartTime: currentGameRef.current.sessionStartTime,
        }).catch(console.error);
      }
    };
  }, [enabled, user?.userId, runningGame?.id, startSession, endSession]);
}

