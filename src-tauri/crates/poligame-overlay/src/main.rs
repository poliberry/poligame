// PoliGame Game Overlay
//
// A transparent, always-on-top gpui window that renders over running games.
// Toggled via Ctrl+Shift+F9 (sent from the main PoliGame process).
//
// The overlay contains two panels:
//   • Standard overlay: Game Options, Settings, system widgets
//   • Overdrive panel: full Overdrive-style navigation for users in Overdrive mode
//
// IPC: newline-delimited JSON commands arrive on stdin from the main process.
// Events are sent back on stdout.

// Show console in debug builds so we can see errors and output
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod ipc;
mod ui;

use anyhow::Result;

fn main() -> Result<()> {
    let game_title = std::env::var("POLIGAME_GAME_TITLE").ok();
    let game_id    = std::env::var("POLIGAME_GAME_ID").ok();

    let (cmd_tx, cmd_rx) = std::sync::mpsc::channel::<ipc::Command>();

    // Background thread: read commands from stdin
    std::thread::spawn(move || {
        use std::io::BufRead;
        let stdin = std::io::stdin();
        for line in stdin.lock().lines() {
            match line {
                Ok(l) if !l.trim().is_empty() => {
                    if let Ok(cmd) = serde_json::from_str::<ipc::Command>(&l) {
                        if cmd_tx.send(cmd).is_err() { break; }
                    }
                }
                Ok(_)  => {}
                Err(_) => break,
            }
        }
    });

    ui::run(game_title, game_id, cmd_rx);

    Ok(())
}
