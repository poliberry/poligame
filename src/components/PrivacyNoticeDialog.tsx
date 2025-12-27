import React from "react";
import { MicaCard } from "./MicaCard";
import { MicaButton } from "./MicaButton";
import { AlertCircle, X, ExternalLink } from "lucide-react";
import { open } from "@tauri-apps/plugin-shell";

interface PrivacyNoticeDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyNoticeDialog: React.FC<PrivacyNoticeDialogProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const handleOpenSteamPrivacy = async () => {
    try {
      await open("https://steamcommunity.com/my/edit/settings");
    } catch (error) {
      console.error("Failed to open Steam privacy settings:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <MicaCard className="max-w-2xl w-full mx-4 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="flex items-start gap-4 mb-6">
          <AlertCircle size={32} className="text-yellow-400 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">
              Privacy Settings Required
            </h2>
            <p className="text-white/80 mb-4">
              To display your Steam achievements, your Steam profile's privacy settings must allow
              public access to your game details.
            </p>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg p-4 mb-6">
          <h3 className="font-semibold text-white mb-3">How to enable achievement visibility:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-white/80 ml-2">
            <li>Open Steam and navigate to your profile</li>
            <li>Click on "Edit Profile" and select "Privacy Settings"</li>
            <li>Set "My Profile" to "Public"</li>
            <li>Set "Game Details" to "Public" (this is required for achievements to be visible)</li>
            <li>Save your changes</li>
          </ol>
        </div>

        <div className="flex gap-3 justify-end">
          <MicaButton variant="secondary" onClick={onClose}>
            Close
          </MicaButton>
          <MicaButton
            variant="primary"
            onClick={handleOpenSteamPrivacy}
            className="flex items-center gap-2"
          >
            <ExternalLink size={16} />
            Open Steam Privacy Settings
          </MicaButton>
        </div>
      </MicaCard>
    </div>
  );
};

