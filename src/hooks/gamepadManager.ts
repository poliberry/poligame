import { useControllerStore, detectControllerType } from "@/stores/controllerStore";
import { resolveMapping, type GamepadMapping } from "./gamepadMappings";

/**
 * A single, app-wide gamepad reader.
 *
 * Overdrive used to have every component that needed controller input
 * (`Overdrive.tsx`, `OverdriveTopBar`, `OverdriveMenu`, `OverdrivePowerDialog`,
 * `OverdriveGlobalKeyboard`, per-page views, ...) independently enable/disable
 * a *global* third-party polling singleton on every mount/unmount. Because 6+
 * of those components are mounted at once and re-render constantly for
 * unrelated reasons, that singleton was being torn down and rebuilt on
 * nearly every render, dropping button-press edges and stick updates for
 * every other mounted listener - this is what caused "buttons need multiple
 * presses" and "stick works intermittently".
 *
 * This module fixes that by owning exactly one requestAnimationFrame loop
 * and one set of subscribers for the whole app. Subscribing/unsubscribing
 * never tears down anyone else's listeners; it only adds/removes an entry
 * from a plain Set. Button/d-pad press-edge detection also happens exactly
 * once per frame here (not once per subscriber), so simultaneously mounted
 * consumers can never observe inconsistent edges.
 */

export type GamepadButtonName =
  | "A"
  | "B"
  | "X"
  | "Y"
  | "LB"
  | "RB"
  | "LT"
  | "RT"
  | "START"
  | "SELECT";

export type GamepadDPadDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";

export interface GamepadManagerListener {
  /** Fires once per press, on the down-edge only. */
  onButtonDown?: (button: GamepadButtonName) => void;
  /** Fires once per press, on the down-edge only. */
  onDPadDown?: (direction: GamepadDPadDirection) => void;
  /** Fires every frame with the current (raw, un-debounced) left-stick axes. */
  onStick?: (x: number, y: number) => void;
}

interface NormalizedState {
  A: boolean;
  B: boolean;
  X: boolean;
  Y: boolean;
  LB: boolean;
  RB: boolean;
  LT: boolean;
  RT: boolean;
  START: boolean;
  SELECT: boolean;
  DPAD_UP: boolean;
  DPAD_DOWN: boolean;
  DPAD_LEFT: boolean;
  DPAD_RIGHT: boolean;
}

const EMPTY_STATE: NormalizedState = {
  A: false,
  B: false,
  X: false,
  Y: false,
  LB: false,
  RB: false,
  LT: false,
  RT: false,
  START: false,
  SELECT: false,
  DPAD_UP: false,
  DPAD_DOWN: false,
  DPAD_LEFT: false,
  DPAD_RIGHT: false,
};

const BUTTON_NAMES: GamepadButtonName[] = [
  "A",
  "B",
  "X",
  "Y",
  "LB",
  "RB",
  "LT",
  "RT",
  "START",
  "SELECT",
];

const DPAD_DIRECTIONS: { direction: GamepadDPadDirection; key: keyof NormalizedState }[] = [
  { direction: "UP", key: "DPAD_UP" },
  { direction: "DOWN", key: "DPAD_DOWN" },
  { direction: "LEFT", key: "DPAD_LEFT" },
  { direction: "RIGHT", key: "DPAD_RIGHT" },
];

const listeners = new Set<GamepadManagerListener>();
let rafId: number | null = null;
let lastState: NormalizedState = EMPTY_STATE;
let lastGamepadIndex: number | null = null;

// A subscriber's callback throwing must never take down the shared polling
// loop for every other mounted consumer - isolate each call so one bad
// listener can't stop input for the rest of the app.
function notify<T extends unknown[]>(fn: ((...args: T) => void) | undefined, ...args: T) {
  if (!fn) return;
  try {
    fn(...args);
  } catch (error) {
    console.error("[gamepad] Listener threw:", error);
  }
}

function readFirstConnectedGamepad(): Gamepad | null {
  const gamepads = navigator.getGamepads();
  for (const gp of gamepads) {
    if (gp) return gp;
  }
  return null;
}

function isPressed(gamepad: Gamepad, buttonIndex: number): boolean {
  if (buttonIndex < 0) return false;
  const button = gamepad.buttons[buttonIndex];
  return !!button && button.pressed;
}

