import React from "react";
import { ControllerType } from "@/stores/controllerStore";

interface ControllerIconProps {
  controllerType: ControllerType;
  size?: number;
  className?: string;
}

const ControllerIcon: React.FC<ControllerIconProps> = ({
  controllerType,
  size = 24,
  className = "",
}) => {
  const iconSize = size;

  switch (controllerType) {
    case "xbox":
      return (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Xbox Logo - X symbol */}
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      );

    case "playstation":
      return (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* PlayStation Logo - P and S */}
          <path d="M8 4h2v16H8V4zm6 0h2v16h-2V4z" />
          <circle cx="6" cy="6" r="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M18 18c0-2-1-3-3-3s-3 1-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        </svg>
      );

    case "nintendo":
      return (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="currentColor"
          className={className}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Nintendo Switch Logo - Simplified */}
          <rect x="2" y="8" width="8" height="8" rx="1" />
          <rect x="14" y="8" width="8" height="8" rx="1" />
          <circle cx="6" cy="12" r="1" />
          <circle cx="18" cy="12" r="1" />
        </svg>
      );

    default:
      // Generic controller icon
      return (
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={className}
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <circle cx="9" cy="12" r="1.5" />
          <circle cx="15" cy="12" r="1.5" />
          <path d="M8 8h8M8 16h8" />
        </svg>
      );
  }
};

export default ControllerIcon;

