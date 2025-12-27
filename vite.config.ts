import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// @ts-ignore - Node.js built-in modules
import path from "path";
// @ts-ignore - Node.js built-in modules
import { fileURLToPath } from "url";
// @ts-ignore - Node.js built-in modules
import fs from "fs";
// @ts-ignore - Node.js built-in modules
import { loadEnv } from "vite";
// @ts-ignore - Node.js built-in modules
import type { Plugin } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Plugin to inject env vars into service worker
function injectServiceWorkerEnv() {
  let env: Record<string, string> = {};
  
  const injectEnvIntoServiceWorker = () => {
    try {
      // Read the service worker template
      const swPath = path.resolve(__dirname, "public/firebase-messaging-sw.js");
      if (!fs.existsSync(swPath)) {
        return;
      }
      
      let swContent = fs.readFileSync(swPath, "utf-8");
      
      // Replace placeholders with actual env values
      const replacements: Record<string, string> = {
        "YOUR_API_KEY": env.VITE_FIREBASE_API_KEY || "",
        "YOUR_PROJECT.firebaseapp.com": env.VITE_FIREBASE_AUTH_DOMAIN || "",
        "YOUR_PROJECT_ID": env.VITE_FIREBASE_PROJECT_ID || "",
        "YOUR_PROJECT.appspot.com": env.VITE_FIREBASE_STORAGE_BUCKET || "",
        "YOUR_SENDER_ID": env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
        "YOUR_APP_ID": env.VITE_FIREBASE_APP_ID || "",
      };
      
      for (const [placeholder, value] of Object.entries(replacements)) {
        swContent = swContent.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), value);
      }
      
      // Write the updated service worker
      fs.writeFileSync(swPath, swContent, "utf-8");
    } catch (error) {
      console.warn("Failed to inject env vars into service worker:", error);
    }
  };
  
  return {
    name: "inject-service-worker-env",
    configResolved(config) {
      // Load env vars from .env.local and .env
      env = loadEnv(config.mode, process.cwd(), "");
      injectEnvIntoServiceWorker();
    },
    buildStart() {
      injectEnvIntoServiceWorker();
    },
    configureServer(server) {
      // Also inject during dev mode
      injectEnvIntoServiceWorker();
      
      // Watch for env file changes
      server.watcher.add(".env.local");
      server.watcher.on("change", (file) => {
        if (file.includes(".env.local")) {
          env = loadEnv(server.config.mode, process.cwd(), "");
          injectEnvIntoServiceWorker();
        }
      });
    },
  };
}

// Plugin to add API routes
function apiRoutes(): Plugin {
  return {
    name: "api-routes",
    configureServer(server) {
      // Load environment variables
      const env = loadEnv(server.config.mode, process.cwd(), "");
      
      // Add middleware to handle API routes
      server.middlewares.use((req, res, next) => {
        // Parse URL to remove query string
        const url = req.url?.split("?")[0] || "";
        
        // Only handle /api routes
        if (!url.startsWith("/api/")) {
          return next();
        }

        // Handle CORS
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
          res.statusCode = 200;
          res.end();
          return;
        }

        // Test endpoint
        if (url === "/api/test" && req.method === "GET") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ message: "API route is working!", hasNovuKey: !!(env.NOVU_API_KEY || process.env.NOVU_API_KEY) }));
          return;
        }

        // Handle Novu subscriber creation
        if (url === "/api/novu/subscriber" && req.method === "POST") {
          // Read request body
          let body = "";
          req.on("data", (chunk) => {
            body += chunk.toString();
          });

          req.on("end", async () => {
            try {
              const { subscriberId, email, firstName, avatar } = JSON.parse(body);

              if (!subscriberId || !email) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "subscriberId and email are required" }));
                return;
              }

              // Get Novu API key from environment
              const apiKey = env.NOVU_API_KEY || process.env.NOVU_API_KEY;
              if (!apiKey) {
                console.error("NOVU_API_KEY not found in environment. Available env vars:", Object.keys(env).filter(k => k.includes("NOVU")));
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "NOVU_API_KEY environment variable not set" }));
                return;
              }

              // Import Novu dynamically
              const { Novu } = await import("@novu/api");
              const novu = new Novu({ secretKey: apiKey });

              // Create or update subscriber
              const {result} = await novu.subscribers.create({
                subscriberId: subscriberId,
                email,
                firstName: firstName || undefined,
                avatar: avatar || undefined,
              });

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ subscriberId: result.subscriberId }));
            } catch (error: any) {
              console.error("Error creating Novu subscriber:", error);
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: error.message || "Failed to create Novu subscriber" }));
            }
          });
          return;
        }

        if (url === "/api/novu/notify" && req.method === "POST") {
          // Read request body
          let body = "";
          req.on("data", (chunk) => {
            body += chunk.toString();
          });

          req.on("end", async () => {
            try {
              const { subscriberId, title, body: messageBody, type } = JSON.parse(body);

              if (!subscriberId) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "subscriberId is required" }));
                return;
              }

              // Get Novu API key from environment
              const apiKey = env.NOVU_API_KEY || process.env.NOVU_API_KEY;
              if (!apiKey) {
                console.error("NOVU_API_KEY not found in environment. Available env vars:", Object.keys(env).filter(k => k.includes("NOVU")));
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: "NOVU_API_KEY environment variable not set" }));
                return;
              }

              // Import Novu dynamically
              const { Novu } = await import("@novu/api");
              const novu = new Novu({ secretKey: apiKey });

              // Trigger notification workflow

              novu.trigger({
                workflowId: type,
                to: {
                  subscriberId: subscriberId,
                },
                payload: {
                  title: title,
                  body: messageBody,
                }
              });

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ success: true }));
            } catch (error: any) {
              console.error("Error triggering Novu notification:", error);
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: error.message || "Failed to trigger Novu notification" }));
            }
          });
          return;
        }

        // 404 for unknown API routes
        res.statusCode = 404;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "API route not found", url }));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load env vars
  const env = loadEnv(mode, process.cwd(), "");
  
  return {
    plugins: [react(), tailwindcss(), injectServiceWorkerEnv(), apiRoutes()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
    },
    define: {
      // Make env vars available in the app
      "import.meta.env.VITE_FIREBASE_API_KEY": JSON.stringify(env.VITE_FIREBASE_API_KEY),
      "import.meta.env.VITE_FIREBASE_AUTH_DOMAIN": JSON.stringify(env.VITE_FIREBASE_AUTH_DOMAIN),
      "import.meta.env.VITE_FIREBASE_PROJECT_ID": JSON.stringify(env.VITE_FIREBASE_PROJECT_ID),
      "import.meta.env.VITE_FIREBASE_STORAGE_BUCKET": JSON.stringify(env.VITE_FIREBASE_STORAGE_BUCKET),
      "import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID": JSON.stringify(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
      "import.meta.env.VITE_FIREBASE_APP_ID": JSON.stringify(env.VITE_FIREBASE_APP_ID),
      "import.meta.env.VITE_FIREBASE_VAPID_KEY": JSON.stringify(env.VITE_FIREBASE_VAPID_KEY),
    },
  };
});

