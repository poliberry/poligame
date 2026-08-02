// PoliGame Discord RPC Helper
//
// Runs as a background subprocess managed by the main PoliGame process.
// Reads newline-delimited JSON commands from stdin and writes JSON responses
// to stdout. Handles all Discord IPC connection lifecycle, including
// reconnection after dropped sockets.
//
// Protocol:
//   Commands (stdin, one JSON object per line):
//     {"cmd":"connect","client_id":"..."}
//     {"cmd":"update_launcher","route":"/","client_id":"..."}
//     {"cmd":"update_game","game_title":"...","launcher":"...","artwork_url":"...","start_timestamp":1234,"client_id":"..."}
//     {"cmd":"clear"}
//     {"cmd":"quit"}
//
//   Responses (stdout, one JSON object per line):
//     {"ok":true}
//     {"ok":false,"error":"..."}

#![windows_subsystem = "windows"]

use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};
use serde::{Deserialize, Serialize};
use std::io::{self, BufRead, Write};
use url::Url;

#[derive(Deserialize, Debug)]
#[serde(tag = "cmd", rename_all = "snake_case")]
enum Command {
    Connect {
        client_id: Option<String>,
    },
    UpdateLauncher {
        route: Option<String>,
        client_id: Option<String>,
    },
    UpdateGame {
        game_title: String,
        launcher: Option<String>,
        artwork_url: Option<String>,
        start_timestamp: Option<i64>,
        client_id: Option<String>,
    },
    Clear,
    Quit,
}

