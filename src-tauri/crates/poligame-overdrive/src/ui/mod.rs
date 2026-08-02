// Overdrive gpui UI
//
// Status: Architecture complete; gpui render implementation pending API confirmation.
//
// The gpui 0.2.x API changed significantly from 0.1.x:
//   • App::new() now returns Entity<App>, not the application runner
//   • AppContext became a trait; App is the concrete runner context
//   • Render::render signature is now render(&mut self, window: &mut Window, cx: &mut Context<Self>)
//   • Focusable::focus_handle is now focus_handle(&self, cx: &App) or similar
//
// The correct entry point in gpui 0.2 is:
//   App::new().run(|cx: &mut App| { cx.open_window(...) });
//
// TODO: Implement full spatial-nav UI once the exact gpui 0.2 API is locked in.
// The IPC, gamepad, DB, and keyboard layers are complete.

use std::sync::{Arc, Mutex};

pub use state::{AppState, View};
mod state;

// ─── Gamepad thread ───────────────────────────────────────────────────────────

#[derive(Debug)]
pub enum GamepadEvent {
    DPadLeft,
    DPadRight,
    DPadUp,
    DPadDown,
    StickLeft,
    StickRight,
    South,
    East,
    Start,
    None,
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
                    EventType::ButtonPressed(Button::DPadLeft, _)  => GamepadEvent::DPadLeft,
                    EventType::ButtonPressed(Button::DPadRight, _) => GamepadEvent::DPadRight,
                    EventType::ButtonPressed(Button::DPadUp, _)    => GamepadEvent::DPadUp,
                    EventType::ButtonPressed(Button::DPadDown, _)  => GamepadEvent::DPadDown,
                    EventType::ButtonPressed(Button::South, _)     => GamepadEvent::South,
                    EventType::ButtonPressed(Button::East, _)      => GamepadEvent::East,
                    EventType::ButtonPressed(Button::Start, _)     => GamepadEvent::Start,
                    EventType::AxisChanged(Axis::LeftStickX, v, _) => {
                        if last_stick.elapsed().as_millis() > 150 && v.abs() > 0.6 {
                            last_stick = std::time::Instant::now();
                            if v < 0.0 { GamepadEvent::StickLeft } else { GamepadEvent::StickRight }
                        } else {
                            GamepadEvent::None
                        }
                    }
                    _ => GamepadEvent::None,
                };
                if !matches!(ev, GamepadEvent::None) {
                    let _ = tx.send(ev);
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(16));
        }
    });

    rx
}

// ─── Application entry ────────────────────────────────────────────────────────

/// Runs the Overdrive fullscreen app.
///
/// Spawns a gamepad listener thread, then opens a fullscreen gpui window
/// showing the game library with spatial navigation.
///
/// # gpui 0.2.x TODO
/// The render/focus/window code is stubbed. Implement with:
///
/// ```rust
/// use gpui::{App, Window, Context, Render, Focusable, FocusHandle, div, px, hsla, white};
///
/// struct OverdriveView { focus: FocusHandle, state: Arc<Mutex<AppState>> }
///
/// impl Render for OverdriveView {
///     fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement { div() }
/// }
///
/// App::new().run(|cx: &mut App| {
///     cx.open_window(options, |_, cx| cx.new(|cx| OverdriveView { ... }));
/// });
/// ```
pub fn run(state: Arc<Mutex<AppState>>) {
    let gp_rx = spawn_gamepad_thread();

    eprintln!("[overdrive] ========================================");
    eprintln!("[overdrive] PoliGame Overdrive — Stub Running");
    eprintln!("[overdrive] ========================================");

    let locked = state.lock().unwrap();
    eprintln!("[overdrive] Loaded {} games from database", locked.games.len());
    for game in locked.games.iter().take(5) {
        eprintln!("[overdrive]   • {}", game.title);
    }
    if locked.games.len() > 5 {
        eprintln!("[overdrive]   ... and {} more", locked.games.len() - 5);
    }
    drop(locked);

    eprintln!("[overdrive]");
    eprintln!("[overdrive] This is a stub UI — gpui 0.2.x rendering not yet implemented.");
    eprintln!("[overdrive] Architecture layers complete: DB loading ✓, IPC ready ✓, gamepad ✓");
    eprintln!("[overdrive]");

    // Keep running and drain gamepad events until stdin closes
    let mut line = String::new();
    use std::io::BufRead;
    let stdin = std::io::stdin();
    let mut reader = stdin.lock();

    loop {
        // Drain gamepad events to avoid channel buffer leak
        while let Ok(_ev) = gp_rx.try_recv() {
            // Events will be handled when gpui render is implemented
        }

        // Poll stdin with a timeout by attempting to read
        // For now, just read one line and exit (stub behavior)
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => {
                eprintln!("[overdrive] Stdin closed, exiting");
                break;
            }
            Ok(_) => {
                // Got a line of input on stdin (shouldn't happen in normal flow)
                eprintln!("[overdrive] Received IPC: {}", line.trim());
            }
            Err(e) => {
                eprintln!("[overdrive] Stdin read error: {e}");
                break;
            }
        }
    }

    eprintln!("[overdrive] Exiting");
}
