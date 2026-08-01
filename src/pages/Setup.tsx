import React, { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { FaSteam } from "react-icons/fa";
import {
  User,
  Palette,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Upload,
  X,
  Volume2,
  VolumeX,
  Sidebar,
  LogOut,
  Settings,
  ShoppingBag,
  Library,
  MessageSquare,
  Users,
} from "lucide-react";
// @ts-ignore
import logo from "@/public/poligame-logo.svg";
// @ts-ignore
import welcomeAudio from "@/public/setup-music.wav";
// @ts-ignore
import welcomeVideo from "@/public/intro-video-h264.mp4";
// @ts-ignore
import setupVideo from "@/public/setup-video-h264.mp4";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SiEpicgames, SiRockstargames } from "react-icons/si";
import { TbBrandElectronicArts } from "react-icons/tb";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ColorPicker } from "@/components/ui/color-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SetupStep =
  | "video"
  | "welcome"
  | "auth"
  | "userIds"
  | "theme"
  | "profile"
  | "scanning"
  | "complete";

interface LauncherStatus {
  launcher_type: string;
  installed: boolean;
  path?: string;
}

interface ScannedGame {
  launcher: string;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export const Setup: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<SetupStep>("video");
  const { user, setUser, setLoading: setAuthLoading } = useAuthStore();
  const { colors: themeColors, setColors: setThemeColors } = useThemeStore();
  const [isMainWindow, setIsMainWindow] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const introVideoRef = React.useRef<HTMLVideoElement>(null);
  const setupVideoRef = React.useRef<HTMLVideoElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const isCompleteRef = React.useRef(false);

  // Auth state
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // User IDs state
  const [steamUserId, setSteamUserId] = useState("");
  const [epicUserId, setEpicUserId] = useState("");
  const [eaUserId, setEaUserId] = useState("");
  const [rockstarUserId, setRockstarUserId] = useState("");

  // Theme state
  const [accentColor, setAccentColor] = useState(themeColors.accent);
  const [buttonColor, setButtonColor] = useState(themeColors.button);
  const [buttonSecondaryColor, setButtonSecondaryColor] = useState(
    themeColors.buttonSecondary || themeColors.accent,
  );
  const [backgroundColor, setBackgroundColor] = useState(
    themeColors.background,
  );
  const [panelColor, setPanelColor] = useState(themeColors.panel);

  // Profile state
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Scanning step state
  const [scanPhase, setScanPhase] = useState<"idle" | "scanning" | "done">("idle");
  const [detectedLaunchers, setDetectedLaunchers] = useState<LauncherStatus[]>([]);
  const [scanCounts, setScanCounts] = useState<Record<string, number>>({});
  const [totalGamesFound, setTotalGamesFound] = useState(0);

  const signIn = useMutation(api.auth.signIn);
  const signUp = useMutation(api.auth.signUp);
  const updateProfile = useMutation(api.user.updateUserProfile);

  // Check if we're on the main window
  useEffect(() => {
    const checkWindow = async () => {
      try {
        const window = getCurrentWindow();
        const label = window.label;
        setIsMainWindow(label === "main");
      } catch (error) {
        console.error("Error checking window label:", error);
        // Default to false if we can't check
        setIsMainWindow(false);
      }
    };
    checkWindow();

    const video = document.querySelector("video")!;

    video?.addEventListener("error", () => {
      console.log(video.error);
    });

    console.log(video?.readyState);
    console.log(video?.videoWidth);
    console.log(video?.videoHeight);
    console.log(video?.currentSrc);
  }, []);

  // Load user data if already authenticated
  useEffect(() => {
    if (user) {
      setSteamUserId(user.steamUserId || "");
      setEpicUserId(user.epicUserId || "");
      setEaUserId(user.eaUserId || "");
      setRockstarUserId(user.rockstarUserId || "");
      setBio(user.bio || "");
      setAvatar(user.avatar || null);
      setUsername(user.username || "");
    }
  }, [user]);

  // Check if user is authenticated to skip auth step
  useEffect(() => {
    if (user && currentStep === "auth") {
      setCurrentStep("userIds");
    }
  }, [user, currentStep]);

