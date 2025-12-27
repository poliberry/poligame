import { create } from "zustand";
import { Game } from "@/types";

interface OverdriveStore {
  selectedGame: Game | null;
  selectedIndex: number;
  setSelectedGame: (game: Game | null) => void;
  setSelectedIndex: (index: number) => void;
}

export const useOverdriveStore = create<OverdriveStore>((set) => ({
  selectedGame: null,
  selectedIndex: 0,
  setSelectedGame: (game) => set({ selectedGame: game }),
  setSelectedIndex: (index) => set({ selectedIndex: index }),
}));

