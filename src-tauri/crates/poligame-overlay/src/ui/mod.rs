use crate::ipc::Command;
use std::sync::{Arc, Mutex};
use crossterm::{
    event::{self, Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Alignment, Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, Paragraph, Tabs},
    Terminal,
};
use std::io;

// ─── Tab enum ─────────────────────────────────────────────────────────────────

#[derive(Clone, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Copy)]
pub enum Tab {
    #[default]
    GameOptions = 0,
    Overdrive = 1,
    Settings = 2,
}

// ─── Gamepad events ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy)]
enum GamepadEvent {
    Up,
    Down,
    Toggle,
}

fn spawn_gamepad_thread() -> std::sync::mpsc::Receiver<GamepadEvent> {
    let (tx, rx) = std::sync::mpsc::channel();

    std::thread::spawn(move || {
        let Ok(mut gilrs) = gilrs::Gilrs::new() else { return };

        loop {
            while let Some(gilrs::Event { event, .. }) = gilrs.next_event() {
                use gilrs::{Button, EventType};
                let ev = match event {
                    EventType::ButtonPressed(Button::DPadUp, _) => Some(GamepadEvent::Up),
                    EventType::ButtonPressed(Button::DPadDown, _) => Some(GamepadEvent::Down),
                    EventType::ButtonPressed(Button::Start, _) => Some(GamepadEvent::Toggle),
                    _ => None,
                };
                if let Some(e) = ev {
                    let _ = tx.send(e);
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(16));
        }
    });

    rx
}

// ─── TUI Application ──────────────────────────────────────────────────────────

pub fn run(
    game_title: Option<String>,
    _game_id: Option<String>,
    cmd_rx: std::sync::mpsc::Receiver<Command>,
) {
    eprintln!("[overlay] Starting TUI application");

    if let Err(e) = run_tui(game_title, cmd_rx) {
        eprintln!("[overlay] TUI error: {}", e);
    }
}

fn run_tui(game_title: Option<String>, cmd_rx: std::sync::mpsc::Receiver<Command>) -> Result<(), Box<dyn std::error::Error>> {
    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let cmd_rx = Arc::new(Mutex::new(cmd_rx));
    let gp_rx = spawn_gamepad_thread();

    let mut visible = false;
    let mut current_tab: u16 = 0;
    let mut current_game_title = game_title;

    loop {
        // Poll commands
        {
            let rx = cmd_rx.lock().unwrap();
            while let Ok(cmd) = rx.try_recv() {
                match cmd {
                    Command::Show => visible = true,
                    Command::Hide => visible = false,
                    Command::GameStarted { game_title, .. } => {
                        current_game_title = Some(game_title);
                    }
                    Command::GameStopped => {
                        current_game_title = None;
                    }
                    Command::Quit => return Ok(()),
                }
            }
        }

        // Draw
        terminal.draw(|f| {
            if !visible {
                return;
            }

            let size = f.size();
            let panel_width = (size.width / 3).max(40).min(80);
            let x_offset = size.width.saturating_sub(panel_width);

            let panel_area = Rect {
                x: x_offset,
                y: 0,
                width: panel_width,
                height: size.height,
            };

            // Background
            let overlay = Paragraph::new("")
                .style(Style::default().bg(Color::Black))
                .block(Block::default());
            f.render_widget(overlay, panel_area);

            // Panel content
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .constraints([
                    Constraint::Length(3),
                    Constraint::Min(5),
                    Constraint::Length(3),
                ])
                .split(panel_area);

            // Tabs
            let tabs = vec!["Game Options", "Overdrive", "Settings"];
            let selected_tab = current_tab as usize;
            let tabs_widget = Tabs::new(tabs)
                .block(Block::default().borders(Borders::BOTTOM))
                .select(selected_tab)
                .style(Style::default().fg(Color::White))
                .highlight_style(
                    Style::default()
                        .fg(Color::Cyan)
                        .add_modifier(Modifier::BOLD | Modifier::UNDERLINED),
                );
            f.render_widget(tabs_widget, chunks[0]);

            // Content area
            let content = match selected_tab {
                0 => vec![
                    Line::from("Return to Launcher"),
                    Line::from("Quit Game"),
                    Line::from("Exit PoliGame"),
                ],
                1 => {
                    let title = current_game_title.as_deref().unwrap_or("No game running");
                    vec![
                        Line::from(format!("Currently: {}", title)),
                        Line::from(""),
                        Line::from("[Overdrive navigation]"),
                    ]
                }
                2 => vec![
                    Line::from("Volume: ▬▬▬▬▬▬▬"),
                    Line::from("Brightness: ▬▬▬▬▬▬▬"),
                ],
                _ => vec![Line::from("")],
            };

            let content_widget = Paragraph::new(content)
                .block(Block::default().borders(Borders::ALL))
                .style(Style::default().fg(Color::White));
            f.render_widget(content_widget, chunks[1]);

            // Help
            let help = Paragraph::new("↑↓ Tabs  Start Toggle  Ctrl+C Quit")
                .style(Style::default().fg(Color::DarkGray))
                .alignment(Alignment::Center);
            f.render_widget(help, chunks[2]);
        })?;

        // Handle keyboard input
        if event::poll(std::time::Duration::from_millis(50))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Char('c') if key.modifiers.contains(crossterm::event::KeyModifiers::CONTROL) => {
                        break;
                    }
                    KeyCode::Up | KeyCode::Left => {
                        current_tab = current_tab.saturating_sub(1);
                        visible = true;
                    }
                    KeyCode::Down | KeyCode::Right => {
                        if current_tab < 2 {
                            current_tab += 1;
                        }
                        visible = true;
                    }
                    KeyCode::Char('t') => {
                        visible = !visible;
                    }
                    _ => {}
                }
            }
        }

        // Handle gamepad
        while let Ok(ev) = gp_rx.try_recv() {
            match ev {
                GamepadEvent::Up => {
                    current_tab = current_tab.saturating_sub(1);
                    visible = true;
                }
                GamepadEvent::Down => {
                    if current_tab < 2 {
                        current_tab += 1;
                    }
                    visible = true;
                }
                GamepadEvent::Toggle => {
                    visible = !visible;
                }
            }
        }
    }

    // Cleanup terminal
    disable_raw_mode()?;
    execute!(io::stdout(), LeaveAlternateScreen)?;

    Ok(())
}
