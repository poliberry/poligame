import React, { createContext, useContext, useState, ReactNode } from "react";
import { LauncherType } from "@/types";

interface LibraryContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filterLauncher: LauncherType | "all";
  setFilterLauncher: (launcher: LauncherType | "all") => void;
  viewMode: "grid" | "list";
  setViewMode: (mode: "grid" | "list") => void;
}

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLauncher, setFilterLauncher] = useState<LauncherType | "all">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <LibraryContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        filterLauncher,
        setFilterLauncher,
        viewMode,
        setViewMode,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibraryContext = () => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibraryContext must be used within LibraryProvider");
  }
  return context;
};

