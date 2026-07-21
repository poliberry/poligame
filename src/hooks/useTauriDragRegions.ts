import { useEffect } from "react";

export function useTauriDragRegions() {
  useEffect(() => {
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

      if (
        target.closest("[data-tauri-drag-region='false']") ||
        target.closest(".no-drag-region")
      ) {
        return;
      }

      if (
        target.closest("button, a, input, textarea, select, [role='button']")
      ) {
        return;
      }

      const dragRegion =
        target.closest("[data-tauri-drag-region]") || target.closest(".drag-region");

      if (!dragRegion) {
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
  }, []);
}
