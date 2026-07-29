import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BrowserWindow } from 'electron';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createDesktopLoginModal(parent, { displayCode, appVersion, expiresAt }) {
  const modal = new BrowserWindow({
    parent,
    modal: true,
    width: 480,
    height: 440,
    minWidth: 420,
    minHeight: 380,
    maximizable: false,
    minimizable: false,
    resizable: false,
    show: false,
    backgroundColor: '#0d0f0e',
    title: 'Sign in to Keshi',
    webPreferences: {
      preload: path.join(__dirname, 'login-preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: false,
    },
  });

  let resolveCancelled;
  let closingProgrammatically = false;
  const cancelled = new Promise((resolve) => {
    resolveCancelled = resolve;
  });

  modal.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    if (url === 'about:blank#cancel') modal.close();
  });
  modal.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  modal.once('ready-to-show', () => modal.show());
  modal.once('closed', () => {
    if (!closingProgrammatically) resolveCancelled();
  });
  void modal.loadFile(path.join(__dirname, 'login.html'), {
    query: {
      code: displayCode,
      version: appVersion,
      expires: expiresAt,
    },
  });

  return Object.freeze({
    cancelled,
    close() {
      if (modal.isDestroyed()) return;
      closingProgrammatically = true;
      modal.close();
    },
  });
}
