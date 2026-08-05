import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { invoke } from "@tauri-apps/api/core";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useAuthStore } from "@/stores/authStore";
import { useRunningGameStore } from "@/stores/runningGameStore";
import { setManualStatus } from "@/hooks/usePresence";
import { MicaButton } from "./MicaButton";
import { MicaInput } from "./MicaInput";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { Input } from "./ui/input";
import { stripMarkdownAndHtml } from "@/lib/utils";
import {
  Users,
  UserPlus,
  MessageSquare,
  X,
  Send,
  Minus,
  Square,
  ChevronDown,
} from "lucide-react";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { showNotification } from "@/utils/notifications";
import { isPostHogInitialized, posthog } from "@/lib/posthog";

interface FriendsWindowProps {
  onClose: () => void;
}

export const FriendsWindow: React.FC<FriendsWindowProps> = ({ onClose }) => {
  const { user, isAuthenticated } = useAuthStore();
  const { runningGame } = useRunningGameStore();
  const [activeTab, setActiveTab] = useState<"friends" | "chat">("friends");
  const [selectedChat, setSelectedChat] = useState<Id<"chats"> | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [userStatus, setUserStatus] = useState<"online" | "away" | "busy" | "offline">("online");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [lastActivityTime, setLastActivityTime] = useState(Date.now());
  const [isManualStatus, setIsManualStatus] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const notifiedChatTimestampsRef = useRef<Map<string, number>>(new Map());

  const users = useQuery(
    api.user.getUsers
  )
  const friends = useQuery(
    api.friends.getFriends,
    user?.userId ? { userId: user.userId as unknown as Id<"users"> } : "skip"
  );
  const friendRequests = useQuery(
    api.friends.getFriendRequests,
    user?.userId ? { userId: user.userId as unknown as Id<"users"> } : "skip"
  );
  const chats = useQuery(
    api.messages.getUserChats,
    user?.userId ? { userId: user.userId as unknown as Id<"users"> } : "skip"
  );
  const chatMessages = useQuery(
    api.messages.getChatMessages,
    selectedChat ? { chatId: selectedChat } : "skip"
  );
  const searchResults = useQuery(
    api.friends.searchUsers,
    showAddFriend && searchQuery.length >= 2 && user?.userId
      ? { query: searchQuery, currentUserId: user.userId as unknown as Id<"users"> }
      : "skip"
  );
  const unreadCount = useQuery(
    api.messages.getUnreadCount,
    user?.userId ? { userId: user.userId as unknown as Id<"users"> } : "skip"
  );
  
  // Query current user's status from database
  const currentUser = useQuery(
    api.auth.getUserById,
    user?.userId ? { userId: user.userId as unknown as Id<"users"> } : "skip"
  );

  const sendFriendRequest = useMutation(api.friends.sendFriendRequest);
  const acceptFriendRequest = useMutation(api.friends.acceptFriendRequest);
  const removeFriend = useMutation(api.friends.removeFriend);
  const sendMessage = useMutation(api.messages.sendMessage);
  const markAsRead = useMutation(api.messages.markMessagesAsRead);
  const updateStatus = useMutation(api.friends.updateUserStatus);

  // Update currentGame when running game changes (status is managed by usePresence hook)
  useEffect(() => {
    if (user?.userId && userStatus !== "offline" && runningGame) {
      updateStatus({
        userId: user.userId as unknown as Id<"users">,
        status: userStatus,
        currentGame: {
          id: runningGame.id,
          title: runningGame.title,
          launcher: runningGame.launcher,
          icon: runningGame.icon,
        },
      });
    } else if (user?.userId && userStatus !== "offline" && !runningGame) {
      // Clear game when it stops
      updateStatus({
        userId: user.userId as unknown as Id<"users">,
        status: userStatus,
        currentGame: undefined,
      });
    }
  }, [runningGame, user?.userId, userStatus, updateStatus]);

  // Check for manual status on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isManualSet = localStorage.getItem("poligame-manual-status-set");
      const manualStatus = localStorage.getItem("poligame-manual-status");
      if (isManualSet === "true" && manualStatus) {
        setIsManualStatus(true);
      } else {
        setIsManualStatus(false);
      }
    }
  }, []);

  // Sync local userStatus with database status (from usePresence hook or mobile app changes)
  useEffect(() => {
    const dbStatus = (currentUser as any)?.status;
    if (dbStatus && dbStatus !== userStatus) {
      // Only update if not manually set locally (to avoid conflicts)
      if (!isManualStatus) {
        setUserStatus(dbStatus as "online" | "away" | "busy" | "offline");
      }
    }
  }, [currentUser, isManualStatus, userStatus]);

  // Activity tracking - reset last activity time on user interaction
  useEffect(() => {
    const handleActivity = () => {
      setLastActivityTime(Date.now());
    };

    // Track mouse and keyboard activity
    window.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("mousedown", handleActivity);
    window.addEventListener("scroll", handleActivity);

    return () => {
      window.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("mousedown", handleActivity);
      window.removeEventListener("scroll", handleActivity);
    };
  }, []);

  // Auto-set to away after 15 minutes of inactivity (only if not manually set)
  useEffect(() => {
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }

    if (userStatus === "online" && user?.userId && !isManualStatus) {
      activityTimeoutRef.current = setTimeout(() => {
        const timeSinceActivity = Date.now() - lastActivityTime;
        if (timeSinceActivity >= 15 * 60 * 1000) { // 15 minutes
          setUserStatus("away");
          updateStatus({
            userId: user.userId as unknown as Id<"users">,
            status: "away",
            currentGame: runningGame ? {
              id: runningGame.id,
              title: runningGame.title,
              launcher: runningGame.launcher,
              icon: runningGame.icon,
            } : undefined,
          });
        }
      }, 15 * 60 * 1000);
    }

    return () => {
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [lastActivityTime, userStatus, user?.userId, runningGame, updateStatus, isManualStatus]);

  // Note: Status is managed by usePresence hook in AppShell, we just display it here

  const handleStatusChange = async (newStatus: "online" | "away" | "busy" | "offline") => {
    if (!user?.userId) return;

    setUserStatus(newStatus);
    setShowStatusMenu(false);
    
    // Update manual status tracking
    if (newStatus === "online") {
      setIsManualStatus(false);
      setManualStatus(null);
      // Reset activity time when setting to online
      setLastActivityTime(Date.now());
    } else {
      setIsManualStatus(true);
      setManualStatus(newStatus);
    }

    await updateStatus({
      userId: user.userId as unknown as Id<"users">,
      status: newStatus,
      currentGame: runningGame ? {
        id: runningGame.id,
        title: runningGame.title,
        launcher: runningGame.launcher,
        icon: runningGame.icon,
      } : undefined,
    });
  };

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Mark messages as read when chat is selected
  useEffect(() => {
    if (selectedChat && user?.userId) {
      markAsRead({
        chatId: selectedChat,
        userId: user.userId as unknown as Id<"users">,
      });
    }
  }, [selectedChat, user?.userId]);

  // Show notification for new messages from other users
  useEffect(() => {
    if (!chats || !user?.userId) return;

    // Check all chats for new messages
    chats.forEach((chat: any) => {
      // Skip if this is the currently selected chat (user is viewing it)
      if (selectedChat === chat._id) {
        // Update the last notified timestamp for this chat
        if (chat.lastMessageAt) {
          notifiedChatTimestampsRef.current.set(chat._id, chat.lastMessageAt);
        }
        return;
      }

      // Check if there's a new message in this chat
      if (chat.lastMessageAt) {
        const lastNotified = notifiedChatTimestampsRef.current.get(chat._id) || 0;

        // If lastMessageAt is newer than what we've notified about, show notification
        if (chat.lastMessageAt > lastNotified) {
          // Update the timestamp
          notifiedChatTimestampsRef.current.set(chat._id, chat.lastMessageAt);

          // Get sender name
          const senderName = chat.type === "dm"
            ? chat.otherMembers?.[0]?.username || "Someone"
            : "Group Chat";

          // Strip HTML from last message
          const messageText = (chat.lastMessage || "New message")
            .replace(/<[^>]*>/g, '')
            .substring(0, 100);

          showNotification({
            title: chat.type === "dm"
              ? `New message from ${senderName}`
              : `New message in ${chat.name || "Group Chat"}`,
            body: messageText,
            type: "info",
            duration: 5000,
          });
        }
      }
    });
  }, [chats, user?.userId, selectedChat]);

  const handleSendMessage = async () => {
    if (!user?.userId || !selectedChat || !messageContent.trim()) return;

    try {
      const chat = chats?.find((c) => c._id === selectedChat);
      if (!chat) return;

      // For DMs, find the recipient
      const recipient = chat.type === "dm"
        ? chat.otherMembers?.[0]?._id
        : undefined;

      const recipientUser = users?.find((u: any) => u._id === recipient);

      await sendMessage({
        senderId: user.userId as unknown as Id<"users">,
        recipientId: recipient,
        chatId: selectedChat,
        content: messageContent,
        contentFormat: "markdown",
        images: [],
      }).then(async () => {
        if (!recipientUser?.novuSubscriberId) return;
        
        // Try Tauri command first (production), fallback to API route (dev)
        try {
          await invoke("trigger_novu_notification", {
            subscriberId: recipientUser.novuSubscriberId,
            title: `New message from ${user?.username}`,
            body: stripMarkdownAndHtml(messageContent),
            workflowId: "new-message",
          });
        } catch (tauriError) {
          // Fallback to API route for dev mode
          try {
            const response = await fetch("/api/novu/notify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                subscriberId: recipientUser.novuSubscriberId,
                title: `New message from ${user?.username}`,
                body: stripMarkdownAndHtml(messageContent),
                type: "new-message",
              }),
            });
            
            // Check if response is JSON (not HTML)
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              // Got HTML instead of JSON (likely 404 in production)
              console.warn("API route not available, notification not sent");
              return;
            }
          } catch (fetchError) {
            console.error("Failed to send notification via both methods:", { tauriError, fetchError });
          }
        }
      });

      if (isPostHogInitialized) {
        posthog.capture("chat_message_sent", { chat_type: chat.type });
      }
      setMessageContent("");
    } catch (error: any) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message", {
        description: error.message || "An error occurred",
      });
    }
  };

  const handleSendFriendRequest = async (friendId: Id<"users">) => {
    if (!user?.userId) return;

    const friend = users?.find((u: any) => u._id === friendId);

    try {
      await sendFriendRequest({
        userId: user.userId as unknown as Id<"users">,
        friendId,
      }).then(async () => {
        if (!friend?.novuSubscriberId) return;
        
        // Try Tauri command first (production), fallback to API route (dev)
        try {
          await invoke("trigger_novu_notification", {
            subscriberId: friend.novuSubscriberId,
            title: "Someone wants to be your friend!",
            body: `${user.username} sent you a friend request`,
            workflowId: "friend-request",
          });
        } catch (tauriError) {
          // Fallback to API route for dev mode
          try {
            const response = await fetch("/api/novu/notify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                subscriberId: friend.novuSubscriberId,
                title: "Someone wants to be your friend!",
                body: `${user.username} sent you a friend request`,
                type: "friend-request",
              }),
            });
            
            // Check if response is JSON (not HTML)
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              // Got HTML instead of JSON (likely 404 in production)
              console.warn("API route not available, notification not sent");
              return;
            }
          } catch (fetchError) {
            console.error("Failed to send notification via both methods:", { tauriError, fetchError });
          }
        }
      });

      if (isPostHogInitialized) {
        posthog.capture("friend_request_sent");
      }
      setSearchQuery("");
      setShowAddFriend(false);
    } catch (error: any) {
      console.error("Failed to send friend request:", error);
      toast.error("Failed to send friend request", {
        description: error.message || "An error occurred",
      });
    }
  };

  const handleAcceptFriendRequest = async (friendId: Id<"users">) => {
    if (!user?.userId) return;

    try {
      await acceptFriendRequest({
        userId: user.userId as unknown as Id<"users">,
        friendId,
      });
      if (isPostHogInitialized) {
        posthog.capture("friend_request_accepted");
      }
    } catch (error: any) {
      console.error("Failed to accept friend request:", error);
      toast.error("Failed to accept friend request", {
        description: error.message || "An error occurred",
      });
    }
  };

  const handleRemoveFriend = async (friendId: Id<"users">) => {
    if (!user?.userId || !confirm("Are you sure you want to remove this friend?")) return;

    try {
      await removeFriend({
        userId: user.userId as unknown as Id<"users">,
        friendId,
      });
    } catch (error: any) {
      console.error("Failed to remove friend:", error);
      toast.error("Failed to remove friend", {
        description: error.message || "An error occurred",
      });
    }
  };

  const handleMinimize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("minimize_friends_window");
    } catch (error) {
      console.debug("Window controls not available (running in browser)", error);
    }
  };

  const handleMaximize = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("toggle_maximize_friends_window");
    } catch (error) {
      console.debug("Window controls not available (running in browser)", error);
    }
  };

  const handleClose = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await invoke("close_friends_window");
    } catch (error) {
      console.debug("Window controls not available (running in browser)", error);
      // Fallback to onClose callback
      onClose();
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

  // Close status menu when clicking outside
  useEffect(() => {
    if (!showStatusMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const statusMenu = target.closest('.relative');
      if (!statusMenu) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showStatusMenu]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "online":
        return "bg-green-500";
      case "away":
        return "bg-yellow-500";
      case "busy":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "online":
        return "Online";
      case "away":
        return "Away";
      case "busy":
        return "Busy";
      default:
        return "Offline";
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="w-full h-full">
        <div className="flex items-center justify-between py-1 px-2 border-b border-white/10 drag-region">
          <div className="flex items-center gap-2">
            <Users size={16} />
            <h2 className="text-sm font-semibold uppercase italic">Friends</h2>
          </div>
          <div className="flex items-center gap-2 no-drag-region">
            {/* Window Controls */}
            <button
              onClick={handleMinimize}
              className="p-2 hover:bg-white/10 rounded transition-colors"
              title="Minimize"
            >
              <Minus size={14} />
            </button>
            <button
              onClick={handleMaximize}
              className="p-2 hover:bg-white/10 rounded transition-colors"
              title="Maximize"
            >
              <Square size={14} />
            </button>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-red-500/20 rounded transition-colors"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 w-full h-full flex flex-col items-center justify-center gap-4">
          <p className="text-white/60">Please sign in to use Friends</p>
          <Button variant="default" onClick={handleOpenAuth} className="w-fit">Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--theme-background)]">

      {/* Header */}
      <div className="flex items-center justify-between py-1 px-2 border-b border-white/10 drag-region">
        <div className="flex items-center gap-2">
          <Users size={16} />
          <h2 className="text-sm font-semibold uppercase italic">Friends</h2>
          {unreadCount !== undefined && unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 no-drag-region">
          {/* Status Selector */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              className="flex items-center gap-2 px-2 py-1 hover:bg-white/10 rounded transition-colors text-sm"
              title="Change Status"
            >
              <div className={`w-2 h-2 rounded-full ${getStatusColor(userStatus)}`} />
              <span className="text-xs">{getStatusText(userStatus)}</span>
              <ChevronDown size={12} />
            </button>
            {showStatusMenu && (
              <div className="absolute right-0 mt-1 bg-black/90 border border-white/20 rounded shadow-lg z-50 min-w-[120px]">
                <button
                  onClick={() => handleStatusChange("online")}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2 text-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Online</span>
                </button>
                <button
                  onClick={() => handleStatusChange("away")}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2 text-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-yellow-500" />
                  <span>Away</span>
                </button>
                <button
                  onClick={() => handleStatusChange("busy")}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2 text-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span>Busy</span>
                </button>
                <button
                  onClick={() => handleStatusChange("offline")}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 flex items-center gap-2 text-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-gray-500" />
                  <span>Offline</span>
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => setShowAddFriend(!showAddFriend)}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Add Friend"
          >
            <UserPlus size={16} />
          </button>
          {/* Window Controls */}
          <button
            onClick={handleMinimize}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            onClick={handleMaximize}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Maximize"
          >
            <Square size={14} />
          </button>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-red-500/20 rounded transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => {
            setActiveTab("friends");
            setSelectedChat(null);
          }}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "friends"
            ? "text-white border-b-2"
            : "text-white/60 hover:text-white"
            }`}
          style={activeTab === "friends" ? { borderBottomColor: "var(--theme-accent)" } : {}}
        >
          Friends
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "chat"
            ? "text-white border-b-2"
            : "text-white/60 hover:text-white"
            }`}
          style={activeTab === "chat" ? { borderBottomColor: "var(--theme-accent)" } : {}}
        >
          Chat
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Sidebar */}
        <div className="w-80 border-r border-white/10 flex flex-col">
          {activeTab === "friends" ? (
            <>
              {/* Add Friend Search */}
              {showAddFriend && (
                <div className="p-3 border-b border-white/10">
                  <MicaInput
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                  />
                  {searchResults && searchResults.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {searchResults.map((result) => (
                        <div
                          key={result._id}
                          className="flex items-center justify-between p-2 hover:bg-white/5 rounded"
                        >
                          <div className="flex items-center gap-2">
                            {result.avatar ? (
                              <img
                                src={result.avatar}
                                alt={result.username}
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                {result.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm">{result.username}</span>
                          </div>
                          {result.friendshipStatus === null && (
                            <MicaButton
                              variant="primary"
                              onClick={() => handleSendFriendRequest(result._id)}
                              className="text-xs px-2 py-1"
                            >
                              Add
                            </MicaButton>
                          )}
                          {result.friendshipStatus === "pending" && (
                            <span className="text-xs text-white/60">Pending</span>
                          )}
                          {result.friendshipStatus === "accepted" && (
                            <span className="text-xs text-white/60">Friends</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Friend Requests */}
              {friendRequests && (friendRequests.received.length > 0 || friendRequests.sent.length > 0) && (
                <div className="p-3 border-b border-white/10">
                  <h3 className="text-sm font-semibold mb-2">Friend Requests</h3>
                  {friendRequests.received.length > 0 && (
                    <div className="space-y-2 mb-2">
                      {friendRequests.received.map((req) => (
                        <div
                          key={req._id}
                          className="flex items-center justify-between p-2 bg-white/5 rounded"
                        >
                          <div className="flex items-center gap-2">
                            {req.user?.avatar ? (
                              <img
                                src={req.user.avatar}
                                alt={req.user.username}
                                className="w-8 h-8 rounded-full"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                                {req.user?.username.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-sm">{req.user?.username}</span>
                          </div>
                          <MicaButton
                            variant="primary"
                            onClick={() => handleAcceptFriendRequest(req.user!._id)}
                            className="text-xs px-2 py-1"
                          >
                            Accept
                          </MicaButton>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Friends List */}
              <div className="flex-1 overflow-y-auto">
                {friends === undefined ? (
                  <div className="p-4 text-center text-white/60">Loading...</div>
                ) : friends.length === 0 ? (
                  <div className="p-4 text-center text-white/60 flex flex-row items-center justify-center gap-2 flex-wrap">You have no friends. </div>
                ) : (
                  <div className="p-2 space-y-1">
                    {friends.map((friend: any) => (
                      <div
                        key={friend._id}
                        className="flex items-center gap-3 p-2 hover:bg-white/5 rounded cursor-pointer"
                        onClick={() => {
                          // Find or create DM chat with this friend
                          const dmChat = chats?.find(
                            (c) => c.type === "dm" && c.otherMembers?.[0]?._id === friend._id
                          );
                          if (dmChat) {
                            setSelectedChat(dmChat._id);
                            setActiveTab("chat");
                          }
                        }}
                      >
                        <div className="relative">
                          {friend.avatar ? (
                            <img
                              src={friend.avatar}
                              alt={friend.username}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                              {friend.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[var(--theme-background)] ${getStatusColor(friend.status)}`}
                            title={getStatusText(friend.status)}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{friend.username}</div>
                          <div className="text-xs text-white/60 truncate">
                            {friend.status === "online" && friend.currentGame
                              ? `Playing ${friend.currentGame.title}${friend.currentGame.launcher ? ` (${friend.currentGame.launcher})` : ""}`
                              : getStatusText(friend.status)}
                          </div>
                          {friend.currentGame && friend.currentGame.icon && (
                            <img
                              src={friend.currentGame.icon}
                              alt={friend.currentGame.title}
                              className="w-4 h-4 mt-1 rounded"
                            />
                          )}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFriend(friend._id);
                          }}
                          className="p-1 hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove friend"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Chat List */
            <div className="flex-1 overflow-y-auto">
              {chats === undefined ? (
                <div className="p-4 text-center text-white/60">Loading...</div>
              ) : chats.length === 0 ? (
                <div className="p-4 text-center text-white/60">No chats yet</div>
              ) : (
                <div className="p-2 space-y-1">
                  {chats.map((chat: any) => {
                    const displayName = chat.type === "dm"
                      ? chat.otherMembers?.[0]?.username || "Unknown"
                      : chat.name || "Group Chat";
                    const displayAvatar = chat.type === "dm"
                      ? chat.otherMembers?.[0]?.avatar
                      : undefined;
                    const isSelected = selectedChat === chat._id;

                    return (
                      <div
                        key={chat._id}
                        onClick={() => setSelectedChat(chat._id)}
                        className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${isSelected ? "bg-white/10" : "hover:bg-white/5"
                          }`}
                      >
                        {displayAvatar ? (
                          <img
                            src={displayAvatar}
                            alt={displayName}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{displayName}</div>
                          {chat.lastMessage && (
                            <div className="text-xs text-white/60 truncate">
                              {chat.lastMessage.replace(/<[^>]*>/g, '')}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Area */}
        {activeTab === "chat" && selectedChat && (
          <div className="flex-1 flex flex-col">
            {/* Chat Header */}
            <div className="p-3 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(() => {
                  const chat = chats?.find((c) => c._id === selectedChat);
                  const displayName = chat?.type === "dm"
                    ? chat.otherMembers?.[0]?.username || "Unknown"
                    : chat?.name || "Group Chat";
                  return <span className="font-semibold">{displayName}</span>;
                })()}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages === undefined ? (
                <div className="text-center text-white/60">
                <div className="flex items-center justify-center h-full">
                  <div className="w-56 h-2 bg-green-900/20 rounded overflow-hidden relative">
                    <div
                      className="absolute h-2 bg-green-400 animate-bar-move left-0 top-0 rounded"
                      style={{
                        width: "40%",
                      }}
                    />
                  </div>
                  <style>
                    {`
                      @keyframes bar-move {
                        0% { left: -40%; }
                        100% { left: 100%; }
                      }
                      .animate-bar-move {
                        animation: bar-move 1.2s cubic-bezier(0.4,0,0.2,1) infinite;
                      }
                    `}
                  </style>
                </div>
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="text-center text-white/60">No messages yet. Start the conversation!</div>
              ) : (
                <>
                  {chatMessages.map((message: any) => {
                    const isOwn = message.senderId === user.userId;
                    const messageDate = new Date(message.createdAt);
                    const timeString = messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const dateString = messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

                    return (
                      <div
                        key={message._id}
                        className={`flex flex-col items-start border-b border-white/10 pb-4 mb-4`}
                      >
                        {/* Avatar and username for received messages (above card) */}
                        <div className="flex items-center gap-2 mb-1 px-1">
                            {message.senderAvatar ? (
                              <img
                                src={message.senderAvatar}
                                alt={message.senderUsername}
                                className="w-6 h-6 rounded-full"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs">
                                {message.senderUsername.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="text-xs font-medium text-white/80">{message.senderUsername}</span>
                          </div>
                        {message.contentFormat === "markdown" ? (
                          <MarkdownRenderer content={message.content} className="text-sm text-white h-fit py-2 pl-1" />
                        ) : (
                          <div
                            className="text-sm prose prose-invert max-w-none text-white h-fit py-2 pl-1"
                            dangerouslySetInnerHTML={{ __html: message.content }}
                          />
                        )}

                        {/* Date sent (outside card, underneath) */}
                        <div className={`text-xs text-white/50 mt-1 px-1 ${isOwn ? "text-right" : "text-left"}`}>
                          {timeString} • {dateString}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Message Input */}
            <div className="p-3 border-t border-white/10">
              <div className="flex gap-2">
                <Input
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Type a message... (Markdown supported)"
                  className="flex-1"
                />
                <Button
                  variant="default"
                  onClick={handleSendMessage}
                  disabled={!messageContent.trim()}
                  size="default"
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "chat" && !selectedChat && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-white/60">
              <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
              <p>Select a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

