import React from "react";
import { useAuthStore } from "@/stores/authStore";
// @ts-ignore
import welcomeVideo from "@/public/video/loader-video.mp4";

const Loader: React.FC = () => {
  // Debug: Log that component is rendering
  console.log("Loader component rendering");
  console.log("Loader: window.location:", window.location.href);
  console.log("Loader: document readyState:", document.readyState);
  const { user, isAuthenticated } = useAuthStore();
  // Get username from localStorage
  const getUsername = () => {
    try {
      const storedUser = localStorage.getItem("auth-user");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        return user.username || user.email || "User";
      }
    } catch (error) {
      console.error("Error loading user:", error);
    }
    return "User";
  };

  const getAvatar = () => {
    try {
      const storedUser = localStorage.getItem("auth-user");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        return user.avatar || "https://ui-avatars.com/api/?name=" + user.username || user.email;
      }
    } catch (error) {
      console.error("Error loading avatar:", error);
    }
    return "https://ui-avatars.com/api/?name=User";
  };

  const username = getUsername();
  const avatar = getAvatar();

  console.log("Loader: About to render JSX");

  return (
    <div
      className="w-full h-screen text-white drag-region relative"
      style={{
        backgroundColor: 'var(--background)',
        minHeight: '100vh',
        width: '100%',
        height: '100%',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 9999
      }}
    >

      <video
        src={welcomeVideo}
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-cover absolute top-0 left-0 z-0"
        onError={(e) => {
          console.error("Video failed to load:", e);
        }}
        onLoadStart={() => {
          console.log("Video started loading");
        }}
      />
      <div className="w-full h-full flex items-center justify-center z-10 bg-black/50 backdrop-blur-sm absolute p-12 top-0 left-0">
        <div className="flex flex-col items-center gap-6 w-full h-full justify-center">
          {/* Logo/App Name */}
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2 uppercase italic">
              {isAuthenticated ? "Loading your games..." : "Loading..."}
            </h1>
          </div>

          <div className="w-64 mt-4 relative" style={{ padding: '12px 0' }}>
            <div className="w-full h-1 bg-white/10 rounded-full relative">
              <div
                className="h-full rounded-full"
                style={{
                  background: `linear-gradient(to right, var(--theme-button), var(--theme-button-secondary))`,
                  animation: "loadingBar 10s ease-in-out forwards, glowPulse 2s ease-in-out infinite",
                  maxWidth: "100%",
                }}
              />
            </div>
          </div>

          {isAuthenticated && user && (
            <>
              <div className="flex flex-row items-center gap-2 mt-4">
                <img src={avatar} alt="Avatar" className="w-10 h-10" />
                <p className="text-white text-lg">{username}</p>
              </div>
            </>
          )}

          {/* Loading Bar */}

        </div>
      </div>

      <style>{`
        @keyframes loadingBar {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }
        @keyframes glowPulse {
          0%, 100% {
            box-shadow: 
              0 0 4px var(--theme-button),
              0 0 8px var(--theme-button-secondary);
          }
          50% {
            box-shadow: 
              0 0 6px var(--theme-button),
              0 0 12px var(--theme-button-secondary);
          }
        }
      `}</style>
    </div>
  );
};

export default Loader;

