export enum LauncherType {
  Steam = "steam",
  EA = "ea",
  Epic = "epic",
  Rockstar = "rockstar",
  Custom = "custom",
}

export interface Game {
  id: string;
  title: string;
  launcher: LauncherType | string; // Allow string for custom launchers
  path?: string;
  installed: boolean;
  metadata?: GameMetadata;
  achievements?: Achievement[];
  playtime?: number;
  lastPlayed?: Date;
  coverArt?: string;
  gridCoverArt?: string;
  logo?: string;
  headerArt?: string;
  icon?: string;
  screenshots?: string[];
  description?: string;
  releaseDate?: Date;
  developer?: string;
  publisher?: string;
  tags?: string[];
  rating?: number;
  notes?: string;
}

export interface GameMetadata {
  appId?: string;
  storeUrl?: string;
  dlc?: DLCEntry[];
  updates?: UpdateEntry[];
  relatedContent?: RelatedContent[];
}

export interface DLCEntry {
  id: string;
  title: string;
  description?: string;
  installed: boolean;
  releaseDate?: Date;
}

export interface UpdateEntry {
  version: string;
  releaseDate: Date;
  description?: string;
  installed: boolean;
}

export interface RelatedContent {
  type: "expansion" | "sequel" | "predecessor" | "bundle";
  gameId: string;
  title: string;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedDate?: Date;
  progress?: number;
  maxProgress?: number;
  icon?: string;
  globalUnlockPercentage?: number;
}

export interface Launcher {
  type: LauncherType;
  installed: boolean;
  path?: string;
  games: string[]; // Game IDs
}

export interface LauncherStatus {
  launcherType: LauncherType;
  installed: boolean;
  path?: string;
}

export interface Profile {
  id: string;
  username: string;
  avatar?: string;
  bio?: string;
  preferences?: ProfilePreferences;
  stats?: ProfileStats;
  createdAt: Date;
  lastActive?: Date;
}

export interface ProfilePreferences {
  defaultLauncher?: LauncherType;
  favoriteGames?: string[]; // Game IDs
  theme?: string;
  language?: string;
}

export interface ProfileStats {
  totalGames: number;
  totalPlaytime: number; // in minutes
  achievementsUnlocked: number;
  achievementsTotal: number;
  favoriteGenres?: string[];
  recentActivity?: ActivityEntry[];
}

export interface ActivityEntry {
  type: "played" | "achievement" | "added" | "completed";
  gameId: string;
  gameTitle: string;
  timestamp: Date;
  details?: string;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  createdAt: Date;
}

export interface BrowserHistory {
  id: string;
  url: string;
  title: string;
  visitedAt: Date;
  visitCount: number;
}

export interface Settings {
  theme: "dark" | "light";
  language: string;
  autoScanOnStart: boolean;
  launcherPaths?: Record<LauncherType, string>;
  librarySettings?: LibrarySettings;
  browserSettings?: BrowserSettings;
  accessibilitySettings?: AccessibilitySettings;
}

export interface AccessibilitySettings {
  grayscale: boolean;
  highContrast: boolean;
}

export interface LibrarySettings {
  cacheGameMetadata: boolean;
  autoUpdateMetadata: boolean;
  defaultView: "grid" | "list";
  sortBy: "title" | "lastPlayed" | "playtime" | "added";
  groupBy?: "launcher" | "genre" | "none";
}

export interface BrowserSettings {
  defaultSearchEngine: string;
  homepage: string;
  blockAds: boolean;
  enableJavascript: boolean;
}

