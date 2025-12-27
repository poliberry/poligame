import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowLeft, ArrowRight, RefreshCw, Home, Bookmark, History, X } from "lucide-react";
import { MicaButton } from "@/components/MicaButton";
import { MicaInput } from "@/components/MicaInput";
import { MicaCard } from "@/components/MicaCard";
import { EmbeddedBrowser } from "@/components/EmbeddedBrowser";

const Browser: React.FC = () => {
  const [url, setUrl] = useState("https://www.google.com");
  const [currentUrl, setCurrentUrl] = useState("https://www.google.com");
  const [history, setHistory] = useState<string[]>([]);
  const [bookmarks, setBookmarks] = useState<Array<{ url: string; title: string }>>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyStack, setHistoryStack] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    loadBookmarks();
    loadHistory();
    // Add initial URL to history stack
    setHistoryStack([url]);
    setHistoryIndex(0);
  }, []);


  const loadBookmarks = async () => {
    try {
      const data = await invoke<Array<{ url: string; title: string }>>("get_bookmarks");
      setBookmarks(data);
    } catch (error) {
      console.error("Failed to load bookmarks:", error);
    }
  };

  const loadHistory = async () => {
    try {
      const data = await invoke<string[]>("get_history");
      setHistory(data);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  };

  const handleNavigate = async (navUrl?: string) => {
    const targetUrl = navUrl || url;
    
    // Normalize URL
    let normalizedUrl = targetUrl.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      if (normalizedUrl.includes(".") && !normalizedUrl.includes(" ")) {
        normalizedUrl = "https://" + normalizedUrl;
      } else {
        normalizedUrl = "https://www.google.com/search?q=" + encodeURIComponent(normalizedUrl);
      }
    }

    try {
      await invoke("navigate_url", { url: normalizedUrl });
      setCurrentUrl(normalizedUrl);
      
      // Update history stack
      const newStack = historyStack.slice(0, historyIndex + 1);
      newStack.push(normalizedUrl);
      setHistoryStack(newStack);
      setHistoryIndex(newStack.length - 1);
      
      // Reload history from database
      await loadHistory();
    } catch (error) {
      console.error("Failed to navigate:", error);
    }
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setCurrentUrl(historyStack[newIndex]);
    }
  };

  const handleForward = () => {
    if (historyIndex < historyStack.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentUrl(historyStack[newIndex]);
    }
  };

  const handleAddBookmark = async () => {
    try {
      await invoke("add_bookmark", { url: currentUrl, title: currentUrl });
      await loadBookmarks();
    } catch (error) {
      console.error("Failed to add bookmark:", error);
    }
  };

  const handleHome = () => {
    const homeUrl = "https://www.google.com";
    setUrl(homeUrl);
    handleNavigate(homeUrl);
  };

  const handleRefresh = () => {
    // Force iframe reload by updating key
    setRefreshKey((prev) => prev + 1);
    // Also try to reload via src update
    const iframe = document.querySelector(".browser-iframe-seamless") as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < historyStack.length - 1;

  return (
    <div className="browser-page">
      <div className="browser-toolbar">
        <div className="browser-nav-controls">
          <MicaButton 
            onClick={handleBack} 
            title="Back" 
            disabled={!canGoBack}
          >
            <ArrowLeft size={18} />
          </MicaButton>
          <MicaButton 
            onClick={handleForward} 
            title="Forward" 
            disabled={!canGoForward}
          >
            <ArrowRight size={18} />
          </MicaButton>
          <MicaButton onClick={handleRefresh} title="Refresh">
            <RefreshCw size={18} />
          </MicaButton>
          <MicaButton onClick={handleHome} title="Home">
            <Home size={18} />
          </MicaButton>
        </div>
        <div className="browser-address-bar">
          <MicaInput
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleNavigate();
              }
            }}
            placeholder="Enter URL or search..."
          />
        </div>
        <div className="browser-actions">
          <MicaButton onClick={handleAddBookmark} title="Bookmark">
            <Bookmark size={18} />
          </MicaButton>
          <MicaButton
            onClick={() => setShowBookmarks(!showBookmarks)}
            variant={showBookmarks ? "primary" : "default"}
            title="Bookmarks"
          >
            <Bookmark size={18} />
          </MicaButton>
          <MicaButton
            onClick={() => setShowHistory(!showHistory)}
            variant={showHistory ? "primary" : "default"}
            title="History"
          >
            <History size={18} />
          </MicaButton>
        </div>
      </div>

      <div className="browser-content">
        {showBookmarks && (
          <MicaCard className="browser-sidebar">
            <div className="sidebar-header-row">
              <h3>Bookmarks</h3>
              <MicaButton
                onClick={() => setShowBookmarks(false)}
                variant="default"
                className="sidebar-close"
              >
                <X size={16} />
              </MicaButton>
            </div>
            <div className="bookmark-list">
              {bookmarks.length === 0 ? (
                <div className="empty-list">No bookmarks yet</div>
              ) : (
                bookmarks.map((bookmark) => (
                  <div
                    key={bookmark.url}
                    className="bookmark-item"
                    onClick={() => {
                      handleNavigate(bookmark.url);
                      setShowBookmarks(false);
                    }}
                  >
                    <div className="bookmark-title">{bookmark.title}</div>
                    <div className="bookmark-url">{bookmark.url}</div>
                  </div>
                ))
              )}
            </div>
          </MicaCard>
        )}

        <div className="browser-view">
          <EmbeddedBrowser
            key={refreshKey}
            url={currentUrl}
            onUrlChange={(newUrl) => {
              setCurrentUrl(newUrl);
              setUrl(newUrl);
            }}
          />
        </div>

        {showHistory && (
          <MicaCard className="browser-sidebar">
            <div className="sidebar-header-row">
              <h3>History</h3>
              <MicaButton
                onClick={() => setShowHistory(false)}
                variant="default"
                className="sidebar-close"
              >
                <X size={16} />
              </MicaButton>
            </div>
            <div className="history-list">
              {history.length === 0 ? (
                <div className="empty-list">No history yet</div>
              ) : (
                history.map((item, index) => (
                  <div
                    key={index}
                    className="history-item"
                    onClick={() => {
                      handleNavigate(item);
                      setShowHistory(false);
                    }}
                  >
                    {item}
                  </div>
                ))
              )}
            </div>
          </MicaCard>
        )}
      </div>
    </div>
  );
};

export default Browser;
