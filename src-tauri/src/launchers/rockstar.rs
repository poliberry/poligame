use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RockstarGame {
    pub id: String,
    pub title: String,
    pub install_path: String,
}

#[cfg(target_os = "windows")]
fn get_rockstar_path_windows() -> Option<PathBuf> {
    use winreg::enums::*;
    use winreg::RegKey;
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    // Try 64-bit registry first, then 32-bit
    let key_paths = [
        "SOFTWARE\\WOW6432Node\\Rockstar Games\\Launcher",
        "SOFTWARE\\Rockstar Games\\Launcher",
    ];
    
    for key_path in &key_paths {
        if let Ok(key) = hklm.open_subkey(key_path) {
            if let Ok(path) = key.get_value::<String, _>("InstallFolder") {
                let path = PathBuf::from(path);
                if path.exists() {
                    return Some(path);
                }
            }
        }
    }
    None
}

pub fn get_rockstar_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        get_rockstar_path_windows()
            .ok_or_else(|| "Rockstar Games Launcher not found".to_string())
    }
    
    #[cfg(not(target_os = "windows"))]
    {
        // Rockstar Games Launcher is Windows-only
        Err("Rockstar Games Launcher is not available on this platform".to_string())
    }
}

fn scan_rockstar_games_directory(_base_path: &PathBuf) -> Result<Vec<RockstarGame>, String> {
    // Rockstar game detection is complex and varies by game
    // This would need to parse specific game manifests or scan for executables
    Ok(vec![])
}

pub async fn scan_rockstar_games() -> Result<Vec<String>, String> {
    #[cfg(not(target_os = "windows"))]
    {
        // Rockstar Launcher doesn't exist on macOS/Linux
        return Ok(vec![]);
    }
    
    #[cfg(target_os = "windows")]
    {
        let _rockstar_path = match get_rockstar_path() {
            Ok(path) => path,
            Err(_) => return Ok(vec![]),
        };
        
        let _games = scan_rockstar_games_directory(&_rockstar_path)?;
        Ok(vec![])
    }
}