import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { useThemeStore } from "@/stores/themeStore";
import { useOverdriveStore } from "@/stores/overdriveStore";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";
import { cn } from "@/lib/utils";
import { OverdriveHintItem } from "@/components/overdrive/OverdriveNavigationHints";
import { Download, HardDrive, Network, Palette, SlidersHorizontal, Wifi } from "lucide-react";
// @ts-ignore
import moveSound from "@/public/sounds/move.wav";

type SettingsSection = "updates" | "storage" | "theme" | "network" | "interface";
type NavMode = "sections" | "content";

interface UpdateCheckResult {
  available: boolean;
  current_version: string;
  version: string | null;
  notes: string | null;
  date: string | null;
}

interface StorageDriveInfo {
  name: string;
  mount_point: string;
  file_system: string;
  total_bytes: number;
  available_bytes: number;
}

interface NetworkOverview {
  online: boolean;
  label: string;
}

const SECTION_META: Array<{ id: SettingsSection; label: string; icon: React.ReactNode }> = [
  { id: "updates", label: "Updates", icon: <Download className="h-4 w-4" /> },
  { id: "storage", label: "Storage", icon: <HardDrive className="h-4 w-4" /> },
  { id: "theme", label: "Theme", icon: <Palette className="h-4 w-4" /> },
  { id: "network", label: "Network", icon: <Network className="h-4 w-4" /> },
  { id: "interface", label: "Interface", icon: <SlidersHorizontal className="h-4 w-4" /> },
];

const bytesToGb = (v: number) => `${(v / (1024 * 1024 * 1024)).toFixed(1)} GB`;

