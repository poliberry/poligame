// Overlay UI — transparent always-on-top gpui window
//
// Layout:
//   OverlayRoot (transparent background)
//   └── Side panel (slides in from right)
//       ├── TabBar  (Game Options | Overdrive | Settings)
//       └── TabContent (changes per tab)
//
// Spatial navigation mirrors the JS Overdrive overlay:
//   • Arrow keys / D-pad: navigate tabs and content
//   • Enter / A: activate
//   • Escape / B: close overlay

use gpui::{
    div, App, AppContext, Context, FocusHandle, Focusable, IntoElement,
    KeyDownEvent, Render, SharedString, View, ViewContext, VisualContext,
    WindowOptions, hsla, px, white,
};
use gpui::prelude::*;
use std::sync::{Arc, Mutex};

use crate::ipc::{Command, Event, send_event};

#[derive(Clone, Debug, Default, PartialEq)]
pub enum Tab {
    #[default]
    GameOptions,
    Overdrive,
    Settings,
}

struct OverlayApp {
    focus: FocusHandle,
    visible: bool,
    active_tab: Tab,
    game_title: Option<String>,
    game_id: Option<String>,
    cmd_rx: Arc<Mutex<std::sync::mpsc::Receiver<Command>>>,
}

impl OverlayApp {
    fn new(
        cx: &mut ViewContext<Self>,
        game_title: Option<String>,
        game_id: Option<String>,
        cmd_rx: Arc<Mutex<std::sync::mpsc::Receiver<Command>>>,
    ) -> Self {
        let focus = cx.focus_handle();
        Self {
            focus,
            visible: false,
            active_tab: Tab::default(),
            game_title,
            game_id,
            cmd_rx,
        }
    }

    fn cycle_tab(&mut self, delta: i8, cx: &mut ViewContext<Self>) {
        self.active_tab = match (&self.active_tab, delta) {
            (Tab::GameOptions, 1)  | (Tab::Settings, -1)   => Tab::Overdrive,
            (Tab::Overdrive, 1)    | (Tab::GameOptions, -1) => Tab::Settings,
            (Tab::Settings, 1)     | (Tab::Overdrive, -1)   => Tab::GameOptions,
            _ => self.active_tab.clone(),
        };
        cx.notify();
    }

    fn on_key_down(&mut self, ev: &KeyDownEvent, cx: &mut ViewContext<Self>) {
        if !self.visible { return; }
        match ev.keystroke.key.as_str() {
            "ArrowUp"   => self.cycle_tab(-1, cx),
            "ArrowDown" => self.cycle_tab(1, cx),
            "Enter"     => self.activate(cx),
            "Escape"    => { self.visible = false; cx.notify(); }
            _ => {}
        }
    }

    fn activate(&mut self, cx: &mut ViewContext<Self>) {
        match &self.active_tab {
            Tab::GameOptions => {}
            Tab::Overdrive   => {}
            Tab::Settings    => {}
        }
    }

    fn render_tab_bar(&self) -> impl IntoElement {
        let tabs = [
            (Tab::GameOptions, "Game Options"),
            (Tab::Overdrive,   "Overdrive"),
            (Tab::Settings,    "Settings"),
        ];
        div()
            .flex()
            .flex_col()
            .gap_1()
            .w(px(180.0))
            .p_3()
            .children(tabs.into_iter().map(|(tab, label)| {
                let is_active = &self.active_tab == &tab;
                div()
                    .px_3()
                    .py_2()
                    .rounded(px(8.0))
                    .bg(if is_active { hsla(0.72, 0.8, 0.55, 1.0) } else { hsla(0.0, 0.0, 0.12, 0.8) })
                    .text_color(white())
                    .text_sm()
                    .child(SharedString::from(label))
            }))
    }

