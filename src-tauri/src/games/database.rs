use sqlx::{sqlite::SqlitePool, Row};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameRecord {
    pub id: String,
    pub launcher: String,
    pub launcher_game_id: String,
    pub title: String,
    pub install_path: Option<String>,
    pub cover_art: Option<String>,
    pub griddb_id: Option<u32>,
    pub grid_cover_art: Option<String>,
    pub logo: Option<String>,
    pub header_art: Option<String>,
    pub icon: Option<String>,
    pub metadata_json: Option<String>,
    pub playtime_minutes: i64,
    pub last_played: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AchievementRecord {
    pub id: String,
    pub game_id: String,
    pub achievement_id: String,
    pub name: String,
    pub description: Option<String>,
    pub unlocked: bool,
    pub unlocked_date: Option<DateTime<Utc>>,
    pub progress: Option<i64>,
    pub max_progress: Option<i64>,
    pub icon: Option<String>,
}

pub async fn init_database(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            launcher TEXT NOT NULL,
            launcher_game_id TEXT NOT NULL,
            title TEXT NOT NULL,
            install_path TEXT,
            cover_art TEXT,
            griddb_id INTEGER,
            grid_cover_art TEXT,
            logo TEXT,
            header_art TEXT,
            icon TEXT,
            metadata_json TEXT,
            playtime_minutes INTEGER DEFAULT 0,
            last_played DATETIME,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            UNIQUE(launcher, launcher_game_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Add new columns if they don't exist (migration)
    let _ = sqlx::query("ALTER TABLE games ADD COLUMN griddb_id INTEGER")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE games ADD COLUMN grid_cover_art TEXT")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE games ADD COLUMN logo TEXT")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE games ADD COLUMN header_art TEXT")
        .execute(pool)
        .await;
    let _ = sqlx::query("ALTER TABLE games ADD COLUMN icon TEXT")
        .execute(pool)
        .await;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS achievements (
            id TEXT PRIMARY KEY,
            game_id TEXT NOT NULL,
            achievement_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            unlocked BOOLEAN DEFAULT 0,
            unlocked_date DATETIME,
            progress INTEGER,
            max_progress INTEGER,
            FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
            UNIQUE(game_id, achievement_id)
        )
        "#,
    )
    .execute(pool)
    .await?;
    
    // Add icon column if it doesn't exist (migration)
    let _ = sqlx::query("ALTER TABLE achievements ADD COLUMN icon TEXT")
        .execute(pool)
        .await;

    Ok(())
}

