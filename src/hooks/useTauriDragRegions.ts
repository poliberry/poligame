import { useEffect } from "react";

// Deliberately keyed off the `.drag-region`/`.no-drag-region` CSS classes
// only, NOT the `data-tauri-drag-region` HTML attribute. Setting that
// attribute also activates Tauri/WRY's own built-in drag handling, which on
// Linux (WebKitGTK) hit-tests the whole bounding box of the tagged element
// rather than the DOM tree under the pointer - so it doesn't know to skip
// over a nested button, link, or `no-drag-region` child the way this
// listener does below. With both active at once, that native handler wins
// the mousedown on Linux and starts moving the window instead of letting
// the click reach the element underneath, which is what made every button
// inside a titlebar effectively turn the whole window into a drag handle.
// Using only the CSS classes here avoids ever registering that attribute,
// so this listener is the sole thing driving dragging on every platform.
export function useTauriDragRegions(enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    let disposed = false;
    let tauriWindow: { startDragging: () => Promise<void> } | null = null;

    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => {
        if (!disposed) {
          tauriWindow = getCurrentWindow();
        }
      })
      .catch(() => {
        tauriWindow = null;
      });

    const onMouseDown = (event: MouseEvent) => {
      if (!tauriWindow || event.button !== 0) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }

      if (target.closest(".no-drag-region")) {
        return;
      }

      if (
        target.closest("button, a, input, textarea, select, [role='button']")
      ) {
        return;
      }

      if (!target.closest(".drag-region")) {
        return;
      }

      event.preventDefault();
      void tauriWindow.startDragging().catch(() => {
        // Ignore when dragging is not available in a non-Tauri context.
      });
    };

    document.addEventListener("mousedown", onMouseDown);

    return () => {
      disposed = true;
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [enabled]);
}
