import { create } from "zustand";
import { Profile } from "@/types";

interface ProfileStore {
  profiles: Profile[];
  currentProfile: Profile | null;
  isLoading: boolean;
  error: string | null;
  setProfiles: (profiles: Profile[]) => void;
  addProfile: (profile: Profile) => void;
  updateProfile: (profileId: string, updates: Partial<Profile>) => void;
  removeProfile: (profileId: string) => void;
  setCurrentProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getProfileById: (profileId: string) => Profile | undefined;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profiles: [],
  currentProfile: null,
  isLoading: false,
  error: null,
  setProfiles: (profiles) => set({ profiles }),
  addProfile: (profile) => set((state) => ({ profiles: [...state.profiles, profile] })),
  updateProfile: (profileId, updates) =>
    set((state) => ({
      profiles: state.profiles.map((profile) =>
        profile.id === profileId ? { ...profile, ...updates } : profile
      ),
      currentProfile:
        state.currentProfile?.id === profileId
          ? { ...state.currentProfile, ...updates }
          : state.currentProfile,
    })),
  removeProfile: (profileId) =>
    set((state) => ({
      profiles: state.profiles.filter((profile) => profile.id !== profileId),
      currentProfile:
        state.currentProfile?.id === profileId ? null : state.currentProfile,
    })),
  setCurrentProfile: (profile) => set({ currentProfile: profile }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  getProfileById: (profileId) =>
    get().profiles.find((profile) => profile.id === profileId),
}));

