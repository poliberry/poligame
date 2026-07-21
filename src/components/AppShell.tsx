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
import { usePresence } from "@/hooks/usePresence";
import { useGamePresence } from "@/hooks/useGamePresence";
import { Game } from "@/types";
import { LauncherType } from "@/types";
import NotificationListener from "./NotificationListener";
import { NovuProvider } from "@novu/react";
// @ts-ignore
import welcomeBkg from "@/public/setup-bkg.png";
import { getImageUrl } from "@/utils/imageUtils";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "node_modules/convex/dist/esm-types/values/value";

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [showSetup, setShowSetup] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const { runningGameId, runningGame, checkGameRunning, setRunningGame } =
    useRunningGameStore();
  const { games, setGames, setLoading, activeHoverGame } = useGameStore();
  const { user } = useAuthStore();
  const activeHoverGameCust = useQuery(
    api.gameCustomizations.getGameCustomization,
    user && activeHoverGame
      ? {
          userId: user.userId as unknown as Id<"users">,
          gameId: activeHoverGame?.id,
        }
      : "skip",
  );

  console.log(activeHoverGame);

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

  // Periodically check for running games
  useEffect(() => {
    console.log(games);
    let minuteInterval: ReturnType<typeof setInterval> | null = null;
    let fiveMinuteInterval: ReturnType<typeof setInterval> | null = null;

    const checkRunningGames = async () => {
      console.log("[AppShell] Checking for running games...");

      // If we have a tracked running game, check if it's still running
      if (runningGameId && runningGame) {
        console.log(
          `[AppShell] Checking if tracked game is still running: ${runningGame.title} (${runningGameId})`,
        );
        const isRunning = await checkGameRunning(runningGameId);
        if (!isRunning) {
          console.log(
            `[AppShell] Game ${runningGame.title} is no longer running, clearing it`,
          );
          // Game stopped running, clear it
          setRunningGame(null);
        } else {
          console.log(`[AppShell] Game ${runningGame.title} is still running`);
        }
      } else {
        console.log(
          "[AppShell] No tracked game, checking all games for running processes...",
        );
        // Check all games to see if any are running
        // This helps detect games that were launched outside the app
        if (games && games.length > 0) {
          console.log(
            `[AppShell] Checking ${games.length} games for running processes`,
          );
          for (const game of games) {
            console.log(`[AppShell] Checking game: ${game.title} (${game.id})`);
            const isRunning = await checkGameRunning(game.id);
            if (isRunning) {
              console.log(
                `[AppShell] Found running game: ${game.title} (${game.id})`,
              );
              // Found a running game, set it
              setRunningGame(game);
              break; // Only track one game at a time
            }
          }
        } else {
          console.log("[AppShell] No games available to check");
        }
      }
    };

    // Check immediately on mount
    console.log(
      "[AppShell] Starting game process monitoring (checking every minute for first 5 minutes, then every 5 minutes)",
    );
    checkRunningGames();

    // Check every minute for the first 5 minutes (to quickly detect games on app open)
    let minuteCount = 0;
    minuteInterval = setInterval(() => {
      minuteCount++;
      console.log(
        `[AppShell] Minute check #${minuteCount} (will switch to 5-minute intervals after 5 checks)`,
      );
      checkRunningGames();

      // After 5 minutes, switch to 5-minute intervals
      if (minuteCount >= 5) {
        console.log("[AppShell] Switching to 5-minute interval checks");
        if (minuteInterval) {
          clearInterval(minuteInterval);
          minuteInterval = null;
        }

        // Start 5-minute interval
        fiveMinuteInterval = setInterval(
          () => {
            console.log("[AppShell] 5-minute interval check");
            checkRunningGames();
          },
          5 * 60 * 1000,
        );
      }
    }, 60 * 1000); // Every minute

    return () => {
      console.log("[AppShell] Cleaning up game process monitoring intervals");
      if (minuteInterval) {
        clearInterval(minuteInterval);
      }
      if (fiveMinuteInterval) {
        clearInterval(fiveMinuteInterval);
      }
    };
  }, [runningGameId, runningGame, games, checkGameRunning, setRunningGame]);

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
    <NovuProvider
      applicationIdentifier="hdRdluq2mpWM"
      subscriberId={user?.novuSubscriberId as string}
    >
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Livvic:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,900&family=Unbounded:wght@200..900&display=swap"
          rel="stylesheet"
        />
        <NotificationListener />
        <TopBar />
        <div
          className="flex flex-col gap-0 w-full flex-1 overflow-hidden transition-all ease-in-out duration-300"
          style={{
            background: `url(${activeHoverGame ? activeHoverGameCust?.customHeroArt ? getImageUrl(activeHoverGameCust.customHeroArt) : getImageUrl(activeHoverGame.headerArt) : welcomeBkg}) center center / 100% 100% no-repeat`,
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
    </NovuProvider>
  );
};
