use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpicGame {
    pub id: String,
    pub title: String,
    pub install_path: String,
}

#[cfg(target_os = "windows")]
fn get_epic_base_path_windows() -> Option<PathBuf> {
    use winreg::enums::*;
    use winreg::RegKey;
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key_paths = [
        "SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher",
        "SOFTWARE\\Epic Games\\EpicGamesLauncher",
    ];
    
    for key_path in &key_paths {
        if let Ok(key) = hklm.open_subkey(key_path) {
            // Try AppDataPath first
            if let Ok(path) = key.get_value::<String, _>("AppDataPath") {
                return Some(PathBuf::from(path));
            }
            // Fall back to InstalledAppsPath
            if let Ok(path) = key.get_value::<String, _>("InstalledAppsPath") {
                return Some(PathBuf::from(path));
            }
        }
    }
    None
}

pub fn get_epic_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        get_epic_base_path_windows()
            .or_else(|| {
                // Fallback to ProgramData
                let program_data = std::env::var("ProgramData").ok()?;
                Some(PathBuf::from(program_data).join("Epic/EpicGamesLauncher/Data"))
            })
            .ok_or_else(|| "Epic Games Launcher not found".to_string())
    }
    
    #[cfg(target_os = "macos")]
    {
        let path = PathBuf::from("/Users/Shared/Epic/EpicGamesLauncher/Data");
        if path.exists() {
            Ok(path)
        } else {
            // Try user-specific location
            dirs::home_dir()
                .map(|h| h.join("Library/Application Support/Epic/EpicGamesLauncher/Data"))
                .filter(|p| p.exists())
                .ok_or_else(|| "Epic Games Launcher not found".to_string())
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        let home = dirs::home_dir().ok_or("Home directory not found")?;
        
        let possible_paths = [
            home.join(".config/Epic/EpicGamesLauncher/Data"),
            home.join(".var/app/com.epicgames.EpicGamesLauncher/config/Epic/EpicGamesLauncher/Data"), // Flatpak
        ];
        
        for path in &possible_paths {
            if path.exists() {
                return Ok(path.clone());
            }
        }
        
        Err("Epic Games Launcher not found".to_string())
    }
}

fn get_manifests_path(base_path: &PathBuf) -> PathBuf {
    // Try different manifest locations
    let possible_paths = [
        base_path.join("Manifests"),
        base_path.join("Data").join("Manifests"),
        base_path.clone(),
    ];
    
    for path in &possible_paths {
        if path.exists() && path.is_dir() {
            return path.clone();
        }
    }
    
    // Default fallback
    base_path.join("Manifests")
}

fn parse_epic_manifest(manifest_path: &PathBuf) -> Option<EpicGame> {
    let content = match fs::read_to_string(manifest_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("Failed to read manifest file {:?}: {}", manifest_path, e);
            return None;
        }
    };
    
    let json: serde_json::Value = match serde_json::from_str(&content) {
        Ok(j) => j,
        Err(e) => {
            eprintln!("Failed to parse JSON from {:?}: {}", manifest_path, e);
            return None;
        }
    };
    
    let catalog_item_id = json.get("CatalogItemId")
        .or_else(|| json.get("CatalogNamespace"))
        .or_else(|| json.get("AppName"))
        .and_then(|v| v.as_str());
    
    let display_name = json.get("DisplayName")
        .or_else(|| json.get("LaunchExecutable"))
        .or_else(|| json.get("AppName"))
        .and_then(|v| v.as_str());
    
    let install_location = json.get("InstallLocation")
        .or_else(|| json.get("InstallPath"))
        .or_else(|| json.get("ManifestLocation"))
        .and_then(|v| v.as_str());
    
    if let (Some(id), Some(name), Some(path)) = (catalog_item_id, display_name, install_location) {
        Some(EpicGame {
            id: id.to_string(),
            title: name.to_string(),
            install_path: path.to_string(),
        })
    } else {
        eprintln!("Missing required fields in manifest {:?}", manifest_path);
        None
    }
}

pub async fn scan_epic_games() -> Result<Vec<String>, String> {
    let base_path = match get_epic_path() {
        Ok(path) => path,
        Err(e) => {
            eprintln!("Epic Games path error: {}", e);
            return Ok(vec![]);
        }
    };
    
    eprintln!("Scanning Epic Games from base path: {:?}", base_path);
    
    let manifests_path = get_manifests_path(&base_path);
    
    if !manifests_path.exists() {
        eprintln!("Epic Games manifests directory does not exist: {:?}", manifests_path);
        return Ok(vec![]);
    }
    
    let mut games = Vec::new();
    let manifest_extensions = ["item", "json", "manifest"];
    
    if let Ok(entries) = fs::read_dir(&manifests_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            
            if path.is_file() {
                let ext = path.extension()
                    .and_then(|s| s.to_str())
                    .unwrap_or("");
                
                if manifest_extensions.contains(&ext) {
                    if let Some(game) = parse_epic_manifest(&path) {
                        eprintln!("Found Epic game: {} ({})", game.title, game.id);
                        games.push(game.id);
                    }
                }
            }
        }
    }
    
    eprintln!("Found {} Epic Games", games.len());
    Ok(games)
}

pub async fn get_epic_game_details(catalog_item_id: &str) -> Result<EpicGame, String> {
    let base_path = get_epic_path()?;
    let manifests_path = get_manifests_path(&base_path);
    
    if !manifests_path.exists() {
        return Err("Manifests directory not found".to_string());
    }
    
    if let Ok(entries) = fs::read_dir(&manifests_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Some(game) = parse_epic_manifest(&path) {
                    if game.id == catalog_item_id {
                        return Ok(game);
                    }
                }
            }
        }
    }
    
    Err(format!("Epic game with ID {} not found", catalog_item_id))
}