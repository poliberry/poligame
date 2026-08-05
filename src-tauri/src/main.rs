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
use std::path::PathBuf;
use tauri::{Manager, PhysicalPosition, Position};
use tauri_plugin_notification::NotificationExt;

const TRAY_PANEL_LABEL: &str = "tray-panel";
const TRAY_ICON_ID: &str = "main-tray";
const TRAY_PANEL_WIDTH: i32 = 360;
const TRAY_PANEL_HEIGHT: i32 = 520;
const OVERDRIVE_OVERLAY_LABEL: &str = "overdrive-overlay";

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

/// WebKitGTK enforces the same kind of autoplay policy Chromium/WebView2 do:
/// media with sound can't be started with a script-triggered `.play()` unless
/// the page already muted the element or the user has interacted with it
/// first. The Setup flow's intro video/music autoplay on first launch with
/// neither, so `.play()` was silently rejected (caught and logged, never
/// surfaced) and nothing appeared to load. WebView2 already gets a workaround
/// for this exact class of bug above via `--autoplay-policy`; this is the
/// WebKitGTK equivalent, using the settings API since WebKitGTK has no
/// autoplay-policy command line switch or env var.
#[cfg(target_os = "linux")]
fn apply_linux_webkit_autoplay_workaround(window: &tauri::WebviewWindow) {
    use webkit2gtk::{SettingsExt, WebViewExt};

    let _ = window.with_webview(|webview| {
        if let Some(settings) = webview.inner().settings() {
            settings.set_media_playback_requires_user_gesture(false);
        }
    });
}

