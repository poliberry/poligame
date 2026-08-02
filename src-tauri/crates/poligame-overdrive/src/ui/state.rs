use crate::Game;

#[derive(Clone, Debug, Default, PartialEq)]
pub enum View {
    #[default]
    Library,
}

pub struct AppState {
    pub games: Vec<Game>,
    pub selected_index: usize,
    pub view: View,
    pub keyboard_open: bool,
    pub keyboard_target: Option<String>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            games: Vec::new(),
            selected_index: 0,
            view: View::Library,
            keyboard_open: false,
            keyboard_target: None,
        }
    }
}