    fn render_game_options(&self) -> impl IntoElement {
        let options: Vec<(&str, Box<dyn Fn()>)> = vec![
            ("Return to Launcher", Box::new(|| send_event(Event::ReturnToLauncher))),
            ("Quit Game",          Box::new(|| send_event(Event::QuitGame))),
            ("Exit PoliGame",      Box::new(|| send_event(Event::ExitApp))),
        ];

        div()
            .flex()
            .flex_col()
            .gap_2()
            .p_4()
            .children(options.into_iter().map(|(label, _)| {
                div()
                    .px_4()
                    .py_3()
                    .rounded(px(8.0))
                    .bg(hsla(0.0, 0.0, 0.12, 0.8))
                    .text_color(white())
                    .cursor_pointer()
                    .child(SharedString::from(label))
            }))
    }

    fn render_settings(&self) -> impl IntoElement {
        div()
            .flex()
            .flex_col()
            .gap_3()
            .p_4()
            .child(
                div()
                    .text_color(white())
                    .text_sm()
                    .child("Volume"),
            )
            .child(
                div()
                    .w_full()
                    .h(px(4.0))
                    .rounded_full()
                    .bg(hsla(0.0, 0.0, 0.3, 1.0)),
            )
            .child(
                div()
                    .text_color(white())
                    .text_sm()
                    .child("Brightness"),
            )
            .child(
                div()
                    .w_full()
                    .h(px(4.0))
                    .rounded_full()
                    .bg(hsla(0.0, 0.0, 0.3, 1.0)),
            )
    }

    fn render_overdrive_panel(&self) -> impl IntoElement {
        let title = self.game_title.as_deref().unwrap_or("No game running");
        div()
            .flex()
            .flex_col()
            .gap_3()
            .p_4()
            .child(
                div()
                    .text_color(white())
                    .text_base()
                    .font_bold()
                    .child(SharedString::from(title.to_string())),
            )
            .child(
                div()
                    .text_color(hsla(0.0, 0.0, 0.55, 1.0))
                    .text_sm()
                    .child("Overdrive navigation panel"),
            )
    }
}

impl Render for OverlayApp {
    fn render(&mut self, cx: &mut ViewContext<Self>) -> impl IntoElement {
        // Poll IPC commands
        if let Ok(rx) = self.cmd_rx.lock() {
            while let Ok(cmd) = rx.try_recv() {
                match cmd {
                    Command::Show => { self.visible = true; }
                    Command::Hide => { self.visible = false; }
                    Command::GameStarted { game_title, game_id } => {
                        self.game_title = Some(game_title);
                        self.game_id = Some(game_id);
                    }
                    Command::GameStopped => {
                        self.game_title = None;
                        self.game_id = None;
                    }
                    Command::Quit => std::process::exit(0),
                }
                cx.notify();
            }
        }

        div()
            .id("overlay-root")
            .key_context("overlay")
            .track_focus(&self.focus)
            .on_key_down(cx.listener(Self::on_key_down))
            .size_full()
            // Fully transparent base — the game renders behind this
            .bg(hsla(0.0, 0.0, 0.0, 0.0))
            .when(self.visible, |root| {
                root
                    // Dark scrim over entire screen
                    .child(
                        div()
                            .absolute()
                            .inset_0()
                            .bg(hsla(0.0, 0.0, 0.0, 0.5)),
                    )
                    // Side panel slides in from right
                    .child(
                        div()
                            .absolute()
                            .top_0()
                            .right_0()
                            .bottom_0()
                            .w(px(480.0))
                            .bg(hsla(0.0, 0.0, 0.08, 0.95))
                            .flex()
                            .flex_row()
                            .child(self.render_tab_bar())
                            .child(
                                div()
                                    .flex_1()
                                    .overflow_hidden()
                                    .child(match &self.active_tab {
                                        Tab::GameOptions => self.render_game_options().into_any_element(),
                                        Tab::Overdrive   => self.render_overdrive_panel().into_any_element(),
                                        Tab::Settings    => self.render_settings().into_any_element(),
                                    }),
                            )
                            // Navigation hints at bottom
                            .child(
                                div()
                                    .absolute()
                                    .bottom_4()
                                    .left_0()
                                    .right_0()
                                    .flex()
                                    .justify_center()
                                    .text_color(hsla(0.0, 0.0, 0.45, 1.0))
                                    .text_xs()
                                    .child("↑↓ Tabs   Enter Select   Esc Close"),
                            ),
                    )
            })
    }
}