function normalize(gamepad: Gamepad, mapping: GamepadMapping): NormalizedState {
  let dpadUp = isPressed(gamepad, mapping.buttons.DPAD_UP);
  let dpadDown = isPressed(gamepad, mapping.buttons.DPAD_DOWN);
  let dpadLeft = isPressed(gamepad, mapping.buttons.DPAD_LEFT);
  let dpadRight = isPressed(gamepad, mapping.buttons.DPAD_RIGHT);

  if (mapping.dpadAxis) {
    const axisValue = gamepad.axes[mapping.dpadAxis.index];
    const direction = typeof axisValue === "number" ? mapping.dpadAxis.decode(axisValue) : null;
    dpadUp = direction === "UP";
    dpadDown = direction === "DOWN";
    dpadLeft = direction === "LEFT";
    dpadRight = direction === "RIGHT";
  }

  return {
    A: isPressed(gamepad, mapping.buttons.A),
    B: isPressed(gamepad, mapping.buttons.B),
    X: isPressed(gamepad, mapping.buttons.X),
    Y: isPressed(gamepad, mapping.buttons.Y),
    LB: isPressed(gamepad, mapping.buttons.LB),
    RB: isPressed(gamepad, mapping.buttons.RB),
    LT: isPressed(gamepad, mapping.buttons.LT),
    RT: isPressed(gamepad, mapping.buttons.RT),
    START: isPressed(gamepad, mapping.buttons.START),
    SELECT: isPressed(gamepad, mapping.buttons.SELECT),
    DPAD_UP: dpadUp,
    DPAD_DOWN: dpadDown,
    DPAD_LEFT: dpadLeft,
    DPAD_RIGHT: dpadRight,
  };
}

function updateControllerStore(gamepad: Gamepad | null) {
  const store = useControllerStore.getState();
  if (gamepad) {
    const controllerType = detectControllerType(gamepad);
    if (store.controllerType !== controllerType || !store.isConnected) {
      store.setControllerType(controllerType);
      store.setIsConnected(true);
    }
  } else if (store.isConnected || store.controllerType !== null) {
    store.setIsConnected(false);
    store.setControllerType(null);
  }
}

function tick() {
  const gamepad = readFirstConnectedGamepad();
  updateControllerStore(gamepad);

  if (!gamepad) {
    lastState = EMPTY_STATE;
    lastGamepadIndex = null;
    rafId = listeners.size > 0 ? requestAnimationFrame(tick) : null;
    return;
  }

  // If the "active" gamepad slot changed (e.g. the previous controller
  // disconnected and a different one took over index 0), reset edge state so
  // we don't misread its initial button states as a burst of fresh presses.
  if (lastGamepadIndex !== gamepad.index) {
    lastState = EMPTY_STATE;
    lastGamepadIndex = gamepad.index;
  }

  const mapping = resolveMapping(gamepad);
  const state = normalize(gamepad, mapping);

  for (const name of BUTTON_NAMES) {
    if (state[name] && !lastState[name]) {
      listeners.forEach((listener) => notify(listener.onButtonDown, name));
    }
  }
  for (const { direction, key } of DPAD_DIRECTIONS) {
    if (state[key] && !lastState[key]) {
      listeners.forEach((listener) => notify(listener.onDPadDown, direction));
    }
  }

  const leftX = gamepad.axes[mapping.axes.LEFT_X] ?? 0;
  const leftY = gamepad.axes[mapping.axes.LEFT_Y] ?? 0;
  listeners.forEach((listener) => notify(listener.onStick, leftX, leftY));

  lastState = state;
  // A listener's callback (invoked via `notify` above) may have synchronously
  // unsubscribed - possibly the last one - via the function `subscribeGamepad`
  // returned. That already called `cancelAnimationFrame` on this frame's own
  // (already-fired) id and reset `rafId` to null, but without this guard we'd
  // still unconditionally schedule another frame here, leaving the loop
  // running with zero listeners until something else happened to resubscribe.
  rafId = listeners.size > 0 ? requestAnimationFrame(tick) : null;
}

/**
 * Subscribes to gamepad input. The underlying rAF polling loop starts on the
 * first subscriber and stops on the last unsubscribe - it is never affected
 * by any individual subscriber's own re-render/mount/unmount cycle.
 */
export function subscribeGamepad(listener: GamepadManagerListener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    lastState = EMPTY_STATE;
    lastGamepadIndex = null;
    rafId = requestAnimationFrame(tick);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}
