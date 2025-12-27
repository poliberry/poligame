# Building PoliGame Overlay UI

## Development

1. Install dependencies:
```bash
cd overlay-ui
npm install
```

2. Run in development mode:
```bash
npm run dev
```

This will:
- Start Vite dev server on port 5173
- Launch Electron with hot reload

## Production Build

1. Build the overlay:
```bash
npm run build
```

This creates a portable executable in `dist/` folder.

2. The overlay will be automatically built when building the main app:
```bash
npm run build
```

## Integration with Main App

The overlay executable (`polioverlayui.exe`) should be:
1. Built using `npm run build:overlay` in the root
2. Copied to the main app's resources folder during Tauri build
3. Launched automatically on system startup

## Auto-Start

The overlay is configured to start automatically on boot using Electron's `setLoginItemSettings`.

## Database Access

The overlay connects to the same SQLite database as the main app:
- Windows: `%APPDATA%\PoliGame\poligame.db`
- Falls back to overlay's own userData if main database not found

## Convex Integration

The overlay uses the same Convex deployment as the main app. Set `VITE_CONVEX_URL` in environment or it will be stored in Electron's store.


