import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

import {
  app,
  autoUpdater,
  BrowserWindow,
  dialog,
  ipcMain,
  Notification,
  powerMonitor,
  safeStorage,
  session,
  shell,
} from 'electron';
import electronSquirrelStartup from 'electron-squirrel-startup';

import {
  APP_ORIGIN,
  CENTRAL_ORIGIN,
  applySessionSecurity,
  applyWebContentsSecurity,
  isAppNavigation,
} from './security.mjs';
import { createDesktopAuthController } from './auth/desktop-auth.mjs';
import { createDesktopLoginModal } from './auth/login-modal.mjs';
import IPC_CHANNELS from './ipc-channels.cjs';
import { createTray } from './shell/tray.mjs';
import { createDesktopTimerEngine } from './timer/timer-engine.mjs';
import { createEncryptedTimerStore } from './timer/timer-store.mjs';
import { createDesktopUpdater } from './update/desktop-updater.mjs';
import { removeDesktopUserDataForUninstall } from './uninstall-policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTITION = 'persist:keshi';
const APP_USER_MODEL_ID = 'cloud.xsmity.keshiPomodoro';

app.enableSandbox();

const handlingSquirrelEvent = process.platform === 'win32' && electronSquirrelStartup;
if (handlingSquirrelEvent && process.argv.includes('--squirrel-uninstall')) {
  removeDesktopUserDataForUninstall({
    appData: app.getPath('appData'),
    userData: app.getPath('userData'),
  });
}
if (handlingSquirrelEvent) app.quit();
const ownsSingleInstance = !handlingSquirrelEvent && app.requestSingleInstanceLock();
if (!ownsSingleInstance) app.quit();

let mainWindow = null;
let tray = null;
let isQuitting = false;
let explainedTray = false;
let authController = null;
let timerEngine = null;
let unsubscribeTimer = null;
let unsubscribeUpdater = null;
let updater = null;
let updaterSnapshot = null;
let quitPromise = null;
const smokeMode = !app.isPackaged && process.env.KESHI_DESKTOP_SMOKE === '1';
const autoLoginInDev = !app.isPackaged
  && process.env.KESHI_DESKTOP_AUTO_LOGIN === '1';

function appUrl() {
  if (!app.isPackaged) {
    const candidate = process.env.KESHI_DESKTOP_APP_URL;
    if (candidate && (isAppNavigation(candidate)
      || candidate.startsWith('http://127.0.0.1:')
      || candidate.startsWith('http://localhost:'))) {
      return candidate;
    }
  }
  return APP_ORIGIN;
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  timerEngine?.setVisible(true);
}

async function quitApp() {
  if (quitPromise) return quitPromise;
  quitPromise = requestQuit().finally(() => {
    if (!isQuitting) quitPromise = null;
  });
  return quitPromise;
}

