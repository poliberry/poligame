use anyhow::Result;
use serde::{Deserialize, Serialize};
use sqlx::Row;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub id: String,
    pub title: String,
    pub launcher: Option<String>,
    pub cover_art: Option<String>,
    pub grid_cover: Option<String>,
    pub header_image: Option<String>,
    pub playtime_seconds: i64,
    pub last_played: Option<String>,
    pub description: Option<String>,
    pub executable: Option<String>,
    pub steam_app_id: Option<String>,
}

pub struct GameDb;

impl GameDb {
    pub async fn load(db_path: &str) -> Result<Vec<Game>> {
        use sqlx::sqlite::SqlitePool;

        let pool = SqlitePool::connect(&format!("sqlite://{}?mode=ro", db_path)).await?;

        let rows = sqlx::query(
            "SELECT id, title, launcher, cover_art, grid_cover_art, header_art,
                    COALESCE(playtime_minutes, 0) * 60 AS playtime_seconds,
                    last_played, description, executable_path, steam_app_id
             FROM games
             ORDER BY COALESCE(playtime_minutes, 0) DESC, title ASC",
        )
        .fetch_all(&pool)
        .await?;

        pool.close().await;

        let games = rows
            .into_iter()
            .map(|r| Game {
                id:               r.try_get("id").unwrap_or_default(),
                title:            r.try_get("title").unwrap_or_default(),
                launcher:         r.try_get("launcher").ok(),
                cover_art:        r.try_get("cover_art").ok(),
                grid_cover:       r.try_get("grid_cover_art").ok(),
                header_image:     r.try_get("header_art").ok(),
                playtime_seconds: r.try_get("playtime_seconds").unwrap_or(0),
                last_played:      r.try_get("last_played").ok(),
                description:      r.try_get("description").ok(),
                executable:       r.try_get("executable_path").ok(),
                steam_app_id:     r.try_get("steam_app_id").ok(),
            })
            .collect();

        Ok(games)
    }
}
