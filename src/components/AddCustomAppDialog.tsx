import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";
import { toast } from "sonner";

interface AddCustomAppDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AddCustomAppDialog: React.FC<AddCustomAppDialogProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState("");
  const [executablePath, setExecutablePath] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSelectExecutable = async () => {
    try {
      console.log("Opening file dialog...");
      const selected = await open({
        multiple: false,
        directory: false,
      });

      console.log("Dialog result:", selected);

      if (selected) {
        if (typeof selected === "string") {
          setExecutablePath(selected);
          console.log("Selected file:", selected);
        } else if (Array.isArray(selected) && (selected as string[]).length > 0) {
          setExecutablePath(selected[0]);
          console.log("Selected file:", selected[0]);
        }
      } else {
        console.log("No file selected");
      }
    } catch (error: any) {
      console.error("Error selecting executable:", error);
      toast.error(error.message || "Failed to select executable. Please check the console for details.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!executablePath.trim()) {
      toast.error("Please select an executable");
      return;
    }

    setIsLoading(true);
    try {
      await invoke<string>("add_custom_app", {
        title: title.trim(),
        executablePath: executablePath.trim(),
      });

      toast.success("Custom app added successfully");
      setTitle("");
      setExecutablePath("");
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error adding custom app:", error);
      toast.error(error.message || "Failed to add custom app");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Add Custom App</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">App Name</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter app name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="executable">Executable Path</Label>
            <div className="flex gap-2">
              <Input
                id="executable"
                value={executablePath}
                onChange={(e) => setExecutablePath(e.target.value)}
                placeholder="Select executable file"
                readOnly
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleSelectExecutable}
              >
                Browse
              </Button>
            </div>
          </div>

          <div className="flex gap-2 justify-end mt-6">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Adding..." : "Add App"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

