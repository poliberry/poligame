import { Routes, Route, Navigate, HashRouter, useLocation } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { LibraryLayout } from "./components/LibraryLayout";
import { ThemeProvider } from "./components/ThemeProvider";
import { NovuProviderWrapper } from "./components/NovuProvider";
import Library from "./pages/Library";
import Browser from "./pages/Browser";
import Profiles from "./pages/Profiles";
import Settings from "./pages/Settings";
import GameDetails from "./pages/GameDetails";
import Community from "./pages/Community";
import Marketplace from "./pages/Marketplace";
import Profile from "./pages/Profile";
import Loader from "./pages/Loader";
import { Auth } from "./pages/Auth";
import { AccountDetails } from "./pages/AccountDetails";
import { GameCustomization } from "./pages/GameCustomization";
import PrivacySettings from "./pages/PrivacySettings";
import Friends from "./pages/Friends";
import Overdrive from "./pages/Overdrive";
import OverdriveGameDetails from "./pages/OverdriveGameDetails";
import Notifications from "./pages/Notifications";
import ComingSoon from "./pages/ComingSoon";
import Overlay from "./pages/Overlay";
import TrayPanel from "./pages/TrayPanel";
import CustomAppDialogWindow from "./pages/CustomAppDialogWindow";
import SteamGridDbPicker from "./pages/SteamGridDbPicker";
import { useEffect, useRef } from "react";
import { usePlaytimeTracking } from "@/hooks/usePlaytimeTracking";
import { AccessibilityFilter } from "@/components/AccessibilityFilter";
import { useTauriDragRegions } from "@/hooks/useTauriDragRegions";
import LaunchGame from "./pages/LaunchGame";
import { AnimatePresence, motion } from "framer-motion";
import UpdateAvailableDialog from "@/components/UpdateAvailableDialog";

function AppContent() {
  const location = useLocation();
  const previousPathnameRef = useRef(location.pathname);
  const isCustomDialogWindow = location.pathname.startsWith("/custom-app-dialog");
  const isOverdriveRoute =
    location.pathname === "/overdrive" ||
    location.pathname.startsWith("/overdrive/");

  useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    const wasOverdriveRoute =
      previousPathname === "/overdrive" ||
      previousPathname.startsWith("/overdrive/");

    if (wasOverdriveRoute && !isOverdriveRoute) {
      sessionStorage.removeItem("overdriveIntroSeen");
    }

    previousPathnameRef.current = location.pathname;
  }, [isOverdriveRoute, location.pathname]);

  // Track playtime for all games
  usePlaytimeTracking(!isCustomDialogWindow);
  useTauriDragRegions(!isCustomDialogWindow);

  if (isOverdriveRoute) {
    return (
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="w-full h-full"
        >
          <Routes location={location}>
            <Route path="/overdrive" element={<Overdrive />} />
            <Route path="/overdrive/game/:gameId" element={<OverdriveGameDetails />} />
            <Route path="*" element={<Navigate to="/overdrive" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <Routes location={location}>
      {/* Loader route - standalone without AppShell */}
      <Route path="/loader" element={<Loader />} />
      {/* Auth route - standalone without AppShell */}
      <Route path="/auth" element={<Auth />} />
      {/* Account Details route - standalone without AppShell */}
      <Route path="/account-details" element={<AccountDetails />} />
      {/* Game Customization route - standalone without AppShell */}
      <Route path="/game/:gameId/customize" element={<GameCustomization />} />
      {/* Friends route - standalone without AppShell */}
      <Route path="/friends" element={<Friends />} />
      {/* Notifications route - standalone without AppShell */}
      <Route path="/notifications" element={<Notifications />} />
      {/* Overlay route - standalone without AppShell, game overlay */}
      <Route path="/overlay" element={<Overlay />} />
      {/* Tray route - standalone custom tray panel */}
      <Route path="/tray" element={<TrayPanel />} />
      {/* Settings route - standalone without AppShell */}
      <Route path="/settings" element={<Settings />} />
      {/* Custom app dialogs route - standalone without AppShell */}
      <Route path="/custom-app-dialog" element={<CustomAppDialogWindow />} />
      {/* SteamGridDB picker route - standalone without AppShell */}
      <Route path="/steamgriddb-picker" element={<SteamGridDbPicker />} />
      {/* Coming Soon route - standalone without AppShell */}
      <Route path="/coming-soon" element={<ComingSoon />} />
      <Route
        path="/game/:gameId/launch"
        element={<LaunchGame />}
      />
      {/* All other routes - with AppShell */}
      <Route
        path="/*"
        element={
          <AppShell>
            <Routes>
              <Route
                path="/"
                element={
                  <LibraryLayout>
                    <Library />
                  </LibraryLayout>
                }
              />
              <Route
                path="/game/:gameId"
                element={
                  <LibraryLayout>
                    <GameDetails />
                  </LibraryLayout>
                }
              />
              <Route path="/browser" element={<Browser />} />
              <Route path="/profiles" element={<Profiles />} />
              <Route path="/community" element={<Community />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/privacy" element={<PrivacySettings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AppShell>
        }
      />
    </Routes>
  );
}

function App() {
  console.log("App component rendering");

  return (
    <ThemeProvider>
      <AccessibilityFilter />
      <NovuProviderWrapper>
        <HashRouter>
          <UpdateAvailableDialog />
          <AppContent />
        </HashRouter>
      </NovuProviderWrapper>
    </ThemeProvider>
  );
}

export default App;

