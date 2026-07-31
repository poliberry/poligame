import React, { useEffect } from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useThemeStore } from "@/stores/themeStore";
import type { ThemeManifest } from "@/types/theme";

function applyThemeVars(theme: ThemeManifest | null, root: HTMLElement) {
  if (!theme) return;

  const colors = theme.colors ?? {};
  const typography = theme.typography ?? {};
  const appearance = theme.appearance ?? {};

  // Tailwind/shadcn palette
  if (colors.background) root.style.setProperty("--background", colors.background);
  if (colors.foreground) root.style.setProperty("--foreground", colors.foreground);
  if (colors.card) root.style.setProperty("--card", colors.card);
  if (colors.popover) root.style.setProperty("--popover", colors.popover);
  if (colors.primary) root.style.setProperty("--primary", colors.primary);
  if (colors.primary_foreground)
    root.style.setProperty("--primary-foreground", colors.primary_foreground);
  if (colors.secondary) root.style.setProperty("--secondary", colors.secondary);
  if (colors.secondary_foreground)
    root.style.setProperty("--secondary-foreground", colors.secondary_foreground);
  if (colors.muted) root.style.setProperty("--muted", colors.muted);
  if (colors.muted_foreground)
    root.style.setProperty("--muted-foreground", colors.muted_foreground);
  if (colors.accent) root.style.setProperty("--accent", colors.accent);
  if (colors.accent_foreground)
    root.style.setProperty("--accent-foreground", colors.accent_foreground);
  if (colors.destructive) root.style.setProperty("--destructive", colors.destructive);
  if (colors.border) root.style.setProperty("--border", colors.border);
  if (colors.input) root.style.setProperty("--input", colors.input);
  if (colors.ring) root.style.setProperty("--ring", colors.ring);

  // Custom app vars
  if (colors.theme_accent) root.style.setProperty("--theme-accent", colors.theme_accent);
  if (colors.theme_button) root.style.setProperty("--theme-button", colors.theme_button);
  if (colors.theme_button_secondary)
    root.style.setProperty("--theme-button-secondary", colors.theme_button_secondary);
  if (colors.theme_panel) root.style.setProperty("--theme-panel", colors.theme_panel);

  // Typography
  if (typography.font_family && typography.font_family !== "system-ui") {
    root.style.setProperty("--theme-font-family", `"${typography.font_family}", system-ui, sans-serif`);
  } else {
    root.style.setProperty("--theme-font-family", "system-ui, sans-serif");
  }

  // Appearance
  if (appearance.border_radius) {
    root.style.setProperty("--radius", appearance.border_radius);
    root.style.setProperty("--theme-border-radius", appearance.border_radius);
  }
  if (appearance.background_image) {
    root.style.setProperty("--theme-bg-image", `url("${appearance.background_image}")`);
    root.style.setProperty(
      "--theme-bg-opacity",
      String(appearance.background_image_opacity ?? 0.15)
    );
  } else {
    root.style.removeProperty("--theme-bg-image");
    root.style.removeProperty("--theme-bg-opacity");
  }
}

const ThemeVarsApplier: React.FC = () => {
  const activeTheme = useThemeStore((s) => s.activeTheme);
  const colors = useThemeStore((s) => s.colors);

  // Apply active theme CSS vars
  useEffect(() => {
    const root = document.documentElement;
    applyThemeVars(activeTheme, root);
  }, [activeTheme]);

  // Legacy quick-edit overrides — skipped when a manifest theme is active so the
  // manifest's theme_* colors are not clobbered by the legacy palette.
  useEffect(() => {
    if (activeTheme) return;
    const root = document.documentElement;
    root.style.setProperty("--theme-accent", colors.accent);
    root.style.setProperty("--theme-button", colors.button);
    root.style.setProperty("--theme-button-secondary", colors.buttonSecondary || colors.accent);
    root.style.setProperty("--theme-background", colors.background);
    root.style.setProperty("--theme-panel", colors.panel);
  }, [activeTheme, colors.accent, colors.button, colors.buttonSecondary, colors.background, colors.panel]);

  return null;
};

const ThemeModeSync: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const storeMode = useThemeStore((s) => s.mode);
  const setStoreMode = useThemeStore((s) => s.setMode);

  // One-time init: push store's persisted mode into next-themes
  useEffect(() => {
    if (storeMode && theme !== storeMode) {
      setTheme(storeMode);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep store in sync with next-themes changes (e.g. system toggle)
  useEffect(() => {
    if (theme && theme !== storeMode) {
      setStoreMode(theme as "light" | "dark" | "system");
    }
  }, [theme]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
};

const ThemeLoader: React.FC = () => {
  const loadThemes = useThemeStore((s) => s.loadThemes);
  const themesLoaded = useThemeStore((s) => s.themesLoaded);

  useEffect(() => {
    if (!themesLoaded) {
      loadThemes();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialMode = useThemeStore((s) => s.mode);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={initialMode}
      enableSystem
      disableTransitionOnChange={false}
    >
      <ThemeModeSync />
      <ThemeLoader />
      <ThemeVarsApplier />
      {children}
    </NextThemesProvider>
  );
};
