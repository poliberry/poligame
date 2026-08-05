## PoliGame v1.3.5

### Bug fixes

**Overdrive controller support**
- **PlayStation controllers didn't work at all** — no buttons, d-pad, or thumbstick. Controller input relied on a third-party library that assumed the browser's "standard" gamepad mapping with no fallback; DualShock/DualSense pads frequently report a non-standard mapping (especially on Linux), so every input read incorrectly. A new mapping layer detects non-standard controllers and applies a PlayStation-specific fallback, including proper d-pad decoding.
- **Buttons needing multiple presses, thumbstick working intermittently** — every screen in Overdrive (the menu, power dialog, on-screen keyboard, library, game details, settings, and more) independently enabled and disabled a single shared, app-wide input-polling loop on every re-render. Any one screen re-rendering for an unrelated reason could tear down and rebuild input handling for every other screen mounted at the same time, dropping presses and stick updates. Controller input is now driven by one persistent polling loop that no individual screen's re-renders can disturb.
- **D-pad not working on the Overdrive home screen** — the home screen never wired up d-pad input at all; only the analog stick worked. D-pad navigation is now fully wired, matching the stick.

**Global overlay hotkey**
- **Hotkey already claimed on some systems** — the global shortcut that opens the in-game overlay was hardcoded to Ctrl+Shift+F9 and registered unconditionally with no error handling, which could silently fail to activate (or in some cases prevent the app from starting) if the OS or desktop environment already claimed that combination, as observed on Linux. It's now Alt+Shift+O, chosen to avoid Ctrl/Cmd and Super — the modifiers most commonly reserved by window managers and by Windows itself — with two fallback combinations tried automatically if the primary one is ever unavailable.
