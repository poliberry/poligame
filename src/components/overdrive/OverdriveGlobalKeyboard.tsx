import React from "react";
import { cn } from "@/lib/utils";
import { useOverdriveKeyboardStore } from "@/stores/overdriveKeyboardStore";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";

type KeyboardKey = {
  id: string;
  label: string;
  value?: string;
  width?: number;
  action?: "backspace" | "space" | "clear" | "close" | "enter";
};

function makeLettersRows(upper: boolean): KeyboardKey[][] {
  const toChar = (char: string) => upper ? char.toUpperCase() : char.toLowerCase();
  return [
    "q w e r t y u i o p".split(" ").map((char) => ({ id: `char-${char}`, label: toChar(char), value: toChar(char) })),
    "a s d f g h j k l".split(" ").map((char) => ({ id: `char-${char}`, label: toChar(char), value: toChar(char) })),
    [
      ..."z x c v b n m".split(" ").map((char) => ({ id: `char-${char}`, label: toChar(char), value: toChar(char) })),
      { id: "backspace", label: "Bksp", action: "backspace", width: 1.5 },
    ],
    [
      { id: "clear", label: "Clear", action: "clear", width: 1.4 },
      { id: "space", label: "Space", action: "space", width: 4.2 },
      { id: "close", label: "Close", action: "close", width: 1.5 },
      { id: "enter", label: "Done", action: "enter", width: 1.5 },
    ],
  ];
}

const NUMBER_ROWS: KeyboardKey[][] = [
  "1 2 3 4 5 6 7 8 9 0".split(" ").map((char) => ({ id: `num-${char}`, label: char, value: char })),
  "- / : ; ( ) $ & @ \"".split(" ").map((char) => ({ id: `num-${char}`, label: char, value: char })),
  [
    ...". , ? ! ' + =".split(" ").map((char) => ({ id: `num-${char}`, label: char, value: char })),
    { id: "backspace", label: "Bksp", action: "backspace", width: 1.8 },
  ],
  [
    { id: "clear", label: "Clear", action: "clear", width: 1.4 },
    { id: "space", label: "Space", action: "space", width: 4.2 },
    { id: "close", label: "Close", action: "close", width: 1.5 },
    { id: "enter", label: "Done", action: "enter", width: 1.5 },
  ],
];

const SYMBOL_ROWS: KeyboardKey[][] = [
  "[ ] { } # % ^ * + =".split(" ").map((char) => ({ id: `sym-${char}`, label: char, value: char })),
  "_ \\ | ~ < > € £ ¥ •".split(" ").map((char) => ({ id: `sym-${char}`, label: char, value: char })),
  [
    ...". , ? ! ' `".split(" ").map((char) => ({ id: `sym-${char}`, label: char, value: char })),
    { id: "backspace", label: "Bksp", action: "backspace", width: 2.2 },
  ],
  [
    { id: "clear", label: "Clear", action: "clear", width: 1.4 },
    { id: "space", label: "Space", action: "space", width: 4.2 },
    { id: "close", label: "Close", action: "close", width: 1.5 },
    { id: "enter", label: "Done", action: "enter", width: 1.5 },
  ],
];

function clamp(index: number, min: number, max: number): number {
  return Math.max(min, Math.min(index, max));
}

