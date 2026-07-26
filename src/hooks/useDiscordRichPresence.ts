import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useLocation } from "react-router-dom";
import { useRunningGameStore } from "@/stores/runningGameStore";
import { Game } from "@/types";

const DISCORD_CLIENT_ID = import.meta.env.VITE_DISCORD_CLIENT_ID as string | undefined;

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

  const candidates = [
    artwork.icon,
    artwork.customLogo,
    artwork.logoArt,
    artwork.logo,
    artwork.headerArt,
    artwork.customHeroArt,
    artwork.coverArt,
    artwork.customCoverArt,
    artwork.gridCoverArt,
    artwork.customGridCoverArt,
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
  const previousPayloadRef = useRef<string>("");

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

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let mounted = true;

    const connect = async () => {
      try {
        const connected = await invoke<boolean>("discord_presence_connect", {
          clientId: DISCORD_CLIENT_ID,
        });
        if (!mounted) {
          return;
        }
        setIsConnected(connected);
      } catch (error) {
        console.debug("Discord Rich Presence unavailable:", error);
        if (mounted) {
          setIsConnected(false);
        }
      }
    };

    void connect();

    return () => {
      mounted = false;
      setIsConnected(false);
      previousPayloadRef.current = "";
      void invoke("discord_presence_clear").catch(() => undefined);
    };
  }, [enabled]);

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
          await invoke("discord_presence_update_game", {
            gameTitle: payload.gameTitle,
            launcher: payload.launcher,
            artworkUrl: payload.artworkUrl,
            startTimestamp: payload.startTimestamp,
            clientId: DISCORD_CLIENT_ID,
          });
          return;
        }

        await invoke("discord_presence_update_launcher", {
          route: payload.route,
          clientId: DISCORD_CLIENT_ID,
        });
      } catch (error) {
        console.debug("Discord Rich Presence update failed:", error);
      }
    };

    void update();
  }, [enabled, isConnected, payload]);
}
