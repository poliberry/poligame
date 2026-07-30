import React from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAuthStore } from "@/stores/authStore";
import { useRunningGameStore } from "@/stores/runningGameStore";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Settings2,
  Square,
  Power,
  ChevronRight,
  X,
  Gamepad2,
  Home,
} from "lucide-react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
// @ts-ignore
import menuCloseSound from "@/public/sounds/menuClose.wav";
// @ts-ignore
import moveSound from "@/public/sounds/move.wav";

type OverlayTab = "chat" | "settings" | "options";

const TAB_ITEMS: Array<{ id: OverlayTab; label: string; icon: React.ReactNode }> = [
  { id: "chat", label: "Chat", icon: <MessageSquare className="h-5 w-5" /> },
  { id: "settings", label: "Settings", icon: <Settings2 className="h-5 w-5" /> },
  { id: "options", label: "Game Options", icon: <Gamepad2 className="h-5 w-5" /> },
];

const DEFAULT_TAB_INDEX = TAB_ITEMS.findIndex((t) => t.id === "options");

// ─── Chat panel ─────────────────────────────────────────────────────────────

const ChatPanel: React.FC = () => {
  const { user } = useAuthStore();
  const [message, setMessage] = React.useState("");
  const [selectedChat, setSelectedChat] = React.useState<string | null>(null);

  const chats = useQuery(
    api.messages.getUserChats,
    user?.userId ? { userId: user.userId as unknown as Id<"users"> } : "skip",
  );
  const chatMessages = useQuery(
    api.messages.getChatMessages,
    selectedChat ? { chatId: selectedChat as Id<"chats"> } : "skip",
  );
  const sendMessage = useMutation(api.messages.sendMessage);

  const handleSend = async () => {
    if (!user?.userId || !selectedChat || !message.trim()) return;
    try {
      await sendMessage({
        senderId: user.userId as unknown as Id<"users">,
        chatId: selectedChat as Id<"chats">,
        content: message,
        contentFormat: "markdown",
        images: [],
      });
      setMessage("");
    } catch (e) {
      console.error(e);
    }
  };

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-white/60 text-sm">Sign in to use chat.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-3">
      <div className="w-48 flex-shrink-0 overflow-y-auto space-y-1">
        <p className="text-xs uppercase tracking-[0.18rem] text-white/55 mb-2">Chats</p>
        {!chats ? (
          <p className="text-xs text-white/40">Loading...</p>
        ) : chats.length === 0 ? (
          <p className="text-xs text-white/40">No chats yet.</p>
        ) : (
          (chats as any[]).map((chat) => {
            const name = chat.type === "dm"
              ? chat.otherMembers?.[0]?.username || "Unknown"
              : chat.name || "Group";
            return (
              <button
                key={chat._id}
                type="button"
                onClick={() => setSelectedChat(chat._id)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-xl text-sm transition-colors",
                  selectedChat === chat._id
                    ? "bg-white/15 text-white"
                    : "text-white/70 hover:bg-white/10",
                )}
              >
                {name}
              </button>
            );
          })
        )}
      </div>

      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            <div className="flex-1 overflow-y-auto space-y-2 mb-2">
              {(chatMessages as any[] | undefined)?.map((msg) => (
                <div key={msg._id} className="text-sm">
                  <span className="font-semibold text-[#9cf39c] mr-2">{msg.senderUsername}</span>
                  <span className="text-white/80">{msg.content.replace(/<[^>]*>/g, "")}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSend(); } }}
                placeholder="Type a message..."
                className="flex-1 rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:ring-1 focus:ring-[#107c10]"
              />
              <button
                type="button"
                onClick={() => void handleSend()}
                className="px-4 py-2 rounded-xl bg-[#107c10]/30 border border-[#107c10]/50 text-[#9cf39c] text-sm hover:bg-[#107c10]/50"
              >
                Send
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/40 text-sm">Select a chat</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Settings panel ──────────────────────────────────────────────────────────

