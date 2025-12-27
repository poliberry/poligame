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
  VolumeX
} from "lucide-react";
// @ts-ignore
import logo from "@/public/poligame-logo.svg";
// @ts-ignore
import welcomeVideo from "@/public/video/loader-video.mp4";
// @ts-ignore
import welcomeAudio from "@/public/setup-music.wav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SiEpicgames, SiRockstargames } from "react-icons/si";
import { TbBrandElectronicArts } from "react-icons/tb";
import { Textarea } from "@/components/ui/textarea";

type SetupStep = "welcome" | "auth" | "userIds" | "theme" | "profile" | "complete";

export const Setup: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<SetupStep>("welcome");
  const { user, setUser, setLoading: setAuthLoading } = useAuthStore();
  const { colors: themeColors, setColors: setThemeColors } = useThemeStore();
  const [isMainWindow, setIsMainWindow] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
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
  const [buttonSecondaryColor, setButtonSecondaryColor] = useState(themeColors.buttonSecondary || themeColors.accent);
  const [backgroundColor, setBackgroundColor] = useState(themeColors.background);
  const [panelColor, setPanelColor] = useState(themeColors.panel);

  // Profile state
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
  }, []);

  // Play video when main window is refocused
  useEffect(() => {
    if (!isMainWindow) return;

    const handleFocus = async () => {
      const video = videoRef.current;
      if (video && !isCompleteRef.current && (video.paused || video.ended)) {
        try {
          if (video.ended) {
            video.currentTime = 0;
          }
          await video.play();
        } catch (error) {
          console.error("Error playing video on focus:", error);
        }
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [isMainWindow]);

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
      // Small delay to ensure state is updated
      setTimeout(() => {
        setCurrentStep("userIds");
      }, 100);
    }
  }, [user, currentStep]);

  // Ensure video keeps playing and looping until setup is complete
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isComplete = currentStep === "complete";
    isCompleteRef.current = isComplete;

    // Stop video when setup is complete
    if (isComplete) {
      video.pause();
      return;
    }

    // Ensure video is playing
    const playVideo = async () => {
      try {
        if (video.paused || video.ended) {
          if (video.ended) {
            video.currentTime = 0;
          }
          await video.play();
        }
      } catch (error) {
        console.error("Error playing video:", error);
      }
    };

    // Initial play
    playVideo();

    // Handle video end to ensure it loops
    const handleEnded = () => {
      if (!isCompleteRef.current) {
        video.currentTime = 0;
        video.play().catch(console.error);
      }
    };

    // Handle video pause to resume it
    const handlePause = () => {
      // Only resume if setup is not complete
      if (!isCompleteRef.current) {
        video.play().catch(console.error);
      }
    };

    // Handle when video stops playing for any reason
    const handleStop = () => {
      if (!isCompleteRef.current && (video.paused || video.ended)) {
        playVideo();
      }
    };

    // Periodic check to ensure video is playing (every 2 seconds)
    const playCheckInterval = setInterval(() => {
      if (!isCompleteRef.current && (video.paused || video.ended)) {
        playVideo();
      }
    }, 2000);

    video.addEventListener("ended", handleEnded);
    video.addEventListener("pause", handlePause);
    video.addEventListener("suspend", handleStop);
    video.addEventListener("stalled", handleStop);
    video.addEventListener("waiting", handleStop);

    return () => {
      clearInterval(playCheckInterval);
      video.removeEventListener("ended", handleEnded);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("suspend", handleStop);
      video.removeEventListener("stalled", handleStop);
      video.removeEventListener("waiting", handleStop);
    };
  }, [currentStep]);

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
      await invoke("set_setup_complete");

      setCurrentStep("complete");
    } catch (error: any) {
      console.error("Failed to save setup:", error);
      alert(error.message || "Failed to save setup");
    } finally {
      setIsSaving(false);
    }
  };

  const steps: { key: SetupStep; title: string; description: string }[] = [
    { key: "welcome", title: "Welcome", description: "Get started with PoliGame" },
    { key: "auth", title: "Account", description: "Sign up or sign in" },
    { key: "userIds", title: "User IDs", description: "Configure your launcher IDs" },
    { key: "theme", title: "Theme", description: "Customize your colors" },
    { key: "profile", title: "Profile", description: "Set up your profile" },
    { key: "complete", title: "Complete", description: "You're all set!" },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);
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
    if (currentStep === "profile") {
      handleComplete();
    } else {
      const nextIndex = currentStepIndex + 1;
      if (nextIndex < steps.length) {
        setCurrentStep(steps[nextIndex].key);
      }
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(steps[prevIndex].key);
    }
  };

  return (
    <div className="w-full h-screen text-white flex flex-col drag-region">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Livvic:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,900&family=Unbounded:wght@200..900&display=swap" rel="stylesheet"></link>
      <video 
        ref={videoRef}
        src={welcomeVideo} 
        autoPlay 
        loop 
        playsInline 
        muted
        preload="auto"
        className="w-full h-full object-cover absolute top-0 left-0 z-0" 
      />
      <div className="w-full h-full z-10 bg-black/50 backdrop-blur-sm absolute top-0 left-0">
        <div className="absolute top-4 right-4 flex items-center gap-3">
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
          <X size={20} className="text-white cursor-pointer hover:opacity-80 transition-opacity" onClick={() => {
            invoke("close_setup_window");
          }} />
        </div>

        <div className="flex flex-col items-center justify-center w-full h-full">
          {isMainWindow && (
            <audio 
              ref={audioRef}
              src={welcomeAudio} 
              autoPlay 
              loop 
              onLoadedMetadata={() => {
                if (audioRef.current) {
                  setIsAudioMuted(audioRef.current.muted);
                }
              }}
            />
          )}
          <Card className="no-drag-region dark p-0 min-w-3xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 select-none">
              <div className="flex items-center gap-4">
                <img src={logo} alt="Logo" width={40} height={40} />
                <div>
                  <h1 className="text-xl font-bold uppercase italic" style={{ fontFamily: 'Unbounded, sans-serif' }}>
                    PoliGame Setup
                  </h1>
                  <p className="text-sm text-white/60">{steps[currentStepIndex].description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {steps.map((step, index) => (
                  <div
                    key={step.key}
                    className={`w-2 h-2 rounded-full transition-all ${index <= currentStepIndex
                      ? "bg-[var(--theme-accent)]"
                      : "bg-white/20"
                      }`}
                  />
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8">
              <div className="max-w-2xl mx-auto">
                {/* Welcome Step */}
                {currentStep === "welcome" && (
                  <div className="text-left space-y-3 select-none">
                    <h2 className="text-xl font-bold uppercase italic" style={{ fontFamily: 'Unbounded, sans-serif' }}>
                      The future of gaming.
                    </h2>
                    <p className="text-white/80 text-sm" style={{ fontFamily: 'Livvic, sans-serif' }}>
                      Let's get you set up in just a few steps. We'll help you configure your account,
                      launcher IDs, theme, and profile.
                    </p>
                    <div className="flex flex-col gap-4 mt-8">
                      <div className="p-4 flex flex-row items-center gap-2">
                        <User className="w-8 h-8" style={{ color: themeColors.accent }} />
                        <div className="flex flex-col">
                          <h3 className="font-semibold uppercase italic" style={{ fontFamily: 'Unbounded, sans-serif' }}>Account Setup</h3>
                          <p className="text-sm text-white/60" style={{ fontFamily: 'Livvic, sans-serif' }}>Sign up or sign in</p>
                        </div>
                      </div>
                      <div className="p-4 flex flex-row items-center gap-2">
                        <Palette className="w-8 h-8" style={{ color: themeColors.accent }} />
                        <div className="flex flex-col">
                          <h3 className="font-semibold uppercase italic" style={{ fontFamily: 'Unbounded, sans-serif' }}>Customization</h3>
                          <p className="text-sm text-white/60" style={{ fontFamily: 'Livvic, sans-serif' }}>Theme & profile</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Auth Step */}
                {currentStep === "auth" && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold uppercase italic mb-6" style={{ fontFamily: 'Unbounded, sans-serif' }}>
                      {authMode === "signup" ? "Create Account" : "Sign In"}
                    </h2>

                    <form onSubmit={handleAuthSubmit} className="space-y-4">
                      {authMode === "signup" && (
                        <div>
                          <Label className="text-sm font-medium mb-2 select-none" style={{ fontFamily: 'Livvic, sans-serif' }}>Username (optional)</Label>
                          <Input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                          />
                        </div>
                      )}

                      <div>
                        <Label className="text-sm font-medium mb-2 select-none" style={{ fontFamily: 'Livvic, sans-serif' }}>Email</Label>
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Enter your email"
                          required
                        />
                      </div>

                      <div>
                        <Label className="text-sm font-medium mb-2 select-none" style={{ fontFamily: 'Livvic, sans-serif' }}>Password</Label>
                        <Input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          required
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
                            setAuthMode(authMode === "signin" ? "signup" : "signin");
                            setAuthError(null);
                          }}
                          variant="outline"
                        >
                          {authMode === "signin"
                            ? "Don't have an account? Sign up"
                            : "Already have an account? Sign in"}
                        </Button>
                        <Button
                          type="submit"
                          variant="default"
                          disabled={isAuthLoading}
                        >
                          {isAuthLoading ? "Please wait..." : authMode === "signin" ? "Sign In" : "Sign Up"}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}

                {/* User IDs Step */}
                {currentStep === "userIds" && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold uppercase italic mb-6" style={{ fontFamily: 'Unbounded, sans-serif' }}>
                      Configure User IDs
                    </h2>
                    <p className="text-white/60 mb-6" style={{ fontFamily: 'Livvic, sans-serif' }}>
                      Enter your launcher user IDs to enable features like achievements and game tracking.
                      These are optional and can be configured later.
                    </p>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2 flex items-center gap-2" style={{ fontFamily: 'Livvic, sans-serif' }}>
                          <FaSteam className="w-4 h-4" />
                          Steam User ID
                        </label>
                        <Input
                          type="text"
                          value={steamUserId}
                          onChange={(e) => setSteamUserId(e.target.value)}
                          placeholder="Enter your Steam User ID (64-bit)"
                        />
                        <p className="text-xs text-white/50 mt-1" style={{ fontFamily: 'Livvic, sans-serif' }}>
                          Find your Steam ID at steamid.io or check your Steam profile URL
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 flex items-center gap-2" style={{ fontFamily: 'Livvic, sans-serif' }}><SiEpicgames size={18} /> Epic Games User ID</label>
                        <Input
                          type="text"
                          value={epicUserId}
                          onChange={(e) => setEpicUserId(e.target.value)}
                          placeholder="Enter your Epic Games User ID"
                        />
                        <p className="text-xs text-white/50 mt-1" style={{ fontFamily: 'Livvic, sans-serif' }}>Find your Epic Games ID at epicgames.com or check your Epic Games profile URL</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 flex items-center gap-2" style={{ fontFamily: 'Livvic, sans-serif' }}><TbBrandElectronicArts size={18} /> EA User ID</label>
                        <Input
                          type="text"
                          value={eaUserId}
                          onChange={(e) => setEaUserId(e.target.value)}
                          placeholder="Enter your EA User ID"
                        />
                        <p className="text-xs text-white/50 mt-1" style={{ fontFamily: 'Livvic, sans-serif' }}>Find your EA User ID at ea.com or check your EA profile URL</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2 flex items-center gap-2" style={{ fontFamily: 'Livvic, sans-serif' }}><SiRockstargames size={18} /> Rockstar User ID</label>
                        <Input
                          type="text"
                          value={rockstarUserId}
                          onChange={(e) => setRockstarUserId(e.target.value)}
                          placeholder="Enter your Rockstar User ID"
                        />
                        <p className="text-xs text-white/50 mt-1" style={{ fontFamily: 'Livvic, sans-serif' }}>Find your Rockstar User ID at rockstar.com or check your Rockstar profile URL</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Theme Step */}
                {currentStep === "theme" && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold uppercase italic mb-6" style={{ fontFamily: 'Unbounded, sans-serif' }}>
                      Customize Theme
                    </h2>
                    <p className="text-white/60 mb-6" style={{ fontFamily: 'Livvic, sans-serif' }}>
                      Choose your preferred colors. You can change these anytime in settings.
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="block text-sm font-medium mb-2 select-none" style={{ fontFamily: 'Livvic, sans-serif' }}>Accent Color</Label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={accentColor}
                            onChange={(e) => setAccentColor(e.target.value)}
                            className="w-16 h-10 rounded border border-white/20 cursor-pointer"
                          />
                          <Input
                            type="text"
                            value={accentColor}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccentColor(e.target.value)}
                            placeholder="#4CE4B1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="block text-sm font-medium mb-2 select-none" style={{ fontFamily: 'Livvic, sans-serif' }}>Button Color</Label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={buttonColor}
                            onChange={(e) => setButtonColor(e.target.value)}
                            className="w-16 h-10 rounded border border-white/20 cursor-pointer"
                          />
                          <Input
                            type="text"
                            value={buttonColor}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setButtonColor(e.target.value)}
                            placeholder="#006B4F"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="block text-sm font-medium mb-2 select-none" style={{ fontFamily: 'Livvic, sans-serif' }}>Button Secondary</Label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={buttonSecondaryColor}
                            onChange={(e) => setButtonSecondaryColor(e.target.value)}
                            className="w-16 h-10 rounded border border-white/20 cursor-pointer"
                          />
                          <Input
                            type="text"
                            value={buttonSecondaryColor}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setButtonSecondaryColor(e.target.value)}
                            placeholder="#4CE4B1"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="block text-sm font-medium mb-2 select-none" style={{ fontFamily: 'Livvic, sans-serif' }}>Background</Label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={backgroundColor}
                            onChange={(e) => setBackgroundColor(e.target.value)}
                            className="w-16 h-10 rounded border border-white/20 cursor-pointer"
                          />
                          <Input
                            type="text"
                            value={backgroundColor}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBackgroundColor(e.target.value)}
                            placeholder="#111827"
                          />
                        </div>
                      </div>

                      <div>
                        <Label className="block text-sm font-medium mb-2 select-none" style={{ fontFamily: 'Livvic, sans-serif' }}>Panel</Label>
                        <div className="flex gap-2">
                          <input
                            type="color"
                            value={panelColor}
                            onChange={(e) => setPanelColor(e.target.value)}
                            className="w-16 h-10 rounded border border-white/20 cursor-pointer"
                          />
                          <Input
                            type="text"
                            value={panelColor}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPanelColor(e.target.value)}
                            placeholder="#1F2937"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
                      <p className="text-sm font-medium mb-2" style={{ fontFamily: 'Livvic, sans-serif' }}>Preview</p>
                      <div className="flex gap-2">
                        <div
                          className="px-4 py-2 rounded text-sm font-semibold"
                          style={{
                            background: `linear-gradient(to bottom right, ${buttonColor}, ${buttonSecondaryColor})`,
                          }}
                        >
                          Button
                        </div>
                        <div
                          className="px-4 py-2 rounded text-sm"
                          style={{ color: accentColor, border: `1px solid ${accentColor}` }}
                        >
                          Accent
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Profile Step */}
                {currentStep === "profile" && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold uppercase italic mb-6" style={{ fontFamily: 'Unbounded, sans-serif' }}>
                      Complete Your Profile
                    </h2>
                    <p className="text-white/60 mb-6" style={{ fontFamily: 'Livvic, sans-serif' }}>
                      Add a bio and avatar to personalize your profile. These are optional.
                    </p>
                    <div>
                        <Label className="block text-sm font-medium mb-2 select-none" style={{ fontFamily: 'Livvic, sans-serif' }}>Avatar</Label>
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
                                className="absolute top-0 right-0 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center"
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
                              <Button variant="default">
                                <Upload className="w-4 h-4 mr-2" />
                                Upload Avatar
                              </Button>
                            </label>
                            <p className="text-xs text-white/50 mt-1" style={{ fontFamily: 'Livvic, sans-serif' }}>Max 2MB</p>
                          </div>
                        </div>
                      </div>
                    <div className="space-y-4">
                      <div>
                        <Label className="block text-sm font-medium mb-2 select-none" style={{ fontFamily: 'Livvic, sans-serif' }}>Username</Label>
                        <Input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          placeholder="Enter username"
                        />
                      </div>

                      <div>
                        <Label className="block text-sm font-medium mb-2 select-none" style={{ fontFamily: 'Livvic, sans-serif' }}>Bio</Label>
                        <Textarea
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          placeholder="Tell us about yourself..."
                          rows={4}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Complete Step */}
                {currentStep === "complete" && (
                  <div className="text-center space-y-6">
                    <CheckCircle2 className="w-20 h-20 mx-auto" style={{ color: themeColors.accent }} />
                    <h2 className="text-3xl font-bold uppercase italic" style={{ fontFamily: 'Unbounded, sans-serif' }}>
                      Setup Complete!
                    </h2>
                    <p className="text-white/80 text-lg" style={{ fontFamily: 'Livvic, sans-serif' }}>
                      You're all set! Welcome to PoliGame. You can start exploring your game library now.
                    </p>
                     <Button
                       onClick={async () => {
                         try {
                           // Ensure setup is marked as complete (handleComplete already did this, but double-check)
                           await invoke("set_setup_complete");
                           console.log("Setup marked as complete, navigating to home...");
                           // Wait a moment to ensure file is written to disk
                           await new Promise(resolve => setTimeout(resolve, 200));
                           // Force a full page reload to ensure AppShell re-checks setup
                           window.location.reload();
                         } catch (error) {
                           console.error("Failed to complete setup:", error);
                           // Still navigate even if there's an error
                           window.location.reload();
                         }
                       }}
                       variant="default"
                       className="mt-6"
                     >
                       Get Started
                     </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Navigation */}
            {currentStep !== "complete" && (
              <div className="border-t border-white/10 p-6 flex items-center justify-between">
                <Button
                  onClick={handleBack}
                  disabled={currentStepIndex === 0}
                  variant="outline"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>

                <div className="text-sm text-white/60">
                  Step {currentStepIndex + 1} of {steps.length - 1}
                </div>

                <Button
                  onClick={handleNext}
                  disabled={!canGoNext() || isSaving}
                  variant="default"
                >
                  {currentStep === "profile" ? (
                    isSaving ? "Saving..." : "Complete Setup"
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

      {/* Progress Bar */}
      <div className="w-full h-1 bg-white/10 z-10 absolute bottom-0 left-0">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${progress}%`,
            background: `linear-gradient(to right, ${themeColors.accent}, ${themeColors.button})`
          }}
        />
      </div>
    </div>
  );
};

