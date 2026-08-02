use std::sync::{Arc, Mutex};
use crossterm::{
    event::{self, Event, KeyCode},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    backend::CrosstermBackend,
    layout::{Alignment, Constraint, Direction, Layout},
    style::{Color, Modifier, Style},
    text::{Line, Span},
    widgets::{Block, Borders, List, ListItem, Paragraph},
    Terminal,
};
use std::io;

pub use state::{AppState, View};
mod state;

// ─── Gamepad thread ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy)]
pub enum GamepadEvent {
    Up,
    Down,
    Confirm,
    Back,
}

pub fn spawn_gamepad_thread() -> std::sync::mpsc::Receiver<GamepadEvent> {
    let (tx, rx) = std::sync::mpsc::channel();

    std::thread::spawn(move || {
        let Ok(mut gilrs) = gilrs::Gilrs::new() else { return };
        let mut last_stick = std::time::Instant::now();

        loop {
            while let Some(gilrs::Event { event, .. }) = gilrs.next_event() {
                use gilrs::{Axis, Button, EventType};
                let ev = match event {
                    EventType::ButtonPressed(Button::DPadUp, _) => Some(GamepadEvent::Up),
                    EventType::ButtonPressed(Button::DPadDown, _) => Some(GamepadEvent::Down),
                    EventType::ButtonPressed(Button::South, _) => Some(GamepadEvent::Confirm),
                    EventType::ButtonPressed(Button::East, _) => Some(GamepadEvent::Back),
                    EventType::AxisChanged(Axis::LeftStickY, v, _) => {
                        if last_stick.elapsed().as_millis() > 150 && v.abs() > 0.6 {
                            last_stick = std::time::Instant::now();
                            if v < 0.0 {
                                Some(GamepadEvent::Up)
                            } else {
                                Some(GamepadEvent::Down)
                            }
                        } else {
                            None
                        }
                    }
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

pub fn run(state: Arc<Mutex<AppState>>) {
    eprintln!("[overdrive] Starting TUI application");

    if let Err(e) = run_tui(state) {
        eprintln!("[overdrive] TUI error: {}", e);
    }
}

fn run_tui(state: Arc<Mutex<AppState>>) -> Result<(), Box<dyn std::error::Error>> {
    // Setup terminal
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let gp_rx = spawn_gamepad_thread();
    let mut selected = 0usize;

    loop {
        let app_state = state.lock().unwrap();
        let games = app_state.games.clone();
        let count = games.len();
        drop(app_state);

        // Draw
        terminal.draw(|f| {
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .constraints([
                    Constraint::Length(3),
                    Constraint::Min(5),
                    Constraint::Length(3),
                ])
                .split(f.size());

            // Header
            let header = Paragraph::new("PoliGame Overdrive")
                .style(Style::default().fg(Color::Cyan).add_modifier(Modifier::BOLD))
                .block(Block::default().borders(Borders::BOTTOM))
                .alignment(Alignment::Center);
            f.render_widget(header, chunks[0]);

            // Game list
            let items: Vec<ListItem> = games
                .iter()
                .enumerate()
                .map(|(i, game)| {
                    let content = if i == selected {
                        Line::from(vec![Span::styled(
                            format!("▶ {}", game.title),
                            Style::default()
                                .fg(Color::Black)
                                .bg(Color::Cyan)
                                .add_modifier(Modifier::BOLD),
                        )])
                    } else {
                        Line::from(game.title.clone())
                    };
                    ListItem::new(content)
                })
                .collect();

            let list = List::new(items)
                .block(Block::default().borders(Borders::ALL).title("Games"))
                .style(Style::default().fg(Color::White));
            f.render_widget(list, chunks[1]);

            // Footer
            let footer = Paragraph::new("↑↓ Navigate  Enter Launch  B Back  Ctrl+C Quit")
                .style(Style::default().fg(Color::DarkGray))
                .alignment(Alignment::Center);
            f.render_widget(footer, chunks[2]);
        })?;

        // Handle input
        if event::poll(std::time::Duration::from_millis(50))? {
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Up | KeyCode::Char('w') => {
                        selected = selected.saturating_sub(1);
                    }
                    KeyCode::Down | KeyCode::Char('s') => {
                        if selected < count.saturating_sub(1) {
                            selected += 1;
                        }
                    }
                    KeyCode::Enter => {
                        let app_state = state.lock().unwrap();
                        if let Some(game) = app_state.games.get(selected) {
                            crate::send_event(crate::IpcEvent::LaunchGame {
                                game_id: game.id.clone(),
                            });
                        }
                    }
                    KeyCode::Esc => {
                        crate::send_event(crate::IpcEvent::Exit);
                        break;
                    }
                    KeyCode::Char('c') if key.modifiers.contains(crossterm::event::KeyModifiers::CONTROL) => {
                        break;
                    }
                    _ => {}
                }
            }
        }

        // Handle gamepad
        while let Ok(ev) = gp_rx.try_recv() {
            match ev {
                GamepadEvent::Up => {
                    selected = selected.saturating_sub(1);
                }
                GamepadEvent::Down => {
                    if selected < count.saturating_sub(1) {
                        selected += 1;
                    }
                }
                GamepadEvent::Confirm => {
                    let app_state = state.lock().unwrap();
                    if let Some(game) = app_state.games.get(selected) {
                        crate::send_event(crate::IpcEvent::LaunchGame {
                            game_id: game.id.clone(),
                        });
                    }
                }
                GamepadEvent::Back => {
                    crate::send_event(crate::IpcEvent::Exit);
                    break;
                }
            }
        }
    }

    // Cleanup terminal
    disable_raw_mode()?;
    execute!(io::stdout(), LeaveAlternateScreen)?;

    Ok(())
}
