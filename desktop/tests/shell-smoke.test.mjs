import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mainSource = await readFile(new URL('../src/main.mjs', import.meta.url), 'utf8');
const preloadSource = await readFile(new URL('../src/preload.cjs', import.meta.url), 'utf8');

test('shell keeps Electron security defaults explicit', () => {
  assert.match(mainSource, /nodeIntegration:\s*false/);
  assert.match(mainSource, /contextIsolation:\s*true/);
  assert.match(mainSource, /sandbox:\s*true/);
  assert.match(mainSource, /webSecurity:\s*true/);
  assert.match(mainSource, /persist:keshi/);
  assert.match(mainSource, /titleBarStyle:\s*'hidden'/);
  assert.match(mainSource, /titleBarOverlay:[\s\S]+color:\s*'#00000000'/);
  assert.match(mainSource, /mainWindow\.setMenuBarVisibility\(false\)/);
  assert.match(mainSource, /Menu\.setApplicationMenu\(null\)/);
});

test('automatic login is opt-in for development and disabled when packaged', () => {
  assert.match(
    mainSource,
    /const autoLoginInDev = !app\.isPackaged[\s\S]+KESHI_DESKTOP_AUTO_LOGIN === '1'/,
  );
  assert.match(
    mainSource,
    /currentCentralUser\(persistentSession\)[\s\S]+KESHI_DESKTOP_DEV_AUTHENTICATED/,
  );
  assert.match(mainSource, /KESHI_DESKTOP_DEV_PAIRING_REQUIRED[\s\S]+authController\.login\(\)/);
});

test('preload exposes a versioned runtime object with only named narrow IPC', () => {
  assert.match(preloadSource, /bridgeVersion:\s*1/);
  assert.match(preloadSource, /IPC_CHANNELS\.authLogin/);
  assert.match(preloadSource, /IPC_CHANNELS\.authLogout/);
  assert.match(preloadSource, /IPC_CHANNELS\.timerSnapshot/);
  assert.match(preloadSource, /IPC_CHANNELS\.timerVisibility/);
  assert.match(preloadSource, /IPC_CHANNELS\.preferenceSound/);
  assert.doesNotMatch(preloadSource, /ipcRenderer\.(?:invoke|send)\s*\(\s*['"`]/);
  assert.doesNotMatch(preloadSource, /invoke\s*\(\s*[^I]/);
});
