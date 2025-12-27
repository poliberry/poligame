import React from "react";

interface MicaCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  hover?: boolean;
}

export const MicaCard: React.FC<MicaCardProps> = ({
  children,
  className = "",
  onClick,
  hover = true,
}) => {
  return (
    <div
      className={`mica-card ${hover ? "mica-card-hover" : ""} ${className}`}
      onClick={onClick}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <div className="mica-card-content">{children}</div>
    </div>
  );
};

