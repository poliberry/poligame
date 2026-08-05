import { detectControllerType } from "@/stores/controllerStore";

/**
 * Maps a raw Gamepad's `buttons`/`axes` arrays to named logical inputs.
 *
 * The browser's Gamepad API only guarantees consistent button/axis ordering
 * when `gamepad.mapping === "standard"` (the W3C "standard gamepad" layout).
 * Controllers that aren't recognized by the OS/browser's built-in gamepad
 * database report their raw HID layout instead, with `mapping === ""`.
 * DualShock 4 / DualSense pads hit this far more often than Xbox pads,
 * especially on Linux (WebKitGTK) without the `hid-sony`/`hid-playstation`
 * kernel modules, and occasionally on macOS - which is why PlayStation
 * controllers were completely non-functional while Xbox controllers mostly
 * worked.
 */
export interface GamepadMapping {
  buttons: {
    A: number;
    B: number;
    X: number;
    Y: number;
    LB: number;
    RB: number;
    LT: number;
    RT: number;
    START: number;
    SELECT: number;
    /** -1 when the d-pad isn't exposed as buttons (see `dpadAxis` instead). */
    DPAD_UP: number;
    DPAD_DOWN: number;
    DPAD_LEFT: number;
    DPAD_RIGHT: number;
  };
  axes: {
    LEFT_X: number;
    LEFT_Y: number;
  };
  /**
   * Some non-standard-mapped pads (notably DS4/DualSense) report the d-pad
   * as a single hat-switch value on an axis rather than four buttons.
   */
  dpadAxis?: {
    index: number;
    decode: (value: number) => "UP" | "DOWN" | "LEFT" | "RIGHT" | null;
  };
}

// The W3C "standard gamepad" layout - used whenever the browser reports
// gamepad.mapping === "standard" (true for most controllers on Windows, and
// for most controllers on any platform once the OS/browser recognizes them).
export const STANDARD_MAPPING: GamepadMapping = {
  buttons: {
    A: 0,
    B: 1,
    X: 2,
    Y: 3,
    LB: 4,
    RB: 5,
    LT: 6,
    RT: 7,
    SELECT: 8,
    START: 9,
    DPAD_UP: 12,
    DPAD_DOWN: 13,
    DPAD_LEFT: 14,
    DPAD_RIGHT: 15,
  },
  axes: {
    LEFT_X: 0,
    LEFT_Y: 1,
  },
};

// Decodes the common 8-direction hat-switch encoding some non-standard-mapped
// PlayStation pads report on an axis for the d-pad. Only cardinal directions
// are exposed since that's all Overdrive's navigation uses.
//
// Values run roughly: UP=-1, UP_RIGHT=-0.71, RIGHT=-0.43, DOWN_RIGHT=-0.14,
// DOWN=0.14, DOWN_LEFT=0.43, LEFT=0.71, UP_LEFT=1, NEUTRAL~1.28 (varies by
// pad, but is reliably outside the [-1, 1] range the eight pressed directions
// occupy) - so neutral must be detected as "out of range", not as "very
// negative", or UP (exactly -1) is misread as neutral and never fires.
function decodeHatSwitch(value: number): "UP" | "DOWN" | "LEFT" | "RIGHT" | null {
  if (value < -1.01 || value > 1.01) return null; // neutral (out of range)
  if (value >= -1 && value < -0.85) return "UP";
  if (value >= -0.6 && value < -0.3) return "RIGHT";
  if (value >= 0 && value < 0.3) return "DOWN";
  if (value >= 0.6 && value < 0.85) return "LEFT";
  return null; // a diagonal, or an in-range neutral value for this pad
}

// Best-effort fallback for DualShock 4 / DualSense pads reporting a
// non-"standard" mapping (raw HID report order). Cross/Circle/Square/Triangle
// map to A/B/X/Y respectively so labels drawn from `detectControllerType`
// still line up with the physical buttons.
//
// NOTE: These indices are inferred from publicly documented DS4/DualSense raw
// HID reports, not verified against physical hardware in this environment.
// They're intentionally isolated in this one small table so they're easy to
// correct - see the one-shot diagnostic in `resolveMapping` below, which logs
// the exact `gamepad.id`/`mapping` values needed to fix them for a specific
// device/platform combination.
export const SONY_FALLBACK_MAPPING: GamepadMapping = {
  buttons: {
    A: 1, // Circle
    B: 2, // Square... kept distinct from X/Y below for label purposes
    X: 0, // Cross
    Y: 3, // Triangle
    LB: 4,
    RB: 5,
    LT: 6,
    RT: 7,
    SELECT: 8, // Share
    START: 9, // Options
    DPAD_UP: -1,
    DPAD_DOWN: -1,
    DPAD_LEFT: -1,
    DPAD_RIGHT: -1,
  },
  axes: {
    LEFT_X: 0,
    LEFT_Y: 1,
  },
  dpadAxis: {
    index: 9,
    decode: decodeHatSwitch,
  },
};

const warnedNonStandardIds = new Set<string>();

/**
 * Picks the right mapping table for a connected gamepad. Falls back to the
 * standard layout for unrecognized non-standard pads (no worse than before),
 * and logs a one-shot diagnostic so a real fallback table can be added/tuned
 * from user reports without spamming the console every frame.
 */
export function resolveMapping(gamepad: Gamepad): GamepadMapping {
  if (gamepad.mapping === "standard") {
    return STANDARD_MAPPING;
  }

  if (!warnedNonStandardIds.has(gamepad.id)) {
    warnedNonStandardIds.add(gamepad.id);
    console.warn(
      `[gamepad] Non-standard mapping for controller "${gamepad.id}" ` +
        `(mapping="${gamepad.mapping}", buttons=${gamepad.buttons.length}, axes=${gamepad.axes.length}). ` +
        `Falling back to a best-effort layout - if navigation is still wrong for this controller, ` +
        `please report this exact id/mapping so its layout can be corrected.`
    );
  }

  const type = detectControllerType(gamepad);
  if (type === "playstation") {
    return SONY_FALLBACK_MAPPING;
  }

  return STANDARD_MAPPING;
}
