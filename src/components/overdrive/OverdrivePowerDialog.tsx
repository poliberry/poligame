import React from "react";
import { LogOut, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import ControllerButton from "@/components/overdrive/ControllerButton";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";
import { ControllerType } from "@/stores/controllerStore";

interface OverdrivePowerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExitOverdrive: () => void | Promise<void>;
  onExitPoliGame: () => void | Promise<void>;
  onSignOut?: () => void | Promise<void>;
  controllerType: ControllerType;
  isControllerConnected: boolean;
}

const OverdrivePowerDialog: React.FC<OverdrivePowerDialogProps> = ({
  open,
  onOpenChange,
  onExitOverdrive,
  onExitPoliGame,
  onSignOut,
  controllerType,
  isControllerConnected,
}) => {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const itemCount = onSignOut ? 3 : 2;
  const [focusedIndex, setFocusedIndex] = React.useState(0);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    setFocusedIndex(0);
  }, [open, itemCount]);

  React.useEffect(() => {
    if (!open) {
      return;
    }

    const focusedButton = panelRef.current?.querySelector<HTMLButtonElement>(
      `[data-power-index="${focusedIndex}"]`,
    );

    focusedButton?.focus();
  }, [focusedIndex, open]);

  const actions = React.useMemo(
    () => [
      {
        id: "exit-overdrive",
        label: "Exit Overdrive Mode",
        icon: Power,
        onSelect: onExitOverdrive,
      },
      {
        id: "exit-poligame",
        label: "Exit PoliGame",
        icon: LogOut,
        onSelect: onExitPoliGame,
        danger: true,
      },
      ...(onSignOut
        ? [
            {
              id: "sign-out",
              label: "Sign Out",
              icon: LogOut,
              onSelect: onSignOut,
              danger: true,
            },
          ]
        : []),
    ],
    [onExitOverdrive, onExitPoliGame, onSignOut],
  );

  const moveFocus = React.useCallback(
    (direction: 1 | -1) => {
      if (!open || actions.length === 0) {
        return;
      }

      setFocusedIndex((previous) => {
        const nextIndex = previous + direction;

        if (nextIndex < 0) {
          return actions.length - 1;
        }

        if (nextIndex >= actions.length) {
          return 0;
        }

        return nextIndex;
      });
    },
    [actions.length, open],
  );

  const activateFocusedItem = React.useCallback(() => {
    if (!open) {
      return;
    }

    const action = actions[focusedIndex];
    if (!action) {
      return;
    }

    void action.onSelect();
  }, [actions, focusedIndex, open]);

  const handleDialogKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    if (event.key === "Escape" || event.key === "Backspace" || event.key === "m" || event.key === "M") {
      event.preventDefault();
      onOpenChange(false);
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
  }, [activateFocusedItem, moveFocus, onOpenChange]);

  useResponsiveGamepad({
    onButtonDown: (button) => {
      if (!open) {
        return;
      }

      if (button === "A") {
        activateFocusedItem();
        return;
      }

      if (button === "B" || button === "START") {
        onOpenChange(false);
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
      if (!open) {
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
      if (!open) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-xl border-white/10 bg-black/90 px-0 py-0 text-white backdrop-blur-xl"
      >
        <div ref={panelRef} onKeyDownCapture={handleDialogKeyDown}>
        <div className="border-b border-white/10 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="text-2xl font-light text-white">Power Options</DialogTitle>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-6 py-6">
          {actions.map((action, index) => {
            const Icon = action.icon;
            const isFocused = index === focusedIndex;

            return (
              <Button
                key={action.id}
                data-power-index={index}
                onMouseEnter={() => setFocusedIndex(index)}
                onClick={() => void action.onSelect()}
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 p-8 border text-left transition-all duration-200",
                  action.danger
                    ? "border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/40"
                    : "border-white/10 bg-white/5 hover:bg-white/10 hover:border-[var(--theme-accent)]",
                  isFocused && "ring-2 ring-[var(--theme-accent)] border-[var(--theme-accent)] bg-white/10",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="text-base font-medium">{action.label}</span>
              </Button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/10 bg-black/30 px-6 py-4 text-sm text-white/70">
          <div className="flex items-center gap-2">
            {isControllerConnected && controllerType ? (
              <ControllerButton controllerType={controllerType} button="a" size="sm" />
            ) : (
              <kbd className="px-3 py-1.5 rounded bg-white/90 text-black font-bold text-sm shadow-md">
                Enter
              </kbd>
            )}
            <span>Select</span>
          </div>

          <div className="flex items-center gap-2">
            {isControllerConnected && controllerType ? (
              <ControllerButton controllerType={controllerType} button="b" size="sm" />
            ) : (
              <kbd className="px-3 py-1.5 rounded bg-white/90 text-black font-bold text-sm shadow-md">
                Esc
              </kbd>
            )}
            <span>Back</span>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OverdrivePowerDialog;