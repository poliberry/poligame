import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LucideIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import ControllerButton from "@/components/overdrive/ControllerButton";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";
import { ControllerType } from "@/stores/controllerStore";

export interface OverdriveMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void | Promise<void>;
  danger?: boolean;
}

interface OverdriveMenuProps {
  isOpen: boolean;
  onClose: () => void;
  items: OverdriveMenuItem[];
  controllerType: ControllerType;
  isControllerConnected: boolean;
  title?: string;
}

const OverdriveMenu: React.FC<OverdriveMenuProps> = ({
  isOpen,
  onClose,
  items,
  controllerType,
  isControllerConnected,
  title = "Menu",
}) => {
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isOpen || items.length === 0) {
      return;
    }

    setFocusedIndex(0);
  }, [isOpen, items]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusedButton = panelRef.current?.querySelector<HTMLButtonElement>(
      `[data-menu-index="${focusedIndex}"]`,
    );

    focusedButton?.focus();
  }, [focusedIndex, isOpen]);

  const moveFocus = React.useCallback(
    (direction: 1 | -1) => {
      if (!isOpen || items.length === 0) {
        return;
      }

      setFocusedIndex((previous) => {
        const nextIndex = previous + direction;

        if (nextIndex < 0) {
          return items.length - 1;
        }

        if (nextIndex >= items.length) {
          return 0;
        }

        return nextIndex;
      });
    },
    [isOpen, items.length],
  );

  const activateFocusedItem = React.useCallback(() => {
    if (!isOpen) {
      return;
    }

    const item = items[focusedIndex];
    if (!item) {
      return;
    }

    void item.onSelect();
  }, [focusedIndex, isOpen, items]);

  useResponsiveGamepad({
    onButtonDown: (button) => {
      if (!isOpen) {
        return;
      }

      if (button === "A") {
        activateFocusedItem();
        return;
      }

      if (button === "B" || button === "START") {
        onClose();
        return;
      }

      if (button === "LB") {
        moveFocus(-1);
        return;
      }

      if (button === "RB") {
        moveFocus(1);
      }
    },
    onDPad: (direction) => {
      if (!isOpen) {
        return;
      }

      if (direction === "UP" || direction === "LEFT") {
        moveFocus(-1);
        return;
      }

      if (direction === "DOWN" || direction === "RIGHT") {
        moveFocus(1);
      }
    },
    onLeftStick: (x, y) => {
      if (!isOpen) {
        return;
      }

      const deadzone = 0.6;

      if (Math.abs(y) >= Math.abs(x) && y <= -deadzone) {
        moveFocus(-1);
        return;
      }

      if (Math.abs(y) >= Math.abs(x) && y >= deadzone) {
        moveFocus(1);
      }
    },
  });

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.key === "Escape" || event.key === "Backspace" || event.key === "m" || event.key === "M") {
        event.preventDefault();
        onClose();
        return;
      }

      if (
        event.key === "ArrowUp" ||
        event.key === "ArrowLeft" ||
        event.key === "w" ||
        event.key === "W" ||
        (event.key === "Tab" && event.shiftKey)
      ) {
        event.preventDefault();
        moveFocus(-1);
        return;
      }

      if (
        event.key === "ArrowDown" ||
        event.key === "ArrowRight" ||
        event.key === "s" ||
        event.key === "S" ||
        event.key === "Tab"
      ) {
        event.preventDefault();
        moveFocus(1);
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activateFocusedItem();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activateFocusedItem, isOpen, moveFocus, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 bg-black/50 z-[100] backdrop-blur-md"
            onClick={onClose}
          />

          <motion.div
            ref={panelRef}
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
            className="fixed top-16 left-0 h-[calc(100%-4rem)] w-96 bg-black/80 shadow-md backdrop-blur-xl border-r border-white/10 z-[101]"
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between pt-6 px-6">
                <h2 className="text-2xl font-light">{title}</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-white/70 hover:text-white hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-3">
                {items.map((item, index) => {
                  const Icon = item.icon;
                  const isFocused = index === focusedIndex;

                  return (
                    <Button
                      key={item.id}
                      data-menu-index={index}
                      onMouseEnter={() => setFocusedIndex(index)}
                      onClick={() => void item.onSelect()}
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-3 p-8 border text-left transition-all duration-200",
                        item.danger
                          ? "border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/40"
                          : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-[var(--theme-accent)]",
                        isFocused && "ring-2 ring-[var(--theme-accent)] border-[var(--theme-accent)] bg-white/10",
                      )}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="text-base font-medium">{item.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default OverdriveMenu;