import { create } from "zustand";
import { Game } from "@/types";

interface GameStore {
  games: Game[];
  selectedGame: Game | null;
  isLoading: boolean;
  error: string | null;
  setGames: (games: Game[]) => void;
  addGame: (game: Game) => void;
  updateGame: (gameId: string, updates: Partial<Game>) => void;
  removeGame: (gameId: string) => void;
  setSelectedGame: (game: Game | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  filterGames: (predicate: (game: Game) => boolean) => Game[];
  getGameById: (gameId: string) => Game | undefined;
}

export const useGameStore = create<GameStore>((set, get) => ({
  games: [],
  selectedGame: null,
  isLoading: false,
  error: null,
  setGames: (games) => set({ games }),
  addGame: (game) => set((state) => ({ games: [...state.games, game] })),
  updateGame: (gameId, updates) =>
    set((state) => ({
      games: state.games.map((game) =>
        game.id === gameId ? { ...game, ...updates } : game
      ),
      selectedGame:
        state.selectedGame?.id === gameId
          ? { ...state.selectedGame, ...updates }
          : state.selectedGame,
    })),
  removeGame: (gameId) =>
    set((state) => ({
      games: state.games.filter((game) => game.id !== gameId),
      selectedGame:
        state.selectedGame?.id === gameId ? null : state.selectedGame,
    })),
  setSelectedGame: (game) => set({ selectedGame: game }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  filterGames: (predicate) => get().games.filter(predicate),
  getGameById: (gameId) => get().games.find((game) => game.id === gameId),
}));

