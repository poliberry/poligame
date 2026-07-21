// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod launchers;
mod games;
mod browser;
mod profiles;
mod settings;
mod steamgriddb;
mod steam_api;
mod system_info;
mod api_keys;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize)]
struct SetupState {
    setup_complete: bool,
}

fn setup_state_path() -> Result<PathBuf, String> {
    let mut dir = dirs::config_dir().ok_or_else(|| "Failed to locate config directory".to_string())?;
    dir.push("poligame");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create config directory: {}", e))?;
    dir.push("setup-state.json");
    Ok(dir)
}

#[tauri::command]
fn is_setup_complete() -> Result<bool, String> {
    let path = setup_state_path()?;
    if !path.exists() {
        return Ok(false);
    }

    let raw = fs::read_to_string(&path).map_err(|e| format!("Failed to read setup state: {}", e))?;
    let state: SetupState = serde_json::from_str(&raw)
        .map_err(|e| format!("Failed to parse setup state: {}", e))?;
    Ok(state.setup_complete)
}

#[tauri::command]
fn set_setup_complete(completed: bool) -> Result<(), String> {
    let path = setup_state_path()?;
    let state = SetupState {
        setup_complete: completed,
    };
    let serialized = serde_json::to_string_pretty(&state)
        .map_err(|e| format!("Failed to serialize setup state: {}", e))?;
    fs::write(path, serialized).map_err(|e| format!("Failed to write setup state: {}", e))
}

