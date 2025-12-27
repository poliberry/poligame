import React, { useRef, useEffect, useState } from "react";

interface EmbeddedBrowserProps {
  url: string;
  onUrlChange?: (url: string) => void;
  className?: string;
}

/**
 * Embedded Browser Component using Tauri's WebView capabilities
 * This creates a seamless browser experience similar to Steam's embedded browser
 */
export const EmbeddedBrowser: React.FC<EmbeddedBrowserProps> = ({
  url,
  onUrlChange,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentUrl, setCurrentUrl] = useState(url);

  useEffect(() => {
    setCurrentUrl(url);
  }, [url]);

  // For Tauri, we use an iframe that's styled to be seamless
  // This provides the best embedded browser experience
  return (
    <div ref={containerRef} className={`embedded-browser ${className}`}>
      <iframe
        key={currentUrl}
        src={currentUrl}
        className="browser-iframe-seamless"
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation allow-downloads"
        allow="clipboard-read; clipboard-write; geolocation; microphone; camera"
        frameBorder="0"
        onLoad={() => {
          // Try to detect URL changes
          const iframe = containerRef.current?.querySelector("iframe");
          if (iframe && onUrlChange) {
            try {
              const iframeUrl = iframe.contentWindow?.location.href;
              if (iframeUrl && iframeUrl !== currentUrl) {
                setCurrentUrl(iframeUrl);
                onUrlChange(iframeUrl);
              }
            } catch (e) {
              // Cross-origin restrictions - expected for most sites
            }
          }
        }}
      />
    </div>
  );
};

