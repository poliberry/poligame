import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settingsStore";

/**
 * Component that applies accessibility filters (grayscale, high contrast) to the app
 */
export const AccessibilityFilter: React.FC = () => {
  const { settings } = useSettingsStore();

  useEffect(() => {
    const rootElement = document.documentElement;
    const bodyElement = document.body;

    // Build filter string
    const filters: string[] = [];
    
    if (settings.accessibilitySettings?.grayscale) {
      filters.push("grayscale(100%)");
    }
    
    if (settings.accessibilitySettings?.highContrast) {
      // High contrast: increase contrast and brightness
      filters.push("contrast(150%) brightness(110%)");
    }

    const filterValue = filters.length > 0 ? filters.join(" ") : "none";

    // Apply to root and body
    rootElement.style.filter = filterValue;
    bodyElement.style.filter = filterValue;

    // Also add high contrast CSS variables if needed
    if (settings.accessibilitySettings?.highContrast) {
      rootElement.style.setProperty("--high-contrast", "1");
    } else {
      rootElement.style.removeProperty("--high-contrast");
    }

    return () => {
      // Cleanup on unmount
      rootElement.style.filter = "";
      bodyElement.style.filter = "";
      rootElement.style.removeProperty("--high-contrast");
    };
  }, [settings.accessibilitySettings?.grayscale, settings.accessibilitySettings?.highContrast]);

  return null; // This component doesn't render anything
};

