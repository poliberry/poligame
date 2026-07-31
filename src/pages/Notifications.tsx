import React, { useEffect, useRef } from "react";
import { useNotificationStore } from "@/stores/notificationStore";
import { Card, CardContent } from "@/components/ui/card";
import { X, CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

const Notifications: React.FC = () => {
  const { notifications, removeNotification, clearAll } = useNotificationStore();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    // Auto-remove notifications after their duration
    const timers: NodeJS.Timeout[] = [];
    
    notifications.forEach((notification) => {
      if (notification.duration && notification.duration > 0) {
        const timer = setTimeout(() => {
          removeNotification(notification.id);
        }, notification.duration);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [notifications, removeNotification]);

  useEffect(() => {
    // Hide window when no notifications
    if (notifications.length === 0) {
      invoke("hide_notification_window").catch(console.error);
      // Reset the played flag when window is hidden
      hasPlayedRef.current = false;
    } else if (notifications.length > 0 && !hasPlayedRef.current) {
      // Play notification sound when window is shown (first notification appears)
      if (audioRef.current) {
        audioRef.current.play().catch((error) => {
          console.error("Failed to play notification sound:", error);
        });
        hasPlayedRef.current = true;
      }
    }
  }, [notifications.length]);

  const getIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-400" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-400" />;
    }
  };

  const getBorderColor = (type: string) => {
    switch (type) {
      case "success":
        return "border-green-500/50";
      case "error":
        return "border-red-500/50";
      case "warning":
        return "border-yellow-500/50";
      default:
        return "border-blue-500/50";
    }
  };

  const getBgColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-950/90";
      case "error":
        return "bg-red-950/90";
      case "warning":
        return "bg-yellow-950/90";
      default:
        return "bg-blue-950/90";
    }
  };

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="w-full h-full bg-transparent p-4 flex flex-col gap-2 overflow-y-auto">
      {/* Audio element for notification sound */}
      <audio
        ref={audioRef}
        src="/sounds/notification.ogg"
        preload="auto"
      />
      

      
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold uppercase italic text-white">
          Notifications
        </h2>
        {notifications.length > 1 && (
          <button
            onClick={clearAll}
            className="text-xs text-white/60 hover:text-white transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="flex flex-col gap-2">
        {notifications.map((notification) => (
          <Card
            key={notification.id}
            className={`${getBgColor(notification.type)} ${getBorderColor(notification.type)} border transition-all duration-300 animate-in slide-in-from-right`}
            size="sm"
          >
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-white mb-1">
                        {notification.title}
                      </h3>
                      {notification.body && (
                        <p className="text-xs text-white/80 leading-relaxed">
                          {notification.body}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => removeNotification(notification.id)}
                      className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
                      aria-label="Close notification"
                    >
                      <X className="w-4 h-4 text-white/60" />
                    </button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Notifications;