pub async fn insert_game(pool: &SqlitePool, game: &GameRecord) -> Result<(), sqlx::Error> {
    eprintln!("Executing INSERT for game: {} ({})", game.title, game.id);
    
    let result = sqlx::query(
        r#"
        INSERT OR REPLACE INTO games 
        (id, launcher, launcher_game_id, title, install_path, cover_art, griddb_id, grid_cover_art, logo, header_art, icon, metadata_json, 
         playtime_minutes, last_played, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&game.id)
    .bind(&game.launcher)
    .bind(&game.launcher_game_id)
    .bind(&game.title)
    .bind(&game.install_path)
    .bind(&game.cover_art)
    .bind(game.griddb_id)
    .bind(&game.grid_cover_art)
    .bind(&game.logo)
    .bind(&game.header_art)
    .bind(&game.icon)
    .bind(&game.metadata_json)
    .bind(game.playtime_minutes)
    .bind(game.last_played)
    .bind(game.created_at)
    .bind(game.updated_at)
    .execute(pool)
    .await;
    
    match result {
        Ok(rows) => {
            eprintln!("INSERT successful: {} rows affected for game {}", rows.rows_affected(), game.id);
            Ok(())
        },
        Err(e) => {
            eprintln!("INSERT failed for game {}: {:?}", game.id, e);
            Err(e)
        },
    }
}

pub async fn get_all_games(pool: &SqlitePool) -> Result<Vec<GameRecord>, sqlx::Error> {
    let rows = sqlx::query(
        r#"
        SELECT id, launcher, launcher_game_id, title, install_path, cover_art, griddb_id, grid_cover_art, logo, header_art, icon,
               metadata_json, playtime_minutes, last_played, created_at, updated_at
        FROM games
        ORDER BY title
        "#,
    )
    .fetch_all(pool)
    .await?;

    let games = rows
        .iter()
        .map(|row| GameRecord {
            id: row.get("id"),
            launcher: row.get("launcher"),
            launcher_game_id: row.get("launcher_game_id"),
            title: row.get("title"),
            install_path: row.get("install_path"),
            cover_art: row.get("cover_art"),
            griddb_id: row.get("griddb_id"),
            grid_cover_art: row.get("grid_cover_art"),
            logo: row.get("logo"),
            header_art: row.get("header_art"),
            icon: row.get("icon"),
            metadata_json: row.get("metadata_json"),
            playtime_minutes: row.get("playtime_minutes"),
            last_played: row.get("last_played"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect();

    Ok(games)
}

pub async fn get_game_by_id(pool: &SqlitePool, game_id: &str) -> Result<Option<GameRecord>, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT id, launcher, launcher_game_id, title, install_path, cover_art, griddb_id, grid_cover_art, logo, header_art, icon,
               metadata_json, playtime_minutes, last_played, created_at, updated_at
        FROM games
        WHERE id = ?
        "#,
    )
    .bind(game_id)
    .fetch_optional(pool)
    .await?;

    if let Some(row) = row {
        Ok(Some(GameRecord {
            id: row.get("id"),
            launcher: row.get("launcher"),
            launcher_game_id: row.get("launcher_game_id"),
            title: row.get("title"),
            install_path: row.get("install_path"),
            cover_art: row.get("cover_art"),
            griddb_id: row.get("griddb_id"),
            grid_cover_art: row.get("grid_cover_art"),
            logo: row.get("logo"),
            header_art: row.get("header_art"),
            icon: row.get("icon"),
            metadata_json: row.get("metadata_json"),
            playtime_minutes: row.get("playtime_minutes"),
            last_played: row.get("last_played"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }))
    } else {
        Ok(None)
    }
}

pub async fn insert_achievement(pool: &SqlitePool, achievement: &AchievementRecord) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        INSERT OR REPLACE INTO achievements 
        (id, game_id, achievement_id, name, description, unlocked, unlocked_date, progress, max_progress, icon)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#,
    )
    .bind(&achievement.id)
    .bind(&achievement.game_id)
    .bind(&achievement.achievement_id)
    .bind(&achievement.name)
    .bind(&achievement.description)
    .bind(achievement.unlocked)
    .bind(achievement.unlocked_date)
    .bind(achievement.progress)
    .bind(achievement.max_progress)
    .bind(&achievement.icon)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn delete_game_achievements(pool: &SqlitePool, game_id: &str) -> Result<(), sqlx::Error> {
    sqlx::query("DELETE FROM achievements WHERE game_id = ?")
        .bind(game_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn get_game_achievements(pool: &SqlitePool, game_id: &str) -> Result<Vec<AchievementRecord>, sqlx::Error> {
    // Try to select with icon column, fall back to without if column doesn't exist
    let rows = sqlx::query(
        r#"
        SELECT id, game_id, achievement_id, name, description, unlocked, unlocked_date, progress, max_progress, icon
        FROM achievements
        WHERE game_id = ?
        ORDER BY name
        "#,
    )
    .bind(game_id)
    .fetch_all(pool)
    .await?;

    let achievements = rows
        .iter()
        .map(|row| AchievementRecord {
            id: row.get("id"),
            game_id: row.get("game_id"),
            achievement_id: row.get("achievement_id"),
            name: row.get("name"),
            description: row.get("description"),
            unlocked: row.get("unlocked"),
            unlocked_date: row.get("unlocked_date"),
            progress: row.get("progress"),
            max_progress: row.get("max_progress"),
            icon: row.try_get("icon").ok(), // Try to get icon, default to None if column doesn't exist
        })
        .collect();

    Ok(achievements)
}

