import React, { useState } from "react";
import { useThemeStore } from "@/stores/themeStore";
import { OFFICIAL_PUBLISHER } from "@/types/theme";

interface MascotOverlayProps {
  size?: number;
}

export const MascotOverlay: React.FC<MascotOverlayProps> = ({ size = 80 }) => {
  const activeTheme = useThemeStore((s) => s.activeTheme);
  const [imageError, setImageError] = useState(false);

  if (!activeTheme) return null;
  if (activeTheme.publisher !== OFFICIAL_PUBLISHER) return null;
  if (!activeTheme.mascot_file) return null;
  if (imageError) return null;

  // Official mascots are bundled as static assets in /themes/mascots/
  const mascotSrc = `/themes/mascots/${activeTheme.mascot_file}`;

  return (
    <div
      className="fixed bottom-4 left-4 pointer-events-none z-40 select-none"
      aria-hidden="true"
    >
      <img
        src={mascotSrc}
        alt=""
        width={size}
        height={size}
        onError={() => setImageError(true)}
        style={{ opacity: 0.85, objectFit: "contain" }}
        draggable={false}
      />
    </div>
  );
};
