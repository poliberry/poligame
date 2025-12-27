const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const { enable } = require('electron-acrylic-window');
const Store = require('electron-store');
const Database = require('better-sqlite3');

const store = new Store();

let mainWindow = null;
let db = null;

// Get database path (same as main app)
function getDatabasePath() {
  // Try to find the main app's database
  // Main app stores it in APPDATA/PoliGame/poligame.db on Windows
  const appDataPath = process.env.APPDATA || 
    (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library', 'Application Support') : 
     path.join(process.env.HOME, '.config'));
  const mainAppDataPath = path.join(appDataPath, 'PoliGame');
  const dbPath = path.join(mainAppDataPath, 'poligame.db');
  return dbPath;
}

// Initialize database connection
function initDatabase() {
  try {
    const dbPath = getDatabasePath();
    console.log('Connecting to database at:', dbPath);
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    // Create a fallback database in overlay's own userData
    const fallbackPath = path.join(app.getPath('userData'), 'poligame.db');
    console.log('Using fallback database at:', fallbackPath);
    db = new Database(fallbackPath);
    db.pragma('journal_mode = WAL');
  }
}

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    fullscreen: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true
    }
  });

  // Enable acrylic effect
  try {
    enable(mainWindow, {
      theme: 'dark',
      effect: 'acrylic',
      disableOnBlur: false,
      useCustomWindowRefreshMethod: true,
      maximumRefreshRate: 60
    });
    console.log('Acrylic effect enabled successfully');
  } catch (error) {
    console.error('Failed to enable acrylic effect:', error);
    console.warn('Falling back to CSS backdrop-filter');
  }

  // Load the app
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173/overlay');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'), {
      hash: '/overlay'
    });
  }

  // Hide window initially
  mainWindow.hide();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register global shortcut (Shift+F1)
function registerShortcut() {
  const ret = globalShortcut.register('Shift+F1', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.setFullScreen(true);
        mainWindow.focus();
      }
    }
  });

  if (!ret) {
    console.log('Failed to register global shortcut');
  }
}

// IPC handlers for database access
ipcMain.handle('db-query', async (event, sql, params = []) => {
  try {
    if (!db) {
      initDatabase();
    }
    const stmt = db.prepare(sql);
    const result = stmt.all(...params);
    return { success: true, data: result };
  } catch (error) {
    console.error('Database query error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-get', async (event, sql, params = []) => {
  try {
    if (!db) {
      initDatabase();
    }
    const stmt = db.prepare(sql);
    const result = stmt.get(...params);
    return { success: true, data: result };
  } catch (error) {
    console.error('Database get error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db-run', async (event, sql, params = []) => {
  try {
    if (!db) {
      initDatabase();
    }
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return { success: true, data: result };
  } catch (error) {
    console.error('Database run error:', error);
    return { success: false, error: error.message };
  }
});

// Get Convex URL from environment or store
ipcMain.handle('get-convex-url', () => {
  return process.env.VITE_CONVEX_URL || store.get('convexUrl', '');
});

ipcMain.handle('set-convex-url', (event, url) => {
  store.set('convexUrl', url);
  return { success: true };
});

// Window control handlers
ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

app.whenReady().then(() => {
  initDatabase();
  createWindow();
  registerShortcut();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Don't quit - keep running in background
  if (process.platform !== 'darwin') {
    // On Windows/Linux, keep the app running
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (db) {
    db.close();
  }
});

// Enable auto-start
const { setLoginItemSettings } = require('electron').app;
app.on('ready', () => {
  setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true
  });
});

