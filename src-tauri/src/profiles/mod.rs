use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub username: String,
    pub avatar: Option<String>,
}

#[tauri::command]
pub async fn get_all_profiles() -> Result<Vec<Profile>, String> {
    Ok(vec![])
}

#[tauri::command]
pub async fn create_profile(_username: String) -> Result<Profile, String> {
    Err("Not implemented".to_string())
}

#[tauri::command]
pub async fn update_profile(_profile: Profile) -> Result<Profile, String> {
    Err("Not implemented".to_string())
}

#[tauri::command]
pub async fn delete_profile(_profile_id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn switch_profile(_profile_id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn get_current_profile() -> Result<Option<Profile>, String> {
    Ok(None)
}

