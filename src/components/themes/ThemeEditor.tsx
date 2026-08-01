import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { useThemeStore } from "@/stores/themeStore";
import type { ThemeManifest, ThemeColors, ThemeTypography, ThemeAppearance } from "@/types/theme";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface ThemeEditorProps {
  initial?: ThemeManifest | null;
  onBack: () => void;
  onSaved: (theme: ThemeManifest) => void;
}

function generateId(name: string): string {
  return (
    "user-" +
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) +
    "-" +
    Math.random().toString(36).slice(2, 7)
  );
}

const COLOR_FIELDS: { key: keyof ThemeColors; label: string; hint?: string }[] = [
  { key: "theme_accent", label: "Accent", hint: "Links, active states, highlights" },
  { key: "theme_button", label: "Button (dark mode)", hint: "Primary button background in dark mode" },
  { key: "theme_button_secondary", label: "Button (light mode)", hint: "Primary button background in light mode" },
  { key: "theme_panel", label: "Panel", hint: "Cards, sidebars, panels" },
  { key: "background", label: "Background" },
  { key: "foreground", label: "Foreground text" },
  { key: "card", label: "Card background" },
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "muted", label: "Muted" },
  { key: "muted_foreground", label: "Muted text" },
  { key: "border", label: "Border" },
  { key: "destructive", label: "Destructive" },
];

