// Discord Rich Presence — delegates to the poligame-rpc sidecar process.
//
// The RPC helper runs as a child process and communicates via newline-delimited
// JSON on stdin. Commands are fire-and-forget; reconnection on IPC drops is
// handled entirely inside the helper.

use std::io::Write;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

pub struct RpcProcess {
    child: Child,
    stdin: ChildStdin,
}

pub struct DiscordPresenceState {
    process: Mutex<Option<RpcProcess>>,
}

impl DiscordPresenceState {
    pub fn new() -> Self {
        Self { process: Mutex::new(None) }
    }
}

// ─── Process lifecycle ───────────────────────────────────────────────────────

fn rpc_bin_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let mut path = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Failed to resolve resource dir: {e}"))?;

    let name = if cfg!(windows) { "poligame-rpc.exe" } else { "poligame-rpc" };
    path.push(name);
    Ok(path)
}

pub fn spawn_rpc_process(app: &AppHandle, state: &DiscordPresenceState) {
    let Ok(bin) = rpc_bin_path(app) else { return };
    if !bin.exists() {
        eprintln!("[rpc] binary not found at {}", bin.display());
        return;
    }

    spawn_rpc_process_with_bin(&bin, state);
}

fn spawn_rpc_process_with_bin(bin: &std::path::Path, state: &DiscordPresenceState) {
    match Command::new(bin)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
    {
        Ok(mut child) => {
            let stdin = child.stdin.take().expect("stdin was piped");
            let mut guard = state.process.lock().unwrap();
            *guard = Some(RpcProcess { child, stdin });
        }
        Err(e) => eprintln!("[rpc] failed to spawn: {e}"),
    }
}

pub fn kill_rpc_process(state: &DiscordPresenceState) {
    if let Ok(mut guard) = state.process.lock() {
        if let Some(mut rpc) = guard.take() {
            let _ = send_raw(&mut rpc.stdin, &serde_json::json!({"cmd": "quit"}));
            let _ = rpc.child.wait();
        }
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn send_raw(stdin: &mut ChildStdin, cmd: &serde_json::Value) -> Result<(), String> {
    let mut line = serde_json::to_string(cmd)
        .map_err(|e| format!("Serialisation error: {e}"))?;
    line.push('\n');
    stdin
        .write_all(line.as_bytes())
        .map_err(|e| format!("Failed writing to RPC helper: {e}"))
}

fn send(state: &DiscordPresenceState, cmd: serde_json::Value) -> Result<(), String> {
    let mut guard = state
        .process
        .lock()
        .map_err(|_| "Failed to lock RPC state".to_string())?;

    let rpc = guard
        .as_mut()
        .ok_or_else(|| "RPC helper is not running".to_string())?;

    send_raw(&mut rpc.stdin, &cmd).map_err(|e| {
        // If the write fails the helper has died; clear so next call respawns.
        *guard = None;
        e
    })
}

fn send_with_respawn(app: &AppHandle, state: &DiscordPresenceState, cmd: serde_json::Value) -> Result<(), String> {
    // Check if process is dead and respawn if needed
    {
        let mut guard = state.process.lock().unwrap();
        if let Some(rpc) = guard.as_mut() {
            if rpc.child.try_wait().map(|s| s.is_some()).unwrap_or(false) {
                *guard = None;
            }
        }
    }

    // If no process, try to respawn
    if state.process.lock().unwrap().is_none() {
        if let Ok(bin) = rpc_bin_path(app) {
            spawn_rpc_process_with_bin(&bin, state);
        }
    }

    // Now try to send
    send(state, cmd)
}

// TODO: Consider reading responses from the RPC helper to detect connection failures
// (e.g. if Discord is not running). Currently, commands are fire-and-forget, so the
// frontend will report success even if the helper fails to connect to Discord or the
// IPC pipe breaks. This trades response latency for implementation simplicity.

fn resolve_client_id(from_cmd: Option<String>) -> Option<String> {
    let v = from_cmd
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string);
    v.or_else(|| {
        std::env::var("DISCORD_CLIENT_ID")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
    })
}

// ─── Tauri commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub fn discord_presence_connect(
    app: AppHandle,
    state: State<'_, DiscordPresenceState>,
    client_id: Option<String>,
) -> Result<bool, String> {
    if resolve_client_id(client_id.clone()).is_none() {
        return Ok(false);
    }
    send_with_respawn(
        &app,
        &state,
        serde_json::json!({ "cmd": "connect", "client_id": client_id }),
    )?;
    Ok(true)
}

#[tauri::command]
pub fn discord_presence_update_launcher(
    app: AppHandle,
    state: State<'_, DiscordPresenceState>,
    route: Option<String>,
    client_id: Option<String>,
) -> Result<(), String> {
    send_with_respawn(
        &app,
        &state,
        serde_json::json!({ "cmd": "update_launcher", "route": route, "client_id": client_id }),
    )
}

#[tauri::command]
pub fn discord_presence_update_game(
    app: AppHandle,
    state: State<'_, DiscordPresenceState>,
    game_title: String,
    launcher: Option<String>,
    artwork_url: Option<String>,
    start_timestamp: Option<i64>,
    client_id: Option<String>,
) -> Result<(), String> {
    send_with_respawn(
        &app,
        &state,
        serde_json::json!({
            "cmd": "update_game",
            "game_title": game_title,
            "launcher": launcher,
            "artwork_url": artwork_url,
            "start_timestamp": start_timestamp,
            "client_id": client_id,
        }),
    )
}

#[tauri::command]
pub fn discord_presence_clear(
    app: AppHandle,
    state: State<'_, DiscordPresenceState>,
) -> Result<(), String> {
    send_with_respawn(&app, &state, serde_json::json!({ "cmd": "clear" }))
}
