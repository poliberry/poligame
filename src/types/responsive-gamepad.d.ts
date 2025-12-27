declare module "responsive-gamepad" {
  interface ResponsiveGamepadState {
    [key: string]: boolean | number | undefined;
  }

  interface ResponsiveGamepadInputs {
    DPAD_UP: string;
    DPAD_RIGHT: string;
    DPAD_DOWN: string;
    DPAD_LEFT: string;
    LEFT_ANALOG_HORIZONTAL_AXIS: string;
    LEFT_ANALOG_VERTICAL_AXIS: string;
    LEFT_ANALOG_UP: string;
    LEFT_ANALOG_RIGHT: string;
    LEFT_ANALOG_DOWN: string;
    LEFT_ANALOG_LEFT: string;
    LEFT_ANALOG_PRESS: string;
    RIGHT_ANALOG_HORIZONTAL_AXIS: string;
    RIGHT_ANALOG_VERTICAL_AXIS: string;
    RIGHT_ANALOG_UP: string;
    RIGHT_ANALOG_RIGHT: string;
    RIGHT_ANALOG_DOWN: string;
    RIGHT_ANALOG_LEFT: string;
    RIGHT_ANALOG_PRESS: string;
    A: string;
    B: string;
    X: string;
    Y: string;
    LEFT_TRIGGER: string;
    LEFT_BUMPER: string;
    RIGHT_TRIGGER: string;
    RIGHT_BUMPER: string;
    SELECT: string;
    START: string;
    SPECIAL: string;
  }

  interface ResponsiveGamepad {
    RESPONSIVE_GAMEPAD_INPUTS: ResponsiveGamepadInputs;
    enable(): void;
    disable(): void;
    isEnabled(): boolean;
    getState(): ResponsiveGamepadState;
    onInputsChange(
      inputs: string[],
      callback: (state: ResponsiveGamepadState) => void
    ): () => void;
  }

  const ResponsiveGamepad: ResponsiveGamepad;
  export { ResponsiveGamepad };
}

