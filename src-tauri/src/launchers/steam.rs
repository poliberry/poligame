use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamGame {
    pub app_id: String,
    pub name: String,
    pub install_dir: String,
    pub state: String,
    pub cover_art: Option<String>,
    pub logo: Option<String>,
}

#[cfg(target_os = "windows")]
fn get_steam_path_windows() -> Option<PathBuf> {
    use std::os::windows::ffi::OsStringExt;
    use winreg::enums::*;
    use winreg::RegKey;
    
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey("Software\\Valve\\Steam") {
        if let Ok(path) = key.get_value::<String, _>("SteamPath") {
            return Some(PathBuf::from(path));
        }
    }
    None
}

pub fn get_steam_path() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        get_steam_path_windows()
            .or_else(|| {
                // Fallback to default location
                let program_files = std::env::var("ProgramFiles(x86)")
                    .or_else(|_| std::env::var("ProgramFiles"))?;
                Some(PathBuf::from(program_files).join("Steam"))
            })
            .ok_or_else(|| "Steam not found".to_string())
    }
    
    #[cfg(target_os = "macos")]
    {
        dirs::home_dir()
            .map(|h| h.join("Library/Application Support/Steam"))
            .filter(|p| p.exists())
            .ok_or_else(|| "Steam not found".to_string())
    }
    
    #[cfg(target_os = "linux")]
    {
        // Try common Linux Steam locations
        let home = dirs::home_dir().ok_or("Home directory not found")?;
        
        let possible_paths = [
            home.join(".steam/steam"),
            home.join(".local/share/Steam"),
            home.join(".steam/debian-installation"),
            PathBuf::from("/usr/games/steam"),
        ];
        
        for path in &possible_paths {
            if path.exists() {
                return Ok(path.clone());
            }
        }
        
        Err("Steam not found".to_string())
    }
}

fn parse_vdf_value(line: &str) -> Option<String> {
    let line = line.trim();
    let mut quotes = Vec::new();
    for (i, ch) in line.char_indices() {
        if ch == '"' {
            quotes.push(i);
        }
    }
    
    if quotes.len() >= 4 {
        let start = quotes[2] + 1;
        let end = quotes[3];
        Some(line[start..end].to_string())
    } else {
        None
    }
}

fn parse_libraryfolders(steam_path: &PathBuf) -> Result<Vec<PathBuf>, String> {
    let libraryfolders_path = steam_path.join("steamapps").join("libraryfolders.vdf");
    
    if !libraryfolders_path.exists() {
        return Ok(vec![steam_path.join("steamapps")]);
    }
    
    let content = fs::read_to_string(&libraryfolders_path)
        .map_err(|e| format!("Failed to read libraryfolders.vdf: {}", e))?;
    
    let mut libraries = vec![steam_path.join("steamapps")];
    
    for line in content.lines() {
        if line.contains("path") {
            if let Some(path_str) = parse_vdf_value(line) {
                let library_path = PathBuf::from(path_str).join("steamapps");
                if library_path.exists() {
                    libraries.push(library_path);
                }
            }
        }
    }
    
    Ok(libraries)
}

fn parse_acf_file(acf_path: &PathBuf) -> Option<SteamGame> {
    let content = fs::read_to_string(acf_path).ok()?;
    
    let mut app_id = None;
    let mut name = None;
    let mut install_dir = None;
    let mut state = None;
    
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("\"appid\"") {
            app_id = parse_vdf_value(line);
        } else if line.starts_with("\"name\"") {
            name = parse_vdf_value(line);
        } else if line.starts_with("\"installdir\"") {
            install_dir = parse_vdf_value(line);
        } else if line.starts_with("\"StateFlags\"") {
            state = parse_vdf_value(line);
        }
    }
    
    if let (Some(app_id), Some(name)) = (app_id, name) {
        Some(SteamGame {
            app_id,
            name,
            install_dir: install_dir.unwrap_or_default(),
            state: state.unwrap_or_default(),
            cover_art: None,
            logo: None,
        })
    } else {
        None
    }
}

pub async fn scan_steam_games() -> Result<Vec<String>, String> {
    eprintln!("Starting Steam game scan...");
    let steam_path = match get_steam_path() {
        Ok(path) => {
            eprintln!("Steam path found: {:?}", path);
            path
        },
        Err(e) => {
            eprintln!("Steam path not found: {}", e);
            return Ok(vec![]);
        },
    };
    
    let libraries = match parse_libraryfolders(&steam_path) {
        Ok(libs) => {
            eprintln!("Found {} Steam library folders", libs.len());
            libs
        },
        Err(e) => {
            eprintln!("Failed to parse library folders: {}", e);
            return Ok(vec![]);
        },
    };
    
    let mut games = Vec::new();
    
    for library_path in libraries {
        eprintln!("Scanning library: {:?}", library_path);
        if !library_path.exists() {
            eprintln!("Library path does not exist: {:?}", library_path);
            continue;
        }
        
        let entries = match fs::read_dir(&library_path) {
            Ok(entries) => entries,
            Err(e) => {
                eprintln!("Failed to read library directory {:?}: {}", library_path, e);
                continue;
            },
        };
        
        for entry in entries {
            if let Ok(entry) = entry {
                let path = entry.path();
                if let Some(ext) = path.extension() {
                    if ext == "acf" {
                        eprintln!("Found ACF file: {:?}", path);
                        if let Some(game) = parse_acf_file(&path) {
                            eprintln!("Parsed game: {} (ID: {})", game.name, game.app_id);
                            games.push(game.app_id);
                        }
                    }
                }
            }
        }
    }
    
    eprintln!("Steam scan complete: found {} games", games.len());
    Ok(games)
}

pub async fn get_steam_game_details(app_id: &str) -> Result<SteamGame, String> {
    let steam_path = get_steam_path()?;
    let libraries = parse_libraryfolders(&steam_path)?;
    
    for library_path in libraries {
        let acf_path = library_path.join(format!("appmanifest_{}.acf", app_id));
        if acf_path.exists() {
            if let Some(mut game) = parse_acf_file(&acf_path) {
                game.cover_art = Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", app_id));
                game.logo = Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/logo.png", app_id));
                return Ok(game);
            }
        }
    }
    
    Err(format!("Game {} not found", app_id))
}