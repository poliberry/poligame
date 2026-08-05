import { useEffect, useState } from "react";

type ResizeDirection =
  | "East"
  | "North"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";

// Thickness of the invisible edge/corner strips used to grab-resize the
// window. Small enough to stay out of the way of normal UI, big enough to
// reliably hit with a mouse.
const EDGE = 6;
const CORNER = 10;

/**
 * `decorations: false` windows have no OS-drawn border for the window
 * manager to offer resize handles on. Windows and macOS still hit-test a
 * few pixels around the webview content and let you resize from there
 * anyway, but on Linux (GTK) there's no such fallback - a borderless
 * window is simply not resizable by dragging its edges, even with
 * `resizable: true` set, since there's nothing left for the WM to grab.
 *
 * These invisible strips reproduce that behaviour in JS by driving the
 * same `startResizeDragging` call the OS would otherwise be making, so
 * borderless windows can be resized consistently on every platform.
 */
export function WindowResizeHandles() {
  const [resizable, setResizable] = useState(false);

  useEffect(() => {
    let disposed = false;

    import("@tauri-apps/api/window")
      .then(async ({ getCurrentWindow }) => {
        try {
          const canResize = await getCurrentWindow().isResizable();
          if (!disposed) {
            setResizable(canResize);
          }
        } catch {
          // Not running in a Tauri context (e.g. plain browser dev preview).
        }
      })
      .catch(() => {});

    return () => {
      disposed = true;
    };
  }, []);

  if (!resizable) {
    return null;
  }

  const startResize = (direction: ResizeDirection) => (event: React.MouseEvent) => {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => {
        void getCurrentWindow()
          .startResizeDragging(direction)
          .catch(() => {
            // Ignore when resize-dragging isn't available (e.g. maximized).
          });
      })
      .catch(() => {});
  };

  const base = "fixed z-[9999]";

  return (
    <>
      {/* Edges. The top edge runs the full width with no corner handles at
          either end - every custom titlebar in this app puts its window
          controls (minimize/maximize/close) right in those top corners, and
          a diagonal-resize hit zone there would just shadow those buttons
          again, the same way the native drag-region attribute used to. */}
      <div
        className={`${base} top-0 left-0 right-0 cursor-ns-resize`}
        style={{ height: EDGE }}
        onMouseDown={startResize("North")}
      />
      <div
        className={`${base} bottom-0 cursor-ns-resize`}
        style={{ left: CORNER, right: CORNER, height: EDGE }}
        onMouseDown={startResize("South")}
      />
      <div
        className={`${base} left-0 cursor-ew-resize`}
        style={{ top: 0, bottom: CORNER, width: EDGE }}
        onMouseDown={startResize("West")}
      />
      <div
        className={`${base} right-0 cursor-ew-resize`}
        style={{ top: 0, bottom: CORNER, width: EDGE }}
        onMouseDown={startResize("East")}
      />

      {/* Bottom corners only - these areas are free of controls in every
          window in this app. */}
      <div
        className={`${base} bottom-0 left-0 cursor-nesw-resize`}
        style={{ width: CORNER, height: CORNER }}
        onMouseDown={startResize("SouthWest")}
      />
      <div
        className={`${base} bottom-0 right-0 cursor-nwse-resize`}
        style={{ width: CORNER, height: CORNER }}
        onMouseDown={startResize("SouthEast")}
      />
    </>
  );
}
