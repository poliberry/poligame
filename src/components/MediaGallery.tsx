import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthStore } from "@/stores/authStore";
import { Id } from "../../convex/_generated/dataModel";
import { X, Trash2, Edit2, Camera, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MicaCard } from "@/components/MicaCard";
import { invoke } from "@tauri-apps/api/core";

interface MediaGalleryProps {
  gameId: string;
  userId?: string; // If provided, only show user's screenshots
}

export const MediaGallery: React.FC<MediaGalleryProps> = ({ gameId, userId }) => {
  const { user } = useAuthStore();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [editingCaption, setEditingCaption] = useState<{ id: string; caption: string } | null>(null);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const screenshotsApi = api as any;
  
  const screenshots = useQuery(
    screenshotsApi.screenshots?.getGameScreenshots,
    gameId
      ? {
          gameId,
          userId: userId ? (userId as Id<"users">) : undefined,
        }
      : "skip"
  );

  const deleteScreenshot = useMutation(screenshotsApi.screenshots?.deleteScreenshot);
  const updateCaption = useMutation(screenshotsApi.screenshots?.updateScreenshotCaption);
  const addScreenshot = useMutation(screenshotsApi.screenshots?.addScreenshot);

  const handleDelete = async (screenshotId: string) => {
    if (!user?.userId) return;
    if (!confirm("Are you sure you want to delete this screenshot?")) return;

    try {
      await deleteScreenshot({
        screenshotId: screenshotId as Id<"gameScreenshots">,
        userId: user.userId as Id<"users">,
      });
    } catch (error) {
      console.error("Failed to delete screenshot:", error);
      alert("Failed to delete screenshot");
    }
  };

  const handleUpdateCaption = async () => {
    if (!editingCaption || !user?.userId) return;

    try {
      await updateCaption({
        screenshotId: editingCaption.id as Id<"gameScreenshots">,
        userId: user.userId as Id<"users">,
        caption: editingCaption.caption || undefined,
      });
      setEditingCaption(null);
    } catch (error) {
      console.error("Failed to update caption:", error);
      alert("Failed to update caption");
    }
  };

  const handleCaptureScreenshot = async () => {
    try {
      const base64Image = await invoke<string>("capture_screenshot");
      
      if (!user?.userId) {
        alert("Please log in to save screenshots");
        return;
      }

      // Save screenshot to Convex
      await addScreenshot({
        userId: user.userId as Id<"users">,
        gameId,
        imageUrl: base64Image,
      });
    } catch (error) {
      console.error("Failed to capture screenshot:", error);
      alert("Failed to capture screenshot");
    }
  };

  if (!screenshots) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-foreground/60">Loading gallery...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header with capture button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-[var(--theme-accent)]" />
          <h2 className="text-lg font-bold uppercase italic">
            Media Gallery
          </h2>
          {screenshots.length > 0 && (
            <span className="text-sm text-foreground/60">
              ({screenshots.length})
            </span>
          )}
        </div>
        {user?.userId && (
          <Button
            onClick={handleCaptureScreenshot}
            variant="default"
            className="flex items-center gap-2 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            Capture Screenshot
          </Button>
        )}
      </div>

      {/* Screenshots Grid */}
      {screenshots.length === 0 ? (
        <MicaCard className="p-8 text-center">
          <ImageIcon className="w-12 h-12 mx-auto mb-4 text-foreground/40" />
          <p className="text-foreground/60 mb-4">
            No screenshots yet
          </p>
          {user?.userId && (
            <Button
              onClick={handleCaptureScreenshot}
              variant="default"
              className="cursor-pointer"
            >
              <Camera className="w-4 h-4 mr-2" />
              Capture Your First Screenshot
            </Button>
          )}
        </MicaCard>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {screenshots.map((screenshot: any) => (
            <div
              key={screenshot._id}
              className="relative group cursor-pointer"
              onClick={() => setSelectedImage(screenshot.imageUrl)}
            >
              <div className="aspect-video rounded-lg overflow-hidden bg-foreground/5 border border-foreground/10 hover:border-[var(--theme-accent)]/50 transition-all">
                <img
                  src={screenshot.thumbnailUrl || screenshot.imageUrl}
                  alt={screenshot.caption || "Screenshot"}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  {screenshot.caption && (
                    <p className="text-white text-sm px-2 text-center line-clamp-2">
                      {screenshot.caption}
                    </p>
                  )}
                </div>
              </div>
              {user?.userId === screenshot.userId && (
                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCaption({ id: screenshot._id, caption: screenshot.caption || "" });
                    }}
                    className="p-1.5 bg-black/60 rounded hover:bg-black/80 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-white" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(screenshot._id);
                    }}
                    className="p-1.5 bg-red-600/60 rounded hover:bg-red-600/80 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-white" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Full Screen Image Viewer */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 bg-black/60 rounded hover:bg-black/80 transition-colors z-10"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={selectedImage}
            alt="Screenshot"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Edit Caption Dialog */}
      {editingCaption && (
        <div
          className="fixed inset-0 z-[150] bg-black/50 flex items-center justify-center p-4"
          onClick={() => setEditingCaption(null)}
        >
          <MicaCard
            className="w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">
              Edit Caption
            </h3>
            <textarea
              value={editingCaption.caption}
              onChange={(e) =>
                setEditingCaption({ ...editingCaption, caption: e.target.value })
              }
              className="w-full p-3 rounded bg-foreground/5 border border-foreground/10 text-foreground mb-4 resize-none"
              rows={3}
              placeholder="Add a caption..."
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setEditingCaption(null)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleUpdateCaption}
                className="cursor-pointer"
              >
                Save
              </Button>
            </div>
          </MicaCard>
        </div>
      )}
    </div>
  );
};

