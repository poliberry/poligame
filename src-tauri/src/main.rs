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
mod utils;
mod discord_presence;
mod updater;
mod themes;

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Stdio};
use std::sync::Mutex;
use tauri::{Manager, PhysicalPosition, Position};
use tauri_plugin_notification::NotificationExt;

const TRAY_PANEL_LABEL: &str = "tray-panel";
const TRAY_ICON_ID: &str = "main-tray";
const TRAY_PANEL_WIDTH: i32 = 360;
const TRAY_PANEL_HEIGHT: i32 = 520;

// ─── Helper process state ────────────────────────────────────────────────────

struct HelperChild {
    child: Child,
    stdin: ChildStdin,
}

impl HelperChild {
    fn send(&mut self, cmd: &serde_json::Value) {
        let mut line = serde_json::to_string(cmd).unwrap_or_default();
        line.push('\n');
        let _ = self.stdin.write_all(line.as_bytes());
    }
}

struct HelperProcesses {
    overdrive: Mutex<Option<HelperChild>>,
    overlay: Mutex<Option<HelperChild>>,
}

impl HelperProcesses {
    fn new() -> Self {
        Self {
            overdrive: Mutex::new(None),
            overlay: Mutex::new(None),
        }
    }
}

fn helper_bin(app: &tauri::AppHandle, name: &str) -> Option<PathBuf> {
    let mut path = app.path().resource_dir().ok()?;
    let bin = if cfg!(windows) { format!("{name}.exe") } else { name.to_string() };
    path.push(&bin);
    if path.exists() { Some(path) } else { None }
}

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
    if window.label() == "main" || window.label() == TRAY_PANEL_LABEL {
        window.hide().map_err(|e| e.to_string())
    } else {
        window.close().map_err(|e| e.to_string())
    }
}

fn ensure_tray_panel(app: &tauri::AppHandle) -> tauri::Result<tauri::WebviewWindow> {
    if let Some(window) = app.get_webview_window(TRAY_PANEL_LABEL) {
        return Ok(window);
    }

    tauri::WebviewWindowBuilder::new(
        app,
        TRAY_PANEL_LABEL,
        tauri::WebviewUrl::App("index.html/#/tray".into()),
    )
    .title("PoliGame")
    .inner_size(TRAY_PANEL_WIDTH as f64, TRAY_PANEL_HEIGHT as f64)
    .resizable(false)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .build()
}

fn toggle_tray_panel(
    app: &tauri::AppHandle,
    anchor: Option<PhysicalPosition<f64>>,
) -> tauri::Result<()> {
    let window = ensure_tray_panel(app)?;

    if window.is_visible().unwrap_or(false) {
        window.hide()?;
        return Ok(());
    }

    if let Some(position) = anchor {
        let mut x = position.x.round() as i32 - TRAY_PANEL_WIDTH + 14;
        let mut y = position.y.round() as i32 - TRAY_PANEL_HEIGHT - 8;

        if x < 8 {
            x = 8;
        }

        if y < 8 {
            y = position.y.round() as i32 + 8;
        }

        let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
    }

    window.show()?;
    window.set_focus()?;
    Ok(())
}

fn open_main_window_and_route(app: &tauri::AppHandle, route: &str) -> Result<(), String> {
    let main_window = app
        .get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;

    if !main_window.is_visible().unwrap_or(true) {
        main_window.show().map_err(|e| e.to_string())?;
    }

    let route_json = serde_json::to_string(route)
        .map_err(|e| format!("Failed to serialize route: {}", e))?;
    main_window
        .eval(&format!("window.location.hash = {};", route_json))
        .map_err(|e| e.to_string())?;
    main_window.set_focus().map_err(|e| e.to_string())?;

    if let Some(tray_panel) = app.get_webview_window(TRAY_PANEL_LABEL) {
        let _ = tray_panel.hide();
    }

    Ok(())
}

#[tauri::command]
fn open_main_route(app: tauri::AppHandle, route: String) -> Result<(), String> {
    open_main_window_and_route(&app, &route)
}

