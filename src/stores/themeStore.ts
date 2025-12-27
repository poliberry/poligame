import { create } from "zustand";

export interface ThemeColors {
  accent: string;
  button: string;
  buttonSecondary?: string; // For gradient buttons, this is the second color
  background: string;
  panel: string;
}

export type ThemeMode = "light" | "dark" | "system";

const defaultTheme: ThemeColors = {
  accent: "#4CE4B1",
  button: "#006B4F",
  buttonSecondary: "#4CE4B1", // For gradient
  background: "#111827", // gray-900
  panel: "#1F2937", // gray-800
};

const THEME_MODE_KEY = "poligame-theme-mode";

// Load theme from localStorage
const loadThemeFromStorage = (): ThemeColors => {
  if (typeof window === "undefined") return defaultTheme;
  try {
    const stored = localStorage.getItem("poligame-theme");
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultTheme, ...parsed };
    }
  } catch (error) {
    console.error("Failed to load theme from storage:", error);
  }
  return defaultTheme;
};

// Save theme to localStorage
const saveThemeToStorage = (colors: ThemeColors) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("poligame-theme", JSON.stringify(colors));
  } catch (error) {
    console.error("Failed to save theme to storage:", error);
  }
};

// Load theme mode from localStorage
const loadThemeModeFromStorage = (): ThemeMode => {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(THEME_MODE_KEY);
    if (stored && (stored === "light" || stored === "dark" || stored === "system")) {
      return stored as ThemeMode;
    }
  } catch (error) {
    console.error("Failed to load theme mode from storage:", error);
  }
  return "dark";
};

// Save theme mode to localStorage
const saveThemeModeToStorage = (mode: ThemeMode) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THEME_MODE_KEY, mode);
  } catch (error) {
    console.error("Failed to save theme mode to storage:", error);
  }
};

interface ThemeStore {
  colors: ThemeColors;
  mode: ThemeMode;
  setColors: (colors: Partial<ThemeColors>) => void;
  setMode: (mode: ThemeMode) => void;
  resetTheme: () => void;
}

export const useThemeStore = create<ThemeStore>((set) => {
  const initialColors = loadThemeFromStorage();
  const initialMode = loadThemeModeFromStorage();
  
  return {
    colors: initialColors,
    mode: initialMode,
    setColors: (newColors) => {
      set((state) => {
        const updatedColors = { ...state.colors, ...newColors };
        saveThemeToStorage(updatedColors);
        // Return a completely new object to ensure Zustand detects the change
        return { colors: { ...updatedColors } };
      });
    },
    setMode: (mode) => {
      saveThemeModeToStorage(mode);
      set({ mode });
    },
    resetTheme: () => {
      saveThemeToStorage(defaultTheme);
      set({ colors: defaultTheme });
    },
  };
});
