const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow = null;
let backendProcess = null;

const isDev = !app.isPackaged;
const BACKEND_PORT = 8000;

function getBackendPath() {
  if (isDev) {
    // In development, use the Python backend directly
    return null;
  }

  // In production, use the bundled backend
  const platform = process.platform;
  const backendName = platform === 'win32' ? 'backend.exe' : 'backend';

  // Check common locations for bundled backend
  const possiblePaths = [
    path.join(process.resourcesPath, 'backend', backendName),
    path.join(app.getAppPath(), '..', 'backend', backendName),
    path.join(app.getAppPath(), 'backend', backendName),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  console.error('Backend executable not found in:', possiblePaths);
  return null;
}

function startBackend() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      // In development, assume backend is running separately
      console.log('Development mode: expecting backend at http://localhost:' + BACKEND_PORT);
      resolve();
      return;
    }

    const backendPath = getBackendPath();
    if (!backendPath) {
      reject(new Error('Backend executable not found'));
      return;
    }

    console.log('Starting backend from:', backendPath);

    // Set up data directory in user's app data
    const userDataPath = app.getPath('userData');
    const dataDir = path.join(userDataPath, 'data');

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    backendProcess = spawn(backendPath, [], {
      env: {
        ...process.env,
        AIRCAL_DATA_DIR: dataDir,
        AIRCAL_PORT: BACKEND_PORT.toString(),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    backendProcess.stdout.on('data', (data) => {
      console.log(`Backend: ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
      console.error(`Backend error: ${data}`);
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend:', err);
      reject(err);
    });

    backendProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
      backendProcess = null;
    });

    // Wait for backend to be ready
    const maxAttempts = 30;
    let attempts = 0;

    const checkHealth = async () => {
      try {
        const response = await fetch(`http://localhost:${BACKEND_PORT}/health`);
        if (response.ok) {
          console.log('Backend is ready');
          resolve();
          return;
        }
      } catch (e) {
        // Backend not ready yet
      }

      attempts++;
      if (attempts >= maxAttempts) {
        reject(new Error('Backend failed to start in time'));
        return;
      }

      setTimeout(checkHealth, 500);
    };

    // Give backend a moment to start, then begin health checks
    setTimeout(checkHealth, 1000);
  });
}

function stopBackend() {
  if (backendProcess) {
    console.log('Stopping backend process...');
    backendProcess.kill();
    backendProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0a0f1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built files
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    await startBackend();
    createWindow();
  } catch (err) {
    console.error('Failed to start application:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopBackend();
});
