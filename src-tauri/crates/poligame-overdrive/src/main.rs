// PoliGame Overdrive — fullscreen gpui game launcher
//
// Launched by the main PoliGame process. Reads game data directly from the
// shared SQLite database. Communicates events back to the main app via
// newline-delimited JSON on stdout (launch requests, exit signals).
//
// Spatial navigation: keyboard arrow keys + Enter/Escape, controller via gilrs.
// Touch: on-text-focus the OS touch keyboard is invoked (Windows TabTip /
// platform equivalent); a built-in GPUI on-screen keyboard backs this up.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod ipc;
mod keyboard;
mod ui;

use std::sync::{Arc, Mutex};
use anyhow::Result;

pub use db::{Game, GameDb};
pub use ipc::{IpcEvent, send_event};

fn main() -> Result<()> {
    let db_path = std::env::var("POLIGAME_DB").ok().unwrap_or_else(|| {
        dirs::data_dir()
            .unwrap_or_default()
            .join("poligame")
            .join("poligame.db")
            .to_string_lossy()
            .into_owned()
    });

    let rt = tokio::runtime::Runtime::new()?;
    let games = rt.block_on(GameDb::load(&db_path)).unwrap_or_default();

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
