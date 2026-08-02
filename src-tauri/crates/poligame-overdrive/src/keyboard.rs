// On-screen keyboard support.
//
// When text input is focused on a touch-capable device, we try to show the
// platform touch keyboard first (Windows: TabTip; fallback: our gpui keyboard).

pub fn show_platform_keyboard() {
    #[cfg(windows)]
    show_tabtip();
}

pub fn hide_platform_keyboard() {
    #[cfg(windows)]
    hide_tabtip();
}

#[cfg(windows)]
fn show_tabtip() {
    use std::process::Command;
    // TabTip is the Windows touch keyboard binary.
    let tabtip = r"C:\Program Files\Common Files\microsoft shared\ink\TabTip.exe";
    let _ = Command::new(tabtip).spawn();
}

#[cfg(windows)]
fn hide_tabtip() {
    use std::process::Command;
    // Closing via taskkill is the only reliable way to dismiss TabTip programmatically.
    let _ = Command::new("taskkill")
        .args(["/f", "/im", "TabTip.exe"])
        .spawn();
}

// --- In-process GPUI on-screen keyboard state ---

#[derive(Clone, Debug, Default)]
pub struct KeyboardState {
    pub visible: bool,
    pub input: String,
    pub shift: bool,
    pub caps: bool,
    pub mode: KeyboardMode,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub enum KeyboardMode {
    #[default]
    Letters,
    Numbers,
    Symbols,
}

impl KeyboardState {
    pub fn type_char(&mut self, ch: char) {
        if self.shift && !self.caps {
            self.shift = false;
        }
        self.input.push(ch);
    }

    pub fn backspace(&mut self) {
        self.input.pop();
    }

    pub fn toggle_shift(&mut self) {
        self.shift = !self.shift;
    }

    pub fn toggle_caps(&mut self) {
        self.caps = !self.caps;
        self.shift = false;
    }

    pub fn commit(&mut self) -> String {
        let result = self.input.clone();
        self.input.clear();
        self.visible = false;
        self.shift = false;
        result
    }

    pub fn cancel(&mut self) {
        self.input.clear();
        self.visible = false;
        self.shift = false;
    }
}
