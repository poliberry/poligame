import React from "react";

interface MicaButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "default" | "primary" | "secondary";
  className?: string;
}

export const MicaButton: React.FC<MicaButtonProps> = ({
  children,
  variant = "default",
  className = "",
  ...props
}) => {
  const variantClasses = {
    primary: "text-white",
    secondary: "bg-white/10 text-white hover:bg-white/20",
    default: "",
  };

  const primaryStyle = variant === "primary" ? {
    background: `linear-gradient(to bottom right, var(--theme-button), var(--theme-button-secondary))`,
  } : {};

  return (
    <button
      className={`px-4 py-2 rounded-md transition-colors ${variantClasses[variant]} ${className}`}
      style={primaryStyle}
      {...props}
    >
      <span className="mica-button-content">{children}</span>
    </button>
  );
};