#[tauri::command]
fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn toggle_maximize_window(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().unwrap_or(false) {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
async fn create_auth_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    
    // Check if auth window already exists
    if let Some(window) = app.get_webview_window("auth") {
        // Window already exists, focus it
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Create new auth window using WebviewWindow builder
    let _auth_window = tauri::WebviewWindowBuilder::new(
        &app,
        "auth",
        tauri::WebviewUrl::App("index.html/#/auth".into())
    )
    .title("Sign In - PoliGame")
    .inner_size(450.0, 600.0)
    .resizable(false)
    .decorations(true)
    .always_on_top(false)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn close_auth_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    
    if let Some(window) = app.get_webview_window("auth") {
        window.close().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
async fn create_account_details_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    
    // Check if account details window already exists
    if let Some(window) = app.get_webview_window("account-details") {
        // Window already exists, focus it
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Create new account details window using WebviewWindow builder
    let _account_details_window = tauri::WebviewWindowBuilder::new(
        &app,
        "account-details",
        tauri::WebviewUrl::App("index.html/#/account-details".into())
    )
    .title("Account Details - PoliGame")
    .inner_size(700.0, 800.0)
    .resizable(true)
    .decorations(false)
    .always_on_top(false)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn close_account_details_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    
    if let Some(window) = app.get_webview_window("account-details") {
        window.close().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
async fn minimize_account_details_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("account-details") {
        window.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn toggle_maximize_account_details_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("account-details") {
        if window.is_maximized().unwrap_or(false) {
            window.unmaximize().map_err(|e| e.to_string())?;
        } else {
            window.maximize().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn create_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    
    // Check if settings window already exists
    if let Some(window) = app.get_webview_window("settings") {
        // Window already exists, focus it
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Create new settings window using WebviewWindow builder
    let _settings_window = tauri::WebviewWindowBuilder::new(
        &app,
        "settings",
        tauri::WebviewUrl::App("index.html/#/settings".into())
    )
    .title("Settings")
    .inner_size(700.0, 800.0)
    .resizable(true)
    .decorations(false)
    .always_on_top(false)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn close_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    
    if let Some(window) = app.get_webview_window("settings") {
        window.close().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
async fn minimize_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("settings") {
        window.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn toggle_maximize_settings_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("settings") {
        if window.is_maximized().unwrap_or(false) {
            window.unmaximize().map_err(|e| e.to_string())?;
        } else {
            window.maximize().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn create_game_customization_window(
    app: tauri::AppHandle,
    game_id: String,
) -> Result<(), String> {
    use tauri::Manager;
    
    let window_label = format!("game-customize-{}", game_id);
    
    // Check if window already exists
    if let Some(window) = app.get_webview_window(&window_label) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Create new game customization window
    let _window = tauri::WebviewWindowBuilder::new(
        &app,
        &window_label,
        tauri::WebviewUrl::App(format!("index.html/#/game/{}/customize", game_id).into())
    )
    .title("Customize Game Art - PoliGame")
    .inner_size(700.0, 500.0)
    .resizable(true)
    .decorations(false)
    .always_on_top(false)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn close_game_customization_window(
    app: tauri::AppHandle,
) -> Result<(), String> {
    use tauri::Manager;
    
    // Close all game customization windows
    let windows = app.webview_windows();
    for (label, window) in windows {
        if label.starts_with("game-customize-") {
            let _ = window.close();
        }
    }
    
    Ok(())
}

#[tauri::command]
async fn create_friends_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    
    // Check if friends window already exists
    if let Some(window) = app.get_webview_window("friends") {
        // Window already exists, focus it
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Create new friends window
    let _friends_window = tauri::WebviewWindowBuilder::new(
        &app,
        "friends",
        tauri::WebviewUrl::App("index.html/#/friends".into())
    )
    .title("Friends - PoliGame")
    .inner_size(900.0, 700.0)
    .resizable(true)
    .decorations(false)
    .always_on_top(false)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn minimize_friends_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("friends") {
        window.minimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn toggle_maximize_friends_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("friends") {
        if window.is_maximized().unwrap_or(false) {
            window.unmaximize().map_err(|e| e.to_string())?;
        } else {
            window.maximize().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
async fn close_friends_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    
    if let Some(window) = app.get_webview_window("friends") {
        window.close().map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
fn close_setup_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

fn main() {
    // Load environment variables from .env file in src-tauri directory
    // Create a .env file in the src-tauri directory with: STEAMGRIDDB_API_KEY=your_key_here
    dotenv::dotenv().ok();
    // Also try loading from src-tauri directory specifically
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let env_path = std::path::Path::new(&manifest_dir).join(".env");
        dotenv::from_path(&env_path).ok();
    }
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|_app| {
            // Initialize database asynchronously
            tauri::async_runtime::spawn(async {
                match games::init_database().await {
                    Ok(_) => eprintln!("Database initialized successfully"),
                    Err(e) => eprintln!("Failed to initialize database: {}", e),
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Launcher commands
            launchers::scan_all_launchers,
            launchers::scan_all_games,
            launchers::scan_steam_games,
            launchers::scan_ea_games,
            launchers::scan_epic_games,
            launchers::scan_rockstar_games,
            launchers::get_launcher_status,
            // Game commands
            games::get_all_games,
            games::get_game_details,
            games::add_custom_app,
            games::launch_game,
            games::check_game_running,
            games::get_current_game,
            games::kill_game_process,
            games::get_game_achievements,
            games::fetch_steam_achievements,
            games::fetch_steam_achievements_no_db,
            games::fetch_steam_news,
            // Browser commands
            browser::navigate_url,
            browser::get_history,
            browser::add_bookmark,
            browser::get_bookmarks,
            // Profile commands
            profiles::get_all_profiles,
            profiles::create_profile,
            profiles::update_profile,
            profiles::delete_profile,
            profiles::switch_profile,
            profiles::get_current_profile,
            // Settings commands
            settings::get_settings,
            settings::update_settings,
            // Window commands
            minimize_window,
            toggle_maximize_window,
            close_window,
            create_auth_window,
            close_auth_window,
            create_account_details_window,
            close_account_details_window,
            minimize_account_details_window,
            toggle_maximize_account_details_window,
            create_game_customization_window,
            close_game_customization_window,
            create_friends_window,
            minimize_friends_window,
            toggle_maximize_friends_window,
            close_friends_window,
            close_setup_window,
            create_settings_window,
            close_settings_window,
            minimize_settings_window,
            toggle_maximize_settings_window,
            is_setup_complete,
            set_setup_complete,
            system_info::get_system_info,
            games::get_steam_requirements,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
