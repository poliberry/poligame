import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

export interface Notification {
  id: string;
  title: string;
  body?: string;
  type: "info" | "success" | "warning" | "error";
  duration?: number;
  timestamp: number;
}

interface NotificationStore {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, "id" | "timestamp">) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now(),
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 10), // Max 10 notifications
    }));
  },

  removeNotification: (id: string) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => {
    set({ notifications: [] });
  },
}));

