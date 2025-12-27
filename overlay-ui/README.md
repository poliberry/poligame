# PoliGame Overlay UI

Separate Electron application for the game overlay interface.

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

## Features

- Fullscreen overlay with acrylic effect
- Global shortcut (Shift+F1) to toggle
- Connects to same database as main app
- Uses Convex for authentication
- Auto-starts on boot

## Configuration

Set `VITE_CONVEX_URL` in environment or it will be retrieved from Electron store.


