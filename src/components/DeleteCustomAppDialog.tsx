import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface DeleteCustomAppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  appName: string;
  onSuccess: () => void;
}

export const DeleteCustomAppDialog: React.FC<DeleteCustomAppDialogProps> = ({
  isOpen,
  onClose,
  gameId,
  appName,
  onSuccess,
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

      toast.success("App removed successfully");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error deleting app:", error);
      toast.error(error.message || "Failed to remove app");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
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

