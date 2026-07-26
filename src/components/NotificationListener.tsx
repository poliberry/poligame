import { useNovu } from "@novu/react";
import { useEffect } from "react";
import type { Notification as INotification } from "@novu/react";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";
import {
  sendNotification,
  isPermissionGranted,
  requestPermission,
} from "@tauri-apps/plugin-notification";

function NotificationListener() {
  const novu = useNovu();

  useEffect(() => {
    if (!novu) {
      return;
    }

    // Handler for new notifications
    const handleNewNotification = async ({
      result,
    }: {
      result: INotification;
    }) => {
      console.log("New notification:", result.subject);

      const title = result.subject || "New Notification";
      const body = result.body || "";

      // Show in-app toast notification
      toast(title, {
        description: body,
        duration: 5000,
      });

      try {
        // Route all desktop notifications through the backend so they keep
        // working consistently while the app is hidden to tray.
        await invoke("show_native_notification", { title, body });
        return;
      } catch (error) {
        console.warn("Backend native notification failed, using JS fallback", error);
      }

      let permissionGranted = await isPermissionGranted();

      // If not we need to request it
      if (!permissionGranted) {
        const permission = await requestPermission();
        permissionGranted = permission === "granted";
      }

      // Once permission has been granted we can send the notification
      if (permissionGranted) {
        sendNotification({ title: title, body: body });
      }
    };

    // Handler for unread count changes
    const handleUnreadCountChanged = ({
      result,
    }: {
      result: { total: number; severity: Record<string, number> };
    }) => {
      // Update document title to show unread count
      const unreadCount = result.total;
      document.title =
        unreadCount > 0 ? `(${unreadCount}) PoliGame` : "PoliGame";

      // Note: Desktop apps don't have a standard badge API like mobile apps
      // The unread count is shown in the document title instead
      // On some platforms, the window title may appear in the taskbar/dock
    };

    // Subscribe to events
    novu.on("notifications.notification_received", handleNewNotification);
    novu.on("notifications.unread_count_changed", handleUnreadCountChanged);

    // Cleanup function
    return () => {
      novu.off("notifications.notification_received", handleNewNotification);
      novu.off("notifications.unread_count_changed", handleUnreadCountChanged);
    };
  }, [novu]);

  return null; // This component doesn't render anything
}

export default NotificationListener;
