import React from "react";
import { cn } from "@/lib/utils";

type KeyboardKey =
  | { type: "char"; label: string; value: string }
  | { type: "space"; label: string }
  | { type: "backspace"; label: string }
  | { type: "clear"; label: string }
  | { type: "submit"; label: string }
  | { type: "close"; label: string };

interface OverdriveOnScreenKeyboardProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  maxLength?: number;
}

const ROWS: KeyboardKey[][] = [
  [
    { type: "char", label: "Q", value: "q" },
    { type: "char", label: "W", value: "w" },
    { type: "char", label: "E", value: "e" },
    { type: "char", label: "R", value: "r" },
    { type: "char", label: "T", value: "t" },
    { type: "char", label: "Y", value: "y" },
    { type: "char", label: "U", value: "u" },
    { type: "char", label: "I", value: "i" },
    { type: "char", label: "O", value: "o" },
    { type: "char", label: "P", value: "p" },
  ],
  [
    { type: "char", label: "A", value: "a" },
    { type: "char", label: "S", value: "s" },
    { type: "char", label: "D", value: "d" },
    { type: "char", label: "F", value: "f" },
    { type: "char", label: "G", value: "g" },
    { type: "char", label: "H", value: "h" },
    { type: "char", label: "J", value: "j" },
    { type: "char", label: "K", value: "k" },
    { type: "char", label: "L", value: "l" },
  ],
  [
    { type: "char", label: "Z", value: "z" },
    { type: "char", label: "X", value: "x" },
    { type: "char", label: "C", value: "c" },
    { type: "char", label: "V", value: "v" },
    { type: "char", label: "B", value: "b" },
    { type: "char", label: "N", value: "n" },
    { type: "char", label: "M", value: "m" },
    { type: "char", label: ",", value: "," },
    { type: "char", label: ".", value: "." },
  ],
  [
    { type: "space", label: "Space" },
    { type: "backspace", label: "Backspace" },
    { type: "clear", label: "Clear" },
    { type: "close", label: "Close" },
    { type: "submit", label: "Done" },
  ],
];

function clamp(index: number, min: number, max: number): number {
  return Math.max(min, Math.min(index, max));
}

export default function OverdriveOnScreenKeyboard({
  value,
  onChange,
  onSubmit,
  onClose,
  maxLength = 1200,
}: OverdriveOnScreenKeyboardProps) {
  const [rowIndex, setRowIndex] = React.useState(0);
  const [colIndex, setColIndex] = React.useState(0);

  const handlePress = React.useCallback(
    (key: KeyboardKey) => {
      if (key.type === "char") {
        if (value.length >= maxLength) {
          return;
        }
        onChange(`${value}${key.value}`);
        return;
      }

      if (key.type === "space") {
        if (value.length >= maxLength) {
          return;
        }
        onChange(`${value} `);
        return;
      }

      if (key.type === "backspace") {
        onChange(value.slice(0, -1));
        return;
      }

      if (key.type === "clear") {
        onChange("");
        return;
      }

      if (key.type === "close") {
        onClose();
        return;
      }

      onSubmit();
    },
    [maxLength, onChange, onClose, onSubmit, value],
  );

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        const nextRow = clamp(rowIndex - 1, 0, ROWS.length - 1);
        setRowIndex(nextRow);
        setColIndex((current) => clamp(current, 0, ROWS[nextRow].length - 1));
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const nextRow = clamp(rowIndex + 1, 0, ROWS.length - 1);
        setRowIndex(nextRow);
        setColIndex((current) => clamp(current, 0, ROWS[nextRow].length - 1));
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setColIndex((current) => clamp(current - 1, 0, ROWS[rowIndex].length - 1));
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setColIndex((current) => clamp(current + 1, 0, ROWS[rowIndex].length - 1));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const current = ROWS[rowIndex][colIndex];
        if (current) {
          handlePress(current);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [colIndex, handlePress, onClose, rowIndex]);

  return (
    <div className="mt-4 rounded-xl border border-white/20 bg-black/50 p-3 backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18rem] text-white/60">
        <span>On-Screen Keyboard</span>
        <span>{value.length}/{maxLength}</span>
      </div>
      <div className="flex flex-col gap-2">
        {ROWS.map((row, rIdx) => (
          <div key={rIdx} className="flex gap-2">
            {row.map((key, cIdx) => {
              const focused = rowIndex === rIdx && colIndex === cIdx;
              const isWide = key.type === "space";
              const isAction = key.type !== "char" && key.type !== "space";

              return (
                <button
                  key={`${rIdx}-${cIdx}-${key.label}`}
                  type="button"
                  onClick={() => {
                    setRowIndex(rIdx);
                    setColIndex(cIdx);
                    handlePress(key);
                  }}
                  className={cn(
                    "h-11 rounded-lg border px-3 text-sm transition-all",
                    isWide ? "flex-1" : "min-w-11",
                    focused
                      ? "border-[var(--theme-accent)] bg-[var(--theme-accent)]/30 text-white"
                      : "border-white/15 bg-white/5 text-white/90 hover:bg-white/15",
                    isAction && "font-medium",
                  )}
                >
                  {key.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
