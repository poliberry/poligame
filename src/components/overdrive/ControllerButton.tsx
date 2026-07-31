import React from "react";
import { ControllerType } from "@/stores/controllerStore";

//@ts-ignore
import psCircleButton from "@/public/icons/playstation/plain-circle.svg";
//@ts-ignore
import psCrossButton from "@/public/icons/playstation/plain-cross.svg";
//@ts-ignore
import psSquareButton from "@/public/icons/playstation/plain-square.svg";
//@ts-ignore
import psTriangleButton from "@/public/icons/playstation/plain-triangle.svg";
//@ts-ignore
import psUpButton from "@/public/icons/playstation/touch-top.svg";
//@ts-ignore
import psDownButton from "@/public/icons/playstation/touch-bottom.svg";
//@ts-ignore
import psLeftButton from "@/public/icons/playstation/touch-left.svg";
//@ts-ignore
import psRightButton from "@/public/icons/playstation/touch-right.svg";
//@ts-ignore
import psMenuButton from "@/public/icons/playstation/plain-small-option.svg";
//@ts-ignore
import psL1Button from "@/public/icons/playstation/plain-L1.svg";
//@ts-ignore
import psR1Button from "@/public/icons/playstation/plain-R1.svg";

interface ControllerButtonProps {
  controllerType: ControllerType;
  button: "a" | "b" | "x" | "y" | "dpad-left" | "dpad-right" | "dpad-up" | "dpad-down" | "lb" | "rb" | "menu" | "start";
  size?: "sm" | "md" | "lg";
}

