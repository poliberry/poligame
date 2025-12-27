import React, { useEffect } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { useThemeStore } from "@/stores/themeStore";
import { useTheme } from "next-themes";

// Inner component that handles custom theme colors
const ThemeColorsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Select individual color values to ensure React detects changes
  const accent = useThemeStore((state) => state.colors.accent);
  const button = useThemeStore((state) => state.colors.button);
  const buttonSecondary = useThemeStore((state) => state.colors.buttonSecondary);
  const background = useThemeStore((state) => state.colors.background);
  const panel = useThemeStore((state) => state.colors.panel);

  useEffect(() => {
    // Apply theme colors as CSS variables to document root
    const root = document.documentElement;
    root.style.setProperty("--theme-accent", accent);
    root.style.setProperty("--theme-button", button);
    root.style.setProperty("--theme-button-secondary", buttonSecondary || accent);
    root.style.setProperty("--theme-background", background);
    root.style.setProperty("--theme-panel", panel);
  }, [accent, button, buttonSecondary, background, panel]);

  return <>{children}</>;
};

// Theme mode sync component - syncs next-themes with our store
const ThemeModeSync: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const storeMode = useThemeStore((state) => state.mode);
  const setStoreMode = useThemeStore((state) => state.setMode);

  useEffect(() => {
    // Initialize: if store has a mode and next-themes doesn't match, update next-themes
    if (storeMode && theme !== storeMode) {
      setTheme(storeMode);
    }
  }, []); // Only on mount

  useEffect(() => {
    // Sync next-themes changes to store
    if (theme && theme !== storeMode) {
      setStoreMode(theme as "light" | "dark" | "system");
    }
  }, [theme, storeMode, setStoreMode]);

  return null;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialMode = useThemeStore((state) => state.mode);
  
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={initialMode}
      enableSystem
      disableTransitionOnChange={false}
    >
      <ThemeModeSync />
      <ThemeColorsProvider>{children}</ThemeColorsProvider>
    </NextThemesProvider>
  );
};

