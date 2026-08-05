import React, { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { MicaButton } from "@/components/MicaButton";
import { MicaInput } from "@/components/MicaInput";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { useTheme } from "next-themes";
import { FaSteam } from "react-icons/fa";
import { User, X, Palette, Minus, Square, Moon, Sun, Monitor } from "lucide-react";

export const AccountDetails: React.FC = () => {
  const { user, setUser } = useAuthStore();
  const { colors: themeColors, setColors: setThemeColors, resetTheme, mode: themeMode, setMode: setThemeMode } = useThemeStore();
  const { setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<"profile" | "customization">("profile");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [steamUserId, setSteamUserId] = useState("");
  const [epicUserId, setEpicUserId] = useState("");
  const [eaUserId, setEaUserId] = useState("");
  const [rockstarUserId, setRockstarUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme color states
  const [accentColor, setAccentColor] = useState(themeColors.accent);
  const [buttonColor, setButtonColor] = useState(themeColors.button);
  const [buttonSecondaryColor, setButtonSecondaryColor] = useState(themeColors.buttonSecondary || themeColors.accent);
  const [backgroundColor, setBackgroundColor] = useState(themeColors.background);
  const [panelColor, setPanelColor] = useState(themeColors.panel);

  const updateProfile = useMutation(api.user.updateUserProfile);

  // Load user data when component mounts
  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
      setBio(user.bio || "");
      setAvatar(user.avatar || null);
      setSteamUserId(user.steamUserId || "");
      setEpicUserId(user.epicUserId || "");
      setEaUserId(user.eaUserId || "");
      setRockstarUserId(user.rockstarUserId || "");
    }
  }, [user]);

  // Load theme colors when component mounts and when theme changes
  useEffect(() => {
    setAccentColor(themeColors.accent);
    setButtonColor(themeColors.button);
    setButtonSecondaryColor(themeColors.buttonSecondary || themeColors.accent);
    setBackgroundColor(themeColors.background);
    setPanelColor(themeColors.panel);
  }, [themeColors.accent, themeColors.button, themeColors.buttonSecondary, themeColors.background, themeColors.panel]);

  if (!user) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-black text-white">
        <div>Please sign in to view account details.</div>
      </div>
    );
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        setError("Avatar image must be less than 2MB");
        return;
      }

      // Check file type
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setAvatar(base64String);
        setError(null);
      };
      reader.onerror = () => {
        setError("Failed to read image file");
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatar(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      // Convert string userId to Id<"users">
      const userId = user.userId as unknown as Id<"users">;
      const result = await updateProfile({
        userId,
        username: username || undefined,
        avatar: avatar || undefined,
        bio: bio || undefined,
        steamUserId: steamUserId || undefined,
        epicUserId: epicUserId || undefined,
        eaUserId: eaUserId || undefined,
        rockstarUserId: rockstarUserId || undefined,
      });

      // Update local user state
      setUser({
        ...user,
        username: result.username,
        avatar: result.avatar,
        bio: result.bio,
        steamUserId: result.steamUserId,
        epicUserId: result.epicUserId,
        eaUserId: result.eaUserId,
        rockstarUserId: result.rockstarUserId,
      });

      // Close the window after successful save
      try {
        await invoke("close_account_details_window");
      } catch (err) {
        console.error("Error closing account details window:", err);
      }
    } catch (err: any) {
      setError(err.message || "Failed to update account details");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = async () => {
    try {
      await invoke("close_account_details_window");
    } catch (err) {
      console.error("Error closing account details window:", err);
    }
  };

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("minimize_account_details_window");
    } catch (error) {
      console.debug("Window controls not available", error);
    }
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("toggle_maximize_account_details_window");
    } catch (error) {
      console.debug("Window controls not available", error);
    }
  };

  return (
    <div
      className="w-full h-screen text-white overflow-hidden flex flex-col"
      style={{
        backgroundColor: "var(--theme-background)",
      }}
    >
      {/* Custom Titlebar */}
      <div 
        className="flex items-center justify-between px-4 py-2 border-b drag-region"
        style={{ 
          backgroundColor: 'var(--theme-background)',
          borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        <div className="flex items-center gap-2 drag-region">
          <h1 className="text-lg font-semibold text-white">Account Details</h1>
        </div>
        <div className="flex gap-1 no-drag-region">
          <button
            onClick={handleMinimize}
            className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
            type="button"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={handleMaximize}
            className="p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
            type="button"
          >
            <Square size={14} />
          </button>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-red-500/20 rounded transition-colors cursor-pointer"
            type="button"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="w-full max-w-6xl mx-auto p-4">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 mb-4">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "profile"
                ? "text-white border-b-2"
                : "text-white/60 hover:text-white"
            }`}
            style={activeTab === "profile" ? { borderBottomColor: "var(--theme-accent)" } : {}}
          >
            <User size={16} className="inline mr-1" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab("customization")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === "customization"
                ? "text-white border-b-2"
                : "text-white/60 hover:text-white"
            }`}
            style={activeTab === "customization" ? { borderBottomColor: "var(--theme-accent)" } : {}}
          >
            <Palette size={16} className="inline mr-1" />
            Customization
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "profile" && (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
          {/* Avatar Section */}
          <div className="flex flex-col items-center gap-4 pb-4 border-b border-white/10">
            <div className="relative">
              {avatar ? (
                <img
                  src={avatar}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full object-cover border-2 border-white/20"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center">
                  <User size={32} className="text-white/60" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 items-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
                id="avatar-upload"
              />
              <div className="flex gap-2">
                <MicaButton
                  type="button"
                  variant="default"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm"
                >
                  {avatar ? "Change Avatar" : "Upload Avatar"}
                </MicaButton>
                {avatar && (
                  <MicaButton
                    type="button"
                    variant="default"
                    onClick={handleRemoveAvatar}
                    className="text-sm"
                  >
                    Remove
                  </MicaButton>
                )}
              </div>
              <p className="text-xs text-white/50">Max 2MB, JPG/PNG</p>
            </div>
          </div>

          {/* Basic Info */}
          <div>
            <label className="text-sm text-white/80 mb-1 block">Email</label>
            <MicaInput
              type="email"
              value={user.email}
              disabled
              className="w-full opacity-60 cursor-not-allowed"
            />
            <p className="text-xs text-white/50 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="text-sm text-white/80 mb-1 block">Username</label>
            <MicaInput
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="w-full"
            />
          </div>

          <div>
            <label className="text-sm text-white/80 mb-1 block">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder:text-white/50 resize-none focus:outline-none focus:border-white/40 transition-colors"
            />
          </div>

          {/* Launcher User IDs */}
          <div className="border-t border-white/10 pt-4 mt-2">
            <h3 className="text-md font-semibold text-white mb-3">Launcher User IDs</h3>
            
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-sm text-white/80 mb-1 block flex items-center gap-2">
                  <FaSteam size={14} />
                  Steam User ID
                </label>
                <MicaInput
                  type="text"
                  value={steamUserId}
                  onChange={(e) => setSteamUserId(e.target.value)}
                  placeholder="Enter your Steam user ID"
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm text-white/80 mb-1 block">Epic Games User ID</label>
                <MicaInput
                  type="text"
                  value={epicUserId}
                  onChange={(e) => setEpicUserId(e.target.value)}
                  placeholder="Enter your Epic Games user ID"
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm text-white/80 mb-1 block">EA/Origin User ID</label>
                <MicaInput
                  type="text"
                  value={eaUserId}
                  onChange={(e) => setEaUserId(e.target.value)}
                  placeholder="Enter your EA user ID"
                  className="w-full"
                />
              </div>

              <div>
                <label className="text-sm text-white/80 mb-1 block">Rockstar User ID</label>
                <MicaInput
                  type="text"
                  value={rockstarUserId}
                  onChange={(e) => setRockstarUserId(e.target.value)}
                  placeholder="Enter your Rockstar user ID"
                  className="w-full"
                />
              </div>
            </div>
          </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-500/20 border border-red-500/50 rounded p-2">
                {error}
              </div>
            )}

            <div className="flex flex-row gap-2 justify-end mt-4">
              <MicaButton type="submit" variant="primary" disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Changes"}
              </MicaButton>
            </div>
          </form>
        )}

        {activeTab === "customization" && (
          <div className="flex flex-col gap-6">
            {/* Theme Mode Selection */}
            <div>
              <h3 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
                {themeMode === "light" && <Sun size={16} />}
                {themeMode === "dark" && <Moon size={16} />}
                {themeMode === "system" && <Monitor size={16} />}
                Appearance
              </h3>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm text-white/80 mb-1 block">Theme Mode</label>
                <select
                  value={themeMode}
                  onChange={(e) => {
                    const newMode = e.target.value as "light" | "dark" | "system";
                    setThemeMode(newMode);
                    setTheme(newMode);
                  }}
                  className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded text-white focus:outline-none focus:border-white/40 transition-colors cursor-pointer"
                  style={{ color: "white" }}
                >
                  <option value="light" style={{ background: "var(--theme-background)", color: "white" }}>
                    ☀️ Light
                  </option>
                  <option value="dark" style={{ background: "var(--theme-background)", color: "white" }}>
                    🌙 Dark
                  </option>
                  <option value="system" style={{ background: "var(--theme-background)", color: "white" }}>
                    💻 System
                  </option>
                </select>
                <p className="text-xs text-white/50 mt-1">
                  {themeMode === "system" && "Uses your system's theme preference"}
                  {themeMode === "light" && "Always use light mode"}
                  {themeMode === "dark" && "Always use dark mode"}
                </p>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <h3 className="text-md font-semibold text-white mb-3 flex items-center gap-2">
                <Palette size={16} />
                Theme Colors
              </h3>
              
              <div className="flex flex-col gap-3">
                <div>
                  <label className="text-sm text-white/80 mb-1 block">Accent Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <MicaInput
                      type="text"
                      value={accentColor}
                      onChange={(e) => setAccentColor(e.target.value)}
                      placeholder="#4CE4B1"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-white/80 mb-1 block">Button Color (Primary)</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={buttonColor}
                      onChange={(e) => setButtonColor(e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <MicaInput
                      type="text"
                      value={buttonColor}
                      onChange={(e) => setButtonColor(e.target.value)}
                      placeholder="#006B4F"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-white/80 mb-1 block">Button Color (Secondary - for gradients)</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={buttonSecondaryColor}
                      onChange={(e) => setButtonSecondaryColor(e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <MicaInput
                      type="text"
                      value={buttonSecondaryColor}
                      onChange={(e) => setButtonSecondaryColor(e.target.value)}
                      placeholder="#4CE4B1"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-white/80 mb-1 block">Background Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <MicaInput
                      type="text"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      placeholder="#111827"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm text-white/80 mb-1 block">Panel Color</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="color"
                      value={panelColor}
                      onChange={(e) => setPanelColor(e.target.value)}
                      className="w-12 h-10 rounded cursor-pointer"
                    />
                    <MicaInput
                      type="text"
                      value={panelColor}
                      onChange={(e) => setPanelColor(e.target.value)}
                      placeholder="#1F2937"
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="flex gap-2 mt-2">
                  <MicaButton
                    type="button"
                    variant="primary"
                    onClick={() => {
                      setThemeColors({
                        accent: accentColor,
                        button: buttonColor,
                        buttonSecondary: buttonSecondaryColor,
                        background: backgroundColor,
                        panel: panelColor,
                      });
                    }}
                    className="text-sm"
                  >
                    Apply Theme
                  </MicaButton>
                  <MicaButton
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      resetTheme();
                    }}
                    className="text-sm"
                  >
                    Reset to Defaults
                  </MicaButton>
                </div>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

