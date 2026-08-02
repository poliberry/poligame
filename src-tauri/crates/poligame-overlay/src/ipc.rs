use serde::{Deserialize, Serialize};
use std::io::{self, Write};

#[derive(Deserialize, Debug, Clone)]
#[serde(tag = "cmd", rename_all = "snake_case")]
pub enum Command {
    Show,
    Hide,
    GameStarted { game_title: String, game_id: String },
    GameStopped,
    Quit,
}

#[derive(Serialize, Debug)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum Event {
    QuitGame,
    ReturnToLauncher,
    ExitApp,
}

pub fn send_event(ev: Event) {
    let line = serde_json::to_string(&ev).unwrap_or_default();
    let mut out = io::stdout();
    let _ = writeln!(out, "{}", line);
    let _ = out.flush();
}
