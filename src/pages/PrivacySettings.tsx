import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuthStore } from "@/stores/authStore";
import { MicaCard } from "@/components/MicaCard";
import { MicaButton } from "@/components/MicaButton";
import { Shield, Save } from "lucide-react";

const PrivacySettings: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const privacySettings = useQuery(
    api.privacy.getPrivacySettings,
    user?.userId ? { userId: user.userId as unknown as Id<"users"> } : "skip"
  );
  const updatePrivacy = useMutation(api.privacy.updatePrivacySettings);

  const [settings, setSettings] = useState({
    profileVisibility: "public" as "public" | "friends" | "private",
    showGameActivity: true,
    showRecentlyPlayed: true,
    showLibrary: true,
    showFriends: true,
    showOnlineStatus: true,
    allowFriendRequests: true,
    allowMessages: "everyone" as "everyone" | "friends" | "none",
  });

  // Update local state when privacy settings load
  React.useEffect(() => {
    if (privacySettings) {
      setSettings({
        profileVisibility: privacySettings.profileVisibility as "public" | "friends" | "private",
        showGameActivity: privacySettings.showGameActivity,
        showRecentlyPlayed: privacySettings.showRecentlyPlayed ?? true,
        showLibrary: privacySettings.showLibrary ?? true,
        showFriends: privacySettings.showFriends ?? true,
        showOnlineStatus: privacySettings.showOnlineStatus,
        allowFriendRequests: privacySettings.allowFriendRequests,
        allowMessages: privacySettings.allowMessages as "everyone" | "friends" | "none",
      });
    }
  }, [privacySettings]);

  const handleSave = async () => {
    if (!user?.userId) return;

    try {
      await updatePrivacy({
        userId: user.userId as unknown as Id<"users">,
        privacySettings: settings,
      });
      alert("Privacy settings saved!");
    } catch (error: any) {
      console.error("Failed to save privacy settings:", error);
      alert(error.message || "Failed to save privacy settings");
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-white/60">Please sign in to access privacy settings</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Shield size={24} />
        <h1 className="text-2xl font-bold">Privacy Settings</h1>
      </div>

      <MicaCard className="p-6">
        <h2 className="text-lg font-semibold mb-4">Profile Visibility</h2>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="profileVisibility"
              value="public"
              checked={settings.profileVisibility === "public"}
              onChange={(e) => setSettings({ ...settings, profileVisibility: e.target.value as any })}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">Public</div>
              <div className="text-sm text-white/60">Anyone can view your profile</div>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="profileVisibility"
              value="friends"
              checked={settings.profileVisibility === "friends"}
              onChange={(e) => setSettings({ ...settings, profileVisibility: e.target.value as any })}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">Friends Only</div>
              <div className="text-sm text-white/60">Only your friends can view your profile</div>
            </div>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="profileVisibility"
              value="private"
              checked={settings.profileVisibility === "private"}
              onChange={(e) => setSettings({ ...settings, profileVisibility: e.target.value as any })}
              className="w-4 h-4"
            />
            <div>
              <div className="font-medium">Private</div>
              <div className="text-sm text-white/60">Your profile is hidden from everyone</div>
            </div>
          </label>
        </div>
      </MicaCard>

      <MicaCard className="p-6">
        <h2 className="text-lg font-semibold mb-4">Activity & Status</h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium">Show Game Activity</div>
              <div className="text-sm text-white/60">Let others see what games you're playing</div>
            </div>
            <input
              type="checkbox"
              checked={settings.showGameActivity}
              onChange={(e) => setSettings({ ...settings, showGameActivity: e.target.checked })}
              className="w-5 h-5"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium">Show Recently Played Games</div>
              <div className="text-sm text-white/60">Display your recently played games on your profile</div>
            </div>
            <input
              type="checkbox"
              checked={settings.showRecentlyPlayed}
              onChange={(e) => setSettings({ ...settings, showRecentlyPlayed: e.target.checked })}
              className="w-5 h-5"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium">Show Library</div>
              <div className="text-sm text-white/60">Display your game library on your profile</div>
            </div>
            <input
              type="checkbox"
              checked={settings.showLibrary}
              onChange={(e) => setSettings({ ...settings, showLibrary: e.target.checked })}
              className="w-5 h-5"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium">Show Friends</div>
              <div className="text-sm text-white/60">Display your friend list on your profile</div>
            </div>
            <input
              type="checkbox"
              checked={settings.showFriends}
              onChange={(e) => setSettings({ ...settings, showFriends: e.target.checked })}
              className="w-5 h-5"
            />
          </label>
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium">Show Online Status</div>
              <div className="text-sm text-white/60">Let others see when you're online</div>
            </div>
            <input
              type="checkbox"
              checked={settings.showOnlineStatus}
              onChange={(e) => setSettings({ ...settings, showOnlineStatus: e.target.checked })}
              className="w-5 h-5"
            />
          </label>
        </div>
      </MicaCard>

      <MicaCard className="p-6">
        <h2 className="text-lg font-semibold mb-4">Social</h2>
        <div className="space-y-4">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="font-medium">Allow Friend Requests</div>
              <div className="text-sm text-white/60">Let others send you friend requests</div>
            </div>
            <input
              type="checkbox"
              checked={settings.allowFriendRequests}
              onChange={(e) => setSettings({ ...settings, allowFriendRequests: e.target.checked })}
              className="w-5 h-5"
            />
          </label>
          <div className="space-y-3">
            <div className="font-medium">Who can message you?</div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="allowMessages"
                value="everyone"
                checked={settings.allowMessages === "everyone"}
                onChange={(e) => setSettings({ ...settings, allowMessages: e.target.value as any })}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium">Everyone</div>
                <div className="text-sm text-white/60">Anyone can send you messages</div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="allowMessages"
                value="friends"
                checked={settings.allowMessages === "friends"}
                onChange={(e) => setSettings({ ...settings, allowMessages: e.target.value as any })}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium">Friends Only</div>
                <div className="text-sm text-white/60">Only your friends can message you</div>
              </div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="allowMessages"
                value="none"
                checked={settings.allowMessages === "none"}
                onChange={(e) => setSettings({ ...settings, allowMessages: e.target.value as any })}
                className="w-4 h-4"
              />
              <div>
                <div className="font-medium">No One</div>
                <div className="text-sm text-white/60">Nobody can send you messages</div>
              </div>
            </label>
          </div>
        </div>
      </MicaCard>

      <div className="flex justify-end">
        <MicaButton variant="primary" onClick={handleSave}>
          <Save size={16} className="mr-2" />
          Save Settings
        </MicaButton>
      </div>
    </div>
  );
};

export default PrivacySettings;

