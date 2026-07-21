/// Hardcoded Steam API Key
/// This is embedded in the application binary
const STEAM_API_KEY: &str = "AE410E91841DDF629A99128D8DDA0626"; // Replace with actual key

/// Get the hardcoded Steam API key
pub fn get_steam_api_key() -> Result<String, String> {
    // Check if the key has been replaced from placeholder
    if STEAM_API_KEY == "YOUR_STEAM_API_KEY_HERE" {
        return Err("Steam API key not configured. Please set STEAM_API_KEY constant in src-tauri/src/api_keys.rs".to_string());
    }
    Ok(STEAM_API_KEY.to_string())
}
