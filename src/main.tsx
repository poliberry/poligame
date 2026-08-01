import "@/styles/theme.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { ConvexProviderWrapper } from "./components/ConvexProvider";
import "./lib/posthog";

console.log("main.tsx: Starting React app initialization");
console.log(
  "main.tsx: Root element exists:",
  !!document.getElementById("root")
);

const rootElement = document.getElementById("root");
if (!rootElement) {
  console.error("CRITICAL: Root element not found!");
} else {
  console.log("main.tsx: Creating React root...");
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ConvexProviderWrapper>
          <App />
      </ConvexProviderWrapper>
    </React.StrictMode>
  );
  console.log("main.tsx: React app rendered");
}
