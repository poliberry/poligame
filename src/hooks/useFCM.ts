import { useEffect, useRef } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useAuthStore } from '@/stores/authStore';
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, MessagePayload, Messaging } from 'firebase/messaging';

// Firebase config - you'll need to add this to your environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export function useFCM() {
  // @ts-expect-error - notifications API will be generated when convex dev runs
  const registerToken = useMutation(api.notifications.registerFCMToken);
  // @ts-expect-error - notifications API will be generated when convex dev runs
  const removeToken = useMutation(api.notifications.removeFCMToken);
  const { user } = useAuthStore();
  const tokenRef = useRef<string | null>(null);
  const messagingRef = useRef<Messaging | null>(null);

  useEffect(() => {
    if (!user?.userId) return;

    const setupFCM = async () => {
      try {
        // Check if browser supports service workers
        if (!('serviceWorker' in navigator)) {
          console.log('Service workers not supported');
          return;
        }

        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Notification permission not granted');
          return;
        }

        // Get messaging instance
        const messaging = getMessaging(app);
        messagingRef.current = messaging;

        // Get FCM token
        const token = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY as string,
        });

        if (!token) {
          console.log('No FCM token available');
          return;
        }

        tokenRef.current = token;

        // Register token with Convex
        await registerToken({
          userId: user.userId as any,
          token: token,
          platform: 'desktop',
          deviceId: await getDeviceId(),
        });

        // Handle foreground messages
        onMessage(messaging, (payload: MessagePayload) => {
          console.log('Foreground FCM message:', payload);
          
          // Check if user is busy - if so, don't show notification
          // We'll check this via a query
          handleNotification(payload);
        });

        // Handle token refresh
        // Note: Firebase Web SDK doesn't have onTokenRefresh, so we'll check periodically
        const tokenRefreshInterval = setInterval(async () => {
          try {
            const newToken = await getToken(messaging, {
              vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY as string,
            });
            if (newToken && newToken !== tokenRef.current) {
              tokenRef.current = newToken;
              await registerToken({
                userId: user.userId as any,
                token: newToken,
                platform: 'desktop',
                deviceId: await getDeviceId(),
              });
            }
          } catch (error) {
            console.error('Error refreshing FCM token:', error);
          }
        }, 60 * 60 * 1000); // Check every hour

        return () => {
          clearInterval(tokenRefreshInterval);
        };
      } catch (error) {
        console.error('Error setting up FCM:', error);
      }
    };

    setupFCM();

    // Cleanup: remove token on unmount
    return () => {
      if (tokenRef.current && user?.userId) {
        removeToken({
          userId: user.userId as any,
          token: tokenRef.current,
        }).catch(console.error);
      }
    };
  }, [user?.userId, registerToken, removeToken]);
}

// Get a unique device ID (stored in localStorage)
async function getDeviceId(): Promise<string> {
  let deviceId = localStorage.getItem('poligame-device-id');
  if (!deviceId) {
    deviceId = `desktop-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('poligame-device-id', deviceId);
  }
  return deviceId;
}

// Handle notification display
async function handleNotification(payload: MessagePayload) {
  const notification = payload.notification;
  const data = payload.data as Record<string, string> | undefined;

  if (!notification) return;

  // Check user status - if busy, don't show desktop notifications
  // (Mobile will still receive them)
  const userStatus = localStorage.getItem('poligame-manual-status') || 'online';
  if (userStatus === 'busy') {
    // Don't show notification on desktop if user is busy
    // But we still received it, so we can log it
    console.log('Notification received but suppressed (user is busy):', notification);
    return;
  }

  // Show notification using Tauri's notification plugin
  try {
    const { sendNotification } = await import('@tauri-apps/plugin-notification');
    await sendNotification({
      title: notification.title || 'PoliGame',
      body: notification.body || '',
      icon: data?.gameIcon,
    });
  } catch (error) {
    // Fallback to browser notification if Tauri notification fails
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title || 'PoliGame', {
        body: notification.body || '',
        icon: data?.gameIcon,
        tag: data?.type || 'notification',
        data: data,
      });
    }
  }
}

