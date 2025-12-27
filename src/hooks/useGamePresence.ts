import { useEffect } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useRunningGameStore } from '@/stores/runningGameStore';
import { useAuthStore } from '@/stores/authStore';

export function useGamePresence() {
  const updateUserStatus = useMutation(api.friends.updateUserStatus);
  const { runningGame } = useRunningGameStore();
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user?.userId) return;

    if (runningGame) {
      // Game is running - update currentGame fields
      updateUserStatus({
        userId: user.userId as any,
        status: 'online', // Keep status as online
        currentGame: {
          id: runningGame.id,
          title: runningGame.title,
          launcher: runningGame.launcher,
          icon: runningGame.icon,
        },
      }).catch((error) => {
        console.error('Failed to update current game:', error);
      });
    } else {
      // No game running - clear currentGame fields
      updateUserStatus({
        userId: user.userId as any,
        status: 'online', // Keep status as online
        currentGame: undefined,
      }).catch((error) => {
        console.error('Failed to clear current game:', error);
      });
    }
  }, [runningGame, user?.userId, updateUserStatus]);
}

