use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ThemeColors {
    pub background: Option<String>,
    pub foreground: Option<String>,
    pub card: Option<String>,
    pub popover: Option<String>,
    pub primary: Option<String>,
    pub primary_foreground: Option<String>,
    pub secondary: Option<String>,
    pub secondary_foreground: Option<String>,
    pub muted: Option<String>,
    pub muted_foreground: Option<String>,
    pub accent: Option<String>,
    pub accent_foreground: Option<String>,
    pub destructive: Option<String>,
    pub border: Option<String>,
    pub input: Option<String>,
    pub ring: Option<String>,
    pub theme_accent: Option<String>,
    pub theme_button: Option<String>,
    pub theme_button_secondary: Option<String>,
    pub theme_panel: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ThemeTypography {
    pub font_family: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ThemeAppearance {
    pub border_radius: Option<String>,
    pub background_image: Option<String>,
    pub background_image_opacity: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ThemeManifest {
    pub id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub publisher: String,
    pub description: Option<String>,
    pub mascot_file: Option<String>,
    pub colors: Option<ThemeColors>,
    pub typography: Option<ThemeTypography>,
    pub appearance: Option<ThemeAppearance>,
}

const DEFAULT_DARK_THEME: &str = include_str!("../themes/poligame-default-dark.yaml");
const DEFAULT_LIGHT_THEME: &str = include_str!("../themes/poligame-default-light.yaml");

fn themes_dir() -> Result<PathBuf, String> {
    let mut dir =
        dirs::data_dir().ok_or_else(|| "Failed to locate data directory".to_string())?;
    dir.push("PoliGame");
    dir.push("themes");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create themes directory: {}", e))?;
    Ok(dir)
}

pub fn init_themes() -> Result<(), String> {
    let dir = themes_dir()?;

    // Always overwrite official themes so users receive updated defaults on each launch.
    for (filename, content) in &[
        ("poligame-default-dark.yaml", DEFAULT_DARK_THEME),
        ("poligame-default-light.yaml", DEFAULT_LIGHT_THEME),
    ] {
        let path = dir.join(filename);
        fs::write(&path, content)
            .map_err(|e| format!("Failed to write default theme {}: {}", filename, e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn list_themes() -> Result<Vec<ThemeManifest>, String> {
    let dir = themes_dir()?;
    let mut themes = Vec::new();

    let entries = fs::read_dir(&dir)
        .map_err(|e| format!("Failed to read themes directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("yaml") {
            let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            match serde_yaml::from_str::<ThemeManifest>(&content) {
                Ok(manifest) => themes.push(manifest),
                Err(e) => eprintln!("Failed to parse theme {:?}: {}", path, e),
            }
        }
    }

    // Official themes first, then user themes alphabetically
    themes.sort_by(|a, b| {
        let a_official = a.publisher == "poligame";
        let b_official = b.publisher == "poligame";
        match (a_official, b_official) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.cmp(&b.name),
        }
    });

    Ok(themes)
}

#[tauri::command]
pub fn get_theme(id: String) -> Result<ThemeManifest, String> {
    let dir = themes_dir()?;
    let path = dir.join(format!("{}.yaml", id));

    if !path.exists() {
        return Err(format!("Theme '{}' not found", id));
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_yaml::from_str(&content).map_err(|e| format!("Failed to parse theme: {}", e))
}

#[tauri::command]
pub fn install_theme(yaml_content: String) -> Result<ThemeManifest, String> {
    let manifest: ThemeManifest = serde_yaml::from_str(&yaml_content)
        .map_err(|e| format!("Invalid theme YAML: {}", e))?;

    if manifest.publisher == "poligame" {
        return Err("Cannot install themes with reserved publisher 'poligame'".to_string());
    }

    if manifest.id.is_empty() {
        return Err("Theme id cannot be empty".to_string());
    }

    let dir = themes_dir()?;
    let path = dir.join(format!("{}.yaml", manifest.id));

    fs::write(&path, &yaml_content).map_err(|e| format!("Failed to write theme: {}", e))?;

    Ok(manifest)
}

#[tauri::command]
pub fn save_user_theme(manifest_json: String) -> Result<(), String> {
    let manifest: ThemeManifest = serde_json::from_str(&manifest_json)
        .map_err(|e| format!("Invalid theme JSON: {}", e))?;

    if manifest.publisher == "poligame" {
        return Err("Cannot overwrite official PoliGame themes".to_string());
    }

    let yaml = serde_yaml::to_string(&manifest)
        .map_err(|e| format!("Failed to serialize theme: {}", e))?;

    let dir = themes_dir()?;
    let path = dir.join(format!("{}.yaml", manifest.id));

    fs::write(&path, yaml).map_err(|e| format!("Failed to write theme: {}", e))
}

#[tauri::command]
pub fn delete_theme(id: String) -> Result<(), String> {
    if id.starts_with("poligame-") {
        return Err("Cannot delete official PoliGame themes".to_string());
    }

    let dir = themes_dir()?;
    let path = dir.join(format!("{}.yaml", id));

    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }

    // Also remove assets dir
    let assets_dir = dir.join("assets").join(&id);
    if assets_dir.exists() {
        let _ = fs::remove_dir_all(&assets_dir);
    }

    Ok(())
}

#[tauri::command]
pub fn get_theme_asset_base64(theme_id: String, asset_filename: String) -> Result<String, String> {
    let dir = themes_dir()?;
    let assets_dir = dir.join("assets").join(&theme_id);
    let path = assets_dir.join(&asset_filename);

    let bytes = fs::read(&path).map_err(|e| format!("Failed to read asset: {}", e))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(&bytes))
}

#[tauri::command]
pub fn save_theme_asset(
    theme_id: String,
    asset_filename: String,
    data_base64: String,
) -> Result<(), String> {
    let dir = themes_dir()?;
    let assets_dir = dir.join("assets").join(&theme_id);
    fs::create_dir_all(&assets_dir).map_err(|e| e.to_string())?;

    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&data_base64)
        .map_err(|e| format!("Invalid base64: {}", e))?;

    let path = assets_dir.join(&asset_filename);
    fs::write(&path, &bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_themes_dir_path() -> Result<String, String> {
    themes_dir().map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_system_fonts() -> Result<Vec<String>, String> {
    let mut families: BTreeSet<String> = BTreeSet::new();

    for dir in system_font_dirs() {
        collect_fonts_from_dir(&dir, &mut families);
    }

    // Always include these as fallback entries
    for f in &[
        "system-ui",
        "sans-serif",
        "serif",
        "monospace",
        "cursive",
        "fantasy",
    ] {
        families.insert(f.to_string());
    }

    Ok(families.into_iter().collect())
}

fn collect_fonts_from_dir(dir: &PathBuf, families: &mut BTreeSet<String>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        // Use DirEntry::file_type() — it does not follow symlinks, so cyclic
        // symlinks in font directories cannot cause unbounded recursion.
        let Ok(ft) = entry.file_type() else { continue };
        if ft.is_symlink() {
            continue;
        }
        let path = entry.path();
        if ft.is_dir() {
            collect_fonts_from_dir(&path, families);
            continue;
        }
        if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
            if matches!(ext.to_lowercase().as_str(), "ttf" | "otf") {
                if let Some(family) = read_font_family(&path) {
                    families.insert(family);
                }
            }
        }
    }
}

/// Extract the CSS-usable family name from a font file by reading its name table.
/// Prefers Name ID 16 (Typographic Family) over Name ID 1 (Font Family).
/// Only checks Windows/Unicode platform records: ttf-parser 0.25's Name::to_string()
/// only decodes Windows Unicode (UTF-16BE) and returns None for Mac Roman records.
fn read_font_family(path: &PathBuf) -> Option<String> {
    let data = fs::read(path).ok()?;
    let face = ttf_parser::Face::parse(&data, 0).ok()?;

    for &name_id in &[16u16, 1u16] {
        for name in face.names() {
            if name.name_id == name_id
                && name.platform_id == ttf_parser::PlatformId::Windows
            {
                if let Some(s) = name.to_string() {
                    let s = s.trim().to_string();
                    if s.len() > 1 {
                        return Some(s);
                    }
                }
            }
        }
    }
    None
}

fn system_font_dirs() -> Vec<PathBuf> {
    let mut font_dirs = Vec::new();

    #[cfg(target_os = "windows")]
    {
        font_dirs.push(PathBuf::from("C:\\Windows\\Fonts"));
        if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
            font_dirs.push(
                PathBuf::from(localappdata)
                    .join("Microsoft")
                    .join("Windows")
                    .join("Fonts"),
            );
        }
    }

    #[cfg(target_os = "macos")]
    {
        font_dirs.push(PathBuf::from("/System/Library/Fonts"));
        font_dirs.push(PathBuf::from("/Library/Fonts"));
        if let Some(home) = dirs::home_dir() {
            font_dirs.push(home.join("Library").join("Fonts"));
        }
    }

    #[cfg(target_os = "linux")]
    {
        font_dirs.push(PathBuf::from("/usr/share/fonts"));
        font_dirs.push(PathBuf::from("/usr/local/share/fonts"));
        if let Some(home) = dirs::home_dir() {
            font_dirs.push(home.join(".fonts"));
            font_dirs.push(home.join(".local").join("share").join("fonts"));
        }
    }

    font_dirs
}

