import { useEffect, useRef } from "react";
import { subscribeGamepad } from "./gamepadManager";

/**
 * Per-component adapter over the app-wide `gamepadManager` singleton (see
 * that file for why this is a singleton and not a per-hook-instance poll).
 *
 * NOTE: despite the name, this is no longer backed by the `responsive-gamepad`
 * npm package - it was replaced with an in-house reader so PlayStation
 * controllers (which often report a non-"standard" Gamepad API mapping that
 * the old library couldn't account for) and so simultaneously-mounted call
 * sites can no longer tear down each other's input handling. The name is
 * kept to avoid touching the ~13 call sites that already use it; the public
 * options below are unchanged.
 */
interface UseResponsiveGamepadOptions {
  onButtonDown?: (button: string) => void;
  onLeftStick?: (x: number, y: number) => void;
  onDPad?: (direction: "UP" | "DOWN" | "LEFT" | "RIGHT") => void;
}

const STICK_COOLDOWN_MS = 150;

export function useResponsiveGamepad(options: UseResponsiveGamepadOptions = {}) {
  // Callbacks are stored in refs and refreshed every render so the
  // subscription effect below never needs to depend on their identity. This
  // is what lets it use an empty dependency array: every call site currently
  // passes brand-new inline callbacks on every render, and previously that
  // meant the effect (and the shared gamepad polling it enabled/disabled)
  // tore down and rebuilt on nearly every render across the whole app.
  const onButtonDownRef = useRef(options.onButtonDown);
  const onLeftStickRef = useRef(options.onLeftStick);
  const onDPadRef = useRef(options.onDPad);
  onButtonDownRef.current = options.onButtonDown;
  onLeftStickRef.current = options.onLeftStick;
  onDPadRef.current = options.onDPad;

  const lastStickX = useRef(0);
  const lastStickY = useRef(0);
  const stickCooldownUntil = useRef(0);

  useEffect(() => {
    const unsubscribe = subscribeGamepad({
      onButtonDown: (button) => onButtonDownRef.current?.(button),
      onDPadDown: (direction) => onDPadRef.current?.(direction),
      onStick: (x, y) => {
        const onLeftStick = onLeftStickRef.current;
        if (!onLeftStick) return;
        if (x === lastStickX.current && y === lastStickY.current) return;

        const now = Date.now();
        if (now < stickCooldownUntil.current) return;

        lastStickX.current = x;
        lastStickY.current = y;
        stickCooldownUntil.current = now + STICK_COOLDOWN_MS;
        onLeftStick(x, y);
      },
    });

    return unsubscribe;
    // Intentionally empty: subscribe once per mount, see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
