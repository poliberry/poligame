const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Database methods
  dbQuery: (sql, params) => ipcRenderer.invoke('db-query', sql, params),
  dbGet: (sql, params) => ipcRenderer.invoke('db-get', sql, params),
  dbRun: (sql, params) => ipcRenderer.invoke('db-run', sql, params),
  
  // Convex URL
  getConvexUrl: () => ipcRenderer.invoke('get-convex-url'),
  setConvexUrl: (url) => ipcRenderer.invoke('set-convex-url', url),
  
  // Window controls
  closeWindow: () => ipcRenderer.send('close-window'),
  minimizeWindow: () => ipcRenderer.send('minimize-window'),
});


