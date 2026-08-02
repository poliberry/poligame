pub mod database;
pub mod requirements;

use serde::{Deserialize, Serialize};
use sqlx::sqlite::SqlitePool;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use uuid::Uuid;
use chrono::Utc;
use std::path::PathBuf;

static DB_POOL: OnceLock<SqlitePool> = OnceLock::new();
static LAUNCH_IN_PROGRESS: AtomicBool = AtomicBool::new(false);

pub async fn init_database() -> Result<(), String> {
    use std::fs;
    use std::path::PathBuf;
    
    // Use cross-platform data directory (dirs::data_dir handles Windows, macOS, Linux).
    // On Linux/AppImage this resolves to ~/.local/share/PoliGame/ instead of the
    // read-only AppImage mount, so SQLite can actually create and write the DB file.
    let data_dir = dirs::data_dir()
        .ok_or_else(|| "Failed to locate platform data directory".to_string())?
        .join("PoliGame");

    fs::create_dir_all(&data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;

    let db_path = data_dir.join("poligame.db");
    
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

    if p.is_dir() {
        return candidates;
    }

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

fn push_name_variants(candidates: &mut Vec<String>, value: &str) {
    let trimmed = value.trim().trim_matches('"');
    if trimmed.is_empty() {
        return;
    }

    let lower = trimmed.to_lowercase();
    candidates.push(lower.clone());

    if let Some(stem) = lower.strip_suffix(".exe") {
        if !stem.is_empty() {
            candidates.push(stem.to_string());
        }
    }
}

fn metadata_process_name_candidates(game: &database::GameRecord) -> Vec<String> {
    let mut candidates = Vec::new();

    let metadata_json = match &game.metadata_json {
        Some(metadata_json) => metadata_json,
        None => return candidates,
    };

    let metadata = match serde_json::from_str::<serde_json::Value>(metadata_json) {
        Ok(metadata) => metadata,
        Err(_) => return candidates,
    };

    for key in ["process_names", "processNames"] {
        if let Some(values) = metadata.get(key).and_then(|value| value.as_array()) {
            for value in values {
                if let Some(name) = value.as_str() {
                    push_name_variants(&mut candidates, name);
                }
            }
        }
    }

    candidates.sort();
    candidates.dedup();
    candidates
}

fn runtime_process_candidates(game: &database::GameRecord) -> Vec<String> {
    let mut candidates = Vec::new();

    if let Some(path) = runtime_executable_path(game) {
        candidates.extend(executable_name_candidates(path));
    }

    candidates.extend(metadata_process_name_candidates(game));

    candidates.sort();
    candidates.dedup();
    candidates
}

fn is_game_running_record(game: &database::GameRecord) -> bool {
    let Some(path) = runtime_executable_path(game) else {
        return false;
    };

    let candidates = runtime_process_candidates(game);
    if candidates.is_empty() {
        return false;
    }

    let mut system = System::new_all();
    system.refresh_all();

    system
        .processes()
        .values()
        .any(|process| process_matches_executable(process, path, &candidates))
}

fn latest_matching_process_start_time(
    game: &database::GameRecord,
    system: &System,
) -> Option<u64> {
    let path = runtime_executable_path(game)?;
    let candidates = runtime_process_candidates(game);
    if candidates.is_empty() {
        return None;
    }

    system
        .processes()
        .values()
        .filter(|process| {
            !is_launcher_process(process.name())
                && process_matches_executable(process, path, &candidates)
        })
        .map(|process| process.start_time())
        .max()
}

fn process_matches_executable(process: &sysinfo::Process, path: &str, candidates: &[String]) -> bool {
    let target = std::path::Path::new(path);

    let normalize = |s: &str| s.to_lowercase().replace('\\', "/");
    let target_norm = normalize(path).trim_end_matches('/').to_string();
    let target_dir_prefix = format!("{}/", target_norm);
    let proc_name = normalize(process.name());
    let proc_stem = process
        .exe()
        .and_then(|p| p.file_stem())
        .and_then(|s| s.to_str())
        .map(normalize)
        .unwrap_or_default();
    let proc_file = process
        .exe()
        .and_then(|p| p.file_name())
        .and_then(|s| s.to_str())
        .map(normalize)
        .unwrap_or_default();

    let name_matches = |candidate: &str| {
        let candidate = normalize(candidate);
        if candidate.is_empty() {
            return false;
        }
        // Exact matches are always valid.
        if proc_name == candidate || proc_stem == candidate || proc_file == candidate {
            return true;
        }
        // For substring matching, use the stem (extension stripped) both for the
        // length gate and the actual search.  Checking the full filename (e.g.
        // "ace.exe") against proc_name would let "space.exe".contains("ace.exe")
        // slip through even though the stem "ace" is only 3 characters.
        let candidate_stem = candidate
            .strip_suffix(".exe")
            .or_else(|| candidate.strip_suffix(".app"))
            .unwrap_or(&candidate);
        candidate_stem.chars().count() >= 5
            && (proc_name.contains(candidate_stem)
                || proc_stem.contains(candidate_stem)
                || proc_file.contains(candidate_stem))
    };

    // If only a game install directory is available, match processes whose executable
    // lives inside that directory (prevents sticky false positives from launcher args).
    if target.is_dir() {
        if let Some(exe_path) = process.exe().and_then(|p| p.to_str()) {
            let exe_norm = normalize(exe_path);
            if exe_norm.starts_with(&target_dir_prefix) {
                return true;
            }
        }
    }

    // macOS app bundle support.
    if target_norm.ends_with(".app") {
        if let Some(exe_path) = process.exe().and_then(|p| p.to_str()) {
            let exe_norm = normalize(exe_path);
            let bundle_exec_prefix = format!("{}/contents/macos/", target_norm);
            return exe_norm.starts_with(&bundle_exec_prefix) || exe_norm.starts_with(&target_norm);
        }
        return false;
    }

    if let Some(exe_path) = process.exe().and_then(|p| p.to_str()) {
        let exe_norm = normalize(exe_path);
        if exe_norm == target_norm {
            return true;
        }
    }

    candidates.iter().any(|candidate| name_matches(candidate))
}

fn runtime_executable_path(game: &database::GameRecord) -> Option<&str> {
    game.executable_path
        .as_deref()
        .or(game.install_path.as_deref())
}

fn is_launcher_process(name: &str) -> bool {
    let name = name.to_lowercase();
    name.contains("steam")
        || name.contains("epicgameslauncher")
        || name.contains("eadesktop")
        || name.contains("origin")
        || name.contains("rockstar")
        || name.contains("launcher")
}

fn parse_command_arguments(input: &str) -> Result<Vec<String>, String> {
    let mut args = Vec::new();
    let mut current = String::new();
    let mut in_single = false;
    let mut in_double = false;
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        if ch == '\\' {
            if in_single {
                current.push(ch);
                continue;
            }

            let next = chars.peek().copied();
            let should_escape = matches!(next, Some('"')) || (in_double && matches!(next, Some('\\')));

            if should_escape {
                current.push(chars.next().unwrap());
            } else {
                current.push(ch);
            }

            continue;
        }

        match ch {
            '"' if !in_single => in_double = !in_double,
            '\'' if !in_double => in_single = !in_single,
            c if c.is_whitespace() && !in_single && !in_double => {
                if !current.is_empty() {
                    args.push(std::mem::take(&mut current));
                }
            }
            _ => current.push(ch),
        }
    }

    if in_single || in_double {
        return Err("Launch arguments contain unmatched quotes".to_string());
    }

    if !current.is_empty() {
        args.push(current);
    }

    Ok(args)
}

fn normalize_launch_arguments(input: Option<String>) -> Option<String> {
    input
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledProgram {
    pub name: String,
    pub executable_path: String,
    pub install_location: Option<String>,
    pub publisher: Option<String>,
    pub source: String,
}

#[cfg(target_os = "windows")]
#[derive(Debug, Clone)]
struct InstalledProgramMetadata {
    name: String,
    install_location: Option<String>,
    publisher: Option<String>,
}

#[cfg(target_os = "windows")]
fn normalize_registry_path_key(path: &str) -> String {
    path
        .trim()
        .trim_matches('"')
        .replace('/', "\\")
        .to_lowercase()
}

#[cfg(target_os = "windows")]
fn parse_launchable_executable(raw: &str) -> Option<String> {
    let trimmed = raw.trim().trim_matches('"').split(',').next().unwrap_or("").trim();
    if trimmed.is_empty() {
        return None;
    }

    let path = PathBuf::from(trimmed);
    if path.exists() && path.is_file() {
        return Some(path.to_string_lossy().to_string());
    }

    if trimmed.to_lowercase().ends_with(".exe") {
        return Some(trimmed.to_string());
    }

    None
}

#[cfg(target_os = "windows")]
fn push_installed_program(
    programs: &mut Vec<InstalledProgram>,
    name: String,
    executable_path: String,
    install_location: Option<String>,
    publisher: Option<String>,
    source: &str,
) {
    if name.trim().is_empty() || executable_path.trim().is_empty() {
        return;
    }

    programs.push(InstalledProgram {
        name,
        executable_path,
        install_location,
        publisher,
        source: source.to_string(),
    });
}

#[cfg(target_os = "windows")]
fn scan_registry_uninstall_entries(
    root: &winreg::RegKey,
    key_path: &str,
    executable_metadata: &mut std::collections::HashMap<String, InstalledProgramMetadata>,
    install_metadata: &mut std::collections::HashMap<String, InstalledProgramMetadata>,
) {
    if let Ok(uninstall_root) = root.open_subkey(key_path) {
        for entry in uninstall_root.enum_keys().flatten() {
            let Ok(program_key) = uninstall_root.open_subkey(&entry) else {
                continue;
            };

            let Some(name) = program_key
                .get_value::<String, _>("DisplayName")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty())
            else {
                continue;
            };

            let install_location = program_key
                .get_value::<String, _>("InstallLocation")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty());

            let publisher = program_key
                .get_value::<String, _>("Publisher")
                .ok()
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty());

            let metadata = InstalledProgramMetadata {
                name,
                install_location: install_location.clone(),
                publisher: publisher.clone(),
            };

            if let Some(display_icon) = program_key.get_value::<String, _>("DisplayIcon").ok() {
                if let Some(executable_path) = parse_launchable_executable(&display_icon) {
                    executable_metadata.insert(normalize_registry_path_key(&executable_path), metadata.clone());
                }
            }

            if let Some(location) = install_location {
                install_metadata.insert(normalize_registry_path_key(&location), metadata);
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn scan_registry_app_paths(
    programs: &mut Vec<InstalledProgram>,
    root: &winreg::RegKey,
    key_path: &str,
    executable_metadata: &std::collections::HashMap<String, InstalledProgramMetadata>,
    install_metadata: &std::collections::HashMap<String, InstalledProgramMetadata>,
    source: &str,
) {
    use std::path::Path;

    if let Ok(app_paths) = root.open_subkey(key_path) {
        for key_name in app_paths.enum_keys().flatten() {
            if let Ok(program_key) = app_paths.open_subkey(&key_name) {
                let default_name = key_name.trim().trim_end_matches(".exe").to_string();
                let executable_path = program_key
                    .get_value::<String, _>("")
                    .ok()
                    .and_then(|value| parse_launchable_executable(&value));

                let Some(executable_path) = executable_path else {
                    continue;
                };

                let executable_key = normalize_registry_path_key(&executable_path);
                let metadata_by_exe = executable_metadata.get(&executable_key);

                let path = Path::new(&executable_path);
                let executable_dir_key = path
                    .parent()
                    .map(|parent| normalize_registry_path_key(&parent.to_string_lossy()));

                let metadata_by_install = program_key
                    .get_value::<String, _>("InstallLocation")
                    .ok()
                    .map(|value| normalize_registry_path_key(&value))
                    .and_then(|key| install_metadata.get(&key))
                    .or_else(|| {
                        executable_dir_key
                            .as_ref()
                            .and_then(|key| install_metadata.get(key))
                    });

                let name = program_key
                    .get_value::<String, _>("DisplayName")
                    .ok()
                    .filter(|value| !value.trim().is_empty())
                    .or_else(|| metadata_by_exe.map(|meta| meta.name.clone()))
                    .or_else(|| metadata_by_install.map(|meta| meta.name.clone()))
                    .unwrap_or(default_name);
                let install_location = program_key
                    .get_value::<String, _>("InstallLocation")
                    .ok()
                    .or_else(|| metadata_by_exe.and_then(|meta| meta.install_location.clone()))
                    .or_else(|| metadata_by_install.and_then(|meta| meta.install_location.clone()));
                let publisher = program_key
                    .get_value::<String, _>("Publisher")
                    .ok()
                    .or_else(|| metadata_by_exe.and_then(|meta| meta.publisher.clone()))
                    .or_else(|| metadata_by_install.and_then(|meta| meta.publisher.clone()));

                push_installed_program(
                    programs,
                    name,
                    executable_path,
                    install_location,
                    publisher,
                    source,
                );
            }
        }
    }
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn get_installed_programs() -> Result<Vec<InstalledProgram>, String> {
    use winreg::enums::*;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let mut programs = Vec::new();
    let mut executable_metadata = std::collections::HashMap::new();
    let mut install_metadata = std::collections::HashMap::new();

    let uninstall_paths = [
        (&hkcu, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
        (&hklm, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
        (&hklm, "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"),
    ];

    for (root, key_path) in uninstall_paths {
        scan_registry_uninstall_entries(
            root,
            key_path,
            &mut executable_metadata,
            &mut install_metadata,
        );
    }

    let app_paths = [
        (&hkcu, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths", "hkcu-app-paths"),
        (&hklm, "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths", "hklm-app-paths"),
        (&hklm, "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths", "hklm-wow6432-app-paths"),
    ];

    for (root, key_path, source) in app_paths {
        scan_registry_app_paths(
            &mut programs,
            root,
            key_path,
            &executable_metadata,
            &install_metadata,
            source,
        );
    }

    programs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    programs.dedup_by(|a, b| a.executable_path.eq_ignore_ascii_case(&b.executable_path));

    Ok(programs)
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn get_installed_programs() -> Result<Vec<InstalledProgram>, String> {
    Ok(vec![])
}

#[tauri::command]
pub async fn search_steamgriddb_games(
    query: String,
) -> Result<Vec<crate::steamgriddb::SteamGridDBSearchResult>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(vec![]);
    }

    let client = crate::steamgriddb::SteamGridDBClient::new();
    let results = client.search_games(trimmed).await?;

    Ok(results
        .into_iter()
        .map(|game| crate::steamgriddb::SteamGridDBSearchResult {
            url: format!("https://www.steamgriddb.com/game/{}", game.id),
            id: game.id,
            name: game.name,
            verified: game.verified,
            game_types: game.game_types,
            release_date: game.release_date,
        })
        .collect())
}

#[tauri::command]
pub async fn get_steamgriddb_game_images(
    game_id: u32,
) -> Result<crate::steamgriddb::GameImages, String> {
    let client = crate::steamgriddb::SteamGridDBClient::new();
    client.fetch_game_images(game_id).await
}

#[tauri::command]
pub async fn get_steamgriddb_artwork_options(
    game_id: u32,
) -> Result<crate::steamgriddb::GameArtworkOptions, String> {
    let client = crate::steamgriddb::SteamGridDBClient::new();
    client.fetch_game_artwork_options(game_id).await
}

fn build_metadata_json_with_launch_arguments(
    existing_metadata_json: Option<&str>,
    launch_arguments: Option<String>,
) -> Result<Option<String>, String> {
    let mut metadata = if let Some(metadata_json) = existing_metadata_json {
        match serde_json::from_str::<serde_json::Value>(metadata_json) {
            Ok(serde_json::Value::Object(obj)) => obj,
            Ok(_) => serde_json::Map::new(),
            Err(e) => return Err(format!("Failed to parse game metadata: {}", e)),
        }
    } else {
        serde_json::Map::new()
    };

    if let Some(arguments) = launch_arguments {
        metadata.insert("launchArguments".to_string(), serde_json::Value::String(arguments));
    } else {
        metadata.remove("launchArguments");
    }

    if metadata.is_empty() {
        Ok(None)
    } else {
        serde_json::to_string(&serde_json::Value::Object(metadata))
            .map(Some)
            .map_err(|e| format!("Failed to serialize game metadata: {}", e))
    }
}

fn launch_arguments_from_metadata(game: &database::GameRecord) -> Option<String> {
    if let Some(arguments) = game
        .launch_arguments
        .as_ref()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
    {
        return Some(arguments);
    }

    let metadata_json = game.metadata_json.as_ref()?;
    let metadata = serde_json::from_str::<serde_json::Value>(metadata_json).ok()?;
    metadata
        .get("launchArguments")
        .and_then(|value| value.as_str())
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn spawn_custom_game_process(path: &str, arguments: &[String]) -> std::io::Result<()> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;

        const CREATE_NEW_CONSOLE: u32 = 0x00000010;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x00000200;

        let mut command = std::process::Command::new(path);
        command.args(arguments);

        if let Some(parent) = std::path::Path::new(path).parent() {
            if !parent.as_os_str().is_empty() {
                command.current_dir(parent);
            }
        }

        command.creation_flags(CREATE_NEW_CONSOLE | CREATE_NEW_PROCESS_GROUP);

        return command.spawn().map(|_| ());
    }

    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;

        let mut command = Command::new(path);
        command.args(arguments);

        if let Some(parent) = std::path::Path::new(path).parent() {
            if !parent.as_os_str().is_empty() {
                command.current_dir(parent);
            }
        }

        command.spawn().map(|_| ())
    }
}

#[cfg(test)]
mod tests {
    use super::parse_command_arguments;

    #[test]
    fn keeps_windows_path_backslashes_intact() {
        let parsed = parse_command_arguments(r#"--config "C:\Games\My Game\config.cfg""#)
            .expect("arguments should parse");

        assert_eq!(
            parsed,
            vec![
                "--config".to_string(),
                r#"C:\Games\My Game\config.cfg"#.to_string(),
            ]
        );
    }

    #[test]
    fn supports_escaped_quotes_inside_double_quotes() {
        let parsed = parse_command_arguments(r#"--title "Ace \"Attorney\"""#)
            .expect("arguments should parse");

        assert_eq!(parsed, vec!["--title".to_string(), "Ace \"Attorney\"".to_string()]);
    }
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentGame {
    pub id: String,
    pub title: String,
    pub launcher: String,
    pub playtime_minutes: i64,
    pub last_played: Option<chrono::DateTime<Utc>>,
    pub cover_art: Option<String>,
    pub grid_cover_art: Option<String>,
    pub icon: Option<String>,
}

#[tauri::command]
pub async fn add_custom_app(
    title: String,
    executable_path: String,
    launch_arguments: Option<String>,
) -> Result<String, String> {
    if title.trim().is_empty() {
        return Err("Title cannot be empty".to_string());
    }

    if executable_path.trim().is_empty() {
        return Err("Executable path cannot be empty".to_string());
    }

    let normalized_launch_arguments = normalize_launch_arguments(launch_arguments);
    if let Some(arguments) = normalized_launch_arguments.as_ref() {
        parse_command_arguments(arguments)?;
    }

    let metadata_json = build_metadata_json_with_launch_arguments(
        None,
        normalized_launch_arguments.clone(),
    )?;

    let pool = get_db_pool()?;
    let now = Utc::now();
    let game_id = Uuid::new_v4().to_string();

    let record = database::GameRecord {
        id: game_id.clone(),
        launcher: "custom".to_string(),
        launcher_game_id: game_id.clone(),
        title: title.trim().to_string(),
        install_path: Some(executable_path.trim().to_string()),
        executable_path: Some(executable_path.trim().to_string()),
        cover_art: None,
        griddb_id: None,
        grid_cover_art: None,
        logo: None,
        header_art: None,
        icon: None,
        launch_arguments: normalized_launch_arguments,
        metadata_json,
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
pub async fn update_custom_app_name(game_id: String, title: String) -> Result<(), String> {
    let trimmed_title = title.trim();
    if trimmed_title.is_empty() {
        return Err("Title cannot be empty".to_string());
    }

    let pool = get_db_pool()?;
    let game = database::get_game_by_id(pool, &game_id)
        .await
        .map_err(|e| format!("Failed to get game: {}", e))?
        .ok_or_else(|| "Game not found".to_string())?;

    if game.launcher != "custom" {
        return Err("Only custom apps can be renamed".to_string());
    }

    sqlx::query("UPDATE games SET title = ?, updated_at = ? WHERE id = ?")
        .bind(trimmed_title)
        .bind(Utc::now())
        .bind(&game_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update custom app name: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn update_custom_app_executable(
    game_id: String,
    executable_path: String,
) -> Result<(), String> {
    let trimmed_path = executable_path.trim();
    if trimmed_path.is_empty() {
        return Err("Executable path cannot be empty".to_string());
    }

    let pool = get_db_pool()?;
    let game = database::get_game_by_id(pool, &game_id)
        .await
        .map_err(|e| format!("Failed to get game: {}", e))?
        .ok_or_else(|| "Game not found".to_string())?;

    if game.launcher != "custom" {
        return Err("Only custom apps can update executable paths".to_string());
    }

    sqlx::query(
        "UPDATE games SET executable_path = ?, install_path = ?, updated_at = ? WHERE id = ?",
    )
    .bind(trimmed_path)
    .bind(trimmed_path)
    .bind(Utc::now())
    .bind(&game_id)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update custom app executable path: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn update_custom_app_arguments(
    game_id: String,
    launch_arguments: Option<String>,
) -> Result<(), String> {
    let normalized_launch_arguments = normalize_launch_arguments(launch_arguments);
    if let Some(arguments) = normalized_launch_arguments.as_ref() {
        parse_command_arguments(arguments)?;
    }

    let pool = get_db_pool()?;
    let game = database::get_game_by_id(pool, &game_id)
        .await
        .map_err(|e| format!("Failed to get game: {}", e))?
        .ok_or_else(|| "Game not found".to_string())?;

    if game.launcher != "custom" {
        return Err("Only custom apps can update launch arguments".to_string());
    }

    let metadata_json = build_metadata_json_with_launch_arguments(
        game.metadata_json.as_deref(),
        normalized_launch_arguments.clone(),
    )?;

    sqlx::query("UPDATE games SET launch_arguments = ?, metadata_json = ?, updated_at = ? WHERE id = ?")
        .bind(normalized_launch_arguments)
        .bind(metadata_json)
        .bind(Utc::now())
        .bind(&game_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to update custom app launch arguments: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn delete_custom_app(game_id: String) -> Result<(), String> {
    let pool = get_db_pool()?;
    let game = database::get_game_by_id(pool, &game_id)
        .await
        .map_err(|e| format!("Failed to get game: {}", e))?
        .ok_or_else(|| "Game not found".to_string())?;

    if game.launcher != "custom" {
        return Err("Only custom apps can be deleted".to_string());
    }

    sqlx::query("DELETE FROM games WHERE id = ?")
        .bind(&game_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete custom app: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_current_game() -> Result<Option<CurrentGame>, String> {
    let pool = get_db_pool()?;
    let records = database::get_all_games(pool)
        .await
        .map_err(|e| format!("Failed to get games: {}", e))?;

    let mut system = System::new_all();
    system.refresh_all();

    // Deterministic selection:
    // choose the running game whose matching process started most recently.
    // This avoids first-match bias from DB ordering when multiple games are running.
    let mut best_match: Option<(u64, String, String)> = None;

    for game in records {
        if let Some(start_time) = latest_matching_process_start_time(&game, &system) {
            match &best_match {
                Some((best_start_time, _, _)) if *best_start_time >= start_time => {}
                _ => {
                    best_match = Some((start_time, game.id, game.title));
                }
            }
        }
    }

    Ok(best_match.map(|(_, game_id, name)| CurrentGame { game_id, name }))
}

#[tauri::command]
pub async fn check_game_running(game_id: String) -> Result<bool, String> {
    let pool = get_db_pool()?;
    let record = database::get_game_by_id(pool, &game_id)
        .await
        .map_err(|e| format!("Failed to get game: {}", e))?;

    match record {
        Some(game) => Ok(is_game_running_record(&game)),
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
            use sysinfo::{Pid, System};
            let mut system = System::new_all();
            system.refresh_all();
            let current_pid = std::process::id();

            let mut killed = false;

            if let Some(path) = runtime_executable_path(&game) {
                let candidates = runtime_process_candidates(&game);
                if !candidates.is_empty() {
                    let pids_to_kill: Vec<Pid> = system
                        .processes()
                        .iter()
                        .filter(|(_, process)| {
                            let process_pid = process.pid().as_u32();
                            !is_launcher_process(process.name())
                                && process_pid != current_pid
                                && process_matches_executable(process, path, &candidates)
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

            if killed {
                Ok(())
            } else {
                Err("No matching game executable process found to kill".to_string())
            }
        }
        None => Err("Game not found".to_string()),
    }
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
            if let Some(arguments) = r.launch_arguments.as_ref() {
                let trimmed = arguments.trim();
                if !trimmed.is_empty() {
                    metadata.insert("launchArguments".to_string(), serde_json::Value::String(trimmed.to_string()));
                }
            }
            if let Some(metadata_json) = &r.metadata_json {
                if let Ok(serde_json::Value::Object(obj)) = serde_json::from_str::<serde_json::Value>(metadata_json) {
                    for (k, v) in obj {
                        metadata.insert(k, v);
                    }
                }
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
                path: r.executable_path.clone().or(r.install_path.clone()),
                installed: r.executable_path.is_some() || r.install_path.is_some(),
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
pub async fn get_recently_played_games(limit: Option<u32>) -> Result<Vec<RecentGame>, String> {
    let pool = get_db_pool()?;
    let limit = limit.unwrap_or(5).clamp(1, 20) as i64;

    let records = database::get_recently_played_games(pool, limit)
        .await
        .map_err(|e| format!("Failed to get recently played games: {}", e))?;

    Ok(records
        .into_iter()
        .map(|r| RecentGame {
            id: r.id,
            title: r.title,
            launcher: r.launcher,
            playtime_minutes: r.playtime_minutes,
            last_played: r.last_played,
            cover_art: r.cover_art,
            grid_cover_art: r.grid_cover_art,
            icon: r.icon,
        })
        .collect())
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
            if let Some(arguments) = r.launch_arguments.as_ref() {
                let trimmed = arguments.trim();
                if !trimmed.is_empty() {
                    game_metadata.insert("launchArguments".to_string(), serde_json::Value::String(trimmed.to_string()));
                }
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
                path: r.executable_path.clone().or(r.install_path.clone()),
                installed: r.executable_path.is_some() || r.install_path.is_some(),
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

use sysinfo::{System};

#[tauri::command]
pub async fn launch_game(
    app: tauri::AppHandle,
    game_id: String,
    helpers: tauri::State<'_, crate::HelperProcesses>,
) -> Result<(), String> {

    use std::{
        process::Command,
        time::Duration,
    };

    use tauri::{
        Emitter,
        Manager,
    };


    #[derive(Clone, serde::Serialize)]
    struct LaunchStatus {
        launch_id: String,
        game_id: String,
        status: String,
        message: String,
    }


    fn emit_status(
        app: &tauri::AppHandle,
        launch_id: &str,
        game_id: &str,
        status: &str,
        message: &str,
    ) {
        let _ = app.emit(
            "game-launch-status",
            LaunchStatus {
                launch_id: launch_id.to_string(),
                game_id: game_id.to_string(),
                status: status.to_string(),
                message: message.to_string(),
            },
        );
    }

    fn close_launch_window(app: &tauri::AppHandle, launch_id: &str) {
        if let Some(window) = app.get_webview_window(&format!("launch_game_{}", launch_id)) {
            let _ = window.close();
        }
    }

    fn launch_steam_silent(app_id: &str) -> std::io::Result<()> {
        #[cfg(target_os="windows")]
        {
            if let Ok(steam_path) = crate::launchers::steam::get_steam_path() {
                let steam_exe = steam_path.join("steam.exe");
                if steam_exe.exists() {
                    return Command::new(steam_exe)
                        .args(["-silent", "-applaunch", app_id])
                        .spawn()
                        .map(|_| ());
                }
            }

            let url = format!("steam://rungameid/{} -silent", app_id);
            Command::new("cmd")
                .args(["/C", "start", "", &url])
                .spawn()
                .map(|_| ())
        }

        #[cfg(not(target_os="windows"))]
        {
            let url = format!("steam://rungameid/{} -silent", app_id);
            Command::new("xdg-open")
                .arg(url)
                .spawn()
                .map(|_| ())
        }
    }

    if LAUNCH_IN_PROGRESS
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("A game launch is already in progress".to_string());
    }

    let pool = get_db_pool().map_err(|e| {
        LAUNCH_IN_PROGRESS.store(false, Ordering::SeqCst);
        e
    })?;

    let game = database::get_game_by_id(pool, &game_id)
        .await
        .map_err(|e| {
            LAUNCH_IN_PROGRESS.store(false, Ordering::SeqCst);
            e.to_string()
        })?
        .ok_or_else(|| {
            LAUNCH_IN_PROGRESS.store(false, Ordering::SeqCst);
            "Game not found".to_string()
        })?;

    if is_game_running_record(&game) {
        LAUNCH_IN_PROGRESS.store(false, Ordering::SeqCst);
        return Err(format!("{} is already running", game.title));
    }

    let use_process_polling = game.launcher != "custom";

    let launch_id = Uuid::new_v4().to_string();

    let build_launch_window = || {
        tauri::WebviewWindowBuilder::new(
            &app,
            &format!("launch_game_{}", launch_id),
            tauri::WebviewUrl::App(
                format!(
                    "index.html/#/game/{}/launch?launchId={}",
                    game_id,
                    launch_id
                )
                .into(),
            ),
        )
        .title("Launch Game - PoliGame")
        .inner_size(600.0, 400.0)
        .resizable(false)
        .decorations(false)
        .always_on_top(false)
        .center()
        .build()
    };

    if let Some(existing_window) = app.get_webview_window(&format!("launch_game_{}", launch_id)) {
        let route_json = serde_json::to_string(&format!("/game/{}/launch?launchId={}", game_id, launch_id))
            .map_err(|e| {
                LAUNCH_IN_PROGRESS.store(false, Ordering::SeqCst);
                e.to_string()
            })?;

        if existing_window
            .eval(&format!("window.location.hash = {};", route_json))
            .is_ok()
        {
            let _ = existing_window.show();
            let _ = existing_window.set_focus();
        } else {
            let _ = existing_window.close();
            build_launch_window().map_err(|e| {
                LAUNCH_IN_PROGRESS.store(false, Ordering::SeqCst);
                e.to_string()
            })?;
        }
    } else {
        build_launch_window().map_err(|e| {
            LAUNCH_IN_PROGRESS.store(false, Ordering::SeqCst);
            e.to_string()
        })?;
    }



    let app_handle = app.clone();
    let game_id_clone = game_id.clone();
    let launch_id_clone = launch_id.clone();
    let game_clone = game.clone();

    tauri::async_runtime::spawn(async move {
        struct LaunchInProgressGuard;
        impl Drop for LaunchInProgressGuard {
            fn drop(&mut self) {
                LAUNCH_IN_PROGRESS.store(false, Ordering::SeqCst);
            }
        }

        let _launch_guard = LaunchInProgressGuard;

        emit_status(
            &app_handle,
            &launch_id_clone,
            &game_id_clone,
            "loading",
            "Loading game..."
        );
        let game = game_clone;



        emit_status(
            &app_handle,
            &launch_id_clone,
            &game_id_clone,
            "launching",
            &format!(
                "Launching {}...",
                game.title
            )
        );

        //
        // Launch game
        //

        let launch_result = match game.launcher.as_str() {


            "custom" => {

                if let Some(path) = runtime_executable_path(&game) {

                    if let Some(arguments) = launch_arguments_from_metadata(&game) {
                        match parse_command_arguments(&arguments) {
                            Ok(parsed_arguments) => spawn_custom_game_process(path, &parsed_arguments),
                            Err(e) => Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, e)),
                        }
                    } else {
                        spawn_custom_game_process(path, &[])
                    }

                } else {

                    Err(
                        std::io::Error::new(
                            std::io::ErrorKind::NotFound,
                            "Executable path missing"
                        )
                    )

                }
            }



            "steam" => {
                launch_steam_silent(&game.launcher_game_id)
            }



            "epic" => {

                if let Err(e) = crate::launchers::epic::ensure_epic_launcher_running().await {
                    emit_status(
                        &app_handle,
                        &launch_id_clone,
                        &game_id_clone,
                        "error",
                        &format!("Could not start Epic Games Launcher: {}", e),
                    );
                    close_launch_window(&app_handle, &launch_id_clone);
                    return;
                }

                let app_name = game
                    .metadata_json
                    .as_deref()
                    .and_then(|m| serde_json::from_str::<serde_json::Value>(m).ok())
                    .and_then(|j| j.get("appName").and_then(|v| v.as_str()).map(String::from))
                    .unwrap_or_else(|| game.launcher_game_id.clone());

                let url = format!(
                    "com.epicgames.launcher://apps/{}?action=launch",
                    app_name
                );

                #[cfg(target_os="windows")]
                {
                    Command::new("cmd")
                        .args([
                            "/C",
                            "start",
                            "",
                            &url
                        ])
                        .spawn()
                        .map(|_| ())
                }


                #[cfg(not(target_os="windows"))]
                {
                    Command::new("xdg-open")
                        .arg(url)
                        .spawn()
                        .map(|_| ())
                }
            }



            _ => {
                Err(
                    std::io::Error::new(
                        std::io::ErrorKind::Other,
                        "Unsupported launcher"
                    )
                )
            }
        };



        if let Err(e) = launch_result {

            emit_status(
                &app_handle,
                &launch_id_clone,
                &game_id_clone,
                "error",
                &format!(
                    "Failed launching game: {}",
                    e
                )
            );

            close_launch_window(&app_handle, &launch_id_clone);

            return;
        }

        if !use_process_polling {
            emit_status(
                &app_handle,
                &launch_id_clone,
                &game_id_clone,
                "started",
                "Game launch command sent"
            );

            tokio::time::sleep(
                Duration::from_millis(800)
            )
            .await;

            close_launch_window(&app_handle, &launch_id_clone);
            return;
        }



        emit_status(
            &app_handle,
            &launch_id_clone,
            &game_id_clone,
            "waiting",
            "Waiting for game to start..."
        );



        //
        // Poll existing process checker
        //

        let mut attempts = 0u16;
        const MAX_ATTEMPTS: u16 = 180; // 90 seconds at 500ms intervals

        loop {

            match check_game_running(
                game_id_clone.clone()
            )
            .await
            {

                Ok(true) => {

                    emit_status(
                        &app_handle,
                        &launch_id_clone,
                        &game_id_clone,
                        "started",
                        "Game started!"
                    );

                    // Notify overlay which game started
                    if let Some(helpers) = app_handle.try_state::<crate::HelperProcesses>() {
                        crate::notify_overlay_game_started(
                            &app_handle,
                            helpers.inner(),
                            &game.title,
                            &game_id_clone,
                        );
                    }

                    break;
                }


                Ok(false) => {}


                Err(e) => {

                    emit_status(
                        &app_handle,
                        &launch_id_clone,
                        &game_id_clone,
                        "error",
                        &e
                    );

                    close_launch_window(&app_handle, &launch_id_clone);

                    return;
                }
            }

            attempts += 1;
            if attempts >= MAX_ATTEMPTS {
                emit_status(
                    &app_handle,
                    &launch_id_clone,
                    &game_id_clone,
                    "error",
                    "Timed out waiting for game process to start"
                );

                close_launch_window(&app_handle, &launch_id_clone);
                return;
            }



            tokio::time::sleep(
                Duration::from_millis(500)
            )
            .await;
        }



        // Give UI time to show success

        tokio::time::sleep(
            Duration::from_millis(1000)
        )
        .await;



        close_launch_window(&app_handle, &launch_id_clone);

    });

    Ok(())
}

#[tauri::command]
pub async fn launch_game_overdrive(game_id: String) -> Result<(), String> {
    use std::{
        process::Command,
        time::Duration,
    };

    fn launch_steam_silent(app_id: &str) -> std::io::Result<()> {
        #[cfg(target_os="windows")]
        {
            if let Ok(steam_path) = crate::launchers::steam::get_steam_path() {
                let steam_exe = steam_path.join("steam.exe");
                if steam_exe.exists() {
                    return Command::new(steam_exe)
                        .args(["-silent", "-applaunch", app_id])
                        .spawn()
                        .map(|_| ());
                }
            }

            let url = format!("steam://rungameid/{} -silent", app_id);
            Command::new("cmd")
                .args(["/C", "start", "", &url])
                .spawn()
                .map(|_| ())
        }

        #[cfg(not(target_os="windows"))]
        {
            let url = format!("steam://rungameid/{} -silent", app_id);
            Command::new("xdg-open")
                .arg(url)
                .spawn()
                .map(|_| ())
        }
    }

    if LAUNCH_IN_PROGRESS
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err("A game launch is already in progress".to_string());
    }

    struct LaunchInProgressGuard;
    impl Drop for LaunchInProgressGuard {
        fn drop(&mut self) {
            LAUNCH_IN_PROGRESS.store(false, Ordering::SeqCst);
        }
    }
    let _launch_guard = LaunchInProgressGuard;

    let pool = get_db_pool()?;

    let game = database::get_game_by_id(pool, &game_id)
        .await
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Game not found".to_string())?;

    if is_game_running_record(&game) {
        return Err(format!("{} is already running", game.title));
    }

    let use_process_polling = game.launcher != "custom";

    let launch_result = match game.launcher.as_str() {
        "custom" => {
            if let Some(path) = runtime_executable_path(&game) {
                if let Some(arguments) = launch_arguments_from_metadata(&game) {
                    match parse_command_arguments(&arguments) {
                        Ok(parsed_arguments) => {
                            spawn_custom_game_process(path, &parsed_arguments)
                        }
                        Err(e) => Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, e)),
                    }
                } else {
                    spawn_custom_game_process(path, &[])
                }
            } else {
                Err(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Executable path missing",
                ))
            }
        }
        "steam" => launch_steam_silent(&game.launcher_game_id),
        "epic" => {
            if let Err(e) = crate::launchers::epic::ensure_epic_launcher_running().await {
                return Err(format!("Could not start Epic Games Launcher: {}", e));
            }

            let app_name = game
                .metadata_json
                .as_deref()
                .and_then(|m| serde_json::from_str::<serde_json::Value>(m).ok())
                .and_then(|j| j.get("appName").and_then(|v| v.as_str()).map(String::from))
                .unwrap_or_else(|| game.launcher_game_id.clone());

            let url = format!(
                "com.epicgames.launcher://apps/{}?action=launch",
                app_name
            );

            #[cfg(target_os="windows")]
            {
                Command::new("cmd")
                    .args(["/C", "start", "", &url])
                    .spawn()
                    .map(|_| ())
            }

            #[cfg(not(target_os="windows"))]
            {
                Command::new("xdg-open").arg(url).spawn().map(|_| ())
            }
        }
        _ => Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            "Unsupported launcher",
        )),
    };

    if let Err(e) = launch_result {
        return Err(format!("Failed launching game: {}", e));
    }

    if !use_process_polling {
        tokio::time::sleep(Duration::from_millis(800)).await;
        return Ok(());
    }

    let mut attempts = 0u16;
    const MAX_ATTEMPTS: u16 = 180;

    loop {
        match check_game_running(game_id.clone()).await {
            Ok(true) => break,
            Ok(false) => {}
            Err(e) => return Err(e),
        }

        attempts += 1;
        if attempts >= MAX_ATTEMPTS {
            return Err("Timed out waiting for game process to start".to_string());
        }

        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    tokio::time::sleep(Duration::from_millis(1000)).await;
    Ok(())
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
