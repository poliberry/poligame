import { create } from 'zustand';
import React from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';

interface User {
  _id: string;
  username?: string;
  email?: string;
  name?: string;
  bio?: string;
}

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
}));

// Hook to sync Convex auth with store
export const useAuthSync = () => {
  const currentUser = useQuery(api.auth.getCurrentUser);
  const { setUser } = useAuthStore();

  React.useEffect(() => {
    if (currentUser) {
      setUser(currentUser as User);
    } else {
      setUser(null);
    }
  }, [currentUser, setUser]);
};

