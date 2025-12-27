import { useEffect, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getCurrentWindow } from '@tauri-apps/api/window';

// Keys for storing manual status preference
const MANUAL_STATUS_KEY = 'poligame-manual-status';
const MANUAL_STATUS_SET_KEY = 'poligame-manual-status-set';

export function usePresence(userId: string | null) {
  const updateUserStatus = useMutation(api.friends.updateUserStatus);
  const isWindowFocusedRef = useRef(true);
  const isManualStatusRef = useRef(false);

  useEffect(() => {
    if (!userId) return;

    let unlistenFocus: (() => void) | null = null;
    let unlistenClose: (() => void) | null = null;

    // Check if user has manually set a status
    const checkManualStatus = () => {
      if (typeof window !== 'undefined') {
        const isManualSet = localStorage.getItem(MANUAL_STATUS_SET_KEY);
        const manualStatus = localStorage.getItem(MANUAL_STATUS_KEY);
        if (isManualSet === 'true' && manualStatus) {
          isManualStatusRef.current = true;
          return true;
        }
      }
      isManualStatusRef.current = false;
      return false;
    };

    // Only set online if not manually set
    if (!checkManualStatus()) {
      updateUserStatus({
        userId: userId as any,
        status: 'online',
      }).catch((error) => {
        console.error('Failed to update status to online:', error);
      });
    }

    // Setup window event listeners
    const setupListeners = async () => {
      const window = getCurrentWindow();
      
      const handleFocus = async () => {
        if (!isWindowFocusedRef.current) {
          isWindowFocusedRef.current = true;
          // Check if status was manually set before updating
          if (!checkManualStatus()) {
            try {
              await updateUserStatus({
                userId: userId as any,
                status: 'online',
              });
            } catch (error) {
              console.error('Failed to update status to online:', error);
            }
          }
        }
      };

      const handleBlur = async () => {
        if (isWindowFocusedRef.current) {
          isWindowFocusedRef.current = false;
          // Check if status was manually set before updating
          if (!checkManualStatus()) {
            try {
              await updateUserStatus({
                userId: userId as any,
                status: 'away',
              });
            } catch (error) {
              console.error('Failed to update status to away:', error);
            }
          }
        }
      };

      // Listen for window close event
      const handleClose = async () => {
        try {
          await updateUserStatus({
            userId: userId as any,
            status: 'offline',
          });
        } catch (error) {
          console.error('Failed to update status to offline:', error);
        }
      };

      unlistenFocus = await window.onFocusChanged((focused) => {
        if (focused) {
          handleFocus();
        } else {
          handleBlur();
        }
      });

      unlistenClose = await window.onCloseRequested(handleClose);
    };

    setupListeners();

    // Cleanup: set offline when component unmounts
    return () => {
      if (unlistenFocus) unlistenFocus();
      if (unlistenClose) unlistenClose();
      updateUserStatus({
        userId: userId as any,
        status: 'offline',
      }).catch((error) => {
        console.error('Failed to update status to offline:', error);
      });
    };
  }, [userId, updateUserStatus]);
}

// Export function to set manual status (for desktop app)
export function setManualStatus(status: 'online' | 'away' | 'busy' | 'offline' | null) {
  if (typeof window === 'undefined') return;
  
  if (status) {
    localStorage.setItem(MANUAL_STATUS_KEY, status);
    localStorage.setItem(MANUAL_STATUS_SET_KEY, 'true');
  } else {
    localStorage.removeItem(MANUAL_STATUS_KEY);
    localStorage.removeItem(MANUAL_STATUS_SET_KEY);
  }
}

