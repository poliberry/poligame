export interface ElectronAPI {
  dbQuery: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
  dbGet: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
  dbRun: (sql: string, params?: any[]) => Promise<{ success: boolean; data?: any; error?: string }>;
  getConvexUrl: () => Promise<string>;
  setConvexUrl: (url: string) => Promise<{ success: boolean }>;
  closeWindow: () => void;
  minimizeWindow: () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}