const SettingsPanel: React.FC = () => {
  const [volume, setVolume] = React.useState(80);
  const [brightness, setBrightness] = React.useState(100);

  return (
    <div className="space-y-5">
      <h3 className="text-base font-semibold">Quick Settings</h3>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm text-white/75">Volume</span>
            <span className="text-sm text-white/55">{volume}%</span>
          </div>
          <input
            type="range" min={0} max={100} value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full accent-[#107c10]"
          />
        </div>
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-sm text-white/75">Brightness</span>
            <span className="text-sm text-white/55">{brightness}%</span>
          </div>
          <input
            type="range" min={10} max={100} value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            className="w-full accent-[#107c10]"
          />
        </div>
      </div>
    </div>
  );
};

// ─── Game options panel ──────────────────────────────────────────────────────

interface GameOptionsPanelProps {
  focusedOptionIndex: number;
  setFocusedOptionIndex: (i: number) => void;
  onClose: () => void;
}

const GameOptionsPanel: React.FC<GameOptionsPanelProps> = ({
  focusedOptionIndex,
  setFocusedOptionIndex,
  onClose,
}) => {
  const { runningGameId, killGame } = useRunningGameStore();

  const options = React.useMemo(() => [
    {
      id: "return-overdrive",
      label: "Return to Overdrive",
      icon: <Home className="h-5 w-5" />,
      danger: false,
      onActivate: async () => {
        try { await invoke("focus_main_window"); } catch (e) { console.error(e); }
        onClose();
      },
    },
    {
      id: "quit-game",
      label: "Quit Game",
      icon: <Square className="h-5 w-5" />,
      danger: true,
      onActivate: async () => {
        if (runningGameId) {
          try { await killGame(runningGameId); } catch (e) { console.error(e); }
        }
        onClose();
      },
    },
    {
      id: "exit-poligame",
      label: "Exit PoliGame",
      icon: <Power className="h-5 w-5" />,
      danger: true,
      onActivate: async () => {
        try { await invoke("close_window"); } catch (e) { console.error(e); }
      },
    },
  ], [killGame, onClose, runningGameId]);

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => void opt.onActivate()}
          onMouseEnter={() => setFocusedOptionIndex(i)}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all",
            focusedOptionIndex === i
              ? opt.danger
                ? "bg-red-800/40 border border-red-500/60 text-red-300"
                : "bg-white/15 border border-white/25 text-white"
              : opt.danger
                ? "bg-red-900/20 border border-red-800/30 text-red-400/80 hover:bg-red-800/30"
                : "bg-white/5 border border-white/10 text-white/80 hover:bg-white/10",
          )}
        >
          {opt.icon}
          <span className="text-sm font-medium">{opt.label}</span>
          <ChevronRight className="ml-auto h-4 w-4 opacity-50" />
        </button>
      ))}
    </div>
  );
};

// ─── Main overlay page ───────────────────────────────────────────────────────

