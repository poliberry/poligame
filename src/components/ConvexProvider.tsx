import React from "react";
import { ConvexProvider, ConvexReactClient } from "convex/react";

// Note: Set VITE_CONVEX_URL in your .env file or environment
// You'll get this URL when you run `npx convex dev`
const CONVEX_URL = (import.meta as any).env?.VITE_CONVEX_URL || "";

const convex = new ConvexReactClient(CONVEX_URL);

interface ConvexProviderWrapperProps {
  children: React.ReactNode;
}

export const ConvexProviderWrapper: React.FC<ConvexProviderWrapperProps> = ({ children }) => {
  console.log("ConvexProviderWrapper rendering, CONVEX_URL:", CONVEX_URL ? "set" : "not set");
  
  if (!CONVEX_URL) {
    console.warn("VITE_CONVEX_URL is not set. Convex features will not work.");
    return <>{children}</>;
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
};

