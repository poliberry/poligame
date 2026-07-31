import React, { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  Users,
  MessageSquare,
  Clock,
  User,
  Monitor,
  UserPlus,
  Send,
} from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { DraggableWindow } from "@/components/DraggableWindow";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Card } from "@/components/ui/card";

const Overlay: React.FC = () => {
  const { user } = useAuthStore();
  const [visibleWindows, setVisibleWindows] = useState({
    friends: false,
    chat: false,
    clock: false,
    profile: false,
    system: false,
  });

  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClose = async () => {
    // Hide overlay (handled by backend)
    await invoke("hide_overlay_command");
  };

  useEffect(() => {
    // Set body background to transparent for acrylic effect
    document.body.style.backgroundColor = "transparent";
    return () => {
      document.body.style.backgroundColor = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black/80 flex items-center justify-center">

      <div className="absolute top-0 left-0 bg-gradient-to-b from-black to-transparent w-full h-64"></div>

      <div className="absolute top-0 left-0 z-[30] w-full h-fit">
        <div className="flex items-center justify-between w-full p-4">
          <div className="flex flex-col items-start gap-0 w-fit">
            <h1
              className="text-md font-bold italic uppercase"
            >
              {time.toLocaleTimeString()}
            </h1>
            <h1
              className="text-xs font-bold text-muted-foreground"
            >
              {time.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </h1>
          </div>
          <div className="flex items-center gap-2 bg-black shadow-xl shadow-zinc-800/30 rounded-md border-border border-2 p-2">
            <Button
              variant={visibleWindows.friends ? "default" : "outline"}
              onClick={() =>
                setVisibleWindows({
                  ...visibleWindows,
                  friends: !visibleWindows.friends,
                })
              }
              title="Friends"
            >
              <Users className="h-4 w-4" />
            </Button>
            <Button
              variant={visibleWindows.chat ? "default" : "outline"}
              onClick={() =>
                setVisibleWindows({
                  ...visibleWindows,
                  chat: !visibleWindows.chat,
                })
              }
              title="Chat"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button
              variant={visibleWindows.clock ? "default" : "outline"}
              onClick={() =>
                setVisibleWindows({
                  ...visibleWindows,
                  clock: !visibleWindows.clock,
                })
              }
              title="Clock"
            >
              <Clock className="h-4 w-4" />
            </Button>
            <Button
              variant={visibleWindows.profile ? "default" : "outline"}
              onClick={() =>
                setVisibleWindows({
                  ...visibleWindows,
                  profile: !visibleWindows.profile,
                })
              }
              title="Profile"
            >
              <User className="h-4 w-4" />
            </Button>
            <Button
              variant={visibleWindows.system ? "default" : "outline"}
              onClick={() =>
                setVisibleWindows({
                  ...visibleWindows,
                  system: !visibleWindows.system,
                })
              }
              title="System"
            >
              <Monitor className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 p-2">
            <img src={user?.avatar} alt="Avatar" className="w-8 h-8" />
            <span
              className="text-sm font-normal text-foreground"
            >
              {user?.username}
            </span>
            <Button variant="ghost" onClick={handleClose} title="Close">
              <X className="h-8 w-8" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Overlay Content */}
      <div className="relative z-[15] w-full h-full">
        {visibleWindows.friends && (
          <DraggableWindow
            title="Friends"
            icon={<Users className="h-4 w-4" />}
            defaultPosition={{ x: 100, y: 150 }}
            defaultSize={{ width: 400, height: 600 }}
            onClose={() =>
              setVisibleWindows({ ...visibleWindows, friends: false })
            }
          >
            <OverlayFriends />
          </DraggableWindow>
        )}

        {visibleWindows.chat && (
          <DraggableWindow
            title="Chat"
            icon={<MessageSquare className="h-4 w-4" />}
            defaultPosition={{ x: 550, y: 150 }}
            defaultSize={{ width: 400, height: 500 }}
            onClose={() =>
              setVisibleWindows({ ...visibleWindows, chat: false })
            }
          >
            <OverlayChat />
          </DraggableWindow>
        )}

        {visibleWindows.clock && (
          <DraggableWindow
            title="Clock"
            icon={<Clock className="h-4 w-4" />}
            defaultPosition={{ x: 1000, y: 150 }}
            defaultSize={{ width: 350, height: 300 }}
            onClose={() =>
              setVisibleWindows({ ...visibleWindows, clock: false })
            }
          >
            <OverlayClock />
          </DraggableWindow>
        )}

        {visibleWindows.profile && (
          <DraggableWindow
            title="Profile"
            icon={<User className="h-4 w-4" />}
            defaultPosition={{ x: 100, y: 800 }}
            defaultSize={{ width: 400, height: 300 }}
            onClose={() =>
              setVisibleWindows({ ...visibleWindows, profile: false })
            }
          >
            <OverlayProfile />
          </DraggableWindow>
        )}

        {visibleWindows.system && (
          <DraggableWindow
            title="System Information"
            icon={<Monitor className="h-4 w-4" />}
            defaultPosition={{ x: 550, y: 700 }}
            defaultSize={{ width: 400, height: 400 }}
            onClose={() =>
              setVisibleWindows({ ...visibleWindows, system: false })
            }
          >
            <OverlaySystem />
          </DraggableWindow>
        )}
      </div>
    </div>
  );
};
// Friends Component
const OverlayFriends: React.FC = () => {
  const { user, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<"friends" | "chat">("friends");
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [messageContent, setMessageContent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddFriend, setShowAddFriend] = useState(false);

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
    selectedChat ? { chatId: selectedChat as Id<"chats"> } : "skip"
  );
  const searchResults = useQuery(
    api.friends.searchUsers,
    showAddFriend && searchQuery.length >= 2 && user?.userId
      ? {
          query: searchQuery,
          currentUserId: user.userId as unknown as Id<"users">,
        }
      : "skip"
  );

  const sendFriendRequest = useMutation(api.friends.sendFriendRequest);
  const acceptFriendRequest = useMutation(api.friends.acceptFriendRequest);
  const sendMessage = useMutation(api.messages.sendMessage);

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

  const handleSendMessage = async () => {
    if (!user?.userId || !selectedChat || !messageContent.trim()) return;
    try {
      await sendMessage({
        senderId: user.userId as unknown as Id<"users">,
        chatId: selectedChat as Id<"chats">,
        content: messageContent,
        contentFormat: "markdown",
        images: [],
      });
      setMessageContent("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  if (!isAuthenticated || !user) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <p className="text-muted-foreground text-center mb-4">
          Please sign in to use Friends
        </p>
        <Button onClick={() => invoke("create_auth_window")}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-border/50">
        <button
          onClick={() => {
            setActiveTab("friends");
            setSelectedChat(null);
          }}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "friends"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Friends
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
            activeTab === "chat"
              ? "text-foreground border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Chat
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Sidebar */}
        <div className="w-64 border-r border-border/50 flex flex-col">
          {activeTab === "friends" ? (
            <>
              {/* Add Friend */}
              <div className="p-2 border-b border-border/50">
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => setShowAddFriend(true)}
                    className="flex-1 h-8 text-xs"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAddFriend(!showAddFriend)}
                    className="h-8 px-2"
                  >
                    <UserPlus className="h-3 w-3" />
                  </Button>
                </div>
                {showAddFriend && searchResults && searchResults.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                    {searchResults.map((result: any) => (
                      <div
                        key={result._id}
                        className="flex items-center justify-between p-1.5 hover:bg-muted/50 rounded text-xs"
                      >
                        <span className="truncate">{result.username}</span>
                        {result.friendshipStatus === null && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-xs"
                            onClick={() =>
                              sendFriendRequest({
                                userId: user.userId as unknown as Id<"users">,
                                friendId: result._id,
                              })
                            }
                          >
                            Add
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Friend Requests */}
              {friendRequests &&
                (friendRequests.received.length > 0 ||
                  friendRequests.sent.length > 0) && (
                  <div className="p-2 border-b border-border/50">
                    <h4 className="text-xs font-semibold mb-1">Requests</h4>
                    {friendRequests.received.map((req: any) => (
                      <div
                        key={req._id}
                        className="flex items-center justify-between p-1.5 hover:bg-muted/50 rounded text-xs"
                      >
                        <span className="truncate">{req.user?.username}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() =>
                            acceptFriendRequest({
                              userId: user.userId as unknown as Id<"users">,
                              friendId: req.user!._id,
                            })
                          }
                        >
                          Accept
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

              {/* Friends List */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {friends === undefined ? (
                  <div className="text-center text-muted-foreground text-xs py-4">
                    Loading...
                  </div>
                ) : friends.length === 0 ? (
                  <div className="text-center text-muted-foreground text-xs py-4">
                    No friends yet
                  </div>
                ) : (
                  friends.map((friend: any) => (
                    <div
                      key={friend._id}
                      className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                      onClick={() => {
                        const dmChat = chats?.find(
                          (c: any) =>
                            c.type === "dm" &&
                            c.otherMembers?.[0]?._id === friend._id
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
                            className="w-8 h-8 rounded-full"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">
                            {friend.username.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div
                          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${getStatusColor(friend.status)}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {friend.username}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {friend.status === "online" && friend.currentGame
                            ? `Playing ${friend.currentGame.title}`
                            : friend.status}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            /* Chat List */
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {chats === undefined ? (
                <div className="text-center text-muted-foreground text-xs py-4">
                  Loading...
                </div>
              ) : chats.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-4">
                  No chats yet
                </div>
              ) : (
                chats.map((chat: any) => {
                  const displayName =
                    chat.type === "dm"
                      ? chat.otherMembers?.[0]?.username || "Unknown"
                      : chat.name || "Group Chat";
                  const isSelected = selectedChat === chat._id;

                  return (
                    <div
                      key={chat._id}
                      onClick={() => setSelectedChat(chat._id)}
                      className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                        isSelected ? "bg-muted" : "hover:bg-muted/50"
                      }`}
                    >
                      {chat.type === "dm" && chat.otherMembers?.[0]?.avatar ? (
                        <img
                          src={chat.otherMembers[0].avatar}
                          alt={displayName}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {displayName}
                        </div>
                        {chat.lastMessage && (
                          <div className="text-xs text-muted-foreground truncate">
                            {chat.lastMessage.replace(/<[^>]*>/g, "")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Chat Area */}
        {activeTab === "chat" && selectedChat && (
          <div className="flex-1 flex flex-col">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {chatMessages === undefined ? (
                <div className="text-center text-muted-foreground text-xs py-4">
                  Loading...
                </div>
              ) : chatMessages.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-4">
                  No messages yet
                </div>
              ) : (
                chatMessages.map((message: any) => (
                  <div key={message._id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">
                        {message.senderUsername}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm pl-1">
                      {message.content.replace(/<[^>]*>/g, "")}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Message Input */}
            <div className="p-2 border-t border-border/50">
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
                  placeholder="Type a message..."
                  className="flex-1 h-8 text-xs"
                />
                <Button
                  size="sm"
                  onClick={handleSendMessage}
                  className="h-8 px-3"
                >
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "chat" && !selectedChat && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-muted-foreground text-sm">
              Select a chat to start messaging
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Chat Component
const OverlayChat: React.FC = () => {
  const [messages, setMessages] = useState<
    Array<{ id: string; text: string; time: string }>
  >([]);
  const [input, setInput] = useState("");

  const sendMessage = () => {
    if (!input.trim()) return;
    const newMessage = {
      id: Date.now().toString(),
      text: input,
      time: new Date().toLocaleTimeString(),
    };
    setMessages([...messages, newMessage]);
    setInput("");
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto mb-2 space-y-2">
        {messages.length === 0 ? (
          <p className="text-muted-foreground text-center">No messages yet</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="p-2 bg-muted rounded">
              <p className="text-sm">{msg.text}</p>
              <p className="text-xs text-muted-foreground">{msg.time}</p>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
          className="flex-1 px-3 py-2 bg-background border rounded"
          placeholder="Type a message..."
        />
        <Button onClick={sendMessage}>Send</Button>
      </div>
    </div>
  );
};

// Clock Component
const OverlayClock: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="text-6xl font-bold mb-4">{time.toLocaleTimeString()}</div>
      <div className="text-2xl text-muted-foreground">
        {time.toLocaleDateString()}
      </div>
    </div>
  );
};

// Profile Component
const OverlayProfile: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">Profile</h3>
      {user ? (
        <div className="space-y-2">
          <p>
            <strong>Username:</strong> {user.username || "Not set"}
          </p>
          <p>
            <strong>Email:</strong> {user.email || "Not set"}
          </p>
          {user.userId && (
            <p>
              <strong>User ID:</strong> {user.userId}
            </p>
          )}
          {user.bio && (
            <p>
              <strong>Bio:</strong> {user.bio}
            </p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground">Not logged in</p>
      )}
    </div>
  );
};

// System Component
const OverlaySystem: React.FC = () => {
  const { systemInfo, history } = useSystemInfo(2000); // Update every 2 seconds to reduce load

  const chartConfig = {
    cpu: {
      label: "CPU Usage",
      color: "var(--chart-1)",
    },
    memory: {
      label: "Memory Usage",
      color: "var(--chart-2)",
    },
  };

  // Format history data for charts
  const chartData = history.map((point, index) => ({
    time: index,
    cpu: point.cpu,
    memory: point.memory ?? 0,
    label: point.time,
  }));

  return (
    <div className="space-y-4 h-full flex flex-col">
      {systemInfo ? (
        <>
          {/* Static System Info */}
          <div className="flex flex-row items-center gap-2 w-full text-sm">
            <Card className="p-2 w-full">
              <span className="text-muted-foreground">Total RAM:</span>
              <span className="font-medium">
                {systemInfo?.totalRAM?.toFixed(2) ?? "0.00"} GB
              </span>
            </Card>
            <Card className="p-2 w-full">
              <span className="text-muted-foreground">Current CPU:</span>
              <span className="font-medium">
                {systemInfo?.cpuUsage?.toFixed(1) ?? "0.0"}%
              </span>
            </Card>
            <Card className="p-2 w-full">
              <span className="text-muted-foreground">Memory Usage:</span>
              <span className="font-medium">
                {systemInfo?.memoryUsage?.toFixed(1) ?? "0.0"}%
              </span>
            </Card>
          </div>

          {/* CPU Usage Chart */}
          {chartData.length > 0 && (
            <div className="flex flex-col">
              <Card className="p-2">
                <h4 className="text-sm font-semibold">CPU Usage</h4>
                <ChartContainer
                  config={chartConfig}
                  className="h-[120px] w-full"
                >
                  <AreaChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={() => ""}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      domain={[0, 100]}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          indicator="dot"
                          labelFormatter={(_value, payload) => {
                            const data = payload?.[0]?.payload;
                            return data?.label || "";
                          }}
                        />
                      }
                    />
                    <Area
                      dataKey="cpu"
                      type="monotone"
                      fill="var(--color-cpu)"
                      fillOpacity={0.2}
                      stroke="var(--color-cpu)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </Card>
            </div>
          )}

          {/* Memory Usage Chart */}
          {chartData.length > 0 && systemInfo.memoryUsage !== null && (
            <div className="flex flex-col pb-2">
              <Card className="p-2">
                <h4 className="text-sm font-semibold">Memory Usage</h4>
                <ChartContainer
                  config={chartConfig}
                  className="h-[120px] w-full"
                >
                  <AreaChart data={chartData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-muted"
                    />
                    <XAxis
                      dataKey="time"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      tickFormatter={() => ""}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      domain={[0, 100]}
                      tickFormatter={(val) => `${val}%`}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          indicator="dot"
                          labelFormatter={(_value, payload) => {
                            const data = payload?.[0]?.payload;
                            return data?.label || "";
                          }}
                        />
                      }
                    />
                    <Area
                      dataKey="memory"
                      type="monotone"
                      fill="var(--color-memory)"
                      fillOpacity={0.2}
                      stroke="var(--color-memory)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ChartContainer>
              </Card>
            </div>
          )}
        </>
      ) : (
        <p className="text-muted-foreground">Loading system information...</p>
      )}
    </div>
  );
};

export default Overlay;
