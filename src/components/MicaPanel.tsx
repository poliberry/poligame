import React from "react";

interface MicaPanelProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const MicaPanel: React.FC<MicaPanelProps> = ({
  children,
  className = "",
  style,
}) => {
  return (
    <div className={`mica-panel ${className}`} style={style}>
      <div className="mica-panel-content">{children}</div>
    </div>
  );
};

