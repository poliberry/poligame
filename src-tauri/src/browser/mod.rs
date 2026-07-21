use chrono::Utc;
use std::result::Result;

fn get_db_pool() -> Result<&'static sqlx::sqlite::SqlitePool, String> {
    // Reuse the games database pool
    crate::games::get_db_pool()
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BrowserHistory {
    pub id: String,
    pub url: String,
    pub title: String,
    pub visited_at: chrono::DateTime<Utc>,
    pub visit_count: i64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Bookmark {
    pub id: String,
    pub url: String,
    pub title: String,
    pub created_at: chrono::DateTime<Utc>,
}

#[tauri::command]
pub async fn navigate_url(url: String) -> Result<(), String> {
    // Add to history
    add_to_history(&url, &url).await?;
    Ok(())
}

async fn add_to_history(url: &str, title: &str) -> Result<(), String> {
    let pool = get_db_pool()?;
    
    // Check if URL exists in history
    let existing: Option<(String, i64)> = sqlx::query_as(
        "SELECT id, visit_count FROM browser_history WHERE url = ? ORDER BY visited_at DESC LIMIT 1"
    )
    .bind(url)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    
    if let Some((id, count)) = existing {
        // Update existing entry
        sqlx::query("UPDATE browser_history SET visited_at = ?, visit_count = ?, title = ? WHERE id = ?")
            .bind(Utc::now())
            .bind(count + 1)
            .bind(title)
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to update history: {}", e))?;
    } else {
        // Insert new entry
        let id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            "INSERT INTO browser_history (id, url, title, visited_at, visit_count) VALUES (?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(url)
        .bind(title)
        .bind(Utc::now())
        .bind(1i64)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to insert history: {}", e))?;
    }
    
    Ok(())
}

#[tauri::command]
pub async fn get_history() -> Result<Vec<String>, String> {
    let pool = get_db_pool()?;
    let rows: Vec<(String,)> = sqlx::query_as(
        "SELECT DISTINCT url FROM browser_history ORDER BY visited_at DESC LIMIT 50"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get history: {}", e))?;
    
    Ok(rows.into_iter().map(|(url,)| url).collect())
}

#[tauri::command]
pub async fn add_bookmark(url: String, title: String) -> Result<(), String> {
    let pool = get_db_pool()?;
    let id = uuid::Uuid::new_v4().to_string();
    
    sqlx::query(
        "INSERT OR REPLACE INTO bookmarks (id, url, title, created_at) VALUES (?, ?, ?, ?)"
    )
    .bind(&id)
    .bind(&url)
    .bind(&title)
    .bind(Utc::now())
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to add bookmark: {}", e))?;
    
    Ok(())
}

#[tauri::command]
pub async fn get_bookmarks() -> Result<Vec<serde_json::Value>, String> {
    let pool = get_db_pool()?;
    let rows: Vec<(String, String, String)> = sqlx::query_as(
        "SELECT id, url, title FROM bookmarks ORDER BY created_at DESC"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to get bookmarks: {}", e))?;
    
    let bookmarks: Vec<serde_json::Value> = rows
        .into_iter()
        .map(|(id, url, title)| {
            serde_json::json!({
                "id": id,
                "url": url,
                "title": title
            })
        })
        .collect();
    
    Ok(bookmarks)
}

pub async fn init_browser_tables(pool: &sqlx::sqlite::SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS browser_history (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            visited_at DATETIME NOT NULL,
            visit_count INTEGER DEFAULT 1
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS bookmarks (
            id TEXT PRIMARY KEY,
            url TEXT NOT NULL,
            title TEXT NOT NULL,
            created_at DATETIME NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}
