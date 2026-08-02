use serde::Serialize;
use std::io::{self, Write};

#[derive(Serialize, Debug)]
#[serde(tag = "event", rename_all = "snake_case")]
pub enum IpcEvent {
    LaunchGame { game_id: String },
    Exit,
    Error { message: String },
}

pub fn send_event(event: IpcEvent) {
    let line = serde_json::to_string(&event).unwrap_or_default();
    let mut out = io::stdout();
    let _ = writeln!(out, "{}", line);
    let _ = out.flush();
}
