import React from "react";
import { useLocation, useParams } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";


const LaunchGame = () => {

    const { gameId } = useParams();
    const location = useLocation();
    const launchId = React.useMemo(() => {
        const params = new URLSearchParams(location.search);
        return params.get("launchId") || "";
    }, [location.search]);

    const [game, setGame] =
        React.useState<any>(null);

    const [status, setStatus] =
        React.useState(
            "Launching..."
        );

    const closeTimerRef = React.useRef<number | null>(null);


    React.useEffect(() => {
        setStatus("Launching...");
        setGame(null);

        if (closeTimerRef.current !== null) {
            window.clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }

        async function init() {

            const { invoke } =
                await import("@tauri-apps/api/core");


            const gameData =
                await invoke(
                    "get_game_details",
                    { gameId }
                );


            setGame(gameData);
        }


        init();


        let cleanup: (() => void) | undefined;


        async function setupListener() {

            cleanup = await listen(
                "game-launch-status",
                async (event: any) => {

                    const data = event.payload;

                    if (launchId && data.launchId !== launchId) {
                        return;
                    }

                    if (gameId && data.gameId && data.gameId !== gameId) {
                        return;
                    }

                    setStatus(
                        data.message
                    );

                    if (
                        data.status === "started"
                    ) {
                        if (closeTimerRef.current !== null) {
                            window.clearTimeout(closeTimerRef.current);
                        }

                        closeTimerRef.current = window.setTimeout(
                            async () => {
                                await getCurrentWindow()
                                    .close();
                            },
                            800
                        );
                    }

                    if (data.status === "error") {
                        if (closeTimerRef.current !== null) {
                            window.clearTimeout(closeTimerRef.current);
                        }

                        closeTimerRef.current = window.setTimeout(
                            async () => {
                                await getCurrentWindow().close();
                            },
                            1200
                        );
                    }
                }
            );
        }


        setupListener();


        return () => {
            if (closeTimerRef.current !== null) {
                window.clearTimeout(closeTimerRef.current);
                closeTimerRef.current = null;
            }

            cleanup?.();
        };

    }, [gameId, launchId]);


    return (
        <div
            className="
                h-screen
                w-screen
                bg-background
                flex
                items-center
                justify-center
                overflow-hidden
            "
        >

            <img
                src={game?.coverArt}
                className="
                    absolute
                    inset-0
                    w-full
                    h-full
                    object-cover
                    opacity-20
                    scale-105
                "
            />


            <div
                className="
                    relative
                    flex
                    items-center
                    gap-4
                    backdrop-blur-md
                    p-6
                    rounded-xl
                "
            >

                <img
                    src={game?.gridCoverArt}
                    className="
                        w-[150px]
                        rounded-lg
                    "
                />


                <div>
                    <div className="text-shimmer">
                        {status}
                    </div>

                    <div className="text-xl">
                        {game?.title}
                    </div>
                </div>

            </div>

        </div>
    );
};


export default LaunchGame;
