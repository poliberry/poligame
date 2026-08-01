import React, { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuthStore } from "@/stores/authStore";
import { ExternalLink, Palette, Search, Settings, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { isPostHogInitialized, posthog } from "@/lib/posthog";

interface SteamGridDbArtworkSelectionEvent {
  requestId: string;
  artwork?: {
    customLogo?: string;
    customHeroArt?: string;
    customGridCoverArt?: string;
  };
  gameId?: number;
  gameName?: string;
}

interface GameCustomizationWindowProps {
  gameId: string;
  onClose: () => void;
}

export const GameCustomizationWindow: React.FC<
  GameCustomizationWindowProps
> = ({ gameId, onClose }) => {
  const { user } = useAuthStore();
  const [customCoverArt, setCustomCoverArt] = useState<string | null>(null);
  const [customGridCoverArt, setCustomGridCoverArt] = useState<string | null>(
    null,
  );
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [customHeroArt, setCustomHeroArt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [game, setGame] = useState<any>(null);
  const [executablePath, setExecutablePath] = useState("");
  const [launchArguments, setLaunchArguments] = useState("");
  const [isCustomApp, setIsCustomApp] = useState(false);
  const [steamGridDbGameId, setSteamGridDbGameId] = useState<number | null>(null);
  const [steamGridDbSearchQuery, setSteamGridDbSearchQuery] = useState("");
  const [pickerRequestId, setPickerRequestId] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<"general" | "artwork">(
    "general",
  );

  // Track original values to detect changes
  const [originalGame, setOriginalGame] = useState<any>(null);
  const [originalExecutablePath, setOriginalExecutablePath] = useState("");
  const [originalLaunchArguments, setOriginalLaunchArguments] = useState("");
  const [originalCustomCoverArt, setOriginalCustomCoverArt] = useState<
    string | null
  >(null);
  const [originalCustomGridCoverArt, setOriginalCustomGridCoverArt] = useState<
    string | null
  >(null);
  const [originalCustomLogo, setOriginalCustomLogo] = useState<string | null>(
    null,
  );
  const [originalCustomHeroArt, setOriginalCustomHeroArt] = useState<
    string | null
  >(null);

  // Check if form has unsaved changes
  const hasUnsavedChanges = () => {
    if (!game || !originalGame) return false;

    // Check game title changes
    if (game.title !== originalGame.title) return true;

    // Check executable path changes (for custom apps)
    if (isCustomApp && executablePath !== originalExecutablePath) return true;

    // Check launch argument changes (for custom apps)
    if (isCustomApp && launchArguments !== originalLaunchArguments) return true;

    // Check artwork changes
    if (customCoverArt !== originalCustomCoverArt) return true;
    if (customGridCoverArt !== originalCustomGridCoverArt) return true;
    if (customLogo !== originalCustomLogo) return true;
    if (customHeroArt !== originalCustomHeroArt) return true;

    return false;
  };

  const coverInputRef = useRef<HTMLInputElement>(null);
  const gridInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);

  const updateCustomization = useMutation(
    api.gameCustomizations.updateGameCustomization,
  );
  const customization = useQuery(
    api.gameCustomizations.getGameCustomization,
    user?.userId && gameId
      ? { userId: user.userId as unknown as Id<"users">, gameId }
      : "skip",
  );

  // Fetch game details to check if it's a custom app
  useEffect(() => {
    const fetchGame = async () => {
      try {
        const gameData = await invoke<any>("get_game_details", { gameId });
        setGame(gameData);
        setOriginalGame(gameData);
        setIsCustomApp(gameData?.launcher === "custom");
        if (gameData?.launcher === "custom" && gameData?.path) {
          setExecutablePath(gameData.path);
          setOriginalExecutablePath(gameData.path);
        }
        const gameLaunchArguments = gameData?.metadata?.launchArguments || "";
        setLaunchArguments(gameLaunchArguments);
        setOriginalLaunchArguments(gameLaunchArguments);
      } catch (error) {
        console.error("Error fetching game:", error);
      }
    };
    fetchGame();
  }, [gameId]);

  useEffect(() => {
    if (customization) {
      const coverArt = customization.customCoverArt || null;
      const gridCoverArt = customization.customGridCoverArt || null;
      const logo = customization.customLogo || null;
      const heroArt = customization.customHeroArt || null;

      setCustomCoverArt(coverArt);
      setCustomGridCoverArt(gridCoverArt);
      setCustomLogo(logo);
      setCustomHeroArt(heroArt);

      // Store original values
      setOriginalCustomCoverArt(coverArt);
      setOriginalCustomGridCoverArt(gridCoverArt);
      setOriginalCustomLogo(logo);
      setOriginalCustomHeroArt(heroArt);
    }
  }, [customization]);

  useEffect(() => {
    if (!game?.title) {
      return;
    }

    setSteamGridDbSearchQuery((currentQuery) => currentQuery || game.title);
  }, [game?.title]);

  const handleImageUpload = (
    file: File | null,
    setter: (value: string | null) => void,
  ) => {
    if (!file) {
      setter(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be less than 5MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setter(reader.result as string);
      setError(null);
    };
    reader.onerror = () => {
      setError("Failed to read image file");
    };
    reader.readAsDataURL(file);
  };

  const handleSelectExecutable = async () => {
    try {
      console.log("Opening file dialog...");
      const selected = await open({
        multiple: false,
        directory: false,
      });

      console.log("Dialog result:", selected);

      if (selected) {
        if (typeof selected === "string") {
          setExecutablePath(selected);
          console.log("Selected file:", selected);
        } else if (Array.isArray(selected)) {
          const firstPath = selected[0];
          if (firstPath && typeof firstPath === "string") {
            setExecutablePath(firstPath);
            console.log("Selected file:", firstPath);
          }
        }
      } else {
        console.log("No file selected");
      }
    } catch (error: any) {
      console.error("Error selecting executable:", error);
      toast.error(
        error.message ||
          "Failed to select executable. Please check the console for details.",
      );
    }
  };

  const openSteamGridDbPicker = async () => {
    const requestId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `sgdb-${Date.now()}`;

    setPickerRequestId(requestId);

    try {
      await invoke("create_steamgriddb_picker_window", {
        requestId,
        query: steamGridDbSearchQuery || game?.title,
        gameTitle: game?.title,
      });
    } catch (error: any) {
      console.error("Failed to open SteamGridDB picker", error);
      toast.error(error?.message || "Failed to open SteamGridDB picker");
    }
  };

  useEffect(() => {
    if (!pickerRequestId) {
      return;
    }

    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      unlisten = await listen<SteamGridDbArtworkSelectionEvent>(
        "steamgriddb-artwork-selected",
        (event) => {
          const payload = event.payload;
          if (!payload || payload.requestId !== pickerRequestId) {
            return;
          }

          if (payload.artwork?.customGridCoverArt) {
            setCustomGridCoverArt(payload.artwork.customGridCoverArt);
          }
          if (payload.artwork?.customLogo) {
            setCustomLogo(payload.artwork.customLogo);
          }
          if (payload.artwork?.customHeroArt) {
            setCustomHeroArt(payload.artwork.customHeroArt);
          }

          if (payload.gameId) {
            setSteamGridDbGameId(payload.gameId);
          }
          if (payload.gameName) {
            setSteamGridDbSearchQuery(payload.gameName);
          }

          toast.success("SteamGridDB artwork applied");
        },
      );
    };

    void setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [pickerRequestId]);

  const handleSave = async () => {
    if (!user?.userId) {
      setError("You must be logged in to customize games");
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      // Update game name if it's a custom app and name changed
      if (isCustomApp && game?.title && game.title !== originalGame?.title) {
        try {
          await invoke("update_custom_app_name", {
            gameId,
            title: game.title,
          });
          setOriginalGame({ ...game });
          toast.success("Game name updated");
        } catch (err: any) {
          console.error("Error updating name:", err);
          toast.error(err.message || "Failed to update game name");
        }
      }

      // Update executable path if it's a custom app and path changed
      if (
        isCustomApp &&
        executablePath &&
        executablePath !== originalExecutablePath
      ) {
        try {
          await invoke("update_custom_app_executable", {
            gameId,
            executablePath,
          });
          setOriginalExecutablePath(executablePath);
          toast.success("Executable path updated");
        } catch (err: any) {
          console.error("Error updating executable:", err);
          toast.error(err.message || "Failed to update executable path");
        }
      }

      // Update launch arguments if it's a custom app and arguments changed
      if (isCustomApp && launchArguments !== originalLaunchArguments) {
        try {
          await invoke("update_custom_app_arguments", {
            gameId,
            launchArguments: launchArguments.trim() || null,
          });
          setOriginalLaunchArguments(launchArguments);
          toast.success("Launch arguments updated");
        } catch (err: any) {
          console.error("Error updating launch arguments:", err);
          toast.error(err.message || "Failed to update launch arguments");
        }
      }

      // For both custom apps and launcher games, save artwork to Convex
      await updateCustomization({
        gameId,
        userId: user.userId as unknown as Id<"users">,
        customCoverArt: customCoverArt || undefined,
        customGridCoverArt: customGridCoverArt || undefined,
        customLogo: customLogo || undefined,
        customHeroArt: customHeroArt || undefined,
      });

      // Update original values after successful save
      setOriginalCustomCoverArt(customCoverArt);
      setOriginalCustomGridCoverArt(customGridCoverArt);
      setOriginalCustomLogo(customLogo);
      setOriginalCustomHeroArt(customHeroArt);

      if (isPostHogInitialized) {
        posthog.capture("game_customization_saved", {
          game_id: gameId,
          is_custom_app: isCustomApp,
          has_cover_art: Boolean(customCoverArt),
          has_grid_cover_art: Boolean(customGridCoverArt),
          has_logo: Boolean(customLogo),
          has_hero_art: Boolean(customHeroArt),
        });
      }
      toast.success("Customizations saved");
    } catch (err: any) {
      setError(err.message || "Failed to save customizations");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevert = () => {
    if (!originalGame) return;

    // Revert game title
    setGame({ ...originalGame });

    // Revert executable path
    if (isCustomApp) {
      setExecutablePath(originalExecutablePath);
      setLaunchArguments(originalLaunchArguments);
    }

    // Revert artwork
    setCustomCoverArt(originalCustomCoverArt);
    setCustomGridCoverArt(originalCustomGridCoverArt);
    setCustomLogo(originalCustomLogo);
    setCustomHeroArt(originalCustomHeroArt);

    // Reset file inputs
    if (coverInputRef.current) coverInputRef.current.value = "";
    if (gridInputRef.current) gridInputRef.current.value = "";
    if (logoInputRef.current) logoInputRef.current.value = "";
    if (heroInputRef.current) heroInputRef.current.value = "";

    toast.success("Changes reverted");
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const window = getCurrentWindow();
      const windowLabel = window.label;
      console.log("Window label:", windowLabel);
      await invoke("close_game_customization_window", {
        windowLabel: windowLabel,
      });
    } catch (error) {
      console.debug(
        "Window controls not available (running in browser)",
        error,
      );
      // Fallback to onClose callback
      onClose();
    }
  };

  return (
    <div className="w-full h-screen flex flex-col bg-background text-white overflow-y-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between bg-[var(--theme-background)] py-0.5 px-2 z-[50] drag-region"
        data-tauri-drag-region
      >
        <div className="flex-1 flex-grow">
          <h1
            className="text-sm font-light text-muted-foreground p-2 select-none"
          >
            Customise {game?.title}
          </h1>
        </div>
        <div
          className="flex items-center gap-2 no-drag-region"
          data-tauri-drag-region="false"
        >
          <button
            onClick={handleClose}
            className="p-2 hover:bg-red-500/20 rounded transition-colors cursor-pointer"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex flex-row w-full h-full">
        <div className="flex flex-col w-1/3 min-h-full">
          <img
            src={`${customHeroArt || game?.heroArt || game?.coverArt}`}
            alt={`${game?.title} Cover Art`}
            className="w-full h-full absolute top-0 left-0 object-cover"
          />
          <div className="flex flex-col backdrop-blur-md bg-black/40 p-4 gap-2 z-[10] relative h-full">
            <Button
              variant="outline"
              className="w-full justify-start border-none rounded-full cursor-pointer"
              onClick={() => setSelectedTab("general")}
            >
              <span
                className="text-sm font-medium text-foreground flex flex-row items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                General
              </span>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-none rounded-full cursor-pointer"
              onClick={() => setSelectedTab("artwork")}
            >
              <span
                className="text-sm font-medium text-foreground flex flex-row items-center gap-2"
              >
                <Palette className="w-4 h-4" />
                Artwork
              </span>
            </Button>
          </div>
        </div>
        <div className="flex flex-col w-2/3 h-full z-[10] bg-[var(--theme-background)] overflow-y-auto">
          <form className="flex flex-col gap-6 p-4">
            {selectedTab === "general" && (
              <div className="space-y-6">
                <h2
                  className="text-lg font-light text-white"
                >
                  General
                </h2>

                {/* Game Name - only for custom apps */}
                {isCustomApp && (
                  <div className="space-y-2">
                    <Label className="text-sm text-white/80">Game Name</Label>
                    <Input
                      value={game?.title || ""}
                      onChange={(e) =>
                        setGame({ ...game, title: e.target.value })
                      }
                      className="bg-black/40 border-white/20 text-white"
                    />
                  </div>
                )}

                {/* Executable Path Editor for Custom Apps */}
                {isCustomApp && (
                  <div className="space-y-2">
                    <Label className="text-sm text-white/80">
                      Executable Path
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={executablePath}
                        onChange={(e) => setExecutablePath(e.target.value)}
                        placeholder="Select executable file"
                        className="flex-1 bg-black/40 border-white/20 text-white"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSelectExecutable}
                      >
                        Browse
                      </Button>
                    </div>
                    <p className="text-xs text-white/50">
                      Change the executable path for this custom app
                    </p>
                  </div>
                )}

                {isCustomApp && (
                  <div className="space-y-2">
                    <Label className="text-sm text-white/80">
                      Launch Arguments
                    </Label>
                    <Input
                      value={launchArguments}
                      onChange={(e) => setLaunchArguments(e.target.value)}
                      placeholder='Example: -novid +exec "my config.cfg"'
                      className="bg-black/40 border-white/20 text-white"
                    />
                    <p className="text-xs text-white/50">
                      Optional command line arguments passed when this app launches
                    </p>
                  </div>
                )}
              </div>
            )}

            {selectedTab === "artwork" && (
              <div className="space-y-6 pb-20">
                <h2
                  className="text-lg font-light text-white"
                >
                  Artwork
                </h2>

                <div className="flex flex-col gap-4 pb-10">
                  {/* Cover Art */}
                  <div>
                    <label className="text-sm text-white/80 mb-2 block">
                      Cover Art
                    </label>
                    <div className="flex gap-4 items-start">
                      {customCoverArt && (
                        <img
                          src={customCoverArt}
                          alt="Cover Art Preview"
                          className="w-32 h-48 object-cover rounded border border-white/20"
                        />
                      )}
                      <div className="flex flex-col gap-2 flex-1">
                        <input
                          ref={coverInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleImageUpload(
                              e.target.files?.[0] || null,
                              setCustomCoverArt,
                            )
                          }
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => coverInputRef.current?.click()}
                        >
                          <Upload size={14} className="mr-2" />
                          {customCoverArt
                            ? "Change Cover Art"
                            : "Upload Cover Art"}
                        </Button>
                        {customCoverArt && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setCustomCoverArt(null);
                              if (coverInputRef.current)
                                coverInputRef.current.value = "";
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Grid Cover Art */}
                  <div>
                    <label className="text-sm text-white/80 mb-2 block">
                      Grid Cover Art
                    </label>
                    <div className="flex gap-4 items-start">
                      {customGridCoverArt && (
                        <img
                          src={customGridCoverArt}
                          alt="Grid Cover Art Preview"
                          className="w-[200px] h-[300px] max-w-full object-contain rounded border border-white/20 bg-white/5 p-1"
                        />
                      )}
                      <div className="flex flex-col gap-2 flex-1">
                        <input
                          ref={gridInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleImageUpload(
                              e.target.files?.[0] || null,
                              setCustomGridCoverArt,
                            )
                          }
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => gridInputRef.current?.click()}
                        >
                          <Upload size={14} className="mr-2" />
                          {customGridCoverArt
                            ? "Change Grid Cover Art"
                            : "Upload Grid Cover Art"}
                        </Button>
                        {customGridCoverArt && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setCustomGridCoverArt(null);
                              if (gridInputRef.current)
                                gridInputRef.current.value = "";
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Logo */}
                  <div>
                    <label className="text-sm text-white/80 mb-2 block">
                      Logo
                    </label>
                    <div className="flex gap-4 items-start">
                      {customLogo && (
                        <img
                          src={customLogo}
                          alt="Logo Preview"
                          className="w-32 h-32 object-contain rounded border border-white/20 bg-white/5 p-2"
                        />
                      )}
                      <div className="flex flex-col gap-2 flex-1">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleImageUpload(
                              e.target.files?.[0] || null,
                              setCustomLogo,
                            )
                          }
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => logoInputRef.current?.click()}
                        >
                          <Upload size={14} className="mr-2" />
                          {customLogo ? "Change Logo" : "Upload Logo"}
                        </Button>
                        {customLogo && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setCustomLogo(null);
                              if (logoInputRef.current)
                                logoInputRef.current.value = "";
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Hero Art */}
                  <div>
                    <label className="text-sm text-white/80 mb-2 block">
                      Hero Art (Header)
                    </label>
                    <div className="flex gap-4 items-start">
                      {customHeroArt && (
                        <img
                          src={customHeroArt}
                          alt="Hero Art Preview"
                          className="w-64 h-32 object-cover rounded border border-white/20"
                        />
                      )}
                      <div className="flex flex-col gap-2 flex-1">
                        <input
                          ref={heroInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleImageUpload(
                              e.target.files?.[0] || null,
                              setCustomHeroArt,
                            )
                          }
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => heroInputRef.current?.click()}
                        >
                          <Upload size={14} className="mr-2" />
                          {customHeroArt
                            ? "Change Hero Art"
                            : "Upload Hero Art"}
                        </Button>
                        {customHeroArt && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setCustomHeroArt(null);
                              if (heroInputRef.current)
                                heroInputRef.current.value = "";
                            }}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/10 bg-black/20 p-4 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-medium text-white">
                          SteamGridDB search
                        </h3>
                        <p className="text-xs text-white/50">
                          Search community artwork, preview the match, and apply grid, logo, hero, and icon assets.
                        </p>
                      </div>
                      {steamGridDbGameId ? (
                        <a
                          href={`https://www.steamgriddb.com/game/${steamGridDbGameId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-cyan-300 hover:text-cyan-200 flex items-center gap-1 shrink-0"
                        >
                          Open source
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        value={steamGridDbSearchQuery}
                        onChange={(e) => setSteamGridDbSearchQuery(e.target.value)}
                        placeholder="Search by game title (used by picker)"
                        className="flex-1 bg-black/40 border-white/20 text-white"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={openSteamGridDbPicker}
                      >
                        <Search className="mr-2 h-4 w-4" />
                        Open Picker
                      </Button>
                    </div>

                    {steamGridDbGameId && (
                      <p className="text-xs text-white/50">
                        Selected SteamGridDB entry: {steamGridDbGameId}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="text-red-400 text-sm bg-red-500/20 border border-red-500/50 rounded p-2">
                {error}
              </div>
            )}
          </form>
        </div>

        {/* Save/Revert Bar - appears when there are unsaved changes */}
        {hasUnsavedChanges() && (
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 shadow-lg z-50">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground/80">
                  You have unsaved changes
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRevert}
                  disabled={isSaving}
                >
                  Revert
                </Button>
                <Button type="button" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
