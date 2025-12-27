import React from "react";

interface MicaInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}

export const MicaInput = React.forwardRef<HTMLInputElement, MicaInputProps>(
  ({ className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`mica-input ${className}`}
        {...props}
      />
    );
  }
);

MicaInput.displayName = "MicaInput";

