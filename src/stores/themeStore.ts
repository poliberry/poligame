import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import type { ThemeManifest } from "@/types/theme";

// Legacy quick-edit colors kept for backward compat
export interface ThemeColors {
  accent: string;
  button: string;
  buttonSecondary?: string;
  background: string;
  panel: string;
}

export type ThemeMode = "light" | "dark" | "system";

const defaultColors: ThemeColors = {
  accent: "#4CE4B1",
  button: "#006B4F",
  buttonSecondary: "#4CE4B1",
  background: "#111827",
  panel: "#1F2937",
};

const THEME_MODE_KEY = "poligame-theme-mode";
const ACTIVE_THEME_ID_KEY = "poligame-active-theme-id";
const DEFAULT_THEME_ID = "poligame-default-dark";

function loadColorsFromStorage(): ThemeColors {
  if (typeof window === "undefined") return defaultColors;
  try {
    const stored = localStorage.getItem("poligame-theme");
    if (stored) return { ...defaultColors, ...JSON.parse(stored) };
  } catch {}
  return defaultColors;
}

function saveColorsToStorage(colors: ThemeColors) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("poligame-theme", JSON.stringify(colors));
  } catch {}
}

function loadModeFromStorage(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(THEME_MODE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {}
  return "dark";
}

function saveModeToStorage(mode: ThemeMode) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THEME_MODE_KEY, mode);
  } catch {}
}

function loadActiveThemeIdFromStorage(): string {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  try {
    return localStorage.getItem(ACTIVE_THEME_ID_KEY) || DEFAULT_THEME_ID;
  } catch {}
  return DEFAULT_THEME_ID;
}

function saveActiveThemeIdToStorage(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_THEME_ID_KEY, id);
  } catch {}
}

async function resolveThemeBgImage(theme: ThemeManifest): Promise<ThemeManifest> {
  const bgImage = theme.appearance?.background_image;
  if (!bgImage || bgImage.startsWith("data:") || bgImage.startsWith("http://") || bgImage.startsWith("https://")) {
    return theme;
  }
  try {
    const base64 = await invoke<string>("get_theme_asset_base64", {
      themeId: theme.id,
      assetFilename: bgImage,
    });
    const ext = bgImage.split(".").pop()?.toLowerCase() ?? "png";
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
    return {
      ...theme,
      appearance: {
        ...theme.appearance,
        background_image: `data:${mime};base64,${base64}`,
      },
    };
  } catch {
    return theme;
  }
}

interface ThemeStore {
  // Legacy quick-edit colors
  colors: ThemeColors;
  setColors: (colors: Partial<ThemeColors>) => void;
  resetTheme: () => void;

  // Light/dark mode
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;

  // Full theme system
  activeThemeId: string;
  activeTheme: ThemeManifest | null;
  installedThemes: ThemeManifest[];
  themesLoaded: boolean;

  loadThemes: () => Promise<void>;
  setActiveThemeId: (id: string) => Promise<void>;
  installThemeFromFile: (yamlContent: string) => Promise<ThemeManifest>;
  deleteTheme: (id: string) => Promise<void>;
  saveUserTheme: (manifest: ThemeManifest) => Promise<void>;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  colors: loadColorsFromStorage(),
  mode: loadModeFromStorage(),
  activeThemeId: loadActiveThemeIdFromStorage(),
  activeTheme: null,
  installedThemes: [],
  themesLoaded: false,

  setColors: (newColors) => {
    set((state) => {
      const updated = { ...state.colors, ...newColors };
      saveColorsToStorage(updated);
      return { colors: { ...updated } };
    });
  },

  resetTheme: () => {
    saveColorsToStorage(defaultColors);
    set({ colors: defaultColors });
  },

  setMode: (mode) => {
    saveModeToStorage(mode);
    set({ mode });
  },

  loadThemes: async () => {
    try {
      const themes = await invoke<ThemeManifest[]>("list_themes");
      const activeId = get().activeThemeId;
      const exact = themes.find((t) => t.id === activeId);
      const active = exact ?? themes[0] ?? null;
      const resolvedId = active?.id ?? activeId;
      if (resolvedId !== activeId) saveActiveThemeIdToStorage(resolvedId);
      const resolvedActive = active ? await resolveThemeBgImage(active) : null;
      set({ installedThemes: themes, activeTheme: resolvedActive, activeThemeId: resolvedId, themesLoaded: true });
    } catch (err) {
      console.error("Failed to load themes:", err);
      set({ themesLoaded: true });
    }
  },

  setActiveThemeId: async (id) => {
    const { installedThemes } = get();
    const theme = installedThemes.find((t) => t.id === id) ?? null;
    saveActiveThemeIdToStorage(id);
    const resolved = theme ? await resolveThemeBgImage(theme) : null;
    set({ activeThemeId: id, activeTheme: resolved });
  },

  installThemeFromFile: async (yamlContent) => {
    const manifest = await invoke<ThemeManifest>("install_theme", { yamlContent });
    set((state) => ({
      installedThemes: [...state.installedThemes.filter((t) => t.id !== manifest.id), manifest],
    }));
    return manifest;
  },

  deleteTheme: async (id) => {
    await invoke("delete_theme", { id });
    set((state) => {
      const remaining = state.installedThemes.filter((t) => t.id !== id);
      const newActive =
        state.activeThemeId === id ? (remaining[0] ?? null) : state.activeTheme;
      if (newActive) saveActiveThemeIdToStorage(newActive.id);
      return {
        installedThemes: remaining,
        activeTheme: newActive,
        activeThemeId: newActive?.id ?? DEFAULT_THEME_ID,
      };
    });
  },

  saveUserTheme: async (manifest) => {
    await invoke("save_user_theme", { manifestJson: JSON.stringify(manifest) });
    set((state) => ({
      installedThemes: [
        ...state.installedThemes.filter((t) => t.id !== manifest.id),
        manifest,
      ],
    }));
  },
}));
