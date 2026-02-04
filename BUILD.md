# Building Atlas as a Desktop App

This guide covers building Atlas as a cross-platform Electron desktop application.

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+ with pip
- **PyInstaller** (included in requirements.txt)

### Platform-specific requirements

**macOS:**
- Xcode Command Line Tools: `xcode-select --install`

**Windows:**
- Visual Studio Build Tools (for native modules)

**Linux:**
- Build essentials: `sudo apt install build-essential`

## Development

Run all services (backend, frontend, electron) concurrently:

```bash
# Install root dependencies
npm install

# Start development mode
npm run dev
```

This starts:
- Backend API at http://localhost:8000
- Frontend dev server at http://localhost:5173
- Electron window loading from dev server

## Building for Distribution

### 1. Build the frontend

```bash
npm run build:frontend
```

### 2. Bundle the Python backend

```bash
# Make sure PyInstaller is installed
pip install pyinstaller

# Bundle backend
npm run bundle:backend
```

This creates a standalone executable in `backend-dist/`.

### 3. Package with Electron

**For your current platform:**
```bash
npm run dist
```

**For specific platforms:**
```bash
npm run dist:mac    # macOS (.dmg, .zip)
npm run dist:win    # Windows (.exe, portable)
npm run dist:linux  # Linux (.AppImage, .deb)
```

Output will be in the `dist/` folder.

## Build Configuration

The electron-builder configuration is in `package.json` under the `"build"` key:

- **appId**: `com.atlas.calendar`
- **productName**: `Atlas`
- **extraResources**: Bundles the Python backend executable

## App Icons

Place your app icons in the `build/` directory:

- `build/icon.icns` - macOS icon (512x512 or larger)
- `build/icon.ico` - Windows icon
- `build/icons/` - Linux icons (multiple sizes: 16x16 to 512x512 PNG)

You can generate these from a single 1024x1024 PNG using tools like:
- [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder)
- [IconGenerator](https://github.com/nicklockwood/IconGenerator) (macOS)

## Troubleshooting

### Backend not starting
- Check that the backend executable exists in `backend-dist/`
- On macOS/Linux, ensure it's executable: `chmod +x backend-dist/backend`

### PyInstaller issues
- Make sure all hidden imports are listed in `backend/backend.spec`
- Use `--debug` flag for more verbose output

### Code signing (macOS)
For distribution outside the Mac App Store, you'll need:
1. Apple Developer account
2. Developer ID certificate
3. Notarization

Add to `package.json` build config:
```json
"mac": {
  "identity": "Developer ID Application: Your Name (TEAM_ID)"
}
```

## Architecture Notes

The desktop app bundles:
1. **Electron** - Desktop shell, window management
2. **React frontend** - Built static files
3. **Python backend** - PyInstaller executable
4. **SQLite database** - Stored in user's app data directory

On app launch:
1. Electron starts the bundled Python backend as a subprocess
2. Backend initializes SQLite database in user data folder
3. Electron loads the frontend, which connects to backend at localhost:8000
