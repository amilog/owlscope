import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { OwlScopeServer, type IncomingEvent } from './server.js';
import { startAdbReverseWatcher, type AdbReverseWatcher } from './adb-reverse.js';
import { DEFAULT_PORT } from '@owlscope/protocol';

const __filename = fileURLToPath(import.meta.url);
const __dirnameLocal = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
const wsServer = new OwlScopeServer(DEFAULT_PORT);
let adbWatcher: AdbReverseWatcher | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 320,
    minHeight: 240,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: join(__dirnameLocal, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirnameLocal, '../renderer/index.html'));
  }
}

function forwardToRenderer(e: IncomingEvent) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('owlscope:incoming', e);
}

app.whenReady().then(() => {
  wsServer.start();
  wsServer.onEvent(forwardToRenderer);
  // USB Android phones reach the desktop via `localhost:<port>` only when
  // `adb reverse` is active. Run a tiny watcher so the developer never has
  // to think about this — no-op if adb isn't installed.
  adbWatcher = startAdbReverseWatcher(DEFAULT_PORT);

  ipcMain.handle('owlscope:get-clients', () => wsServer.getConnectedClients());
  ipcMain.handle('owlscope:get-server-status', () => wsServer.getStatus());
  ipcMain.handle('owlscope:server:restart', () => {
    wsServer.stop();
    wsServer.start();
    return true;
  });
  ipcMain.handle('owlscope:set-always-on-top', (_e, value: boolean) => {
    if (!mainWindow || mainWindow.isDestroyed()) return false;
    mainWindow.setAlwaysOnTop(value, 'floating');
    return mainWindow.isAlwaysOnTop();
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  wsServer.stop();
  adbWatcher?.stop();
  adbWatcher = null;
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  wsServer.stop();
  adbWatcher?.stop();
  adbWatcher = null;
});
