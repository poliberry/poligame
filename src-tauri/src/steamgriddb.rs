use serde::{Deserialize, Serialize};

const API_BASE_URL: &str = "https://www.steamgriddb.com/api/v2";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamGridDBGame {
    pub id: u32,
    pub name: String,
    pub verified: bool,
    #[serde(rename = "types")]
    pub game_types: Vec<String>,
    #[serde(rename = "release_date")]
    pub release_date: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SteamGridDBSearchResult {
    pub id: u32,
    pub name: String,
    pub verified: bool,
    pub game_types: Vec<String>,
    pub release_date: Option<u64>,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameSearchResponse {
    pub success: bool,
    pub data: Vec<SteamGridDBGame>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Author {
    pub name: String,
    #[serde(rename = "steam64")]
    pub steam64: String,
    pub avatar: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridImage {
    pub id: u32,
    pub score: i32,
    pub style: String,
    pub width: u32,
    pub height: u32,
    pub nsfw: bool,
    pub humor: bool,
    pub notes: Option<String>,
    pub mime: String,
    pub language: Option<String>,
    pub url: String,
    pub thumb: String,
    pub lock: bool,
    pub epilepsy: bool,
    pub upvotes: u32,
    pub downvotes: u32,
    pub author: Author,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogoImage {
    pub id: u32,
    pub score: i32,
    pub style: String,
    pub width: u32,
    pub height: u32,
    pub nsfw: bool,
    pub humor: bool,
    pub notes: Option<String>,
    pub mime: String,
    pub language: Option<String>,
    pub url: String,
    pub thumb: String,
    pub lock: bool,
    pub epilepsy: bool,
    pub upvotes: u32,
    pub downvotes: u32,
    pub author: Author,
    #[serde(default)]
    pub transparency: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeroImage {
    pub id: u32,
    pub score: i32,
    pub style: String,
    pub width: u32,
    pub height: u32,
    pub nsfw: bool,
    pub humor: bool,
    pub notes: Option<String>,
    pub mime: String,
    pub language: Option<String>,
    pub url: String,
    pub thumb: String,
    pub lock: bool,
    pub epilepsy: bool,
    pub upvotes: u32,
    pub downvotes: u32,
    pub author: Author,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GridsResponse {
    pub success: bool,
    pub page: u32,
    pub total: u32,
    pub limit: u32,
    pub data: Vec<GridImage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogosResponse {
    pub success: bool,
    pub page: u32,
    pub total: u32,
    pub limit: u32,
    pub data: Vec<LogoImage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeroesResponse {
    pub success: bool,
    pub page: u32,
    pub total: u32,
    pub limit: u32,
    pub data: Vec<HeroImage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IconImage {
    pub id: u32,
    pub score: i32,
    pub style: String,
    pub width: u32,
    pub height: u32,
    pub nsfw: bool,
    pub humor: bool,
    pub notes: Option<String>,
    pub mime: String,
    pub language: Option<String>,
    pub url: String,
    pub thumb: String,
    pub lock: bool,
    pub epilepsy: bool,
    pub upvotes: u32,
    pub downvotes: u32,
    pub author: Author,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IconsResponse {
    pub success: bool,
    pub page: u32,
    pub total: u32,
    pub limit: u32,
    pub data: Vec<IconImage>,
}

pub struct SteamGridDBClient {
    client: reqwest::Client,
    api_key: Option<String>,
}

impl SteamGridDBClient {
    pub fn new() -> Self {
        // Hardcoded SteamGridDB API key
        // This is a public API key that can be used without authentication
        const STEAMGRIDDB_API_KEY: &str = "94bd520c0de701502c4687bcc4d07952";
        
        Self {
            client: reqwest::Client::new(),
            api_key: Some(STEAMGRIDDB_API_KEY.to_string()),
        }
    }

    pub fn with_api_key(api_key: String) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: Some(api_key),
        }
    }

    fn build_request(&self, url: &str) -> reqwest::RequestBuilder {
        let mut request = self.client.get(url);
        request = request.header("Accept", "application/json");
        if let Some(key) = &self.api_key {
            request = request.header("Authorization", format!("Bearer {}", key));
        }
        request
    }

    /// Search for a game by name using autocomplete endpoint
    pub async fn search_games(&self, game_name: &str) -> Result<Vec<SteamGridDBGame>, String> {
        let url = format!("{}/search/autocomplete/{}", API_BASE_URL, urlencoding::encode(game_name));
        
        let response = self.build_request(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to search game: {}", e))?;

        if response.status() == 404 {
            return Ok(vec![]);
        }

        if !response.status().is_success() {
            return Err(format!("API returned error status: {}", response.status()));
        }

        let search_response: GameSearchResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse search response: {}", e))?;

        if !search_response.success || search_response.data.is_empty() {
            return Ok(vec![]);
        }

        Ok(search_response.data)
    }

    pub async fn search_by_name(&self, game_name: &str) -> Result<Option<u32>, String> {
        let results = self.search_games(game_name).await?;
        Ok(results.first().map(|result| result.id))
    }

    /// Get grid image for a game (returns first result URL)
    pub async fn get_grids(&self, game_id: u32) -> Result<Option<String>, String> {
        let url = format!("{}/grids/game/{}", API_BASE_URL, game_id);
        
        let response = self.build_request(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to get grids: {}", e))?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(format!("API returned error status: {}", response.status()));
        }

        let grids: GridsResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse grids response: {}", e))?;

        if !grids.success || grids.data.is_empty() {
            return Ok(None);
        }

        // Return the first result's URL
        Ok(Some(grids.data[0].url.clone()))
    }

    /// Get logo image for a game (returns first result URL)
    pub async fn get_logos(&self, game_id: u32) -> Result<Option<String>, String> {
        let url = format!("{}/logos/game/{}", API_BASE_URL, game_id);
        
        let response = self.build_request(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to get logos: {}", e))?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(format!("API returned error status: {}", response.status()));
        }

        let logos: LogosResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse logos response: {}", e))?;

        if !logos.success || logos.data.is_empty() {
            return Ok(None);
        }

        // Return the first result's URL
        Ok(Some(logos.data[0].url.clone()))
    }

    /// Get hero/header image for a game (returns first result URL)
    pub async fn get_heroes(&self, game_id: u32) -> Result<Option<String>, String> {
        let url = format!("{}/heroes/game/{}", API_BASE_URL, game_id);
        
        let response = self.build_request(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to get heroes: {}", e))?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(format!("API returned error status: {}", response.status()));
        }

        let heroes: HeroesResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse heroes response: {}", e))?;

        if !heroes.success || heroes.data.is_empty() {
            return Ok(None);
        }

        // Return the first result's URL
        Ok(Some(heroes.data[0].url.clone()))
    }

    /// Get icon images for a game (returns first official icon URL)
    pub async fn get_icons(&self, game_id: u32) -> Result<Option<String>, String> {
        let url = format!("{}/icons/game/{}?style=official", API_BASE_URL, game_id);
        
        let response = self.build_request(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to get icons: {}", e))?;

        if response.status() == 404 {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(format!("API returned error status: {}", response.status()));
        }

        let icons: IconsResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse icons response: {}", e))?;

        if !icons.success || icons.data.is_empty() {
            return Ok(None);
        }

        // Return the first result's URL
        Ok(Some(icons.data[0].url.clone()))
    }

    /// Fetch all images for a game using SteamGridDB game ID
    /// Makes separate sequential requests for each image type
    pub async fn fetch_game_images(&self, griddb_id: u32) -> Result<GameImages, String> {
        // Fetch each image type separately (sequential requests)
        let grid_cover_art = self.get_grids(griddb_id).await?;
        let logo = self.get_logos(griddb_id).await?;
        let header_art = self.get_heroes(griddb_id).await?;
        let icon = self.get_icons(griddb_id).await?;

        Ok(GameImages {
            grid_cover_art,
            logo,
            header_art,
            icon,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameImages {
    pub grid_cover_art: Option<String>,
    pub logo: Option<String>,
    pub header_art: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtworkOption {
    pub id: u32,
    pub url: String,
    pub thumb: String,
    pub width: u32,
    pub height: u32,
    pub score: i32,
    pub style: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameArtworkOptions {
    pub grid_cover_art: Vec<ArtworkOption>,
    pub logos: Vec<ArtworkOption>,
    pub header_art: Vec<ArtworkOption>,
}

fn map_grid_options(images: Vec<GridImage>) -> Vec<ArtworkOption> {
    images
        .into_iter()
        .map(|image| ArtworkOption {
            id: image.id,
            url: image.url,
            thumb: image.thumb,
            width: image.width,
            height: image.height,
            score: image.score,
            style: image.style,
        })
        .collect()
}

fn map_logo_options(images: Vec<LogoImage>) -> Vec<ArtworkOption> {
    images
        .into_iter()
        .map(|image| ArtworkOption {
            id: image.id,
            url: image.url,
            thumb: image.thumb,
            width: image.width,
            height: image.height,
            score: image.score,
            style: image.style,
        })
        .collect()
}

fn map_hero_options(images: Vec<HeroImage>) -> Vec<ArtworkOption> {
    images
        .into_iter()
        .map(|image| ArtworkOption {
            id: image.id,
            url: image.url,
            thumb: image.thumb,
            width: image.width,
            height: image.height,
            score: image.score,
            style: image.style,
        })
        .collect()
}

fn map_icon_options(images: Vec<IconImage>) -> Vec<ArtworkOption> {
    images
        .into_iter()
        .map(|image| ArtworkOption {
            id: image.id,
            url: image.url,
            thumb: image.thumb,
            width: image.width,
            height: image.height,
            score: image.score,
            style: image.style,
        })
        .collect()
}

impl SteamGridDBClient {
    pub async fn get_grid_options(&self, game_id: u32) -> Result<Vec<ArtworkOption>, String> {
        let url = format!("{}/grids/game/{}", API_BASE_URL, game_id);

        let response = self
            .build_request(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to get grid options: {}", e))?;

        if response.status() == 404 {
            return Ok(vec![]);
        }

        if !response.status().is_success() {
            return Err(format!("API returned error status: {}", response.status()));
        }

        let grids: GridsResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse grid options response: {}", e))?;

        if !grids.success {
            return Ok(vec![]);
        }

        Ok(map_grid_options(grids.data))
    }

    pub async fn get_logo_options(&self, game_id: u32) -> Result<Vec<ArtworkOption>, String> {
        let url = format!("{}/logos/game/{}", API_BASE_URL, game_id);

        let response = self
            .build_request(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to get logo options: {}", e))?;

        if response.status() == 404 {
            return Ok(vec![]);
        }

        if !response.status().is_success() {
            return Err(format!("API returned error status: {}", response.status()));
        }

        let logos: LogosResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse logo options response: {}", e))?;

        if !logos.success {
            return Ok(vec![]);
        }

        Ok(map_logo_options(logos.data))
    }

    pub async fn get_header_options(&self, game_id: u32) -> Result<Vec<ArtworkOption>, String> {
        let url = format!("{}/heroes/game/{}", API_BASE_URL, game_id);

        let response = self
            .build_request(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to get header options: {}", e))?;

        if response.status() == 404 {
            return Ok(vec![]);
        }

        if !response.status().is_success() {
            return Err(format!("API returned error status: {}", response.status()));
        }

        let heroes: HeroesResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse header options response: {}", e))?;

        if !heroes.success {
            return Ok(vec![]);
        }

        Ok(map_hero_options(heroes.data))
    }

    pub async fn get_icon_options(&self, game_id: u32) -> Result<Vec<ArtworkOption>, String> {
        let url = format!("{}/icons/game/{}?style=official", API_BASE_URL, game_id);

        let response = self
            .build_request(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to get icon options: {}", e))?;

        if response.status() == 404 {
            return Ok(vec![]);
        }

        if !response.status().is_success() {
            return Err(format!("API returned error status: {}", response.status()));
        }

        let icons: IconsResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse icon options response: {}", e))?;

        if !icons.success {
            return Ok(vec![]);
        }

        Ok(map_icon_options(icons.data))
    }

    pub async fn fetch_game_artwork_options(
        &self,
        griddb_id: u32,
    ) -> Result<GameArtworkOptions, String> {
        let grid_cover_art = self.get_grid_options(griddb_id).await?;
        // Keep the JSON field as `logos` for compatibility with existing frontend types,
        // but source options from the SteamGridDB icons endpoint.
        let logos = self.get_icon_options(griddb_id).await?;
        let header_art = self.get_header_options(griddb_id).await?;

        Ok(GameArtworkOptions {
            grid_cover_art,
            logos,
            header_art,
        })
    }
}

