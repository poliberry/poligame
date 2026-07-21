use serde::{Deserialize, Serialize};

const STEAM_API_BASE: &str = "https://api.steampowered.com";
const STEAM_STORE_API_BASE: &str = "https://store.steampowered.com";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamAchievement {
    pub apiname: String,
    pub achieved: u8, // 0 or 1
    pub unlocktime: u64,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerStats {
    #[serde(default)]
    pub steamID: Option<String>,
    #[serde(default)]
    pub gameName: Option<String>,
    #[serde(default)]
    pub achievements: Vec<SteamAchievement>,
    #[serde(default)]
    pub success: Option<bool>,
    #[serde(default)]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PlayerAchievementsResponse {
    pub playerstats: PlayerStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalAchievement {
    pub name: String,
    pub percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GlobalAchievementPercentagesResponse {
    pub achievementpercentages: GlobalAchievementPercentages,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GlobalAchievementPercentages {
    pub achievements: Vec<GlobalAchievement>,
}

pub async fn get_player_achievements(
    steam_api_key: &str,
    steam_user_id: &str,
    app_id: &str,
) -> Result<Vec<SteamAchievement>, String> {
    let url = format!(
        "{}/ISteamUserStats/GetPlayerAchievements/v0001/?appid={}&key={}&steamid={}",
        STEAM_API_BASE, app_id, steam_api_key, steam_user_id
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch achievements: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Steam API returned error: {}", response.status()));
    }

    // Get response text first to check for errors
    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response text: {}", e))?;

    eprintln!("Steam API response: {}", response_text);

    // Try to parse as JSON
    let data: PlayerAchievementsResponse = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse response: {} (response: {})", e, &response_text[..response_text.len().min(500)]))?;

    // Check if the response indicates no stats/achievements
    if let Some(success) = data.playerstats.success {
        if !success {
            let error_msg = data.playerstats.error.unwrap_or_else(|| "Unknown error".to_string());
            eprintln!("Steam API returned error: {} (success: false)", error_msg);
            // Return empty vector instead of error for "no stats" case
            if error_msg.contains("no stats") || error_msg.contains("Requested app has no stats") || error_msg.contains("has no stats") {
                eprintln!("Game has no achievements, returning empty vector");
                return Ok(Vec::new());
            }
            return Err(format!("Steam API error: {}", error_msg));
        }
    }

    // If achievements vector is empty and no error, it means no achievements
    if data.playerstats.achievements.is_empty() {
        eprintln!("Achievements vector is empty for app_id: {}", app_id);
    }

    Ok(data.playerstats.achievements)
}

pub async fn get_global_achievement_percentages(
    app_id: &str,
) -> Result<Vec<GlobalAchievement>, String> {
    let url = format!(
        "{}/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v0002/?gameid={}",
        STEAM_API_BASE, app_id
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch global achievements: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Steam API returned error: {}", response.status()));
    }

    let data: GlobalAchievementPercentagesResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    Ok(data.achievementpercentages.achievements)
}

// Achievement schema entry (from GetSchemaForGame)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementSchemaEntry {
    pub name: String,
    #[serde(default)]
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    #[serde(rename = "icongray")]
    pub icon_gray: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AvailableGameStats {
    #[serde(default)]
    pub achievements: Vec<AchievementSchemaEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GameSchema {
    #[serde(rename = "gameName")]
    pub game_name: Option<String>,
    #[serde(rename = "gameVersion")]
    pub game_version: Option<String>,
    #[serde(rename = "availableGameStats")]
    pub available_game_stats: Option<AvailableGameStats>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SchemaForGameResponse {
    pub game: GameSchema,
}

pub async fn get_schema_for_game(
    steam_api_key: &str,
    app_id: &str,
) -> Result<Vec<AchievementSchemaEntry>, String> {
    let url = format!(
        "{}/ISteamUserStats/GetSchemaForGame/v2/?key={}&appid={}",
        STEAM_API_BASE, steam_api_key, app_id
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch game schema: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Steam API returned error: {}", response.status()));
    }

    // Get the raw response text first for debugging
    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response text: {}", e))?;
    
    eprintln!("=== SCHEMA RAW RESPONSE ===");
    eprintln!("{}", response_text);
    eprintln!("=== END SCHEMA RAW RESPONSE ===");
    
    // Parse the JSON - the API returns {"game": {...}} directly, not wrapped in "result"
    let data: SchemaForGameResponse = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse schema response: {} (response preview: {})", e, &response_text[..response_text.len().min(500)]))?;

    let achievements = data
        .game
        .available_game_stats
        .map(|ags| ags.achievements)
        .unwrap_or_default();
    
    eprintln!("=== PARSED SCHEMA ACHIEVEMENTS ({} total) ===", achievements.len());
    for (i, ach) in achievements.iter().enumerate() {
        eprintln!("Achievement {}: name='{}', displayName='{:?}', description='{:?}', icon='{:?}', icongray='{:?}'", 
            i, ach.name, ach.display_name, ach.description, ach.icon, ach.icon_gray);
    }
    eprintln!("=== END PARSED SCHEMA ===");
    
    Ok(achievements)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewsItem {
    pub gid: String,
    pub title: String,
    pub url: String,
    #[serde(rename = "is_external_url")]
    pub is_external_url: bool,
    pub author: String,
    pub contents: String,
    pub feedlabel: String,
    pub date: u64,
    pub feedname: String,
    pub feed_type: Option<i32>,
    pub appid: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct NewsResponse {
    pub appnews: AppNews,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppNews {
    pub appid: u64,
    pub newsitems: Vec<NewsItem>,
    pub count: u64,
}

/// Fetch news for a Steam game
pub async fn get_news_for_app(
    app_id: &str,
    max_items: Option<u32>,
) -> Result<Vec<NewsItem>, String> {
    let max_items = max_items.unwrap_or(20);
    let url = format!(
        "{}/ISteamNews/GetNewsForApp/v2/?appid={}&count={}",
        STEAM_API_BASE, app_id, max_items
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch news: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Steam API returned error: {}", response.status()));
    }

    let data: NewsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse news response: {}", e))?;

    Ok(data.appnews.newsitems)
}