const OverdriveOverlayPage: React.FC = () => {
  const { user } = useAuthStore();
  const { runningGameId } = useRunningGameStore();

  const [activeTab, setActiveTab] = React.useState<OverlayTab>("options");
  const [tabFocusIndex, setTabFocusIndex] = React.useState(DEFAULT_TAB_INDEX);
  const [panelFocusRegion, setPanelFocusRegion] = React.useState<"tabs" | "content">("tabs");
  const [optionFocusIndex, setOptionFocusIndex] = React.useState(0);
  const [visible, setVisible] = React.useState(true);

  const moveAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const menuCloseAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const lastNavRef = React.useRef(0);
  const NAV_COOLDOWN = 130;

  // Make the entire window transparent — override the hardcoded body/root backgrounds.
  React.useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prev = {
      htmlBg: html.style.backgroundColor,
      bodyBg: body.style.backgroundColor,
      rootBg: root?.style.backgroundColor ?? "",
    };
    html.style.backgroundColor = "transparent";
    body.style.backgroundColor = "transparent";
    if (root) root.style.backgroundColor = "transparent";
    return () => {
      html.style.backgroundColor = prev.htmlBg;
      body.style.backgroundColor = prev.bodyBg;
      if (root) root.style.backgroundColor = prev.rootBg;
    };
  }, []);

  // Pre-load sounds.
  React.useEffect(() => {
    const m = new Audio(moveSound);
    m.preload = "auto";
    m.volume = 0.35;
    moveAudioRef.current = m;
    const mc = new Audio(menuCloseSound);
    mc.preload = "auto";
    mc.volume = 0.35;
    menuCloseAudioRef.current = mc;
    return () => {
      m.pause();
      mc.pause();
      moveAudioRef.current = null;
      menuCloseAudioRef.current = null;
    };
  }, []);

  // When the Tauri window is shown again after being hidden, the document
  // fires a visibilitychange event (visible) or the window fires focus.
  // Reset all state so the overlay starts fresh every time it's opened.
  React.useEffect(() => {
    const resetForShow = () => {
      setVisible(true);
      setActiveTab("options");
      setTabFocusIndex(DEFAULT_TAB_INDEX);
      setPanelFocusRegion("tabs");
      setOptionFocusIndex(0);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") resetForShow();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", resetForShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", resetForShow);
    };
  }, []);

  const playMove = React.useCallback(() => {
    const a = moveAudioRef.current;
    if (!a) return;
    a.currentTime = 0;
    void a.play().catch(() => {});
  }, []);

  const closeOverlay = React.useCallback(async () => {
    const a = menuCloseAudioRef.current;
    if (a) { a.currentTime = 0; void a.play().catch(() => {}); }
    setVisible(false);
    // Wait for exit animation before actually hiding the window.
    setTimeout(async () => {
      try { await invoke("hide_overdrive_overlay"); } catch (e) { console.error(e); }
    }, 200);
  }, []);

  useResponsiveGamepad({
    onButtonDown: (button) => {
      const now = Date.now();
      if (now - lastNavRef.current < NAV_COOLDOWN) return;

      if (button === "B") { lastNavRef.current = now; void closeOverlay(); return; }

      if (panelFocusRegion === "tabs") {
        if (button === "UP") {
          lastNavRef.current = now;
          setTabFocusIndex((p) => { const n = Math.max(0, p - 1); if (n !== p) { playMove(); setActiveTab(TAB_ITEMS[n]!.id); } return n; });
          return;
        }
        if (button === "DOWN") {
          lastNavRef.current = now;
          setTabFocusIndex((p) => { const n = Math.min(TAB_ITEMS.length - 1, p + 1); if (n !== p) { playMove(); setActiveTab(TAB_ITEMS[n]!.id); } return n; });
          return;
        }
        if (button === "RIGHT" || button === "A") {
          lastNavRef.current = now;
          setPanelFocusRegion("content");
          setOptionFocusIndex(0);
          playMove();
          return;
        }
      } else {
        if (button === "LEFT") { lastNavRef.current = now; setPanelFocusRegion("tabs"); playMove(); return; }
        if (activeTab === "options") {
          if (button === "UP") { lastNavRef.current = now; setOptionFocusIndex((p) => { const n = Math.max(0, p - 1); if (n !== p) playMove(); return n; }); return; }
          if (button === "DOWN") { lastNavRef.current = now; setOptionFocusIndex((p) => { const n = Math.min(2, p + 1); if (n !== p) playMove(); return n; }); return; }
          if (button === "A") {
            lastNavRef.current = now;
            // Let the focused button's click handler fire — just focus it in DOM.
            return;
          }
        }
      }
    },
    onDPad: (dir) => {
      const now = Date.now();
      if (now - lastNavRef.current < NAV_COOLDOWN) return;
      lastNavRef.current = now;

      if (panelFocusRegion === "tabs") {
        if (dir === "UP") setTabFocusIndex((p) => { const n = Math.max(0, p - 1); if (n !== p) { playMove(); setActiveTab(TAB_ITEMS[n]!.id); } return n; });
        else if (dir === "DOWN") setTabFocusIndex((p) => { const n = Math.min(TAB_ITEMS.length - 1, p + 1); if (n !== p) { playMove(); setActiveTab(TAB_ITEMS[n]!.id); } return n; });
        else if (dir === "RIGHT") { setPanelFocusRegion("content"); setOptionFocusIndex(0); playMove(); }
      } else {
        if (dir === "LEFT") { setPanelFocusRegion("tabs"); playMove(); }
        else if (dir === "UP" && activeTab === "options") setOptionFocusIndex((p) => { const n = Math.max(0, p - 1); if (n !== p) playMove(); return n; });
        else if (dir === "DOWN" && activeTab === "options") setOptionFocusIndex((p) => { const n = Math.min(2, p + 1); if (n !== p) playMove(); return n; });
      }
    },
  });

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); void closeOverlay(); return; }
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (panelFocusRegion === "tabs") {
        if (e.key === "ArrowUp") { e.preventDefault(); setTabFocusIndex((p) => { const n = Math.max(0, p - 1); if (n !== p) { playMove(); setActiveTab(TAB_ITEMS[n]!.id); } return n; }); }
        else if (e.key === "ArrowDown") { e.preventDefault(); setTabFocusIndex((p) => { const n = Math.min(TAB_ITEMS.length - 1, p + 1); if (n !== p) { playMove(); setActiveTab(TAB_ITEMS[n]!.id); } return n; }); }
        else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); setPanelFocusRegion("content"); setOptionFocusIndex(0); playMove(); }
      } else {
        if (e.key === "ArrowLeft") { e.preventDefault(); setPanelFocusRegion("tabs"); playMove(); }
        else if (e.key === "ArrowUp" && activeTab === "options") { e.preventDefault(); setOptionFocusIndex((p) => { const n = Math.max(0, p - 1); if (n !== p) playMove(); return n; }); }
        else if (e.key === "ArrowDown" && activeTab === "options") { e.preventDefault(); setOptionFocusIndex((p) => { const n = Math.min(2, p + 1); if (n !== p) playMove(); return n; }); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTab, closeOverlay, panelFocusRegion, playMove]);

  const [time, setTime] = React.useState(() => new Date());
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      {/* Force transparent backgrounds — overrides index.html inline styles */}
      <style>{`html, body, #root { background: transparent !important; }`}</style>

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Livvic:wght@400;600;700&family=Unbounded:wght@200..900&display=swap" rel="stylesheet" />

      <AnimatePresence>
        {visible && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ fontFamily: "Livvic, sans-serif" }}
          >
            {/* Subtle darkening scrim — transparent window shows the game behind */}
            <div
              className="absolute inset-0"
              style={{ background: "rgba(0,0,0,0.45)" }}
              onClick={() => void closeOverlay()}
            />

            {/* Panel */}
            <motion.div
              className="relative z-10 w-[820px] max-w-[95vw] h-[520px] max-h-[90vh] rounded-3xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
              style={{ background: "rgba(15, 17, 23, 0.88)", backdropFilter: "blur(24px)" }}
              initial={{ scale: 0.95, y: 16 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
                <div>
                  <p className="text-xl font-bold" style={{ fontFamily: "Unbounded, sans-serif" }}>
                    {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  <p className="text-xs text-white/50">
                    {time.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                </div>
                {runningGameId && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#107c10]/20 border border-[#107c10]/40">
                    <div className="w-2 h-2 rounded-full bg-[#9cf39c] animate-pulse" />
                    <span className="text-xs text-[#9cf39c]">Game running</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  {user?.avatar && <img src={user.avatar} alt="avatar" className="w-8 h-8 rounded-full" />}
                  <span className="text-sm text-white/70">{user?.username}</span>
                  <button
                    type="button"
                    onClick={() => void closeOverlay()}
                    className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex flex-1 overflow-hidden">
                {/* Tab nav */}
                <div className="w-52 flex-shrink-0 border-r border-white/10 p-3 space-y-1">
                  {TAB_ITEMS.map((tab, i) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => { setActiveTab(tab.id); setTabFocusIndex(i); setPanelFocusRegion("tabs"); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all",
                        activeTab === tab.id ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white",
                        panelFocusRegion === "tabs" && tabFocusIndex === i
                          ? "ring-2 ring-[#107c10] ring-offset-1 ring-offset-transparent"
                          : "",
                      )}
                    >
                      {tab.icon}
                      <span className="text-sm font-medium">{tab.label}</span>
                    </button>
                  ))}

                  <div className="pt-3 border-t border-white/10 mt-3">
                    <p className="text-xs text-white/35 px-2 mb-1">Controls</p>
                    <div className="space-y-1 text-xs text-white/45 px-2">
                      <div className="flex items-center gap-2"><kbd className="bg-white/10 rounded px-1">B / Esc</kbd><span>Close</span></div>
                      <div className="flex items-center gap-2"><kbd className="bg-white/10 rounded px-1">↑↓</kbd><span>Switch tabs</span></div>
                      <div className="flex items-center gap-2"><kbd className="bg-white/10 rounded px-1">→ / A</kbd><span>Enter panel</span></div>
                      <div className="flex items-center gap-2"><kbd className="bg-white/10 rounded px-1">←</kbd><span>Back to tabs</span></div>
                    </div>
                  </div>
                </div>

                {/* Content area */}
                <div className="flex-1 p-5 overflow-y-auto">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.14 }}
                      className="h-full"
                    >
                      {activeTab === "chat" && <ChatPanel />}
                      {activeTab === "settings" && <SettingsPanel />}
                      {activeTab === "options" && (
                        <GameOptionsPanel
                          focusedOptionIndex={panelFocusRegion === "content" ? optionFocusIndex : -1}
                          setFocusedOptionIndex={(i) => { setOptionFocusIndex(i); setPanelFocusRegion("content"); }}
                          onClose={() => void closeOverlay()}
                        />
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-2 border-t border-white/10 flex items-center gap-4 text-xs text-white/40 flex-shrink-0">
                <span><kbd className="bg-white/10 rounded px-1 py-0.5 mr-1">B</kbd>Close</span>
                <span><kbd className="bg-white/10 rounded px-1 py-0.5 mr-1">↑↓</kbd>Navigate</span>
                <span><kbd className="bg-white/10 rounded px-1 py-0.5 mr-1">→ / A</kbd>Select</span>
                <span><kbd className="bg-white/10 rounded px-1 py-0.5 mr-1">←</kbd>Back to tabs</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default OverdriveOverlayPage;
