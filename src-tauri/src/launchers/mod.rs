pub mod steam;
pub mod ea;
pub mod epic;
pub mod rockstar;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LauncherStatus {
    pub launcher_type: LauncherType,
    pub installed: bool,
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LauncherType {
    #[serde(rename = "steam")]
    Steam,
    #[serde(rename = "ea")]
    EA,
    #[serde(rename = "epic")]
    Epic,
    #[serde(rename = "rockstar")]
    Rockstar,
}

async fn detect_steam() -> LauncherStatus {
    match steam::get_steam_path() {
        Ok(path) => LauncherStatus {
            launcher_type: LauncherType::Steam,
            installed: true,
            path: Some(path.to_string_lossy().to_string()),
        },
        Err(_) => LauncherStatus {
            launcher_type: LauncherType::Steam,
            installed: false,
            path: None,
        },
    }
}

async fn detect_ea() -> LauncherStatus {
    match ea::get_ea_path() {
        Ok(path) => LauncherStatus {
            launcher_type: LauncherType::EA,
            installed: true,
            path: Some(path.to_string_lossy().to_string()),
        },
        Err(_) => LauncherStatus {
            launcher_type: LauncherType::EA,
            installed: false,
            path: None,
        },
    }
}

async fn detect_epic() -> LauncherStatus {
    match epic::get_epic_path() {
        Ok(path) => LauncherStatus {
            launcher_type: LauncherType::Epic,
            installed: true,
            path: Some(path.to_string_lossy().to_string()),
        },
        Err(_) => LauncherStatus {
            launcher_type: LauncherType::Epic,
            installed: false,
            path: None,
        },
    }
}

async fn detect_rockstar() -> LauncherStatus {
    match rockstar::get_rockstar_path() {
        Ok(path) => LauncherStatus {
            launcher_type: LauncherType::Rockstar,
            installed: true,
            path: Some(path.to_string_lossy().to_string()),
        },
        Err(_) => LauncherStatus {
            launcher_type: LauncherType::Rockstar,
            installed: false,
            path: None,
        },
    }
}

#[tauri::command]
pub async fn scan_all_launchers() -> Result<Vec<LauncherStatus>, String> {
    let steam = detect_steam().await;
    let ea = detect_ea().await;
    let epic = detect_epic().await;
    let rockstar = detect_rockstar().await;
    
    Ok(vec![steam, ea, epic, rockstar])
}

#[tauri::command]
pub async fn scan_all_games() -> Result<String, String> {
    use crate::games;
    use chrono::Utc;
    use uuid::Uuid;
    use std::time::Duration;
    
    // Wait for database to be initialized (with timeout)
    let mut attempts = 0;
    let max_attempts = 50;
    let pool = loop {
        match games::get_db_pool() {
            Ok(p) => {
                eprintln!("Database pool retrieved successfully");
                break p;
            },
            Err(e) => {
                if attempts >= max_attempts {
                    eprintln!("ERROR: Database pool not available after {} attempts: {}", max_attempts, e);
                    return Err(format!("Database not initialized: {}", e));
                }
                attempts += 1;
                eprintln!("Waiting for database initialization... (attempt {}/{})", attempts, max_attempts);
                tokio::time::sleep(Duration::from_millis(100)).await;
            },
        }
    };
    
    let mut games_found = 0;
    
    // Scan Steam games
    let sgdb_client = crate::steamgriddb::SteamGridDBClient::new();
    match steam::scan_steam_games().await {
        Ok(steam_game_ids) => {
            eprintln!("Found {} Steam games", steam_game_ids.len());
            for app_id in steam_game_ids {
                // Get game details
                if let Ok(game) = steam::get_steam_game_details(&app_id).await {
                    let game_id = Uuid::new_v4().to_string();
                    let game_name = game.name.clone();
                    let metadata_json = serde_json::to_string(&game).unwrap_or_default();
                    
                    // Search for game on SteamGridDB by name
                    eprintln!("Searching SteamGridDB for game: {}", game_name);
                    let griddb_id = match sgdb_client.search_by_name(&game_name).await {
                        Ok(Some(id)) => {
                            eprintln!("Found game on SteamGridDB with ID: {}", id);
                            Some(id)
                        },
                        Ok(None) => {
                            eprintln!("Game '{}' not found on SteamGridDB", game_name);
                            None
                        },
                        Err(e) => {
                            eprintln!("Error searching SteamGridDB for '{}': {}", game_name, e);
                            None
                        },
                    };
                    
                    // Fetch images from SteamGridDB using the griddb_id
                    let images = if let Some(griddb_id) = griddb_id {
                        eprintln!("Fetching images from SteamGridDB for game ID: {}", griddb_id);
                        match sgdb_client.fetch_game_images(griddb_id).await {
                            Ok(imgs) => {
                                eprintln!("Successfully fetched images: grid={:?}, logo={:?}, header={:?}, icon={:?}", 
                                    imgs.grid_cover_art.is_some(), 
                                    imgs.logo.is_some(), 
                                    imgs.header_art.is_some(),
                                    imgs.icon.is_some());
                                imgs
                            },
                            Err(e) => {
                                eprintln!("Failed to fetch images from SteamGridDB: {}", e);
                                crate::steamgriddb::GameImages {
                                    grid_cover_art: None,
                                    logo: None,
                                    header_art: None,
                                    icon: None,
                                }
                            },
                        }
                    } else {
                        crate::steamgriddb::GameImages {
                            grid_cover_art: None,
                            logo: None,
                            header_art: None,
                            icon: None,
                        }
                    };
                    
                    let record = games::database::GameRecord {
                        id: game_id.clone(),
                        launcher: "steam".to_string(),
                        launcher_game_id: app_id.clone(),
                        title: game.name.clone(),
                        install_path: Some(game.install_dir.clone()),
                        cover_art: game.cover_art.clone(),
                        griddb_id,
                        grid_cover_art: images.grid_cover_art,
                        logo: images.logo,
                        header_art: images.header_art,
                        icon: images.icon,
                        metadata_json: Some(metadata_json),
                        playtime_minutes: 0,
                        last_played: None,
                        created_at: Utc::now(),
                        updated_at: Utc::now(),
                    };
                    
                    eprintln!("Attempting to insert game: {} (ID: {})", game_name, game_id);
                    match games::database::insert_game(pool, &record).await {
                        Ok(_) => {
                            games_found += 1;
                            eprintln!("Successfully inserted game: {} (ID: {})", game_name, game_id);
                        },
                        Err(e) => {
                            eprintln!("ERROR: Failed to insert Steam game {} (ID: {}): {:?}", game_name, game_id, e);
                            eprintln!("Error details: {}", e);
                        },
                    }
                } else {
                    eprintln!("Failed to get details for Steam game ID: {}", app_id);
                }
            }
        },
        Err(e) => eprintln!("Steam scan error: {}", e),
    }
    
    // Scan EA games
    match ea::scan_ea_games().await {
        Ok(ea_game_ids) => {
            eprintln!("Found {} EA games", ea_game_ids.len());
            // TODO: Get EA game details and insert
        },
        Err(e) => eprintln!("EA scan error: {}", e),
    }
    
    // Scan Epic games
    let sgdb_client_epic = crate::steamgriddb::SteamGridDBClient::new();
    match epic::scan_epic_games().await {
        Ok(epic_game_ids) => {
            eprintln!("Found {} Epic games", epic_game_ids.len());
            for catalog_item_id in epic_game_ids {
                // Get game details
                if let Ok(game) = epic::get_epic_game_details(&catalog_item_id).await {
                    let game_id = Uuid::new_v4().to_string();
                    let game_name = game.title.clone();
                    let metadata_json = serde_json::json!({
                        "catalogItemId": game.id,
                        "title": game.title,
                        "installPath": game.install_path,
                    }).to_string();
                    
                    // Search for game on SteamGridDB by name
                    eprintln!("Searching SteamGridDB for Epic game: {}", game_name);
                    let griddb_id = match sgdb_client_epic.search_by_name(&game_name).await {
                        Ok(Some(id)) => {
                            eprintln!("Found Epic game on SteamGridDB with ID: {}", id);
                            Some(id)
                        },
                        Ok(None) => {
                            eprintln!("Epic game '{}' not found on SteamGridDB", game_name);
                            None
                        },
                        Err(e) => {
                            eprintln!("Error searching SteamGridDB for Epic game '{}': {}", game_name, e);
                            None
                        },
                    };
                    
                    // Fetch images from SteamGridDB
                    let images = if let Some(griddb_id) = griddb_id {
                        eprintln!("Fetching images from SteamGridDB for Epic game ID: {}", griddb_id);
                        match sgdb_client_epic.fetch_game_images(griddb_id).await {
                            Ok(imgs) => {
                                eprintln!("Successfully fetched images for Epic game: grid={:?}, logo={:?}, header={:?}", 
                                    imgs.grid_cover_art.is_some(), 
                                    imgs.logo.is_some(), 
                                    imgs.header_art.is_some());
                                imgs
                            },
                            Err(e) => {
                                eprintln!("Failed to fetch images from SteamGridDB for Epic game: {}", e);
                                crate::steamgriddb::GameImages {
                                    grid_cover_art: None,
                                    logo: None,
                                    header_art: None,
                                    icon: None,
                                }
                            },
                        }
                    } else {
                        crate::steamgriddb::GameImages {
                            grid_cover_art: None,
                            logo: None,
                            header_art: None,
                            icon: None,
                        }
                    };
                    
                    let record = games::database::GameRecord {
                        id: game_id.clone(),
                        launcher: "epic".to_string(),
                        launcher_game_id: catalog_item_id.clone(),
                        title: game.title.clone(),
                        install_path: Some(game.install_path.clone()),
                        cover_art: None,
                        griddb_id,
                        grid_cover_art: images.grid_cover_art,
                        logo: images.logo,
                        header_art: images.header_art,
                        icon: images.icon,
                        metadata_json: Some(metadata_json),
                        playtime_minutes: 0,
                        last_played: None,
                        created_at: Utc::now(),
                        updated_at: Utc::now(),
                    };
                    
                    eprintln!("Attempting to insert Epic game: {} (ID: {})", game_name, game_id);
                    match games::database::insert_game(pool, &record).await {
                        Ok(_) => {
                            games_found += 1;
                            eprintln!("Successfully inserted Epic game: {} (ID: {})", game_name, game_id);
                        },
                        Err(e) => {
                            eprintln!("ERROR: Failed to insert Epic game {} (ID: {}): {:?}", game_name, game_id, e);
                            eprintln!("Error details: {}", e);
                        },
                    }
                } else {
                    eprintln!("Failed to get details for Epic game ID: {}", catalog_item_id);
                }
            }
        },
        Err(e) => eprintln!("Epic scan error: {}", e),
    }
    
    // Scan Rockstar games
    match rockstar::scan_rockstar_games().await {
        Ok(rockstar_game_ids) => {
            eprintln!("Found {} Rockstar games", rockstar_game_ids.len());
            // TODO: Get Rockstar game details and insert
        },
        Err(e) => eprintln!("Rockstar scan error: {}", e),
    }
    
    Ok(format!("Scanned and found {} games", games_found))
}

#[tauri::command]
pub async fn scan_steam_games() -> Result<Vec<String>, String> {
    steam::scan_steam_games().await
}

#[tauri::command]
pub async fn scan_ea_games() -> Result<Vec<String>, String> {
    ea::scan_ea_games().await
}

#[tauri::command]
pub async fn scan_epic_games() -> Result<Vec<String>, String> {
    epic::scan_epic_games().await
}

#[tauri::command]
pub async fn scan_rockstar_games() -> Result<Vec<String>, String> {
    rockstar::scan_rockstar_games().await
}

#[tauri::command]
pub async fn get_launcher_status() -> Result<Vec<LauncherStatus>, String> {
    scan_all_launchers().await
}
