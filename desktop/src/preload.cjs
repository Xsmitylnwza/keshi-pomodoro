const { contextBridge, ipcRenderer } = require('electron');
const IPC_CHANNELS = Object.freeze({
  authLogin: 'keshi:auth:login',
  authLogout: 'keshi:auth:logout',
  authLogoutAndRemoveData: 'keshi:auth:logout-and-remove-data',
  timerSnapshot: 'keshi:timer:snapshot',
  timerStart: 'keshi:timer:start',
  timerPause: 'keshi:timer:pause',
  timerResume: 'keshi:timer:resume',
  timerCancel: 'keshi:timer:cancel',
  timerChanged: 'keshi:timer:changed',
  timerVisibility: 'keshi:timer:visibility',
  timerOnline: 'keshi:timer:online',
  preferenceSound: 'keshi:preferences:sound',
});

const versionArgument = process.argv.find((value) => value.startsWith('--keshi-app-version='));
const appVersion = versionArgument?.slice('--keshi-app-version='.length) || '0.1.0';

const runtime = Object.freeze({
  kind: 'electron',
  bridgeVersion: 1,
  platform: process.platform,
  appVersion,
});

const auth = Object.freeze({
  login: () => ipcRenderer.invoke(IPC_CHANNELS.authLogin),
  logout: () => ipcRenderer.invoke(IPC_CHANNELS.authLogout),
  logoutAndRemoveLocalData: () => ipcRenderer.invoke(IPC_CHANNELS.authLogoutAndRemoveData),
});

const timer = Object.freeze({
  snapshot: () => ipcRenderer.invoke(IPC_CHANNELS.timerSnapshot),
  start: input => ipcRenderer.invoke(IPC_CHANNELS.timerStart, input),
  pause: input => ipcRenderer.invoke(IPC_CHANNELS.timerPause, input),
  resume: input => ipcRenderer.invoke(IPC_CHANNELS.timerResume, input),
  cancel: input => ipcRenderer.invoke(IPC_CHANNELS.timerCancel, input),
  subscribe: (listener) => {
    if (typeof listener !== 'function') throw new TypeError('timer listener must be a function');
    const handler = (_event, value) => listener(value);
    ipcRenderer.on(IPC_CHANNELS.timerChanged, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.timerChanged, handler);
  },
  signalVisibility: visible => ipcRenderer.send(IPC_CHANNELS.timerVisibility, Boolean(visible)),
  signalOnline: () => ipcRenderer.send(IPC_CHANNELS.timerOnline),
});

const preferences = Object.freeze({
  setSoundEnabled: enabled => ipcRenderer.invoke(IPC_CHANNELS.preferenceSound, Boolean(enabled)),
});

contextBridge.exposeInMainWorld(
  'keshiDesktop',
  Object.freeze({ runtime, auth, timer, preferences }),
);
