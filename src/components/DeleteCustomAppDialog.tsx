import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { isPostHogInitialized, posthog } from "@/lib/posthog";

interface DeleteCustomAppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  appName: string;
  onSuccess: () => void | Promise<void>;
  standaloneWindow?: boolean;
}

export const DeleteCustomAppDialog: React.FC<DeleteCustomAppDialogProps> = ({
  isOpen,
  onClose,
  gameId,
  appName,
  onSuccess,
  standaloneWindow = false,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuthStore();
  const deleteCustomization = useMutation(api.gameCustomizations.deleteGameCustomization);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      // Delete from database
      await invoke("delete_custom_app", { gameId });

      // Delete customizations from Convex if user is logged in
      if (user?.userId) {
        try {
          await deleteCustomization({
            gameId,
            userId: user.userId as unknown as Id<"users">,
          });
        } catch (customizationError) {
          console.error("Error deleting customizations:", customizationError);
          // Don't fail the entire operation if customization deletion fails
        }
      }

      if (isPostHogInitialized) {
        posthog.capture("game_custom_app_removed", { game_id: gameId });
      }
      toast.success("App removed successfully");
      try {
        await onSuccess();
      } catch (eventError) {
        console.debug("Custom app delete success callback failed", eventError);
      }
      onClose();
    } catch (error: any) {
      console.error("Error deleting app:", error);
      toast.error(error.message || "Failed to remove app");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const wrapperClassName = standaloneWindow
    ? "w-full h-full flex items-start justify-center bg-background px-4 py-4"
    : "fixed inset-0 z-[200] flex items-center justify-center bg-black/80";

  return (
    <div className={wrapperClassName}>
      <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Remove App</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">
                Are you sure you want to remove <strong>{appName}</strong>? This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={isLoading}>
              {isLoading ? "Removing..." : "Remove"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

