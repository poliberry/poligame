import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { useThemeStore } from "@/stores/themeStore";
import { isOfficialTheme, type ThemeManifest } from "@/types/theme";
import { Button } from "@/components/ui/button";
import { Check, Trash2, FolderOpen, Plus, Shield } from "lucide-react";
import { toast } from "sonner";

interface ThemeGalleryProps {
  onCreateNew: () => void;
  onEdit: (theme: ThemeManifest) => void;
}

export const ThemeGallery: React.FC<ThemeGalleryProps> = ({ onCreateNew, onEdit }) => {
  const { installedThemes, activeThemeId, setActiveThemeId, deleteTheme, installThemeFromFile, loadThemes } =
    useThemeStore();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleActivate = async (id: string) => {
    await setActiveThemeId(id);
    toast.success("Theme applied");
  };

  const handleDelete = async (theme: ThemeManifest) => {
    if (!confirm(`Delete theme "${theme.name}"? This cannot be undone.`)) return;
    setDeletingId(theme.id);
    try {
      await deleteTheme(theme.id);
      toast.success("Theme deleted");
    } catch (err) {
      toast.error(`Failed to delete theme: ${err}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleInstallFile = async () => {
    try {
      const selected = await open({
        filters: [{ name: "Theme file", extensions: ["yaml", "yml"] }],
        multiple: false,
      });
      if (!selected) return;

      const content = await readTextFile(selected as string);
      const manifest = await installThemeFromFile(content);
      await loadThemes();
      toast.success(`Theme "${manifest.name}" installed`);
    } catch (err) {
      toast.error(`Failed to install theme: ${err}`);
    }
  };

  const handleOpenThemesFolder = async () => {
    try {
      const dir = await invoke<string>("get_themes_dir_path");
      await invoke("open_path_in_explorer", { path: dir }).catch(() => {
        // Fallback: just show the path
        toast.info(`Themes folder: ${dir}`);
      });
    } catch {
      toast.error("Could not open themes folder");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {installedThemes.length} theme{installedThemes.length !== 1 ? "s" : ""} installed
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleInstallFile} className="text-xs gap-1.5">
            <FolderOpen size={13} />
            Install from file
          </Button>
          <Button size="sm" onClick={onCreateNew} className="text-xs gap-1.5 dark:bg-[var(--theme-button)] bg-[var(--theme-button-secondary)]">
            <Plus size={13} />
            Create theme
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {installedThemes.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            isActive={theme.id === activeThemeId}
            isDeleting={deletingId === theme.id}
            onActivate={() => handleActivate(theme.id)}
            onDelete={() => handleDelete(theme)}
            onEdit={() => onEdit(theme)}
          />
        ))}
      </div>

      <div className="pt-2 border-t border-border">
        <button
          onClick={handleOpenThemesFolder}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Open themes folder
        </button>
      </div>
    </div>
  );
};

interface ThemeCardProps {
  theme: ThemeManifest;
  isActive: boolean;
  isDeleting: boolean;
  onActivate: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

const ThemeCard: React.FC<ThemeCardProps> = ({
  theme,
  isActive,
  isDeleting,
  onActivate,
  onDelete,
  onEdit,
}) => {
  const official = isOfficialTheme(theme);
  const accent = theme.colors?.theme_accent ?? "#4CE4B1";
  const bg = theme.colors?.background ?? "oklch(0.141 0.005 285.823)";
  const panel = theme.colors?.card ?? "oklch(0.21 0.006 285.885)";

  return (
    <div
      className={`relative rounded-lg border overflow-hidden cursor-pointer transition-all group ${
        isActive
          ? "border-[var(--theme-accent)] ring-1 ring-[var(--theme-accent)]"
          : "border-border hover:border-muted-foreground/50"
      }`}
      onClick={onActivate}
    >
      {/* Preview swatch */}
      <div className="h-16 relative" style={{ background: bg }}>
        <div
          className="absolute bottom-0 left-0 right-0 h-8 opacity-80"
          style={{ background: panel }}
        />
        <div
          className="absolute bottom-2 left-2 w-6 h-2 rounded-full"
          style={{ background: accent }}
        />
        {/* Border radius preview dots */}
        <div
          className="absolute top-2 right-2 w-4 h-4"
          style={{
            background: accent + "55",
            borderRadius: theme.appearance?.border_radius ?? "0.375rem",
          }}
        />
      </div>

      {/* Info bar */}
      <div className="px-2.5 py-2 bg-card flex items-center justify-between gap-1">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            {official && (
              <Shield size={10} className="text-[var(--theme-accent)] shrink-0" />
            )}
            <span className="text-xs font-medium text-foreground truncate">{theme.name}</span>
          </div>
          <span className="text-[10px] text-muted-foreground truncate block">
            {official ? "Official" : theme.author}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isActive ? (
            <Check size={13} className="text-[var(--theme-accent)]" />
          ) : null}

          {!official && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                title="Edit"
              >
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                disabled={isDeleting}
                className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete"
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
