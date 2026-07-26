import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useThemeStore } from "@/stores/themeStore";
import { useOverdriveStore } from "@/stores/overdriveStore";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";
import { cn } from "@/lib/utils";
import OverdriveTopBar from "@/components/overdrive/OverdriveTopBar";
import OverdriveNavigationHints, {
  OverdriveHintItem,
} from "@/components/overdrive/OverdriveNavigationHints";
import { Database, Download, HardDrive, Network, Palette, SlidersHorizontal, Wifi } from "lucide-react";
// @ts-ignore
import moveSound from "@/public/sounds/move.wav";

type SettingsSection = "updates" | "storage" | "theme" | "network" | "interface";
type SettingsNavigationMode = "sections" | "content";

interface UpdateCheckResult {
  available: boolean;
  current_version: string;
  version: string | null;
  notes: string | null;
  date: string | null;
}

interface StorageDriveInfo {
  name: string;
  mount_point: string;
  file_system: string;
  total_bytes: number;
  available_bytes: number;
}

interface NetworkOverview {
  online: boolean;
  label: string;
}

const SECTION_META: Array<{ id: SettingsSection; label: string; icon: React.ReactNode }> = [
  { id: "updates", label: "Updates", icon: <Download className="h-4 w-4" /> },
  { id: "storage", label: "Storage", icon: <HardDrive className="h-4 w-4" /> },
  { id: "theme", label: "Theme", icon: <Palette className="h-4 w-4" /> },
  { id: "network", label: "Network", icon: <Network className="h-4 w-4" /> },
  { id: "interface", label: "Interface", icon: <SlidersHorizontal className="h-4 w-4" /> },
];