  useEffect(() => {
    if (currentStep !== "scanning" || scanPhase !== "idle") return;

    const runScan = async () => {
      setScanPhase("scanning");

      try {
        const statuses = await invoke<LauncherStatus[]>("scan_all_launchers");
        setDetectedLaunchers(statuses);
      } catch (e) {
        console.error("Failed to detect launchers:", e);
      }

      try {
        await invoke<string>("scan_all_games");
      } catch (e) {
        console.error("Game scan failed:", e);
      }

      try {
        const allGames = await invoke<ScannedGame[]>("get_all_games");
        const counts: Record<string, number> = {};
        for (const game of allGames) {
          counts[game.launcher] = (counts[game.launcher] || 0) + 1;
        }
        setScanCounts(counts);
        setTotalGamesFound(allGames.length);
      } catch (e) {
        console.error("Failed to get games after scan:", e);
      }

      setScanPhase("done");
    };

    runScan();
  }, [currentStep, scanPhase]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsAuthLoading(true);
    setAuthLoading(true);

    try {
      let userData;

      if (authMode === "signup") {
        await signUp({
          email,
          password,
          username: username || undefined,
        });
        userData = await signIn({ email, password });
      } else {
        userData = await signIn({ email, password });
      }

      setUser(userData as any);
      // Update local state with user data
      if (userData) {
        setSteamUserId(userData.steamUserId || "");
        setEpicUserId(userData.epicUserId || "");
        setEaUserId(userData.eaUserId || "");
        setRockstarUserId(userData.rockstarUserId || "");
        setBio(userData.bio || "");
        setAvatar(userData.avatar || null);
        setUsername(userData.username || "");
      }
      setCurrentStep("userIds");
    } catch (err: any) {
      setAuthError(err.message || "An error occurred");
    } finally {
      setIsAuthLoading(false);
      setAuthLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Avatar image must be less than 2MB");
        return;
      }

      if (!file.type.startsWith("image/")) {
        alert("Please select an image file");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setAvatar(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleComplete = async () => {
    if (!user?.userId) {
      alert("Please sign in first");
      return;
    }

    setIsSaving(true);

    try {
      // Save User IDs
      await updateProfile({
        userId: user.userId as unknown as Id<"users">,
        steamUserId: steamUserId || undefined,
        epicUserId: epicUserId || undefined,
        eaUserId: eaUserId || undefined,
        rockstarUserId: rockstarUserId || undefined,
        bio: bio || undefined,
        avatar: avatar || undefined,
        username: username || undefined,
      });

      // Save theme colors
      setThemeColors({
        accent: accentColor,
        button: buttonColor,
        buttonSecondary: buttonSecondaryColor,
        background: backgroundColor,
        panel: panelColor,
      });

      // Mark setup as complete
      await invoke("set_setup_complete", { completed: true });

      setCurrentStep("scanning");
    } catch (error: any) {
      console.error("Failed to save setup:", error);
      alert(error.message || "Failed to save setup");
    } finally {
      setIsSaving(false);
    }
  };

  const steps: { key: SetupStep; title: string; description: string }[] = [
    {
      key: "welcome",
      title: "Welcome",
      description: "Get started with PoliGame",
    },
    { key: "auth", title: "Account", description: "Sign up or sign in" },
    {
      key: "userIds",
      title: "User IDs",
      description: "Configure your launcher IDs",
    },
    { key: "theme", title: "Theme", description: "Customize your colors" },
    { key: "profile", title: "Profile", description: "Set up your profile" },
    {
      key: "scanning",
      title: "Scanning",
      description: "Finding your games",
    },
    { key: "complete", title: "Complete", description: "You're all set!" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const canGoNext = () => {
    switch (currentStep) {
      case "welcome":
        return true;
      case "auth":
        return !!user;
      case "userIds":
        return true; // Optional step
      case "theme":
        return true;
      case "profile":
        return true; // Optional step
      default:
        return false;
    }
  };

  const handleNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStep(steps[nextIndex].key);
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].key);
    }
  };

  const [showVideo, setShowVideo] = useState(false);
  const [isFading, setIsFading] = useState(false);

  // Short delay before intro video starts
  useEffect(() => {
    const timer = setTimeout(() => setShowVideo(true), 700);
    return () => clearTimeout(timer);
  }, []);

  const [previewButtonHovered, setPreviewButtonHovered] = useState(false);

  if (currentStep === "video") {
    const handleVideoEnd = () => {
      // 2 second delay after video ends before transition
      setTimeout(() => {
        setIsFading(true);
        setTimeout(() => setCurrentStep("welcome"), 500);
      }, 2000);
    };

    return (
      <div
        className={`min-h-screen flex items-center justify-center bg-black transition-opacity duration-500 ${isFading ? "opacity-0" : "opacity-100"}`}
      >
        {showVideo && (
          <video
            ref={introVideoRef}
            src={welcomeVideo}
            autoPlay
            muted={isAudioMuted}
            playsInline
            preload="auto"
            disablePictureInPicture
            controls={false}
            onEnded={handleVideoEnd}
            onLoadedData={(event) => {
              const video = event.currentTarget;

              console.log({
                src: video.currentSrc,
                readyState: video.readyState,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                error: video.error,
                paused: video.paused,
              });

              video.play().catch(console.error);
            }}
            className="w-full h-full object-cover"
          >
            Your browser does not support the video tag.
          </video>
        )}

        <button
          onClick={() => {
            setIsFading(true);
            setTimeout(() => setCurrentStep("welcome"), 500);
          }}
          className="absolute bottom-8 right-8 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-white/70 hover:text-white transition-all"
        >
          Skip
        </button>
      </div>
    );
  } else {
    return (
      <div className="w-full h-screen text-white flex flex-col drag-region">
        <audio
          ref={audioRef}
          src={welcomeAudio}
          autoPlay
          loop
          muted={isAudioMuted}
        />
        <div className="w-full h-screen">
          <video
            ref={setupVideoRef}
            src={setupVideo}
            autoPlay={true}
            muted={true}
            playsInline
            loop
            preload="auto"
            disablePictureInPicture
            height={1080}
            width={1920}
            controls={false}
            onLoadedData={(event) => {
              const video = event.currentTarget;

              console.log({
                src: video.currentSrc,
                readyState: video.readyState,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                error: video.error,
                paused: video.paused,
              });

              video.play().catch(console.error);
            }}
            className="w-full h-full object-cover"
          >
            Your browser does not support the video tag.
          </video>
          <div className="w-full h-full bg-black/50 z-10 absolute top-0 left-0">
            <div
              data-tauri-drag-region
              className="drag-region backdrop-blur-lg fixed top-0 left-0 w-full h-10 bg-black/50 z-20 flex items-center justify-end px-2"
            >
              <div className="flex items-center gap-3">
                {isMainWindow && (
                  <button
                    onClick={() => {
                      const audio = audioRef.current;
                      if (audio) {
                        audio.muted = !audio.muted;
                        setIsAudioMuted(audio.muted);
                      }
                    }}
                    className="text-white cursor-pointer hover:opacity-80 transition-opacity"
                    aria-label={isAudioMuted ? "Unmute audio" : "Mute audio"}
                  >
                    {isAudioMuted ? (
                      <VolumeX size={20} />
                    ) : (
                      <Volume2 size={20} />
                    )}
                  </button>
                )}
                <X
                  size={20}
                  className="text-white cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => {
                    invoke("close_setup_window");
                  }}
                />
              </div>
            </div>

            <div className="flex flex-col items-start p-4 justify-center w-full h-full">
              <Card
                className={cn(
                  "no-drag-region dark p-0 rounded-2xl bg-black border border-transparent min-w-lg",
                  currentStep === "theme" ? "w-full" : "max-w-lg",
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-white/10 select-none">
                  <div className="flex items-center gap-4">
                    <img src={logo} alt="Logo" width={40} height={40} />
                    <div>
                      <h1
                        className="text-xl font-light"
                       
                      >
                        Get setup to play
                      </h1>
                      <p
                        className="text-sm text-white/60 font-thin"
                       
                      >
                        {steps[currentStepIndex].description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {steps.map((step, index) => (
                      <div
                        key={step.key}
                        className={cn(
                          "w-2 h-2 rounded-full transition-all",
                          index <= currentStepIndex
                            ? "bg-[var(--theme-accent)]"
                            : "bg-white/20",
                          index === currentStepIndex ? "animate-pulse" : "",
                          index === currentStepIndex
                            ? "shadow-[0_0_10px_var(--theme-accent)]"
                            : "",
                        )}
                      />
                    ))}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                  <div
                    className={cn(
                      "mx-auto",
                      currentStep === "theme" ? "w-full" : "max-w-lg",
                    )}
                  >
                    {/* Welcome Step */}
                    {currentStep === "welcome" && (
                      <div className="text-left space-y-3 select-none">
                        <h2
                          className="text-xl font-light"
                         
                        >
                          A home for all your games.
                        </h2>
                        <p
                          className="text-white/80 text-sm font-thin"
                         
                        >
                          Ready to start gaming? Let's get you set up.
                        </p>
                        <div className="flex flex-col gap-4 mt-8">
                          <div className="p-4 flex flex-row items-center gap-4">
                            <User
                              className="w-12 h-12"
                              style={{ color: themeColors.accent }}
                            />
                            <div className="flex flex-col">
                              <h3
                                className="font-light text-lg"
                              >
                                Set up your account
                              </h3>
                              <p
                                className="text-sm text-white/60 font-thin"
                              >
                                We'll help you login with your PoliGame account
                                to access social features and account sync.
                              </p>
                            </div>
                          </div>
                          <div className="p-4 flex flex-row items-center gap-4">
                            <Palette
                              className="w-12 h-12"
                              style={{ color: themeColors.accent }}
                            />
                            <div className="flex flex-col">
                              <h3
                                className="font-light text-lg"
                              >
                                Change your look
                              </h3>
                              <p
                                className="text-sm text-white/60 font-thin"
                              >
                                Your launcher should reflect you. We'll help you
                                setup a custom theme, or use the default.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Auth Step */}
                    {currentStep === "auth" && (
                      <div className="space-y-6">
                        <h2
                          className="text-2xl font-light mb-6"
                         
                        >
                          {authMode === "signup"
                            ? "Set up your account"
                            : "Login to PoliGame"}
                        </h2>

                        <form onSubmit={handleAuthSubmit} className="space-y-4">
                          <div className="flex flex-row items-center justify-between gap-2">
                            {authMode === "signup" && (
                              <div className="w-1/2">
                                <Label
                                  className="text-sm font-thin mb-2 select-none"
                                >
                                  Username
                                </Label>
                                <Input
                                  type="text"
                                  value={username}
                                  onChange={(e) => setUsername(e.target.value)}
                                  placeholder="Enter username"
                                  className="p-4 border-none rounded-full"
                                />
                              </div>
                            )}

                            <div
                              className={cn(
                                authMode === "signup" ? "w-1/2" : "w-full",
                              )}
                            >
                              <Label
                                className="text-sm font-thin mb-2 select-none"
                              >
                                Email
                              </Label>
                              <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                                className="p-4 border-none rounded-full"
                              />
                            </div>
                          </div>

                          <div>
                            <Label
                              className="text-sm font-thin mb-2 select-none"
                            >
                              Password
                            </Label>
                            <Input
                              type="password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Enter your password"
                              required
                              className="p-4 border-none rounded-full"
                            />
                          </div>

                          {authError && (
                            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded text-sm text-red-400">
                              {authError}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-4">
                            <Button
                              type="button"
                              onClick={() => {
                                setAuthMode(
                                  authMode === "signin" ? "signup" : "signin",
                                );
                                setAuthError(null);
                              }}
                              variant="outline"
                              className="text-xs font-thin rounded-full border-none px-4"
                            >
                              {authMode === "signin"
                                ? "Don't have an account? Sign up"
                                : "Already have an account? Sign in"}
                            </Button>
                            <Button
                              type="submit"
                              variant="default"
                              className="rounded-full px-6"
                              disabled={isAuthLoading}
                            >
                              {isAuthLoading
                                ? "Logging in..."
                                : authMode === "signin"
                                  ? "Sign In"
                                  : "Sign Up"}
                            </Button>
                          </div>
                        </form>
                      </div>
                    )}

                    {/* User IDs Step */}
                    {currentStep === "userIds" && (
                      <div className="space-y-6">
                        <h2
                          className="text-2xl font-light mb-2"
                         
                        >
                          Configure external accounts
                        </h2>
                        <p
                          className="text-white/60 mb-6 font-thin"
                         
                        >
                          Enter your launcher user IDs to enable features like
                          achievements and game tracking. These are optional and
                          can be configured later.
                        </p>

                        <div className="space-y-4 h-72 overflow-y-auto">
                          <div>
                            <label
                              className="block text-sm font-light mb-2 flex items-center gap-2"
                            >
                              <FaSteam className="w-4 h-4" />
                              Steam User ID
                            </label>
                            <Input
                              type="text"
                              value={steamUserId}
                              onChange={(e) => setSteamUserId(e.target.value)}
                              placeholder="Enter your Steam User ID (64-bit)"
                              className="p-4 border-none rounded-full"
                            />
                            <p
                              className="text-xs text-white/50 font-thin mt-1"
                            >
                              Find your Steam ID at steamid.io or check your
                              Steam profile URL
                            </p>
                          </div>

                          <div>
                            <label
                              className="block text-sm font-light mb-2 flex items-center gap-2"
                            >
                              <SiEpicgames size={18} /> Epic Games User ID
                            </label>
                            <Input
                              type="text"
                              value={epicUserId}
                              onChange={(e) => setEpicUserId(e.target.value)}
                              placeholder="Enter your Epic Games User ID"
                              className="p-4 border-none rounded-full"
                            />
                            <p
                              className="text-xs text-white/50 font-thin mt-1"
                            >
                              Find your Epic Games ID at epicgames.com or check
                              your Epic Games profile URL
                            </p>
                          </div>

                          <div>
                            <label
                              className="block text-sm font-light mb-2 flex items-center gap-2"
                            >
                              <TbBrandElectronicArts size={18} /> EA User ID
                            </label>
                            <Input
                              type="text"
                              value={eaUserId}
                              onChange={(e) => setEaUserId(e.target.value)}
                              placeholder="Enter your EA User ID"
                              className="p-4 border-none rounded-full"
                            />
                            <p
                              className="text-xs text-white/50 font-thin mt-1"
                            >
                              Find your EA User ID at ea.com or check your EA
                              profile URL
                            </p>
                          </div>

                          <div>
                            <label
                              className="block text-sm font-light mb-2 flex items-center gap-2"
                            >
                              <SiRockstargames size={18} /> Rockstar User ID
                            </label>
                            <Input
                              type="text"
                              value={rockstarUserId}
                              onChange={(e) =>
                                setRockstarUserId(e.target.value)
                              }
                              placeholder="Enter your Rockstar User ID"
                              className="p-4 border-none rounded-full"
                            />
                            <p
                              className="text-xs text-white/50 font-thin mt-1"
                            >
                              Find your Rockstar User ID at rockstar.com or
                              check your Rockstar profile URL
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Theme Step */}
                    {currentStep === "theme" && (
                      <div className="space-y-6 -mt-8">
                        <h2
                          className="text-2xl font-light mb-1"
                         
                        >
                          Change your look
                        </h2>
                        <p
                          className="text-white/60 font-thin mb-2"
                         
                        >
                          Choose your preferred colors. You can change these
                          anytime in settings.
                        </p>

                        <div className="flex items-start gap-4 -mb-4">
                          <Tabs defaultValue="accent" className="w-full">
                            <TabsList className="grid w-full grid-cols-5">
                              <TabsTrigger
                                value="accent"
                                className="text-sm font-thin"
                              >
                                Accent
                              </TabsTrigger>
                              <TabsTrigger
                                value="button"
                                className="text-sm font-thin"
                              >
                                Button
                              </TabsTrigger>
                              <TabsTrigger
                                value="buttonSecondary"
                                className="text-sm font-thin"
                              >
                                Button Secondary
                              </TabsTrigger>
                              <TabsTrigger
                                value="background"
                                className="text-sm font-thin"
                              >
                                Background
                              </TabsTrigger>
                              <TabsTrigger
                                value="panel"
                                className="text-sm font-thin"
                              >
                                Panel
                              </TabsTrigger>
                            </TabsList>

                            <TabsContent value="accent">
                              <ColorPicker
                                value={accentColor}
                                onChange={setAccentColor}
                              />
                            </TabsContent>

                            <TabsContent value="button">
                              <ColorPicker
                                value={buttonColor}
                                onChange={setButtonColor}
                              />
                            </TabsContent>

                            <TabsContent value="buttonSecondary">
                              <ColorPicker
                                value={buttonSecondaryColor}
                                onChange={setButtonSecondaryColor}
                              />
                            </TabsContent>

                            <TabsContent value="background">
                              <ColorPicker
                                value={backgroundColor}
                                onChange={setBackgroundColor}
                              />
                            </TabsContent>

                            <TabsContent value="panel">
                              <ColorPicker
                                value={panelColor}
                                onChange={setPanelColor}
                              />
                            </TabsContent>
                          </Tabs>
                          <div className="p-4 w-120 bg-white/5 rounded-lg border border-white/10">
                            <p
                              className="text-sm font-light mb-2"
                            >
                              Preview
                            </p>
                            <Card
                              className="p-0 rounded-lg w-full overflow-hidden"
                              style={{
                                backgroundColor: backgroundColor,
                                borderColor: panelColor,
                              }}
                            >
                              <div
                                className="flex-1 flex flex-row items-center gap-2 p-2"
                              >
                                <img
                                  src={logo}
                                  alt="PoliGame"
                                  className="w-6 h-6 invert dark:invert-0"
                                />
                                {/* Friends Dropdown */}
                                <div className="flex flex-row gap-0 ml-2">
                                  <div
                                    className="relative inline-block text-left no-drag-region"
                                    data-tauri-drag-region="false"
                                  >
                                    <DropdownMenu>
                                      <DropdownMenuTrigger>
                                        <button
                                          disabled
                                          type="button"
                                          className="px-3 pb-1 flex items-center gap-1 text-sm cursor-pointer text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                                          title="General"
                                        >
                                          General
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        className="z-[99] w-60 bg-muted border border-border overflow-hidden"
                                      >
                                        <div className="flex flex-col gap-1 p-2">
                                          {user && (
                                            <button
                                              className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                                              type="button"
                                            >
                                              Manage Account...
                                            </button>
                                          )}
                                          {user ? (
                                            <button
                                              className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                                              type="button"
                                            >
                                              Sign Out...
                                            </button>
                                          ) : (
                                            <button
                                              className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                                              type="button"
                                            >
                                              Sign In...
                                            </button>
                                          )}
                                          <div className="w-full h-px bg-foreground/10"></div>
                                          <button
                                            className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                                            type="button"
                                            onClick={() => { }}
                                          >
                                            Check For Updates
                                          </button>
                                          <button
                                            className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                                            type="button"
                                          >
                                            Exit
                                          </button>
                                        </div>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  {user && (
                                    <div
                                      className="relative inline-block text-left no-drag-region"
                                      data-tauri-drag-region="false"
                                    >
                                      <DropdownMenu>
                                        <DropdownMenuTrigger>
                                          <button
                                            disabled
                                            type="button"
                                            className="px-3 pb-1 flex items-center gap-1 text-sm cursor-pointer text-foreground/70 hover:text-foreground transition-colors"
                                            title="Friends"
                                          >
                                            Friends
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent
                                          className="z-[99] w-60 bg-muted border border-border overflow-hidden"
                                        >
                                          <div className="flex flex-col gap-1 p-2">
                                            <button
                                              className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                                              type="button"
                                            >
                                              View Friends
                                            </button>
                                          </div>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                  )}
                                  <div
                                    className="relative inline-block text-left no-drag-region"
                                    data-tauri-drag-region="false"
                                  >
                                    <DropdownMenu>
                                      <DropdownMenuTrigger>
                                        <button
                                          disabled
                                          type="button"
                                          className="px-3 pb-1 flex items-center gap-1 text-sm cursor-pointer text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                                          title="View"
                                        >
                                          View
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        className="z-[99] w-60 bg-muted border border-border overflow-hidden"
                                      >
                                        <div className="flex flex-col gap-1 p-2">
                                          <button
                                            className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                                            type="button"
                                          >
                                            Switch to Overdrive Mode
                                          </button>
                                          <button
                                            className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                                            type="button"
                                            onClick={() => {
                                              // handleOpenAccessibilitySettings();
                                            }}
                                          >
                                            Accessibility Settings
                                          </button>
                                        </div>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                  <div
                                    className="relative inline-block text-left no-drag-region"
                                    data-tauri-drag-region="false"
                                  >
                                    <DropdownMenu>
                                      <DropdownMenuTrigger>
                                        <button
                                          disabled
                                          type="button"
                                          className="px-3 pb-1 flex items-center gap-1 text-sm cursor-pointer text-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                                          title="Help"
                                        >
                                          Help
                                        </button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent
                                        className="z-[99] w-60 bg-muted border border-border overflow-hidden"
                                      >
                                        <div className="flex flex-col gap-1 p-2">
                                          <button
                                            className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                                            type="button"
                                            onClick={() => {
                                              // handleOpenHelp();
                                            }}
                                          >
                                            Help Center
                                          </button>
                                        </div>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                              </div>
                              <div className="p-2 -mt-3 w-full flex items-center justify-center">
                                <div
                                  className="w-fit rounded-full flex items-center gap-2 p-2"
                                  style={{ backgroundColor: panelColor }}
                                >
                                  <Link to="#">
                                    <Button
                                      onMouseEnter={() =>
                                        setPreviewButtonHovered(true)
                                      }
                                      onMouseLeave={() =>
                                        setPreviewButtonHovered(false)
                                      }
                                      style={{
                                        backgroundColor: previewButtonHovered
                                          ? buttonSecondaryColor
                                          : buttonColor,
                                        color: previewButtonHovered
                                          ? "white"
                                          : accentColor,
                                      }}
                                      variant="ghost"
                                      className={`p-3 flex flex-row items-center min-w-fit cursor-pointer border-none bg-transparent rounded-full`}
                                    >
                                      <span>
                                        <Library className="w-5 h-5" />
                                      </span>
                                      <span
                                        className={`font-light text-sm`}
                                      >
                                        Library
                                      </span>
                                    </Button>
                                  </Link>
                                </div>
                              </div>
                            </Card>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Profile Step */}
                    {currentStep === "profile" && (
                      <div className="space-y-6">
                        <h2
                          className="text-2xl font-light mb-2"
                         
                        >
                          Customise your profile
                        </h2>
                        <p
                          className="text-white/60 font-thin mb-4"
                         
                        >
                          Add a bio and avatar to personalize your profile.
                          These are optional.
                        </p>
                        <div>
                          <div className="flex items-center gap-4">
                            {avatar ? (
                              <div className="relative">
                                <img
                                  src={avatar}
                                  alt="Avatar"
                                  className="w-24 h-24 rounded-full object-cover border-2 border-white/20"
                                />
                                <button
                                  onClick={() => setAvatar(null)}
                                  className="absolute top-0 right-0 w-6 h-6 bg-red-500/50 backdrop-blur-lg rounded-full flex items-center justify-center"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center">
                                <User className="w-12 h-12 text-white/40" />
                              </div>
                            )}
                            <div>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleAvatarChange}
                                className="hidden"
                                id="avatar-upload"
                              />
                              <label htmlFor="avatar-upload">
                                <Button
                                  variant="default"
                                  className="border-none rounded-full"
                                  style={{
                                    backgroundColor: buttonColor,
                                    color: accentColor,
                                  }}
                                >
                                  <Upload className="w-4 h-4 mr-2" />
                                  Upload Avatar
                                </Button>
                              </label>
                              <p
                                className="text-xs font-thin text-white/50 mt-1"
                              >
                                Max 2MB
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <Label
                              className="block text-sm font-light mb-2 select-none"
                            >
                              Username
                            </Label>
                            <Input
                              type="text"
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              placeholder="Enter username"
                              className="rounded-full border-none"
                            />
                          </div>

                          <div>
                            <Label
                              className="block text-sm font-light mb-2 select-none"
                            >
                              Bio
                            </Label>
                            <Textarea
                              value={bio}
                              onChange={(e) => setBio(e.target.value)}
                              placeholder="Tell us about yourself..."
                              rows={4}
                              className="w-full rounded-lg border-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scanning Step */}
                    {currentStep === "scanning" && (() => {
                      const LAUNCHERS = [
                        { key: "steam", label: "Steam", icon: <FaSteam className="w-5 h-5" /> },
                        { key: "epic", label: "Epic Games", icon: <SiEpicgames className="w-5 h-5" /> },
                        { key: "ea", label: "EA", icon: <TbBrandElectronicArts className="w-5 h-5" /> },
                        { key: "rockstar", label: "Rockstar Games", icon: <SiRockstargames className="w-5 h-5" /> },
                      ];
                      return (
                        <div className="space-y-6">
                          <div>
                            <h2 className="text-xl font-light">
                              {scanPhase === "done"
                                ? "Library scan complete."
                                : "Scanning your game library..."}
                            </h2>
                            <p className="text-sm text-white/60 font-thin mt-1">
                              {scanPhase === "done"
                                ? `Found ${totalGamesFound} game${totalGamesFound !== 1 ? "s" : ""} across your launchers.`
                                : "This may take a moment while we find your games."}
                            </p>
                          </div>

                          <div className="space-y-2">
                            {LAUNCHERS.map(({ key, label, icon }) => {
                              const status = detectedLaunchers.find(
                                (s) => s.launcher_type === key,
                              );
                              const isInstalled =
                                detectedLaunchers.length === 0 || (status?.installed ?? false);
                              const count = scanCounts[key] ?? 0;

                              return (
                                <div
                                  key={key}
                                  className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                                >
                                  <div className="text-white/50">{icon}</div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-light">{label}</div>
                                    <div className="text-xs text-white/50 font-thin">
                                      {!isInstalled
                                        ? "Not installed"
                                        : scanPhase === "scanning"
                                          ? "Scanning..."
                                          : `${count} game${count !== 1 ? "s" : ""} found`}
                                    </div>
                                  </div>
                                  <div className="shrink-0">
                                    {!isInstalled ? (
                                      <div className="w-2 h-2 rounded-full bg-white/20" />
                                    ) : scanPhase === "scanning" ? (
                                      <div
                                        className="w-2 h-2 rounded-full animate-pulse"
                                        style={{
                                          backgroundColor: accentColor,
                                          boxShadow: `0 0 8px ${accentColor}`,
                                        }}
                                      />
                                    ) : (
                                      <CheckCircle2
                                        className="w-4 h-4"
                                        style={{ color: accentColor }}
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {scanPhase === "done" && (
                            <Button
                              onClick={() => setCurrentStep("complete")}
                              variant="default"
                              className="w-full rounded-full border-none cursor-pointer"
                              style={{
                                backgroundColor: buttonColor,
                                color: accentColor,
                              }}
                            >
                              Continue
                              <ArrowRight className="w-4 h-4 ml-2" />
                            </Button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Complete Step */}
                    {currentStep === "complete" && (
                      <div className="text-center space-y-6">
                        <CheckCircle2
                          className="w-20 h-20 mx-auto"
                          style={{ color: accentColor }}
                        />
                        <h2
                          className="text-3xl font-light"
                         
                        >
                          You're ready to play.
                        </h2>
                        <p
                          className="text-white/80 text-lg font-thin"
                         
                        >
                          You're all set! Let's get you into some games.
                        </p>
                        <Button
                          onClick={async () => {
                            try {
                              await invoke("set_setup_complete", {
                                completed: true,
                              });
                              console.log(
                                "Setup marked as complete, navigating to home...",
                              );
                              window.location.reload();
                            } catch (error) {
                              console.error("Failed to complete setup:", error);
                              window.location.reload();
                            }
                          }}
                          variant="default"
                          className="mt-6 rounded-full border-none"
                          style={{
                            backgroundColor: buttonColor,
                            color: accentColor,
                          }}
                        >
                          Get Started
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Navigation */}
                {currentStep !== "complete" && currentStep !== "scanning" && (
                  <div className="p-6 flex items-center justify-between">
                    <Button
                      onClick={handleBack}
                      disabled={currentStepIndex === 0}
                      variant="outline"
                      style={{
                        backgroundColor: buttonSecondaryColor,
                        color: accentColor,
                      }}
                      className={cn(
                        "rounded-full border-none",
                        currentStepIndex === 0
                          ? "opacity-50 cursor-not-allowed"
                          : "cursor-pointer",
                      )}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>

                    <div className="text-sm text-white/60">
                      Step {currentStepIndex + 1} of {steps.length - 2}
                    </div>

                    <Button
                      onClick={
                        currentStep === "profile" ? handleComplete : handleNext
                      }
                      disabled={!canGoNext() || isSaving}
                      variant="default"
                      className="rounded-full border-none cursor-pointer"
                      style={{
                        backgroundColor: buttonColor,
                        color: accentColor,
                      }}
                    >
                      {currentStep === "profile" ? (
                        isSaving ? (
                          "Saving..."
                        ) : (
                          "Complete Setup"
                        )
                      ) : (
                        <>
                          Next
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-white/10 z-10 absolute bottom-0 left-0 overflow-hidden">
          <div
            className="h-full transition-all rounded-full duration-300"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(to right, ${themeColors.accent}, ${themeColors.button})`,
            }}
          />
        </div>
      </div>
    );
  }
};
