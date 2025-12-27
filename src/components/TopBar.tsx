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

export const TopBar: React.FC = () => {
  const { user, isAuthenticated, signOut } = useAuthStore();
  const { runningGame } = useRunningGameStore();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showContentMenu, setShowContentMenu] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const contentMenuRef = useRef<HTMLDivElement>(null);
  // Close dropdown when clicking outside
  useEffect(() => {
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
        error
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
        error
      );
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("exit_app");
    } catch (error) {
      // Silently fail in browser mode
      console.debug(
        "Window controls not available (running in browser)",
        error
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
      className="flex flex-col w-full fixed top-0 left-0 right-0 z-50 backdrop-blur-sm bg-muted"
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Unbounded:wght@200..900&display=swap"
          rel="stylesheet"
        ></link>
        <link
          href="https://fonts.googleapis.com/css2?family=Livvic:wght@100..900&display=swap"
          rel="stylesheet"
        ></link>
        <div
          className="flex-1 flex flex-row items-center gap-2 p-2"
          style={{ fontFamily: "Unbounded, sans-serif" }}
        >
          <img
            src={logo}
            alt="PoliGame"
            className="w-6 h-6 invert dark:invert-0"
          />
          <span
            className="select-none uppercase italic text-sm"
            style={{ fontWeight: 600, color: "var(--theme-text)" }}
          >
            PoliGame <span className="text-xs text-foreground/60">BETA</span>
          </span>
          {/* Friends Dropdown */}
          <div className="flex flex-row gap-0 ml-2">
            <div
              className="relative inline-block text-left no-drag-region"
              data-tauri-drag-region="false"
            >
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <button
                    type="button"
                    className="pt-3 px-3 pb-1 -mt-3 flex items-center gap-1 text-sm cursor-pointer text-foreground/70 bg-muted-foreground/10 hover:text-foreground transition-colors cursor-pointer"
                    title="General"
                    style={{ fontFamily: "Livvic, sans-serif" }}
                  >
                    General
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="z-[99] w-60 bg-muted border border-border overflow-hidden"
                  style={{ fontFamily: "Livvic, sans-serif" }}
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
                      onClick={() => {}}
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
                      className="pt-3 px-3 pb-1 -mt-3 flex items-center gap-1 text-sm cursor-pointer text-foreground/70 bg-muted-foreground/10 hover:text-foreground transition-colors"
                      title="Friends"
                      style={{ fontFamily: "Livvic, sans-serif" }}
                    >
                      Friends
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="z-[99] w-60 bg-muted border border-border overflow-hidden"
                    style={{ fontFamily: "Livvic, sans-serif" }}
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
                    className="pt-3 px-3 pb-1 -mt-3 flex items-center gap-1 text-sm cursor-pointer text-foreground/70 bg-muted-foreground/10 hover:text-foreground transition-colors cursor-pointer"
                    title="View"
                    style={{ fontFamily: "Livvic, sans-serif" }}
                  >
                    View
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="z-[99] w-60 bg-muted border border-border overflow-hidden"
                  style={{ fontFamily: "Livvic, sans-serif" }}
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
                    className="pt-3 px-3 pb-1 -mt-3 flex items-center gap-1 text-sm cursor-pointer text-foreground/70 bg-muted-foreground/10 hover:text-foreground transition-colors cursor-pointer"
                    title="Help"
                    style={{ fontFamily: "Livvic, sans-serif" }}
                  >
                    Help
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="z-[99] w-60 bg-muted border border-border overflow-hidden"
                  style={{ fontFamily: "Livvic, sans-serif" }}
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
        <div
          className="flex items-center gap-1 no-drag-region"
          data-tauri-drag-region="false"
        >
          <NovuInbox />
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleEnterOverdrive();
            }}
            className="py-1 px-2 h-fit cursor-pointer"
            type="button"
          >
            <IoTvOutline size={14} />
          </Button>
          {isAuthenticated && user ? (
            <div
              className="relative text-xs bg-muted-foreground/10"
              ref={dropdownRef}
            >
              <Button
                onClick={() => setShowDropdown(!showDropdown)}
                variant={runningGame ? "default" : "ghost"}
                className={`py-0.5 px-1 flex flex-row items-center gap-1 min-w-fit h-fit cursor-pointer ${runningGame ? "bg-[var(--theme-accent)] text-foreground" : ""}`}
                title={user.username || user.email}
              >
                {runningGame && runningGame.icon && (
                  <img
                    src={runningGame.icon}
                    alt={runningGame.title}
                    className="w-5 h-5"
                    title={`Playing: ${runningGame.title}`}
                    style={{
                      marginRight: "6px",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                    }}
                  />
                )}
                <img
                  src={
                    user.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || user.email)}`
                  }
                  alt="Avatar"
                  className="w-5 h-5"
                />
                <span
                  className="text-sm"
                  style={{ fontFamily: "Livvic, sans-serif" }}
                >
                  {user.username || user.email}
                </span>
              </Button>

              {showDropdown && (
                <div
                  className="absolute right-0 w-48 bg-background border border-border text-foreground overflow-hidden"
                  data-tauri-drag-region="false"
                  style={{
                    backdropFilter: "blur(10px)",
                    fontFamily: "Livvic, sans-serif",
                    zIndex: 9999,
                  }}
                  onClick={(e) => e.stopPropagation()}
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
                </div>
              )}
            </div>
          ) : (
            <Button
              variant="default"
              onClick={handleOpenAuth}
              className="h-fit py-1 px-2 text-xs cursor-pointer"
              style={{ fontFamily: "Livvic, sans-serif" }}
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
      <Sidebar />
      <div
        className="w-full"
        style={{
          height: "2px",
          background:
            "linear-gradient(to right, transparent, var(--theme-button-secondary), transparent)",
        }}
      />
    </div>
  );
};
