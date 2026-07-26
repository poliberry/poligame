import { create } from "zustand";

type KeyboardLayoutMode = "letters" | "numbers" | "symbols";

interface OpenKeyboardOptions {
  title?: string;
  initialValue?: string;
  maxLength?: number;
  onCommit: (value: string) => void;
  onCancel?: () => void;
}

interface OverdriveKeyboardStore {
  isOpen: boolean;
  title: string;
  value: string;
  maxLength: number;
  mode: KeyboardLayoutMode;
  shiftOneShot: boolean;
  capsLock: boolean;
  openKeyboard: (options: OpenKeyboardOptions) => void;
  closeKeyboard: (invokeCancel?: boolean) => void;
  setValue: (value: string) => void;
  cycleMode: (direction: "next" | "prev") => void;
  toggleShift: () => void;
  commit: () => void;
  clear: () => void;
}

const KEYBOARD_MODES: KeyboardLayoutMode[] = ["letters", "numbers", "symbols"];

let commitCallback: ((value: string) => void) | null = null;
let cancelCallback: (() => void) | null = null;

export const useOverdriveKeyboardStore = create<OverdriveKeyboardStore>((set, get) => ({
  isOpen: false,
  title: "Keyboard",
  value: "",
  maxLength: 1200,
  mode: "letters",
  shiftOneShot: false,
  capsLock: false,
  openKeyboard: (options) => {
    commitCallback = options.onCommit;
    cancelCallback = options.onCancel || null;

    set({
      isOpen: true,
      title: options.title || "Keyboard",
      value: options.initialValue || "",
      maxLength: options.maxLength || 1200,
      mode: "letters",
      shiftOneShot: false,
      capsLock: false,
    });
  },
  closeKeyboard: (invokeCancel = false) => {
    if (invokeCancel && cancelCallback) {
      cancelCallback();
    }

    set({
      isOpen: false,
      shiftOneShot: false,
      capsLock: false,
    });
  },
  setValue: (value) => set({ value }),
  cycleMode: (direction) => {
    const mode = get().mode;
    const idx = KEYBOARD_MODES.indexOf(mode);
    const nextIdx = direction === "next"
      ? (idx + 1) % KEYBOARD_MODES.length
      : (idx - 1 + KEYBOARD_MODES.length) % KEYBOARD_MODES.length;
    set({ mode: KEYBOARD_MODES[nextIdx] });
  },
  toggleShift: () => {
    set((state) => {
      if (state.capsLock) {
        return { capsLock: false, shiftOneShot: false };
      }
      return { shiftOneShot: !state.shiftOneShot };
    });
  },
  commit: () => {
    if (commitCallback) {
      commitCallback(get().value);
    }
    get().closeKeyboard(false);
  },
  clear: () => set({ value: "" }),
}));