const OverdriveGlobalKeyboard: React.FC = () => {
  const {
    isOpen,
    title,
    value,
    maxLength,
    mode,
    shiftOneShot,
    capsLock,
    setValue,
    clear,
    closeKeyboard,
    cycleMode,
    toggleShift,
    commit,
  } = useOverdriveKeyboardStore();

  const [rowIndex, setRowIndex] = React.useState(0);
  const [colIndex, setColIndex] = React.useState(0);
  const lastLtAtRef = React.useRef(0);

  const isUpper = shiftOneShot || capsLock;

  const rows = React.useMemo<KeyboardKey[][]>(() => {
    if (mode === "numbers") {
      return NUMBER_ROWS;
    }
    if (mode === "symbols") {
      return SYMBOL_ROWS;
    }
    return makeLettersRows(isUpper);
  }, [isUpper, mode]);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }
    setRowIndex(0);
    setColIndex(0);
  }, [isOpen, mode]);

  const pressKey = React.useCallback((key: KeyboardKey) => {
    if (key.action === "backspace") {
      setValue(value.slice(0, -1));
      return;
    }

    if (key.action === "space") {
      if (value.length < maxLength) {
        setValue(`${value} `);
      }
      return;
    }

    if (key.action === "clear") {
      clear();
      return;
    }

    if (key.action === "close") {
      closeKeyboard(true);
      return;
    }

    if (key.action === "enter") {
      commit();
      return;
    }

    if (key.value && value.length < maxLength) {
      setValue(`${value}${key.value}`);
      if (shiftOneShot && !capsLock) {
        toggleShift();
      }
    }
  }, [capsLock, clear, closeKeyboard, commit, maxLength, setValue, shiftOneShot, toggleShift, value]);

  const handleShiftFromLt = React.useCallback(() => {
    const now = Date.now();
    if (now - lastLtAtRef.current <= 420) {
      useOverdriveKeyboardStore.setState((state) => ({
        capsLock: !state.capsLock,
        shiftOneShot: false,
      }));
    } else {
      toggleShift();
    }
    lastLtAtRef.current = now;
  }, [toggleShift]);

  useResponsiveGamepad({
    onButtonDown: (button) => {
      if (!isOpen) {
        return;
      }

      if (button === "A") {
        const row = rows[rowIndex] || [];
        const key = row[colIndex];
        if (key) {
          pressKey(key);
        }
        return;
      }

      if (button === "X") {
        commit();
        return;
      }

      if (button === "B") {
        closeKeyboard(true);
        return;
      }

      if (button === "LT") {
        handleShiftFromLt();
        return;
      }

      if (button === "LB") {
        cycleMode("prev");
        return;
      }

      if (button === "RB") {
        cycleMode("next");
      }
    },
    onDPad: (direction) => {
      if (!isOpen) {
        return;
      }

      if (direction === "UP") {
        const nextRow = clamp(rowIndex - 1, 0, rows.length - 1);
        setRowIndex(nextRow);
        setColIndex((current) => clamp(current, 0, (rows[nextRow] || []).length - 1));
        return;
      }

      if (direction === "DOWN") {
        const nextRow = clamp(rowIndex + 1, 0, rows.length - 1);
        setRowIndex(nextRow);
        setColIndex((current) => clamp(current, 0, (rows[nextRow] || []).length - 1));
        return;
      }

      if (direction === "LEFT") {
        setColIndex((current) => clamp(current - 1, 0, (rows[rowIndex] || []).length - 1));
        return;
      }

      if (direction === "RIGHT") {
        setColIndex((current) => clamp(current + 1, 0, (rows[rowIndex] || []).length - 1));
      }
    },
  });

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeKeyboard(true);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const key = rows[rowIndex]?.[colIndex];
        if (key) {
          pressKey(key);
        }
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        const nextRow = clamp(rowIndex - 1, 0, rows.length - 1);
        setRowIndex(nextRow);
        setColIndex((current) => clamp(current, 0, (rows[nextRow] || []).length - 1));
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const nextRow = clamp(rowIndex + 1, 0, rows.length - 1);
        setRowIndex(nextRow);
        setColIndex((current) => clamp(current, 0, (rows[nextRow] || []).length - 1));
        return;
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setColIndex((current) => clamp(current - 1, 0, (rows[rowIndex] || []).length - 1));
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setColIndex((current) => clamp(current + 1, 0, (rows[rowIndex] || []).length - 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeKeyboard, colIndex, isOpen, pressKey, rowIndex, rows]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1200] flex flex-col bg-transparent">
      <div className="pointer-events-auto mx-4 mb-2 rounded-xl border border-white/20 bg-black/80 px-4 py-3 backdrop-blur-xl">
        <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.15rem] text-white/60">
          <span>{title}</span>
          <span>{value.length}/{maxLength}</span>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-base text-white">
          {value || <span className="text-white/35">Type here...</span>}
        </div>
      </div>

      <div className="pointer-events-auto border-t border-white/20 bg-black/90 px-3 pb-4 pt-3 backdrop-blur-2xl">
        <div className="mb-2 flex items-center justify-between text-xs text-white/60">
          <span>LT Shift / Double LT Caps</span>
          <span>LB/RB {mode === "letters" ? "ABC" : mode === "numbers" ? "123" : "#+="}</span>
          <span>X Done</span>
        </div>
        <div className="flex flex-col gap-2">
          {rows.map((row, rIdx) => (
            <div key={`row-${rIdx}`} className="flex justify-center gap-2">
              {row.map((key, cIdx) => {
                const focused = rIdx === rowIndex && cIdx === colIndex;
                const width = key.width || 1;
                return (
                  <button
                    key={key.id}
                    type="button"
                    onClick={() => {
                      setRowIndex(rIdx);
                      setColIndex(cIdx);
                      pressKey(key);
                    }}
                    className={cn(
                      "h-11 rounded-lg border px-2 text-sm text-white transition-all",
                      focused
                        ? "border-[#107c10] bg-[#107c10]/30"
                        : "border-white/15 bg-white/10 hover:bg-white/20",
                    )}
                    style={{
                      minWidth: `${Math.max(48, width * 46)}px`,
                      flex: width >= 4 ? 1 : undefined,
                    }}
                  >
                    {key.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default OverdriveGlobalKeyboard;
