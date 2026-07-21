use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub theme: String,
    pub language: String,
}

#[tauri::command]
pub async fn get_settings() -> Result<Settings, String> {
    Ok(Settings {
        theme: "dark".to_string(),
        language: "en".to_string(),
    })
}

#[tauri::command]
pub async fn update_settings(settings: Settings) -> Result<Settings, String> {
    Ok(settings)
}

