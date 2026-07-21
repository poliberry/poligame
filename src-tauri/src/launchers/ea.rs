use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EAGame {
    pub id: String,
    pub title: String,
    pub install_path: String,
}

#[cfg(target_os = "windows")]
fn get_ea_path_windows() -> Option<PathBuf> {
    use winreg::enums::*;
    use winreg::RegKey;
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let key_paths = [
        "SOFTWARE\\WOW6432Node\\Electronic Arts\\EA Desktop",
        "SOFTWARE\\Electronic Arts\\EA Desktop",
        "SOFTWARE\\WOW6432Node\\Origin",
        "SOFTWARE\\Origin",
    ];
    
    for key_path in &key_paths {
        if let Ok(key) = hklm.open_subkey(key_path) {
            if let Ok(path) = key.get_value::<String, _>("InstallDir") {
                let path = PathBuf::from(path);
                if path.exists() {
                    return Some(path);
                }
            }
        }
    }
    None
}

pub fn get_ea_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        get_ea_path_windows()
            .or_else(|| {
                // Fallback to Program Files
                let program_files = std::env::var("ProgramFiles(x86)")
                    .or_else(|_| std::env::var("ProgramFiles"))
                    .ok()?;
                let path = PathBuf::from(program_files).join("Electronic Arts/EA Desktop");
                if path.exists() {
                    Some(path)
                } else {
                    let origin_path = PathBuf::from(program_files).join("Origin");
                    if origin_path.exists() {
                        Some(origin_path)
                    } else {
                        None
                    }
                }
            })
            .ok_or_else(|| "EA Desktop/Origin not found".to_string())
    }
    
    #[cfg(target_os = "macos")]
    {
        let path = PathBuf::from("/Library/Application Support/Electronic Arts/EA Desktop");
        if path.exists() {
            Ok(path)
        } else {
            // Try user-specific location
            dirs::home_dir()
                .map(|h| h.join("Library/Application Support/Electronic Arts/EA Desktop"))
                .filter(|p| p.exists())
                .ok_or_else(|| "EA Desktop not found".to_string())
        }
    }
    
    #[cfg(target_os = "linux")]
    {
        // EA Desktop doesn't officially support Linux
        // May exist under Wine prefixes, but that's complex to detect reliably
        Err("EA Desktop is not supported on Linux".to_string())
    }
}

fn get_manifest_path(base_path: &PathBuf) -> PathBuf {
    // Try EA Desktop first, then fall back to Origin
    let ea_manifest = base_path.join("EALauncher").join("manifestCache");
    let origin_manifest = base_path.join("manifestCache");
    
    if ea_manifest.exists() {
        ea_manifest
    } else {
        origin_manifest
    }
}

fn parse_ea_manifest(path: &PathBuf) -> Option<EAGame> {
    let content = fs::read_to_string(path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    
    let id = json.get("id").and_then(|v| v.as_str())?;
    let title = json.get("title").and_then(|v| v.as_str())?;
    let install_path = json
        .get("installPath")
        .and_then(|v| v.as_str())
        .unwrap_or("");
    
    Some(EAGame {
        id: id.to_string(),
        title: title.to_string(),
        install_path: install_path.to_string(),
    })
}

fn scan_ea_games_directory(base_path: &PathBuf) -> Result<Vec<EAGame>, String> {
    let manifest_path = get_manifest_path(base_path);
    
    if !manifest_path.exists() {
        return Ok(vec![]);
    }
    
    let mut games = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&manifest_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(game) = parse_ea_manifest(&path) {
                    games.push(game);
                }
            }
        }
    }
    
    Ok(games)
}

pub async fn scan_ea_games() -> Result<Vec<String>, String> {
    let ea_path = match get_ea_path() {
        Ok(path) => path,
        Err(e) => {
            eprintln!("EA path error: {}", e);
            return Ok(vec![]);
        }
    };
    
    let games = scan_ea_games_directory(&ea_path)?;
    Ok(games.into_iter().map(|g| g.id).collect())
}

pub async fn get_ea_game_details(game_id: &str) -> Result<EAGame, String> {
    let ea_path = get_ea_path()?;
    let manifest_path = get_manifest_path(&ea_path);
    
    if !manifest_path.exists() {
        return Err("Manifest directory not found".to_string());
    }
    
    if let Ok(entries) = fs::read_dir(&manifest_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Some(game) = parse_ea_manifest(&path) {
                    if game.id == game_id {
                        return Ok(game);
                    }
                }
            }
        }
    }
    
    Err(format!("EA game with ID {} not found", game_id))
}