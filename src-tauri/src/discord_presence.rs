use discord_rich_presence::{
    activity,
    DiscordIpc,
    DiscordIpcClient,
};
use std::sync::Mutex;
use tauri::State;

fn rewrite_icon_variant_url(url: &str) -> String {
    let Ok(mut parsed) = reqwest::Url::parse(url) else {
        return url.to_string();
    };

    let path = parsed.path();
    if path.ends_with("/32/128x128.png") {
        return parsed.to_string();
    }

    let Some(path_without_ico) = path.strip_suffix(".ico") else {
        return parsed.to_string();
    };

    let mut next_path = path_without_ico.to_string();
    if !next_path.ends_with('/') {
        next_path.push('/');
    }
    next_path.push_str("32/128x128.png");
    parsed.set_path(&next_path);

    parsed.to_string()
}

fn to_discord_external_asset_url(raw: Option<String>) -> Option<String> {
    let candidate = raw?;
    if candidate.is_empty() {
        return None;
    }

    if let Some(without_prefix) = candidate.strip_prefix("mp:") {
        if without_prefix.starts_with("https://") || without_prefix.starts_with("http://") {
            let rewritten = rewrite_icon_variant_url(without_prefix);
            return Some(rewritten);
        }

        return Some(without_prefix.to_string());
    }

    if candidate.starts_with("https://") || candidate.starts_with("http://") {
        let rewritten = rewrite_icon_variant_url(&candidate);
        return Some(rewritten);
    }

    None
}

pub struct DiscordPresenceState {
    client: Mutex<Option<DiscordIpcClient>>,
    active_client_id: Mutex<Option<String>>,
}

impl DiscordPresenceState {
    pub fn new() -> Self {
        Self {
            client: Mutex::new(None),
            active_client_id: Mutex::new(None),
        }
    }
}

fn resolve_client_id(client_id: Option<String>) -> Option<String> {
    let provided = client_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string);

    if provided.is_some() {
        return provided;
    }

    std::env::var("DISCORD_CLIENT_ID")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn with_connected_client<F, T>(
    state: &DiscordPresenceState,
    client_id: Option<String>,
    action: F,
) -> Result<T, String>
where
    F: FnOnce(&mut DiscordIpcClient) -> Result<T, String>,
{
    let resolved_client_id = resolve_client_id(client_id)
        .ok_or_else(|| "Discord client id is missing".to_string())?;

    let mut id_guard = state
        .active_client_id
        .lock()
        .map_err(|_| "Failed to lock Discord client id state".to_string())?;
    let mut client_guard = state
        .client
        .lock()
        .map_err(|_| "Failed to lock Discord client state".to_string())?;

    let should_reconnect = match id_guard.as_ref() {
        Some(current_id) => current_id != &resolved_client_id,
        None => true,
    };

    if should_reconnect {
        if let Some(client) = client_guard.as_mut() {
            let _ = client.clear_activity();
            let _ = client.close();
        }

        let mut client = DiscordIpcClient::new(&resolved_client_id)
            .map_err(|error| format!("Failed creating Discord IPC client: {error}"))?;

        client
            .connect()
            .map_err(|error| format!("Failed connecting to Discord IPC: {error}"))?;

        *client_guard = Some(client);
        *id_guard = Some(resolved_client_id);
    }

    let client = client_guard
        .as_mut()
        .ok_or_else(|| "Discord IPC client is unavailable".to_string())?;

    action(client)
}

#[tauri::command]
pub fn discord_presence_connect(
    state: State<'_, DiscordPresenceState>,
    client_id: Option<String>,
) -> Result<bool, String> {
    if resolve_client_id(client_id.clone()).is_none() {
        return Ok(false);
    }

    with_connected_client(&state, client_id, |_| Ok(()))?;
    Ok(true)
}

#[tauri::command]
pub fn discord_presence_update_launcher(
    state: State<'_, DiscordPresenceState>,
    route: Option<String>,
    client_id: Option<String>,
) -> Result<(), String> {
    let route_label = route
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Library");

    let details = match route_label {
        "/" => "Browsing library".to_string(),
        path if path.starts_with("/game/") => "Viewing game details".to_string(),
        path if path.starts_with("/browser") => "Browsing integrated web".to_string(),
        path if path.starts_with("/community") => "Exploring community".to_string(),
        path if path.starts_with("/marketplace") => "Browsing marketplace".to_string(),
        path if path.starts_with("/profile") => "Viewing profile".to_string(),
        path if path.starts_with("/privacy") => "Managing privacy settings".to_string(),
        _ => "Browsing launcher".to_string(),
    };

    with_connected_client(&state, client_id, |client| {
        client
            .set_activity(
                activity::Activity::new()
                    .state("In PoliGame")
                    .details(&details)
                    .assets(
                        activity::Assets::new()
                            .large_image("controller")
                            .large_text("PoliGame"),
                    ),
            )
            .map_err(|error| format!("Failed setting Discord launcher activity: {error}"))
    })
}

#[tauri::command]
pub fn discord_presence_update_game(
    state: State<'_, DiscordPresenceState>,
    game_title: String,
    launcher: Option<String>,
    artwork_url: Option<String>,
    start_timestamp: Option<i64>,
    client_id: Option<String>,
) -> Result<(), String> {
    let trimmed_title = game_title.trim();
    if trimmed_title.is_empty() {
        return Err("Game title is required for Discord presence".to_string());
    }

    let launcher_label = launcher
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("Unknown launcher");

    let large_image = to_discord_external_asset_url(artwork_url)
        .unwrap_or_else(|| "controller".to_string());

    let mut rich_activity = activity::Activity::new()
        .details(trimmed_title)
        .activity_type(activity::ActivityType::Playing)
        .assets(
            activity::Assets::new()
                .large_image(&large_image)
                .large_text(trimmed_title)
                .small_image("controller")
                .small_text("PoliGame"),
        )
        .buttons(vec![activity::Button::new("Open PoliGame", "https://poligame.app")]);

    if let Some(start) = start_timestamp {
        rich_activity = rich_activity.timestamps(activity::Timestamps::new().start(start));
    }

    with_connected_client(&state, client_id, |client| {
        if let Err(primary_error) = client.set_activity(rich_activity) {
            let mut fallback_activity = activity::Activity::new()
                .state("Playing")
                .details(trimmed_title)
                .activity_type(activity::ActivityType::Playing)
                .assets(
                    activity::Assets::new()
                        .large_image("poligame")
                        .large_text("PoliGame")
                        .small_image("poligame")
                        .small_text(launcher_label),
                )
                .buttons(vec![activity::Button::new("Open PoliGame", "https://poligame.app")]);

            if let Some(start) = start_timestamp {
                fallback_activity = fallback_activity
                    .timestamps(activity::Timestamps::new().start(start));
            }

            return client
                .set_activity(fallback_activity)
                .map_err(|fallback_error| {
                    format!(
                        "Failed setting Discord game activity. primary={primary_error}; fallback={fallback_error}"
                    )
                });
        }

        Ok(())
    })
}

#[tauri::command]
pub fn discord_presence_clear(state: State<'_, DiscordPresenceState>) -> Result<(), String> {
    let mut client_guard = state
        .client
        .lock()
        .map_err(|_| "Failed to lock Discord client state".to_string())?;

    if let Some(client) = client_guard.as_mut() {
        client
            .clear_activity()
            .map_err(|error| format!("Failed clearing Discord activity: {error}"))?;
    }

    Ok(())
}
