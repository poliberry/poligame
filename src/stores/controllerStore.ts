import { create } from "zustand";

export type ControllerType = "xbox" | "playstation" | "nintendo" | "generic" | null;

interface ControllerStore {
  controllerType: ControllerType;
  isConnected: boolean;
  setControllerType: (type: ControllerType) => void;
  setIsConnected: (connected: boolean) => void;
}

export const useControllerStore = create<ControllerStore>((set) => ({
  controllerType: null,
  isConnected: false,
  setControllerType: (type) => set({ controllerType: type }),
  setIsConnected: (connected) => set({ isConnected: connected }),
}));

// Detect controller type from gamepad ID
export const detectControllerType = (gamepad: Gamepad): ControllerType => {
  const id = gamepad.id.toLowerCase();
  
  // Xbox controllers
  if (id.includes("xbox") || id.includes("microsoft") || id.includes("045e")) {
    return "xbox";
  }
  
  // PlayStation controllers
  if (id.includes("playstation") || id.includes("sony") || id.includes("054c") || id.includes("wireless controller")) {
    return "playstation";
  }
  
  // Nintendo controllers
  if (id.includes("nintendo") || id.includes("pro controller") || id.includes("joy-con") || id.includes("057e")) {
    return "nintendo";
  }
  
  return "generic";
};

