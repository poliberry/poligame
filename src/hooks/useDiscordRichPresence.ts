import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useLocation } from "react-router-dom";
import { useRunningGameStore } from "@/stores/runningGameStore";
import { Game } from "@/types";

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;
const RECONNECT_INTERVAL_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 15_000;
// How long to wait before switching Discord to "launcher" mode after runningGame
// clears. Prevents brief process-detection gaps (launcher handoff, IPC reconnect
// window) from causing a visible flicker between game and launcher statuses.
const LAUNCHER_DEBOUNCE_MS = 8_000;

type PresencePayload =
  | {
      mode: "launcher";
      route: string;
    }
  | {
      mode: "game";
      gameTitle: string;
      launcher?: string;
      artworkUrl?: string;
      startTimestamp?: number;
    };

function normalizeDiscordArtworkUrl(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }

  // Discord cannot fetch local files, blob URLs, or data URLs as RPC image assets.
  return undefined;
}

function pickPublicArtworkUrl(game: Game): string | undefined {
  const artwork = game as Game & {
    logoArt?: string;
    customLogo?: string;
    customCoverArt?: string;
    customGridCoverArt?: string;
    customHeroArt?: string;
  };

  // Prefer large, reliable HTTPS images (Steam CDN cover/grid) over the small
  // app icon, which is often a local .ico file or a 128×128 px SteamGridDB
  // thumbnail — both of which Discord either can't fetch or won't display.
  const candidates = [
    artwork.coverArt,
    artwork.customCoverArt,
    artwork.gridCoverArt,
    artwork.customGridCoverArt,
    artwork.headerArt,
    artwork.customHeroArt,
    artwork.logoArt,
    artwork.customLogo,
    artwork.logo,
    artwork.icon,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeDiscordArtworkUrl(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

export function useDiscordRichPresence(enabled: boolean = true) {
  const location = useLocation();
  const { runningGame, runningGameStartedAt } = useRunningGameStore();
  const [isConnected, setIsConnected] = useState(false);
  const [sendTick, setSendTick] = useState(0);
  const previousPayloadRef = useRef<string>("");
  // Stamped when runningGame transitions to null; launcher updates are deferred
  // until this timestamp passes so transient detection gaps don't flash Discord.
  const gameModeCooldownEndRef = useRef<number>(0);
  const launcherDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks the previous runningGame value so we can detect the non-null → null
  // transition and stamp the cooldown at the right moment — when the game clears,
  // not when the last game update was sent (which may be much earlier).
  const wasRunningRef = useRef<boolean>(false);

  const payload = useMemo<PresencePayload>(() => {
    if (!runningGame) {
      return {
        mode: "launcher",
        route: location.pathname,
      };
    }

    return {
      mode: "game",
      gameTitle: runningGame.title,
      launcher: typeof runningGame.launcher === "string" ? runningGame.launcher : undefined,
      artworkUrl: pickPublicArtworkUrl(runningGame),
      startTimestamp: runningGameStartedAt
        ? Math.floor(runningGameStartedAt / 1000)
        : undefined,
    };
  }, [location.pathname, runningGame, runningGameStartedAt]);

  // Stamp the cooldown the moment runningGame clears, not when a game update is
  // sent. This means the window is correctly anchored to when the game actually
  // disappears — so the debounce still works when Discord is mid-reconnect and
  // isConnected is false (the update effect doesn't run during that gap).
  useEffect(() => {
    const isRunning = runningGame !== null;
    if (wasRunningRef.current && !isRunning) {
      gameModeCooldownEndRef.current = Date.now() + LAUNCHER_DEBOUNCE_MS;
    }
    wasRunningRef.current = isRunning;
  }, [runningGame]);

  // Attempt connection on mount and retry every 30 s until connected. Re-runs
  // when isConnected drops to false (e.g. after a failed update) to recover.
  useEffect(() => {
    if (!enabled || isConnected) {
      return;
    }

    let mounted = true;

    const attempt = async () => {
      try {
        const connected = await invoke<boolean>("discord_presence_connect", {
          clientId: DISCORD_CLIENT_ID,
        });
        if (mounted && connected) {
          setIsConnected(true);
        }
      } catch (error) {
        console.debug("Discord Rich Presence unavailable:", error);
      }
    };

    void attempt();

    const retryInterval = setInterval(() => {
      void attempt();
    }, RECONNECT_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(retryInterval);
    };
  }, [enabled, isConnected]);

  // Clear presence and reset state when disabled or on unmount.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    return () => {
      if (launcherDebounceTimerRef.current !== null) {
        clearTimeout(launcherDebounceTimerRef.current);
        launcherDebounceTimerRef.current = null;
      }
      setIsConnected(false);
      previousPayloadRef.current = "";
      void invoke("discord_presence_clear").catch(() => undefined);
    };
  }, [enabled]);

  // Clear presence when the main window is hidden to the system tray.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const appWindow = getCurrentWindow();
    if (appWindow.label !== "main") {
      return;
    }

    let unlisten: (() => void) | undefined;

    appWindow
      .onCloseRequested(() => {
        if (launcherDebounceTimerRef.current !== null) {
          clearTimeout(launcherDebounceTimerRef.current);
          launcherDebounceTimerRef.current = null;
        }
        setIsConnected(false);
        previousPayloadRef.current = "";
        void invoke("discord_presence_clear").catch(() => undefined);
      })
      .then((fn) => {
        unlisten = fn;
      });

    return () => {
      unlisten?.();
    };
  }, [enabled]);

  // Heartbeat: exercises the IPC socket on a fixed interval so a Discord restart
  // is detected even when the payload hasn't changed. Clears the dedup guard and
  // bumps sendTick so the update effect re-runs and attempts a real send.
  useEffect(() => {
    if (!enabled || !isConnected) {
      return;
    }

    const id = setInterval(() => {
      previousPayloadRef.current = "";
      setSendTick((t) => t + 1);
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(id);
  }, [enabled, isConnected]);

  // Send presence updates whenever connected state, payload, or heartbeat tick changes.
  useEffect(() => {
    if (!enabled || !isConnected) {
      return;
    }

    const key = JSON.stringify(payload);
    if (previousPayloadRef.current === key) {
      return;
    }

    previousPayloadRef.current = key;

    const update = async () => {
      try {
        if (payload.mode === "game") {
          // Cancel any pending launcher debounce — game is back.
          if (launcherDebounceTimerRef.current !== null) {
            clearTimeout(launcherDebounceTimerRef.current);
            launcherDebounceTimerRef.current = null;
          }
          await invoke("discord_presence_update_game", {
            gameTitle: payload.gameTitle,
            launcher: payload.launcher,
            artworkUrl: payload.artworkUrl,
            startTimestamp: payload.startTimestamp,
            clientId: DISCORD_CLIENT_ID,
          });
          return;
        }

        // Launcher mode: defer the update while the cooldown is still active so
        // a brief runningGame null (e.g. game launcher handoff, IPC reconnect gap)
        // doesn't flash "Browsing launcher" before the game is re-detected.
        const remaining = gameModeCooldownEndRef.current - Date.now();
        if (remaining > 0) {
          if (launcherDebounceTimerRef.current === null) {
            launcherDebounceTimerRef.current = setTimeout(() => {
              launcherDebounceTimerRef.current = null;
              previousPayloadRef.current = "";
              setSendTick((t) => t + 1);
            }, remaining);
          }
          return;
        }

        await invoke("discord_presence_update_launcher", {
          route: payload.route,
          clientId: DISCORD_CLIENT_ID,
        });
      } catch (error) {
        if (launcherDebounceTimerRef.current !== null) {
          clearTimeout(launcherDebounceTimerRef.current);
          launcherDebounceTimerRef.current = null;
        }
        console.debug("Discord Rich Presence update failed:", error);
        // The IPC connection was likely lost; reset so reconnection is attempted.
        setIsConnected(false);
        previousPayloadRef.current = "";
      }
    };

    void update();
  }, [enabled, isConnected, payload, sendTick]);
}