const bytesToGb = (value: number): string => `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;

const OverdriveSettings: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { colors, setColors } = useThemeStore();
  const { showBatteryIndicator, setShowBatteryIndicator, toggleMenu, isTopBarFocused, setTopBarFocused } = useOverdriveStore();

  const [section, setSection] = React.useState<SettingsSection>("updates");
  const [sectionIndex, setSectionIndex] = React.useState(0);
  const [navigationMode, setNavigationMode] = React.useState<SettingsNavigationMode>("sections");
  const [sectionActionIndex, setSectionActionIndex] = React.useState(0);
  const [searchQuery, setSearchQuery] = React.useState("");

  const [updateInfo, setUpdateInfo] = React.useState<UpdateCheckResult | null>(null);
  const [updateMessage, setUpdateMessage] = React.useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = React.useState(false);
  const [installingUpdate, setInstallingUpdate] = React.useState(false);

  const [drives, setDrives] = React.useState<StorageDriveInfo[]>([]);
  const [loadingDrives, setLoadingDrives] = React.useState(false);

  const [networkOverview, setNetworkOverview] = React.useState<NetworkOverview | null>(null);
  const [loadingNetwork, setLoadingNetwork] = React.useState(false);
  const moveAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const previousTopBarFocusedRef = React.useRef<boolean>(isTopBarFocused);

  const [accent, setAccent] = React.useState(colors.accent);
  const [button, setButton] = React.useState(colors.button);
  const [buttonSecondary, setButtonSecondary] = React.useState(colors.buttonSecondary || colors.accent);
  const [background, setBackground] = React.useState(colors.background);
  const [panel, setPanel] = React.useState(colors.panel);

  React.useEffect(() => {
    const moveAudio = new Audio(moveSound);
    moveAudio.preload = "auto";
    moveAudio.volume = 0.35;
    moveAudioRef.current = moveAudio;

    return () => {
      moveAudio.pause();
      moveAudioRef.current = null;
    };
  }, []);

  const playMoveSound = React.useCallback(() => {
    const audio = moveAudioRef.current;
    if (!audio) {
      return;
    }

    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.debug("Failed to play move sound", error);
    });
  }, []);

  React.useEffect(() => {
    const sectionFromQuery = searchParams.get("section");
    if (!sectionFromQuery) {
      return;
    }

    const exists = SECTION_META.some((entry) => entry.id === sectionFromQuery);
    if (exists) {
      setSection(sectionFromQuery as SettingsSection);
    }
  }, [searchParams]);

  React.useEffect(() => {
    const index = SECTION_META.findIndex((entry) => entry.id === section);
    if (index >= 0) {
      setSectionIndex(index);
    }
  }, [section]);

  React.useEffect(() => {
    setAccent(colors.accent);
    setButton(colors.button);
    setButtonSecondary(colors.buttonSecondary || colors.accent);
    setBackground(colors.background);
    setPanel(colors.panel);
  }, [colors]);

  React.useEffect(() => {
    if (section !== "storage") {
      return;
    }

    const loadDrives = async () => {
      setLoadingDrives(true);
      try {
        const response = await invoke<StorageDriveInfo[]>("list_storage_drives");
        setDrives(response || []);
      } catch (error) {
        console.error("Failed to load drives:", error);
        setDrives([]);
      } finally {
        setLoadingDrives(false);
      }
    };

    void loadDrives();
  }, [section]);

  React.useEffect(() => {
    if (section !== "network") {
      return;
    }

    const loadNetwork = async () => {
      setLoadingNetwork(true);
      try {
        const response = await invoke<NetworkOverview>("get_network_overview");
        setNetworkOverview(response);
      } catch (error) {
        console.error("Failed to load network overview:", error);
        setNetworkOverview({ online: false, label: "Unavailable" });
      } finally {
        setLoadingNetwork(false);
      }
    };

    void loadNetwork();
  }, [section]);

  const setSectionAndQuery = React.useCallback(
    (next: SettingsSection) => {
      setSection(next);
      setSearchParams({ section: next }, { replace: true });
      setNavigationMode("sections");
      setSectionActionIndex(0);
    },
    [setSearchParams],
  );

  const onSearchSubmit = React.useCallback(() => {
    const query = searchQuery.trim();
    if (query) {
      navigate(`/overdrive/library?query=${encodeURIComponent(query)}`);
      return;
    }
    navigate("/overdrive/library");
  }, [navigate, searchQuery]);

  const checkForUpdates = React.useCallback(async () => {
    setCheckingUpdate(true);
    setUpdateMessage(null);
    try {
      const result = await invoke<UpdateCheckResult>("check_for_app_update");
      setUpdateInfo(result);
      setUpdateMessage(result.available ? `Update available: ${result.version}` : "You are up to date.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to check for updates.";
      setUpdateMessage(message);
    } finally {
      setCheckingUpdate(false);
    }
  }, []);

  const installUpdate = React.useCallback(async () => {
    setInstallingUpdate(true);
    try {
      await invoke("install_app_update");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to install update.";
      setUpdateMessage(message);
    } finally {
      setInstallingUpdate(false);
    }
  }, []);

  const applyTheme = React.useCallback(() => {
    setColors({
      accent,
      button,
      buttonSecondary,
      background,
      panel,
    });
  }, [accent, background, button, buttonSecondary, panel, setColors]);

  const handleBack = React.useCallback(() => {
    const state = window.history.state as { idx?: number } | null;
    if (state && typeof state.idx === "number" && state.idx > 0) {
      navigate(-1);
      return;
    }

    navigate("/overdrive", { replace: true });
  }, [navigate]);

  const shiftSection = React.useCallback((direction: 1 | -1) => {
    if (!SECTION_META.length) {
      return;
    }

    if (direction === -1 && sectionIndex <= 0) {
      playMoveSound();
      setTopBarFocused(true);
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        activeElement.blur();
      }
      return;
    }

    const nextIndex = Math.max(0, Math.min(SECTION_META.length - 1, sectionIndex + direction));
    if (nextIndex !== sectionIndex) {
      const nextSection = SECTION_META[nextIndex];
      if (nextSection) {
        playMoveSound();
        setSectionAndQuery(nextSection.id);
      }
    }
  }, [playMoveSound, sectionIndex, setSectionAndQuery, setTopBarFocused]);

  const sectionActions = React.useMemo(() => {
    const actionsBySection: Record<SettingsSection, Array<{ id: string; disabled?: boolean }>> = {
      updates: [
        { id: "updates-check", disabled: checkingUpdate },
        { id: "updates-install", disabled: installingUpdate || !updateInfo?.available },
      ],
      storage: [],
      theme: [
        { id: "theme-accent-hex" },
        { id: "theme-button-hex" },
        { id: "theme-button-secondary-hex" },
        { id: "theme-background-hex" },
        { id: "theme-panel-hex" },
        { id: "theme-apply" },
      ],
      network: [
        { id: "network-open" },
        { id: "network-refresh" },
      ],
      interface: [
        { id: "interface-battery-toggle" },
        { id: "interface-return" },
      ],
    };

    return actionsBySection[section] || [];
  }, [checkingUpdate, installingUpdate, section, updateInfo?.available]);

  React.useEffect(() => {
    setSectionActionIndex((current) => {
      if (!sectionActions.length) {
        return 0;
      }
      return Math.min(current, sectionActions.length - 1);
    });
  }, [sectionActions]);

  const focusAction = React.useCallback((actionId: string) => {
    const element = document.querySelector<HTMLElement>(`[data-settings-action="${actionId}"]`);
    if (element) {
      element.focus();
    }
  }, []);

  const focusSection = React.useCallback((sectionId: SettingsSection) => {
    const element = document.querySelector<HTMLElement>(`[data-settings-section="${sectionId}"]`);
    if (element) {
      element.focus();
    }
  }, []);

  const enterSectionContentNavigation = React.useCallback(() => {
    if (!sectionActions.length) {
      return;
    }

    playMoveSound();
    setNavigationMode("content");
    setSectionActionIndex(0);
    const firstAction = sectionActions[0];
    if (firstAction) {
      focusAction(firstAction.id);
    }
  }, [focusAction, playMoveSound, sectionActions]);

  const exitSectionContentNavigation = React.useCallback(() => {
    playMoveSound();
    setNavigationMode("sections");
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }
  }, [playMoveSound]);

  const moveSectionAction = React.useCallback((direction: 1 | -1) => {
    if (!sectionActions.length) {
      return;
    }

    setSectionActionIndex((current) => {
      if (direction === -1 && current <= 0) {
        playMoveSound();
        setTopBarFocused(true);
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
          activeElement.blur();
        }
        return current;
      }

      const next = Math.max(0, Math.min(sectionActions.length - 1, current + direction));
      if (next === current) {
        return current;
      }

      playMoveSound();
      const action = sectionActions[next];
      if (action) {
        focusAction(action.id);
      }
      return next;
    });
  }, [focusAction, playMoveSound, sectionActions, setTopBarFocused]);

  const activateCurrentSectionAction = React.useCallback(() => {
    const action = sectionActions[sectionActionIndex];
    if (!action || action.disabled) {
      return;
    }

    const element = document.querySelector<HTMLElement>(`[data-settings-action="${action.id}"]`);
    if (!element) {
      return;
    }

    element.focus();
    if (element instanceof HTMLButtonElement) {
      element.click();
    }
  }, [sectionActionIndex, sectionActions]);

  React.useEffect(() => {
    if (navigationMode !== "content") {
      return;
    }

    const action = sectionActions[sectionActionIndex];
    if (action) {
      focusAction(action.id);
    }
  }, [focusAction, navigationMode, sectionActionIndex, sectionActions]);

  React.useEffect(() => {
    const wasTopBarFocused = previousTopBarFocusedRef.current;
    const returnedFromTopBar = wasTopBarFocused && !isTopBarFocused;

    if (returnedFromTopBar) {
      if (navigationMode === "content") {
        const action = sectionActions[sectionActionIndex];
        if (action) {
          focusAction(action.id);
        }
      } else {
        focusSection(section);
      }
    }

    previousTopBarFocusedRef.current = isTopBarFocused;
  }, [focusAction, focusSection, isTopBarFocused, navigationMode, section, sectionActionIndex, sectionActions]);

  useResponsiveGamepad({
    onButtonDown: (button) => {
      if (isTopBarFocused) {
        return;
      }

      if (button === "B" || button === "CIRCLE") {
        handleBack();
        return;
      }

      if (button === "START") {
        toggleMenu();
        return;
      }

      if (button === "LB") {
        if (navigationMode === "content") {
          moveSectionAction(-1);
        } else {
          shiftSection(-1);
        }
        return;
      }

      if (button === "RB") {
        if (navigationMode === "content") {
          moveSectionAction(1);
        } else {
          shiftSection(1);
        }
        return;
      }

      if (button === "RIGHT") {
        if (navigationMode === "sections") {
          enterSectionContentNavigation();
        }
        return;
      }

      if (button === "LEFT") {
        if (navigationMode === "content") {
          exitSectionContentNavigation();
        }
        return;
      }

      if (button === "A" || button === "X") {
        if (navigationMode === "sections") {
          enterSectionContentNavigation();
        } else {
          activateCurrentSectionAction();
        }
      }
    },
    onDPad: (direction) => {
      if (isTopBarFocused) {
        return;
      }

      if (direction === "LEFT") {
        if (navigationMode === "content") {
          exitSectionContentNavigation();
        }
        return;
      }

      if (direction === "RIGHT") {
        if (navigationMode === "sections") {
          enterSectionContentNavigation();
        }
        return;
      }

      if (direction === "UP") {
        if (navigationMode === "sections") {
          shiftSection(-1);
        } else {
          moveSectionAction(-1);
        }
        return;
      }

      if (direction === "DOWN") {
        if (navigationMode === "sections") {
          shiftSection(1);
        } else {
          moveSectionAction(1);
        }
      }
    },
  });

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTopBarFocused) {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        handleBack();
        return;
      }

      const target = event.target as HTMLElement | null;
      const isTextInputTarget = target != null && (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      );
      if (isTextInputTarget) {
        return;
      }

      if (event.key === "ArrowUp" || event.key === "w" || event.key === "W") {
        event.preventDefault();
        if (navigationMode === "sections") {
          shiftSection(-1);
        } else {
          moveSectionAction(-1);
        }
        return;
      }

      if (event.key === "ArrowDown" || event.key === "s" || event.key === "S") {
        event.preventDefault();
        if (navigationMode === "sections") {
          shiftSection(1);
        } else {
          moveSectionAction(1);
        }
        return;
      }

      if (event.key === "ArrowRight" || event.key === "d" || event.key === "D") {
        event.preventDefault();
        if (navigationMode === "sections") {
          enterSectionContentNavigation();
        }
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "a" || event.key === "A") {
        event.preventDefault();
        if (navigationMode === "content") {
          exitSectionContentNavigation();
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (navigationMode === "sections") {
          enterSectionContentNavigation();
        } else {
          activateCurrentSectionAction();
        }
        return;
      }

      if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        toggleMenu();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    activateCurrentSectionAction,
    enterSectionContentNavigation,
    exitSectionContentNavigation,
    handleBack,
    isTopBarFocused,
    moveSectionAction,
    navigationMode,
    shiftSection,
    toggleMenu,
  ]);

  const hints = React.useMemo<OverdriveHintItem[]>(
    () => {
      if (navigationMode === "sections") {
        return [
          { id: "section-prev", label: "Prev Section", keyLabel: "Up", controllerButton: "lb", onActivate: () => shiftSection(-1) },
          { id: "section-next", label: "Next Section", keyLabel: "Down", controllerButton: "rb", onActivate: () => shiftSection(1) },
          { id: "section-enter", label: "Enter Section", keyLabel: "Right", controllerButton: "a", onActivate: enterSectionContentNavigation },
          { id: "back", label: "Back", keyLabel: "Esc", controllerButton: "b", onActivate: handleBack },
        ];
      }

      return [
        { id: "item-prev", label: "Prev Item", keyLabel: "Up", controllerButton: "lb", onActivate: () => moveSectionAction(-1) },
        { id: "item-next", label: "Next Item", keyLabel: "Down", controllerButton: "rb", onActivate: () => moveSectionAction(1) },
        { id: "item-activate", label: "Activate", keyLabel: "Enter", controllerButton: "a", onActivate: activateCurrentSectionAction },
        { id: "section-exit", label: "Section List", keyLabel: "Left", onActivate: exitSectionContentNavigation },
      ];
    },
    [
      activateCurrentSectionAction,
      enterSectionContentNavigation,
      exitSectionContentNavigation,
      handleBack,
      moveSectionAction,
      navigationMode,
      shiftSection,
    ],
  );

  const isActionFocused = React.useCallback((id: string) => {
    if (navigationMode !== "content") {
      return false;
    }

    return sectionActions[sectionActionIndex]?.id === id;
  }, [navigationMode, sectionActionIndex, sectionActions]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-950 text-white">
      <OverdriveTopBar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onSearchSubmit={onSearchSubmit}
      />

      <div className="grid h-full grid-cols-[280px_1fr] gap-0 pb-14 pt-12">
        <div className="border-r border-t bg-gray-900/45 p-0 backdrop-blur-xl">
          <div className="space-y-0">
            {SECTION_META.map((entry) => (
              <button
                key={entry.id}
                type="button"
                data-settings-section={entry.id}
                onClick={() => setSectionAndQuery(entry.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-4 text-left transition-all",
                  section === entry.id
                    ? "border-[var(--theme-accent)] border bg-white/15 text-white"
                    : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10",
                  navigationMode === "sections" && section === entry.id && "ring-2 ring-[var(--theme-accent)]",
                )}
              >
                {entry.icon}
                <span className="text-sm">{entry.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto border-t bg-gray-900/25 p-5 pb-24 backdrop-blur-xl">
          {section === "updates" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Updates</h2>
              <p className="text-sm text-white/65">Check for launcher updates and install new releases from GitHub.</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void checkForUpdates()}
                  disabled={checkingUpdate}
                  data-settings-action="updates-check"
                  className={cn(
                    "rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-60",
                    isActionFocused("updates-check") && "ring-2 ring-[var(--theme-accent)]",
                  )}
                >
                  {checkingUpdate ? "Checking..." : "Check for Updates"}
                </button>
                <button
                  type="button"
                  onClick={() => void installUpdate()}
                  disabled={installingUpdate || !updateInfo?.available}
                  data-settings-action="updates-install"
                  className={cn(
                    "rounded-full border border-[#107c10]/60 bg-[#107c10]/20 px-4 py-2 text-sm text-[#9cf39c] hover:bg-[#107c10]/35 disabled:opacity-60",
                    isActionFocused("updates-install") && "ring-2 ring-[var(--theme-accent)]",
                  )}
                >
                  {installingUpdate ? "Installing..." : "Install Update"}
                </button>
              </div>
              {updateInfo && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                  <p>Current version: {updateInfo.current_version}</p>
                  <p>Latest version: {updateInfo.version || "n/a"}</p>
                  {updateInfo.notes && <p className="mt-2 text-white/70">{updateInfo.notes}</p>}
                </div>
              )}
              {updateMessage && <p className="text-sm text-white/75">{updateMessage}</p>}
            </div>
          )}

          {section === "storage" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Storage</h2>
              <p className="text-sm text-white/65">View mounted drives and free space similar to handheld dashboards.</p>
              {loadingDrives ? (
                <p className="text-sm text-white/60">Loading drives...</p>
              ) : drives.length > 0 ? (
                <div className="space-y-3">
                  {drives.map((drive, index) => {
                    const used = Math.max(drive.total_bytes - drive.available_bytes, 0);
                    const usage = drive.total_bytes > 0 ? Math.round((used / drive.total_bytes) * 100) : 0;
                    return (
                      <div key={`${drive.mount_point}-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-medium">{drive.name || drive.mount_point}</p>
                          <p className="text-xs text-white/60">{drive.file_system || "Unknown FS"}</p>
                        </div>
                        <p className="text-xs text-white/65">{drive.mount_point}</p>
                        <div className="mt-3 h-2 overflow-hidden rounded bg-white/10">
                          <div className="h-full bg-[var(--theme-accent)]" style={{ width: `${usage}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-white/65">
                          {bytesToGb(used)} used of {bytesToGb(drive.total_bytes)} ({usage}%)
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-white/60">No drives detected.</p>
              )}
            </div>
          )}

          {section === "theme" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Theme</h2>
              <p className="text-sm text-white/65">Customize Overdrive accent and panel colors.</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  { label: "Accent", value: accent, set: setAccent },
                  { label: "Button", value: button, set: setButton },
                  { label: "Button Secondary", value: buttonSecondary, set: setButtonSecondary },
                  { label: "Background", value: background, set: setBackground },
                  { label: "Panel", value: panel, set: setPanel },
                ].map((entry) => (
                  <div key={entry.label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="mb-2 text-xs uppercase tracking-[0.15rem] text-white/65">{entry.label}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={entry.value}
                        onChange={(event) => entry.set(event.target.value)}
                        data-settings-action={`theme-${entry.label.toLowerCase().replace(/\s+/g, "-")}`}
                        className={cn(
                          "h-10 w-14 cursor-pointer rounded",
                          isActionFocused(`theme-${entry.label.toLowerCase().replace(/\s+/g, "-")}`) && "ring-2 ring-[var(--theme-accent)]",
                        )}
                      />
                      <input
                        value={entry.value}
                        onChange={(event) => entry.set(event.target.value)}
                        data-settings-action={`theme-${entry.label.toLowerCase().replace(/\s+/g, "-")}-hex`}
                        className={cn(
                          "w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm",
                          isActionFocused(`theme-${entry.label.toLowerCase().replace(/\s+/g, "-")}-hex`) && "ring-2 ring-[var(--theme-accent)]",
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={applyTheme}
                data-settings-action="theme-apply"
                className={cn(
                  "rounded-full border border-[var(--theme-accent)]/60 bg-[var(--theme-accent)]/20 px-4 py-2 text-sm",
                  isActionFocused("theme-apply") && "ring-2 ring-[var(--theme-accent)]",
                )}
              >
                Apply Theme
              </button>
            </div>
          )}

          {section === "network" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Network</h2>
              <p className="text-sm text-white/65">Quick status and shortcuts for system connectivity setup.</p>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                {loadingNetwork ? (
                  <p className="text-sm text-white/65">Checking network...</p>
                ) : (
                  <div className="flex items-center gap-3">
                    <Wifi className={cn("h-5 w-5", networkOverview?.online ? "text-emerald-300" : "text-red-300")} />
                    <p>{networkOverview?.label || "Unknown"}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  data-settings-action="network-open"
                  onClick={() => {
                    void invoke("open_network_settings");
                  }}
                  className={cn(
                    "rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm hover:bg-white/10",
                    isActionFocused("network-open") && "ring-2 ring-[var(--theme-accent)]",
                  )}
                >
                  Open System Network Settings
                </button>
                <button
                  type="button"
                  data-settings-action="network-refresh"
                  onClick={() => {
                    setSectionAndQuery("network");
                  }}
                  className={cn(
                    "rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm hover:bg-white/10",
                    isActionFocused("network-refresh") && "ring-2 ring-[var(--theme-accent)]",
                  )}
                >
                  Refresh
                </button>
              </div>
            </div>
          )}

          {section === "interface" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Interface</h2>
              <p className="text-sm text-white/65">Control Overdrive shell UI behaviors.</p>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Show battery indicator in top bar</p>
                    <p className="text-xs text-white/60">Tap the battery icon to jump back here quickly.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBatteryIndicator(!showBatteryIndicator)}
                    data-settings-action="interface-battery-toggle"
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm",
                      showBatteryIndicator
                        ? "border-[#107c10]/60 bg-[#107c10]/20 text-[#9cf39c]"
                        : "border-white/20 bg-white/5 text-white/75",
                      isActionFocused("interface-battery-toggle") && "ring-2 ring-[var(--theme-accent)]",
                    )}
                  >
                    {showBatteryIndicator ? "Enabled" : "Disabled"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={handleBack}
                data-settings-action="interface-return"
                className={cn(
                  "rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm hover:bg-white/10",
                  isActionFocused("interface-return") && "ring-2 ring-[var(--theme-accent)]",
                )}
              >
                Return to Overdrive
              </button>
            </div>
          )}
        </div>
      </div>

      <OverdriveNavigationHints items={hints} />
    </div>
  );
};

export default OverdriveSettings;