async function requestQuit() {
  const snapshot = timerEngine?.snapshot();
  if (snapshot?.active && !smokeMode) {
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Quit Keshi?',
      message: 'A timer is still active.',
      detail: 'Quitting will not cancel it. Keshi will recover the server timer when you open the app again.',
      buttons: ['Keep Keshi running', 'Quit anyway'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (choice.response !== 1) return false;
  }
  unsubscribeTimer?.();
  unsubscribeUpdater?.();
  unsubscribeTimer = null;
  unsubscribeUpdater = null;
  await timerEngine?.stop();
  updater?.stop();
  isQuitting = true;
  app.quit();
  return true;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 840,
    minHeight: 620,
    show: false,
    backgroundColor: '#0d0f0e',
    title: 'Keshi Pomodoro',
    webPreferences: {
      partition: PARTITION,
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
      additionalArguments: [`--keshi-app-version=${app.getVersion()}`],
    },
  });

  applyWebContentsSecurity(mainWindow.webContents, { isPackaged: app.isPackaged });
  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('Keshi preload failed', path.basename(preloadPath), error?.message || 'unknown error');
  });

  const showFallback = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  }, 5000);
  showFallback.unref();

  mainWindow.once('ready-to-show', () => {
    clearTimeout(showFallback);
    if (!smokeMode) mainWindow?.show();
  });

  if (smokeMode) {
    mainWindow.webContents.once('did-finish-load', async () => {
      const runtime = await mainWindow.webContents.executeJavaScript(
        'window.keshiDesktop && window.keshiDesktop.runtime',
        true,
      );
      if (runtime?.kind !== 'electron' || runtime?.bridgeVersion !== 1) {
        console.error('KESHI_DESKTOP_SMOKE_FAILED', JSON.stringify(runtime));
        app.exit(1);
        return;
      }
      console.log('KESHI_DESKTOP_SMOKE_OK');
      isQuitting = true;
      app.quit();
    });
  }

  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow?.hide();
    timerEngine?.setVisible(false);
    if (!explainedTray) {
      explainedTray = true;
      void persistTrayExplanation();
      void dialog.showMessageBox({
        type: 'info',
        title: 'Keshi is still running',
        message: 'Keshi stays in the system tray so your timer can continue.',
        buttons: ['Got it'],
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  void mainWindow.loadURL(appUrl());
}

function requireTrustedRenderer(event) {
  const senderUrl = event.senderFrame?.url || '';
  if (!isAppNavigation(senderUrl)) throw new Error('untrusted_ipc_sender');
}

function registerAuthIpc(persistentSession) {
  authController = createDesktopAuthController({
    targetSession: persistentSession,
    centralOrigin: CENTRAL_ORIGIN,
    appOrigin: APP_ORIGIN,
    appVersion: app.getVersion(),
    platform: process.platform,
    openExternal: (url) => shell.openExternal(url),
    createLoginModal: (details) => createDesktopLoginModal(mainWindow, details),
    onAuthenticated: async () => {
      await timerEngine?.onAuthChange();
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
    },
    onLoggedOut: async () => {
      await timerEngine?.onAuthChange();
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.reload();
    },
  });

  ipcMain.handle(IPC_CHANNELS.authLogin, (event) => {
    requireTrustedRenderer(event);
    return authController.login();
  });
  ipcMain.handle(IPC_CHANNELS.authLogout, async (event) => {
    requireTrustedRenderer(event);
    await confirmCancelForLogout();
    await authController.logout();
  });
  ipcMain.handle(IPC_CHANNELS.authLogoutAndRemoveData, async (event) => {
    requireTrustedRenderer(event);
    const snapshot = timerEngine.snapshot();
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Sign out and remove desktop data?',
      message: 'This removes the desktop session and local recovery data.',
      detail: snapshot.queuedCommandCount > 0
        ? 'A completion is still waiting to sync. Removing data now permanently discards that local recovery record, but does not delete server history.'
        : 'Canonical tasks, history, and account data on the VPS are not deleted.',
      buttons: ['Keep my desktop data', 'Sign out and remove data'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    if (choice.response !== 1) throw new Error('local_data_removal_cancelled');
    await confirmCancelForLogout();
    await authController.logout();
    await timerEngine.removeLocalData();
    await persistentSession.clearStorageData();
    await persistentSession.clearCache();
  });
}

async function confirmCancelForLogout() {
  return timerEngine?.cancelForLogout(async (active) => {
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      title: 'Cancel timer and sign out?',
      message: `${active.mode === 'focus' ? 'Focus' : 'Break'} timer is still active.`,
      detail: 'Keshi must cancel the active timer online before signing out.',
      buttons: ['Stay signed in', 'Cancel timer and sign out'],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    return choice.response === 1;
  });
}

function registerTimerIpc() {
  const handle = (channel, operation) => {
    ipcMain.handle(channel, async (event, input) => {
      requireTrustedRenderer(event);
      return operation(input);
    });
  };
  handle(IPC_CHANNELS.timerSnapshot, () => timerEngine.snapshot());
  handle(IPC_CHANNELS.timerStart, input => timerEngine.start(input));
  handle(IPC_CHANNELS.timerPause, input => timerEngine.pause(input));
  handle(IPC_CHANNELS.timerResume, input => timerEngine.resume(input));
  handle(IPC_CHANNELS.timerCancel, input => timerEngine.cancel(input));
  handle(IPC_CHANNELS.preferenceSound, enabled => {
    timerEngine.setSoundEnabled(enabled);
  });

  ipcMain.on(IPC_CHANNELS.timerVisibility, (event, visible) => {
    requireTrustedRenderer(event);
    timerEngine.setVisible(visible);
    if (visible) void timerEngine.reconcile('renderer-visible');
  });
  ipcMain.on(IPC_CHANNELS.timerOnline, (event) => {
    requireTrustedRenderer(event);
    void timerEngine.reconcile('network-online');
  });
}

async function currentCentralUser(persistentSession) {
  try {
    const response = await persistentSession.fetch(new URL('/auth/session', CENTRAL_ORIGIN), {
      credentials: 'include',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    return payload?.authenticated && typeof payload.user?.id === 'string'
      ? payload.user
      : null;
  } catch {
    return null;
  }
}

async function createTimerEngine(persistentSession) {
  const store = createEncryptedTimerStore({
    directory: path.join(app.getPath('userData'), 'recovery'),
    safeStorage,
  });
  const engine = createDesktopTimerEngine({
    targetSession: persistentSession,
    store,
    timerOrigin: APP_ORIGIN,
    getCurrentUser: () => currentCentralUser(persistentSession),
    notifyCompletion: async ({ mode, taskTitle, soundEnabled }) => {
      if (!Notification.isSupported()) return;
      const notification = new Notification({
        title: mode === 'focus' ? 'Focus complete' : 'Break complete',
        body: taskTitle && mode === 'focus'
          ? `${taskTitle} is complete. Time for a break.`
          : mode === 'focus'
            ? 'Great work. Time for a break.'
            : 'Break is over. Ready to focus?',
        silent: !soundEnabled,
      });
      notification.on('click', showMainWindow);
      notification.show();
    },
  });
  await engine.initialize();
  return engine;
}

function publishTimerSnapshot(snapshot) {
  updater?.onTimerSnapshot(snapshot);
  tray?.update(snapshot, updaterSnapshot);
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.timerChanged, snapshot);
  }
}

function publishUpdaterSnapshot(snapshot) {
  const wasDownloaded = updaterSnapshot?.downloaded;
  updaterSnapshot = snapshot;
  tray?.update(timerEngine?.snapshot(), snapshot);
  if (snapshot.downloaded && !wasDownloaded && Notification.isSupported()) {
    const notification = new Notification({
      title: 'Keshi update ready',
      body: snapshot.deferred
        ? 'It will be available to install after the timer and recovery queue are idle.'
        : 'Open the tray menu when you are ready to restart and install it.',
      silent: true,
    });
    notification.on('click', showMainWindow);
    notification.show();
  }
}

async function loadTrayExplanation() {
  try {
    await readFile(path.join(app.getPath('userData'), 'tray-explained-v1'), 'utf8');
    explainedTray = true;
  } catch {
    explainedTray = false;
  }
}

async function persistTrayExplanation() {
  const directory = app.getPath('userData');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, 'tray-explained-v1'), '1\n', 'utf8');
}

if (ownsSingleInstance) {
  app.setAppUserModelId(APP_USER_MODEL_ID);

  app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
    event.preventDefault();
    callback(false);
  });

  app.on('second-instance', showMainWindow);
  app.on('before-quit', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    void quitApp();
  });

  app.whenReady().then(async () => {
    const persistentSession = session.fromPartition(PARTITION);
    applySessionSecurity(persistentSession);
    await loadTrayExplanation();
    timerEngine = await createTimerEngine(persistentSession);
    registerTimerIpc();
    createMainWindow();
    registerAuthIpc(persistentSession);
    if (autoLoginInDev) {
      void currentCentralUser(persistentSession)
        .then(user => {
          if (user) {
            console.log('KESHI_DESKTOP_DEV_AUTHENTICATED');
            return null;
          }
          console.log('KESHI_DESKTOP_DEV_PAIRING_REQUIRED');
          return authController.login();
        })
        .catch(error => {
          console.warn('Keshi dev auto-login failed', error?.message || 'unknown error');
        });
    }
    updater = createDesktopUpdater({
      autoUpdater,
      feedUrl: 'https://github.com/Xsmitylnwza/keshi-pomodoro/releases/latest/download',
      getTimerSnapshot: () => timerEngine.snapshot(),
      isPackaged: app.isPackaged,
      platform: process.platform,
    });
    tray = createTray({
      showWindow: showMainWindow,
      quitApp,
      installUpdate: () => updater.installIfIdle(),
    });
    unsubscribeTimer = timerEngine.subscribe(publishTimerSnapshot);
    unsubscribeUpdater = updater.subscribe(publishUpdaterSnapshot);
    updater.start();
    powerMonitor.on('resume', () => void timerEngine.reconcile('power-resume'));
    powerMonitor.on('unlock-screen', () => void timerEngine.reconcile('screen-unlock'));
  }).catch((error) => {
    console.error('Keshi startup failed', error?.message || 'unknown error');
    app.exit(1);
  });

  app.on('activate', showMainWindow);
  app.on('window-all-closed', () => {
    // The tray owns process lifetime on every platform in v1.
  });
}