const ControllerButton: React.FC<ControllerButtonProps> = ({
  controllerType,
  button,
  size = "md",
}) => {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };

  const getButtonContent = () => {
    switch (controllerType) {
      case "xbox":
        switch (button) {
          case "a":
            return (
              <div className={`${sizeClasses[size]} rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center font-bold shadow-lg`}>
                A
              </div>
            );
          case "b":
            return (
              <div className={`${sizeClasses[size]} rounded-full bg-[#e7131f] text-white flex items-center justify-center font-bold shadow-lg`}>
                B
              </div>
            );
          case "x":
            return (
              <div className={`${sizeClasses[size]} rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center font-bold shadow-lg`}>
                X
              </div>
            );
          case "y":
            return (
              <div className={`${sizeClasses[size]} rounded-full bg-[#ffb900] text-white flex items-center justify-center font-bold shadow-lg`}>
                Y
              </div>
            );
            case "dpad-left":
          case "dpad-right":
          case "dpad-up":
          case "dpad-down":
            return (
              <div className={`${sizeClasses[size]} bg-white/20 rounded flex items-center justify-center text-white font-bold shadow-lg`}>
                {button === "dpad-left" && "←"}
                {button === "dpad-right" && "→"}
                {button === "dpad-up" && "↑"}
                {button === "dpad-down" && "↓"}
              </div>
            );
          case "lb":
            return (
              <div className={`${sizeClasses[size]} bg-white/20 rounded px-2 flex items-center justify-center text-white font-bold shadow-lg`}>
                LB
              </div>
            );
          case "rb":
            return (
              <div className={`${sizeClasses[size]} bg-white/20 rounded px-2 flex items-center justify-center text-white font-bold shadow-lg`}>
                RB
              </div>
            );
          case "menu":
          case "start":
            return (
              <div className={`${sizeClasses[size]} bg-white/20 rounded px-2 flex items-center justify-center text-white font-bold shadow-lg`}>
                Menu
              </div>
            );
        }
        break;

      case "playstation":
        switch (button) {
          case "a":
            return (
              <img src={psCrossButton} alt="A" width={sizeClasses[size]} height={sizeClasses[size]} />
            );
          case "b":
            return (
              <img src={psCircleButton} alt="B" width={sizeClasses[size]} height={sizeClasses[size]} />
            );
          case "x":
            return (
              <img src={psSquareButton} alt="X" width={sizeClasses[size]} height={sizeClasses[size]} />
            );
          case "y":
            return (
              <img src={psTriangleButton} alt="Y" width={sizeClasses[size]} height={sizeClasses[size]} />
            );
          case "dpad-left":
            return (
              <img src={psLeftButton} alt="Left" width={sizeClasses[size]} height={sizeClasses[size]} />
            );
          case "dpad-right":
            return (
              <img src={psRightButton} alt="Right" width={sizeClasses[size]} height={sizeClasses[size]} />
            );
          case "dpad-up":
            return (
              <img src={psUpButton} alt="Up" width={sizeClasses[size]} height={sizeClasses[size]} />
            );
          case "dpad-down":
            return (
              <img src={psDownButton} alt="Down" width={sizeClasses[size]} height={sizeClasses[size]} />
            );
          case "lb":
            return (
              <img src={psL1Button} alt="L1" width={sizeClasses[size]} height={sizeClasses[size]} />
            );
          case "rb":
            return (
              <img src={psR1Button} alt="R1" width={sizeClasses[size]} height={sizeClasses[size]} />
            );
          case "menu":
          case "start":
            return (
              <img src={psMenuButton} alt="Menu" width={sizeClasses[size]} height={sizeClasses[size]} />
            );
        }
        break;

      case "nintendo":
        switch (button) {
          case "a":
            return (
              <div className={`${sizeClasses[size]} rounded-full bg-[#e7131f] text-white flex items-center justify-center font-bold shadow-lg`}>
                A
              </div>
            );
          case "b":
            return (
              <div className={`${sizeClasses[size]} rounded-full bg-[#0e7fe8] text-white flex items-center justify-center font-bold shadow-lg`}>
                B
              </div>
            );
          case "x":
            return (
              <div className={`${sizeClasses[size]} rounded-full bg-[#ffb900] text-white flex items-center justify-center font-bold shadow-lg`}>
                X
              </div>
            );
          case "y":
            return (
              <div className={`${sizeClasses[size]} rounded-full bg-[var(--theme-accent)] text-white flex items-center justify-center font-bold shadow-lg`}>
                Y
              </div>
            );
          case "dpad-left":
          case "dpad-right":
          case "dpad-up":
          case "dpad-down":
            return (
              <div className={`${sizeClasses[size]} bg-white/20 rounded flex items-center justify-center text-white font-bold shadow-lg`}>
                {button === "dpad-left" && "←"}
                {button === "dpad-right" && "→"}
                {button === "dpad-up" && "↑"}
                {button === "dpad-down" && "↓"}
              </div>
            );
          case "lb":
            return (
              <div className={`${sizeClasses[size]} bg-white/20 rounded px-2 flex items-center justify-center text-white font-bold shadow-lg`}>
                L
              </div>
            );
          case "rb":
            return (
              <div className={`${sizeClasses[size]} bg-white/20 rounded px-2 flex items-center justify-center text-white font-bold shadow-lg`}>
                R
              </div>
            );
          case "menu":
          case "start":
            return (
              <div className={`${sizeClasses[size]} bg-white/20 rounded px-2 flex items-center justify-center text-white font-bold shadow-lg`}>
                +
              </div>
            );
        }
        break;

      default:
        // Generic/fallback
        switch (button) {
          case "a":
            return (
              <kbd className={`${sizeClasses[size]} px-2 py-1 rounded bg-white/90 text-black font-mono font-bold shadow-md flex items-center justify-center`}>
                A
              </kbd>
            );
          case "dpad-left":
          case "dpad-right":
            return (
              <kbd className={`${sizeClasses[size]} px-2 py-1 rounded bg-white/80 text-black font-mono font-bold shadow-md flex items-center justify-center`}>
                {button === "dpad-left" ? "←" : "→"}
              </kbd>
            );
          case "lb":
            return (
              <kbd className={`${sizeClasses[size]} px-2 py-1 rounded bg-white/80 text-black font-mono font-bold shadow-md flex items-center justify-center`}>
                LB
              </kbd>
            );
          case "rb":
            return (
              <kbd className={`${sizeClasses[size]} px-2 py-1 rounded bg-white/80 text-black font-mono font-bold shadow-md flex items-center justify-center`}>
                RB
              </kbd>
            );
          case "menu":
          case "start":
            return (
              <kbd className={`${sizeClasses[size]} px-2 py-1 rounded bg-white/80 text-black font-mono font-bold shadow-md flex items-center justify-center`}>
                Menu
              </kbd>
            );
          default:
            return null;
        }
    }
  };

  return <>{getButtonContent()}</>;
};

export default ControllerButton;

