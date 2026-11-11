use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Game {
    pub id: String,
    pub title: String,
    pub launcher: String,
    pub path: Option<String>,
    pub installed: bool,
    pub cover_art: Option<String>,
    pub grid_cover_art: Option<String>,
    pub logo: Option<String>,
    pub header_art: Option<String>,
    pub icon: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchArgs<'a> {
    pub game_id: &'a str,
}
