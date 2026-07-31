import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuthStore } from "@/stores/authStore";
import { useControllerStore } from "@/stores/controllerStore";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";
import { useGameWithCustomizations } from "@/hooks/useGameWithCustomizations";
import { useRunningGameStore } from "@/stores/runningGameStore";
import { useOverdriveStore } from "@/stores/overdriveStore";
import ControllerButton from "@/components/overdrive/ControllerButton";
import OverdriveTopBar from "@/components/overdrive/OverdriveTopBar";
import OverdriveNavigationHints, { OverdriveHintItem } from "@/components/overdrive/OverdriveNavigationHints";
import { Button } from "@/components/ui/button";
import { getImageUrl } from "@/utils/imageUtils";
import { Game } from "@/types";
import { ArrowLeft, Loader2, Play, Rocket, Square } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
// @ts-ignore
import moveSound from "@/public/sounds/move.wav";
// @ts-ignore
import gameLaunchSound from "@/public/sounds/gameLaunch.wav";

const OverdriveGameDetails: React.FC = () => {
    const { user, isAuthenticated } = useAuthStore();
    const { gameId } = useParams<{ gameId: string }>();
    const navigate = useNavigate();
    const { controllerType, isConnected } = useControllerStore();
    const {
        runningGameId,
        killGame,
        startPolling,
        setKnownGames,
        startRealtimeMonitoring,
        stopRealtimeMonitoring,
        syncCurrentGame,
    } = useRunningGameStore();
    const { toggleMenu } = useOverdriveStore();

    const [game, setGame] = React.useState<Game | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [launching, setLaunching] = React.useState(false);
    const [focusedAction, setFocusedAction] = React.useState<"play" | "back">("play");
    const [searchQuery, setSearchQuery] = React.useState("");
    const moveAudioRef = React.useRef<HTMLAudioElement | null>(null);
    const gameLaunchAudioRef = React.useRef<HTMLAudioElement | null>(null);

    const displayGame = useGameWithCustomizations(game);
    const isGameRunning = game?.id != null && runningGameId === game.id;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const playtimeApi = api as any;
    const playtimeData = useQuery(
        playtimeApi.playtime.getGamePlaytime,
        user?.userId && gameId
            ? {
                userId: user.userId as Id<"users">,
                gameId,
            }
            : "skip",
    );

    React.useEffect(() => {
        const loadGameDetails = async () => {
            if (!gameId) {
                setLoading(false);
                return;
            }

            try {
                const gameData = await invoke<Game>("get_game_details", { gameId });
                setGame(gameData);
            } catch (error) {
                console.error("Failed to load overdrive game details:", error);
                setGame(null);
            } finally {
                setLoading(false);
            }
        };

        void loadGameDetails();
    }, [gameId]);

    React.useEffect(() => {
        if (game) {
            setKnownGames([game]);
        }
    }, [game, setKnownGames]);

    React.useEffect(() => {
        startRealtimeMonitoring();
        void syncCurrentGame();

        return () => {
            stopRealtimeMonitoring();
        };
    }, [startRealtimeMonitoring, stopRealtimeMonitoring, syncCurrentGame]);

    const playtimeMinutes = React.useMemo(() => {
        const totalSeconds = playtimeData?.totalPlaytime || 0;
        return Math.floor(totalSeconds / 60);
    }, [playtimeData?.totalPlaytime]);

    const playtimeLabel = React.useMemo(() => {
        if (playtimeMinutes <= 0) {
            return "0 minutes";
        }

        return `${playtimeMinutes.toLocaleString()} minutes`;
    }, [playtimeMinutes]);

    const playMoveSound = React.useCallback(() => {
        const audio = moveAudioRef.current;
        if (!audio) return;

        audio.currentTime = 0;
        void audio.play().catch((error) => {
            console.debug("Failed to play move sound", error);
        });
    }, []);

    const playGameLaunchSound = React.useCallback(() => {
        const audio = gameLaunchAudioRef.current;
        if (!audio) return;

        audio.currentTime = 0;
        void audio.play().catch((error) => {
            console.debug("Failed to play game launch sound", error);
        });
    }, []);

    React.useEffect(() => {
        const moveAudio = new Audio(moveSound);
        moveAudio.preload = "auto";
        moveAudio.volume = 0.35;
        moveAudioRef.current = moveAudio;

        const launchAudio = new Audio(gameLaunchSound);
        launchAudio.preload = "auto";
        launchAudio.volume = 0.4;
        gameLaunchAudioRef.current = launchAudio;

        return () => {
            moveAudio.pause();
            launchAudio.pause();
            moveAudioRef.current = null;
            gameLaunchAudioRef.current = null;
        };
    }, []);

    const handleBack = React.useCallback(() => {
        const state = window.history.state as { idx?: number } | null;
        if (state && typeof state.idx === "number" && state.idx > 0) {
            navigate(-1);
            return;
        }

        navigate("/overdrive", {
            replace: true,
            state: {
                skipOverdriveIntro: true,
            },
        });
    }, [navigate]);

    const handleLaunch = React.useCallback(async () => {
        if (!game?.id || launching) {
            return;
        }

        if (isGameRunning) {
            try {
                await killGame(game.id);
            } catch (error) {
                console.error("Failed to close game from overdrive details:", error);
            }
            return;
        }

        setLaunching(true);
        playGameLaunchSound();
        try {
            await invoke("launch_game_overdrive", { gameId: game.id });
            startPolling(game.id, game);
        } catch (error) {
            console.error("Failed to launch game from overdrive details:", error);
        } finally {
            setLaunching(false);
        }
    }, [game, launching, isGameRunning, killGame, startPolling, playGameLaunchSound]);

    const activateFocusedAction = React.useCallback(() => {
        if (focusedAction === "back") {
            handleBack();
            return;
        }

        void handleLaunch();
    }, [focusedAction, handleBack, handleLaunch]);

    const moveFocusLeft = React.useCallback(() => {
        setFocusedAction((previous) => {
            if (previous === "back") {
                return previous;
            }

            playMoveSound();
            return "back";
        });
    }, [playMoveSound]);

    const moveFocusRight = React.useCallback(() => {
        setFocusedAction((previous) => {
            if (previous === "play") {
                return previous;
            }

            playMoveSound();
            return "play";
        });
    }, [playMoveSound]);

    useResponsiveGamepad({
        onButtonDown: (button) => {
            if (button === "A") {
                activateFocusedAction();
            } else if (button === "B") {
                handleBack();
            } else if (button === "LB" || button === "LEFT") {
                moveFocusLeft();
            } else if (button === "RB" || button === "RIGHT") {
                moveFocusRight();
            } else if (button === "X") {
                moveFocusLeft();
            } else if (button === "Y") {
                moveFocusRight();
            }
        },
        onDPad: (direction) => {
            if (direction === "LEFT" || direction === "UP") {
                moveFocusLeft();
            } else if (direction === "RIGHT" || direction === "DOWN") {
                moveFocusRight();
            }
        },
    });

    React.useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.altKey || event.ctrlKey || event.metaKey) {
                return;
            }

            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                moveFocusLeft();
            } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                moveFocusRight();
            } else if (event.key === "Tab") {
                event.preventDefault();
                setFocusedAction((previous) => (previous === "play" ? "back" : "play"));
            } else if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activateFocusedAction();
            } else if (event.key === "Escape" || event.key === "Backspace") {
                event.preventDefault();
                handleBack();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [activateFocusedAction, handleBack, moveFocusLeft, moveFocusRight]);

    const hints = React.useMemo<OverdriveHintItem[]>(
        () => [
            { id: "launch", label: isGameRunning ? "Quit" : "Launch", keyLabel: "Enter", controllerButton: "a", onActivate: () => void handleLaunch() },
            { id: "back", label: "Back", keyLabel: "Esc", controllerButton: "b", onActivate: handleBack },
            { id: "focus", label: "Switch Focus", keyLabel: "Arrows", controllerButton: "lb" },
            { id: "menu", label: "Menu", keyLabel: "M", controllerButton: "menu", onActivate: toggleMenu },
        ],
        [handleBack, handleLaunch, isGameRunning, toggleMenu],
    );

    if (loading) {
        return (
            <div className="w-full h-screen bg-black text-white flex items-center justify-center">
                <p className="text-xl text-white/70">Loading game details...</p>
            </div>
        );
    }

    if (!displayGame) {
        return (
            <div className="w-full h-screen bg-black text-white flex flex-col items-center justify-center gap-6 px-6">
                <p className="text-2xl font-semibold">Game not found</p>
                <Button onClick={handleBack} className="text-base px-6 py-5 rounded-xl">
                    Back to Overdrive
                </Button>
            </div>
        );
    }

    const heroImage =
        getImageUrl(
            displayGame.headerArt || displayGame.gridCoverArt || displayGame.coverArt,
        ) || "";
    const iconImage = getImageUrl(displayGame.icon || displayGame.logo) || "";

    return (
        <motion.div
            className="relative w-full h-screen overflow-hidden bg-gray-900 text-white"
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
        >
                <OverdriveTopBar
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                onSearchSubmit={() => {
                    const query = searchQuery.trim();
                    if (query) {
                        navigate(`/overdrive/library?query=${encodeURIComponent(query)}`);
                        return;
                    }
                    navigate("/overdrive/library");
                }}
            />
            <div className="absolute inset-0">
                <div
                    className={cn("absolute inset-x-0 top-0", launching ? "h-full" : "h-[44vh]")}
                    style={{
                        background: heroImage
                            ? `url(${heroImage}) center center / cover no-repeat`
                            : "var(--background)",
                    }}
                />
                <div className={`absolute inset-x-0 top-0 ${launching ? "h-full" : "h-[44vh]"} bg-gradient-to-b from-transparent to-gray-900`} />
                {launching && <div className="absolute inset-x-0 top-0 h-full backdrop-blur-md bg-black/35" />}
                {!launching && (<div className="w-full absolute h-[42vh] px-4 flex flex-row gap-2 items-end">
                    <div className="w-32 h-32 rounded-2xl overflow-hidden border border-white/20 bg-black/40 flex-shrink-0">
                        {iconImage ? (
                            <img
                                src={iconImage}
                                alt={`${displayGame.title} icon`}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center">
                                <Rocket className="w-16 h-16 text-white/45" />
                            </div>
                        )}
                    </div>
                    <h1
                        className="text-4xl font-semibold leading-tight"
                    >
                        {displayGame.title}
                    </h1>
                </div>)}
            </div>

            {!launching && (
                <div className="absolute top-[44vh] inset-x-0">
                    <div className="w-full h-16 bg-gray-800 px-2 shadow-md border-y border-white/10 flex flex-row items-center gap-2">
                        <motion.div
                            animate={
                                focusedAction === "back"
                                    ? {
                                        scale: 1,
                                        opacity: 1,
                                        y: 0,
                                        filter: "brightness(1)",
                                    }
                                    : {
                                        scale: 0.97,
                                        opacity: 0.82,
                                        y: 2,
                                        filter: "brightness(0.88)",
                                    }
                            }
                            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        >
                            <Button
                                onMouseEnter={() => setFocusedAction("back")}
                                onClick={handleBack}
                                variant="outline"
                                className={`cursor-pointer p-6 text-base border-white/20 bg-card/50 hover:bg-card/70 ${focusedAction === "back" ? "ring-2 ring-[var(--theme-accent)]" : ""}`}
                            >
                                <ArrowLeft className="w-5 h-5 mr-2" />
                                Back
                            </Button>
                        </motion.div>
                        <motion.div
                            animate={
                                focusedAction === "play"
                                    ? {
                                        scale: 1,
                                        opacity: 1,
                                        y: 0,
                                        filter: "brightness(1)",
                                    }
                                    : {
                                        scale: 0.97,
                                        opacity: 0.82,
                                        y: 2,
                                        filter: "brightness(0.9)",
                                    }
                            }
                            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        >
                            <Button
                                onMouseEnter={() => setFocusedAction("play")}
                                onClick={() => void handleLaunch()}
                                disabled={launching || (!displayGame.installed && !isGameRunning)}
                                className={`cursor-pointer p-6 text-xl text-white hover:scale-105 hover:shadow-md ${isGameRunning
                                    ? "bg-gradient-to-br from-red-600 to-red-700"
                                    : "bg-[var(--theme-button)]"
                                    } ${focusedAction === "play" ? "ring-2 ring-[var(--theme-accent)]" : ""}`}
                            >
                                {isGameRunning ? (
                                    <Square className="w-6 h-6 mr-3" />
                                ) : (
                                    <Play className="w-6 h-6 mr-3" />
                                )}
                                {launching ? "Playing..." : isGameRunning ? "Quit" : "Play"}
                            </Button>
                        </motion.div>
                        <div className="flex flex-col gap-0 items-start">
                            <p className="text-xs text-white/60 uppercase tracking-[0.16em]">Playtime</p>
                            <div className="flex items-center gap-3">
                                <p className="text-2xl font-semibold">
                                    {playtimeLabel}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {launching && (
                <div className="absolute inset-0 z-40 flex items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0, y: 32 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                        className="px-10 py-8 flex flex-col items-center gap-4"
                    >
                        <p className="text-md font-thin text-white/70">
                            LAUNCHING...
                        </p>
                        <p className="text-2xl text-white">
                            {displayGame.title}
                        </p>
                        <svg width="48" height="48" stroke="var(--theme-accent)" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><g><circle cx="12" cy="12" r="9.5" fill="none" stroke-width="3" stroke-linecap="round"><animate attributeName="stroke-dasharray" dur="1.5s" calcMode="spline" values="0 150;42 150;42 150;42 150" keyTimes="0;0.475;0.95;1" keySplines="0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1" repeatCount="indefinite" /><animate attributeName="stroke-dashoffset" dur="1.5s" calcMode="spline" values="0;-16;-59;-59" keyTimes="0;0.475;0.95;1" keySplines="0.42,0,0.58,1;0.42,0,0.58,1;0.42,0,0.58,1" repeatCount="indefinite" /></circle><animateTransform attributeName="transform" type="rotate" dur="2s" values="0 12 12;360 12 12" repeatCount="indefinite" /></g></svg>                    </motion.div>
                </div>
            )}

            {!launching && <OverdriveNavigationHints items={hints} />}
        </motion.div>
    );
};

export default OverdriveGameDetails;