export const ThemeEditor: React.FC<ThemeEditorProps> = ({ initial, onBack, onSaved }) => {
  const { saveUserTheme, setActiveThemeId } = useThemeStore();

  const [name, setName] = useState(initial?.name ?? "My Theme");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [colors, setColors] = useState<ThemeColors>(initial?.colors ?? {});
  const [fontFamily, setFontFamily] = useState(initial?.typography?.font_family ?? "system-ui");
  const [borderRadius, setBorderRadius] = useState(initial?.appearance?.border_radius ?? "0.625rem");
  const [bgImage, setBgImage] = useState(initial?.appearance?.background_image ?? "");
  const [bgOpacity, setBgOpacity] = useState(initial?.appearance?.background_image_opacity ?? 0.15);
  const [systemFonts, setSystemFonts] = useState<string[]>([]);
  const [fontWarning, setFontWarning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [bgImageAsset, setBgImageAsset] = useState<string | null>(null);
  const [isNewBgImage, setIsNewBgImage] = useState(false);
  const [mascotFile, setMascotFile] = useState(initial?.mascot_file ?? "");
  const [mascotAsset, setMascotAsset] = useState<string | null>(null);
  const [isNewMascot, setIsNewMascot] = useState(false);
  const [mascotAssetExt, setMascotAssetExt] = useState("png");

  const isEditing = !!initial;
  const themeId = initial?.id ?? generateId(name);

  useEffect(() => {
    invoke<string[]>("get_system_fonts")
      .then(setSystemFonts)
      .catch(() => setSystemFonts(["system-ui", "sans-serif", "serif", "monospace"]));
  }, []);

  // Resolve bare filenames to data URLs for preview only.
  // Uses a functional updater that only applies the result if the state hasn't
  // changed since the request was made (guards against Remove/replace races).
  useEffect(() => {
    if (!initial?.id) return;

    const bg = initial.appearance?.background_image;
    if (bg && !bg.startsWith("data:") && !bg.startsWith("http")) {
      invoke<string>("get_theme_asset_base64", { themeId: initial.id, assetFilename: bg })
        .then((b64) => {
          const ext = bg.split(".").pop()?.toLowerCase() ?? "png";
          const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
          // Only apply if the user hasn't already removed or replaced the image
          setBgImage((curr) => (curr === bg ? `data:${mime};base64,${b64}` : curr));
        })
        .catch(() => { /* keep bgImage as bare filename — save will preserve it */ });
    }

    const mf = initial.mascot_file;
    if (mf && !mf.startsWith("data:") && !mf.startsWith("http")) {
      invoke<string>("get_theme_asset_base64", { themeId: initial.id, assetFilename: mf })
        .then((b64) => {
          const ext = mf.split(".").pop()?.toLowerCase() ?? "png";
          const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
          // Only apply if the user hasn't already removed or replaced the mascot
          setMascotFile((curr) => (curr === mf ? `data:${mime};base64,${b64}` : curr));
        })
        .catch(() => { /* keep mascotFile as bare filename — save will preserve it */ });
    }
  }, []);

  const checkFont = (family: string) => {
    if (!family || family === "system-ui") {
      setFontWarning(null);
      return;
    }
    // CSS font availability check
    try {
      const available = document.fonts.check(`12px "${family}"`);
      setFontWarning(
        available
          ? null
          : `"${family}" is not installed on your system. Users without this font will see a fallback.`
      );
    } catch {
      setFontWarning(null);
    }
  };

  const handleFontChange = (family: string) => {
    setFontFamily(family);
    checkFont(family);
  };

  const handlePickBgImage = async () => {
    try {
      const selected = await open({
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
        multiple: false,
      });
      if (!selected) return;

      const bytes = await readFile(selected as string);
      // Chunk to avoid exceeding the engine's max argument count on large files.
      const CHUNK = 0x8000;
      let binary = "";
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const base64 = btoa(binary);
      const ext = (selected as string).split(".").pop()?.toLowerCase() ?? "png";
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
      const dataUrl = `data:${mime};base64,${base64}`;

      setBgImageAsset(base64);
      setBgImage(dataUrl);
      setIsNewBgImage(true);
    } catch (err) {
      toast.error("Failed to load image");
    }
  };

  const handlePickMascot = async () => {
    try {
      const selected = await open({
        filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
        multiple: false,
      });
      if (!selected) return;

      const bytes = await readFile(selected as string);
      const CHUNK = 0x8000;
      let binary = "";
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      const base64 = btoa(binary);
      const ext = (selected as string).split(".").pop()?.toLowerCase() ?? "png";
      const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext}`;
      const dataUrl = `data:${mime};base64,${base64}`;

      setMascotAsset(base64);
      setMascotFile(dataUrl);
      setMascotAssetExt(ext);
      setIsNewMascot(true);
    } catch {
      toast.error("Failed to load mascot image");
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Theme name is required");
      return;
    }

    setIsSaving(true);
    try {
      const id = isEditing ? initial!.id : generateId(name);

      // If a new bg image was picked, save it as an asset
      let finalBgImage = bgImage;
      if (bgImageAsset && isNewBgImage) {
        const filename = "background.png";
        await invoke("save_theme_asset", {
          themeId: id,
          assetFilename: filename,
          dataBase64: bgImageAsset,
        });
        finalBgImage = filename;
      } else if (bgImage && !bgImage.startsWith("data:") && !bgImage.startsWith("http")) {
        finalBgImage = bgImage; // preserve bare filename from existing theme
      } else if (bgImage.startsWith("data:")) {
        finalBgImage = isEditing ? (initial!.appearance?.background_image ?? "") : "";
      }

      // Save mascot asset if a new one was picked
      let finalMascotFile: string | undefined = undefined;
      if (mascotAsset && isNewMascot) {
        const filename = `mascot.${mascotAssetExt}`;
        await invoke("save_theme_asset", {
          themeId: id,
          assetFilename: filename,
          dataBase64: mascotAsset,
        });
        finalMascotFile = filename;
      } else if (mascotFile && !mascotFile.startsWith("data:") && !mascotFile.startsWith("http")) {
        finalMascotFile = mascotFile;
      } else if (!mascotFile) {
        finalMascotFile = undefined;
      } else {
        finalMascotFile = isEditing ? initial!.mascot_file : undefined;
      }

      const manifest: ThemeManifest = {
        id,
        name: name.trim(),
        version: "1.0.0",
        author: author.trim() || "User",
        publisher: "user",
        description: description.trim() || undefined,
        mascot_file: finalMascotFile,
        colors,
        typography: { font_family: fontFamily || "system-ui" },
        appearance: {
          border_radius: borderRadius || "0.625rem",
          background_image: finalBgImage || undefined,
          background_image_opacity: bgOpacity,
        },
      };

      await saveUserTheme(manifest);
      await setActiveThemeId(id);
      toast.success(`Theme "${manifest.name}" saved and applied`);
      onSaved(manifest);
    } catch (err) {
      toast.error(`Failed to save theme: ${err}`);
    } finally {
      setIsSaving(false);
    }
  };

  const setColor = (key: keyof ThemeColors, value: string) => {
    setColors((prev) => ({ ...prev, [key]: value }));
  };

  // Only show hex color picker for simple #rrggbb values
  const isHexColor = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <h3 className="text-sm font-semibold text-foreground">
          {isEditing ? `Edit: ${initial.name}` : "Create Theme"}
        </h3>
      </div>

      <div className="space-y-3 overflow-y-auto max-h-[520px] pr-1 content-view-scrollbar">
        {/* Basic info */}
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            Info
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Name *</label>
              <input
                className="w-full px-2 py-1.5 text-sm rounded bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Theme"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Author</label>
              <input
                className="w-full px-2 py-1.5 text-sm rounded bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            <input
              className="w-full px-2 py-1.5 text-sm rounded bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
        </section>

        {/* Colors */}
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            Colors
          </h4>
          <div className="space-y-2">
            {COLOR_FIELDS.map(({ key, label, hint }) => {
              const value = colors[key] ?? "";
              const showPicker = isHexColor(value);
              return (
                <div key={key} className="flex items-center gap-2">
                  {showPicker ? (
                    <input
                      type="color"
                      value={value}
                      onChange={(e) => setColor(key, e.target.value)}
                      className="w-8 h-8 cursor-pointer rounded border border-border shrink-0"
                      title={label}
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded border border-border shrink-0"
                      style={{ background: value || "transparent" }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground/80">{label}</div>
                    {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
                  </div>
                  <input
                    className="w-36 px-2 py-1 text-xs rounded bg-input border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                    value={value}
                    onChange={(e) => setColor(key, e.target.value)}
                    placeholder="e.g. #4CE4B1"
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            Typography
          </h4>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Font Family</label>
            <div className="flex gap-2">
              <select
                className="flex-1 px-2 py-1.5 text-sm rounded bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                value={fontFamily}
                onChange={(e) => handleFontChange(e.target.value)}
              >
                {systemFonts.map((f) => (
                  <option key={f} value={f} style={{ fontFamily: f }}>
                    {f}
                  </option>
                ))}
              </select>
              <input
                className="w-40 px-2 py-1.5 text-sm rounded bg-input border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                value={fontFamily}
                onChange={(e) => handleFontChange(e.target.value)}
                placeholder="system-ui"
              />
            </div>
            {fontWarning && (
              <div className="flex items-start gap-1.5 mt-1.5 p-2 bg-yellow-500/10 rounded text-yellow-400 text-xs">
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                <span>{fontWarning}</span>
              </div>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">
              Preview:{" "}
              <span style={{ fontFamily: fontFamily || "system-ui" }}>
                The quick brown fox
              </span>
            </p>
          </div>
        </section>

        {/* Appearance */}
        <section className="space-y-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
            Appearance
          </h4>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Border Radius</label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="2"
                step="0.125"
                value={parseFloat(borderRadius) || 0.625}
                onChange={(e) => setBorderRadius(`${e.target.value}rem`)}
                className="flex-1 figma-range"
              />
              <input
                className="w-24 px-2 py-1 text-xs rounded bg-input border border-border text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
                value={borderRadius}
                onChange={(e) => setBorderRadius(e.target.value)}
                placeholder="0.625rem"
              />
              <div
                className="w-6 h-6 bg-[var(--theme-accent)]/30 border border-[var(--theme-accent)]/60"
                style={{ borderRadius }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Background Image (Library only)
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePickBgImage}
                className="text-xs"
              >
                Choose image
              </Button>
              {bgImage && (
                <button
                  onClick={() => {
                    setBgImage("");
                    setBgImageAsset(null);
                    setIsNewBgImage(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            {bgImage && (
              <div className="mt-2 space-y-1">
                <div
                  className="w-full h-16 rounded border border-border bg-cover bg-center"
                  style={{ backgroundImage: `url(${bgImage})` }}
                />
                <div>
                  <label className="text-[10px] text-muted-foreground">
                    Opacity: {Math.round(bgOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={bgOpacity}
                    onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
                    className="w-full figma-range"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Mascot (corner overlay in Library)
            </label>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePickMascot}
                className="text-xs"
              >
                Choose mascot
              </Button>
              {mascotFile && (
                <button
                  onClick={() => {
                    setMascotFile("");
                    setMascotAsset(null);
                    setIsNewMascot(false);
                  }}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            {mascotFile && mascotFile.startsWith("data:") && (
              <div className="mt-2">
                <img
                  src={mascotFile}
                  alt="Mascot preview"
                  className="w-16 h-16 object-contain rounded border border-border"
                />
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="flex gap-2 pt-2 border-t border-border">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="dark:bg-[var(--theme-button)] bg-[var(--theme-button-secondary)] text-sm"
        >
          {isSaving ? (
            <span className="flex items-center gap-1.5">
              <RefreshCw size={13} className="animate-spin" /> Saving…
            </span>
          ) : (
            "Save & Apply"
          )}
        </Button>
        <Button variant="outline" onClick={onBack} className="text-sm">
          Cancel
        </Button>
      </div>
    </div>
  );
};
