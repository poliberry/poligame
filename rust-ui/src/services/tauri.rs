use crate::models::{Game, LaunchArgs};

pub async fn games() -> Result<Vec<Game>, String> {
    let value = tauri_wasm::invoke("get_all_games")
        .await
        .map_err(|error| error.to_string())?;
    serde_wasm_bindgen::from_value(value)
        .map_err(|error| format!("Could not read the local game library: {error}"))
}

pub async fn scan_games() -> Result<String, String> {
    let value = tauri_wasm::invoke("scan_all_games")
        .await
        .map_err(|error| error.to_string())?;
    value
        .as_string()
        .ok_or_else(|| "The game scanner returned an invalid response.".to_string())
}

pub async fn launch_game(game_id: &str) -> Result<(), String> {
    let launch_args = LaunchArgs { game_id };
    let args = tauri_wasm::args(&launch_args).map_err(|error| error.to_string())?;
    tauri_wasm::invoke("launch_game")
        .with_args(args)
        .await
        .map(|_| ())
        .map_err(|error| error.to_string())
}
