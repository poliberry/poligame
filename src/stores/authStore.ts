import { create } from "zustand";
import { isPostHogInitialized, posthog } from "@/lib/posthog";

// Note: We'll use Convex hooks directly in components via ConvexProvider
// The auth state will be managed here, but API calls will be in components

interface User {
  userId: string;
  email: string;
  username?: string;
  avatar?: string;
  bio?: string;
  steamUserId?: string;
  epicUserId?: string;
  eaUserId?: string;
  twoFactorEnabled?: boolean;
  rockstarUserId?: string;
  requiresTwoFactor?: boolean;
  novuSubscriberId?: string;
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username?: string) => Promise<void>;
  signOut: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthStore>((set, get) => {
  // Load user from localStorage on init (safely handle SSR)
  let initialUser: User | null = null;
  if (typeof window !== "undefined") {
    try {
      const storedUser = localStorage.getItem("auth-user");
      initialUser = storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error("Error loading user from localStorage:", error);
    }

    // Function to sync state from localStorage
    const syncFromLocalStorage = () => {
      try {
        const storedUser = localStorage.getItem("auth-user");
        const newUser = storedUser ? (JSON.parse(storedUser) as User) : null;
        const currentUser = get().user;

        // Only update if the user actually changed
        if (JSON.stringify(currentUser) !== JSON.stringify(newUser)) {
          get().setUser(newUser);
        }
      } catch (error) {
        console.error("Error syncing user from localStorage:", error);
      }
    };

    // Listen for storage changes from other windows (like the auth window)
    // The storage event fires in other windows when localStorage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "auth-user") {
        syncFromLocalStorage();
      }
    };

    window.addEventListener("storage", handleStorageChange);

    // Also poll periodically as a fallback (storage events may not fire reliably in all Tauri scenarios)
    // Poll every 2 seconds to check for changes
    setInterval(() => {
      syncFromLocalStorage();
    }, 2000);
  }

  if (initialUser && isPostHogInitialized) {
    posthog.identify(initialUser.userId, {
      email: initialUser.email,
      username: initialUser.username,
    });
  }

  return {
    user: initialUser,
    isAuthenticated: !!initialUser,
    isLoading: false,
    error: null,
    setUser: (user) => {
        if (typeof window !== "undefined") {
          try {
            if (user) {
              localStorage.setItem("auth-user", JSON.stringify(user));
            } else {
              localStorage.removeItem("auth-user");
            }
          } catch (error) {
            console.error("Error saving user to localStorage:", error);
          }
        }
        const currentUser = get().user;
        const userChanged = currentUser?.userId !== user?.userId;
        if (userChanged && isPostHogInitialized) {
          if (currentUser) {
            posthog.reset();
          }
          if (user) {
            posthog.identify(user.userId, {
              email: user.email,
              username: user.username,
            });
          }
        }
      set({ user, isAuthenticated: !!user, error: null });
    },
    signIn: async () => {
      // This will be implemented in components using Convex hooks
      throw new Error("Use signIn from auth components");
    },
    signUp: async () => {
      // This will be implemented in components using Convex hooks
      throw new Error("Use signUp from auth components");
    },
    signOut: () => {
      if (isPostHogInitialized) {
        posthog.reset();
      }
      if (typeof window !== "undefined") {
        try {
          localStorage.removeItem("auth-user");
        } catch (error) {
          console.error("Error removing user from localStorage:", error);
        }
      }
      set({
        user: null,
        isAuthenticated: false,
        error: null,
      });
    },
    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),
  };
});

