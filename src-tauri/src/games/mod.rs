pub mod database;
pub mod requirements;

use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqlitePool;
use std::sync::OnceLock;
use uuid::Uuid;
use chrono::Utc;

static DB_POOL: OnceLock<SqlitePool> = OnceLock::new();

pub async fn init_database() -> Result<(), String> {
    use std::fs;
    use std::path::PathBuf;
    
    // Use app data directory or fallback to current directory
    let db_path = if let Ok(app_data) = std::env::var("APPDATA") {
        let app_dir = PathBuf::from(app_data).join("PoliGame");
        fs::create_dir_all(&app_dir)
            .map_err(|e| format!("Failed to create app directory: {}", e))?;
        app_dir.join("poligame.db")
    } else {
        PathBuf::from("poligame.db")
    };
    
    // Convert path to string with proper format for SQLite
    let db_path_str = db_path.to_string_lossy().replace('\\', "/");
    let db_url = format!("sqlite:{}?mode=rwc", db_path_str);
    
    eprintln!("Initializing database at: {}", db_url);
    eprintln!("Database file path: {:?}", db_path);
    eprintln!("Database file exists: {}", db_path.exists());
    
    let pool = SqlitePool::connect(&db_url)
        .await
        .map_err(|e| format!("Failed to connect to database: {}", e))?;
    
    database::init_database(&pool)
        .await
        .map_err(|e| format!("Failed to initialize database: {}", e))?;
    
    // Initialize browser tables
    crate::browser::init_browser_tables(&pool)
        .await
        .map_err(|e| format!("Failed to initialize browser tables: {}", e))?;
    
    DB_POOL.set(pool).map_err(|_| "Database pool already initialized".to_string())?;
    
    eprintln!("Database initialized successfully");
    Ok(())
}

pub fn get_db_pool() -> Result<&'static SqlitePool, String> {
    DB_POOL.get().ok_or("Database not initialized".to_string())
}

fn executable_name_candidates(path: &str) -> Vec<String> {
    let mut candidates = Vec::new();
    let p = std::path::Path::new(path);

    if let Some(file_name) = p.file_name().and_then(|n| n.to_str()) {
        let file_name_lower = file_name.to_lowercase();
        if !file_name_lower.is_empty() {
            candidates.push(file_name_lower.clone());
            let no_exe = file_name_lower.trim_end_matches(".exe").to_string();
            if !no_exe.is_empty() && no_exe != file_name_lower {
                candidates.push(no_exe);
            }
            let no_app = file_name_lower.trim_end_matches(".app").to_string();
            if !no_app.is_empty() && no_app != file_name_lower {
                candidates.push(no_app);
            }
        }
    }

    if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
        let stem_lower = stem.to_lowercase();
        if !stem_lower.is_empty() {
            candidates.push(stem_lower);
        }
    }

    candidates.sort();
    candidates.dedup();
    candidates
}

