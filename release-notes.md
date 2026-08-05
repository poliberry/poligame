## PoliGame v1.3.6

### Bug fixes

**Linux AppImage crash on startup**
- **App aborted immediately on Wayland with `Could not create default EGL display: EGL_BAD_PARAMETER. Aborting...`** — the AppImage bundles its own copies of `libwayland-client`, `libwayland-egl`, and `libwayland-cursor` alongside the bundled GTK/WebKitGTK stack, and those bundled copies were taking precedence over the host's own. That left two different builds of libwayland-client loaded in the same process — one used by our bundled GTK stack, another used internally by the host's Mesa/EGL driver — which Mesa's EGL Wayland platform couldn't reconcile, aborting the renderer process before it ever created a window. Forcing the single, host-provided copies of these libraries to be used everywhere (found via the dynamic linker cache, not the AppImage's own library path) fixes it. This also explains why videos and audio didn't play for affected users: the renderer process responsible for both never started in the first place.
