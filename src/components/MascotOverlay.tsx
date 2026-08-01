import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useThemeStore } from "@/stores/themeStore";
import { OFFICIAL_PUBLISHER } from "@/types/theme";

interface MascotOverlayProps {
  size?: number;
}

export const MascotOverlay: React.FC<MascotOverlayProps> = ({ size = 80 }) => {
  const activeTheme = useThemeStore((s) => s.activeTheme);
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTheme?.mascot_file) {
      setResolvedSrc(null);
      return;
    }

    if (activeTheme.publisher === OFFICIAL_PUBLISHER) {
      setResolvedSrc(`/themes/mascots/${activeTheme.mascot_file}`);
      return;
    }

    // User theme: load from the assets folder
    invoke<string>("get_theme_asset_base64", {
      themeId: activeTheme.id,
      assetFilename: activeTheme.mascot_file,
    })
      .then((base64) => {
        const ext = activeTheme.mascot_file!.split(".").pop()?.toLowerCase() ?? "png";
        const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
        setResolvedSrc(`data:${mime};base64,${base64}`);
      })
      .catch(() => setResolvedSrc(null));
  }, [activeTheme?.id, activeTheme?.mascot_file, activeTheme?.publisher]);

  if (!resolvedSrc) return null;

  return (
    <div
      className="fixed bottom-4 left-4 pointer-events-none z-40 select-none"
      aria-hidden="true"
    >
      <img
        src={resolvedSrc}
        alt=""
        width={size}
        height={size}
        onError={() => setResolvedSrc(null)}
        style={{ opacity: 0.85, objectFit: "contain" }}
        draggable={false}
      />
    </div>
  );
};
