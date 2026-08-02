// Overdrive gpui UI
//
// Architecture:
//   OverdriveApp (root view) — holds AppState, handles key/gamepad events
//   └── renders Library grid or (future) Game Details view

use gpui::{
    div, App, AppContext, Context, FocusHandle, Focusable, IntoElement,
    KeyDownEvent, Render, SharedString, View, ViewContext, VisualContext,
    WindowOptions, hsla, px, white,
};
use gpui::prelude::*;
use std::sync::{Arc, Mutex};

use crate::{Game, IpcEvent, keyboard::KeyboardState, send_event};

pub use state::{AppState, View as AppView};
mod state;

// ─── Colour palette ──────────────────────────────────────────────────────────

fn bg_dark()     -> gpui::Hsla { hsla(0.0, 0.0, 0.05, 1.0) }
fn bg_card()     -> gpui::Hsla { hsla(0.0, 0.0, 0.09, 1.0) }
fn bg_selected() -> gpui::Hsla { hsla(0.72, 0.8, 0.55, 1.0) }
fn text_dim()    -> gpui::Hsla { hsla(0.0, 0.0, 0.55, 1.0) }

// ─── Root view ───────────────────────────────────────────────────────────────

struct OverdriveApp {
    state: Arc<Mutex<AppState>>,
    focus: FocusHandle,
    keyboard: KeyboardState,
    // Gamepad events polled each render tick
    gp_rx: Arc<Mutex<std::sync::mpsc::Receiver<GamepadEvent>>>,
}

impl OverdriveApp {
    fn new(
        cx: &mut ViewContext<Self>,
        state: Arc<Mutex<AppState>>,
        gp_rx: Arc<Mutex<std::sync::mpsc::Receiver<GamepadEvent>>>,
    ) -> Self {
        let focus = cx.focus_handle();
        cx.focus(&focus);
        Self { state, focus, keyboard: KeyboardState::default(), gp_rx }
    }

    fn move_selection(&mut self, delta: i64, cx: &mut ViewContext<Self>) {
        let mut s = self.state.lock().unwrap();
        let len = s.games.len() as i64;
        if len == 0 { return; }
        s.selected_index = ((s.selected_index as i64 + delta).rem_euclid(len)) as usize;
        cx.notify();
    }

    fn launch_selected(&mut self, cx: &mut ViewContext<Self>) {
        let s = self.state.lock().unwrap();
        if let Some(g) = s.games.get(s.selected_index) {
            let id = g.id.clone();
            drop(s);
            send_event(IpcEvent::LaunchGame { game_id: id });
        }
    }

    fn on_key_down(&mut self, ev: &KeyDownEvent, cx: &mut ViewContext<Self>) {
        if self.keyboard.visible {
            match ev.keystroke.key.as_str() {
                "Escape"    => { self.keyboard.cancel(); cx.notify(); }
                "Enter"     => { self.keyboard.commit();  cx.notify(); }
                "Backspace" => { self.keyboard.backspace(); cx.notify(); }
                k if k.len() == 1 => {
                    if let Some(ch) = k.chars().next() {
                        let ch = if self.keyboard.shift || self.keyboard.caps {
                            ch.to_uppercase().next().unwrap_or(ch)
                        } else { ch };
                        self.keyboard.type_char(ch);
                        cx.notify();
                    }
                }
                _ => {}
            }
            return;
        }

        match ev.keystroke.key.as_str() {
            "ArrowRight" | "d" => self.move_selection(1, cx),
            "ArrowLeft"  | "a" => self.move_selection(-1, cx),
            "ArrowUp"    | "w" => self.move_selection(-1, cx),
            "ArrowDown"  | "s" => self.move_selection(1, cx),
            "Enter" | " "      => self.launch_selected(cx),
            "Escape"           => send_event(IpcEvent::Exit),
            _ => {}
        }
    }

    fn poll_gamepad(&mut self, cx: &mut ViewContext<Self>) {
        let events: Vec<GamepadEvent> = {
            let Ok(rx) = self.gp_rx.lock() else { return };
            std::iter::from_fn(|| rx.try_recv().ok()).collect()
        };
        for ev in events {
            match ev {
                GamepadEvent::DPadLeft  | GamepadEvent::StickLeft  => self.move_selection(-1, cx),
                GamepadEvent::DPadRight | GamepadEvent::StickRight => self.move_selection(1, cx),
                GamepadEvent::South     => self.launch_selected(cx),
                GamepadEvent::East | GamepadEvent::Start => {
                    send_event(IpcEvent::Exit);
                    return;
                }
                GamepadEvent::DPadUp | GamepadEvent::DPadDown | GamepadEvent::None => {}
            }
        }
    }

