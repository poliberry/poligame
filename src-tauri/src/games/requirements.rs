use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemRequirements {
    pub minimum: Option<GameRequirements>,
    pub recommended: Option<GameRequirements>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameRequirements {
    #[serde(default)]
    pub os: Option<String>,
    #[serde(default)]
    pub processor: Option<String>,
    #[serde(default)]
    pub memory: Option<String>,
    #[serde(default)]
    pub graphics: Option<String>,
    #[serde(default)]
    pub storage: Option<String>,
    #[serde(default)]
    pub additional_notes: Option<String>,
}

// Steam API returns requirements as strings, not structured objects
#[derive(Debug, Clone, Deserialize)]
struct SteamPcRequirements {
    #[serde(default)]
    minimum: Option<String>,
    #[serde(default)]
    recommended: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
struct SteamStoreData {
    #[serde(rename = "pc_requirements")]
    #[serde(default)]
    pc_requirements: Option<SteamPcRequirements>,
}

#[derive(Debug, Clone, Deserialize)]
struct SteamStoreResponse {
    success: bool,
    #[serde(default)]
    data: Option<SteamStoreData>,
}

// Parse requirement text into structured format (handles HTML formatting)
fn parse_requirement_text(text: &str) -> GameRequirements {
    let mut req = GameRequirements {
        os: None,
        processor: None,
        memory: None,
        graphics: None,
        storage: None,
        additional_notes: None,
    };

    // Remove HTML tags but preserve structure
    let text = text
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n")
        .replace("</li>", "\n")
        .replace("<li>", "")
        .replace("</ul>", "\n")
        .replace("<ul>", "")
        .replace("</p>", "\n")
        .replace("<p>", "");

    // Remove all remaining HTML tags using regex-like simple replacement
    let mut text_clean = String::new();
    let mut in_tag = false;
    for ch in text.chars() {
        if ch == '<' {
            in_tag = true;
        } else if ch == '>' {
            in_tag = false;
        } else if !in_tag {
            text_clean.push(ch);
        }
    }

    // Replace &nbsp; and other HTML entities
    let text_clean = text_clean
        .replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'");

    let lines: Vec<&str> = text_clean.lines().collect();
    let mut current_field: Option<String> = None;

    for line in lines {
        let line = line.trim();
        if line.is_empty() {
            current_field = None;
            continue;
        }

        // Check for field labels (handle both **OS:** and OS: formats)
        let line_clean = line.replace("*", "").trim().to_string();
        let line_lower = line_clean.to_lowercase();
        
        if line_lower.starts_with("os:") || line_lower.starts_with("operating system:") {
            let value = line_clean.splitn(2, ':').nth(1).unwrap_or("").trim().to_string();
            if !value.is_empty() {
                req.os = Some(value);
                current_field = Some("os".to_string());
            }
        } else if line_lower.starts_with("processor:") || line_lower.starts_with("cpu:") {
            let value = line_clean.splitn(2, ':').nth(1).unwrap_or("").trim().to_string();
            if !value.is_empty() {
                req.processor = Some(value);
                current_field = Some("processor".to_string());
            }
        } else if line_lower.starts_with("memory:") || line_lower.starts_with("ram:") {
            let value = line_clean.splitn(2, ':').nth(1).unwrap_or("").trim().to_string();
            if !value.is_empty() {
                req.memory = Some(value);
                current_field = Some("memory".to_string());
            }
        } else if line_lower.starts_with("graphics:") || line_lower.starts_with("video card:") || line_lower.starts_with("gpu:") {
            let value = line_clean.splitn(2, ':').nth(1).unwrap_or("").trim().to_string();
            if !value.is_empty() {
                req.graphics = Some(value);
                current_field = Some("graphics".to_string());
            }
        } else if line_lower.starts_with("storage:") || line_lower.starts_with("hard drive:") || line_lower.starts_with("space:") {
            let value = line_clean.splitn(2, ':').nth(1).unwrap_or("").trim().to_string();
            if !value.is_empty() {
                req.storage = Some(value);
                current_field = Some("storage".to_string());
            }
        } else if line_lower.starts_with("directx:") {
            // Append DirectX to graphics or storage field
            let value = line_clean.splitn(2, ':').nth(1).unwrap_or("").trim().to_string();
            if !value.is_empty() {
                if let Some(gfx) = &mut req.graphics {
                    gfx.push_str(" | DirectX: ");
                    gfx.push_str(&value);
                } else {
                    req.graphics = Some(format!("DirectX: {}", value));
                }
            }
        } else if line_lower.starts_with("network:") {
            // Store network requirement in additional notes
            let value = line_clean.splitn(2, ':').nth(1).unwrap_or("").trim().to_string();
            if !value.is_empty() {
                if let Some(notes) = &mut req.additional_notes {
                    notes.push_str(" | Network: ");
                    notes.push_str(&value);
                } else {
                    req.additional_notes = Some(format!("Network: {}", value));
                }
            }
        } else if line_lower.starts_with("additional notes:") || line_lower.starts_with("note:") {
            let value = line_clean.splitn(2, ':').nth(1).unwrap_or("").trim().to_string();
            if !value.is_empty() {
                if req.additional_notes.is_none() {
                    req.additional_notes = Some(value);
                } else if let Some(notes) = &mut req.additional_notes {
                    notes.push_str(" ");
                    notes.push_str(&value);
                }
                current_field = Some("notes".to_string());
            }
        } else if let Some(field) = &current_field {
            // Continue appending to the current field
            match field.as_str() {
                "os" => if let Some(os) = &mut req.os { os.push_str(" "); os.push_str(line.trim()); },
                "processor" => if let Some(proc) = &mut req.processor { proc.push_str(" "); proc.push_str(line.trim()); },
                "memory" => if let Some(mem) = &mut req.memory { mem.push_str(" "); mem.push_str(line.trim()); },
                "graphics" => if let Some(gfx) = &mut req.graphics { gfx.push_str(" "); gfx.push_str(line.trim()); },
                "storage" => if let Some(storage) = &mut req.storage { storage.push_str(" "); storage.push_str(line.trim()); },
                "notes" => if let Some(notes) = &mut req.additional_notes { notes.push_str(" "); notes.push_str(line.trim()); },
                _ => {}
            }
        } else {
            // If no field matched, treat as additional notes or general requirement
            // Skip lines that are just "Minimum:" or "Recommended:" labels
            if !line_lower.contains("minimum") && !line_lower.contains("recommended") && !line_lower.contains("requires a") {
                if req.additional_notes.is_none() {
                    req.additional_notes = Some(line.trim().to_string());
                } else if let Some(notes) = &mut req.additional_notes {
                    notes.push_str(" ");
                    notes.push_str(line.trim());
                }
            }
        }
    }

    req
}

pub async fn get_steam_requirements(app_id: &str) -> Result<SystemRequirements, String> {
    let url = format!(
        "https://store.steampowered.com/api/appdetails?appids={}&cc=us&l=en",
        app_id
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch Steam store data: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Steam API returned error: {}", response.status()));
    }

    // Parse as generic JSON first to get the app ID key
    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Get the app data using the app_id as key
    let app_data = json
        .get(app_id)
        .ok_or_else(|| format!("App ID {} not found in response", app_id))?;

    let store_response: SteamStoreResponse = serde_json::from_value(app_data.clone())
        .map_err(|e| format!("Failed to parse store response: {}", e))?;

    if !store_response.success {
        return Err("Steam API returned success=false".to_string());
    }

    let pc_reqs = store_response
        .data
        .and_then(|d| d.pc_requirements)
        .ok_or_else(|| "No PC requirements found".to_string())?;

    // Parse the text requirements into structured format
    let minimum = pc_reqs.minimum.map(|text| parse_requirement_text(&text));
    let recommended = pc_reqs.recommended.map(|text| parse_requirement_text(&text));

    Ok(SystemRequirements {
        minimum,
        recommended,
    })
}

