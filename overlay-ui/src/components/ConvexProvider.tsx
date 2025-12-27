import React from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';

// Get Convex URL from Electron API or environment
const getConvexUrl = async (): Promise<string> => {
  if (window.electronAPI) {
    return await window.electronAPI.getConvexUrl();
  }
  return (import.meta as any).env?.VITE_CONVEX_URL || '';
};

// Create a wrapper that initializes Convex client
export const ConvexProviderWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [convexUrl, setConvexUrl] = React.useState<string>('');
  const [convexClient, setConvexClient] = React.useState<ConvexReactClient | null>(null);

  React.useEffect(() => {
    const initConvex = async () => {
      const url = await getConvexUrl();
      if (url) {
        setConvexUrl(url);
        setConvexClient(new ConvexReactClient(url));
      } else {
        console.warn('VITE_CONVEX_URL is not set. Convex features will not work.');
      }
    };
    initConvex();
  }, []);

  if (!convexClient) {
    return <>{children}</>;
  }

  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
};


