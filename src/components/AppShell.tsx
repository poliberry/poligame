import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TopBar } from "./TopBar";
import { ContentView } from "./ContentView";
import { ThemeProvider } from "./ThemeProvider";
import { Setup } from "@/pages/Setup";
import { Toaster } from "@/components/ui/sonner";
import { useRunningGameStore } from "@/stores/runningGameStore";
import { useGameStore } from "@/stores/gameStore";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { usePresence } from "@/hooks/usePresence";
import { useGamePresence } from "@/hooks/useGamePresence";
import NotificationListener from "./NotificationListener";
// @ts-ignore
import welcomeBkg from "@/public/setup-bkg.png";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [showSetup, setShowSetup] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const { setKnownGames, startRealtimeMonitoring, stopRealtimeMonitoring, syncCurrentGame } =
    useRunningGameStore();
  const { games, setGames, setLoading } = useGameStore();
  const { user } = useAuthStore();
  const activeTheme = useThemeStore((s) => s.activeTheme);

  // Manage presence (online/away/offline)
  usePresence(user?.userId || null);

  // Update currentGame fields when games start/stop
  useGamePresence();

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const setupComplete = await invoke<boolean>("is_setup_complete");
        setShowSetup(!setupComplete);
      } catch (e) {
        console.error("Failed to check setup options:", e);
        setShowSetup(true);
      } finally {
        setIsChecking(false);
      }
    };

    checkSetup();
  }, []);

  // Keep the monitoring catalog synced as game list changes.
  useEffect(() => {
    setKnownGames(games || []);
  }, [games, setKnownGames]);

  // Start a single app-wide realtime monitor for game start/stop changes.
  useEffect(() => {
    startRealtimeMonitoring();
    void syncCurrentGame();

    const handleVisibilityOrFocus = () => {
      void syncCurrentGame();
    };

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      stopRealtimeMonitoring();
    };
  }, [startRealtimeMonitoring, stopRealtimeMonitoring, syncCurrentGame]);

  // Show loading state while checking
  if (isChecking) {
    return (
      <ThemeProvider>
        <div className="w-full h-screen bg-[var(--theme-background)] flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </div>
      </ThemeProvider>
    );
  }

  // Show setup if needed
  if (showSetup) {
    return (
      <ThemeProvider>
        <Setup />
      </ThemeProvider>
    );
  }

  return (
    <div
      className="text-foreground w-full h-screen gap-0 bg-background"
      style={{
        margin: 0,
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >

        {user?.novuSubscriberId && <NotificationListener />}
        <TopBar />
        <div
          className="flex flex-col gap-0 w-full flex-1 overflow-hidden transition-all ease-in-out duration-300"
          style={{
            background: `url(${activeTheme?.appearance?.background_image || welcomeBkg}) center center / 100% 100% no-repeat`,
          }}
        >
          <div
            style={{
              paddingTop: "45px",
            }}
            className="absolute top-0 left-0 w-full h-full backdrop-blur-md"
          >
            <ContentView>{children}</ContentView>
          </div>
        </div>
        <Toaster className="rounded-none" closeButton />
      </div>
  );
};
