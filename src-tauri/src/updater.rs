use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Serialize)]
pub struct UpdateCheckResult {
    pub available: bool,
    pub current_version: String,
    pub version: Option<String>,
    pub notes: Option<String>,
    pub date: Option<String>,
}

#[tauri::command]
pub async fn check_for_app_update(app: AppHandle) -> Result<UpdateCheckResult, String> {
    let updater = app
        .updater_builder()
        .build()
        .map_err(|e| format!("Failed to initialize updater: {}", e))?;

    let current_version = app.package_info().version.to_string();

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?;

    if let Some(update) = update {
        Ok(UpdateCheckResult {
            available: true,
            current_version,
            version: Some(update.version.to_string()),
            notes: update.body.clone(),
            date: update.date.map(|d| d.to_string()),
        })
    } else {
        Ok(UpdateCheckResult {
            available: false,
            current_version,
            version: None,
            notes: None,
            date: None,
        })
    }
}

#[tauri::command]
pub async fn install_app_update(app: AppHandle) -> Result<bool, String> {
    let updater = app
        .updater_builder()
        .build()
        .map_err(|e| format!("Failed to initialize updater: {}", e))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Failed to check for updates: {}", e))?;

    if let Some(update) = update {
        update
            .download_and_install(
                |_chunk_length, _content_length| {},
                || {},
            )
            .await
            .map_err(|e| format!("Failed to download and install update: {}", e))?;

        app.restart();
    }

    Ok(false)
}