impl Focusable for OverlayApp {
    fn focus_handle(&self, _cx: &AppContext) -> FocusHandle {
        self.focus.clone()
    }
}

// ─── Gamepad thread ──────────────────────────────────────────────────────────

fn spawn_gamepad_thread(tx: std::sync::mpsc::Sender<GamepadEvent>) {
    std::thread::spawn(move || {
        let Ok(mut gilrs) = gilrs::Gilrs::new() else { return };
        loop {
            while let Some(gilrs::Event { event, .. }) = gilrs.next_event() {
                use gilrs::{Button, EventType};
                match event {
                    EventType::ButtonPressed(Button::DPadUp, _)   => { let _ = tx.send(GamepadEvent::Up); }
                    EventType::ButtonPressed(Button::DPadDown, _) => { let _ = tx.send(GamepadEvent::Down); }
                    EventType::ButtonPressed(Button::South, _)    => { let _ = tx.send(GamepadEvent::Confirm); }
                    EventType::ButtonPressed(Button::East, _)     => { let _ = tx.send(GamepadEvent::Back); }
                    EventType::ButtonPressed(Button::Start, _)    => { let _ = tx.send(GamepadEvent::Toggle); }
                    _ => {}
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(16));
        }
    });
}

enum GamepadEvent { Up, Down, Confirm, Back, Toggle }

// ─── Platform: Windows always-on-top ─────────────────────────────────────────

#[cfg(windows)]
fn set_always_on_top(hwnd_raw: isize) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_TOPMOST, SWP_NOMOVE, SWP_NOSIZE,
    };
    unsafe {
        let _ = SetWindowPos(
            HWND(hwnd_raw as *mut _),
            HWND_TOPMOST,
            0, 0, 0, 0,
            SWP_NOMOVE | SWP_NOSIZE,
        );
    }
}

// ─── Application entry ───────────────────────────────────────────────────────

pub fn run(
    game_title: Option<String>,
    game_id: Option<String>,
    cmd_rx: std::sync::mpsc::Receiver<Command>,
) {
    let cmd_rx = Arc::new(Mutex::new(cmd_rx));
    let app = App::new();
    let (gp_tx, gp_rx) = std::sync::mpsc::channel::<GamepadEvent>();
    spawn_gamepad_thread(gp_tx);

    app.run(move |cx: &mut AppContext| {
        let cmd_rx_clone = cmd_rx.clone();
        let gt = game_title.clone();
        let gid = game_id.clone();

        let window = cx
            .open_window(
                WindowOptions {
                    fullscreen: true,
                    focus: true,
                    show: true,
                    ..Default::default()
                },
                move |cx| {
                    let view = cx.new(|cx| OverlayApp::new(cx, gt, gid, cmd_rx_clone));
                    cx.focus(&view.focus_handle(cx));
                    view
                },
            )
            .expect("Failed to open overlay window");

        // Poll gamepad
        cx.spawn(|mut cx| async move {
            loop {
                while let Ok(ev) = gp_rx.try_recv() {
                    let _ = window.update(&mut cx, |view, cx| {
                        if !view.visible && matches!(ev, GamepadEvent::Toggle) {
                            view.visible = true;
                            cx.notify();
                            return;
                        }
                        match ev {
                            GamepadEvent::Up      => view.cycle_tab(-1, cx),
                            GamepadEvent::Down    => view.cycle_tab(1, cx),
                            GamepadEvent::Confirm => view.activate(cx),
                            GamepadEvent::Back | GamepadEvent::Toggle => {
                                view.visible = false;
                                cx.notify();
                            }
                        }
                    });
                }
                cx.background_executor()
                    .timer(std::time::Duration::from_millis(16))
                    .await;
            }
        })
        .detach();
    });
}