interface SettingsViewProps {
  initialSection?: string;
  onBack: () => void;
  onHintsChange?: (hints: OverdriveHintItem[]) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ initialSection, onBack, onHintsChange }) => {
  const { colors, setColors } = useThemeStore();
  const { showBatteryIndicator, setShowBatteryIndicator, toggleMenu, isTopBarFocused, setTopBarFocused } = useOverdriveStore();

  const resolveSection = (): SettingsSection => {
    if (initialSection && SECTION_META.some((s) => s.id === initialSection)) {
      return initialSection as SettingsSection;
    }
    return "updates";
  };

  const [section, setSection] = React.useState<SettingsSection>(resolveSection);
  const [sectionIndex, setSectionIndex] = React.useState(() => {
    const idx = SECTION_META.findIndex((s) => s.id === resolveSection());
    return idx >= 0 ? idx : 0;
  });
  const [navMode, setNavMode] = React.useState<NavMode>("sections");
  const [actionIndex, setActionIndex] = React.useState(0);

  const [updateInfo, setUpdateInfo] = React.useState<UpdateCheckResult | null>(null);
  const [updateMessage, setUpdateMessage] = React.useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = React.useState(false);
  const [installingUpdate, setInstallingUpdate] = React.useState(false);
  const [drives, setDrives] = React.useState<StorageDriveInfo[]>([]);
  const [loadingDrives, setLoadingDrives] = React.useState(false);
  const [network, setNetwork] = React.useState<NetworkOverview | null>(null);
  const [loadingNetwork, setLoadingNetwork] = React.useState(false);

  const [accent, setAccent] = React.useState(colors.accent);
  const [button, setButton] = React.useState(colors.button);
  const [buttonSecondary, setButtonSecondary] = React.useState(colors.buttonSecondary || colors.accent);
  const [background, setBackground] = React.useState(colors.background);
  const [panel, setPanel] = React.useState(colors.panel);

  const moveAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const prevTopBarRef = React.useRef(isTopBarFocused);

  React.useEffect(() => {
    const a = new Audio(moveSound);
    a.preload = "auto";
    a.volume = 0.35;
    moveAudioRef.current = a;
    return () => { a.pause(); moveAudioRef.current = null; };
  }, []);

  React.useEffect(() => {
    return () => { setTopBarFocused(false); };
  }, [setTopBarFocused]);

  React.useEffect(() => {
    setAccent(colors.accent);
    setButton(colors.button);
    setButtonSecondary(colors.buttonSecondary || colors.accent);
    setBackground(colors.background);
    setPanel(colors.panel);
  }, [colors]);

  React.useEffect(() => {
    if (section !== "storage") return;
    let cancelled = false;
    const load = async () => {
      setLoadingDrives(true);
      try {
        const r = await invoke<StorageDriveInfo[]>("list_storage_drives");
        if (!cancelled) setDrives(r || []);
      } catch (e) { console.error(e); }
      finally { if (!cancelled) setLoadingDrives(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [section]);

  React.useEffect(() => {
    if (section !== "network") return;
    let cancelled = false;
    const load = async () => {
      setLoadingNetwork(true);
      try {
        const r = await invoke<NetworkOverview>("get_network_overview");
        if (!cancelled) setNetwork(r);
      } catch (e) { if (!cancelled) setNetwork({ online: false, label: "Unavailable" }); }
      finally { if (!cancelled) setLoadingNetwork(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [section]);

  const playMove = React.useCallback(() => {
    const a = moveAudioRef.current;
    if (!a) return;
    a.currentTime = 0;
    void a.play().catch(() => {});
  }, []);

  const changeSection = React.useCallback((s: SettingsSection) => {
    setSection(s);
    const idx = SECTION_META.findIndex((m) => m.id === s);
    if (idx >= 0) setSectionIndex(idx);
    setNavMode("sections");
    setActionIndex(0);
  }, []);

  const sectionActions = React.useMemo(() => {
    const map: Record<SettingsSection, Array<{ id: string; disabled?: boolean }>> = {
      updates: [
        { id: "updates-check", disabled: checkingUpdate },
        { id: "updates-install", disabled: installingUpdate || !updateInfo?.available },
      ],
      storage: [],
      theme: [
        { id: "theme-accent-hex" },
        { id: "theme-button-hex" },
        { id: "theme-button-secondary-hex" },
        { id: "theme-background-hex" },
        { id: "theme-panel-hex" },
        { id: "theme-apply" },
      ],
      network: [{ id: "network-open" }, { id: "network-refresh" }],
      interface: [{ id: "interface-battery-toggle" }, { id: "interface-return" }],
    };
    return map[section] || [];
  }, [checkingUpdate, installingUpdate, section, updateInfo?.available]);

  React.useEffect(() => {
    setActionIndex((c) => Math.min(c, Math.max(0, sectionActions.length - 1)));
  }, [sectionActions]);

  const focusAction = React.useCallback((id: string) => {
    document.querySelector<HTMLElement>(`[data-settings-action="${id}"]`)?.focus();
  }, []);

  const focusSectionEl = React.useCallback((id: SettingsSection) => {
    document.querySelector<HTMLElement>(`[data-settings-section="${id}"]`)?.focus();
  }, []);

  const enterContent = React.useCallback(() => {
    if (!sectionActions.length) return;
    playMove();
    setNavMode("content");
    setActionIndex(0);
    const first = sectionActions[0];
    if (first) focusAction(first.id);
  }, [focusAction, playMove, sectionActions]);

  const exitContent = React.useCallback(() => {
    playMove();
    setNavMode("sections");
    document.activeElement instanceof HTMLElement && document.activeElement.blur();
  }, [playMove]);

  const shiftSection = React.useCallback((dir: 1 | -1) => {
    if (dir === -1 && sectionIndex <= 0) {
      playMove();
      setTopBarFocused(true);
      document.activeElement instanceof HTMLElement && document.activeElement.blur();
      return;
    }
    const next = Math.max(0, Math.min(SECTION_META.length - 1, sectionIndex + dir));
    if (next !== sectionIndex) {
      const m = SECTION_META[next];
      if (m) { playMove(); changeSection(m.id); }
    }
  }, [changeSection, playMove, sectionIndex, setTopBarFocused]);

  const moveAction = React.useCallback((dir: 1 | -1) => {
    if (!sectionActions.length) return;
    setActionIndex((cur) => {
      if (dir === -1 && cur <= 0) {
        playMove();
        setTopBarFocused(true);
        document.activeElement instanceof HTMLElement && document.activeElement.blur();
        return cur;
      }
      const next = Math.max(0, Math.min(sectionActions.length - 1, cur + dir));
      if (next === cur) return cur;
      playMove();
      const a = sectionActions[next];
      if (a) focusAction(a.id);
      return next;
    });
  }, [focusAction, playMove, sectionActions, setTopBarFocused]);

  const activateAction = React.useCallback(() => {
    const action = sectionActions[actionIndex];
    if (!action || action.disabled) return;
    const el = document.querySelector<HTMLElement>(`[data-settings-action="${action.id}"]`);
    if (el) { el.focus(); if (el instanceof HTMLButtonElement) el.click(); }
  }, [actionIndex, sectionActions]);

  React.useEffect(() => {
    if (navMode !== "content") return;
    const action = sectionActions[actionIndex];
    if (action) focusAction(action.id);
  }, [actionIndex, focusAction, navMode, sectionActions]);

  React.useEffect(() => {
    const wasTopBar = prevTopBarRef.current;
    if (wasTopBar && !isTopBarFocused) {
      if (navMode === "content") {
        const a = sectionActions[actionIndex];
        if (a) focusAction(a.id);
      } else {
        focusSectionEl(section);
      }
    }
    prevTopBarRef.current = isTopBarFocused;
  }, [actionIndex, focusAction, focusSectionEl, isTopBarFocused, navMode, section, sectionActions]);

  useResponsiveGamepad({
    onButtonDown: (btn) => {
      if (isTopBarFocused) return;
      if (btn === "B") { onBack(); return; }
      if (btn === "LB") { navMode === "content" ? moveAction(-1) : shiftSection(-1); return; }
      if (btn === "RB") { navMode === "content" ? moveAction(1) : shiftSection(1); return; }
      if (btn === "RIGHT") { if (navMode === "sections") enterContent(); return; }
      if (btn === "LEFT") { if (navMode === "content") exitContent(); return; }
      if (btn === "A" || btn === "X") { navMode === "sections" ? enterContent() : activateAction(); }
    },
    onDPad: (dir) => {
      if (isTopBarFocused) return;
      if (dir === "LEFT") { if (navMode === "content") exitContent(); return; }
      if (dir === "RIGHT") { if (navMode === "sections") enterContent(); return; }
      if (dir === "UP") { navMode === "sections" ? shiftSection(-1) : moveAction(-1); return; }
      if (dir === "DOWN") { navMode === "sections" ? shiftSection(1) : moveAction(1); }
    },
  });

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTopBarFocused) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); onBack(); return; }

      const isInput = e.target instanceof HTMLElement && (
        e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable
      );
      if (isInput) return;

      if (e.key === "ArrowUp" || e.key === "w") { e.preventDefault(); navMode === "sections" ? shiftSection(-1) : moveAction(-1); return; }
      if (e.key === "ArrowDown" || e.key === "s") { e.preventDefault(); navMode === "sections" ? shiftSection(1) : moveAction(1); return; }
      if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault(); if (navMode === "sections") enterContent(); return; }
      if (e.key === "ArrowLeft" || e.key === "a") { e.preventDefault(); if (navMode === "content") exitContent(); return; }
      if (e.key === "Enter") { e.preventDefault(); navMode === "sections" ? enterContent() : activateAction(); return; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activateAction, enterContent, exitContent, isTopBarFocused, moveAction, navMode, onBack, shiftSection]);

  const checkForUpdates = React.useCallback(async () => {
    setCheckingUpdate(true);
    setUpdateMessage(null);
    try {
      const r = await invoke<UpdateCheckResult>("check_for_app_update");
      setUpdateInfo(r);
      setUpdateMessage(r.available ? `Update available: ${r.version}` : "You are up to date.");
    } catch (e) {
      setUpdateMessage(e instanceof Error ? e.message : "Failed to check.");
    } finally { setCheckingUpdate(false); }
  }, []);

  const installUpdate = React.useCallback(async () => {
    setInstallingUpdate(true);
    try { await invoke("install_app_update"); }
    catch (e) { setUpdateMessage(e instanceof Error ? e.message : "Failed to install."); }
    finally { setInstallingUpdate(false); }
  }, []);

  const applyTheme = React.useCallback(() => {
    setColors({ accent, button, buttonSecondary, background, panel });
  }, [accent, background, button, buttonSecondary, panel, setColors]);

  const isActionFocused = (id: string) => navMode === "content" && sectionActions[actionIndex]?.id === id;

  const hints = React.useMemo<OverdriveHintItem[]>(() => {
    if (navMode === "sections") return [
      { id: "prev", label: "Prev", keyLabel: "Up", controllerButton: "lb", onActivate: () => shiftSection(-1) },
      { id: "next", label: "Next", keyLabel: "Down", controllerButton: "rb", onActivate: () => shiftSection(1) },
      { id: "enter", label: "Enter Section", keyLabel: "Right", controllerButton: "a", onActivate: enterContent },
      { id: "back", label: "Back", keyLabel: "Esc", controllerButton: "b", onActivate: onBack },
    ];
    return [
      { id: "prev", label: "Prev Item", keyLabel: "Up", controllerButton: "lb", onActivate: () => moveAction(-1) },
      { id: "next", label: "Next Item", keyLabel: "Down", controllerButton: "rb", onActivate: () => moveAction(1) },
      { id: "activate", label: "Activate", keyLabel: "Enter", controllerButton: "a", onActivate: activateAction },
      { id: "exit", label: "Section List", keyLabel: "Left", onActivate: exitContent },
    ];
  }, [activateAction, enterContent, exitContent, moveAction, navMode, onBack, shiftSection]);

  React.useEffect(() => { onHintsChange?.(hints); }, [hints, onHintsChange]);

  return (
    <div className="relative h-screen w-full overflow-hidden bg-gray-950 text-white">
      <div className="grid h-full grid-cols-[280px_1fr] gap-0 pb-14 pt-12">
        <div className="border-r border-t bg-gray-900/45 p-0 backdrop-blur-xl">
          <div className="space-y-0">
            {SECTION_META.map((m) => (
              <button
                key={m.id}
                type="button"
                data-settings-section={m.id}
                onClick={() => changeSection(m.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-5 py-4 text-left transition-all",
                  section === m.id ? "border-[var(--theme-accent)] border bg-white/15 text-white" : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10",
                  navMode === "sections" && section === m.id && "ring-2 ring-[var(--theme-accent)]",
                )}
              >
                {m.icon}
                <span className="text-sm">{m.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto border-t bg-gray-900/25 p-5 pb-24 backdrop-blur-xl">
          {section === "updates" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Updates</h2>
              <p className="text-sm text-white/65">Check for launcher updates and install new releases.</p>
              <div className="flex gap-3">
                <button type="button" onClick={() => void checkForUpdates()} disabled={checkingUpdate} data-settings-action="updates-check"
                  className={cn("rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 disabled:opacity-60", isActionFocused("updates-check") && "ring-2 ring-[var(--theme-accent)]")}>
                  {checkingUpdate ? "Checking..." : "Check for Updates"}
                </button>
                <button type="button" onClick={() => void installUpdate()} disabled={installingUpdate || !updateInfo?.available} data-settings-action="updates-install"
                  className={cn("rounded-full border border-[#107c10]/60 bg-[#107c10]/20 px-4 py-2 text-sm text-[#9cf39c] hover:bg-[#107c10]/35 disabled:opacity-60", isActionFocused("updates-install") && "ring-2 ring-[var(--theme-accent)]")}>
                  {installingUpdate ? "Installing..." : "Install Update"}
                </button>
              </div>
              {updateInfo && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
                  <p>Current: {updateInfo.current_version}</p>
                  <p>Latest: {updateInfo.version || "n/a"}</p>
                  {updateInfo.notes && <p className="mt-2 text-white/70">{updateInfo.notes}</p>}
                </div>
              )}
              {updateMessage && <p className="text-sm text-white/75">{updateMessage}</p>}
            </div>
          )}

          {section === "storage" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Storage</h2>
              <p className="text-sm text-white/65">View mounted drives and free space.</p>
              {loadingDrives ? <p className="text-sm text-white/60">Loading drives...</p> : drives.length > 0 ? (
                <div className="space-y-3">
                  {drives.map((d, i) => {
                    const used = Math.max(d.total_bytes - d.available_bytes, 0);
                    const pct = d.total_bytes > 0 ? Math.round((used / d.total_bytes) * 100) : 0;
                    return (
                      <div key={`${d.mount_point}-${i}`} className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-sm font-medium">{d.name || d.mount_point}</p>
                          <p className="text-xs text-white/60">{d.file_system || "Unknown FS"}</p>
                        </div>
                        <p className="text-xs text-white/65">{d.mount_point}</p>
                        <div className="mt-3 h-2 overflow-hidden rounded bg-white/10">
                          <div className="h-full bg-[var(--theme-accent)]" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="mt-2 text-xs text-white/65">{bytesToGb(used)} used of {bytesToGb(d.total_bytes)} ({pct}%)</p>
                      </div>
                    );
                  })}
                </div>
              ) : <p className="text-sm text-white/60">No drives detected.</p>}
            </div>
          )}

          {section === "theme" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Theme</h2>
              <p className="text-sm text-white/65">Customize Overdrive colors.</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {[
                  { label: "Accent", value: accent, set: setAccent, actionId: "theme-accent-hex" },
                  { label: "Button", value: button, set: setButton, actionId: "theme-button-hex" },
                  { label: "Button Secondary", value: buttonSecondary, set: setButtonSecondary, actionId: "theme-button-secondary-hex" },
                  { label: "Background", value: background, set: setBackground, actionId: "theme-background-hex" },
                  { label: "Panel", value: panel, set: setPanel, actionId: "theme-panel-hex" },
                ].map((e) => (
                  <div key={e.label} className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <p className="mb-2 text-xs uppercase tracking-[0.15rem] text-white/65">{e.label}</p>
                    <div className="flex items-center gap-2">
                      <input type="color" value={e.value} onChange={(ev) => e.set(ev.target.value)} className="h-10 w-14 cursor-pointer rounded" />
                      <input value={e.value} onChange={(ev) => e.set(ev.target.value)} data-settings-action={e.actionId}
                        className={cn("w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm", isActionFocused(e.actionId) && "ring-2 ring-[var(--theme-accent)]")} />
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" onClick={applyTheme} data-settings-action="theme-apply"
                className={cn("rounded-full border border-[var(--theme-accent)]/60 bg-[var(--theme-accent)]/20 px-4 py-2 text-sm", isActionFocused("theme-apply") && "ring-2 ring-[var(--theme-accent)]")}>
                Apply Theme
              </button>
            </div>
          )}

          {section === "network" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Network</h2>
              <p className="text-sm text-white/65">Quick status and system network settings.</p>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                {loadingNetwork ? <p className="text-sm text-white/65">Checking network...</p> : (
                  <div className="flex items-center gap-3">
                    <Wifi className={cn("h-5 w-5", network?.online ? "text-emerald-300" : "text-red-300")} />
                    <p>{network?.label || "Unknown"}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" data-settings-action="network-open" onClick={() => void invoke("open_network_settings")}
                  className={cn("rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm hover:bg-white/10", isActionFocused("network-open") && "ring-2 ring-[var(--theme-accent)]")}>
                  Open Network Settings
                </button>
                <button type="button" data-settings-action="network-refresh" onClick={() => changeSection("network")}
                  className={cn("rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm hover:bg-white/10", isActionFocused("network-refresh") && "ring-2 ring-[var(--theme-accent)]")}>
                  Refresh
                </button>
              </div>
            </div>
          )}

          {section === "interface" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Interface</h2>
              <p className="text-sm text-white/65">Control Overdrive shell behaviors.</p>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Show battery indicator</p>
                    <p className="text-xs text-white/60">Battery % in top bar.</p>
                  </div>
                  <button type="button" onClick={() => setShowBatteryIndicator(!showBatteryIndicator)} data-settings-action="interface-battery-toggle"
                    className={cn("rounded-full border px-4 py-2 text-sm", showBatteryIndicator ? "border-[#107c10]/60 bg-[#107c10]/20 text-[#9cf39c]" : "border-white/20 bg-white/5 text-white/75",
                      isActionFocused("interface-battery-toggle") && "ring-2 ring-[var(--theme-accent)]")}>
                    {showBatteryIndicator ? "Enabled" : "Disabled"}
                  </button>
                </div>
              </div>
              <button type="button" onClick={onBack} data-settings-action="interface-return"
                className={cn("rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm hover:bg-white/10", isActionFocused("interface-return") && "ring-2 ring-[var(--theme-accent)]")}>
                Return to Overdrive
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default SettingsView;