fn process_matches_executable(process: &sysinfo::Process, path: &str, candidates: &[String]) -> bool {
    let proc_name = process.name().to_lowercase();
    if candidates
        .iter()
        .any(|name| proc_name == *name || proc_name.contains(name))
    {
        return true;
    }

    let target_path = path.to_lowercase();

    if let Some(exe_path) = process.exe().and_then(|p| p.to_str()) {
        let exe_path = exe_path.to_lowercase();

        if target_path.ends_with(".app") {
            let bundle_exec_prefix = format!("{}/contents/macos/", target_path);
            if exe_path.starts_with(&bundle_exec_prefix) || exe_path.starts_with(&target_path) {
                return true;
            }
        } else if exe_path == target_path {
            return true;
        }
    }

    let cmd = process.cmd();
    if !cmd.is_empty() {
        let cmd_str = cmd.join(" ").to_lowercase();
        if cmd_str.contains(&target_path) {
            return true;
        }
    }

    false
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: String,
    pub title: String,
    pub launcher: String,
    pub path: Option<String>,
    pub installed: bool,
    pub cover_art: Option<String>,
    pub grid_cover_art: Option<String>,
    pub logo: Option<String>,
    pub header_art: Option<String>,
    pub icon: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentGame {
    pub game_id: String,
    pub name: String,
}

#[tauri::command]
pub async fn add_custom_app(title: String, executable_path: String) -> Result<String, String> {
    if title.trim().is_empty() {
        return Err("Title cannot be empty".to_string());
    }

    if executable_path.trim().is_empty() {
        return Err("Executable path cannot be empty".to_string());
    }

    let pool = get_db_pool()?;
    let now = Utc::now();
    let game_id = Uuid::new_v4().to_string();

    let record = database::GameRecord {
        id: game_id.clone(),
        launcher: "custom".to_string(),
        launcher_game_id: game_id.clone(),
        title: title.trim().to_string(),
        install_path: Some(executable_path.trim().to_string()),
        cover_art: None,
        griddb_id: None,
        grid_cover_art: None,
        logo: None,
        header_art: None,
        icon: None,
        metadata_json: None,
        playtime_minutes: 0,
        last_played: None,
        created_at: now,
        updated_at: now,
    };

    database::insert_game(pool, &record)
        .await
        .map_err(|e| format!("Failed to add custom app: {}", e))?;

    Ok(game_id)
}

#[tauri::command]
pub async fn get_current_game() -> Result<Option<CurrentGame>, String> {
    let games = get_all_games().await?;

    for game in games {
        if check_game_running(game.id.clone()).await.unwrap_or(false) {
            return Ok(Some(CurrentGame {
                game_id: game.id,
                name: game.title,
            }));
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn get_all_games() -> Result<Vec<Game>, String> {
    let pool = get_db_pool()?;
    let records = database::get_all_games(pool)
        .await
        .map_err(|e| format!("Failed to get games: {}", e))?;
    
    eprintln!("Retrieved {} games from database", records.len());
    
    let games: Vec<Game> = records
        .into_iter()
        .map(|r| {
            eprintln!("Game: id={}, title={}, launcher={}", r.id, r.title, r.launcher);
            // For Steam games, include appId in metadata
            let mut metadata = serde_json::Map::new();
            if r.launcher == "steam" {
                metadata.insert("appId".to_string(), serde_json::Value::String(r.launcher_game_id.clone()));
            }
            let metadata_value = if metadata.is_empty() {
                None
            } else {
                Some(serde_json::Value::Object(metadata))
            };
            
            Game {
                id: r.id,
                title: r.title,
                launcher: r.launcher,
                path: r.install_path.clone(),
                installed: r.install_path.is_some(),
                cover_art: r.cover_art,
                grid_cover_art: r.grid_cover_art,
                logo: r.logo,
                header_art: r.header_art,
                icon: r.icon,
                metadata: metadata_value,
            }
        })
        .collect();
    
    eprintln!("Returning {} games", games.len());
    Ok(games)
}

#[tauri::command]
pub async fn get_game_details(game_id: String) -> Result<Game, String> {
    let pool = get_db_pool()?;
    let record = database::get_game_by_id(pool, &game_id)
        .await
        .map_err(|e| format!("Failed to get game: {}", e))?;
    
    match record {
        Some(r) => {
            // Parse metadata if available
            let metadata = if let Some(metadata_json) = &r.metadata_json {
                serde_json::from_str::<serde_json::Value>(metadata_json).ok()
            } else {
                None
            };
            
            // Create metadata with appId from launcher_game_id for Steam games
            let mut game_metadata = serde_json::Map::new();
            if r.launcher == "steam" {
                game_metadata.insert("appId".to_string(), serde_json::Value::String(r.launcher_game_id.clone()));
            }
            if let Some(meta) = metadata {
                if let serde_json::Value::Object(obj) = meta {
                    for (k, v) in obj {
                        game_metadata.insert(k, v);
                    }
                }
            }
            
            let metadata_value = if game_metadata.is_empty() {
                None
            } else {
                Some(serde_json::Value::Object(game_metadata))
            };
            
            Ok(Game {
                id: r.id,
                title: r.title,
                launcher: r.launcher,
                path: r.install_path.clone(),
                installed: r.install_path.is_some(),
                cover_art: r.cover_art,
                grid_cover_art: r.grid_cover_art,
                logo: r.logo,
                header_art: r.header_art,
                icon: r.icon,
                metadata: metadata_value,
            })
        },
        None => Err("Game not found".to_string()),
    }
}

#[tauri::command]
pub async fn launch_game(game_id: String) -> Result<(), String> {
    let pool = get_db_pool()?;
    let record = database::get_game_by_id(pool, &game_id)
        .await
        .map_err(|e| format!("Failed to get game: {}", e))?;
    
    match record {
        Some(game) => {
            match game.launcher.as_str() {
                "custom" => {
                    let executable = game
                        .install_path
                        .clone()
                        .ok_or_else(|| "Custom game has no executable path".to_string())?;

                    eprintln!("Launching custom game '{}' at {}", game.title, executable);

                    #[cfg(target_os = "windows")]
                    {
                        use std::process::Command;
                        Command::new(&executable)
                            .spawn()
                            .map_err(|e| format!("Failed to launch custom game: {}", e))?;
                    }

                    #[cfg(target_os = "macos")]
                    {
                        use std::process::Command;
                        if executable.to_lowercase().ends_with(".app") {
                            Command::new("open")
                                .arg("-a")
                                .arg(&executable)
                                .spawn()
                                .map_err(|e| format!("Failed to launch .app bundle: {}", e))?;
                        } else {
                            Command::new(&executable)
                                .spawn()
                                .map_err(|e| format!("Failed to launch custom game: {}", e))?;
                        }
                    }

                    #[cfg(all(unix, not(target_os = "macos")))]
                    {
                        use std::process::Command;
                        Command::new(&executable)
                            .spawn()
                            .map_err(|e| format!("Failed to launch custom game: {}", e))?;
                    }

                    eprintln!("Successfully launched custom game: {}", game.title);
                    Ok(())
                },
                "steam" => {
                    // Launch Steam game using steam:// protocol
                    let steam_url = format!("steam://rungameid/{}", game.launcher_game_id);
                    eprintln!("Launching Steam game: {}", steam_url);
                    
                    // Use the shell plugin to open the Steam protocol URL
                    #[cfg(target_os = "windows")]
                    {
                        use std::process::Command;
                        match Command::new("cmd")
                            .args(["/C", "start", "", &steam_url])
                            .spawn()
                        {
                            Ok(_) => {
                                eprintln!("Successfully launched Steam game: {}", game.title);
                                Ok(())
                            },
                            Err(e) => {
                                eprintln!("Failed to launch Steam game: {}", e);
                                Err(format!("Failed to launch game: {}", e))
                            },
                        }
                    }
                    
                    #[cfg(not(target_os = "windows"))]
                    {
                        use std::process::Command;
                        match Command::new("xdg-open")
                            .arg(&steam_url)
                            .spawn()
                        {
                            Ok(_) => {
                                eprintln!("Successfully launched Steam game: {}", game.title);
                                Ok(())
                            },
                            Err(e) => {
                                eprintln!("Failed to launch Steam game: {}", e);
                                Err(format!("Failed to launch game: {}", e))
                            },
                        }
                    }
                },
                "epic" => {
                    // Launch Steam game using steam:// protocol
                    let steam_url = format!("com.epicgames.launcher://apps/{}?action=launch", game.title);
                    eprintln!("Launching Epic game: {}", steam_url);
                    
                    // Use the shell plugin to open the Steam protocol URL
                    #[cfg(target_os = "windows")]
                    {
                        use std::process::Command;
                        match Command::new("cmd")
                            .args(["/C", "start", "", &steam_url])
                            .spawn()
                        {
                            Ok(_) => {
                                eprintln!("Successfully launched Epic game: {}", game.title);
                                Ok(())
                            },
                            Err(e) => {
                                eprintln!("Failed to launch Epic game: {}", e);
                                Err(format!("Failed to launch game: {}", e))
                            },
                        }
                    }
                    
                    #[cfg(not(target_os = "windows"))]
                    {
                        use std::process::Command;
                        match Command::new("xdg-open")
                            .arg(&steam_url)
                            .spawn()
                        {
                            Ok(_) => {
                                eprintln!("Successfully launched Epic game: {}", game.title);
                                Ok(())
                            },
                            Err(e) => {
                                eprintln!("Failed to launch Epic game: {}", e);
                                Err(format!("Failed to launch game: {}", e))
                            },
                        }
                    }
                }
                _ => Err(format!("Game launching for {} launcher is not implemented", game.launcher)),
            }
        },
        None => Err("Game not found".to_string()),
    }
}

#[tauri::command]
pub async fn check_game_running(game_id: String) -> Result<bool, String> {
    let pool = get_db_pool()?;
    let record = database::get_game_by_id(pool, &game_id)
        .await
        .map_err(|e| format!("Failed to get game: {}", e))?;
    
    match record {
        Some(game) => {
            use sysinfo::System;
            let mut system = System::new_all();
            system.refresh_all();
            
            match game.launcher.as_str() {
                "custom" => {
                    if let Some(path) = &game.install_path {
                        let candidates = executable_name_candidates(path);
                        if !candidates.is_empty() {
                            return Ok(system.processes().values().any(|p| {
                                process_matches_executable(p, path, &candidates)
                            }));
                        }
                    }
                    Ok(false)
                },
                "steam" => {
                    // For Steam games, check if Steam is running and if the game process is running
                    let steam_app_id = &game.launcher_game_id;
                    
                    // Check if Steam client is running
                    let steam_running = system.processes()
                        .values()
                        .any(|p| {
                            p.name().to_lowercase().contains("steam")
                        });
                    
                    if !steam_running {
                        return Ok(false);
                    }
                    
                    // For Steam games, check if the game executable is running
                    if let Some(path) = &game.install_path {
                        let exe_name = std::path::Path::new(path)
                            .file_name()
                            .and_then(|n| n.to_str())
                            .map(|s| s.to_lowercase())
                            .unwrap_or_default();
                        
                        if !exe_name.is_empty() {
                            // Remove .exe extension for comparison
                            let exe_name_no_ext = exe_name.trim_end_matches(".exe");
                            
                            // Check if any process matches the executable name
                            for process in system.processes().values() {
                                let proc_name = process.name().to_lowercase();
                                if proc_name == exe_name || proc_name == exe_name_no_ext {
                                    // Additional check: verify it's related to Steam
                                    let cmd = process.cmd();
                                    if !cmd.is_empty() {
                                        let cmd_str = cmd.join(" ").to_lowercase();
                                        if cmd_str.contains("steam") || cmd_str.contains(steam_app_id) {
                                            return Ok(true);
                                        }
                                    }
                                    // If no command line but name matches, assume it's the game
                                    return Ok(true);
                                }
                            }
                        }
                    }
                    
                    // Fallback: check if any process has the app ID in its command line
                    for process in system.processes().values() {
                        let cmd = process.cmd();
                        if !cmd.is_empty() {
                            let cmd_str = cmd.join(" ").to_lowercase();
                            if cmd_str.contains(&steam_app_id.to_lowercase()) {
                                return Ok(true);
                            }
                        }
                    }
                    
                    Ok(false)
                },
                "epic" => {
                    // Check if Epic Games Launcher is running
                    let epic_running = system.processes()
                        .values()
                        .any(|p| {
                            let name = p.name().to_lowercase();
                            name.contains("epicgameslauncher")
                        });
                    
                    if !epic_running {
                        return Ok(false);
                    }
                    
                    // Check if game executable is running
                    if let Some(path) = &game.install_path {
                        let exe_name = std::path::Path::new(path)
                            .file_name()
                            .and_then(|n| n.to_str())
                            .map(|s| s.to_lowercase())
                            .unwrap_or_default();
                        
                        if !exe_name.is_empty() {
                            let exe_name_no_ext = exe_name.trim_end_matches(".exe");
                            return Ok(system.processes()
                                .values()
                                .any(|p| {
                                    let proc_name = p.name().to_lowercase();
                                    proc_name == exe_name || proc_name == exe_name_no_ext
                                }));
                        }
                    }
                    
                    Ok(false)
                },
                _ => {
                    // For other launchers, check if the game executable is running
                    if let Some(path) = &game.install_path {
                        let candidates = executable_name_candidates(path);

                        if !candidates.is_empty() {
                            return Ok(system.processes().values().any(|p| {
                                process_matches_executable(p, path, &candidates)
                            }));
                        }
                    }
                    Ok(false)
                }
            }
        },
        None => Ok(false),
    }
}

#[tauri::command]
pub async fn kill_game_process(game_id: String) -> Result<(), String> {
    let pool = get_db_pool()?;
    let record = database::get_game_by_id(pool, &game_id)
        .await
        .map_err(|e| format!("Failed to get game: {}", e))?;
    
    match record {
        Some(game) => {
            use sysinfo::{System, Pid};
            let mut system = System::new_all();
            system.refresh_all();
            
            let mut killed = false;
            
            match game.launcher.as_str() {
                "custom" => {
                    if let Some(path) = &game.install_path {
                        let candidates = executable_name_candidates(path);

                        if !candidates.is_empty() {
                            let pids_to_kill: Vec<Pid> = system
                                .processes()
                                .iter()
                                .filter(|(_, process)| {
                                    process_matches_executable(process, path, &candidates)
                                })
                                .map(|(pid, _)| *pid)
                                .collect();

                            for pid in pids_to_kill {
                                if let Some(process) = system.process(pid) {
                                    if process.kill() {
                                        killed = true;
                                    }
                                }
                            }
                        }
                    }
                },
                "steam" => {
                    let steam_app_id = &game.launcher_game_id;
                    
                    // Try to find and kill processes related to this Steam game
                    if let Some(path) = &game.install_path {
                        let exe_name = std::path::Path::new(path)
                            .file_name()
                            .and_then(|n| n.to_str())
                            .map(|s| s.to_lowercase())
                            .unwrap_or_default();
                        
                        if !exe_name.is_empty() {
                            let exe_name_no_ext = exe_name.trim_end_matches(".exe");
                            
                            let pids_to_kill: Vec<Pid> = system.processes()
                                .iter()
                                .filter(|(_, process)| {
                                    let proc_name = process.name().to_lowercase();
                                    if proc_name == exe_name || proc_name == exe_name_no_ext {
                                        let cmd = process.cmd();
                                        if !cmd.is_empty() {
                                            let cmd_str = cmd.join(" ").to_lowercase();
                                            cmd_str.contains("steam") || cmd_str.contains(&steam_app_id.to_lowercase())
                                        } else {
                                            true
                                        }
                                    } else {
                                        false
                                    }
                                })
                                .map(|(pid, _)| *pid)
                                .collect();
                            
                            for pid in pids_to_kill {
                                if let Some(process) = system.process(pid) {
                                    if process.kill() {
                                        killed = true;
                                    }
                                }
                            }
                        }
                    }
                    
                    // Also check for processes with app ID in command line
                    let pids_to_kill: Vec<Pid> = system.processes()
                        .iter()
                        .filter(|(_, process)| {
                            let cmd = process.cmd();
                            if !cmd.is_empty() {
                                let cmd_str = cmd.join(" ").to_lowercase();
                                cmd_str.contains(&steam_app_id.to_lowercase())
                            } else {
                                false
                            }
                        })
                        .map(|(pid, _)| *pid)
                        .collect();
                    
                    for pid in pids_to_kill {
                        if let Some(process) = system.process(pid) {
                            if process.kill() {
                                killed = true;
                            }
                        }
                    }
                },
                "epic" => {
                    if let Some(path) = &game.install_path {
                        let exe_name = std::path::Path::new(path)
                            .file_name()
                            .and_then(|n| n.to_str())
                            .map(|s| s.to_lowercase())
                            .unwrap_or_default();
                        
                        if !exe_name.is_empty() {
                            let exe_name_no_ext = exe_name.trim_end_matches(".exe");
                            
                            let pids_to_kill: Vec<Pid> = system.processes()
                                .iter()
                                .filter(|(_, process)| {
                                    let proc_name = process.name().to_lowercase();
                                    proc_name == exe_name || proc_name == exe_name_no_ext
                                })
                                .map(|(pid, _)| *pid)
                                .collect();
                            
                            for pid in pids_to_kill {
                                if let Some(process) = system.process(pid) {
                                    if process.kill() {
                                        killed = true;
                                    }
                                }
                            }
                        }
                    }
                },
                _ => {
                    if let Some(path) = &game.install_path {
                        let candidates = executable_name_candidates(path);

                        if !candidates.is_empty() {
                            let pids_to_kill: Vec<Pid> = system
                                .processes()
                                .iter()
                                .filter(|(_, process)| {
                                    process_matches_executable(process, path, &candidates)
                                })
                                .map(|(pid, _)| *pid)
                                .collect();

                            for pid in pids_to_kill {
                                if let Some(process) = system.process(pid) {
                                    if process.kill() {
                                        killed = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            
            if killed {
                Ok(())
            } else {
                Err("No game process found to kill".to_string())
            }
        },
        None => Err("Game not found".to_string()),
    }
}

#[tauri::command]
pub async fn get_game_achievements(game_id: String) -> Result<Vec<serde_json::Value>, String> {
    eprintln!("=== get_game_achievements called with game_id: {} ===", game_id);
    let pool = get_db_pool()?;
    let achievements = database::get_game_achievements(pool, &game_id)
        .await
        .map_err(|e| format!("Failed to get achievements: {}", e))?;
    
    eprintln!("Retrieved {} achievements for game_id: {}", achievements.len(), game_id);
    // Verify all achievements belong to the requested game_id
    for ach in &achievements {
        if ach.game_id != game_id {
            eprintln!("ERROR: Achievement {} belongs to game_id {} but was requested for {}", 
                ach.id, ach.game_id, game_id);
        }
    }
    
    let json_achievements: Vec<serde_json::Value> = achievements
        .into_iter()
        .filter(|a| a.game_id == game_id) // Extra safety: filter by game_id
        .map(|a| serde_json::json!({
            "id": a.id,
            "gameId": a.game_id, // CRITICAL: Include gameId in response for frontend filtering
            "name": a.name,
            "description": a.description,
            "unlocked": a.unlocked,
            "unlockedDate": a.unlocked_date,
            "progress": a.progress,
            "maxProgress": a.max_progress,
            "icon": a.icon,
        }))
        .collect();
    
    eprintln!("Returning {} achievements for game_id: {}", json_achievements.len(), game_id);
    Ok(json_achievements)
}

// Fetch Steam achievements without saving to database (for state-only storage)
#[tauri::command]
pub async fn fetch_steam_achievements_no_db(
    game_id: String,
    steam_user_id: String,
    steam_app_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    use crate::steam_api;
    
    eprintln!("=== fetch_steam_achievements_no_db called ===");
    eprintln!("game_id: {}", game_id);
    eprintln!("steam_user_id: {}", steam_user_id);
    eprintln!("steam_app_id: {}", steam_app_id);
    
    // Get Steam API key
    let api_key = crate::api_keys::get_steam_api_key()?;
    
    // Fetch achievements from Steam Web API
    let achievements = match steam_api::get_player_achievements(&api_key, &steam_user_id, &steam_app_id).await {
        Ok(ach) => {
            if ach.is_empty() {
                eprintln!("No achievements found for game_id: {} (steam_app_id: {})", game_id, steam_app_id);
            }
            ach
        },
        Err(e) => {
            // If it's a "no stats" error, treat as empty achievements
            if e.contains("no stats") || e.contains("Requested app has no stats") {
                eprintln!("Game has no achievements (steam_app_id: {}): {}", steam_app_id, e);
                Vec::new()
            } else {
                return Err(format!("Failed to fetch Steam achievements: {}", e));
            }
        },
    };
    
    // Fetch achievement schema (names, descriptions, icons)
    eprintln!("=== FETCHING SCHEMA FOR APP ID: {} ===", steam_app_id);
    let schema_achievements = steam_api::get_schema_for_game(&api_key, &steam_app_id)
        .await
        .unwrap_or_else(|e| {
            eprintln!("ERROR: Failed to fetch schema: {}", e);
            Vec::new()
        });
    eprintln!("=== SCHEMA FETCHED: {} achievements ===", schema_achievements.len());
    
    // Create a map of schema achievements by name (apiname)
    let mut schema_map: std::collections::HashMap<String, &steam_api::AchievementSchemaEntry> = std::collections::HashMap::new();
    for schema_achievement in &schema_achievements {
        schema_map.insert(schema_achievement.name.clone(), schema_achievement);
    }
    
    // Fetch global achievement percentages
    let global_percentages = steam_api::get_global_achievement_percentages(&steam_app_id)
        .await
        .unwrap_or_default();
    
    // Create a map of global percentages by achievement name (apiname)
    let mut global_map: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    for a in &global_percentages {
        global_map.insert(a.name.clone(), a.percent);
    }
    
    // Convert to JSON (DO NOT save to database)
    let mut json_achievements = Vec::new();
    
    for achievement in achievements {
        let global_percent = global_map.get(&achievement.apiname).copied().unwrap_or(0.0);
        let schema_entry = schema_map.get(&achievement.apiname);
        let is_unlocked = achievement.achieved == 1;
        
        // Use schema displayName if available, otherwise fall back to apiname
        let achievement_name = if let Some(schema) = schema_entry {
            schema.display_name.as_ref()
                .filter(|s| !s.is_empty())
                .map(|s| s.clone())
                .unwrap_or_else(|| achievement.apiname.clone())
        } else {
            achievement.apiname.clone()
        };
        
        let achievement_description = schema_entry
            .and_then(|s| s.description.as_ref())
            .cloned();
        
        // Use icon for unlocked, icongray for locked
        let achievement_icon = if let Some(schema) = schema_entry {
            if is_unlocked {
                schema.icon.clone().or_else(|| {
                    Some(format!("https://cdn.steamstatic.com/steamcommunity/public/images/apps/{}/{}.jpg", 
                        steam_app_id, achievement.apiname))
                })
            } else {
                schema.icon_gray.clone().or_else(|| {
                    Some(format!("https://cdn.steamstatic.com/steamcommunity/public/images/apps/{}/{}_gray.jpg", 
                        steam_app_id, achievement.apiname))
                })
            }
        } else {
            Some(format!("https://cdn.steamstatic.com/steamcommunity/public/images/apps/{}/{}.jpg", 
                steam_app_id, achievement.apiname))
        };
        
        json_achievements.push(serde_json::json!({
            "id": format!("{}_{}", game_id, achievement.apiname),
            "gameId": game_id.clone(), // Include gameId for filtering
            "name": achievement_name,
            "description": achievement_description,
            "unlocked": is_unlocked,
            "unlockedDate": achievement.unlocktime,
            "progress": None::<i64>,
            "maxProgress": None::<i64>,
            "icon": achievement_icon,
            "globalUnlockPercentage": global_percent,
        }));
    }
    
    Ok(json_achievements)
}

#[tauri::command]
pub async fn fetch_steam_achievements(
    game_id: String,
    steam_user_id: String,
    steam_app_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    use crate::steam_api;
    use crate::games::database;
    use uuid::Uuid;
    
    eprintln!("=== fetch_steam_achievements called ===");
    eprintln!("game_id: {}", game_id);
    eprintln!("steam_user_id: {}", steam_user_id);
    eprintln!("steam_app_id: {}", steam_app_id);
    
    // Get Steam API key
    let api_key = crate::api_keys::get_steam_api_key()?;
    
    // Fetch achievements from Steam Web API
    let achievements = match steam_api::get_player_achievements(&api_key, &steam_user_id, &steam_app_id).await {
        Ok(ach) => {
            if ach.is_empty() {
                eprintln!("No achievements found for game_id: {} (steam_app_id: {})", game_id, steam_app_id);
                // Clear any existing achievements for this game from the database
                let pool = get_db_pool()?;
                if let Err(e) = database::delete_game_achievements(pool, &game_id).await {
                    eprintln!("Warning: Failed to clear old achievements: {}", e);
                }
            }
            ach
        },
        Err(e) => {
            // If it's a "no stats" error, treat as empty achievements
            if e.contains("no stats") || e.contains("Requested app has no stats") {
                eprintln!("Game has no achievements (steam_app_id: {}): {}", steam_app_id, e);
                // Clear any existing achievements for this game from the database
                let pool = get_db_pool()?;
                if let Err(db_err) = database::delete_game_achievements(pool, &game_id).await {
                    eprintln!("Warning: Failed to clear old achievements: {}", db_err);
                }
                Vec::new()
            } else {
                return Err(format!("Failed to fetch Steam achievements: {}", e));
            }
        },
    };
    
    // Fetch achievement schema (names, descriptions, icons)
    eprintln!("=== FETCHING SCHEMA FOR APP ID: {} ===", steam_app_id);
    let schema_achievements = steam_api::get_schema_for_game(&api_key, &steam_app_id)
        .await
        .unwrap_or_else(|e| {
            eprintln!("ERROR: Failed to fetch schema: {}", e);
            Vec::new()
        });
    eprintln!("=== SCHEMA FETCHED: {} achievements ===", schema_achievements.len());
    
    eprintln!("Fetched {} schema achievements", schema_achievements.len());
    
    // Create a map of schema achievements by name (apiname)
    let mut schema_map: std::collections::HashMap<String, &steam_api::AchievementSchemaEntry> = std::collections::HashMap::new();
    for schema_achievement in &schema_achievements {
        schema_map.insert(schema_achievement.name.clone(), schema_achievement);
        eprintln!("Schema entry: name={}, displayName={:?}, icon={:?}, icongray={:?}", 
            schema_achievement.name, 
            schema_achievement.display_name,
            schema_achievement.icon,
            schema_achievement.icon_gray);
    }
    
    eprintln!("Schema map size: {}, Processing {} player achievements", schema_map.len(), achievements.len());
    
    // Fetch global achievement percentages
    let global_percentages = steam_api::get_global_achievement_percentages(&steam_app_id)
        .await
        .unwrap_or_default();
    
    // Create a map of global percentages by achievement name (apiname)
    let mut global_map: std::collections::HashMap<String, f64> = std::collections::HashMap::new();
    for a in &global_percentages {
        global_map.insert(a.name.clone(), a.percent);
    }
    
    // Convert to JSON and save to database
    let pool = get_db_pool()?;
    
    // If there are no achievements, clear any existing ones for this game and return empty
    if achievements.is_empty() {
        eprintln!("No achievements to process for game_id: {}, clearing existing achievements", game_id);
        if let Err(e) = database::delete_game_achievements(&pool, &game_id).await {
            eprintln!("Warning: Failed to clear old achievements: {}", e);
        }
        return Ok(Vec::new());
    }
    
    // Clear old achievements before saving new ones
    if let Err(e) = database::delete_game_achievements(&pool, &game_id).await {
        eprintln!("Warning: Failed to clear old achievements: {}", e);
    }
    
    let mut json_achievements = Vec::new();
    
    for achievement in achievements {
        let global_percent = global_map.get(&achievement.apiname).copied().unwrap_or(0.0);
        
        eprintln!("Processing achievement: apiname={}", achievement.apiname);
        
        // Get schema data for this achievement
        let schema_entry = schema_map.get(&achievement.apiname);
        let is_unlocked = achievement.achieved == 1;
        
        if schema_entry.is_none() {
            eprintln!("Warning: No schema entry for apiname: {}", achievement.apiname);
        }
        
        // Use schema displayName if available, otherwise fall back to apiname
        let achievement_name = if let Some(schema) = schema_entry {
            // Prefer displayName from schema
            let name = schema.display_name.as_ref()
                .filter(|s| !s.is_empty())
                .map(|s| s.clone())
                .unwrap_or_else(|| {
                    // If displayName is missing, use the apiname (not schema.name which is the same)
                    eprintln!("Schema entry found but displayName is missing, using apiname: {}", achievement.apiname);
                    achievement.apiname.clone()
                });
            eprintln!("Using achievement name: {} (displayName from schema for apiname: {})", name, achievement.apiname);
            name
        } else {
            // No schema entry found, use apiname
            eprintln!("Warning: No schema entry found for achievement apiname: {}, using apiname as name", achievement.apiname);
            achievement.apiname.clone()
        };
        
        let achievement_description = schema_entry
            .and_then(|s| s.description.as_ref())
            .cloned();
        
        // Use icon for unlocked, icongray for locked
        let achievement_icon = if let Some(schema) = schema_entry {
            if is_unlocked {
                schema.icon.clone().or_else(|| {
                    eprintln!("No icon in schema for unlocked achievement: {}", achievement.apiname);
                    Some(format!("https://cdn.steamstatic.com/steamcommunity/public/images/apps/{}/{}.jpg", 
                        steam_app_id, achievement.apiname))
                })
            } else {
                schema.icon_gray.clone().or_else(|| {
                    eprintln!("No icongray in schema for locked achievement: {}", achievement.apiname);
                    Some(format!("https://cdn.steamstatic.com/steamcommunity/public/images/apps/{}/{}_gray.jpg", 
                        steam_app_id, achievement.apiname))
                })
            }
        } else {
            // No schema, use fallback URL
            Some(format!("https://cdn.steamstatic.com/steamcommunity/public/images/apps/{}/{}.jpg", 
                steam_app_id, achievement.apiname))
        };
        
        eprintln!("Achievement icon URL: {:?}", achievement_icon);
        
        // Save to database - ensure we're using the correct game_id
        // CRITICAL: Log to verify we're saving with the correct game_id
        eprintln!("Saving achievement for game_id: {}, steam_app_id: {}, achievement: {}, name: {}", 
            game_id, steam_app_id, achievement.apiname, achievement_name);
        let achievement_record = database::AchievementRecord {
            id: Uuid::new_v4().to_string(),
            game_id: game_id.clone(),
            achievement_id: achievement.apiname.clone(),
            name: achievement_name.clone(),
            description: achievement_description.clone(),
            unlocked: achievement.achieved == 1,
            unlocked_date: if achievement.achieved == 1 && achievement.unlocktime > 0 {
                chrono::DateTime::from_timestamp(achievement.unlocktime as i64, 0)
            } else {
                None
            },
            progress: None,
            max_progress: None,
            icon: achievement_icon.clone(),
        };
        
        // Insert achievement
        if let Err(e) = database::insert_achievement(&pool, &achievement_record).await {
            eprintln!("Failed to insert achievement: {}", e);
        }
        
        json_achievements.push(serde_json::json!({
            "id": achievement_record.id,
            "gameId": game_id.clone(), // CRITICAL: Include gameId for frontend filtering
            "name": achievement_name,
            "description": achievement_description,
            "unlocked": is_unlocked,
            "unlockedDate": achievement.unlocktime,
            "progress": None::<i64>,
            "maxProgress": None::<i64>,
            "icon": achievement_icon,
            "globalUnlockPercentage": global_percent,
        }));
    }
    
    Ok(json_achievements)
}

#[tauri::command]
pub async fn fetch_steam_news(
    app_id: String,
) -> Result<Vec<serde_json::Value>, String> {
    use crate::steam_api;
    
    eprintln!("=== fetch_steam_news called for app_id: {} ===", app_id);
    
    let news_items = steam_api::get_news_for_app(&app_id, Some(10))
        .await
        .map_err(|e| format!("Failed to fetch Steam news: {}", e))?;
    
    let json_news: Vec<serde_json::Value> = news_items
        .into_iter()
        .map(|item| serde_json::json!({
            "gid": item.gid,
            "title": item.title,
            "url": item.url,
            "isExternalUrl": item.is_external_url,
            "author": item.author,
            "contents": item.contents,
            "feedLabel": item.feedlabel,
            "date": item.date,
            "feedName": item.feedname,
            "feedType": item.feed_type,
            "appId": item.appid,
        }))
        .collect();
    
    eprintln!("Returning {} news items for app_id: {}", json_news.len(), app_id);
    Ok(json_news)
}

#[tauri::command]
pub async fn get_steam_requirements(app_id: String) -> Result<serde_json::Value, String> {
    let requirements = requirements::get_steam_requirements(&app_id).await?;
    
    Ok(serde_json::json!({
        "minimum": requirements.minimum,
        "recommended": requirements.recommended,
    }))
}
