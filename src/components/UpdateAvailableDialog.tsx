import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UpdateCheckResult {
  available: boolean;
  current_version: string;
  version: string | null;
  notes: string | null;
  date: string | null;
}

const DISMISSED_UPDATE_KEY = "poligame.dismissedUpdateVersion";

const UpdateAvailableDialog: React.FC = () => {
  const [open, setOpen] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(false);
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [installed, setInstalled] = React.useState(false);
  const [update, setUpdate] = React.useState<UpdateCheckResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const checkForUpdates = React.useCallback(async () => {
    setIsChecking(true);
    setError(null);

    try {
      const result = await invoke<UpdateCheckResult>("check_for_app_update");
      if (!result.available || !result.version) {
        setUpdate(null);
        setOpen(false);
        return;
      }

      const dismissedVersion = localStorage.getItem(DISMISSED_UPDATE_KEY);
      if (dismissedVersion === result.version) {
        return;
      }

      setUpdate(result);
      setOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check for updates.");
    } finally {
      setIsChecking(false);
    }
  }, []);

  const handleInstall = React.useCallback(async () => {
    setIsInstalling(true);
    setError(null);

    try {
      const didInstall = await invoke<boolean>("install_app_update");
      if (didInstall) {
        setInstalled(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to install update.");
    } finally {
      setIsInstalling(false);
    }
  }, []);

  const handleRestart = React.useCallback(async () => {
    try {
      await invoke("restart_app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restart.");
    }
  }, []);

  const handleLater = React.useCallback(() => {
    if (update?.version) {
      localStorage.setItem(DISMISSED_UPDATE_KEY, update.version);
    }
    setOpen(false);
  }, [update?.version]);

  React.useEffect(() => {
    const runCheck = async () => {
      const window = getCurrentWindow();
      if (window.label !== "main") {
        return;
      }

      await checkForUpdates();
    };

    void runCheck();
  }, [checkForUpdates]);

  if (isChecking || !update) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg border-white/10 bg-black/90 text-white backdrop-blur-xl">
        {installed ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Restart Required</DialogTitle>
              <DialogDescription className="text-white/70">
                Version {update.version} has been installed. Restart PoliGame to apply the update.
              </DialogDescription>
            </DialogHeader>

            {error && (
              <p className="text-sm text-red-300">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Later
              </Button>
              <Button onClick={() => void handleRestart()}>
                Restart Now
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Update Available</DialogTitle>
              <DialogDescription className="text-white/70">
                Version {update.version} is available. You are currently on {update.current_version}.
              </DialogDescription>
            </DialogHeader>

            {update.notes && (
              <div className="max-h-52 overflow-y-auto rounded border border-white/10 bg-white/5 p-3 text-sm text-white/80 whitespace-pre-wrap">
                {update.notes}
              </div>
            )}

            {error && (
              <p className="text-sm text-red-300">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={handleLater} disabled={isInstalling}>
                Later
              </Button>
              <Button onClick={() => void handleInstall()} disabled={isInstalling}>
                {isInstalling ? "Installing..." : "Update Now"}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UpdateAvailableDialog;
