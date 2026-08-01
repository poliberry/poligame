use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;
use sysinfo::System;

fn sanitize_executable_field(raw: &str) -> String {
    let trimmed = raw.trim().trim_matches('"');

    if trimmed.contains(".exe") {
        let lower = trimmed.to_lowercase();
        if let Some(idx) = lower.find(".exe") {
            return trimmed[..idx + 4].trim_matches('"').to_string();
        }
    }

    trimmed.to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpicGame {
    pub id: String,
    pub app_name: String,
    pub title: String,
    pub install_path: String,
    pub executable_path: Option<String>,
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
    
    let app_name = json.get("AppName")
        .and_then(|v| v.as_str())
        .unwrap_or_default()
        .to_string();

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

    let launch_executable = json
        .get("LaunchExecutable")
        .or_else(|| json.get("Executable"))
        .or_else(|| json.get("AppExecutable"))
        .and_then(|v| v.as_str());
    
    if let (Some(id), Some(name), Some(path)) = (catalog_item_id, display_name, install_location) {
        let executable_path = launch_executable.map(|exe| {
            let sanitized = sanitize_executable_field(exe);
            let exe_path = PathBuf::from(&sanitized);
            if exe_path.is_absolute() {
                exe_path
            } else {
                PathBuf::from(path).join(exe_path)
            }
            .to_string_lossy()
            .to_string()
        });

        Some(EpicGame {
            id: id.to_string(),
            app_name,
            title: name.to_string(),
            install_path: path.to_string(),
            executable_path,
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

#[cfg(target_os = "windows")]
fn get_epic_launcher_exe() -> Option<PathBuf> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let uninstall_keys = [
        r"SOFTWARE\WOW6432Node\Epic Games\EpicGamesLauncher",
        r"SOFTWARE\Epic Games\EpicGamesLauncher",
    ];

    for key_path in &uninstall_keys {
        if let Ok(key) = hklm.open_subkey(key_path) {
            if let Ok(data_path) = key.get_value::<String, _>("AppDataPath") {
                // AppDataPath is like C:\ProgramData\Epic\EpicGamesLauncher\Data
                // The exe lives relative to the grandparent
                let candidate = PathBuf::from(&data_path)
                    .parent()?.parent()?.parent()?
                    .join(r"Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe");
                if candidate.exists() {
                    return Some(candidate);
                }
            }
        }
    }

    // Fall back to common install paths
    let common = [
        r"C:\Program Files (x86)\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe",
        r"C:\Program Files\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe",
    ];
    for path in &common {
        let p = PathBuf::from(path);
        if p.exists() {
            return Some(p);
        }
    }

    None
}

pub fn is_epic_launcher_running() -> bool {
    let mut system = System::new_all();
    system.refresh_all();
    system
        .processes()
        .values()
        .any(|p| p.name().to_lowercase().contains("epicgameslauncher"))
}

pub async fn ensure_epic_launcher_running() -> Result<(), String> {
    if is_epic_launcher_running() {
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        let exe = get_epic_launcher_exe()
            .ok_or_else(|| "Epic Games Launcher executable not found".to_string())?;

        std::process::Command::new(&exe)
            .arg("-nosplashscreen")
            .spawn()
            .map_err(|e| format!("Failed to start Epic Games Launcher: {}", e))?;

        // Poll up to 15 s for the launcher process to appear
        for _ in 0..30u8 {
            tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
            if is_epic_launcher_running() {
                // Brief grace period for the launcher to finish initialising
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                return Ok(());
            }
        }

        Err("Timed out waiting for Epic Games Launcher to start".to_string())
    }

    #[cfg(not(target_os = "windows"))]
    {
        // On macOS/Linux the protocol handler is expected to bring up the launcher itself
        Ok(())
    }
}