import { Routes, Route, Navigate, HashRouter, useLocation, useNavigationType } from "react-router-dom";
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
import OverdriveSettings from "./pages/OverdriveSettings";
import OverdriveLibrary from "./pages/OverdriveLibrary";
import Notifications from "./pages/Notifications";
import ComingSoon from "./pages/ComingSoon";
import Overlay from "./pages/Overlay";
import TrayPanel from "./pages/TrayPanel";
import CustomAppDialogWindow from "./pages/CustomAppDialogWindow";
import SteamGridDbPicker from "./pages/SteamGridDbPicker";
import { useEffect, useRef } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { usePlaytimeTracking } from "@/hooks/usePlaytimeTracking";
import { useDiscordRichPresence } from "@/hooks/useDiscordRichPresence";
import { AccessibilityFilter } from "@/components/AccessibilityFilter";
import { useTauriDragRegions } from "@/hooks/useTauriDragRegions";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";
import { useOverdriveStore } from "@/stores/overdriveStore";
import { useAuthStore } from "@/stores/authStore";
import { useControllerStore } from "@/stores/controllerStore";
import OverdriveMenu, { OverdriveMenuItem } from "@/components/overdrive/OverdriveMenu";
import OverdrivePowerDialog from "@/components/overdrive/OverdrivePowerDialog";
import OverdriveGlobalKeyboard from "@/components/overdrive/OverdriveGlobalKeyboard";
import { useOverdriveKeyboardStore } from "@/stores/overdriveKeyboardStore";
import LaunchGame from "./pages/LaunchGame";
import { AnimatePresence, motion } from "framer-motion";
import { Power, SlidersHorizontal } from "lucide-react";
import UpdateAvailableDialog from "@/components/UpdateAvailableDialog";
// @ts-ignore
import menuOpenSound from "@/public/sounds/menuOpen.wav";
// @ts-ignore
import menuCloseSound from "@/public/sounds/menuClose.wav";
// @ts-ignore
import pageOpenSound from "@/public/sounds/pageOpen.wav";
// @ts-ignore
import pageCloseSound from "@/public/sounds/pageClose.wav";

