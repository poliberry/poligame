// Game Overlay UI — transparent always-on-top window
//
// Status: Architecture complete; gpui render implementation pending API confirmation.
//
// The gpui 0.2.x entry point changed significantly from 0.1.x:
//   • App::new() returns Entity<App>, not the application runner
//   • The runner is obtained separately; AppContext is now a trait not a type
//   • Render::render takes (&mut self, window: &mut Window, cx: &mut Context<Self>)
//   • Focusable::focus_handle no longer takes a generic type parameter
//
// Design of the finished UI (three-tab side panel, slides in from right):
//
//   OverlayRoot (transparent fullscreen)
//   └── Panel (480px from right, only when visible)
//       ├── TabBar: Game Options | Overdrive | Settings
//       └── TabContent:
//           • GameOptions — Return to Launcher / Quit Game / Exit PoliGame
//           • Overdrive   — mirrors the Overdrive spatial-nav library
//           • Settings    — Volume / Brightness sliders
//
// Spatial navigation: arrow keys + Enter/Escape for keyboard, gilrs for controller.
// Toggle: Ctrl+Shift+F9 (sent from main process as {"cmd":"show"/"hide"}).
//
// TODO: Implement full gpui 0.2.x render/focus/window code once API is confirmed.

use crate::ipc::Command;
use std::sync::{Arc, Mutex};

// ─── Gamepad thread ───────────────────────────────────────────────────────────

#[derive(Debug)]
enum GamepadEvent { Up, Down, Confirm, Back, Toggle }

fn spawn_gamepad_thread(tx: std::sync::mpsc::Sender<GamepadEvent>) {
    std::thread::spawn(move || {
        let Ok(mut gilrs) = gilrs::Gilrs::new() else { return };
        loop {
            while let Some(gilrs::Event { event, .. }) = gilrs.next_event() {
                use gilrs::{Button, EventType};
                let ev = match event {
                    EventType::ButtonPressed(Button::DPadUp, _)   => Some(GamepadEvent::Up),
                    EventType::ButtonPressed(Button::DPadDown, _) => Some(GamepadEvent::Down),
                    EventType::ButtonPressed(Button::South, _)    => Some(GamepadEvent::Confirm),
                    EventType::ButtonPressed(Button::East, _)     => Some(GamepadEvent::Back),
                    EventType::ButtonPressed(Button::Start, _)    => Some(GamepadEvent::Toggle),
                    _ => None,
                };
                if let Some(e) = ev { let _ = tx.send(e); }
            }
            std::thread::sleep(std::time::Duration::from_millis(16));
        }
    });
}

// ─── Application entry ────────────────────────────────────────────────────────

/// Runs the overlay window process.
///
/// Reads commands from `cmd_rx` (forwarded from stdin by `main.rs`)
/// and renders a transparent side panel over the running game.
///
/// # gpui 0.2.x TODO
/// Implement with the correct gpui 0.2 App/Window API. Skeleton:
///
/// ```rust
/// use gpui::{App, Window, Context, Render, Focusable, FocusHandle, div, px, hsla, white};
///
/// struct OverlayView { focus: FocusHandle, visible: bool, ... }
///
/// impl Render for OverlayView {
///     fn render(&mut self, _window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
///         self.poll_commands(cx);
///         div() /* ... tabs + panel */
///     }
/// }
///
/// // Entry point:
/// App::new().run(|cx: &mut App| {
///     cx.open_window(/* 4 args in 0.2.x */, |_, cx| cx.new(|cx| OverlayView::new(...)));
/// });
/// ```
pub fn run(
    game_title: Option<String>,
    game_id: Option<String>,
    cmd_rx: std::sync::mpsc::Receiver<Command>,
) {
    eprintln!("[overlay] ========================================");
    eprintln!("[overlay] PoliGame Game Overlay — Stub Running");
    eprintln!("[overlay] ========================================");

    if let Some(ref t) = game_title {
        eprintln!("[overlay] Game: {}", t);
    }
    if let Some(ref id) = game_id {
        eprintln!("[overlay] Game ID: {}", id);
    }

    eprintln!("[overlay]");
    eprintln!("[overlay] This is a stub UI — gpui 0.2.x rendering not yet implemented.");
    eprintln!("[overlay] Architecture layers complete: IPC ready ✓, gamepad ✓");
    eprintln!("[overlay]");
    eprintln!("[overlay] Listening for IPC commands (show/hide/quit)...");
    eprintln!("[overlay]");

    let cmd_rx = Arc::new(Mutex::new(cmd_rx));
    let (gp_tx, gp_rx) = std::sync::mpsc::channel::<GamepadEvent>();
    spawn_gamepad_thread(gp_tx);

    // Process IPC commands until the main process closes stdin.
    loop {
        match cmd_rx.lock().unwrap().recv() {
            Ok(Command::Quit) | Err(_) => {
                eprintln!("[overlay] Received quit command, exiting");
                break;
            }
            Ok(cmd) => eprintln!("[overlay] IPC: {:?}", cmd),
        }
        // Drain gamepad events to avoid channel buffer leak
        while let Ok(_ev) = gp_rx.try_recv() {
            // Events will be handled when gpui render is implemented
        }
    }

    eprintln!("[overlay] Exiting");
}
