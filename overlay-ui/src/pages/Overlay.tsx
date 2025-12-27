import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Users, MessageSquare, Clock, User, Monitor, Globe } from "lucide-react";
import { FriendsWindow } from "@/components/FriendsWindow";
import { useAuthStore } from "@/stores/authStore";

const Overlay: React.FC = () => {
  const [activeTab, setActiveTab] = useState("browser");
  const [showNotification, setShowNotification] = useState(false);

  useEffect(() => {
    // Show notification on mount
    setShowNotification(true);
    const timer = setTimeout(() => setShowNotification(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.closeWindow();
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-transparent flex items-center justify-center">
      {/* Activation Notification */}
      {showNotification && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
          <Card className="p-4 bg-primary/90 text-primary-foreground">
            <p className="text-sm font-semibold">
              Overlay Activated - Press Shift+F1 to toggle
            </p>
          </Card>
        </div>
      )}

      {/* Main Overlay Content */}
      <Card className="w-[90vw] h-[85vh] max-w-6xl bg-background/95 backdrop-blur-md border-2">
        <div className="flex flex-col h-full">
          {/* Close button - floating in top right */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="absolute top-2 right-2 h-8 w-8 z-50"
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start px-4">
              <TabsTrigger value="browser" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Browser
              </TabsTrigger>
              <TabsTrigger value="friends" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Friends
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat
              </TabsTrigger>
              <TabsTrigger value="clock" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Clock
              </TabsTrigger>
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </TabsTrigger>
              <TabsTrigger value="system" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                System
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-auto p-4">
              <TabsContent value="browser" className="h-full m-0">
                <OverlayBrowser />
              </TabsContent>
              <TabsContent value="friends" className="h-full m-0">
                <OverlayFriends />
              </TabsContent>
              <TabsContent value="chat" className="h-full m-0">
                <OverlayChat />
              </TabsContent>
              <TabsContent value="clock" className="h-full m-0">
                <OverlayClock />
              </TabsContent>
              <TabsContent value="profile" className="h-full m-0">
                <OverlayProfile />
              </TabsContent>
              <TabsContent value="system" className="h-full m-0">
                <OverlaySystem />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </Card>
    </div>
  );
};

// Browser Component - simplified for Electron (using iframe)
const OverlayBrowser: React.FC = () => {
  const [url, setUrl] = useState("https://google.com");
  const [urlInput, setUrlInput] = useState("");

  const navigate = () => {
    let targetUrl = urlInput.trim();
    if (!targetUrl) return;

    // Normalize URL
    if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
      if (targetUrl.includes(".") && !targetUrl.includes(" ")) {
        targetUrl = `https://${targetUrl}`;
      } else {
        targetUrl = `https://www.google.com/search?q=${encodeURIComponent(targetUrl)}`;
      }
    }

    setUrl(targetUrl);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") navigate();
          }}
          className="flex-1 px-3 py-1 text-sm bg-background border rounded"
          placeholder="Enter URL..."
        />
        <Button size="sm" onClick={navigate}>
          Go
        </Button>
      </div>
      <div className="flex-1 border rounded overflow-hidden">
        <iframe
          src={url}
          className="w-full h-full border-0"
          title="Browser"
        />
      </div>
    </div>
  );
};

// Friends Component
const OverlayFriends: React.FC = () => {
  return (
    <div className="h-full">
      <FriendsWindow />
    </div>
  );
};

// Chat Component
const OverlayChat: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ id: string; text: string; time: string }>>([]);
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
      <div className="text-6xl font-bold mb-4">
        {time.toLocaleTimeString()}
      </div>
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
          <p><strong>Name:</strong> {user.name || "Not set"}</p>
          <p><strong>Email:</strong> {user.email || "Not set"}</p>
          <p><strong>User ID:</strong> {user._id || "Not set"}</p>
        </div>
      ) : (
        <p className="text-muted-foreground">Not logged in</p>
      )}
    </div>
  );
};

// System Component
const OverlaySystem: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<any>(null);

  useEffect(() => {
    const fetchSystemInfo = async () => {
      if (window.electronAPI) {
        // Query system info from database or use Node.js APIs
        const result = await window.electronAPI.dbQuery(
          "SELECT * FROM system_info LIMIT 1"
        );
        if (result.success && result.data) {
          setSystemInfo(result.data[0]);
        }
      }
    };
    fetchSystemInfo();
    const interval = setInterval(fetchSystemInfo, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">System Information</h3>
      {systemInfo ? (
        <div className="space-y-2">
          <p><strong>OS:</strong> {systemInfo.os || "Unknown"}</p>
          <p><strong>CPU:</strong> {systemInfo.cpu || "Unknown"}</p>
          <p><strong>RAM:</strong> {systemInfo.ram || "Unknown"}</p>
          <p><strong>GPU:</strong> {systemInfo.gpu || "Unknown"}</p>
        </div>
      ) : (
        <p className="text-muted-foreground">Loading system information...</p>
      )}
    </div>
  );
};

export default Overlay;

