export interface ThemeColors {
  background?: string;
  foreground?: string;
  card?: string;
  popover?: string;
  primary?: string;
  primary_foreground?: string;
  secondary?: string;
  secondary_foreground?: string;
  muted?: string;
  muted_foreground?: string;
  accent?: string;
  accent_foreground?: string;
  destructive?: string;
  border?: string;
  input?: string;
  ring?: string;
  theme_accent?: string;
  theme_button?: string;
  theme_button_secondary?: string;
  theme_panel?: string;
}

export interface ThemeTypography {
  font_family?: string;
}

export interface ThemeAppearance {
  border_radius?: string;
  background_image?: string;
  background_image_opacity?: number;
}

export interface ThemeManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  publisher: string;
  description?: string;
  mascot_file?: string;
  colors?: ThemeColors;
  typography?: ThemeTypography;
  appearance?: ThemeAppearance;
}

export const OFFICIAL_PUBLISHER = "poligame";

export function isOfficialTheme(theme: ThemeManifest): boolean {
  return theme.publisher === OFFICIAL_PUBLISHER;
}