#[derive(Serialize)]
struct Response {
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

impl Response {
    fn ok() -> Self {
        Self { ok: true, error: None }
    }
    fn err(msg: impl ToString) -> Self {
        Self { ok: false, error: Some(msg.to_string()) }
    }
}

fn rewrite_icon_url(raw_url: &str) -> String {
    let Ok(mut parsed) = Url::parse(raw_url) else {
        return raw_url.to_string();
    };
    if parsed.host_str() != Some("cdn2.steamgriddb.com") {
        return raw_url.to_string();
    }
    let path = parsed.path();
    if path.ends_with("/32/128x128.png") {
        return parsed.to_string();
    }
    let Some(without_ico) = path.strip_suffix(".ico") else {
        return parsed.to_string();
    };
    let mut next = without_ico.to_string();
    if !next.ends_with('/') {
        next.push('/');
    }
    next.push_str("32/128x128.png");
    parsed.set_path(&next);
    parsed.to_string()
}

fn to_discord_image(raw: Option<String>) -> Option<String> {
    let url = raw?.trim().to_string();
    if url.is_empty() {
        return None;
    }
    if let Some(inner) = url.strip_prefix("mp:") {
        if inner.starts_with("https://") || inner.starts_with("http://") {
            return Some(format!("mp:{}", rewrite_icon_url(inner)));
        }
        return Some(url);
    }
    if url.starts_with("https://") || url.starts_with("http://") {
        return Some(format!("mp:{}", rewrite_icon_url(&url)));
    }
    None
}

fn resolve_client_id(from_cmd: Option<String>) -> Option<String> {
    let trimmed = from_cmd
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(ToString::to_string);
    if trimmed.is_some() {
        return trimmed;
    }
    std::env::var("DISCORD_CLIENT_ID")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

struct State {
    client: Option<DiscordIpcClient>,
    active_id: Option<String>,
}

impl State {
    fn new() -> Self {
        Self { client: None, active_id: None }
    }

    fn ensure_connected(&mut self, client_id: Option<String>) -> Result<&mut DiscordIpcClient, String> {
        let id = resolve_client_id(client_id)
            .ok_or_else(|| "Discord client ID not configured".to_string())?;

        let needs_reconnect = self.active_id.as_deref() != Some(&id);

        if needs_reconnect {
            if let Some(c) = self.client.as_mut() {
                let _ = c.clear_activity();
                let _ = c.close();
            }
            self.client = None;
            self.active_id = None;

            let mut c = DiscordIpcClient::new(&id)
                .map_err(|e| format!("Failed to create Discord IPC client: {e}"))?;
            c.connect()
                .map_err(|e| format!("Failed to connect to Discord: {e}"))?;

            self.client = Some(c);
            self.active_id = Some(id);
        }

        self.client
            .as_mut()
            .ok_or_else(|| "Discord client unavailable".to_string())
    }

    fn reset_connection(&mut self) {
        if let Some(c) = self.client.as_mut() {
            let _ = c.close();
        }
        self.client = None;
        self.active_id = None;
    }
}

fn handle(state: &mut State, cmd: Command) -> Response {
    match cmd {
        Command::Connect { client_id } => {
            if resolve_client_id(client_id.clone()).is_none() {
                return Response::err("Discord client ID not configured");
            }
            match state.ensure_connected(client_id) {
                Ok(_) => Response::ok(),
                Err(e) => Response::err(e),
            }
        }

        Command::UpdateLauncher { route, client_id } => {
            let route_label = route.as_deref().unwrap_or("/");
            let details = match route_label {
                "/" => "Browsing library",
                p if p.starts_with("/game/") => "Viewing game details",
                p if p.starts_with("/browser") => "Browsing integrated web",
                p if p.starts_with("/community") => "Exploring community",
                p if p.starts_with("/marketplace") => "Browsing marketplace",
                p if p.starts_with("/profile") => "Viewing profile",
                p if p.starts_with("/privacy") => "Managing privacy settings",
                _ => "Browsing launcher",
            };

            match state.ensure_connected(client_id) {
                Err(e) => Response::err(e),
                Ok(c) => {
                    let result = c.set_activity(
                        activity::Activity::new()
                            .state("In PoliGame")
                            .details(details)
                            .assets(
                                activity::Assets::new()
                                    .large_image("controller")
                                    .large_text("PoliGame"),
                            ),
                    );
                    if let Err(e) = result {
                        state.reset_connection();
                        Response::err(format!("Failed to set launcher activity: {e}"))
                    } else {
                        Response::ok()
                    }
                }
            }
        }

        Command::UpdateGame {
            game_title,
            launcher,
            artwork_url,
            start_timestamp,
            client_id,
        } => {
            let title = game_title.trim().to_string();
            if title.is_empty() {
                return Response::err("Game title is required");
            }

            let launcher_label = launcher
                .as_deref()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .unwrap_or("Unknown");

            let large_image = to_discord_image(artwork_url)
                .unwrap_or_else(|| "controller".to_string());

            let mut rich = activity::Activity::new()
                .details(&title)
                .activity_type(activity::ActivityType::Playing)
                .assets(
                    activity::Assets::new()
                        .large_image(&large_image)
                        .large_text(&title)
                        .small_image("controller")
                        .small_text("PoliGame"),
                )
                .buttons(vec![activity::Button::new(
                    "Open PoliGame",
                    "https://poligame.app",
                )]);

            if let Some(ts) = start_timestamp {
                rich = rich.timestamps(activity::Timestamps::new().start(ts));
            }

            match state.ensure_connected(client_id) {
                Err(e) => Response::err(e),
                Ok(c) => {
                    if let Err(primary_err) = c.set_activity(rich) {
                        // Try fallback without external artwork
                        let mut fallback = activity::Activity::new()
                            .state("Playing")
                            .details(&title)
                            .activity_type(activity::ActivityType::Playing)
                            .assets(
                                activity::Assets::new()
                                    .large_image("poligame")
                                    .large_text("PoliGame")
                                    .small_image("controller")
                                    .small_text(launcher_label),
                            )
                            .buttons(vec![activity::Button::new(
                                "Open PoliGame",
                                "https://poligame.app",
                            )]);
                        if let Some(ts) = start_timestamp {
                            fallback = fallback.timestamps(activity::Timestamps::new().start(ts));
                        }
                        match c.set_activity(fallback) {
                            Ok(_) => Response::ok(),
                            Err(fallback_err) => {
                                state.reset_connection();
                                Response::err(format!(
                                    "primary={primary_err}; fallback={fallback_err}"
                                ))
                            }
                        }
                    } else {
                        Response::ok()
                    }
                }
            }
        }

        Command::Clear => {
            if let Some(c) = state.client.as_mut() {
                if let Err(e) = c.clear_activity() {
                    state.reset_connection();
                    return Response::err(format!("Failed to clear activity: {e}"));
                }
            }
            Response::ok()
        }

        Command::Quit => std::process::exit(0),
    }
}

fn main() {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut out = io::BufWriter::new(stdout.lock());
    let mut state = State::new();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) if !l.trim().is_empty() => l,
            Ok(_) => continue,
            Err(_) => break,
        };

        let response = match serde_json::from_str::<Command>(&line) {
            Ok(cmd) => handle(&mut state, cmd),
            Err(e) => Response::err(format!("Invalid command: {e}")),
        };

        let _ = writeln!(out, "{}", serde_json::to_string(&response).unwrap_or_default());
        let _ = out.flush();
    }
}
