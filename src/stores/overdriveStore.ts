import { create } from "zustand";
import { Game } from "@/types";

interface OverdriveStore {
  selectedGame: Game | null;
  selectedIndex: number;
  showBatteryIndicator: boolean;
  isMenuOpen: boolean;
  isPowerDialogOpen: boolean;
  isTopBarFocused: boolean;
  setSelectedGame: (game: Game | null) => void;
  setSelectedIndex: (index: number) => void;
  setShowBatteryIndicator: (show: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  toggleMenu: () => void;
  setPowerDialogOpen: (open: boolean) => void;
  setTopBarFocused: (focused: boolean) => void;
}

const BATTERY_PREF_KEY = "overdrive-show-battery";

const loadBatteryPreference = (): boolean => {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const raw = localStorage.getItem(BATTERY_PREF_KEY);
    if (raw == null) {
      return true;
    }
    return raw === "1";
  } catch (error) {
    console.error("Failed to load Overdrive battery preference:", error);
    return true;
  }
};

export const useOverdriveStore = create<OverdriveStore>((set) => ({
  selectedGame: null,
  selectedIndex: 0,
  showBatteryIndicator: loadBatteryPreference(),
  isMenuOpen: false,
  isPowerDialogOpen: false,
  isTopBarFocused: false,
  setSelectedGame: (game) => set({ selectedGame: game }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),
  setShowBatteryIndicator: (show) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(BATTERY_PREF_KEY, show ? "1" : "0");
      } catch (error) {
        console.error("Failed to save Overdrive battery preference:", error);
      }
    }

    set({ showBatteryIndicator: show });
  },
  setMenuOpen: (open) => set({ isMenuOpen: open }),
  toggleMenu: () => set((state) => ({ isMenuOpen: !state.isMenuOpen })),
  setPowerDialogOpen: (open) => set({ isPowerDialogOpen: open }),
  setTopBarFocused: (focused) => set({ isTopBarFocused: focused }),
}));

