mod models;
mod services;

use dioxus::prelude::*;
use models::Game;

const STYLE: &str = include_str!("../assets/app.css");

#[derive(Clone, Copy, PartialEq)]
enum Section {
    Home,
    Library,
    Details,
}

fn main() {
    dioxus::launch(App);
}

#[component]
fn App() -> Element {
    let mut section = use_signal(|| Section::Home);
    let mut games = use_signal(Vec::<Game>::new);
    let mut loading = use_signal(|| true);
    let mut scanning = use_signal(|| false);
    let mut installed_only = use_signal(|| false);
    let mut search = use_signal(String::new);
    let mut selected_game = use_signal(|| None::<String>);
    let mut return_section = use_signal(|| Section::Library);
    let mut notice = use_signal(|| None::<String>);

    use_effect(move || {
        spawn(async move {
            match services::tauri::games().await {
                Ok(library) => games.set(library),
                Err(error) => notice.set(Some(error)),
            }
            loading.set(false);
        });
    });

    let query = search().trim().to_lowercase();
    let visible_games: Vec<Game> = games()
        .into_iter()
        .filter(|game| !installed_only() || game.installed)
        .filter(|game| query.is_empty() || game.title.to_lowercase().contains(&query))
        .collect();
    let installed_games: Vec<Game> = games().into_iter().filter(|game| game.installed).collect();
    let selected = selected_game().and_then(|id| games().into_iter().find(|game| game.id == id));

    let scan_library = move |_| {
        if scanning() {
            return;
        }
        scanning.set(true);
        notice.set(Some("Scanning supported game launchers...".to_string()));
        spawn(async move {
            match services::tauri::scan_games().await {
                Ok(message) => {
                    notice.set(Some(message));
                    match services::tauri::games().await {
                        Ok(library) => games.set(library),
                        Err(error) => notice.set(Some(error)),
                    }
                }
                Err(error) => notice.set(Some(format!("Game scan failed: {error}"))),
            }
            scanning.set(false);
        });
    };
    let launch = move |game_id: String| {
        spawn(async move {
            match services::tauri::launch_game(&game_id).await {
                Ok(()) => notice.set(Some("Launch request sent to the game service.".to_string())),
                Err(error) => notice.set(Some(format!("Could not launch game: {error}"))),
            }
        });
    };

    // Opens the details view and remembers where to go back to (Home, else Library).
    let open_game = move |game_id: String| {
        if section() != Section::Details {
            return_section.set(if section() == Section::Home { Section::Home } else { Section::Library });
        }
        selected_game.set(Some(game_id));
        section.set(Section::Details);
    };

    rsx! {
        style { {STYLE} }
        div { class: "steam-shell",
            header { class: "client-chrome",
                div { class: "client-menu",
                    div { class: "brand", span { class: "brand-mark", "P" } span { "POLIGAME" } }
                    span { class: "menu-label", "View" }
                    span { class: "menu-label", "Friends" }
                    span { class: "menu-label", "Games" }
                    span { class: "menu-label", "Help" }
                }
                div { class: "client-tools",
                    span { class: "library-state", span { class: "online-dot" } " Local library" }
                    span { class: "window-control", "-" }
                    span { class: "window-control", "[]" }
                    span { class: "window-control close", "x" }
                }
            }
            div { class: "primary-nav",
                div { class: "nav-arrows",
                    div { class: "nav-back", "<" }
                    div { class: "nav-back", ">" }
                }
                if section() == Section::Home {
                    button { class: "primary-tab active", onclick: move |_| section.set(Section::Home), "HOME" }
                } else {
                    button { class: "primary-tab", onclick: move |_| section.set(Section::Home), "HOME" }
                }
                if section() == Section::Library {
                    button { class: "primary-tab active", onclick: move |_| section.set(Section::Library), "LIBRARY" }
                } else {
                    button { class: "primary-tab", onclick: move |_| section.set(Section::Library), "LIBRARY" }
                }
                div { class: "primary-tab muted", "COMMUNITY" }
                div { class: "nav-spacer" }
                div { class: "account-chip",
                    span { class: "account-avatar", "P" }
                    span { "POLIGAME" }
                    span { class: "account-caret", "v" }
                }
            }
            div { class: "library-workspace",
                aside { class: "library-sidebar",
                    if section() == Section::Home {
                        button { class: "home-link active", onclick: move |_| section.set(Section::Home), "Home" }
                    } else {
                        button { class: "home-link", onclick: move |_| section.set(Section::Home), "Home" }
                    }
                    div { class: "search-row",
                        label { class: "library-search",
                            span { class: "search-glyph", "⌕" }
                            input { r#type: "search", value: "{search()}", placeholder: "Search by name", aria_label: "Search library", oninput: move |event| search.set(event.value()) }
                            if !search().is_empty() {
                                button { class: "clear-search", onclick: move |_| search.set(String::new()), "x" }
                            }
                        }
                        if installed_only() {
                            button { class: "tiny-filter active", title: "Showing installed games only", aria_label: "Show installed games only", onclick: move |_| installed_only.set(false), "⚲" }
                        } else {
                            button { class: "tiny-filter", title: "Show installed games only", aria_label: "Show installed games only", onclick: move |_| installed_only.set(true), "⚲" }
                        }
                    }
                    div { class: "collection-row",
                        span { class: "collection-caret", "▾" }
                        span { class: "collection-name", if installed_only() { "INSTALLED" } else { "ALL GAMES" } }
                        span { class: "collection-count", "({visible_games.len()})" }
                    }
                    div { class: "sidebar-game-list",
                        if loading() {
                            div { class: "sidebar-loading", "Loading library..." }
                        } else if visible_games.is_empty() {
                            div { class: "sidebar-empty", "No games found." }
                        } else {
                            for game in visible_games.iter() {
                                SidebarGame {
                                    key: "sidebar-{game.id}",
                                    game: game.clone(),
                                    selected: selected_game().as_ref() == Some(&game.id),
                                    on_select: open_game,
                                }
                            }
                        }
                    }
                    div { class: "sidebar-footer",
                        button { class: "scan-library", disabled: scanning(), onclick: scan_library,
                            span { class: "scan-plus", "+" }
                            if scanning() { "Scanning..." } else { "Scan for games" }
                        }
                    }
                }
                main { class: "content-area",
                    if let Some(message) = notice() {
                        div { class: "status-message", role: "status", "{message}" }
                    }
                    if section() == Section::Home {
                        HomeView {
                            games: games(),
                            installed_games,
                            loading: loading(),
                            on_select: open_game,
                            on_library: move |_| section.set(Section::Library),
                            on_scan: scan_library,
                            scanning: scanning(),
                            on_launch: launch,
                        }
                    } else if let (Section::Details, Some(game)) = (section(), selected.clone()) {
                        GameDetailsView {
                            game,
                            on_back: move |_| section.set(return_section()),
                            on_launch: launch,
                        }
                    } else {
                        LibraryView {
                            games: visible_games,
                            selected,
                            loading: loading(),
                            installed_only: installed_only(),
                            on_toggle_installed: move |value: bool| installed_only.set(value),
                            on_scan: scan_library,
                            scanning: scanning(),
                            on_select: open_game,
                            on_launch: launch,
                        }
                    }
                }
            }
        }
    }
}

#[component]
fn HomeView(
    games: Vec<Game>,
    installed_games: Vec<Game>,
    loading: bool,
    on_select: EventHandler<String>,
    on_library: EventHandler<MouseEvent>,
    on_scan: EventHandler<MouseEvent>,
    scanning: bool,
    on_launch: EventHandler<String>,
) -> Element {
    let hero_game = installed_games.first().or(games.first()).cloned();
    rsx! {
        div { class: "library-home",
            if !loading && !games.is_empty() {
                div { class: "home-top",
                    if let Some(game) = hero_game {
                        HeroBackdrop { game }
                    }
                    div { class: "hero-wash" }
                    section { class: "shelf-section recent-shelf",
                        div { class: "shelf-heading",
                            h2 { "RECENT GAMES" }
                            span { class: "shelf-count", "{installed_games.len()} installed" }
                        }
                        if installed_games.is_empty() {
                            p { class: "shelf-empty", "No installed games were reported by the connected launchers." }
                        } else {
                            div { class: "activity-shelf",
                                for game in installed_games.iter().take(8) {
                                    ActivityCard { key: "installed-{game.id}", game: game.clone(), on_launch }
                                }
                            }
                        }
                    }
                }
            }
            div { class: "home-body",
                if loading {
                    LoadingState {}
                } else if games.is_empty() {
                    EmptyLibrary { on_scan, scanning }
                } else {
                    section { class: "shelf-section",
                        div { class: "shelf-heading",
                            h2 { "ALL GAMES" }
                            div { class: "shelf-actions",
                                span { class: "shelf-count", "{games.len()} games" }
                                button { class: "view-library", onclick: move |event| on_library.call(event), "View all games" }
                            }
                        }
                        div { class: "home-game-grid",
                            for game in games.iter().take(12) {
                                LibraryCard { key: "home-game-{game.id}", game: game.clone(), on_launch, on_select }
                            }
                        }
                    }
                }
            }
        }
    }
}

/// Blurred, darkened landscape art behind the recent-games shelf (Steam's library-home backdrop).
#[component]
fn HeroBackdrop(game: Game) -> Element {
    rsx! { div { class: "hero-bg", LandscapeArt { game } } }
}

/// Landscape artwork (header/hero) for wide cards; falls back to the portrait cover, then initials.
#[component]
fn LandscapeArt(game: Game) -> Element {
    let image = game
        .header_art
        .as_ref()
        .or(game.cover_art.as_ref())
        .or(game.grid_cover_art.as_ref());
    let initials = game.title.chars().take(2).collect::<String>().to_uppercase();
    rsx! {
        if let Some(src) = image {
            img { class: "game-art", src: "{src}", alt: "{game.title} artwork", loading: "lazy" }
        } else {
            div { class: "art-fallback", "{initials}" }
        }
    }
}

#[component]
fn LibraryView(
    games: Vec<Game>,
    selected: Option<Game>,
    loading: bool,
    installed_only: bool,
    on_toggle_installed: EventHandler<bool>,
    on_scan: EventHandler<MouseEvent>,
    scanning: bool,
    on_select: EventHandler<String>,
    on_launch: EventHandler<String>,
) -> Element {
    rsx! {
        div { class: "collection-view",
            div { class: "library-grid-toolbar",
                div { class: "toolbar-heading",
                    h1 { if installed_only { "Installed games" } else { "All games" } }
                    span { class: "toolbar-count", "{games.len()}" }
                }
                div { class: "toolbar-tools",
                    span { class: "sort-label", "Sorted by title" }
                    if installed_only {
                        button { class: "installed-toggle active", onclick: move |_| on_toggle_installed.call(false), span { class: "installed-dot" } "Installed only" }
                    } else {
                        button { class: "installed-toggle", onclick: move |_| on_toggle_installed.call(true), span { class: "installed-dot" } "Installed only" }
                    }
                    button { class: "collection-scan", disabled: scanning, onclick: move |event| on_scan.call(event),
                        if scanning { "Scanning..." } else { "Scan library" }
                    }
                }
            }
            if let Some(game) = selected {
                div { class: "selected-game-bar",
                    GameArtwork { game: game.clone(), compact: true }
                    div { class: "selected-game-copy",
                        strong { "{game.title}" }
                        span { class: "activity-launcher", "{game.launcher}" }
                    }
                    div { class: "selected-game-spacer" }
                    if game.installed {
                        button { class: "selected-play", onclick: { let id = game.id.clone(); move |_| on_launch.call(id.clone()) }, "Play" }
                    } else {
                        span { class: "not-installed", "Not installed" }
                    }
                }
            }
            if loading {
                LoadingState {}
            } else if games.is_empty() {
                EmptyLibrary { on_scan, scanning }
            } else {
                div { class: "library-grid",
                    for game in games {
                        LibraryCard { key: "library-game-{game.id}", game: game.clone(), on_launch, on_select }
                    }
                }
            }
        }
    }
}

#[component]
fn GameDetailsView(game: Game, on_back: EventHandler<MouseEvent>, on_launch: EventHandler<String>) -> Element {
    let path = game.path.clone().unwrap_or_else(|| "Not reported".to_string());
    rsx! {
        div { class: "game-details",
            div { class: "details-hero",
                HeroBackdrop { game: game.clone() }
                div { class: "hero-wash" }
                button { class: "details-back", onclick: move |event| on_back.call(event), "< Back" }
                div { class: "details-hero-copy",
                    span { class: "activity-launcher", "{game.launcher}" }
                    h1 { "{game.title}" }
                    if game.installed {
                        span { class: "details-state", "Installed" }
                    } else {
                        span { class: "details-state", "Not installed" }
                    }
                    div { class: "details-actions",
                        if game.installed {
                            button { class: "selected-play details-play", onclick: { let id = game.id.clone(); move |_| on_launch.call(id.clone()) }, "Play" }
                        } else {
                            span { class: "not-installed", "Not installed" }
                        }
                    }
                }
            }
            div { class: "details-info",
                div { class: "details-row",
                    span { class: "details-label", "Launcher" }
                    span { class: "details-value", "{game.launcher}" }
                }
                div { class: "details-row",
                    span { class: "details-label", "Status" }
                    if game.installed {
                        span { class: "details-value", "Installed" }
                    } else {
                        span { class: "details-value", "Not installed" }
                    }
                }
                div { class: "details-row details-row-wide",
                    span { class: "details-label", "Install path" }
                    span { class: "details-value details-path", "{path}" }
                }
            }
        }
    }
}

#[component]
fn SidebarGame(game: Game, selected: bool, on_select: EventHandler<String>) -> Element {
    // Steam dims uninstalled titles in the sidebar instead of marking installed ones.
    rsx! {
        if selected {
            button { class: "sidebar-game selected", onclick: { let id = game.id.clone(); move |_| on_select.call(id.clone()) },
                GameArtwork { game: game.clone(), compact: true }
                span { class: "sidebar-game-name", "{game.title}" }
            }
        } else if game.installed {
            button { class: "sidebar-game", onclick: { let id = game.id.clone(); move |_| on_select.call(id.clone()) },
                GameArtwork { game: game.clone(), compact: true }
                span { class: "sidebar-game-name", "{game.title}" }
            }
        } else {
            button { class: "sidebar-game dim", title: "Not installed", onclick: { let id = game.id.clone(); move |_| on_select.call(id.clone()) },
                GameArtwork { game: game.clone(), compact: true }
                span { class: "sidebar-game-name", "{game.title}" }
            }
        }
    }
}

#[component]
fn ActivityCard(game: Game, on_launch: EventHandler<String>) -> Element {
    rsx! {
        article { class: "activity-card",
            div { class: "activity-art", LandscapeArt { game: game.clone() } }
            div { class: "activity-overlay",
                div { class: "activity-copy",
                    span { class: "activity-launcher", "{game.launcher}" }
                    strong { "{game.title}" }
                }
                button { class: "activity-play", onclick: { let id = game.id.clone(); move |_| on_launch.call(id.clone()) }, "Play" }
            }
        }
    }
}

#[component]
fn LibraryCard(
    game: Game,
    on_launch: EventHandler<String>,
    on_select: EventHandler<String>,
) -> Element {
    rsx! {
        article { class: "library-card", onclick: { let id = game.id.clone(); move |_| on_select.call(id.clone()) },
            div { class: "library-card-art", GameArtwork { game: game.clone(), compact: false } }
            div { class: "library-card-shade" }
            div { class: "library-card-title",
                strong { "{game.title}" }
                span { class: "activity-launcher", "{game.launcher}" }
            }
            if game.installed {
                button { class: "card-launch", onclick: { let id = game.id.clone(); move |event: MouseEvent| { event.stop_propagation(); on_launch.call(id.clone()) } }, "Play" }
            }
        }
    }
}

#[component]
fn GameArtwork(game: Game, compact: bool) -> Element {
    let image = game
        .grid_cover_art
        .as_ref()
        .or(game.cover_art.as_ref())
        .or(game.header_art.as_ref())
        .or(game.icon.as_ref());
    let initials = game.title.chars().take(2).collect::<String>().to_uppercase();
    rsx! {
        if let Some(src) = image {
            if compact {
                img { class: "game-art compact", src: "{src}", alt: "{game.title} artwork", loading: "lazy" }
            } else {
                img { class: "game-art", src: "{src}", alt: "{game.title} artwork", loading: "lazy" }
            }
        } else if compact {
            div { class: "art-fallback compact", "{initials}" }
        } else {
            div { class: "art-fallback", "{initials}" }
        }
    }
}

#[component]
fn LoadingState() -> Element {
    rsx! { div { class: "empty-state", div { class: "spinner" } h2 { "Loading your library" } p { "Reading the local PoliGame database..." } } }
}

#[component]
fn EmptyLibrary(on_scan: EventHandler<MouseEvent>, scanning: bool) -> Element {
    rsx! { div { class: "empty-state empty-library", div { class: "empty-icon", "+" } h2 { "No games in your library yet" } p { "Use Scan for games to import games found in your supported local launchers." } button { class: "empty-scan", disabled: scanning, onclick: move |event| on_scan.call(event), if scanning { "Scanning..." } else { "Scan for games" } } } }
}
