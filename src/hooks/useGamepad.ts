import { useEffect, useRef } from "react";
import { useControllerStore, detectControllerType } from "@/stores/controllerStore";

interface UseGamepadOptions {
  onButtonPress?: (button: number) => void;
  onDPadChange?: (direction: "left" | "right" | "up" | "down" | null) => void;
  onLeftStickChange?: (x: number, y: number) => void;
}

export const useGamepad = (options: UseGamepadOptions = {}) => {
  const { setControllerType, setIsConnected } = useControllerStore();
  const lastDPadState = useRef<{ left: boolean; right: boolean; up: boolean; down: boolean } | null>(null);
  const lastStickState = useRef<{ x: number; y: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const checkGamepads = () => {
      const gamepads = navigator.getGamepads();
      const connectedGamepad = Array.from(gamepads).find((gp) => gp !== null);

      if (connectedGamepad) {
        setIsConnected(true);
        const detectedType = detectControllerType(connectedGamepad);
        setControllerType(detectedType);

        // Handle button presses
        if (options.onButtonPress) {
          connectedGamepad.buttons.forEach((button, index) => {
            if (button.pressed && button.value > 0.5) {
              // Only trigger once per press
              if (!(window as any)[`_button_${index}_pressed`]) {
                (window as any)[`_button_${index}_pressed`] = true;
                options.onButtonPress?.(index);
              }
            } else {
              (window as any)[`_button_${index}_pressed`] = false;
            }
          });
        }

        // Handle D-Pad (buttons 12-15: up, down, left, right)
        const dpadLeft = connectedGamepad.buttons[14]?.pressed || false;
        const dpadRight = connectedGamepad.buttons[15]?.pressed || false;
        const dpadUp = connectedGamepad.buttons[12]?.pressed || false;
        const dpadDown = connectedGamepad.buttons[13]?.pressed || false;

        if (options.onDPadChange) {
          const lastState = lastDPadState.current;
          if (
            !lastState ||
            lastState.left !== dpadLeft ||
            lastState.right !== dpadRight ||
            lastState.up !== dpadUp ||
            lastState.down !== dpadDown
          ) {
            let direction: "left" | "right" | "up" | "down" | null = null;
            if (dpadLeft) direction = "left";
            else if (dpadRight) direction = "right";
            else if (dpadUp) direction = "up";
            else if (dpadDown) direction = "down";

            if (direction || (lastState && (lastState.left || lastState.right || lastState.up || lastState.down))) {
              options.onDPadChange(direction);
            }
            lastDPadState.current = { left: dpadLeft, right: dpadRight, up: dpadUp, down: dpadDown };
          }
        }

        // Handle left stick (axes 0 and 1)
        const stickX = connectedGamepad.axes[0] || 0;
        const stickY = connectedGamepad.axes[1] || 0;
        const deadZone = 0.3;

        if (options.onLeftStickChange) {
          const lastStick = lastStickState.current;
          if (!lastStick || Math.abs(lastStick.x - stickX) > 0.1 || Math.abs(lastStick.y - stickY) > 0.1) {
            if (Math.abs(stickX) > deadZone || Math.abs(stickY) > deadZone) {
              options.onLeftStickChange(stickX, stickY);
            }
            lastStickState.current = { x: stickX, y: stickY };
          }
        }
      } else {
        setIsConnected(false);
        setControllerType(null);
      }

      animationFrameRef.current = requestAnimationFrame(checkGamepads);
    };

    const handleGamepadConnected = (e: GamepadEvent) => {
      console.log("Gamepad connected:", e.gamepad.id);
      checkGamepads();
    };

    const handleGamepadDisconnected = (e: GamepadEvent) => {
      console.log("Gamepad disconnected:", e.gamepad.id);
      setIsConnected(false);
      setControllerType(null);
    };

    window.addEventListener("gamepadconnected", handleGamepadConnected);
    window.addEventListener("gamepaddisconnected", handleGamepadDisconnected);

    // Start polling
    animationFrameRef.current = requestAnimationFrame(checkGamepads);

    return () => {
      window.removeEventListener("gamepadconnected", handleGamepadConnected);
      window.removeEventListener("gamepaddisconnected", handleGamepadDisconnected);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [setControllerType, setIsConnected, options]);
};

