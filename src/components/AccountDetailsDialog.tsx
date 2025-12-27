import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { MicaButton } from "./MicaButton";
import { MicaInput } from "./MicaInput";
import { useAuthStore } from "@/stores/authStore";
import { FaSteam } from "react-icons/fa";

interface AccountDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountDetailsDialog: React.FC<AccountDetailsDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, setUser } = useAuthStore();
  const [username, setUsername] = useState("");
  const [steamUserId, setSteamUserId] = useState("");
  const [epicUserId, setEpicUserId] = useState("");
  const [eaUserId, setEaUserId] = useState("");
  const [rockstarUserId, setRockstarUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const updateProfile = useMutation(api.user.updateUserProfile);
  // Note: getUserById expects an Id<"users">, but we store userId as string
  // We'll fetch user data via the update mutation result or use the stored user data

  // Load user data when dialog opens
  useEffect(() => {
    if (isOpen && user) {
      setUsername(user.username || "");
      setSteamUserId(user.steamUserId || "");
      setEpicUserId(user.epicUserId || "");
      setEaUserId(user.eaUserId || "");
      setRockstarUserId(user.rockstarUserId || "");
    }
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

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
        steamUserId: steamUserId || undefined,
        epicUserId: epicUserId || undefined,
        eaUserId: eaUserId || undefined,
        rockstarUserId: rockstarUserId || undefined,
      });

      // Update local user state
      setUser({
        ...user,
        username: result.username,
        steamUserId: result.steamUserId,
        epicUserId: result.epicUserId,
        eaUserId: result.eaUserId,
        rockstarUserId: result.rockstarUserId,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to update account details");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-black/90 border border-white/20 rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{
          backgroundColor: "rgba(0, 110, 75, 0.9)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-row justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Account Details</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
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
            <MicaButton type="button" variant="default" onClick={onClose}>
              Cancel
            </MicaButton>
            <MicaButton type="submit" variant="primary" disabled={isSaving}>
              <Save size={14} className="mr-1" />
              {isSaving ? "Saving..." : "Save Changes"}
            </MicaButton>
          </div>
        </form>
      </div>
    </div>
  );
};

