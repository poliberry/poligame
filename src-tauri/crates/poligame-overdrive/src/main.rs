// PoliGame Overdrive — fullscreen gpui game launcher
//
// Launched by the main PoliGame process. Reads game data directly from the
// shared SQLite database. Communicates events back to the main app via
// newline-delimited JSON on stdout (launch requests, exit signals).
//
// Spatial navigation: keyboard arrow keys + Enter/Escape, controller via gilrs.
// Touch: on-text-focus the OS touch keyboard is invoked (Windows TabTip /
// platform equivalent); a built-in GPUI on-screen keyboard backs this up.

// Only hide console in release builds; debug builds show console for TUI
#![cfg_attr(all(windows, not(debug_assertions)), windows_subsystem = "windows")]

mod db;
mod ipc;
mod keyboard;
mod ui;

use std::sync::{Arc, Mutex};
use anyhow::Result;

pub use db::{Game, GameDb};
pub use ipc::{IpcEvent, send_event};

fn main() -> Result<()> {
    // On Windows, allocate a console if one doesn't exist (for TUI)
    #[cfg(windows)]
    {
        use windows::Win32::System::Console::*;
        unsafe {
            let _ = AllocConsole();
        }
    }

    let db_path = std::env::var("POLIGAME_DB").ok().unwrap_or_else(|| {
        dirs::data_dir()
            .unwrap_or_default()
            .join("poligame")
            .join("poligame.db")
            .to_string_lossy()
            .into_owned()
    });

    eprintln!("[overdrive] Loading database from: {}", db_path);

    let rt = tokio::runtime::Runtime::new()?;
    let games = match rt.block_on(GameDb::load(&db_path)) {
        Ok(g) => {
            eprintln!("[overdrive] Successfully loaded {} games", g.len());
            g
        }
        Err(e) => {
            eprintln!("[overdrive] ERROR loading games: {}", e);
            Vec::new()
        }
    };

    let app_state = Arc::new(Mutex::new(ui::AppState {
        games,
        selected_index: 0,
        view: ui::View::Library,
        keyboard_open: false,
        keyboard_target: None,
    }));

    ui::run(app_state);

    Ok(())
}