function OverdriveRouteShell({ location }: { location: ReturnType<typeof useLocation> }) {
  const navigate = useNavigate();
  const navigationType = useNavigationType();
  const { isAuthenticated, signOut } = useAuthStore();
  const { controllerType, isConnected } = useControllerStore();
  const { isMenuOpen, isPowerDialogOpen, setMenuOpen, setPowerDialogOpen } = useOverdriveStore();
  const isKeyboardOpen = useOverdriveKeyboardStore((state) => state.isOpen);
  const menuOpenAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const menuCloseAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const pageOpenAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const pageCloseAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const previousMenuOpenRef = React.useRef<boolean>(isMenuOpen);
  const previousPowerDialogOpenRef = React.useRef<boolean>(isPowerDialogOpen);
  const previousPathRef = React.useRef<string>(location.pathname);
  const lastKeyboardEnterRef = React.useRef<number>(0);
  const lastMenuToggleAtRef = React.useRef<number>(0);

  const playMenuOpenSound = React.useCallback(() => {
    const audio = menuOpenAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.debug("Failed to play menu open sound", error);
    });
  }, []);

  const playMenuCloseSound = React.useCallback(() => {
    const audio = menuCloseAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.debug("Failed to play menu close sound", error);
    });
  }, []);

  const playPageOpenSound = React.useCallback(() => {
    const audio = pageOpenAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.debug("Failed to play page open sound", error);
    });
  }, []);

  const playPageCloseSound = React.useCallback(() => {
    const audio = pageCloseAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.debug("Failed to play page close sound", error);
    });
  }, []);

  React.useEffect(() => {
    const openAudio = new Audio(menuOpenSound);
    openAudio.preload = "auto";
    openAudio.volume = 0.35;
    menuOpenAudioRef.current = openAudio;

    const closeAudio = new Audio(menuCloseSound);
    closeAudio.preload = "auto";
    closeAudio.volume = 0.35;
    menuCloseAudioRef.current = closeAudio;

    const pageOpenAudio = new Audio(pageOpenSound);
    pageOpenAudio.preload = "auto";
    pageOpenAudio.volume = 0.35;
    pageOpenAudioRef.current = pageOpenAudio;

    const pageCloseAudio = new Audio(pageCloseSound);
    pageCloseAudio.preload = "auto";
    pageCloseAudio.volume = 0.35;
    pageCloseAudioRef.current = pageCloseAudio;

    return () => {
      openAudio.pause();
      closeAudio.pause();
      pageOpenAudio.pause();
      pageCloseAudio.pause();
      menuOpenAudioRef.current = null;
      menuCloseAudioRef.current = null;
      pageOpenAudioRef.current = null;
      pageCloseAudioRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    const previousPath = previousPathRef.current;
    if (previousPath !== location.pathname) {
      if (navigationType === "POP") {
        playPageCloseSound();
      } else {
        playPageOpenSound();
      }
      previousPathRef.current = location.pathname;
    }
  }, [location.pathname, navigationType, playPageCloseSound, playPageOpenSound]);

  React.useEffect(() => {
    if (previousMenuOpenRef.current !== isMenuOpen) {
      if (isMenuOpen) {
        playMenuOpenSound();
      } else {
        playMenuCloseSound();
      }
      previousMenuOpenRef.current = isMenuOpen;
    }
  }, [isMenuOpen, playMenuCloseSound, playMenuOpenSound]);

  React.useEffect(() => {
    if (previousPowerDialogOpenRef.current !== isPowerDialogOpen) {
      if (isPowerDialogOpen) {
        playMenuOpenSound();
      } else {
        playMenuCloseSound();
      }
      previousPowerDialogOpenRef.current = isPowerDialogOpen;
    }
  }, [isPowerDialogOpen, playMenuCloseSound, playMenuOpenSound]);

  const closeMenu = React.useCallback(() => setMenuOpen(false), [setMenuOpen]);

  const handleOpenPower = React.useCallback(() => {
    setMenuOpen(false);
    setPowerDialogOpen(true);
  }, [setMenuOpen, setPowerDialogOpen]);

  const handleExitOverdrive = React.useCallback(async () => {
    try {
      await invoke("exit_overdrive_mode");
      setMenuOpen(false);
      setPowerDialogOpen(false);
      navigate("/");
    } catch (error) {
      console.error("Failed to exit Overdrive mode:", error);
    }
  }, [navigate, setMenuOpen, setPowerDialogOpen]);

  const handleExitPoliGame = React.useCallback(async () => {
    try {
      await invoke("exit_overdrive_mode");
      await invoke("close_window");
    } catch (error) {
      console.error("Failed to exit PoliGame:", error);
    }
  }, []);

  const handleSignOut = React.useCallback(async () => {
    try {
      await signOut();
      setMenuOpen(false);
      setPowerDialogOpen(false);
      navigate("/auth");
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  }, [navigate, setMenuOpen, setPowerDialogOpen, signOut]);

  const menuItems = React.useMemo<OverdriveMenuItem[]>(() => ([
    {
      id: "overdrive-settings",
      label: "Overdrive Settings",
      icon: SlidersHorizontal,
      onSelect: () => {
        setMenuOpen(false);
        navigate("/overdrive/settings");
      },
    },
    {
      id: "power-options",
      label: "Power Options",
      icon: Power,
      onSelect: handleOpenPower,
    },
  ]), [handleOpenPower, navigate, setMenuOpen]);

  useResponsiveGamepad({
    onButtonDown: (button) => {
      if (button === "START") {
        if (!isConnected) {
          return;
        }

        const now = Date.now();
        if (now - lastKeyboardEnterRef.current < 250) {
          return;
        }
        if (now - lastMenuToggleAtRef.current < 200) {
          return;
        }

        if (isKeyboardOpen) {
          return;
        }

        lastMenuToggleAtRef.current = now;
        setMenuOpen(!isMenuOpen);
        return;
      }

      if (button === "B" && isPowerDialogOpen) {
        setPowerDialogOpen(false);
      }
    },
  });

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        const now = Date.now();
        if (now - lastMenuToggleAtRef.current < 200) {
          return;
        }
        if (isKeyboardOpen) {
          return;
        }
        lastMenuToggleAtRef.current = now;
        setMenuOpen(!isMenuOpen);
        return;
      }

      if (event.key === "Enter" || event.key === "NumpadEnter") {
        lastKeyboardEnterRef.current = Date.now();
      }

      if (event.key === "Escape" && isPowerDialogOpen) {
        event.preventDefault();
        setPowerDialogOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isKeyboardOpen, isMenuOpen, isPowerDialogOpen, setMenuOpen, setPowerDialogOpen]);

  return (
    <>
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
            <Route path="/overdrive/library" element={<OverdriveLibrary />} />
            <Route path="/overdrive/game/:gameId" element={<OverdriveGameDetails />} />
            <Route path="/overdrive/settings" element={<OverdriveSettings />} />
            <Route path="*" element={<Navigate to="/overdrive" replace />} />
          </Routes>
        </motion.div>
      </AnimatePresence>

      <OverdriveMenu
        isOpen={isMenuOpen}
        onClose={closeMenu}
        items={menuItems}
        controllerType={controllerType}
        isControllerConnected={isConnected}
      />
      <OverdrivePowerDialog
        open={isPowerDialogOpen}
        onOpenChange={setPowerDialogOpen}
        onExitOverdrive={handleExitOverdrive}
        onExitPoliGame={handleExitPoliGame}
        onSignOut={isAuthenticated ? handleSignOut : undefined}
        controllerType={controllerType}
        isControllerConnected={isConnected}
      />
      <OverdriveGlobalKeyboard />
    </>
  );
}

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
  useDiscordRichPresence(!isCustomDialogWindow);

  if (isOverdriveRoute) {
    return <OverdriveRouteShell location={location} />;
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

