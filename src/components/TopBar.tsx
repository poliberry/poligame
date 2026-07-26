import React, { useState, useRef, useEffect } from "react";
import { LogOut, Minus, Square, X, Settings, Users } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useAuthStore } from "@/stores/authStore";
import { useRunningGameStore } from "@/stores/runningGameStore";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { PiSpeedometer } from "react-icons/pi";
import logo from "@/public/poligame-logo.svg";
import { IoTvOutline } from "react-icons/io5";
import {
  VscChromeClose,
  VscChromeMaximize,
  VscChromeMinimize,
} from "react-icons/vsc";
import { NovuInbox } from "./ui/inbox/NovuInbox";
import { Id } from "node_modules/convex/dist/esm-types/values/value";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cn } from "@/lib/utils";
import { Badge } from './ui/badge';

export const TopBar: React.FC = () => {
  const { user, isAuthenticated, signOut } = useAuthStore();
  const { runningGame } = useRunningGameStore();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showContentMenu, setShowContentMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const contentMenuRef = useRef<HTMLDivElement>(null);

  const gameCustomisation = useQuery(
    api.gameCustomizations.getGameCustomization,
    runningGame && user
      ? {
        userId: user.userId as unknown as Id<"users">,
        gameId: runningGame?.id,
      }
      : "skip",
  );
  // Close dropdown when clicking outside
  useEffect(() => {
    console.log(runningGame);
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
      if (
        contentMenuRef.current &&
        !contentMenuRef.current.contains(event.target as Node)
      ) {
        setShowContentMenu(false);
      }
    };

    if (showDropdown || showContentMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showDropdown, showContentMenu]);

  // Handle Alt+F4 to exit app
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey && event.key === "F4") {
        event.preventDefault();
        event.stopPropagation();
        invoke("exit_app").catch((error) => {
          console.error("Failed to exit app:", error);
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleOpenFriends = async () => {
    try {
      await invoke("create_friends_window");
    } catch (error) {
      console.error("Failed to open friends window:", error);
      // Fallback: navigate to friends route
      navigate("/friends");
    }
  };

  const handleEnterOverdrive = async () => {
    try {
      // Navigate first, then set fullscreen
      navigate("/overdrive");
      // Small delay to ensure navigation completes before setting fullscreen
      setTimeout(async () => {
        try {
          await invoke("enter_overdrive_mode");
        } catch (error) {
          console.error("Failed to enter Overdrive mode:", error);
        }
      }, 100);
    } catch (error) {
      console.error("Failed to enter Overdrive mode:", error);
    }
  };

  const handleOpenAuth = async () => {
    try {
      await invoke("create_auth_window");
    } catch (error) {
      console.error("Failed to open auth window:", error);
      // Fallback: navigate to auth route in main window if window creation fails
      window.location.href = "/auth";
    }
  };

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("minimize_window");
    } catch (error) {
      // Silently fail in browser mode
      console.debug(
        "Window controls not available (running in browser)",
        error,
      );
    }
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("toggle_maximize_window");
    } catch (error) {
      // Silently fail in browser mode
      console.debug(
        "Window controls not available (running in browser)",
        error,
      );
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("close_window");
    } catch (error) {
      // Silently fail in browser mode
      console.debug(
        "Window controls not available (running in browser)",
        error,
      );
    }
  };

  const handleOpenAccountDetails = async () => {
    try {
      await invoke("create_account_details_window");
    } catch (error) {
      console.error("Failed to open account details window:", error);
    }
  };

  const handleOpenSettings = async () => {
    try {
      await invoke("create_settings_window");
    } catch (error) {
      console.error("Failed to open settings window:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Failed to sign out:", error);
    }
  };

  const handleExit = async () => {
    try {
      await invoke("exit_app");
    } catch (error) {
      console.error("Failed to exit:", error);
    }
  };

  return (
    <div
      className="flex flex-col w-full fixed bg-linear-to-b from-background to-transparent top-0 left-0 right-0 z-50"
      style={{
        margin: 0,
        padding: 0,
        borderRadius: 0,
        border: "none",
        boxShadow: "none",
        boxSizing: "border-box",
        height: "fit-content",
      }}
    >
      <div
        data-tauri-drag-region
        className="drag-region flex flex-row w-full items-center justify-between"
        style={{
          margin: 0,
        }}
      >
        <div
          className="flex-1 flex flex-row items-center gap-2 p-2"
          style={{ fontFamily: "Unbounded, sans-serif" }}
        >
          <img
            src={logo}
            alt="PoliGame"
            className="w-6 h-6 invert dark:invert-0"
          />
          <Badge variant="default" className="text-foreground/70 absolute text-[9px] px-1 py-0.25 bg-[var(--theme-button)] rounded-full top-4 left-4 font-light uppercase">
            BETA
          </Badge>
          {/* Friends Dropdown */}
          <div className="flex flex-row gap-0 ml-4">
            <div
              className="relative inline-block text-left no-drag-region"
              data-tauri-drag-region="false"
            >
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <button
                    type="button"
                    className="px-3 flex items-center gap-1 text-sm cursor-pointer text-foreground/70 hover:text-[var(--theme-accent)] transition-colors cursor-pointer"
                    title="General"
                    style={{ fontFamily: "Google Sans Flex, sans-serif" }}
                  >
                    General
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="z-[99] w-60 bg-muted border border-border overflow-hidden"
                  style={{ fontFamily: "Google Sans Flex, sans-serif" }}
                >
                  <div className="flex flex-col gap-1 p-2">
                    {isAuthenticated && user && (
                      <button
                        className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                        type="button"
                        onClick={() => {
                          handleOpenAccountDetails();
                        }}
                      >
                        Manage Account...
                      </button>
                    )}
                    {isAuthenticated && user ? (
                      <button
                        className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                        type="button"
                        onClick={() => {
                          handleSignOut();
                        }}
                      >
                        Sign Out...
                      </button>
                    ) : (
                      <button
                        className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                        type="button"
                        onClick={() => {
                          handleOpenAuth();
                        }}
                      >
                        Sign In...
                      </button>
                    )}
                    <div className="w-full h-px bg-foreground/10"></div>
                    <button
                      className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                      type="button"
                      onClick={() => { }}
                    >
                      Check For Updates
                    </button>
                    <button
                      className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                      type="button"
                      onClick={() => {
                        handleExit();
                      }}
                    >
                      Exit
                    </button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {isAuthenticated && user && (
              <div
                className="relative inline-block text-left no-drag-region"
                data-tauri-drag-region="false"
              >
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <button
                      type="button"
                      className="px-3 flex items-center gap-1 text-sm cursor-pointer text-foreground/70 hover:text-[var(--theme-accent)] transition-colors cursor-pointer"
                      title="Friends"
                      style={{ fontFamily: "Google Sans Flex, sans-serif" }}
                    >
                      Friends
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="z-[99] w-60 bg-muted border border-border overflow-hidden"
                    style={{ fontFamily: "Google Sans Flex, sans-serif" }}
                  >
                    <div className="flex flex-col gap-1 p-2">
                      <button
                        className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                        type="button"
                        onClick={() => {
                          handleOpenFriends();
                        }}
                      >
                        View Friends
                      </button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
            <div
              className="relative inline-block text-left no-drag-region"
              data-tauri-drag-region="false"
            >
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <button
                    type="button"
                    className="px-3 flex items-center gap-1 text-sm cursor-pointer text-foreground/70 hover:text-[var(--theme-accent)] transition-colors cursor-pointer"
                    title="View"
                    style={{ fontFamily: "Google Sans Flex, sans-serif" }}
                  >
                    View
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="z-[99] w-60 bg-muted border border-border overflow-hidden"
                  style={{ fontFamily: "Google Sans Flex, sans-serif" }}
                >
                  <div className="flex flex-col gap-1 p-2">
                    <button
                      className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                      type="button"
                      onClick={() => {
                        handleEnterOverdrive();
                      }}
                    >
                      Switch to Overdrive Mode
                    </button>
                    <button
                      className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                      type="button"
                      onClick={() => {
                        // handleOpenAccessibilitySettings();
                      }}
                    >
                      Accessibility Settings
                    </button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div
              className="relative inline-block text-left no-drag-region"
              data-tauri-drag-region="false"
            >
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <button
                    type="button"
                    className="px-3 flex items-center gap-1 text-sm cursor-pointer text-foreground/70 hover:text-[var(--theme-accent)] transition-colors cursor-pointer"
                    title="Help"
                    style={{ fontFamily: "Google Sans Flex, sans-serif" }}
                  >
                    Help
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="z-[99] w-60 bg-muted border border-border overflow-hidden"
                  style={{ fontFamily: "Google Sans Flex, sans-serif" }}
                >
                  <div className="flex flex-col gap-1 p-2">
                    <button
                      className="w-full text-left text-xs text-foreground/70 hover:underline cursor-pointer"
                      type="button"
                      onClick={() => {
                        // handleOpenHelp();
                      }}
                    >
                      Help Center
                    </button>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
        <div className="w-full ml-4">
          <Sidebar />
        </div>
        <div
          className={cn("flex items-center gap-1 no-drag-region", runningGame ? "mr-8" : "mr-4")}
          data-tauri-drag-region="false"
        >
          <NovuInbox />
          <Button
            variant="link"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleEnterOverdrive();
            }}
            className="hover:text-[var(--theme-accent)] text-muted-foreground cursor-pointer"
            type="button"
          >
            <IoTvOutline size={14} />
          </Button>
          {isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={`py-1 flex flex-row items-center gap-1 rounded-full px-2 min-w-fit h-fit hover-[var(--theme-accent)]/40 cursor-pointer ${runningGame ? "bg-[var(--theme-button)]" : ""}`}
              >
                {runningGame && (
                  <img
                    src={runningGame.icon || gameCustomisation?.customLogo}
                    alt={runningGame.title}
                    className="w-5 h-5"
                    title={`Playing: ${runningGame.title}`}
                    style={{
                      backgroundColor: "var(--theme-background)",
                      padding: "1px",
                      borderRadius: "360px",
                    }}
                  />
                )}
                {runningGame && (<hr className="h-4 border-l border-foreground/20" />)}
                <img
                  src={
                    user.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || user.email)}`
                  }
                  alt="Avatar"
                  className="w-5 h-5 rounded-full"
                />
                <span
                  className={cn("text-sm font-light", runningGame ? "text-[var(--theme-accent)]" : "text-foreground")}
                  style={{ fontFamily: "Google Sans Flex, sans-serif" }}
                >
                  {user.username || user.email}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-48 bg-muted border border-border overflow-hidden"
              >
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    setShowDropdown(false);
                    try {
                      await handleOpenSettings();
                    } catch (error) {
                      console.error("Failed to open settings window:", error);
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/10 transition-colors text-left"
                  type="button"
                >
                  <Settings size={14} />
                  Settings
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    signOut();
                    setShowDropdown(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-foreground/10 transition-colors text-left border-t border-foreground/10"
                  type="button"
                >
                  <LogOut size={14} />
                  Sign Out
                </button>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="default"
              onClick={handleOpenAuth}
              className="h-fit py-1 px-2 text-xs cursor-pointer"
              style={{ fontFamily: "Google Sans Flex, sans-serif" }}
            >
              Sign In
            </Button>
          )}
          <button
            onClick={handleMinimize}
            className="p-1 hover:bg-muted-foreground/10 rounded transition-colors text-foreground/70"
            title="Minimize"
          >
            <VscChromeMinimize size={14} />
          </button>
          <button
            onClick={handleMaximize}
            className="p-1 hover:bg-muted-foreground/10 rounded transition-colors text-foreground/70"
            title="Maximize"
          >
            <VscChromeMaximize size={14} />
          </button>
          <button
            onClick={handleClose}
            className="p-1 mr-2 hover:bg-red-500/20 rounded transition-colors text-foreground/70"
            title="Close"
          >
            <VscChromeClose size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
