export interface NotificationOptions {
  title: string;
  body?: string;
  type?: "info" | "success" | "warning" | "error";
  showSystemNotification?: boolean;
  duration?: number;
}

/**
 * Check if notification permission is granted
 */
async function checkNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support notifications");
    return false;
  }
  
  if (Notification.permission === "granted") {
    return true;
  }
  
  if (Notification.permission === "denied") {
    return false;
  }
  
  // Request permission
  const permission = await Notification.requestPermission();
  return permission === "granted";
}

/**
 * Show a notification using the browser's native Notification API
 */
export async function showNotification(options: NotificationOptions) {
  const { title, body, type = "info" } = options;
  
  // Format the notification body with type indicator
  let notificationTitle = title;
  if (type === "success") {
    notificationTitle = `✓ ${title}`;
  } else if (type === "error") {
    notificationTitle = `✗ ${title}`;
  } else if (type === "warning") {
    notificationTitle = `⚠ ${title}`;
  }
  
  // Check and request notification permission
  const permissionGranted = await checkNotificationPermission();
  
  if (permissionGranted) {
    // Play notification sound using HTML5 Audio
    try {
      const audio = new Audio("/sounds/notification.ogg");
      audio.play().catch((error) => {
        console.debug("Failed to play notification sound:", error);
      });
    } catch (error) {
      console.debug("Failed to create audio element:", error);
    }
    
    // Show browser notification
    try {
      const notification = new Notification(notificationTitle, {
        body: body || title,
        icon: "/icons/128x128.png", // Use app icon if available
        badge: "/icons/32x32.png",
        tag: "poligame-notification", // Group notifications
        requireInteraction: false,
        silent: true, // Mute the browser's default notification sound since we play our own
      });
      
      // Auto-close notification after a few seconds
      const duration = options.duration || (type === "error" ? 5000 : 3000);
      setTimeout(() => {
        notification.close();
      }, duration);
    } catch (error) {
      console.error("Failed to show notification:", error);
    }
  }
}

/**
 * Show a success notification
 */
export function notifySuccess(title: string, body?: string, options?: Partial<NotificationOptions>) {
  return showNotification({ title, body, type: "success", ...options });
}

/**
 * Show an error notification
 */
export function notifyError(title: string, body?: string, options?: Partial<NotificationOptions>) {
  return showNotification({ title, body, type: "error", ...options });
}

/**
 * Show a warning notification
 */
export function notifyWarning(title: string, body?: string, options?: Partial<NotificationOptions>) {
  return showNotification({ title, body, type: "warning", ...options });
}

/**
 * Show an info notification
 */
export function notifyInfo(title: string, body?: string, options?: Partial<NotificationOptions>) {
  return showNotification({ title, body, type: "info", ...options });
}
