import React, { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalLink, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

type ArtworkField = "customLogo" | "customHeroArt" | "customGridCoverArt";

type SteamGridDbSearchResult = {
    id: number;
    name: string;
    verified: boolean;
    gameTypes: string[];
    releaseDate?: number | null;
    url: string;
};

type ArtworkOption = {
    id: number;
    url: string;
    thumb: string;
    width: number;
    height: number;
    score: number;
    style: string;
};

type GameArtworkOptions = {
    gridCoverArt: ArtworkOption[];
    logos: ArtworkOption[];
    headerArt: ArtworkOption[];
};

type SelectedArtwork = Partial<Record<ArtworkField, string>>;

const TAB_TO_FIELD: Record<string, ArtworkField> = {
    icons: "customLogo",
    header: "customHeroArt",
    grid: "customGridCoverArt",
};

export const SteamGridDbPickerWindow: React.FC = () => {
    const [searchParams] = useSearchParams();
    const requestId = searchParams.get("requestId") || "";
    const initialQuery = searchParams.get("query") || searchParams.get("title") || "";

    const [searchQuery, setSearchQuery] = useState(initialQuery);
    const [results, setResults] = useState<SteamGridDbSearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedGame, setSelectedGame] = useState<SteamGridDbSearchResult | null>(null);
    const [options, setOptions] = useState<GameArtworkOptions | null>(null);
    const [isLoadingOptions, setIsLoadingOptions] = useState(false);
    const [activeTab, setActiveTab] = useState("icons");
    const [selectedArtwork, setSelectedArtwork] = useState<SelectedArtwork>({});

    const selectedCount = useMemo(
        () => Object.values(selectedArtwork).filter(Boolean).length,
        [selectedArtwork],
    );

    const closeWindow = async () => {
        try {
            const window = getCurrentWindow();
            await window.close();
        } catch (error) {
            console.debug("Failed to close SteamGridDB picker window", error);
        }
    };

    const handleSearch = async () => {
        const query = searchQuery.trim();
        if (!query) {
            toast.error("Enter a game name to search SteamGridDB");
            return;
        }

        setIsSearching(true);
        try {
            const searchResults = await invoke<SteamGridDbSearchResult[]>("search_steamgriddb_games", {
                query,
            });
            setResults(searchResults);
            if (searchResults.length === 0) {
                toast.info("No matches found for that search.");
            }
        } catch (error: any) {
            console.error("SteamGridDB search failed", error);
            toast.error(error?.message || "Failed to search SteamGridDB");
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        if (!initialQuery.trim()) {
            return;
        }

        void handleSearch();
        // Run once for the initial query passed by the parent window.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadArtworkOptions = async (game: SteamGridDbSearchResult) => {
        setIsLoadingOptions(true);
        setSelectedGame(game);
        setSelectedArtwork({});

        try {
            const fetchedOptions = await invoke<GameArtworkOptions>("get_steamgriddb_artwork_options", {
                gameId: game.id,
            });
            setOptions(fetchedOptions);
            if (
                fetchedOptions.logos.length === 0 &&
                fetchedOptions.headerArt.length === 0 &&
                fetchedOptions.gridCoverArt.length === 0
            ) {
                toast.info("This game has no artwork options in SteamGridDB right now.");
            }
        } catch (error: any) {
            console.error("Failed to load SteamGridDB artwork options", error);
            toast.error(error?.message || "Failed to load artwork options");
            setOptions(null);
        } finally {
            setIsLoadingOptions(false);
        }
    };

    const selectArtwork = (field: ArtworkField, url: string) => {
        setSelectedArtwork((current) => ({
            ...current,
            [field]: url,
        }));
    };

    const applySelection = async () => {
        if (!requestId) {
            toast.error("Missing request id for picker response");
            return;
        }

        if (!selectedArtwork.customLogo && !selectedArtwork.customHeroArt && !selectedArtwork.customGridCoverArt) {
            toast.error("Select at least one artwork before applying");
            return;
        }

        await emit("steamgriddb-artwork-selected", {
            requestId,
            artwork: selectedArtwork,
            gameId: selectedGame?.id,
            gameName: selectedGame?.name,
        });

        await closeWindow();
    };

    const tabOptions: Record<string, ArtworkOption[]> = {
        icons: options?.logos || [],
        header: options?.headerArt || [],
        grid: options?.gridCoverArt || [],
    };

    const renderTab = (tab: "icons" | "header" | "grid") => {
        const field = TAB_TO_FIELD[tab];
        const items = tabOptions[tab];
        const selected = selectedArtwork[field];
        const isIconsTab = tab === "icons";
        const isHeaderTab = tab === "header";
        const isGridTab = tab === "grid";

        if (isLoadingOptions) {
            return (
                <div className="flex h-full min-h-0 items-center justify-center text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading artwork options...
                </div>
            );
        }

        if (!selectedGame) {
            return (
                <div className="flex h-full min-h-0 items-center justify-center text-sm text-muted-foreground">
                    Search and pick a game to browse artwork.
                </div>
            );
        }

        if (items.length === 0) {
            return (
                <div className="flex h-full min-h-0 items-center justify-center text-sm text-muted-foreground">
                    No {tab} artwork available for this game.
                </div>
            );
        }

        return (
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
                <div
                    className={
                        isIconsTab
                            ? "grid min-h-0 flex-1 grid-cols-7 justify-items-center gap-3 overflow-y-auto pr-1 content-view-scrollbar"
                            : isHeaderTab
                                ? "grid min-h-0 flex-1 grid-cols-3 justify-items-center gap-3 overflow-y-auto pr-1 content-view-scrollbar"
                                : "grid min-h-0 flex-1 grid-cols-6 gap-3 overflow-y-auto pr-1 content-view-scrollbar min-w-full"
                    }
                >
                    {items.map((item) => {
                        const isActive = selected === item.url;
                        return (
                            <button
                                key={`${tab}-${item.id}`}
                                type="button"
                                onClick={() => selectArtwork(field, item.url)}
                                className={`border rounded-md overflow-hidden text-left transition-colors ${isIconsTab
                                        ? "w-[128px] h-[128px] flex flex-col"
                                        : isHeaderTab
                                            ? "w-full aspect-[16/9] flex flex-col"
                                            : "relative w-[150px] h-[250px]"
                                    } ${isActive ? "border-[var(--theme-accent)]" : "border-border hover:border-foreground/50"
                                    }`}
                            >
                                <div
                                    className={
                                        isIconsTab
                                            ? "flex w-full h-full items-center justify-center bg-black/20 p-1"
                                            : isHeaderTab
                                                ? "flex w-full h-full items-center justify-center bg-black/20 p-1"
                                                : "absolute inset-0 flex w-full h-full items-stretch justify-stretch"
                                    }
                                >
                                    <img
                                        src={item.thumb || item.url}
                                        alt={`${tab} option ${item.id}`}
                                        className={
                                            isGridTab
                                                ? "h-full w-full object-contain"
                                                : "max-h-full max-w-full object-contain"
                                        }
                                    />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="w-full h-screen overflow-hidden bg-background text-foreground flex flex-col">
            <div className="drag-region flex items-center justify-between border-b px-2 py-1">
                <h1 className="text-sm font-light text-muted-foreground">SteamGridDB Artwork Picker</h1>
                <Button type="button" variant="ghost" size="icon" onClick={() => void closeWindow()}>
                    <X className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-none p-3 border-b space-y-3">
                <div className="flex gap-2">
                    <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search game title"
                        className="rounded-full border-none"
                    />
                    <Button type="button" variant="outline" className="rounded-full border-none" onClick={() => void handleSearch()}>
                        {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                </div>

                {results.length > 0 && (
                    <div className="max-h-44 overflow-y-auto content-view-scrollbar border rounded-md">
                        {results.slice(0, 10).map((result) => (
                            <button
                                type="button"
                                key={result.id}
                                onClick={() => void loadArtworkOptions(result)}
                                className={`w-full px-3 py-2 text-left border-b last:border-b-0 hover:bg-muted/30 ${selectedGame?.id === result.id ? "bg-muted/30" : ""}`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm truncate">{result.name}</span>
                                    <span className="text-[10px] text-muted-foreground">#{result.id}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {selectedGame && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Selected: {selectedGame.name}</span>
                        <a href={selectedGame.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300">
                            Open
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    </div>
                )}
            </div>

            <div className="flex min-h-0 flex-1 p-3 overflow-hidden">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 h-full w-full min-w-0 flex-col">
                    <TabsList className="grid w-full flex-none grid-cols-3 rounded-full border-none bg-muted/20 p-1">
                        <TabsTrigger value="icons" className="w-full rounded-full">Icon Artwork</TabsTrigger>
                        <TabsTrigger value="header" className="w-full rounded-full">Header Art</TabsTrigger>
                        <TabsTrigger value="grid" className="w-full rounded-full">Grid Cover Art</TabsTrigger>
                    </TabsList>
                    <div className="flex min-h-0 flex-1 w-full pt-3 overflow-hidden">
                        {renderTab(activeTab as "icons" | "header" | "grid")}
                    </div>
                </Tabs>
            </div>

            <div className="flex-none border-t p-3 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Selected fields: {selectedCount}</p>
                <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" className="rounded-full border-none" onClick={() => void closeWindow()}>
                        Cancel
                    </Button>
                    <Button type="button" className="rounded-full border-none" onClick={() => void applySelection()}>
                        Apply Selected Art
                    </Button>
                </div>
            </div>
        </div>
    );
};
