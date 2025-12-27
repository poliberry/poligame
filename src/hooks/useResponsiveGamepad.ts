import { useEffect, useRef } from "react";
import { ResponsiveGamepad } from "responsive-gamepad";
import { useControllerStore, detectControllerType } from "@/stores/controllerStore";

interface UseResponsiveGamepadOptions {
  onButtonDown?: (button: string) => void;
  onLeftStick?: (x: number, y: number) => void;
  onDPad?: (direction: "UP" | "DOWN" | "LEFT" | "RIGHT") => void;
}

export function useResponsiveGamepad(options: UseResponsiveGamepadOptions = {}) {
  const { onButtonDown, onLeftStick, onDPad } = options;
  console.log("[useResponsiveGamepad] Hook called with options:", {
    hasOnButtonDown: !!onButtonDown,
    hasOnLeftStick: !!onLeftStick,
    hasOnDPad: !!onDPad,
  });
  const lastStickX = useRef<number>(0);
  const lastStickY = useRef<number>(0);
  const stickCooldown = useRef<number>(0);
  const stickCooldownTime = 150; // ms
  const lastButtonState = useRef<Record<string, boolean>>({});
  const lastDPadState = useRef<Record<string, boolean>>({});

  useEffect(() => {
    // Enable responsive-gamepad
    ResponsiveGamepad.enable();

    // Detect controller connection and type - only update if state changed
    const checkController = () => {
      const gamepads = navigator.getGamepads();
      const connectedGamepad = Array.from(gamepads).find(gp => gp !== null);
      const store = useControllerStore.getState();
      
      if (connectedGamepad) {
        const controllerType = detectControllerType(connectedGamepad);
        // Only update if state actually changed
        if (store.controllerType !== controllerType || !store.isConnected) {
          store.setControllerType(controllerType);
          store.setIsConnected(true);
        }
      } else {
        // Only update if state actually changed
        if (store.isConnected || store.controllerType !== null) {
          store.setIsConnected(false);
          store.setControllerType(null);
        }
      }
    };

    // Check on mount (once)
    checkController();

    // Listen for controller connect/disconnect events
    const handleGamepadConnected = (e: GamepadEvent) => {
      const controllerType = detectControllerType(e.gamepad);
      const store = useControllerStore.getState();
      // Only update if state actually changed
      if (store.controllerType !== controllerType || !store.isConnected) {
        store.setControllerType(controllerType);
        store.setIsConnected(true);
      }
    };

    const handleGamepadDisconnected = () => {
      // Check if any gamepads are still connected
      const gamepads = navigator.getGamepads();
      const hasConnected = Array.from(gamepads).some(gp => gp !== null);
      const store = useControllerStore.getState();
      
      if (!hasConnected) {
        // Only update if state actually changed
        if (store.isConnected || store.controllerType !== null) {
          store.setIsConnected(false);
          store.setControllerType(null);
        }
      }
    };

    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);

    // Poll periodically to catch controllers that were connected before page load
    // Use a longer interval to reduce unnecessary checks
    const pollInterval = setInterval(checkController, 2000);

    // Listen for button presses
    const buttonInputs = [
      ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.A,
      ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.B,
      ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.X,
      ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.Y,
      ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.LEFT_BUMPER,
      ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.RIGHT_BUMPER,
      ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.LEFT_TRIGGER,
      ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.RIGHT_TRIGGER,
      ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.START,
      ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.SELECT,
    ];

    // Listen for D-Pad
    const dpadInputs = [
      ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.DPAD_UP,
      ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.DPAD_DOWN,
      ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.DPAD_LEFT,
      ResponsiveGamepad.RESPONSIVE_GAMEPAD_INPUTS.DPAD_RIGHT,
    ];

    // Button press handler - only trigger on press, not release
    const cancelButtonListener = ResponsiveGamepad.onInputsChange(
      buttonInputs,
      (state) => {
        if (onButtonDown) {
          if (state.A && !lastButtonState.current.A) onButtonDown("A");
          if (state.B && !lastButtonState.current.B) onButtonDown("B");
          if (state.X && !lastButtonState.current.X) onButtonDown("X");
          if (state.Y && !lastButtonState.current.Y) onButtonDown("Y");
          if (state.LEFT_BUMPER && !lastButtonState.current.LEFT_BUMPER) {
            console.log("LB pressed");
            onButtonDown("LB");
          }
          if (state.RIGHT_BUMPER && !lastButtonState.current.RIGHT_BUMPER) {
            console.log("RB pressed");
            onButtonDown("RB");
          }
          if (state.LEFT_TRIGGER && !lastButtonState.current.LEFT_TRIGGER) onButtonDown("LT");
          if (state.RIGHT_TRIGGER && !lastButtonState.current.RIGHT_TRIGGER) onButtonDown("RT");
          if (state.START && !lastButtonState.current.START) onButtonDown("START");
          if (state.SELECT && !lastButtonState.current.SELECT) onButtonDown("SELECT");
        }
        // Update last state
        lastButtonState.current = {
          A: !!state.A,
          B: !!state.B,
          X: !!state.X,
          Y: !!state.Y,
          LEFT_BUMPER: !!state.LEFT_BUMPER,
          RIGHT_BUMPER: !!state.RIGHT_BUMPER,
          LEFT_TRIGGER: !!state.LEFT_TRIGGER,
          RIGHT_TRIGGER: !!state.RIGHT_TRIGGER,
          START: !!state.START,
          SELECT: !!state.SELECT,
        };
      }
    );

    // D-Pad handler - only trigger on press, not release
    const cancelDPadListener = ResponsiveGamepad.onInputsChange(
      dpadInputs,
      (state) => {
        console.log("[useResponsiveGamepad] D-Pad state changed:", state, "onDPad callback exists:", !!onDPad, "onDPad type:", typeof onDPad);
        if (onDPad) {
          if (state.DPAD_UP && !lastDPadState.current.DPAD_UP) {
            console.log("[useResponsiveGamepad] D-Pad UP pressed, calling onDPad('UP')");
            try {
              onDPad("UP");
              console.log("[useResponsiveGamepad] onDPad('UP') completed");
            } catch (error) {
              console.error("[useResponsiveGamepad] Error calling onDPad('UP'):", error);
            }
          }
          if (state.DPAD_DOWN && !lastDPadState.current.DPAD_DOWN) {
            console.log("[useResponsiveGamepad] D-Pad DOWN pressed, calling onDPad('DOWN')");
            try {
              onDPad("DOWN");
              console.log("[useResponsiveGamepad] onDPad('DOWN') completed");
            } catch (error) {
              console.error("[useResponsiveGamepad] Error calling onDPad('DOWN'):", error);
            }
          }
          if (state.DPAD_LEFT && !lastDPadState.current.DPAD_LEFT) {
            console.log("[useResponsiveGamepad] D-Pad LEFT pressed, calling onDPad('LEFT')");
            try {
              onDPad("LEFT");
              console.log("[useResponsiveGamepad] onDPad('LEFT') completed");
            } catch (error) {
              console.error("[useResponsiveGamepad] Error calling onDPad('LEFT'):", error);
            }
          }
          if (state.DPAD_RIGHT && !lastDPadState.current.DPAD_RIGHT) {
            console.log("[useResponsiveGamepad] D-Pad RIGHT pressed, calling onDPad('RIGHT')");
            try {
              onDPad("RIGHT");
              console.log("[useResponsiveGamepad] onDPad('RIGHT') completed");
            } catch (error) {
              console.error("[useResponsiveGamepad] Error calling onDPad('RIGHT'):", error);
            }
          }
        } else {
          console.warn("[useResponsiveGamepad] onDPad callback is not provided!");
        }
        // Update last state
        lastDPadState.current = {
          DPAD_UP: !!state.DPAD_UP,
          DPAD_DOWN: !!state.DPAD_DOWN,
          DPAD_LEFT: !!state.DPAD_LEFT,
          DPAD_RIGHT: !!state.DPAD_RIGHT,
        };
      }
    );

    // Left stick handler with polling (for smooth movement)
    let animationFrameId: number;
    const pollStick = () => {
      const state = ResponsiveGamepad.getState();
      const x = typeof state.LEFT_ANALOG_HORIZONTAL_AXIS === "number" 
        ? state.LEFT_ANALOG_HORIZONTAL_AXIS 
        : 0;
      const y = typeof state.LEFT_ANALOG_VERTICAL_AXIS === "number" 
        ? state.LEFT_ANALOG_VERTICAL_AXIS 
        : 0;

      const now = Date.now();
      if (onLeftStick && (x !== lastStickX.current || y !== lastStickY.current)) {
        // Only trigger if stick moved and cooldown passed
        if (now - stickCooldown.current >= stickCooldownTime) {
          onLeftStick(x, y);
          stickCooldown.current = now;
        }
        lastStickX.current = x;
        lastStickY.current = y;
      }

      animationFrameId = requestAnimationFrame(pollStick);
    };

    if (onLeftStick) {
      pollStick();
    }

    return () => {
      cancelButtonListener();
      cancelDPadListener();
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      clearInterval(pollInterval);
      window.removeEventListener("gamepadconnected", handleGamepadConnected);
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected);
      ResponsiveGamepad.disable();
    };
  }, [onButtonDown, onLeftStick, onDPad]);
}

