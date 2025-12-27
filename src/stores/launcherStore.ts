import { create } from "zustand";
import { LauncherStatus, LauncherType } from "@/types";

interface LauncherStore {
  launchers: LauncherStatus[];
  isScanning: boolean;
  error: string | null;
  setLaunchers: (launchers: LauncherStatus[]) => void;
  updateLauncher: (type: LauncherType, updates: Partial<LauncherStatus>) => void;
  setScanning: (scanning: boolean) => void;
  setError: (error: string | null) => void;
  getLauncherByType: (type: LauncherType) => LauncherStatus | undefined;
  getInstalledLaunchers: () => LauncherStatus[];
}

export const useLauncherStore = create<LauncherStore>((set, get) => ({
  launchers: [],
  isScanning: false,
  error: null,
  setLaunchers: (launchers) => set({ launchers }),
  updateLauncher: (type, updates) =>
    set((state) => ({
      launchers: state.launchers.map((launcher) =>
        launcher.launcherType === type
          ? { ...launcher, ...updates }
          : launcher
      ),
    })),
  setScanning: (scanning) => set({ isScanning: scanning }),
  setError: (error) => set({ error }),
  getLauncherByType: (type) =>
    get().launchers.find((launcher) => launcher.launcherType === type),
  getInstalledLaunchers: () =>
    get().launchers.filter((launcher) => launcher.installed),
}));