#[tauri::command]
fn hide_tray_panel(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(TRAY_PANEL_LABEL) {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn quit_application(app: tauri::AppHandle) -> Result<(), String> {
    app.exit(0);
    Ok(())
}

#[tauri::command]
fn show_native_notification(
    app: tauri::AppHandle,
    title: String,
    body: Option<String>,
) -> Result<(), String> {
    let mut builder = app.notification().builder().title(&title);

    if let Some(content) = body.as_deref() {
        if !content.trim().is_empty() {
            builder = builder.body(content);
        }
    }

    builder.show().map_err(|e| e.to_string())
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
async fn create_custom_app_dialog_window(
    app: tauri::AppHandle,
    action: String,
    game_id: Option<String>,
    name: Option<String>,
) -> Result<(), String> {
    use tauri::Manager;

    let normalized_action = action.trim().to_lowercase();
    let window_label = match normalized_action.as_str() {
        "add" => "custom-app-dialog-add".to_string(),
        "delete" => format!("custom-app-dialog-delete-{}", game_id.clone().unwrap_or_default()),
        _ => return Err("Unsupported custom app dialog action".to_string()),
    };

    if let Some(window) = app.get_webview_window(&window_label) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let mut query = format!("action={}", urlencoding::encode(&normalized_action));
    if let Some(game_id_value) = game_id.as_ref() {
        if !game_id_value.trim().is_empty() {
            query.push_str(&format!("&gameId={}", urlencoding::encode(game_id_value)));
        }
    }
    if let Some(name_value) = name.as_ref() {
        if !name_value.trim().is_empty() {
            query.push_str(&format!("&name={}", urlencoding::encode(name_value)));
        }
    }

    let title = match normalized_action.as_str() {
        "add" => "Add Custom App",
        "delete" => "Remove Custom App",
        _ => "Custom App",
    };

    let (width, height, resizable) = match normalized_action.as_str() {
        "delete" => (520.0, 340.0, false),
        "add" => (920.0, 820.0, true),
        _ => (860.0, 700.0, true),
    };

    tauri::WebviewWindowBuilder::new(
        &app,
        &window_label,
        tauri::WebviewUrl::App(format!("index.html/#/custom-app-dialog?{}", query).into()),
    )
    .title(title)
    .inner_size(width, height)
    .resizable(resizable)
    .decorations(false)
    .always_on_top(false)
    .center()
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn create_steamgriddb_picker_window(
    app: tauri::AppHandle,
    request_id: String,
    query: Option<String>,
    game_title: Option<String>,
) -> Result<(), String> {
    use tauri::Manager;

    let request_id = request_id.trim();
    if request_id.is_empty() {
        return Err("request_id is required".to_string());
    }

    let window_label = format!("steamgriddb-picker-{}", request_id);

    if let Some(window) = app.get_webview_window(&window_label) {
        window.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    let mut query_parts = vec![format!("requestId={}", urlencoding::encode(request_id))];
    if let Some(value) = query.as_ref().map(|v| v.trim()).filter(|v| !v.is_empty()) {
        query_parts.push(format!("query={}", urlencoding::encode(value)));
    }
    if let Some(value) = game_title
        .as_ref()
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
    {
        query_parts.push(format!("title={}", urlencoding::encode(value)));
    }

    tauri::WebviewWindowBuilder::new(
        &app,
        &window_label,
        tauri::WebviewUrl::App(
            format!("index.html/#/steamgriddb-picker?{}", query_parts.join("&")).into(),
        ),
    )
    .title("SteamGridDB Artwork Picker")
    .inner_size(1120.0, 760.0)
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

#[cfg(target_os = "windows")]
fn apply_windows_webview2_video_workaround() {
    let args_to_append = [
        "--autoplay-policy=no-user-gesture-required",
        "--disable-gpu-compositing",
        "--disable-accelerated-video-decode",
    ];

    let existing = std::env::var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS")
        .unwrap_or_default();

    let mut combined = existing;
    for arg in args_to_append {
        if !combined.contains(arg) {
            if !combined.is_empty() {
                combined.push(' ');
            }
            combined.push_str(arg);
        }
    }

    std::env::set_var("WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", combined);
}

// ─── Overdrive — spawns the poligame-overdrive helper ────────────────────────

#[tauri::command]
fn enter_overdrive_mode(
    app: tauri::AppHandle,
    helpers: tauri::State<'_, HelperProcesses>,
) -> Result<(), String> {
    let Some(bin) = helper_bin(&app, "poligame-overdrive") else {
        return Err(
            "Overdrive is not installed. Re-run the PoliGame installer and enable the Overdrive component.".into(),
        );
    };

    let db_path = app
        .path()
        .app_local_data_dir()
        .map(|p| p.join("poligame.db").to_string_lossy().into_owned())
        .unwrap_or_default();

    let mut child = std::process::Command::new(&bin)
        .env("POLIGAME_DB", &db_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to launch Overdrive: {e}"))?;

    let stdin = child.stdin.take().ok_or("Failed to get Overdrive stdin")?;

    let mut guard = helpers.overdrive.lock().unwrap();
    if let Some(mut old) = guard.take() {
        old.send(&serde_json::json!({"cmd": "quit"}));
        let _ = old.child.wait();
    }
    *guard = Some(HelperChild { child, stdin });

    Ok(())
}

#[tauri::command]
fn exit_overdrive_mode(
    helpers: tauri::State<'_, HelperProcesses>,
) -> Result<(), String> {
    let mut guard = helpers.overdrive.lock().unwrap();
    if let Some(mut od) = guard.take() {
        od.send(&serde_json::json!({"cmd": "quit"}));
        let _ = od.child.wait();
    }
    Ok(())
}

// ─── Overlay — spawns the poligame-overlay helper ────────────────────────────

fn ensure_overlay_running(
    app: &tauri::AppHandle,
    helpers: &HelperProcesses,
    game_title: Option<&str>,
    game_id: Option<&str>,
) -> Result<(), String> {
    let mut guard = helpers.overlay.lock().unwrap();

    // Re-use existing process if alive
    if let Some(ref mut ov) = *guard {
        if ov.child.try_wait().map(|s| s.is_none()).unwrap_or(false) {
            ov.send(&serde_json::json!({"cmd": "show"}));
            return Ok(());
        }
        // Process died — fall through to respawn
        *guard = None;
    }

    let Some(bin) = helper_bin(app, "poligame-overlay") else {
        return Err("Game overlay is not installed. Re-run the PoliGame installer and enable the Game Overlay component.".into());
    };

    let mut cmd = std::process::Command::new(&bin);
    if let Some(t) = game_title { cmd.env("POLIGAME_GAME_TITLE", t); }
    if let Some(i) = game_id   { cmd.env("POLIGAME_GAME_ID", i); }

    let mut child = cmd
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to launch overlay: {e}"))?;

    let stdin = child.stdin.take().ok_or("Failed to get overlay stdin")?;
    let mut helper = HelperChild { child, stdin };
    helper.send(&serde_json::json!({"cmd": "show"}));
    *guard = Some(helper);

    Ok(())
}

#[tauri::command]
async fn show_overdrive_overlay(
    app: tauri::AppHandle,
    helpers: tauri::State<'_, HelperProcesses>,
) -> Result<(), String> {
    ensure_overlay_running(&app, &helpers, None, None)
}

#[tauri::command]
async fn hide_overdrive_overlay(
    helpers: tauri::State<'_, HelperProcesses>,
) -> Result<(), String> {
    let mut guard = helpers.overlay.lock().unwrap();
    if let Some(ref mut ov) = *guard {
        ov.send(&serde_json::json!({"cmd": "hide"}));
    }
    Ok(())
}

/// Called by game-launch code to notify the overlay which game started.
pub fn notify_overlay_game_started(
    app: &tauri::AppHandle,
    helpers: &HelperProcesses,
    game_title: &str,
    game_id: &str,
) {
    let _ = ensure_overlay_running(app, helpers, Some(game_title), Some(game_id));
}

/// Called when a game exits to tell the overlay.
pub fn notify_overlay_game_stopped(helpers: &HelperProcesses) {
    let mut guard = helpers.overlay.lock().unwrap();
    if let Some(ref mut ov) = *guard {
        ov.send(&serde_json::json!({"cmd": "game_stopped"}));
    }
}

#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> String {
    app.package_info().version.to_string()
}

#[tauri::command]
fn focus_main_window(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        if !window.is_visible().unwrap_or(true) {
            window.show().map_err(|e| e.to_string())?;
        }
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
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
        .manage(discord_presence::DiscordPresenceState::new())
        .manage(HelperProcesses::new())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_devtools::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Initialize database asynchronously
            tauri::async_runtime::spawn(async {
                match games::init_database().await {
                    Ok(_) => eprintln!("Database initialized successfully"),
                    Err(e) => eprintln!("Failed to initialize database: {}", e),
                }
            });

            // Initialize themes directory and install defaults
            if let Err(e) = themes::init_themes() {
                eprintln!("Failed to initialize themes: {}", e);
            }

            // Spawn the Discord RPC helper process
            {
                let rpc_state = app.state::<discord_presence::DiscordPresenceState>();
                discord_presence::spawn_rpc_process(app.handle(), &rpc_state);
            }

            // Register global shortcut Ctrl+Shift+F9 to show/hide the in-game overlay
            {
                use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
                let shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::CONTROL), Code::F9);
                app.handle().global_shortcut().on_shortcut(shortcut, |app_handle, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        let h = app_handle.clone();
                        tauri::async_runtime::spawn(async move {
                            let helpers = h.state::<HelperProcesses>();
                            let _ = show_overdrive_overlay(h.clone(), helpers).await;
                        });
                    }
                })?;
            }

            let mut tray_builder = tauri::tray::TrayIconBuilder::with_id(TRAY_ICON_ID)
                .tooltip("PoliGame")
                .show_menu_on_left_click(false);

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }

            tray_builder.build(app)?;
            ensure_tray_panel(&app.handle())?;

            Ok(())
        })
        .on_tray_icon_event(|app, event| {
            if let tauri::tray::TrayIconEvent::Click {
                button,
                button_state,
                position,
                ..
            } = event
            {
                if button == tauri::tray::MouseButton::Right
                    && button_state == tauri::tray::MouseButtonState::Up
                {
                    let _ = toggle_tray_panel(app, Some(position));
                }
            }
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if window.label() == "main" || window.label() == TRAY_PANEL_LABEL {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
            tauri::WindowEvent::Focused(false) => {
                if window.label() == TRAY_PANEL_LABEL {
                    let _ = window.hide();
                }
            }
            _ => {}
        })
        .on_page_load(|window, _payload| {
            if window.label() == "main" {
                #[cfg(debug_assertions)]
                window.open_devtools();
            }
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
            games::get_recently_played_games,
            games::get_game_details,
            games::get_installed_programs,
            games::add_custom_app,
            games::delete_custom_app,
            games::update_custom_app_name,
            games::update_custom_app_executable,
            games::update_custom_app_arguments,
            games::search_steamgriddb_games,
            games::get_steamgriddb_game_images,
            games::get_steamgriddb_artwork_options,
            games::launch_game,
            games::launch_game_overdrive,
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
            open_main_route,
            hide_tray_panel,
            quit_application,
            create_auth_window,
            close_auth_window,
            create_account_details_window,
            close_account_details_window,
            minimize_account_details_window,
            toggle_maximize_account_details_window,
            create_game_customization_window,
            close_game_customization_window,
            create_custom_app_dialog_window,
            create_steamgriddb_picker_window,
            create_friends_window,
            minimize_friends_window,
            toggle_maximize_friends_window,
            close_friends_window,
            close_setup_window,
            show_native_notification,
            discord_presence::discord_presence_connect,
            discord_presence::discord_presence_update_launcher,
            discord_presence::discord_presence_update_game,
            discord_presence::discord_presence_clear,
            create_settings_window,
            close_settings_window,
            minimize_settings_window,
            toggle_maximize_settings_window,
            is_setup_complete,
            set_setup_complete,
            system_info::get_system_info,
            system_info::list_storage_drives,
            system_info::get_network_overview,
            system_info::open_network_settings,
            updater::check_for_app_update,
            updater::install_app_update,
            updater::restart_app,
            games::get_steam_requirements,
            enter_overdrive_mode,
            exit_overdrive_mode,
            show_overdrive_overlay,
            hide_overdrive_overlay,
            focus_main_window,
            // Theme commands
            themes::list_themes,
            themes::get_theme,
            themes::install_theme,
            themes::save_user_theme,
            themes::delete_theme,
            themes::get_theme_asset_base64,
            themes::save_theme_asset,
            themes::get_themes_dir_path,
            themes::get_system_fonts,
            themes::open_path_in_explorer,
            themes::export_pgtheme,
            themes::import_pgtheme,
            get_app_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
