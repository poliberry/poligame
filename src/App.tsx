import { Routes, Route, Navigate, HashRouter } from "react-router-dom";
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
import Notifications from "./pages/Notifications";
import ComingSoon from "./pages/ComingSoon";
import Overlay from "./pages/Overlay";
import { useEffect } from "react";
import { usePlaytimeTracking } from "@/hooks/usePlaytimeTracking";
import { AccessibilityFilter } from "@/components/AccessibilityFilter";
import { useTauriDragRegions } from "@/hooks/useTauriDragRegions";

function AppContent() {
  // Track playtime for all games
  usePlaytimeTracking();
  useTauriDragRegions();
  
  return (
    <Routes>
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
      {/* Overdrive route - standalone without AppShell, fullscreen mode */}
      <Route path="/overdrive" element={<Overdrive />} />
      {/* Overlay route - standalone without AppShell, game overlay */}
      <Route path="/overlay" element={<Overlay />} />
      {/* Settings route - standalone without AppShell */}
      <Route path="/settings" element={<Settings />} />
      {/* Coming Soon route - standalone without AppShell */}
      <Route path="/coming-soon" element={<ComingSoon />} />
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
          <AppContent />
        </HashRouter>
      </NovuProviderWrapper>
    </ThemeProvider>
  );
}

export default App;

