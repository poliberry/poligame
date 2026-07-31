import React, { useEffect } from "react";
import { MascotOverlay } from "@/components/MascotOverlay";
import { invoke } from "@tauri-apps/api/core";
import { useLocation } from "react-router-dom";
import LibraryView from "@/components/overdrive/LibraryView";
import GameDetailsView from "@/components/overdrive/GameDetailsView";
import SettingsView from "@/components/overdrive/SettingsView";
import { open } from "@tauri-apps/plugin-shell";
import { useAuthStore } from "@/stores/authStore";
import { Power, MessageSquare, Calendar, ClockIcon, Users, ChevronRight, TrendingUp, ArrowLeft, ArrowRight, Newspaper, Plus, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
// @ts-ignore
import logo from "@/public/poligame-logo.svg";
import { useGameStore } from "@/stores/gameStore";
import { useOverdriveStore } from "@/stores/overdriveStore";
import { Game } from "@/types";
import { LauncherType } from "@/types";
import ControllerButton from "@/components/overdrive/ControllerButton";
import ControllerIcon from "@/components/overdrive/ControllerIcon";
import OverdriveTopBar from "@/components/overdrive/OverdriveTopBar";
import OverdriveNavigationHints, { OverdriveHintItem } from "@/components/overdrive/OverdriveNavigationHints";
import { useControllerStore, detectControllerType } from "@/stores/controllerStore";
import { motion, AnimatePresence, useMotionValue, animate } from "framer-motion";
import { useResponsiveGamepad } from "@/hooks/useResponsiveGamepad";
// @ts-ignore
import connectionSound from "@/public/sounds/launch.wav";
// @ts-ignore
import disconnectSound from "@/public/sounds/launchNo.wav";
// @ts-ignore
import navigateSound from "@/public/sounds/move.wav";
// @ts-ignore
import dialogOpenSound from "@/public/sounds/menuOpen.wav";
// @ts-ignore
import menuOpenSound from "@/public/sounds/menuOpen.wav";
// @ts-ignore
import menuCloseSound from "@/public/sounds/menuClose.wav";
// @ts-ignore
import sectionChangeSound from "@/public/sounds/pageOpen.wav";
// @ts-ignore
import pageCloseSound from "@/public/sounds/pageClose.wav";
// @ts-ignore
import errMoveSound from "@/public/sounds/errMove.wav";
// @ts-ignore
import videoUrl from "@/public/video/overdrive-intro.mp4";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { getImageUrl } from "@/utils/imageUtils";
import { useGameWithCustomizations } from "@/hooks/useGameWithCustomizations";
import { useRunningGameStore } from "@/stores/runningGameStore";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Trophy } from "lucide-react";
import Marketplace from "./Marketplace";
import Community from "./Community";
import { cn } from "@/lib/utils";
import { useOverdriveKeyboardStore } from "@/stores/overdriveKeyboardStore";

interface OverdriveForumPost {
  _id: Id<"forumPosts">;
  title: string;
  authorUsername?: string;
  commentCount?: number;
  likes?: Id<"users">[];
  createdAt: number;
  isPinned?: boolean;
}

interface SteamNewsItem {
  gid: string;
  title: string;
  url?: string;
  author?: string;
  contents?: string;
  date?: number;
  feedLabel?: string;
  appId?: string;
}

// GameItem component
interface GameItemProps {
  game: Game;
  index: number;
  isFocused: boolean;
  isHero?: boolean;
  playtimeMinutes?: number;
  onFocus: () => void;
  onLaunch: () => void;
  onOpenDetails: () => void;
  gameItemRefs: React.MutableRefObject<Map<number, HTMLDivElement>>;
}

