use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::fs;

fn normalize_hint(value: &str) -> String {
    value
        .to_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { ' ' })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_ace_attorney_game(game_name: &str) -> bool {
    let normalized = normalize_hint(game_name);

    normalized.contains("ace attorney")
        || normalized.contains("phoenix wright")
        || normalized.contains("apollo justice")
        || normalized.contains("great ace attorney")
        || normalized.contains("investigations")
        || normalized.contains("gyakuten")
        || normalized.contains("naruhodou")
        || normalized.contains("miles edgeworth")
}

fn title_hints(game_name: &str) -> Vec<String> {
    let normalized = normalize_hint(game_name);
    let mut hints = Vec::new();

    for token in normalized.split_whitespace() {
        if token.len() >= 3 {
            hints.push(token.to_string());
        }
    }

    if normalized.contains("ace attorney") {
        hints.extend([
            "phoenix".to_string(),
            "wright".to_string(),
            "apollo".to_string(),
            "athena".to_string(),
            "investigations".to_string(),
            "chronicles".to_string(),
            "trilogy".to_string(),
            "capcom".to_string(),
            "turnabout".to_string(),
        ]);
    }

    hints.sort();
    hints.dedup();
    hints
}

fn is_helper_executable(stem: &str) -> bool {
    let stem = stem.to_lowercase();
    [
        "steam",
        "setup",
        "install",
        "launcher",
        "redist",
        "vcredist",
        "dxsetup",
        "directx",
        "dx",
        "unins",
        "uninstall",
        "vc_redist",
        "webview",
    ]
    .iter()
    .any(|bad| stem.contains(bad))
}

fn score_executable_candidate(file_stem: &str, hints: &[String]) -> i32 {
    let normalized = normalize_hint(file_stem);
    let compact = normalized.replace(' ', "");

    if is_helper_executable(&normalized) {
        return -50;
    }

    let mut score = 0;

    for hint in hints {
        let hint_norm = normalize_hint(hint);
        if hint_norm.is_empty() {
            continue;
        }

        if normalized == hint_norm {
            score += 80;
        } else if compact.contains(&hint_norm.replace(' ', "")) {
            score += 25;
        } else if normalized.contains(&hint_norm) {
            score += 15;
        }
    }

    if normalized.contains("trilogy") || normalized.contains("collection") {
        score += 10;
    }

    if normalized.contains("game") && !normalized.contains("launcher") {
        score += 3;
    }

    score
}

fn push_process_name_variants(names: &mut Vec<String>, value: &str) {
    let trimmed = value.trim().trim_matches('"');
    if trimmed.is_empty() {
        return;
    }

    let lower = trimmed.to_lowercase();
    names.push(lower.clone());

    if let Some(stem) = lower.strip_suffix(".exe") {
        if !stem.is_empty() {
            names.push(stem.to_string());
        }
    }
}

fn collect_process_names(install_root: &PathBuf, game_name: &str) -> Vec<String> {
    if !is_ace_attorney_game(game_name) || !install_root.exists() {
        return Vec::new();
    }

    let mut names = Vec::new();
    let mut stack = vec![install_root.clone()];

    while let Some(dir) = stack.pop() {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    stack.push(path);
                    continue;
                }

                let is_exe = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.eq_ignore_ascii_case("exe"))
                    .unwrap_or(false);

                if !is_exe {
                    continue;
                }

                let file_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
                let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");

                if is_helper_executable(file_stem) {
                    continue;
                }

                push_process_name_variants(&mut names, file_name);
                push_process_name_variants(&mut names, file_stem);
            }
        }
    }

    names.sort();
    names.dedup();
    names
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamGame {
    pub app_id: String,
    pub name: String,
    pub install_dir: String,
    pub executable_path: Option<String>,
    pub process_names: Vec<String>,
    pub state: String,
    pub cover_art: Option<String>,
    pub logo: Option<String>,
}

#[cfg(target_os = "windows")]
fn get_steam_path_windows() -> Option<PathBuf> {
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
                    .or_else(|_| std::env::var("ProgramFiles"))
                    .ok()?;
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
            executable_path: None,
                    process_names: Vec::new(),
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
                let install_root = library_path.join("common").join(&game.install_dir);
                if install_root.exists() {
                    game.install_dir = install_root.to_string_lossy().to_string();
                }
                game.executable_path = infer_steam_executable_path(&install_root, &game.name);
                game.process_names = collect_process_names(&install_root, &game.name);
                game.cover_art = Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/header.jpg", app_id));
                game.logo = Some(format!("https://cdn.akamai.steamstatic.com/steam/apps/{}/logo.png", app_id));
                return Ok(game);
            }
        }
    }
    
    Err(format!("Game {} not found", app_id))
}

fn infer_steam_executable_path(install_root: &PathBuf, game_name: &str) -> Option<String> {
    if !install_root.exists() {
        return None;
    }

    let hints = title_hints(game_name);
    let mut best_match: Option<(i32, PathBuf)> = None;

    let mut stack = vec![install_root.clone()];
    while let Some(dir) = stack.pop() {
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    stack.push(path);
                    continue;
                }

                let is_exe = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| e.eq_ignore_ascii_case("exe"))
                    .unwrap_or(false);

                if !is_exe {
                    continue;
                }

                let file_stem = path
                    .file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("")
                    .to_string();

                let score = score_executable_candidate(&file_stem, &hints);

                if score >= 80 {
                    return Some(path.to_string_lossy().to_string());
                }

                match &best_match {
                    Some((best_score, _)) if score <= *best_score => {}
                    _ => best_match = Some((score, path)),
                }
            }
        }
    }

    best_match
        .and_then(|(score, path)| if score >= 0 { Some(path) } else { None })
        .map(|p| p.to_string_lossy().to_string())
}