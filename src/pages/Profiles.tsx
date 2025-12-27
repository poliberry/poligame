import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Plus, Trash2, User, Trophy, Clock, Gamepad2 } from "lucide-react";
import { MicaCard } from "@/components/MicaCard";
import { MicaButton } from "@/components/MicaButton";
import { MicaInput } from "@/components/MicaInput";
import { useProfileStore } from "@/stores/profileStore";
import { Profile } from "@/types";

const Profiles: React.FC = () => {
  const { profiles, setProfiles, currentProfile, setCurrentProfile } = useProfileStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [_editingProfile, _setEditingProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    try {
      const profileList = await invoke<Profile[]>("get_all_profiles");
      setProfiles(profileList);
      
      const current = await invoke<Profile | null>("get_current_profile");
      setCurrentProfile(current);
    } catch (error) {
      console.error("Failed to load profiles:", error);
    }
  };

  const handleCreateProfile = async () => {
    if (!username.trim()) return;
    try {
      await invoke("create_profile", { username: username.trim() });
      setUsername("");
      setShowCreateDialog(false);
      await loadProfiles();
    } catch (error) {
      console.error("Failed to create profile:", error);
    }
  };

  const handleSwitchProfile = async (profileId: string) => {
    try {
      await invoke("switch_profile", { profileId });
      await loadProfiles();
    } catch (error) {
      console.error("Failed to switch profile:", error);
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    try {
      await invoke("delete_profile", { profileId });
      await loadProfiles();
    } catch (error) {
      console.error("Failed to delete profile:", error);
    }
  };

  return (
    <div className="profiles-page">
      <div className="profiles-header">
        <h1>Profiles</h1>
        <MicaButton variant="primary" onClick={() => setShowCreateDialog(true)}>
          <Plus size={18} />
          Create Profile
        </MicaButton>
      </div>

      {showCreateDialog && (
        <MicaCard className="create-profile-dialog">
          <h2>Create New Profile</h2>
          <div className="dialog-content">
            <MicaInput
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateProfile();
                }
              }}
            />
            <div className="dialog-actions">
              <MicaButton onClick={() => setShowCreateDialog(false)}>Cancel</MicaButton>
              <MicaButton variant="primary" onClick={handleCreateProfile}>
                Create
              </MicaButton>
            </div>
          </div>
        </MicaCard>
      )}

      <div className="profiles-grid">
        {profiles.map((profile) => (
          <MicaCard
            key={profile.id}
            className={`profile-card ${currentProfile?.id === profile.id ? "active" : ""}`}
          >
            <div className="profile-header">
              <div className="profile-avatar">
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.username} />
                ) : (
                  <User size={32} />
                )}
              </div>
              <div className="profile-info">
                <h2>{profile.username}</h2>
                {currentProfile?.id === profile.id && (
                  <span className="active-badge">Active</span>
                )}
              </div>
            </div>

            {profile.stats && (
              <div className="profile-stats">
                <div className="stat-item">
                  <Gamepad2 size={16} />
                  <span>{profile.stats.totalGames} Games</span>
                </div>
                <div className="stat-item">
                  <Clock size={16} />
                  <span>{Math.floor(profile.stats.totalPlaytime / 60)}h</span>
                </div>
                <div className="stat-item">
                  <Trophy size={16} />
                  <span>
                    {profile.stats.achievementsUnlocked} / {profile.stats.achievementsTotal}
                  </span>
                </div>
              </div>
            )}

            <div className="profile-actions">
              {currentProfile?.id !== profile.id && (
                <MicaButton onClick={() => handleSwitchProfile(profile.id)}>
                  Switch to Profile
                </MicaButton>
              )}
              <MicaButton
                variant="default"
                onClick={() => handleDeleteProfile(profile.id)}
              >
                <Trash2 size={16} />
              </MicaButton>
            </div>
          </MicaCard>
        ))}
      </div>

      {profiles.length === 0 && (
        <div className="empty-state">
          <p>No profiles yet. Create your first profile to get started!</p>
        </div>
      )}
    </div>
  );
};

export default Profiles;

