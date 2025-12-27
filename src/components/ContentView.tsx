import React from "react";

interface ContentViewProps {
  children: React.ReactNode;
}

export const ContentView: React.FC<ContentViewProps> = ({ children }) => {
  return (
    <div 
      className="flex flex-col w-full h-full overflow-hidden"
      style={{
        height: 'calc(100vh - 48px)',
      }}
    >
      {children}
    </div>
  );
};

