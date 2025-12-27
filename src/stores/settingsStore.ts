import { create } from "zustand";
import { Settings } from "@/types";

interface SettingsStore {
  settings: Settings;
  isLoading: boolean;
  error: string | null;
  setSettings: (settings: Settings) => void;
  updateSettings: (updates: Partial<Settings>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  resetSettings: () => void;
}

const defaultSettings: Settings = {
  theme: "dark",
  language: "en",
  autoScanOnStart: true,
  launcherPaths: {
    steam: "",
    epic: "",
    ea: "",
    rockstar: "",
  } as Record<string, string>,
  librarySettings: {
    cacheGameMetadata: true,
    autoUpdateMetadata: true,
    defaultView: "grid",
    sortBy: "title",
    groupBy: "none",
  },
  browserSettings: {
    defaultSearchEngine: "https://www.google.com/search?q=",
    homepage: "https://www.google.com",
    blockAds: false,
    enableJavascript: true,
  },
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: defaultSettings,
  isLoading: false,
  error: null,
  setSettings: (settings) => set({ settings }),
  updateSettings: (updates) =>
    set((state) => ({
      settings: { ...state.settings, ...updates },
    })),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  resetSettings: () => set({ settings: defaultSettings }),
}));

