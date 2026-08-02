import React, { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/authStore";
import { ExternalLink, Loader2, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { isPostHogInitialized, posthog } from "@/lib/posthog";

interface InstalledProgram {
  name: string;
  executablePath: string;
  installLocation?: string | null;
  publisher?: string | null;
  source?: string;
}

interface AddCustomAppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
  standaloneWindow?: boolean;
}

interface SelectedSteamGridArtwork {
  customCoverArt?: string;
  customGridCoverArt?: string;
  customLogo?: string;
  customHeroArt?: string;
}

interface SteamGridDbArtworkSelectionEvent {
  requestId: string;
  artwork?: SelectedSteamGridArtwork;
  gameId?: number;
  gameName?: string;
}

export const AddCustomAppDialog: React.FC<AddCustomAppDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
  standaloneWindow = false,
}) => {
  const { user } = useAuthStore();
  const updateCustomization = useMutation(
    api.gameCustomizations.updateGameCustomization,
  );

  const [mode, setMode] = useState<"installed" | "custom">("installed");
  const [title, setTitle] = useState("");
  const [executablePath, setExecutablePath] = useState("");
  const [launchArguments, setLaunchArguments] = useState("");
  const [installedPrograms, setInstalledPrograms] = useState<InstalledProgram[]>([]);
  const [programSearch, setProgramSearch] = useState("");
  const [isLoadingPrograms, setIsLoadingPrograms] = useState(false);
  const [steamGridDbQuery, setSteamGridDbQuery] = useState("");
  const [selectedSteamGridDbGameId, setSelectedSteamGridDbGameId] = useState<
    number | null
  >(null);
  const [selectedSteamGridDbArtwork, setSelectedSteamGridDbArtwork] =
    useState<SelectedSteamGridArtwork | null>(null);
  const [pickerRequestId, setPickerRequestId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedPrograms, setHasLoadedPrograms] = useState(false);

  const loadInstalledPrograms = async () => {
    setIsLoadingPrograms(true);
    try {
      const programs = await invoke<InstalledProgram[]>("get_installed_programs");
      setInstalledPrograms(programs);
      setHasLoadedPrograms(true);
      if (programs.length === 0) {
        toast.info("No launchable installed apps were detected. You can still browse for an executable.");
      }
    } catch (error: any) {
      console.error("Error loading installed programs:", error);
      toast.error(error.message || "Failed to detect installed apps");
      setMode("custom");
    } finally {
      setIsLoadingPrograms(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setMode("installed");
    setTitle("");
    setExecutablePath("");
    setLaunchArguments("");
    setProgramSearch("");
    setSteamGridDbQuery("");
    setSelectedSteamGridDbGameId(null);
    setSelectedSteamGridDbArtwork(null);
    setInstalledPrograms([]);
    setHasLoadedPrograms(false);

    loadInstalledPrograms();
  }, [isOpen]);

  const filteredPrograms = useMemo(() => {
    const query = programSearch.trim().toLowerCase();
    if (!query) {
      return installedPrograms;
    }

    return installedPrograms.filter((program) => {
      const haystack = [
        program.name,
        program.executablePath,
        program.installLocation,
        program.publisher,
        program.source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [installedPrograms, programSearch]);

  const handleSelectInstalledProgram = (program: InstalledProgram) => {
    setTitle(program.name);
    setExecutablePath(program.executablePath);
    setLaunchArguments("");
    setSteamGridDbQuery(program.name);
    toast.success(`Selected ${program.name}`);
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
        query: steamGridDbQuery || title,
        gameTitle: title || undefined,
      });
    } catch (error: any) {
      console.error("Error opening SteamGridDB picker window", error);
      toast.error(error?.message || "Failed to open SteamGridDB picker");
    }
  };

  useEffect(() => {
    if (!isOpen || !pickerRequestId) {
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

          const artwork = payload.artwork || {};
          setSelectedSteamGridDbArtwork((current) => ({
            ...current,
            ...artwork,
            customCoverArt:
              artwork.customCoverArt || current?.customCoverArt,
            customGridCoverArt:
              artwork.customGridCoverArt || current?.customGridCoverArt,
            customLogo: artwork.customLogo || current?.customLogo,
            customHeroArt: artwork.customHeroArt || current?.customHeroArt,
          }));

          if (payload.gameId) {
            setSelectedSteamGridDbGameId(payload.gameId);
          }
          if (payload.gameName) {
            setSteamGridDbQuery(payload.gameName);
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
  }, [isOpen, pickerRequestId]);


  const handleSelectExecutable = async () => {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
      });

      if (selected) {
        if (typeof selected === "string") {
          setExecutablePath(selected);
        } else if (Array.isArray(selected) && (selected as string[]).length > 0) {
          setExecutablePath(selected[0]);
        }
      }
    } catch (error: any) {
      console.error("Error selecting executable:", error);
      toast.error(error.message || "Failed to select executable. Please check the console for details.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!executablePath.trim()) {
      toast.error("Please select an executable");
      return;
    }

    setIsLoading(true);
    try {
      const gameId = await invoke<string>("add_custom_app", {
        title: title.trim(),
        executablePath: executablePath.trim(),
        launchArguments: launchArguments.trim() || null,
      });

      if (user?.userId && selectedSteamGridDbArtwork) {
        try {
          await updateCustomization({
            gameId,
            userId: user.userId as unknown as Id<"users">,
            customCoverArt: selectedSteamGridDbArtwork.customCoverArt,
            customGridCoverArt: selectedSteamGridDbArtwork.customGridCoverArt,
            customLogo: selectedSteamGridDbArtwork.customLogo,
            customHeroArt: selectedSteamGridDbArtwork.customHeroArt,
          });
        } catch (customizationError: any) {
          console.error("Error saving SteamGridDB artwork links:", customizationError);
          toast.warning("App was added, but SteamGridDB artwork could not be linked.");
        }
      }

      if (isPostHogInitialized) {
        posthog.capture("game_custom_app_added", {
          add_mode: mode,
          has_steamgriddb_artwork: Boolean(selectedSteamGridDbArtwork),
        });
      }
      toast.success("Custom app added successfully");
      setTitle("");
      setExecutablePath("");
      setLaunchArguments("");
      setSteamGridDbQuery("");
      setSelectedSteamGridDbGameId(null);
      setSelectedSteamGridDbArtwork(null);
      try {
        await onSuccess();
      } catch (eventError) {
        console.debug("Custom app add success callback failed", eventError);
      }
      onClose();
    } catch (error: any) {
      console.error("Error adding custom app:", error);
      toast.error(error.message || "Failed to add custom app");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full h-screen flex items-center justify-center">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" />
      <div className="w-full h-full">
        <div data-tauri-drag-region className="drag-region flex items-center bg-background justify-between border-b px-1 py-1">
          <h2 className="text-sm font-light text-muted-foreground">Add Custom App</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto content-view-scrollbar h-[98vh] pb-26">
          <div className="grid grid-cols-2 gap-2 border-b p-1">
            <Button
              type="button"
              variant={mode === "installed" ? "default" : "outline"}
              onClick={() => setMode("installed")}
              className={cn("cursor-pointer justify-center rounded-full border-none", mode === "installed" && "bg-[var(--theme-button)] text-[var(--theme-button-secondary)]")}
            >
              Installed apps
            </Button>
            <Button
              type="button"
              variant={mode === "custom" ? "default" : "outline"}
              onClick={() => setMode("custom")}
              className={cn("cursor-pointer justify-center rounded-full border-none", mode === "custom" && "bg-[var(--theme-button)] text-[var(--theme-button-secondary)]")}
            >
              Custom executable
            </Button>
          </div>
          <div className="flex flex-row justify-between gap-2 border-b px-2 pb-2">
            <div className="space-y-2 w-full">
              <Label htmlFor="title">App Name</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter app name"
                className="rounded-full border-none"
                required
              />
            </div>

            <div className="space-y-2 w-full">
              <Label htmlFor="launchArguments">Launch Arguments (Optional)</Label>
              <Input
                id="launchArguments"
                value={launchArguments}
                className="rounded-full border-none"
                onChange={(e) => setLaunchArguments(e.target.value)}
                placeholder='Example: -novid +exec "my config.cfg"'
              />
            </div>
          </div>

          {mode === "installed" ? (
            <div className="space-y-3 border-b px-2 pb-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label htmlFor="programSearch">Detected programs</Label>
                  <p className="text-xs text-muted-foreground">
                    We scan your system for installed apps that can be launched.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-full border-none cursor-pointer"
                  onClick={loadInstalledPrograms}
                  disabled={isLoadingPrograms}
                >
                  {isLoadingPrograms ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Refresh
                </Button>
              </div>

              <div className="relative">
                <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="programSearch"
                  value={programSearch}
                  onChange={(e) => setProgramSearch(e.target.value)}
                  placeholder="Filter installed apps"
                  className="pl-7 rounded-full border-none"
                />
              </div>

              <div className="max-h-72 overflow-y-auto rounded-md content-view-scrollbar border border-border">
                {isLoadingPrograms ? (
                  <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Detecting installed apps...
                  </div>
                ) : !hasLoadedPrograms ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    Click Refresh to detect installed apps.
                  </div>
                ) : filteredPrograms.length > 0 ? (
                  filteredPrograms.map((program) => (
                    <button
                      key={`${program.executablePath}-${program.name}`}
                      type="button"
                      onClick={() => handleSelectInstalledProgram(program)}
                      className="flex w-full flex-col items-start gap-1 border-b border-border px-3 py-2 text-left hover:bg-muted/50 last:border-b-0"
                    >
                      <span className="text-sm font-medium">{program.name}</span>
                      <span className="text-xs text-muted-foreground break-all">
                        {program.executablePath}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-sm text-muted-foreground">
                    No installed apps match your filter. Switch to Custom executable if you want to browse manually.
                  </div>
                )}
              </div>

              {executablePath && (
                <div className="space-y-2">
                  <Label htmlFor="selectedExecutable">Selected executable</Label>
                  <Input
                    id="selectedExecutable"
                    value={executablePath}
                    readOnly
                    className="bg-muted/30"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 px-2">
              <Label htmlFor="executable">Executable Path</Label>
              <div className="flex gap-2">
                <Input
                  id="executable"
                  value={executablePath}
                  onChange={(e) => setExecutablePath(e.target.value)}
                  placeholder="Select executable file"
                  readOnly
                  className="flex-1 rounded-full border-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSelectExecutable}
                  className="rounded-full border-none cursor-pointer"
                >
                  Browse
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-3 border-b px-2 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Label htmlFor="steamGridSearch">SteamGridDB (Optional)</Label>
                <p className="text-xs text-muted-foreground">
                  Search and pre-link grid, hero, and icon artwork for this custom app.
                </p>
              </div>
              {selectedSteamGridDbGameId ? (
                <a
                  href={`https://www.steamgriddb.com/game/${selectedSteamGridDbGameId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                >
                  View
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Input
                id="steamGridSearch"
                value={steamGridDbQuery}
                onChange={(e) => setSteamGridDbQuery(e.target.value)}
                placeholder="Search SteamGridDB by app name (used by picker)"
                className="flex-1 rounded-full border-none"
              />
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-none cursor-pointer"
                onClick={openSteamGridDbPicker}
              >
                <Search className="mr-2 h-4 w-4" />
                Open Picker
              </Button>
            </div>

            {selectedSteamGridDbArtwork && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {selectedSteamGridDbArtwork.customGridCoverArt ? (
                  <img
                    src={selectedSteamGridDbArtwork.customGridCoverArt}
                    alt="Grid cover art preview"
                    className="w-full aspect-[2/3] object-contain rounded border border-border bg-muted/30 p-1"
                  />
                ) : (
                  <div className="h-28 rounded border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                    No grid art
                  </div>
                )}
                {selectedSteamGridDbArtwork.customHeroArt ? (
                  <img
                    src={selectedSteamGridDbArtwork.customHeroArt}
                    alt="Hero art preview"
                    className="h-28 w-full object-cover rounded border border-border"
                  />
                ) : (
                  <div className="h-28 rounded border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                    No hero art
                  </div>
                )}
                {selectedSteamGridDbArtwork.customLogo ? (
                  <img
                    src={selectedSteamGridDbArtwork.customLogo}
                    alt="Icon preview"
                    className="h-28 w-full object-contain rounded border border-border bg-muted/30"
                  />
                ) : (
                  <div className="h-28 rounded border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                    No icon
                  </div>
                )}
              </div>
            )}

            {!user?.userId && (
              <p className="text-xs text-muted-foreground">
                Sign in to save SteamGridDB artwork links to your game customization profile.
              </p>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 w-full flex justify-end gap-2 p-4 bg-background border-t border-border">
            <Button type="button" variant="outline" className="rounded-full border-none cursor-pointer" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="rounded-full border-none cursor-pointer" disabled={isLoading}>
              {isLoading ? "Adding..." : "Add App"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