const GameItem: React.FC<GameItemProps> = ({
  game,
  index,
  isFocused,
  isHero = false,
  playtimeMinutes = 0,
  onFocus,
  onLaunch,
  onOpenDetails,
  gameItemRefs,
}) => {
  // Get game with customizations applied
  const displayGame = useGameWithCustomizations(game) || game;
  const coverArt = isHero
    ? getImageUrl(displayGame.headerArt || displayGame.coverArt || displayGame.gridCoverArt) || ""
    : getImageUrl(displayGame.gridCoverArt || displayGame.coverArt) || "";
  const itemRef = React.useRef<HTMLDivElement>(null);
  const tileWidth = isHero ? 600 : 200;
  const tileHeight = 300;
  const tileBackgroundPosition = isHero ? "center center" : "top center";
  const [isHovered, setIsHovered] = React.useState(false);
  const isActive = isFocused || isHovered;

  const playtimeLabel = React.useMemo(() => {
    if (!playtimeMinutes || playtimeMinutes <= 0) {
      return "No playtime yet";
    }

    return `${Math.round(playtimeMinutes)} minutes played`;
  }, [playtimeMinutes]);

  // Sync refs
  React.useEffect(() => {
    if (itemRef.current) {
      gameItemRefs.current.set(index, itemRef.current);
    }
  }, [index, gameItemRefs]);

  return (
    <motion.div
      key={game.id}
      ref={itemRef}
      tabIndex={0}
      initial={false}
      animate={{
        width: tileWidth,
        height: tileHeight,
        scale: isActive ? 1 : 0.98,
        opacity: isActive ? 1 : 0.92,
      }}
      transition={{
        duration: 0.35,
        ease: [0.4, 0, 0.2, 1],
      }}
      className="relative cursor-pointer shrink-0"
      style={{
        outline: "none",
        zIndex: isFocused ? 20 : 10,
      }}
      onClick={() => {
        onFocus();
      }}
      onDoubleClick={() => onOpenDetails()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Game tile */}
      <motion.div
        className={`relative w-full h-full overflow-hidden shadow-2xl ${isActive
          ? "ring-4 ring-[var(--theme-accent)] shadow-[var(--theme-accent)]/50"
          : "ring-2 ring-white/20"
          }`}
      >
        {coverArt ? (
          <img
            src={coverArt}
            alt={displayGame.title}
            className="absolute inset-0 w-full h-full object-cover"
            style={{ objectPosition: tileBackgroundPosition }}
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: "var(--background)",
            }}
          />
        )}
        <div className={`absolute inset-0 ${isActive ? "bg-black/15" : "bg-black/30"}`} />
      </motion.div>

      <AnimatePresence>
        {isActive && (
          <motion.div
            key={`card-label-${game.id}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="absolute left-0 top-full mt-3 px-1 text-left"
          >
            <p className="max-w-full text-sm font-semibold text-white">
              {displayGame.title}
            </p>
            <p className="text-xs text-white/70 tabular-nums">{playtimeLabel}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Focus indicator - Xbox style glow */}
      {isFocused && (
        <div
          className={cn("absolute -inset-2 rounded-lg pointer-events-none", isActive ? "animate-pulse" : "")}
          style={{
            background: `url(${getImageUrl(displayGame.headerArt || displayGame.coverArt || displayGame.gridCoverArt)}) center center / cover no-repeat`,
            filter: "blur(32px)",
            zIndex: -1,
          }}
        />
      )}
    </motion.div>
  );
};

const Overdrive: React.FC = () => {
  const { user } = useAuthStore();
  const {
    selectedGame,
    setSelectedGame,
    setSelectedIndex,
    isMenuOpen,
    isPowerDialogOpen,
    isTopBarFocused,
    setTopBarFocused,
    setMenuOpen,
    viewStack,
    pushView,
    popView,
  } = useOverdriveStore();

  const currentView = viewStack[viewStack.length - 1] ?? { type: "home" as const };
  const [subViewHints, setSubViewHints] = React.useState<OverdriveHintItem[]>([]);
  const {
    isOpen: isKeyboardOpen,
    openKeyboard,
    closeKeyboard,
  } = useOverdriveKeyboardStore();
  const { games, setGames, setLoading } = useGameStore();
  const {
    runningGameId,
    killGame,
    startPolling,
    setKnownGames,
    startRealtimeMonitoring,
    stopRealtimeMonitoring,
    syncCurrentGame,
  } = useRunningGameStore();
  const location = useLocation();

  // Get selected game with customizations
  const displaySelectedGame = useGameWithCustomizations(selectedGame);

  // Get playtime and achievements data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const playtimeApi = api as any;
  const userPlaytime = useQuery(
    playtimeApi.playtime.getUserPlaytime,
    user?.userId
      ? {
        userId: user.userId as Id<"users">,
      }
      : "skip",
  );

  const playtimeByGameId = React.useMemo(() => {
    const playtimeByGameId = new Map<string, number>();
    (userPlaytime || []).forEach((record: any) => {
      playtimeByGameId.set(record.gameId, record.totalPlaytime || 0);
    });

    return playtimeByGameId;
  }, [userPlaytime]);

  const sortedGames = React.useMemo(() => {
    if (!games.length) {
      return games;
    }

    return [...games].sort((a, b) => {
      const aPlaytime = playtimeByGameId.get(a.id) || 0;
      const bPlaytime = playtimeByGameId.get(b.id) || 0;
      return bPlaytime - aPlaytime;
    });
  }, [games, playtimeByGameId]);

  const isSelectedGameRunning =
    selectedGame != null && runningGameId === selectedGame.id;

  const playtimeData = useQuery(
    playtimeApi.playtime.getGamePlaytime,
    selectedGame && user?.userId
      ? {
        userId: user.userId as Id<"users">,
        gameId: selectedGame.id,
      }
      : "skip"
  );

  // Get achievements (if Steam game)
  const [achievements, setAchievements] = React.useState<any[]>([]);
  const forumPosts = useQuery(
    api.forum.getPostsForGame,
    selectedGame?.id ? { gameId: selectedGame.id } : "skip",
  ) as OverdriveForumPost[] | undefined;
  const createForumPost = useMutation(api.forum.createPost);
  const [steamNews, setSteamNews] = React.useState<SteamNewsItem[]>([]);
  const [loadingSteamNews, setLoadingSteamNews] = React.useState(false);
  const [isComposerOpen, setIsComposerOpen] = React.useState(false);
  const [isSubmittingPost, setIsSubmittingPost] = React.useState(false);
  const [composerTitle, setComposerTitle] = React.useState("");
  const [composerContent, setComposerContent] = React.useState("");
  const [composerField, setComposerField] = React.useState<"title" | "content">("title");

  // ======== MOVE ALL STATE DECLARATIONS HERE, BEFORE ANY HOOKS THAT USE THEM ========

  // Background and UI states
  const [backgroundLayers, setBackgroundLayers] = React.useState<
    Array<{ id: number; src: string }>
  >(() => {
    const initial = getImageUrl(
      displaySelectedGame?.headerArt ||
      displaySelectedGame?.gridCoverArt ||
      displaySelectedGame?.coverArt,
    );
    return initial ? [{ id: 0, src: initial }] : [];
  });

  const [activeSection, setActiveSection] = React.useState<"library" | "store" | "community">("library");
  const [videoEnded, setVideoEnded] = React.useState(() => {
    const skipFromRouteState = Boolean((location.state as { skipOverdriveIntro?: boolean } | null)?.skipOverdriveIntro);
    const introAlreadySeen = sessionStorage.getItem("overdriveIntroSeen") === "1";
    return skipFromRouteState || introAlreadySeen;
  });

  // Library states
  const [libraryFocusIndex, setLibraryFocusIndex] = React.useState(0);
  const [isNavigationFocusActive, setIsNavigationFocusActive] = React.useState(true);

  // TAB NAVIGATION STATES - MUST BE DECLARED BEFORE useResponsiveGamepad
  const [isFullView, setIsFullView] = React.useState(false);
  const [navigationMode, setNavigationMode] = React.useState<'library' | 'tabs' | 'tabContent'>('library');
  const [activeTab, setActiveTab] = React.useState<'achievements' | 'timeline' | 'community'>('achievements');
  const [tabContentIndex, setTabContentIndex] = React.useState(0);
  const [isTabSectionFocused, setIsTabSectionFocused] = React.useState(false);

  // Refs
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const gameItemRefs = React.useRef<Map<number, HTMLDivElement>>(new Map());
  const tabContentRefs = React.useRef<Map<number, HTMLElement>>(new Map());
  const fullViewScrollRef = React.useRef<HTMLDivElement>(null);
  const scrollX = useMotionValue(0);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const backgroundTransitionRef = React.useRef(0);
  const lastNavigationTime = React.useRef<number>(0);
  const navigationCooldown = 150;
  const lastStickDirection = React.useRef<"left" | "right" | null>(null);
  const stickHoldStartTime = React.useRef<number>(0);
  const previousControllerConnectedRef = React.useRef<boolean>(false);
  const previousTopBarFocusedRef = React.useRef<boolean>(isTopBarFocused);
  const suppressMenuUntilRef = React.useRef<number>(0);
  const tabCooldownRef = React.useRef<number>(0);
  const handledRouteSoundKeyRef = React.useRef<string | null>(null);

  // Audio refs
  const navigateAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const dialogOpenAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const menuOpenAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const menuCloseAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const sectionChangeAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const errMoveAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const pageCloseAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const prevViewStackLengthRef = React.useRef(1);
  const [isUiAudioReady, setIsUiAudioReady] = React.useState(false);

  const { controllerType, isConnected, setControllerType, setIsConnected } = useControllerStore();

  // ======== END STATE DECLARATIONS ========

  // Fetch achievements effect
  React.useEffect(() => {
    const fetchAchievements = async () => {
      if (selectedGame?.launcher === "steam" && selectedGame.id) {
        try {
          let steamAchievements = await invoke<any[]>("get_game_achievements", {
            gameId: selectedGame.id,
          });

          // Fall back to direct Steam fetch when DB cache is empty.
          if (
            steamAchievements.length === 0 &&
            selectedGame.metadata?.appId &&
            user?.steamUserId
          ) {
            steamAchievements = await invoke<any[]>("fetch_steam_achievements_no_db", {
              gameId: selectedGame.id,
              steamUserId: user.steamUserId,
              steamAppId: selectedGame.metadata.appId,
            });
          }

          setAchievements(steamAchievements || []);
        } catch (error) {
          console.error("Failed to fetch achievements:", error);
          setAchievements([]);
        }
      } else {
        setAchievements([]);
      }
    };
    fetchAchievements();
  }, [selectedGame?.id, selectedGame?.launcher, selectedGame?.metadata?.appId, user?.steamUserId]);

  React.useEffect(() => {
    const loadSteamNews = async () => {
      if (selectedGame?.launcher !== "steam" || !selectedGame.metadata?.appId) {
        setSteamNews([]);
        setLoadingSteamNews(false);
        return;
      }

      setLoadingSteamNews(true);
      try {
        const news = await invoke<SteamNewsItem[]>("fetch_steam_news", {
          appId: selectedGame.metadata.appId,
        });
        setSteamNews(news || []);
      } catch (error) {
        console.error("Failed to fetch Steam news:", error);
        setSteamNews([]);
      } finally {
        setLoadingSteamNews(false);
      }
    };

    void loadSteamNews();
  }, [selectedGame?.id, selectedGame?.launcher, selectedGame?.metadata?.appId]);

  const stripHtml = React.useCallback((html: string | undefined) => {
    if (!html) {
      return "";
    }

    return html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }, []);

  const openKeyboardForField = React.useCallback((field: "title" | "content") => {
    setComposerField(field);
    openKeyboard({
      title: field === "title" ? "Post Title" : "Post Content",
      initialValue: field === "title" ? composerTitle : composerContent,
      maxLength: field === "title" ? 120 : 2000,
      onCommit: (nextValue) => {
        if (field === "title") {
          setComposerTitle(nextValue);
          return;
        }
        setComposerContent(nextValue);
      },
    });
  }, [composerContent, composerTitle, openKeyboard]);

  const handleSubmitPost = React.useCallback(async () => {
    const trimmedTitle = composerTitle.trim();
    const trimmedContent = composerContent.trim();

    if (!selectedGame?.id || !user?.userId) {
      toast.error("Sign in required", {
        description: "You need to be signed in to create a post.",
      });
      return;
    }

    if (!trimmedTitle || !trimmedContent) {
      toast.error("Missing post details", {
        description: "Add both a title and content before posting.",
      });
      return;
    }

    setIsSubmittingPost(true);
    try {
      await createForumPost({
        gameId: selectedGame.id,
        authorId: user.userId as unknown as Id<"users">,
        title: trimmedTitle,
        content: trimmedContent,
        contentFormat: "markdown",
        images: [],
      });

      toast.success("Post created", {
        description: "Your discussion post is now live.",
      });
      setComposerTitle("");
      setComposerContent("");
      closeKeyboard(false);
      setIsComposerOpen(false);
    } catch (error) {
      console.error("Failed to create forum post:", error);
      toast.error("Failed to create post", {
        description: "Try again in a moment.",
      });
    } finally {
      setIsSubmittingPost(false);
    }
  }, [closeKeyboard, composerContent, composerTitle, createForumPost, selectedGame?.id, user?.userId]);

  // ... keep all your existing audio callback definitions (playNavigateSound, etc.) ...

  const playNavigateSound = React.useCallback(() => {
    const audio = navigateAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.debug("Failed to play navigation sound", error);
    });
  }, []);

  const playMenuOpenSound = React.useCallback(() => {
    const audio = menuOpenAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.debug("Failed to play menu open sound", error);
    });
  }, []);

  const playMenuCloseSound = React.useCallback(() => {
    const audio = menuCloseAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.debug("Failed to play menu close sound", error);
    });
  }, []);

  const playSectionChangeSound = React.useCallback(() => {
    const audio = sectionChangeAudioRef.current;
    if (!audio) return;
    audio.currentTime = 0;
    void audio.play().catch((error) => {
      console.debug("Failed to play section change sound", error);
    });
  }, []);

  // ... keep existing useEffect for audio initialization ...

  useEffect(() => {
    const navigationAudio = new Audio(navigateSound);
    navigationAudio.preload = "auto";
    navigationAudio.volume = 0.35;
    navigateAudioRef.current = navigationAudio;

    const dialogAudio = new Audio(dialogOpenSound);
    dialogAudio.preload = "auto";
    dialogAudio.volume = 0.35;
    dialogOpenAudioRef.current = dialogAudio;

    const menuOpenAudio = new Audio(menuOpenSound);
    menuOpenAudio.preload = "auto";
    menuOpenAudio.volume = 0.35;
    menuOpenAudioRef.current = menuOpenAudio;

    const menuCloseAudio = new Audio(menuCloseSound);
    menuCloseAudio.preload = "auto";
    menuCloseAudio.volume = 0.35;
    menuCloseAudioRef.current = menuCloseAudio;

    const sectionAudio = new Audio(sectionChangeSound);
    sectionAudio.preload = "auto";
    sectionAudio.volume = 0.35;
    sectionChangeAudioRef.current = sectionAudio;

    const errAudio = new Audio(errMoveSound);
    errAudio.preload = "auto";
    errAudio.volume = 0.35;
    errMoveAudioRef.current = errAudio;

    const pageCloseAudio = new Audio(pageCloseSound);
    pageCloseAudio.preload = "auto";
    pageCloseAudio.volume = 0.35;
    pageCloseAudioRef.current = pageCloseAudio;

    setIsUiAudioReady(true);

    return () => {
      navigationAudio.pause();
      dialogAudio.pause();
      menuOpenAudio.pause();
      menuCloseAudio.pause();
      sectionAudio.pause();
      errAudio.pause();
      pageCloseAudio.pause();
      navigateAudioRef.current = null;
      dialogOpenAudioRef.current = null;
      menuOpenAudioRef.current = null;
      menuCloseAudioRef.current = null;
      sectionChangeAudioRef.current = null;
      errMoveAudioRef.current = null;
      pageCloseAudioRef.current = null;
      setIsUiAudioReady(false);
    };
  }, []);

  // Play sounds when the internal view stack changes
  React.useEffect(() => {
    const prev = prevViewStackLengthRef.current;
    const curr = viewStack.length;
    if (curr > prev) {
      // Pushed a new view – page-open sound
      const a = sectionChangeAudioRef.current;
      if (a) { a.currentTime = 0; void a.play().catch(() => {}); }
    } else if (curr < prev) {
      // Popped back – page-close sound
      const a = pageCloseAudioRef.current;
      if (a) { a.currentTime = 0; void a.play().catch(() => {}); }
    }
    prevViewStackLengthRef.current = curr;
  }, [viewStack]);

  // ... keep existing handlers (toggleDrawerWithSound, etc.) ...

  const toggleDrawerWithSound = React.useCallback(() => {
    if (Date.now() < suppressMenuUntilRef.current) return;
    if (isMenuOpen) {
      playMenuCloseSound();
      setMenuOpen(false);
    } else {
      playMenuOpenSound();
      setMenuOpen(true);
    }
  }, [isMenuOpen, playMenuCloseSound, playMenuOpenSound, setMenuOpen]);

  const openDrawerWithSound = React.useCallback(() => {
    if (Date.now() < suppressMenuUntilRef.current) return;
    if (!isMenuOpen) playMenuOpenSound();
    setMenuOpen(true);
  }, [isMenuOpen, playMenuOpenSound, setMenuOpen]);

  const closeDrawerWithSound = React.useCallback(() => {
    if (isMenuOpen) playMenuCloseSound();
    setMenuOpen(false);
  }, [isMenuOpen, playMenuCloseSound, setMenuOpen]);

  // ... keep existing useEffects for popstate, initialization, etc. ...

  useEffect(() => {
    let isHandlingPopState = false;
    const handlePopState = () => {
      if (isHandlingPopState) return;
      if (window.location.pathname !== '/overdrive') {
        isHandlingPopState = true;
        window.history.pushState(null, '', '/overdrive');
        setTimeout(() => { isHandlingPopState = false; }, 0);
      }
    };
    if (window.location.pathname !== '/overdrive') {
      window.history.pushState(null, '', '/overdrive');
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  React.useEffect(() => {
    if (sortedGames.length > 0 && libraryFocusIndex === 0) {
      const game = sortedGames[0];
      if (game) {
        setSelectedGame(game);
        setSelectedIndex(0);
      }
    }
  }, [sortedGames, libraryFocusIndex, setSelectedGame, setSelectedIndex]);

  React.useEffect(() => {
    const wasTopBarFocused = previousTopBarFocusedRef.current;
    const exitedTopBarToLibrary =
      wasTopBarFocused &&
      !isTopBarFocused &&
      !isFullView &&
      navigationMode === "library" &&
      activeSection === "library";

    if (exitedTopBarToLibrary && sortedGames.length > 0) {
      setIsNavigationFocusActive(true);
      setLibraryFocusIndex(0);
      const firstGame = sortedGames[0];
      if (firstGame) {
        setSelectedGame(firstGame);
        setSelectedIndex(0);
      }
    }

    previousTopBarFocusedRef.current = isTopBarFocused;
  }, [
    activeSection,
    isFullView,
    isTopBarFocused,
    navigationMode,
    setSelectedGame,
    setSelectedIndex,
    sortedGames,
  ]);

  React.useEffect(() => {
    const game = sortedGames[libraryFocusIndex];
    if (game) {
      setSelectedGame(game);
      setSelectedIndex(libraryFocusIndex);
    }
  }, [libraryFocusIndex, sortedGames, setSelectedGame, setSelectedIndex]);

  const loadGames = async () => {
    setLoading(true);
    try {
      const gameList = await invoke<Game[]>("get_all_games");
      const normalizedGames = gameList.map((game) => ({
        ...game,
        launcher: game.launcher.toLowerCase() as LauncherType,
      }));
      setGames(normalizedGames);
    } catch (error) {
      console.error("Error loading games:", error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    setKnownGames(sortedGames);
  }, [sortedGames, setKnownGames]);

  React.useEffect(() => {
    startRealtimeMonitoring();
    void syncCurrentGame();
    return () => { stopRealtimeMonitoring(); };
  }, [startRealtimeMonitoring, stopRealtimeMonitoring, syncCurrentGame]);

  // ... keep existing controller connection handling ...

  useEffect(() => {
    const gamepads = navigator.getGamepads();
    const connectedGamepad = Array.from(gamepads).find((gp) => gp !== null);
    previousControllerConnectedRef.current = connectedGamepad !== null;
    if (connectedGamepad) {
      setIsConnected(true);
      setControllerType(detectControllerType(connectedGamepad));
    } else {
      setIsConnected(false);
      setControllerType(null);
    }

    const handleControllerConnect = (e: GamepadEvent) => {
      const gamepad = e.gamepad;
      if (gamepad) {
        const playConnectionSound = new Audio(connectionSound);
        playConnectionSound.volume = 0.5;
        playConnectionSound.play();
        toast.success("Controller connected", {
          description: `Controller connected: ${gamepad.id}`,
          duration: 3000,
          position: "bottom-center",
        });
        previousControllerConnectedRef.current = true;
        setIsConnected(true);
        setControllerType(detectControllerType(gamepad));
      }
    };

    const handleControllerDisconnect = (e: GamepadEvent) => {
      const gamepad = e.gamepad;
      const gamepadId = gamepad?.id || "Unknown Controller";
      const currentGamepads = navigator.getGamepads();
      const stillConnected = Array.from(currentGamepads).some((gp) => gp !== null);
      if (previousControllerConnectedRef.current || !stillConnected) {
        const playDisconnectSound = new Audio(disconnectSound);
        playDisconnectSound.volume = 0.5;
        playDisconnectSound.play();
        toast.error("Controller disconnected", {
          description: `Controller disconnected: ${gamepadId}`,
          duration: 3000,
          position: "bottom-center",
        });
        previousControllerConnectedRef.current = false;
        setIsConnected(false);
        setControllerType(null);
      }
    };

    let lastGamepadCount = Array.from(navigator.getGamepads()).filter((gp) => gp !== null).length;
    const pollInterval = setInterval(() => {
      const currentGamepads = navigator.getGamepads();
      const currentGamepadCount = Array.from(currentGamepads).filter((gp) => gp !== null).length;
      if (lastGamepadCount > 0 && currentGamepadCount === 0 && previousControllerConnectedRef.current) {
        const playDisconnectSound = new Audio(disconnectSound);
        playDisconnectSound.volume = 0.5;
        playDisconnectSound.play();
        toast.error("Controller disconnected", {
          description: "Controller disconnected",
          duration: 3000,
          position: "bottom-center",
        });
        previousControllerConnectedRef.current = false;
        setIsConnected(false);
        setControllerType(null);
      }
      if (currentGamepadCount > 0) {
        previousControllerConnectedRef.current = true;
        const firstGamepad = Array.from(currentGamepads).find((gp) => gp !== null);
        if (firstGamepad) {
          setIsConnected(true);
          setControllerType(detectControllerType(firstGamepad));
        }
      } else if (currentGamepadCount === 0 && lastGamepadCount > 0) {
        setIsConnected(false);
        setControllerType(null);
      }
      lastGamepadCount = currentGamepadCount;
    }, 1000);

    window.addEventListener("gamepadconnected", handleControllerConnect);
    window.addEventListener("gamepaddisconnected", handleControllerDisconnect);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("gamepadconnected", handleControllerConnect);
      window.removeEventListener("gamepaddisconnected", handleControllerDisconnect);
    };
  }, []);

  useEffect(() => {
    loadGames();
    const gamesInterval = setInterval(() => {
      loadGames();
    }, 15 * 60 * 1000);
    return () => clearInterval(gamesInterval);
  }, []);

  // ... keep existing background effect ...

  useEffect(() => {
    const targetImage = getImageUrl(
      displaySelectedGame?.headerArt ||
      displaySelectedGame?.gridCoverArt ||
      displaySelectedGame?.coverArt,
    );

    if (!targetImage) {
      setBackgroundLayers([]);
      return;
    }

    const transitionId = backgroundTransitionRef.current + 1;
    backgroundTransitionRef.current = transitionId;

    const image = new Image();
    image.onload = () => {
      if (backgroundTransitionRef.current !== transitionId) return;
      setBackgroundLayers((previousLayers) => {
        const latestLayer = previousLayers[previousLayers.length - 1];
        if (latestLayer?.src === targetImage) return previousLayers;
        return [...previousLayers, { id: transitionId, src: targetImage }].slice(-2);
      });
    };

    image.onerror = () => {
      if (backgroundTransitionRef.current !== transitionId) return;
      setBackgroundLayers((previousLayers) => {
        const latestLayer = previousLayers[previousLayers.length - 1];
        if (latestLayer?.src === targetImage) return previousLayers;
        return [...previousLayers, { id: transitionId, src: targetImage }].slice(-2);
      });
    };

    image.src = targetImage;
  }, [
    selectedGame?.id,
    displaySelectedGame?.headerArt,
    displaySelectedGame?.gridCoverArt,
    displaySelectedGame?.coverArt,
  ]);

  // ... keep existing handlers ...

  const [searchQuery, setSearchQuery] = React.useState("");

  const handleOpenGameDetails = React.useCallback(
    (gameId: string) => {
      pushView({ type: "gameDetails", gameId });
    },
    [pushView],
  );

  const handleOverdriveSearchSubmit = React.useCallback(() => {
    const query = searchQuery.trim();
    pushView({ type: "library", searchQuery: query || undefined });
  }, [pushView, searchQuery]);

  React.useEffect(() => {
    if (videoEnded) {
      sessionStorage.setItem("overdriveIntroSeen", "1");
    }
  }, [videoEnded]);

  const overdriveHints = React.useMemo<OverdriveHintItem[]>(() => {
    if (isKeyboardOpen) {
      return [
        { id: "key-select", label: "Select Key", keyLabel: "Enter", controllerButton: "a" },
        { id: "key-close", label: "Close Keyboard", keyLabel: "Esc", controllerButton: "b", onActivate: () => closeKeyboard(true) },
        { id: "key-submit", label: "Submit", keyLabel: "X", controllerButton: "x" },
      ];
    }

    if (isComposerOpen) {
      return [
        { id: "composer-close", label: "Close Composer", keyLabel: "Esc", controllerButton: "b", onActivate: () => setIsComposerOpen(false) },
        { id: "composer-submit", label: "Post", keyLabel: "Enter", controllerButton: "a", onActivate: () => void handleSubmitPost() },
      ];
    }

    if (isFullView && navigationMode === "tabs") {
      return [
        { id: "tab-open", label: "Open Tab", keyLabel: "Enter", controllerButton: "a" },
        { id: "tab-switch", label: "Switch Tabs", keyLabel: "A/D", controllerButton: "lb" },
        { id: "tab-back", label: "Back", keyLabel: "Esc", controllerButton: "b", onActivate: () => setIsFullView(false) },
      ];
    }

    if (isFullView && navigationMode === "tabContent") {
      return [
        { id: "content-open", label: "Open Item", keyLabel: "Enter", controllerButton: "a" },
        { id: "content-nav", label: "Navigate", keyLabel: "Arrows", controllerButton: "lb" },
        { id: "content-back", label: "Back To Tabs", keyLabel: "Esc", controllerButton: "b", onActivate: () => setNavigationMode('tabs') },
      ];
    }

    return [
      { id: "menu", label: "Menu", keyLabel: "M", controllerButton: "menu", onActivate: toggleDrawerWithSound },
      { id: "open", label: "Open", keyLabel: "Enter", controllerButton: "a" },
      { id: "browse", label: "Browse Games", keyLabel: "Arrows", controllerButton: "lb" },
    ];
  }, [closeKeyboard, handleSubmitPost, isComposerOpen, isFullView, isKeyboardOpen, navigationMode, toggleDrawerWithSound]);

  const navigateLibrary = React.useCallback((direction: "next" | "prev") => {
    const now = Date.now();
    if (now - lastNavigationTime.current < navigationCooldown) return;
    if (sortedGames.length === 0) return;

    setIsNavigationFocusActive(true);
    playNavigateSound();
    lastNavigationTime.current = now;

    setLibraryFocusIndex((cur) => {
      const newIndex = direction === "next"
        ? (cur + 1) % sortedGames.length
        : (cur - 1 + sortedGames.length) % sortedGames.length;
      const game = sortedGames[newIndex];
      if (game) {
        setSelectedGame(game);
        setSelectedIndex(newIndex);
      }
      return newIndex;
    });
  }, [sortedGames, setSelectedGame, setSelectedIndex, playNavigateSound]);

  const handleLaunchGame = async (gameId: string) => {
    try {
      if (isMenuOpen) closeDrawerWithSound();
      if (runningGameId === gameId) {
        await killGame(gameId);
        return;
      }
      await invoke("launch_game", { gameId });
      const launchedGame = sortedGames.find((entry) => entry.id === gameId);
      if (launchedGame) {
        startPolling(gameId, launchedGame);
      }
    } catch (error) {
      console.error("Failed to launch game:", error);
    }
  };

  React.useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    const focusedElement = gameItemRefs.current.get(libraryFocusIndex);
    if (scrollContainer && focusedElement) {
      const containerWidth = scrollContainer.offsetWidth;
      const elementLeft = focusedElement.offsetLeft;
      const elementWidth = focusedElement.offsetWidth;
      const targetScrollLeft = elementLeft - (containerWidth / 2) + (elementWidth / 2);
      animate(scrollX, targetScrollLeft, {
        duration: 0.3,
        ease: [0.4, 0, 0.2, 1],
        onUpdate: (latest: any) => {
          if (scrollContainer) scrollContainer.scrollLeft = latest;
        },
      });
    }
  }, [libraryFocusIndex, scrollX]);

  // ======== TAB NAVIGATION HELPERS ========

  const communityFocusItems = React.useMemo(() => {
    const items: Array<
      | { type: "compose" }
      | { type: "news"; newsIndex: number }
      | { type: "forum"; forumIndex: number }
    > = [{ type: "compose" }];

    const newsCount = steamNews.slice(0, 8).length;
    for (let i = 0; i < newsCount; i += 1) {
      items.push({ type: "news", newsIndex: i });
    }

    for (let i = 0; i < (forumPosts?.length || 0); i += 1) {
      items.push({ type: "forum", forumIndex: i });
    }

    return items;
  }, [forumPosts, steamNews]);

  const communityNewsCount = React.useMemo(() => steamNews.slice(0, 8).length, [steamNews]);
  const communityForumCount = React.useMemo(() => forumPosts?.length || 0, [forumPosts]);

  const getNextCommunityIndex = React.useCallback((currentIndex: number, direction: "up" | "down" | "left" | "right") => {
    const newsCount = communityNewsCount;
    const forumCount = communityForumCount;
    const forumStart = 1 + newsCount;

    if (currentIndex === 0) {
      if (direction === "up") return -1;
      if (direction === "down") {
        if (newsCount > 0) return 1;
        if (forumCount > 0) return forumStart;
        return null;
      }
      return null;
    }

    if (currentIndex >= 1 && currentIndex <= newsCount) {
      const row = currentIndex - 1;
      if (direction === "up") return row > 0 ? currentIndex - 1 : 0;
      if (direction === "down") return row + 1 < newsCount ? currentIndex + 1 : null;
      if (direction === "left") return null;

      // right: switch to same row in right column when available
      if (row < forumCount) return forumStart + row;
      return null;
    }

    if (currentIndex >= forumStart) {
      const row = currentIndex - forumStart;
      if (direction === "up") return row === 0 ? 0 : currentIndex - 1;
      if (direction === "down") return row + 1 < forumCount ? currentIndex + 1 : null;
      if (direction === "right") return null;

      // left: switch to same row in left column when available
      if (row < newsCount) return 1 + row;
      return null;
    }

    return null;
  }, [communityForumCount, communityNewsCount]);

  const getTabContentLength = React.useCallback(() => {
    switch (activeTab) {
      case 'achievements':
        return achievements.length;
      case 'timeline':
        return (playtimeData?.sessions || []).length;
      case 'community':
        return communityFocusItems.length;
      default:
        return 0;
    }
  }, [activeTab, achievements, communityFocusItems.length, playtimeData]);

  const scrollToTabContent = React.useCallback((index: number) => {
    const element = tabContentRefs.current.get(index);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, []);

  const enterTabContentNavigation = React.useCallback(() => {
    const contentLength = getTabContentLength();
    if (contentLength <= 0) {
      return false;
    }

    setNavigationMode('tabContent');
    setTabContentIndex(0);
    playNavigateSound();
    lastNavigationTime.current = Date.now();
    scrollToTabContent(0);

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }

    return true;
  }, [getTabContentLength, playNavigateSound, scrollToTabContent]);

  const activateTabContent = React.useCallback((index: number) => {
    if (activeTab === 'achievements') {
      const achievement = achievements[index];
      if (achievement) {
        toast.info(achievement.name, { description: achievement.description });
      }
    } else if (activeTab === 'community') {
      const item = communityFocusItems[index];
      if (!item) {
        return;
      }

      if (item.type === "compose") {
        setIsComposerOpen(true);
        return;
      }

      if (item.type === "news") {
        const news = steamNews[item.newsIndex];
        if (news?.url) {
          void open(news.url as string).catch((error) => {
            console.error("Failed to open Steam news URL:", error);
          });
          return;
        }
        if (news) {
          toast.info(news.title, {
            description: news.author ? `By ${news.author}` : "Steam news",
          });
        }
        return;
      }

      const post = forumPosts?.[item.forumIndex];
      if (post) {
        toast.info(post.title, {
          description: `by ${post.authorUsername || "Unknown"}`,
        });
      }
    }
  }, [activeTab, achievements, communityFocusItems, forumPosts, steamNews]);

  // ======== CONTROLLER HOOK ========

  useResponsiveGamepad({
    onButtonDown: (button) => {
      if (currentView.type !== "home") return;
      if (isTopBarFocused) {
        return;
      }

      if (isKeyboardOpen) {
        if (button === "B" || button === "CIRCLE" || button === "START") {
          closeKeyboard(true);
        }
        return;
      }

      if (isComposerOpen) {
        if (button === "B" || button === "CIRCLE" || button === "START") {
          setIsComposerOpen(false);
        }
        return;
      }

      if (isMenuOpen || isPowerDialogOpen) return;
      const now = Date.now();
      if (now - lastNavigationTime.current < navigationCooldown) return;

      // FULL VIEW: Tab Content
      if (isFullView && navigationMode === 'tabContent') {
        const contentLength = getTabContentLength();

        if (button === 'B' || button === 'CIRCLE') {
          setNavigationMode('tabs');
          setTabContentIndex(0);
          playNavigateSound();
          lastNavigationTime.current = now;
          return;
        }

        if (button === 'A' || button === 'X') {
          activateTabContent(tabContentIndex);
          lastNavigationTime.current = now;
          return;
        }

        if (activeTab === 'achievements') {
          const cols = 1;
          if (button === 'RIGHT') {
            if ((tabContentIndex + 1) % cols !== 0 && tabContentIndex < contentLength - 1) {
              setTabContentIndex(prev => prev + 1);
              playNavigateSound();
              lastNavigationTime.current = now;
            }
            return;
          }
          if (button === 'LEFT') {
            if (tabContentIndex % cols !== 0) {
              setTabContentIndex(prev => prev - 1);
              playNavigateSound();
              lastNavigationTime.current = now;
            }
            return;
          }
          if (button === 'DOWN') {
            const newIndex = tabContentIndex + cols;
            if (newIndex < contentLength) {
              setTabContentIndex(newIndex);
              playNavigateSound();
              lastNavigationTime.current = now;
              scrollToTabContent(newIndex);
            }
            return;
          }
          if (button === 'UP') {
            const newIndex = tabContentIndex - cols;
            if (newIndex >= 0) {
              setTabContentIndex(newIndex);
              playNavigateSound();
              lastNavigationTime.current = now;
              scrollToTabContent(newIndex);
            } else {
              setNavigationMode('tabs');
              playNavigateSound();
              lastNavigationTime.current = now;
            }
            return;
          }
        } else if (activeTab === 'community') {
          if (button === 'LEFT' || button === 'RIGHT' || button === 'UP' || button === 'DOWN') {
            const direction = button === 'LEFT'
              ? 'left'
              : button === 'RIGHT'
                ? 'right'
                : button === 'UP'
                  ? 'up'
                  : 'down';

            const nextIndex = getNextCommunityIndex(tabContentIndex, direction);

            if (nextIndex === -1) {
              setNavigationMode('tabs');
              setTabContentIndex(0);
              playNavigateSound();
              lastNavigationTime.current = now;
              return;
            }

            if (nextIndex != null && nextIndex >= 0 && nextIndex < contentLength) {
              setTabContentIndex(nextIndex);
              playNavigateSound();
              lastNavigationTime.current = now;
              scrollToTabContent(nextIndex);
            }
            return;
          }
        } else {
          if (button === 'DOWN') {
            if (tabContentIndex < contentLength - 1) {
              setTabContentIndex(prev => prev + 1);
              playNavigateSound();
              lastNavigationTime.current = now;
              scrollToTabContent(tabContentIndex + 1);
            }
            return;
          }
          if (button === 'UP') {
            if (tabContentIndex > 0) {
              setTabContentIndex(prev => prev - 1);
              playNavigateSound();
              lastNavigationTime.current = now;
              scrollToTabContent(tabContentIndex - 1);
            } else {
              setNavigationMode('tabs');
              playNavigateSound();
              lastNavigationTime.current = now;
            }
            return;
          }
        }
        return;
      }

      // FULL VIEW: Tabs
      if (isFullView && navigationMode === 'tabs') {
        if (button === 'B' || button === 'CIRCLE') {
          setIsFullView(false);
          setNavigationMode('library');
          setTabContentIndex(0);
          playNavigateSound();
          lastNavigationTime.current = now;
          return;
        }

        if (button === 'DOWN' || button === 'A' || button === 'X') {
          enterTabContentNavigation();
          return;
        }

        const tabs = ['achievements', 'timeline', 'community'] as const;
        const currentIdx = tabs.indexOf(activeTab);

        if (button === 'RIGHT') {
          const nextTab = tabs[(currentIdx + 1) % tabs.length];
          setActiveTab(nextTab);
          setTabContentIndex(0);
          playNavigateSound();
          lastNavigationTime.current = now;
          return;
        }

        if (button === 'LEFT') {
          const prevTab = tabs[(currentIdx - 1 + tabs.length) % tabs.length];
          setActiveTab(prevTab);
          setTabContentIndex(0);
          playNavigateSound();
          lastNavigationTime.current = now;
          return;
        }
        return;
      }

      // NORMAL VIEW: Library
      if (!isFullView && navigationMode === 'library') {
        if (button === "UP") {
          playNavigateSound();
          lastNavigationTime.current = now;
          setTopBarFocused(true);
          return;
        }

        if ((button === "A" || button === "X")) {
          const game = sortedGames[libraryFocusIndex];
          if (game) handleOpenGameDetails(game.id);
          return;
        }

        if (button === "DOWN") {
          if (sortedGames.length > 0) {
            setIsFullView(true);
            setNavigationMode('tabs');
            setTabContentIndex(0);
            playNavigateSound();
            lastNavigationTime.current = now;
          }
          return;
        }

        if (button === "LB") {
          navigateLibrary("prev");
          return;
        }

        if (button === "RB") {
          navigateLibrary("next");
          return;
        }
      }
    },

    onLeftStick: (x, y) => {
      if (currentView.type !== "home") return;
      if (isTopBarFocused) return;
      if (isKeyboardOpen || isComposerOpen) return;
      if (isMenuOpen || isPowerDialogOpen) return;
      const now = Date.now();
      const deadzone = 0.5;

      if (isFullView && navigationMode === 'tabContent' && activeTab === 'community' && now - stickHoldStartTime.current > 200) {
        if (Math.abs(x) > deadzone || Math.abs(y) > deadzone) {
          const direction: "up" | "down" | "left" | "right" = Math.abs(x) >= Math.abs(y)
            ? (x > 0 ? "right" : "left")
            : (y > 0 ? "down" : "up");

          const contentLength = getTabContentLength();
          const nextIndex = getNextCommunityIndex(tabContentIndex, direction);

          if (nextIndex === -1) {
            setNavigationMode('tabs');
            setTabContentIndex(0);
            playNavigateSound();
            stickHoldStartTime.current = now;
            return;
          }

          if (nextIndex != null && nextIndex >= 0 && nextIndex < contentLength) {
            setTabContentIndex(nextIndex);
            playNavigateSound();
            stickHoldStartTime.current = now;
            scrollToTabContent(nextIndex);
          }
          return;
        }
      }

      if (Math.abs(y) > deadzone && now - stickHoldStartTime.current > 200) {
        if (!isFullView && navigationMode === 'library' && y < -0.5) {
          playNavigateSound();
          setTopBarFocused(true);
          stickHoldStartTime.current = now;
          return;
        }

        if (!isFullView && navigationMode === 'library' && y > 0.5) {
          setIsFullView(true);
          setNavigationMode('tabs');
          setTabContentIndex(0);
          playNavigateSound();
          stickHoldStartTime.current = now;
          return;
        }
        if (isFullView && navigationMode === 'tabs' && y < -0.5) {
          setIsFullView(false);
          setNavigationMode('library');
          setTabContentIndex(0);
          playNavigateSound();
          stickHoldStartTime.current = now;
          return;
        }
        if (isFullView && navigationMode === 'tabs' && y > 0.5) {
          const moved = enterTabContentNavigation();
          if (moved) {
            stickHoldStartTime.current = now;
          }
          return;
        }
        if (isFullView && navigationMode === 'tabContent' && y < -0.5) {
          setNavigationMode('tabs');
          setTabContentIndex(0);
          playNavigateSound();
          stickHoldStartTime.current = now;
          return;
        }
      }

      if (Math.abs(x) > deadzone) {
        if (!isFullView && navigationMode === 'library') {
          setIsNavigationFocusActive(true);
          const direction = x > 0 ? "right" : "left";
          if (lastStickDirection.current !== direction) {
            lastStickDirection.current = direction;
            navigateLibrary(direction === "right" ? "next" : "prev");
          } else if (now - lastNavigationTime.current >= 400) {
            navigateLibrary(direction === "right" ? "next" : "prev");
          }
        } else if (isFullView && navigationMode === 'tabs') {
          const tabs = ['achievements', 'timeline', 'community'] as const;
          const currentIdx = tabs.indexOf(activeTab);
          if (now - lastNavigationTime.current >= 300) {
            if (x > 0) {
              setActiveTab(tabs[(currentIdx + 1) % tabs.length]);
              setTabContentIndex(0);
            } else {
              setActiveTab(tabs[(currentIdx - 1 + tabs.length) % tabs.length]);
              setTabContentIndex(0);
            }
            playNavigateSound();
            lastNavigationTime.current = now;
          }
        }
      } else {
        lastStickDirection.current = null;
      }
    },
  });

  // ======== KEYBOARD HANDLER ========

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (currentView.type !== "home") return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTopBarFocused) return;

      if (isKeyboardOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeKeyboard(true);
        }
        return;
      }

      if (isComposerOpen) {
        if (e.key === "Escape") {
          e.preventDefault();
          setIsComposerOpen(false);
        }
        return;
      }

      if (isMenuOpen || isPowerDialogOpen) return;

      const now = Date.now();
      if (now - lastNavigationTime.current < navigationCooldown) return;

      // FULL VIEW: Tab Content
      if (isFullView && navigationMode === 'tabContent') {
        const contentLength = getTabContentLength();

        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          if (tabContentIndex > 0) {
            setTabContentIndex(prev => prev - 1);
            playNavigateSound();
            lastNavigationTime.current = now;
            scrollToTabContent(tabContentIndex - 1);
          } else {
            setNavigationMode('tabs');
            setTabContentIndex(0);
            playNavigateSound();
            lastNavigationTime.current = now;
          }
          return;
        }

        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          if (tabContentIndex < contentLength - 1) {
            setTabContentIndex(prev => prev + 1);
            playNavigateSound();
            lastNavigationTime.current = now;
            scrollToTabContent(tabContentIndex + 1);
          }
          return;
        }

        if (activeTab === 'achievements') {
          const cols = 1;
          if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            e.preventDefault();
            if ((tabContentIndex + 1) % cols !== 0 && tabContentIndex < contentLength - 1) {
              setTabContentIndex(prev => prev + 1);
              playNavigateSound();
              lastNavigationTime.current = now;
              scrollToTabContent(tabContentIndex + 1);
            }
            return;
          }
          if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            e.preventDefault();
            if (tabContentIndex % cols !== 0) {
              setTabContentIndex(prev => prev - 1);
              playNavigateSound();
              lastNavigationTime.current = now;
              scrollToTabContent(tabContentIndex - 1);
            }
            return;
          }
        } else if (activeTab === 'community') {
          if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A' || e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            e.preventDefault();

            const direction = (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A')
              ? 'left'
              : (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D')
                ? 'right'
                : (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W')
                  ? 'up'
                  : 'down';

            const nextIndex = getNextCommunityIndex(tabContentIndex, direction);
            if (nextIndex === -1) {
              setNavigationMode('tabs');
              setTabContentIndex(0);
              playNavigateSound();
              lastNavigationTime.current = now;
              return;
            }

            if (nextIndex != null && nextIndex >= 0 && nextIndex < contentLength) {
              setTabContentIndex(nextIndex);
              playNavigateSound();
              lastNavigationTime.current = now;
              scrollToTabContent(nextIndex);
            }
            return;
          }
        }

        if (e.key === 'Enter') {
          e.preventDefault();
          activateTabContent(tabContentIndex);
          return;
        }

        if (e.key === 'Backspace' || e.key === 'Escape') {
          e.preventDefault();
          setNavigationMode('tabs');
          setTabContentIndex(0);
          playNavigateSound();
          return;
        }
        return;
      }

      // FULL VIEW: Tabs
      if (isFullView && navigationMode === 'tabs') {
        if (e.key === 'Enter') {
          e.preventDefault();
          enterTabContentNavigation();
          return;
        }

        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          setIsFullView(false);
          setNavigationMode('library');
          setTabContentIndex(0);
          playNavigateSound();
          lastNavigationTime.current = now;
          return;
        }

        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          enterTabContentNavigation();
          return;
        }

        const tabs = ['achievements', 'timeline', 'community'] as const;
        const currentIdx = tabs.indexOf(activeTab);

        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
          e.preventDefault();
          const nextTab = tabs[(currentIdx + 1) % tabs.length];
          setActiveTab(nextTab);
          setTabContentIndex(0);
          playNavigateSound();
          lastNavigationTime.current = now;
          return;
        }

        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          const prevTab = tabs[(currentIdx - 1 + tabs.length) % tabs.length];
          setActiveTab(prevTab);
          setTabContentIndex(0);
          playNavigateSound();
          lastNavigationTime.current = now;
          return;
        }
        return;
      }

      // LIBRARY NAVIGATION
      if (!isFullView && navigationMode === 'library' && activeSection === "library") {
        if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
          e.preventDefault();
          playNavigateSound();
          lastNavigationTime.current = now;
          setTopBarFocused(true);
          return;
        }

        if (["ArrowRight", "d", "D"].includes(e.key)) {
          e.preventDefault();
          navigateLibrary("next");
          return;
        }

        if (["ArrowLeft", "a", "A"].includes(e.key)) {
          e.preventDefault();
          navigateLibrary("prev");
          return;
        }

        if (e.key === "Enter") {
          e.preventDefault();
          const game = sortedGames[libraryFocusIndex];
          if (game) handleOpenGameDetails(game.id);
          return;
        }

        if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
          e.preventDefault();
          if (sortedGames.length > 0) {
            setIsFullView(true);
            setNavigationMode('tabs');
            setTabContentIndex(0);
            playNavigateSound();
            lastNavigationTime.current = now;
          }
          return;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    currentView, closeKeyboard, isMenuOpen, isPowerDialogOpen, isTopBarFocused, activeSection, libraryFocusIndex,
    sortedGames, navigateLibrary, handleOpenGameDetails, navigationMode,
    activeTab, tabContentIndex, playNavigateSound, isFullView, isKeyboardOpen, isComposerOpen,
    enterTabContentNavigation, setTopBarFocused, getNextCommunityIndex, getTabContentLength, scrollToTabContent
  ]);

  // ... keep existing video handlers ...

  const handleVideoEnd = () => {
    setTimeout(() => {
      setVideoEnded(true);
    }, 500);
  };

  React.useEffect(() => {
    if (videoRef.current && !videoEnded) {
      const video = videoRef.current;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'MediaPlayPause') {
          e.preventDefault();
          e.stopPropagation();
          if (video.paused) video.play();
        }
      };
      const handleContextMenu = (e: MouseEvent) => { e.preventDefault(); };
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('contextmenu', handleContextMenu);
      video.play().catch((error) => {
        console.error("Error playing video:", error);
        setTimeout(() => setVideoEnded(true), 1000);
      });
      const checkVideoPlaying = setInterval(() => {
        if (video.paused && !videoEnded) video.play();
      }, 100);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('contextmenu', handleContextMenu);
        clearInterval(checkVideoPlaying);
      };
    }
  }, [videoEnded]);

  React.useEffect(() => {
    if (!videoEnded) {
      const timer = setTimeout(() => setVideoEnded(true), 9000);
      return () => clearTimeout(timer);
    }
  }, [videoEnded]);

  // ======== RENDER ========

  return (
    <>
      {/* Video */}
      {!videoEnded && (
        <div className="fixed inset-0 w-full h-screen bg-black flex items-center justify-center overflow-hidden z-[200]">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            onEnded={handleVideoEnd}
            onError={() => { setVideoEnded(true); }}
            onContextMenu={(e) => e.preventDefault()}
            onPause={(e) => { e.currentTarget.play(); }}
            playsInline muted={false} autoPlay controls={false}
            disablePictureInPicture disableRemotePlayback
          >
            <source src={videoUrl} type="video/mp4" />
          </video>
        </div>
      )}

      {videoEnded && (
        <motion.div
          className="w-full h-screen bg-black text-white overflow-hidden"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1], delay: 0.2 }}
        >
          <style>{`
            @keyframes fade-pop-in {
              from { opacity: 0; transform: scale(1.05); }
              to { opacity: 1; transform: scale(1); }
            }
            .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            .no-scrollbar::-webkit-scrollbar { display: none; }
          `}</style>
          {/* Main Content */}
          <div className="relative w-full h-full overflow-hidden bg-gray-900">

            {/* Background */}
            <div className="absolute inset-0 w-full h-[350px]">
              <div className="absolute inset-0" style={{ background: "var(--background)" }} />
              <AnimatePresence>
                {backgroundLayers.map((layer, index) => {
                  const isTopLayer = index === backgroundLayers.length - 1;
                  return (
                    <motion.div
                      key={layer.id}
                      initial={isTopLayer ? { opacity: 0, scale: 1 } : { opacity: 1, scale: 1 }}
                      animate={isTopLayer ? { opacity: 1, scale: 1.06 } : { opacity: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 1 }}
                      transition={isTopLayer ? { opacity: { duration: 0.2 }, scale: { duration: 12, ease: "linear" } } : { duration: 0.2 }}
                      onAnimationComplete={() => {
                        if (!isTopLayer) {
                          setBackgroundLayers((prev) => prev.filter((entry) => entry.id !== layer.id));
                        }
                      }}
                      className="absolute inset-0"
                      style={{ backgroundImage: `url(${layer.src})`, backgroundSize: "cover", backgroundPosition: "center" }}
                    />
                  );
                })}
              </AnimatePresence>
              <div className="absolute inset-0 w-full h-[360px] bg-gray-900/70 z-[2]" />
              <div className="absolute inset-0 w-full h-[365px] bg-gradient-to-b from-transparent to-gray-900 z-[3]" />
            </div>

            {/* Library Section */}
            <div className="absolute inset-0 z-[31]" style={{ paddingTop: "88px" }}>
              <div className="relative w-full h-full flex flex-col z-[30]">

                {/* Games Strip - Hidden in full view */}
                <AnimatePresence>
                  {!isFullView && (
                    <motion.div
                      className="flex-1 flex items-start justify-start px-12"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, y: -50 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div
                        ref={scrollContainerRef}
                        className="w-full overflow-x-auto overflow-y-hidden no-scrollbar"
                        onMouseMove={() => setIsNavigationFocusActive(false)}
                        onScroll={(e) => scrollX.set(e.currentTarget.scrollLeft)}
                      >
                        <div className="flex w-max gap-4 p-2 items-start" style={{ paddingTop: "70px", paddingLeft: "70px", paddingBottom: "130px" }}>
                          {sortedGames.map((game, idx) => (
                            <GameItem
                              key={game.id}
                              game={game}
                              index={idx}
                              isHero={idx === 0}
                              playtimeMinutes={playtimeByGameId.get(game.id) || 0}
                              isFocused={isNavigationFocusActive && idx === libraryFocusIndex}
                              onFocus={() => {
                                setIsNavigationFocusActive(false);
                                setLibraryFocusIndex(idx);
                                setSelectedGame(game);
                                setSelectedIndex(idx);
                              }}
                              onLaunch={() => handleLaunchGame(game.id)}
                              onOpenDetails={() => handleOpenGameDetails(game.id)}
                              gameItemRefs={gameItemRefs}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Tabbed Interface */}
                <AnimatePresence mode="wait">
                  {(isFullView || isNavigationFocusActive) && (
                    <motion.div
                      key="tabbed-interface"
                      initial={{ opacity: 0, y: 50 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                      className={cn(
                        "absolute left-0 right-0 z-[40] flex flex-col bg-gray-900/40 backdrop-blur-xl",
                        isFullView ? "-top-[90px] bottom-[60px]" : "top-[44vh] bottom-0"
                      )}
                    >
                      {/* Tab Navigation */}
                      <div className={cn("flex items-center justify-center gap-2 mb-4 shrink-0", isFullView ? "mt-16" : "mt-4")}>
                        <button>
                          <ArrowLeft className={cn(
                            "w-6 h-6 text-white/60 hover:text-white/90 transition-colors duration-200",
                            isFullView && navigationMode === 'tabs' ? "text-white" : ""
                          )} />
                        </button>
                        {[
                          { id: 'achievements', label: 'Achievements', icon: Trophy },
                          { id: 'timeline', label: 'Timeline', icon: ClockIcon },
                          { id: 'community', label: 'Community', icon: Users },
                        ].map((tab) => {
                          const Icon = tab.icon;
                          const isActive = activeTab === tab.id;
                          const isTabFocused = navigationMode === 'tabs' && isActive && isFullView;

                          return (
                            <motion.button
                              key={tab.id}
                              onClick={() => {
                                if (isFullView && navigationMode === "tabs" && activeTab === tab.id) {
                                  enterTabContentNavigation();
                                  return;
                                }
                                setActiveTab(tab.id as typeof activeTab);
                                if (!isFullView) setIsFullView(true);
                                setNavigationMode('tabs');
                              }}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                }
                              }}
                              className={cn(
                                "flex tracking-[0.15rem] items-center gap-2 px-6 py-3 border-2 border-transparent uppercase text-sm font-medium transition-all duration-200 rounded-full outline-none",
                                isTabFocused
                                  ? "bg-white text-black shadow-lg border-[var(--theme-accent)] animate-pulse"
                                  : isActive
                                    ? "bg-white/90 text-black"
                                    : "text-white/60 hover:text-white/90 hover:bg-white/10"
                              )}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Icon className="w-4 h-4" />
                              {tab.label}
                            </motion.button>
                          );
                        })}
                        <button>
                          <ArrowRight className={cn(
                            "w-6 h-6 text-white/60 hover:text-white/90 transition-colors duration-200",
                            isFullView && navigationMode === 'tabs' ? "text-white" : ""
                          )} />
                        </button>
                      </div>

                      {/* Tab Content */}
                      <div
                        ref={fullViewScrollRef}
                        className={cn(
                          "flex-1 overflow-y-auto no-scrollbar border-y transition-all duration-300",
                          isFullView ? "bg-gray-900/40 border-white/20" : "bg-gray-900/60 border-white/10 max-h-[36vh]"
                        )}
                      >
                        <div className="p-6">

                          {/* Achievements */}
                          {activeTab === 'achievements' && (
                            <div className={isFullView ? "pb-20" : ""}>
                              {selectedGame?.launcher === 'steam' ? (
                                achievements.length > 0 ? (
                                  <div className="flex flex-col gap-3 max-w-4xl mx-auto">
                                    {achievements.map((achievement, idx) => {
                                      const isItemFocused = isFullView && navigationMode === 'tabContent' && tabContentIndex === idx;
                                      return (
                                        <motion.div
                                          key={achievement.id || idx}
                                          ref={(el) => { if (el) tabContentRefs.current.set(idx, el); }}
                                          initial={{ opacity: 0, y: 20 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{ delay: idx * 0.02 }}
                                          className={cn(
                                            "flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-200",
                                            isItemFocused
                                              ? "bg-white/15 border-white shadow-lg scale-[1.02]"
                                              : achievement.unlocked
                                                ? "bg-white/5 border-white/10"
                                                : "bg-black/40 border-white/5 opacity-40"
                                          )}
                                        >
                                          <img src={achievement.icon || '/default-achievement.png'} alt={achievement.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-base font-semibold text-white mb-1">{achievement.name}</p>
                                            <p className="text-sm text-white/60 line-clamp-2">{achievement.description}</p>
                                            {achievement.unlocked && achievement.unlockedDate && (
                                              <p className="text-sm text-[var(--theme-accent)] mt-2">✓ Unlocked {new Date(achievement.unlockedDate * 1000).toLocaleDateString()}</p>
                                            )}
                                          </div>
                                        </motion.div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center h-64 text-white/40">
                                    <Trophy className="w-16 h-16 mb-4 opacity-50" />
                                    <p className="text-lg">No achievements available</p>
                                  </div>
                                )
                              ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-white/40">
                                  <p className="text-lg">Achievements only available for Steam games</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Timeline */}
                          {activeTab === 'timeline' && (
                            <div className={isFullView ? "pb-20 max-w-4xl mx-auto" : "max-w-4xl mx-auto"}>
                              {playtimeData ? (
                                <>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                    <div className="bg-white/5 p-4 border border-white/10">
                                      <p className="text-xs uppercase font-thin text-white/50 tracking-[0.15rem]">Total Playtime</p>
                                      <p className="text-3xl font-light text-white">{Math.round((playtimeData.totalPlaytime || 0) / 60)}h</p>
                                    </div>
                                    <div className="bg-white/5 p-4 border border-white/10">
                                      <p className="text-xs uppercase font-thin text-white/50 tracking-[0.15rem]">Sessions</p>
                                      <p className="text-3xl font-light text-white">{playtimeData.sessions?.length || 0}</p>
                                    </div>
                                    <div className="bg-white/5 p-4 border border-white/10">
                                      <p className="text-xs uppercase font-thin text-white/50 tracking-[0.15rem]">Avg Session</p>
                                      <p className="text-3xl font-light text-white">{Math.round(((playtimeData.totalPlaytime || 0) / Math.max(playtimeData.sessions?.length || 1, 1)))}m</p>
                                    </div>
                                  </div>
                                  <div className="space-y-3">
                                    {(playtimeData.sessions || []).map((session: any, idx: number) => {
                                      const isItemFocused = isFullView && navigationMode === 'tabContent' && tabContentIndex === idx;
                                      return (
                                        <motion.div
                                          key={idx}
                                          ref={(el) => { if (el) tabContentRefs.current.set(idx, el); }}
                                          initial={{ opacity: 0, x: -20 }}
                                          animate={{ opacity: 1, x: 0 }}
                                          transition={{ delay: idx * 0.03 }}
                                          className={cn(
                                            "flex items-center gap-4 p-4 border-2 transition-all",
                                            isItemFocused ? "bg-white/10 border-[var(--theme-accent)] scale-[1.01] animate-pulse shadow-lg" : "bg-white/5 border-transparent"
                                          )}
                                        >
                                          <div className="flex-1">
                                            <p className="text-white text-md">{new Date(session.startTime).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                            <p className="text-white/50 text-xs font-thin uppercase tracking-[0.15rem]">Session #{idx + 1}</p>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-2xl font-light text-white">{Math.round(session.duration / 60)}m</p>
                                            <p className="text-white/50 text-xs font-thin uppercase tracking-[0.15rem]">{new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                          </div>
                                        </motion.div>
                                      );
                                    })}
                                  </div>
                                </>
                              ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-white/40">
                                  <ClockIcon className="w-16 h-16 mb-4 opacity-50" />
                                  <p className="text-lg">No playtime data available</p>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Community */}
                          {activeTab === 'community' && (
                            <div className={cn("mx-auto max-w-7xl", isFullView && "pb-20")}>
                              <button
                                type="button"
                                onClick={() => setIsComposerOpen(true)}
                                ref={(el) => { if (el) tabContentRefs.current.set(0, el); }}
                                className={cn(
                                  "mb-6 flex w-full items-center justify-center gap-3 rounded-2xl border px-6 py-5 text-lg font-semibold transition-all",
                                  "border-[var(--theme-accent)]/60 bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/35",
                                  isFullView && navigationMode === 'tabContent' && tabContentIndex === 0 && "ring-2 ring-[var(--theme-accent)]",
                                )}
                              >
                                <Plus className="h-5 w-5" />
                                Create New Post
                              </button>

                              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                                  <div className="mb-4 flex items-center gap-2">
                                    <Newspaper className="h-5 w-5 text-blue-300" />
                                    <h3 className="text-sm uppercase tracking-[0.2rem] text-white/70">Steam News</h3>
                                  </div>
                                  {selectedGame?.launcher !== "steam" ? (
                                    <div className="flex h-48 items-center justify-center text-white/40">
                                      Steam news is only available for Steam games.
                                    </div>
                                  ) : loadingSteamNews ? (
                                    <div className="flex h-48 flex-col items-center justify-center gap-2 text-white/50">
                                      <Loader2 className="h-6 w-6 animate-spin" />
                                      <span>Loading Steam news...</span>
                                    </div>
                                  ) : steamNews.length > 0 ? (
                                    <div className="space-y-3">
                                      {steamNews.slice(0, 8).map((item, newsIndex) => {
                                        const focusIndex = 1 + newsIndex;
                                        const isItemFocused = isFullView && navigationMode === 'tabContent' && tabContentIndex === focusIndex;
                                        return (
                                        <div
                                          key={item.gid}
                                          ref={(el) => { if (el) tabContentRefs.current.set(focusIndex, el); }}
                                          className={cn(
                                            "rounded-lg border p-3 transition-all",
                                            isItemFocused ? "border-[var(--theme-accent)] bg-white/10" : "border-white/10 bg-white/5"
                                          )}
                                        >
                                          <div className="mb-2 flex items-start justify-between gap-3">
                                            <h4 className="text-sm font-medium text-white">{item.title}</h4>
                                            <span className="shrink-0 text-xs text-white/50">
                                              {item.date ? new Date(item.date * 1000).toLocaleDateString() : ""}
                                            </span>
                                          </div>
                                          <p className="mb-2 text-xs uppercase tracking-[0.12rem] text-white/45">
                                            {item.author ? `By ${item.author}` : "Steam"}
                                            {item.feedLabel ? ` • ${item.feedLabel}` : ""}
                                          </p>
                                          <p className="line-clamp-3 text-sm text-white/70">
                                            {stripHtml(item.contents).slice(0, 240)}
                                          </p>
                                          {item.url && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                void open(item.url as string).catch((error) => {
                                                  console.error("Failed to open Steam news URL:", error);
                                                });
                                              }}
                                              className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 text-xs text-blue-200 hover:bg-white/10"
                                            >
                                              Open <ExternalLink className="h-3.5 w-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      )})}
                                    </div>
                                  ) : (
                                    <div className="flex h-48 items-center justify-center text-white/40">
                                      No Steam news available.
                                    </div>
                                  )}
                                </div>

                                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                                  <div className="mb-4 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                      <MessageSquare className="h-5 w-5 text-emerald-300" />
                                      <h3 className="text-sm uppercase tracking-[0.2rem] text-white/70">Forum Posts</h3>
                                    </div>
                                  </div>

                                  {forumPosts && forumPosts.length > 0 ? (
                                    <div className="space-y-3">
                                      {forumPosts.map((forum, idx) => {
                                        const focusIndex = 1 + Math.min(steamNews.length, 8) + idx;
                                        const isItemFocused = isFullView && navigationMode === 'tabContent' && tabContentIndex === focusIndex;
                                        return (
                                          <motion.div
                                            key={forum._id}
                                            ref={(el) => { if (el) tabContentRefs.current.set(focusIndex, el); }}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.04 }}
                                            className={cn(
                                              "flex items-center justify-between rounded-lg border-2 p-4 transition-all",
                                              isItemFocused ? "border-[var(--theme-accent)] bg-white/10 shadow-lg" : "border-transparent bg-white/5"
                                            )}
                                          >
                                            <div className="min-w-0">
                                              <div className="mb-1 flex items-center gap-2">
                                                <p className="truncate text-base font-medium text-white">{forum.title}</p>
                                                {forum.isPinned && (
                                                  <span className="rounded-full bg-yellow-500/20 px-2 py-0.5 text-[11px] text-yellow-300">Pinned</span>
                                                )}
                                              </div>
                                              <p className="text-xs text-white/55">
                                                {(forum.commentCount || 0)} replies • {(forum.likes?.length || 0)} likes • by {forum.authorUsername || "Unknown"}
                                              </p>
                                            </div>
                                            <ChevronRight className={cn("ml-3 h-5 w-5 shrink-0", isItemFocused ? "text-white" : "text-white/35")} />
                                          </motion.div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="flex h-48 flex-col items-center justify-center text-white/40">
                                      <Users className="mb-3 h-10 w-10 opacity-60" />
                                      <p>No forum posts for this game yet.</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {isComposerOpen && (
                                <div className="mt-6 rounded-xl border border-white/20 bg-black/55 p-5 backdrop-blur-xl">
                                  <div className="mb-4 flex items-center justify-between gap-3">
                                    <h3 className="text-base font-semibold text-white">Create New Post</h3>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        closeKeyboard(false);
                                        setIsComposerOpen(false);
                                      }}
                                      className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
                                    >
                                      Close
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                                    <div className="space-y-2">
                                      <p className="text-xs uppercase tracking-[0.18rem] text-white/60">Title</p>
                                      <div className="min-h-[3rem] rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white">
                                        {composerTitle || <span className="text-white/35">Enter a title...</span>}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => openKeyboardForField("title")}
                                        className={cn(
                                          "rounded-full border px-3 py-1.5 text-xs",
                                          composerField === "title" ? "border-[var(--theme-accent)]/60 bg-[var(--theme-accent)]/20 text-[var(--theme-accent)]" : "border-white/20 text-white/70 hover:bg-white/10"
                                        )}
                                      >
                                        Use On-Screen Keyboard
                                      </button>
                                    </div>

                                    <div className="space-y-2">
                                      <p className="text-xs uppercase tracking-[0.18rem] text-white/60">Content</p>
                                      <div className="min-h-[8rem] rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white">
                                        {composerContent || <span className="text-white/35">Write your message...</span>}
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => openKeyboardForField("content")}
                                        className={cn(
                                          "rounded-full border px-3 py-1.5 text-xs",
                                          composerField === "content" ? "border-[var(--theme-accent)]/60 bg-[var(--theme-accent)]/20 text-[var(--theme-accent)]" : "border-white/20 text-white/70 hover:bg-white/10"
                                        )}
                                      >
                                        Use On-Screen Keyboard
                                      </button>
                                    </div>
                                  </div>

                                  <div className="mt-5 flex items-center justify-end gap-3">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setComposerTitle("");
                                        setComposerContent("");
                                        closeKeyboard(false);
                                      }}
                                      className="rounded-full border border-white/20 px-4 py-2 text-sm text-white/80 hover:bg-white/10"
                                    >
                                      Clear
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleSubmitPost();
                                      }}
                                      disabled={isSubmittingPost}
                                      className="rounded-full border border-[var(--theme-accent)]/50 bg-[var(--theme-accent)]/25 px-4 py-2 text-sm font-medium text-[var(--theme-accent)] hover:bg-[var(--theme-accent)]/35 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isSubmittingPost ? "Posting..." : "Post"}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <Toaster />
        </motion.div>
      )}

      {/* Global TopBar - always visible above all views */}
      {videoEnded && (
        <OverdriveTopBar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearchSubmit={handleOverdriveSearchSubmit}
          className={cn("fixed z-[70]", isMenuOpen ? "bg-black/40" : "")}
          rightSlot={(
            <Button
              onClick={openDrawerWithSound}
              onMouseDown={(event) => { event.preventDefault(); }}
              tabIndex={-1}
              variant="ghost"
              className="flex items-center gap-2 dark"
            >
              <Power className="h-4 w-4" />
            </Button>
          )}
        />
      )}

      {/* Sub-view overlays rendered on top of the home view */}
      <AnimatePresence mode="wait">
        {currentView.type === "library" && (
          <motion.div
            key="view-library"
            className="fixed inset-0 z-[60]"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <LibraryView
              initialSearchQuery={currentView.searchQuery}
              onBack={popView}
              onOpenGame={(id) => pushView({ type: "gameDetails", gameId: id })}
              onHintsChange={setSubViewHints}
            />
          </motion.div>
        )}
        {currentView.type === "gameDetails" && (
          <motion.div
            key={`view-gameDetails-${currentView.gameId}`}
            className="fixed inset-0 z-[60]"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <GameDetailsView
              gameId={currentView.gameId}
              onBack={popView}
              onHintsChange={setSubViewHints}
            />
          </motion.div>
        )}
        {currentView.type === "settings" && (
          <motion.div
            key="view-settings"
            className="fixed inset-0 z-[60]"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <SettingsView
              initialSection={currentView.section}
              onBack={popView}
              onHintsChange={setSubViewHints}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global NavigationHints - always visible above all views */}
      {videoEnded && (
        <OverdriveNavigationHints
          items={currentView.type === "home" ? overdriveHints : subViewHints}
          className="fixed bottom-0 z-[70] w-full"
        />
      )}
      <MascotOverlay size={72} />
    </>
  );
};

export default Overdrive;

