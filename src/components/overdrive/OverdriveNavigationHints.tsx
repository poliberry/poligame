import React from "react";
import { useControllerStore } from "@/stores/controllerStore";
import ControllerButton from "@/components/overdrive/ControllerButton";

export interface OverdriveHintItem {
  id: string;
  label: string;
  keyLabel: string;
  controllerButton?: "a" | "b" | "x" | "y" | "lb" | "rb" | "menu" | "start";
  onActivate?: () => void;
  disabled?: boolean;
}

interface OverdriveNavigationHintsProps {
  items: OverdriveHintItem[];
  className?: string;
}

const OverdriveNavigationHints: React.FC<OverdriveNavigationHintsProps> = ({
  items,
  className,
}) => {
  const { controllerType, isConnected } = useControllerStore();

  if (!items.length) {
    return null;
  }

  return (
    <div className={className || "absolute bottom-0 z-[999] w-full"}>
      <div
        className="flex items-center justify-between gap-3 border-t border-white/10 bg-black/60 px-6 py-2 backdrop-blur-md"
        style={{
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        }}
      >
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            tabIndex={-1}
            onMouseDown={(event) => {
              // Keep footer hints clickable but out of keyboard focus flow.
              event.preventDefault();
            }}
            onClick={() => item.onActivate?.()}
            disabled={item.disabled}
            className="flex items-center gap-2 rounded-full px-2 py-1 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isConnected && controllerType && item.controllerButton ? (
              <ControllerButton controllerType={controllerType} button={item.controllerButton} size="sm" />
            ) : (
              <kbd
                className="rounded-full bg-white/90 px-3 py-1.5 text-sm font-bold uppercase text-black shadow-md"
              >
                {item.keyLabel}
              </kbd>
            )}
            <span className="text-sm font-medium text-white/90">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default OverdriveNavigationHints;