    fn render_library(&self, _cx: &mut ViewContext<Self>) -> impl IntoElement {
        let s = self.state.lock().unwrap();
        let games = s.games.clone();
        let sel = s.selected_index;
        drop(s);

        div()
            .flex()
            .flex_row()
            .gap_4()
            .px_8()
            .py_12()
            .overflow_x_scroll()
            .children(games.into_iter().enumerate().map(|(i, game)| {
                let is_sel = i == sel;
                div()
                    .flex()
                    .flex_col()
                    .gap_2()
                    .w(px(180.0))
                    .flex_shrink_0()
                    .child(
                        div()
                            .w(px(180.0))
                            .h(px(240.0))
                            .rounded(px(12.0))
                            .bg(if is_sel { bg_selected() } else { bg_card() })
                            .border_2()
                            .border_color(if is_sel {
                                white()
                            } else {
                                hsla(0.0, 0.0, 0.18, 1.0)
                            }),
                    )
                    .child(
                        div()
                            .text_color(if is_sel { white() } else { text_dim() })
                            .text_sm()
                            .truncate()
                            .child(SharedString::from(game.title)),
                    )
            }))
    }

    fn render_on_screen_keyboard(&self) -> impl IntoElement {
        let rows: &[&[&str]] = &[
            &["q","w","e","r","t","y","u","i","o","p"],
            &["a","s","d","f","g","h","j","k","l"],
            &["⇧","z","x","c","v","b","n","m","⌫"],
            &["123","space","↵"],
        ];

        div()
            .absolute()
            .bottom_0()
            .left_0()
            .right_0()
            .bg(hsla(0.0, 0.0, 0.1, 0.95))
            .p_4()
            .flex()
            .flex_col()
            .gap_2()
            .children(rows.iter().map(|row| {
                div()
                    .flex()
                    .flex_row()
                    .gap_1()
                    .justify_center()
                    .children(row.iter().map(|key| {
                        div()
                            .px_3()
                            .py_2()
                            .rounded(px(6.0))
                            .bg(bg_card())
                            .text_color(white())
                            .text_sm()
                            .cursor_pointer()
                            .child(SharedString::from(key.to_string()))
                    }))
            }))
    }
}

impl Render for OverdriveApp {
    fn render(&mut self, cx: &mut ViewContext<Self>) -> impl IntoElement {
        // Poll gamepad on each render
        self.poll_gamepad(cx);

        let kb_visible = self.keyboard.visible;

        div()
            .id("overdrive-root")
            .key_context("overdrive")
            .track_focus(&self.focus)
            .on_key_down(cx.listener(Self::on_key_down))
            .size_full()
            .flex()
            .flex_col()
            .bg(bg_dark())
            .text_color(white())
            // Top bar
            .child(
                div()
                    .flex()
                    .flex_row()
                    .items_center()
                    .justify_between()
                    .px_8()
                    .py_4()
                    .border_b_1()
                    .border_color(hsla(0.0, 0.0, 0.15, 1.0))
                    .child(
                        div()
                            .text_xl()
                            .font_bold()
                            .child("Overdrive"),
                    )
                    .child(
                        div()
                            .text_sm()
                            .text_color(text_dim())
                            .child("←→ Navigate   Enter Launch   Esc Exit"),
                    ),
            )
            // Game library
            .child(self.render_library(cx))
            // On-screen keyboard
            .when(kb_visible, |el| el.child(self.render_on_screen_keyboard()))
    }
}

impl Focusable for OverdriveApp {
    fn focus_handle(&self, _cx: &AppContext) -> FocusHandle {
        self.focus.clone()
    }
}

// ─── Gamepad thread ───────────────────────────────────────────────────────────

#[derive(Debug)]
enum GamepadEvent {
    DPadLeft,
    DPadRight,
    #[allow(dead_code)]
    DPadUp,
    #[allow(dead_code)]
    DPadDown,
    StickLeft,
    StickRight,
    South,
    East,
    Start,
    None,
}

fn spawn_gamepad_thread() -> std::sync::mpsc::Receiver<GamepadEvent> {
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
                        } else { GamepadEvent::None }
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

pub fn run(state: Arc<Mutex<AppState>>) {
    let gp_rx = Arc::new(Mutex::new(spawn_gamepad_thread()));
    let app = App::new();

    app.run(move |cx: &mut AppContext| {
        let state_clone = state.clone();
        let gp_rx_clone = gp_rx.clone();

        cx.open_window(
            WindowOptions {
                fullscreen: true,
                focus: true,
                show: true,
                ..Default::default()
            },
            move |cx| cx.new(|cx| OverdriveApp::new(cx, state_clone, gp_rx_clone)),
        )
        .expect("Failed to open Overdrive window");

        cx.activate(true);
    });
}