#[tauri::command]
fn enter_overdrive_mode(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    
    if let Some(window) = app.get_webview_window("main") {
        window.set_fullscreen(true).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn exit_overdrive_mode(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    if let Some(window) = app.get_webview_window("main") {
        window.set_fullscreen(false).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn do_show_overdrive_overlay(app: &tauri::AppHandle) -> tauri::Result<()> {
    use tauri::Manager;

    if let Some(window) = app.get_webview_window(OVERDRIVE_OVERLAY_LABEL) {
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }

    tauri::WebviewWindowBuilder::new(
        app,
        OVERDRIVE_OVERLAY_LABEL,
        tauri::WebviewUrl::App("index.html/#/overdrive-overlay".into()),
    )
    .title("Overdrive Overlay")
    .transparent(true)
    .decorations(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .fullscreen(true)
    .build()?;

    Ok(())
}

#[tauri::command]
async fn show_overdrive_overlay(app: tauri::AppHandle) -> Result<(), String> {
    do_show_overdrive_overlay(&app).map_err(|e| e.to_string())
}

#[tauri::command]
async fn hide_overdrive_overlay(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window(OVERDRIVE_OVERLAY_LABEL) {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
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

/// Handles the global shortcut that toggles the in-game overlay, regardless
/// of which of the candidate key combos ended up being registered.
fn overlay_shortcut_handler(
    app_handle: &tauri::AppHandle,
    _shortcut: &tauri_plugin_global_shortcut::Shortcut,
    event: tauri_plugin_global_shortcut::ShortcutEvent,
) {
    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
        let h = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            let _ = show_overdrive_overlay(h).await;
        });
    }
}

/// The Linux AppImage bundles its own copies of libwayland-client, libwayland-egl
/// and libwayland-cursor (pulled in by linuxdeploy's GTK plugin alongside GTK/
/// WebKitGTK itself). Those bundled copies get resolved ahead of the host's own
/// via the AppImage runtime's `LD_LIBRARY_PATH`, so the process ends up with two
/// different builds of libwayland-client loaded at once: one used by our bundled
/// GTK stack, another used internally by the host's Mesa/EGL driver. Mesa's EGL
/// Wayland platform then fails to reconcile the two and aborts the whole process
/// with:
///   Could not create default EGL display: EGL_BAD_PARAMETER. Aborting...
///
/// The fix is to force the single, host-provided copies of these libraries to be
/// used everywhere via `LD_PRELOAD`, resolved through the dynamic linker cache
/// (`ldconfig -p`) rather than `LD_LIBRARY_PATH`, so we get the real system path
/// regardless of what the AppImage runtime has set up. Since these libraries are
/// direct dependencies of the executable (loaded before `main` ever runs),
/// `LD_PRELOAD` can only take effect on a fresh process image, so we re-exec
/// ourselves once with it set.
///
/// This only touches AppImage runs (`APPIMAGE` is set by the AppImage runtime)
/// and is a no-op if the host is missing any of these libraries — a partial
/// preload would still leave the missing one(s) loaded from the AppImage's
/// bundled copy, reintroducing the exact conflict this works around. Regular
/// package installs (.deb, distro packages) already link against the system
/// WebKitGTK/GTK stack and never hit this in the first place. Any `LD_PRELOAD`
/// the user already had set (e.g. for an allocator or instrumentation tool)
/// is preserved, with these libraries prepended rather than replacing it.
#[cfg(target_os = "linux")]
fn reexec_appimage_with_system_wayland_libs_if_needed() {
    const GUARD_VAR: &str = "__POLIGAME_WAYLAND_LD_PRELOAD_SET";

    if std::env::var_os("APPIMAGE").is_none() || std::env::var_os(GUARD_VAR).is_some() {
        return;
    }

    let wanted = [
        "libwayland-client.so.0",
        "libwayland-egl.so.1",
        "libwayland-cursor.so.0",
    ];
    let libs = system_library_paths(&wanted);
    // A partial result is worse than no fix at all: whichever library wasn't
    // resolved would still load from the AppImage's bundled copy, so the
    // process would end up mixing host and bundled Wayland libraries anyway -
    // exactly the conflict this works around. Only proceed if every one of
    // them was found, and don't set the guard var otherwise so this is
    // retried (and still no-ops harmlessly) on the next launch.
    if libs.len() != wanted.len() {
        return;
    }

    let Ok(exe) = std::env::current_exe() else {
        return;
    };

    // Prepend to any LD_PRELOAD the user already has set (e.g. for an
    // allocator or instrumentation tool) rather than clobbering it.
    let mut preload = libs.join(":");
    if let Some(existing) = std::env::var_os("LD_PRELOAD") {
        if !existing.is_empty() {
            preload.push(':');
            preload.push_str(&existing.to_string_lossy());
        }
    }

    use std::os::unix::process::CommandExt;
    let err = std::process::Command::new(exe)
        .args(std::env::args_os().skip(1))
        .env("LD_PRELOAD", preload)
        .env(GUARD_VAR, "1")
        .exec();
    eprintln!("Failed to re-exec with system Wayland libraries preloaded: {err}");
}

/// Looks up the given library names in the dynamic linker cache (`ldconfig -p`),
/// which reflects the host's real, standard library search paths independent of
/// any `LD_LIBRARY_PATH` override. Prefers 64-bit (x86-64) entries when a name
/// has both 32- and 64-bit results. Names with no match are silently skipped.
#[cfg(target_os = "linux")]
fn system_library_paths(names: &[&str]) -> Vec<String> {
    let output = match std::process::Command::new("ldconfig").arg("-p").output() {
        Ok(o) if o.status.success() => o.stdout,
        _ => return Vec::new(),
    };
    let text = String::from_utf8_lossy(&output);

    let mut found = Vec::new();
    for name in names {
        // Walk every matching line, preferring an x86-64 entry over a 32-bit
        // one but otherwise keeping the first match found.
        let mut best: Option<&str> = None;
        for line in text.lines() {
            if line.split_whitespace().next() != Some(*name) {
                continue;
            }
            if best.is_none() || line.contains("x86-64") {
                best = Some(line);
            }
        }
        if let Some(line) = best {
            if let Some(path) = line.rsplit("=> ").next() {
                found.push(path.trim().to_string());
            }
        }
    }
    found
}

fn main() {
    // Must happen before anything else touches the environment: on Linux
    // AppImage builds this may re-exec the whole process with a fixed
    // LD_PRELOAD. See the function doc for why.
    #[cfg(target_os = "linux")]
    reexec_appimage_with_system_wayland_libs_if_needed();

    // Load environment variables from .env file in src-tauri directory
    // Create a .env file in the src-tauri directory with: STEAMGRIDDB_API_KEY=your_key_here
    dotenv::dotenv().ok();
    // Also try loading from src-tauri directory specifically
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let env_path = std::path::Path::new(&manifest_dir).join(".env");
        dotenv::from_path(&env_path).ok();
    }

    // Also work around WebKitGTK's newer DMA-BUF renderer being flaky on some
    // GPU/driver combinations (separate from the Wayland library issue above).
    // Only applies if the user hasn't already set it themselves.
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    tauri::Builder::default()
        .manage(discord_presence::DiscordPresenceState::new())
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

            // Register a global shortcut to show/hide the in-game overlay.
            //
            // Ctrl+Shift+F9 used to be hardcoded here, but Ctrl/F-keys are
            // among the combos most likely to already be claimed by desktop
            // environment or window manager global bindings (this is what
            // caused it to silently fail to register on some Linux setups).
            // Alt+Shift+O avoids both Ctrl/Cmd and Super, which are the
            // modifiers most commonly reserved by the OS/DE on Linux, Windows
            // and macOS, while still being trivial to type with one hand.
            // A couple of fallbacks (including the old combo) are tried in
            // order in case the primary one is ever claimed by something
            // else, and a failed registration is logged rather than treated
            // as fatal - the app should never fail to start just because a
            // global hotkey grab was refused by the OS.
            {
                use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

                let overlay_shortcut_candidates: [(Modifiers, Code); 3] = [
                    (Modifiers::ALT | Modifiers::SHIFT, Code::KeyO),
                    (Modifiers::CONTROL | Modifiers::ALT, Code::KeyO),
                    (Modifiers::SHIFT | Modifiers::CONTROL, Code::F9),
                ];

                let mut registered = false;
                for (modifiers, code) in overlay_shortcut_candidates {
                    let shortcut = Shortcut::new(Some(modifiers), code);
                    match app
                        .handle()
                        .global_shortcut()
                        .on_shortcut(shortcut, overlay_shortcut_handler)
                    {
                        Ok(_) => {
                            eprintln!(
                                "Registered overlay global shortcut: {:?}+{:?}",
                                modifiers, code
                            );
                            registered = true;
                            break;
                        }
                        Err(e) => {
                            eprintln!(
                                "Failed to register overlay shortcut {:?}+{:?}: {}",
                                modifiers, code, e
                            );
                        }
                    }
                }
                if !registered {
                    eprintln!(
                        "Warning: could not register any overlay global shortcut - \
                         all candidate key combinations were refused by the OS."
                    );
                }
            }

            let mut tray_builder = tauri::tray::TrayIconBuilder::with_id(TRAY_ICON_ID)
                .tooltip("PoliGame")
                .show_menu_on_left_click(false);

            if let Some(icon) = app.default_window_icon().cloned() {
                tray_builder = tray_builder.icon(icon);
            }

            tray_builder.build(app)?;
            ensure_tray_panel(&app.handle())?;

            #[cfg(target_os = "linux")]
            if let Some(main_window) = app.get_webview_window("main") {
                apply_linux_webkit_autoplay_workaround(&main_window);
            }

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
                if window.label() == "main"
                    || window.label() == TRAY_PANEL_LABEL
                    || window.label() == OVERDRIVE_OVERLAY_LABEL
                {
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
