import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { MicaCard } from "@/components/MicaCard";
import { MicaInput } from "@/components/MicaInput";
import { useSettingsStore } from "@/stores/settingsStore";
import { Settings as SettingsType } from "@/types";
import { Cog, Monitor, Moon, Sun } from "lucide-react";
import { VscChromeClose, VscChromeMaximize, VscChromeMinimize } from "react-icons/vsc";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useThemeStore } from "@/stores/themeStore";
import { LibraryHygiene } from "@/components/LibraryHygiene";
import { ThemeGallery } from "@/components/themes/ThemeGallery";
import { ThemeEditor } from "@/components/themes/ThemeEditor";
import type { ThemeManifest } from "@/types/theme";

type TabId = "general" | "library" | "browser" | "accessibility" | "themes" | "about";

interface UpdateCheckResult {
  available: boolean;
  current_version: string;
  version: string | null;
  notes: string | null;
  date: string | null;
}

const Settings: React.FC = () => {
  const { settings, setSettings, updateSettings } = useSettingsStore();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>("general");
  const { colors: themeColors, setColors: setThemeColors, resetTheme, mode: themeMode, setMode: setThemeMode } = useThemeStore();

  const [accentColor, setAccentColor] = useState(themeColors.accent);
  const [buttonColor, setButtonColor] = useState(themeColors.button);
  const [buttonSecondaryColor, setButtonSecondaryColor] = useState(themeColors.buttonSecondary || themeColors.accent);
  const [backgroundColor, setBackgroundColor] = useState(themeColors.background);
  const [panelColor, setPanelColor] = useState(themeColors.panel);
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [themeEditorTarget, setThemeEditorTarget] = useState<ThemeManifest | null | undefined>(undefined);
  // undefined = gallery view, null = new theme, ThemeManifest = edit theme
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    setAccentColor(themeColors.accent);
    setButtonColor(themeColors.button);
    setButtonSecondaryColor(themeColors.buttonSecondary || themeColors.accent);
    setBackgroundColor(themeColors.background);
    setPanelColor(themeColors.panel);
  }, [themeColors.accent, themeColors.button, themeColors.buttonSecondary, themeColors.background, themeColors.panel]);

  const loadSettings = async () => {
    try {
      const data = await invoke<SettingsType>("get_settings");
      setSettings(data);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const handleThemeChange = (theme: "light" | "dark") => {
    setTheme(theme);
    updateSettings({ theme });
  };

  const handleSaveSettings = async () => {
    try {
      await invoke("update_settings", { settings });
      alert("Settings saved successfully!");
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Failed to save settings");
    }
  };

  const handleMinimize = async (e: React.MouseEvent) => {
    try {
      await invoke("minimize_settings_window");
    } catch (error) {
      console.error("Failed to minimize settings window:", error);
      alert("Failed to minimize settings window");
    }
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    try {
      await invoke("maximize_settings_window");
    } catch (error) {
      console.error("Failed to maximize settings window:", error);
      alert("Failed to maximize settings window");
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    try {
      await invoke("close_settings_window");
    } catch (error) {
      console.error("Failed to close settings window:", error);
      alert("Failed to close settings window");
    }
  };

  const handleCheckForUpdates = async () => {
    setIsCheckingUpdates(true);
    setUpdateMessage(null);

    try {
      const result = await invoke<UpdateCheckResult>("check_for_app_update");
      setUpdateInfo(result);

      if (result.available) {
        setUpdateMessage(`Update available: ${result.version}`);
      } else {
        setUpdateMessage("You are up to date.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to check for updates.";
      setUpdateMessage(message);
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const handleInstallUpdate = async () => {
    setIsInstallingUpdate(true);
    setUpdateMessage(null);

    try {
      const updated = await invoke<boolean>("install_app_update");
      if (!updated) {
        setUpdateMessage("No update available right now.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to install update.";
      setUpdateMessage(message);
    } finally {
      setIsInstallingUpdate(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-background">

      <div className="flex items-center justify-between py-1 px-2 border-b border-border bg-muted drag-region" data-tauri-drag-region>
        <div className="flex items-center gap-2 text-foreground/70">
          <Cog size={16} />
          <h2 className="text-sm font-semibold uppercase italic">Settings</h2>
        </div>
        <div className="flex items-end gap-2 no-drag-region text-foreground/70" data-tauri-drag-region="false">
          {/* Window Controls */}
          <button
            onClick={handleMinimize}
            className="p-1 hover:bg-muted-foreground/10 rounded transition-colors text-foreground/70"
            title="Minimize"
          >
            <VscChromeMinimize size={14} />
          </button>
          <button
            onClick={handleMaximize}
            className="p-1 hover:bg-muted-foreground/10 rounded transition-colors text-foreground/70"
            title="Maximize"
          >
            <VscChromeMaximize size={14} />
          </button>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-red-500/20 rounded transition-colors text-foreground/70"
            title="Close"
          >
            <VscChromeClose size={14} />
          </button>
        </div>
      </div>

      <div className="flex flex-row w-full h-screen overflow-hidden">
        {/* Tabs List - Left Side */}
        <div className="w-48 border-r border-border bg-background/50 flex flex-col">
          <div className="p-2 space-y-1">
            <button
              onClick={() => setActiveTab("general")}
              className={`w-full text-left px-4 py-2 rounded transition-colors ${activeTab === "general"
                ? "bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] font-medium"
                : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab("library")}
              className={`w-full text-left px-4 py-2 rounded transition-colors ${activeTab === "library"
                ? "bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] font-medium"
                : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                }`}
            >
              Library
            </button>
            <button
              onClick={() => setActiveTab("browser")}
              className={`w-full text-left px-4 py-2 rounded transition-colors ${activeTab === "browser"
                ? "bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] font-medium"
                : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                }`}
            >
              Browser
            </button>
            <button
              onClick={() => setActiveTab("accessibility")}
              className={`w-full text-left px-4 py-2 rounded transition-colors ${activeTab === "accessibility"
                ? "bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] font-medium"
                : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                }`}
            >
              Accessibility
            </button>
            <button
              onClick={() => setActiveTab("themes")}
              className={`w-full text-left px-4 py-2 rounded transition-colors ${activeTab === "themes"
                ? "bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] font-medium"
                : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                }`}
            >
              Themes
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={`w-full text-left px-4 py-2 rounded transition-colors ${activeTab === "about"
                ? "bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] font-medium"
                : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                }`}
            >
              About
            </button>
          </div>
        </div>

        {/* Content - Right Side */}
        <div className="flex-1 overflow-y-auto content-view-scrollbar">
          <div className="p-6">
            {activeTab === "general" && (
              <>
                {/* Light / Dark / System mode */}
                <div className="flex flex-col gap-2 mb-6">
                  <label className="text-foreground/70 font-medium">Appearance</label>
                  <div className="flex gap-2">
                    {(["light", "dark", "system"] as const).map((m) => {
                      const Icon = m === "light" ? Sun : m === "dark" ? Moon : Monitor;
                      const isActive = themeMode === m;
                      return (
                        <button
                          key={m}
                          onClick={() => { setThemeMode(m); setTheme(m); }}
                          className={`flex items-center gap-2 px-4 py-2 rounded text-sm capitalize transition-colors ${
                            isActive
                              ? "bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] font-medium"
                              : "bg-muted/50 text-foreground/70 hover:bg-muted hover:text-foreground"
                          }`}
                        >
                          <Icon size={14} />
                          {m}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    "System" syncs with your OS colour scheme automatically.
                  </p>
                </div>

                <div className="flex flex-col gap-2 mt-4">
                  <label className="text-foreground/70 font-medium">Colour Overrides</label>
                  <p className="text-xs text-muted-foreground -mt-1">These override the active theme's accent and button colours.</p>
                  <div className="flex flex-row items-center gap-2 w-full">
                    <Card className="p-2 text-foreground">
                      <label className="text-sm text-foreground/80 mb-1 block">Accent Color</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="w-12 h-10 cursor-pointer"
                        />
                        <MicaInput
                          type="text"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          placeholder="#4CE4B1"
                          className="flex-1"
                        />
                      </div>
                    </Card>

                    <Card className="p-2 text-foreground">
                      <label className="text-sm text-foreground/80 mb-1 block">Button Color (Dark)</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={buttonColor}
                          onChange={(e) => setButtonColor(e.target.value)}
                          className="w-12 h-10 rounded cursor-pointer"
                        />
                        <MicaInput
                          type="text"
                          value={buttonColor}
                          onChange={(e) => setButtonColor(e.target.value)}
                          placeholder="#006B4F"
                          className="flex-1"
                        />
                      </div>
                    </Card>

                    <Card className="p-2 text-foreground">
                      <label className="text-sm text-foreground/80 mb-1 block">Button Color (Light)</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={buttonSecondaryColor}
                          onChange={(e) => setButtonSecondaryColor(e.target.value)}
                          className="w-12 h-10 rounded cursor-pointer"
                        />
                        <MicaInput
                          type="text"
                          value={buttonSecondaryColor}
                          onChange={(e) => setButtonSecondaryColor(e.target.value)}
                          placeholder="#4CE4B1"
                          className="flex-1"
                        />
                      </div>
                    </Card>
                  </div>
                  <div className="flex gap-2 mt-2 items-end">
                    <Button
                      type="button"
                      variant="default"
                      onClick={() => {
                        setThemeColors({
                          accent: accentColor,
                          button: buttonColor,
                          buttonSecondary: buttonSecondaryColor,
                          background: backgroundColor,
                          panel: panelColor,
                        });
                      }}
                      className="text-sm dark:bg-[var(--theme-button)] bg-[var(--theme-button-secondary)] text-foreground border-[var(--theme-button-secondary)] dark:border-[var(--theme-button)]"
                    >
                      Apply Theme
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        resetTheme();
                      }}
                      className="text-sm text-foreground/70"
                    >
                      Reset to Defaults
                    </Button>
                  </div>
                </div>
              </>
            )}

            {activeTab === "library" && (
              <MicaCard className="settings-section">
                <h2>Library Settings</h2>
                <div className="settings-group">
                  <label>Default View</label>
                  <select
                    value={settings.librarySettings?.defaultView || "grid"}
                    onChange={(e) =>
                      updateSettings({
                        librarySettings: {
                          cacheGameMetadata: settings.librarySettings?.cacheGameMetadata ?? true,
                          autoUpdateMetadata: settings.librarySettings?.autoUpdateMetadata ?? true,
                          defaultView: e.target.value as "grid" | "list",
                          sortBy: settings.librarySettings?.sortBy ?? "title",
                          groupBy: settings.librarySettings?.groupBy ?? "none",
                        },
                      })
                    }
                    className="settings-select"
                  >
                    <option value="grid">Grid</option>
                    <option value="list">List</option>
                  </select>
                </div>
                <div className="settings-group">
                  <label>Sort By</label>
                  <select
                    value={settings.librarySettings?.sortBy || "title"}
                    onChange={(e) =>
                      updateSettings({
                        librarySettings: {
                          cacheGameMetadata: settings.librarySettings?.cacheGameMetadata ?? true,
                          autoUpdateMetadata: settings.librarySettings?.autoUpdateMetadata ?? true,
                          defaultView: settings.librarySettings?.defaultView ?? "grid",
                          sortBy: e.target.value as any,
                          groupBy: settings.librarySettings?.groupBy ?? "none",
                        },
                      })
                    }
                    className="settings-select"
                  >
                    <option value="title">Title</option>
                    <option value="lastPlayed">Last Played</option>
                    <option value="playtime">Playtime</option>
                    <option value="added">Date Added</option>
                  </select>
                </div>
                <div className="settings-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.librarySettings?.cacheGameMetadata || false}
                      onChange={(e) =>
                        updateSettings({
                          librarySettings: {
                            cacheGameMetadata: e.target.checked,
                            autoUpdateMetadata: settings.librarySettings?.autoUpdateMetadata ?? true,
                            defaultView: settings.librarySettings?.defaultView ?? "grid",
                            sortBy: settings.librarySettings?.sortBy ?? "title",
                            groupBy: settings.librarySettings?.groupBy ?? "none",
                          },
                        })
                      }
                    />
                    Cache game metadata
                  </label>
                </div>
                <div className="mt-6">
                  <LibraryHygiene />
                </div>
              </MicaCard>
            )}

            {activeTab === "browser" && (
              <MicaCard className="settings-section">
                <h2>Browser Settings</h2>
                <div className="settings-group">
                  <label>Homepage</label>
                  <MicaInput
                    type="text"
                    value={settings.browserSettings?.homepage || ""}
                    onChange={(e) =>
                      updateSettings({
                        browserSettings: {
                          defaultSearchEngine: settings.browserSettings?.defaultSearchEngine ?? "google",
                          homepage: e.target.value,
                          blockAds: settings.browserSettings?.blockAds ?? false,
                          enableJavascript: settings.browserSettings?.enableJavascript ?? true,
                        },
                      })
                    }
                  />
                </div>
                <div className="settings-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={settings.browserSettings?.enableJavascript ?? true}
                      onChange={(e) =>
                        updateSettings({
                          browserSettings: {
                            defaultSearchEngine: settings.browserSettings?.defaultSearchEngine ?? "google",
                            homepage: settings.browserSettings?.homepage ?? "https://www.google.com",
                            blockAds: settings.browserSettings?.blockAds ?? false,
                            enableJavascript: e.target.checked,
                          },
                        })
                      }
                    />
                    Enable JavaScript
                  </label>
                </div>
              </MicaCard>
            )}

            {activeTab === "accessibility" && (
              <MicaCard className="settings-section">
                <h2 className="text-foreground/70 font-medium uppercase italic text-lg mb-4">Accessibility</h2>
                <div className="flex flex-col gap-4">
                  <div className="settings-group">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="font-medium text-foreground/90">Grayscale Mode</div>
                        <div className="text-sm text-foreground/60">
                          Apply grayscale filter to the entire application
                        </div>
                      </div>
                      <Switch
                        checked={settings.accessibilitySettings?.grayscale || false}
                        onCheckedChange={(checked) =>
                          updateSettings({
                            accessibilitySettings: {
                              grayscale: checked,
                              highContrast: settings.accessibilitySettings?.highContrast ?? false,
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                  <div className="settings-group">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="font-medium text-foreground/90">High Contrast Mode</div>
                        <div className="text-sm text-foreground/60">
                          Increase contrast for better visibility
                        </div>
                      </div>
                      <Switch
                        checked={settings.accessibilitySettings?.highContrast || false}
                        onCheckedChange={(checked) =>
                          updateSettings({
                            accessibilitySettings: {
                              grayscale: settings.accessibilitySettings?.grayscale ?? false,
                              highContrast: checked,
                            },
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              </MicaCard>
            )}

            {activeTab === "themes" && (
              <div className="flex flex-col gap-4">
                <div>
                  <h2 className="text-foreground/70 font-medium uppercase italic text-base">Themes</h2>
                  <p className="text-xs text-muted-foreground mt-1">Install themes from .yaml files or create your own.</p>
                </div>

                {themeEditorTarget !== undefined ? (
                  <ThemeEditor
                    initial={themeEditorTarget}
                    onBack={() => setThemeEditorTarget(undefined)}
                    onSaved={() => setThemeEditorTarget(undefined)}
                  />
                ) : (
                  <ThemeGallery
                    onCreateNew={() => setThemeEditorTarget(null)}
                    onEdit={(t) => setThemeEditorTarget(t)}
                  />
                )}
              </div>
            )}

            {activeTab === "about" && (
              <MicaCard className="settings-section">
                <h2>About</h2>
                <div className="about-content">
                  <p>
                    <strong>PoliGame</strong>
                  </p>
                  <p>Version 1.0.0</p>
                  <p>Game aggregator with marketplace functionality</p>
                </div>
                <div className="mt-6 space-y-3">
                  <h3 className="text-sm uppercase tracking-wide text-foreground/70">Updates</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => void handleCheckForUpdates()}
                      disabled={isCheckingUpdates || isInstallingUpdate}
                    >
                      {isCheckingUpdates ? "Checking..." : "Check for Updates"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void handleInstallUpdate()}
                      disabled={!updateInfo?.available || isCheckingUpdates || isInstallingUpdate}
                    >
                      {isInstallingUpdate ? "Installing..." : "Install Update"}
                    </Button>
                  </div>
                  {updateInfo?.available && (
                    <p className="text-sm text-foreground/70">
                      New version {updateInfo.version} is available. Current version: {updateInfo.current_version}
                    </p>
                  )}
                  {updateMessage && (
                    <p className="text-sm text-foreground/70">{updateMessage}</p>
                  )}
                </div>
              </MicaCard>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;

