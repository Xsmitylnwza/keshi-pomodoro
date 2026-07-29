import { shell } from 'electron';

import {
  isAllowedExternalNavigation,
  isAppNavigation,
} from './url-policy.mjs';

export {
  APP_ORIGIN,
  CENTRAL_ORIGIN,
  isAllowedExternalNavigation,
  isAppNavigation,
  parseHttpsUrl,
} from './url-policy.mjs';

export async function openAllowedExternal(value) {
  if (!isAllowedExternalNavigation(value)) return false;
  await shell.openExternal(new URL(value).toString());
  return true;
}

export function applySessionSecurity(targetSession) {
  targetSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  targetSession.setPermissionCheckHandler(() => false);
  targetSession.on('will-download', (event) => event.preventDefault());
}

export function applyWebContentsSecurity(contents, { isPackaged }) {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalNavigation(url)) {
      void openAllowedExternal(url);
    }
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (isAppNavigation(url)) return;
    event.preventDefault();
    if (isAllowedExternalNavigation(url)) {
      void openAllowedExternal(url);
    }
  });

  if (isPackaged) {
    contents.on('devtools-opened', () => contents.closeDevTools());
    contents.on('before-input-event', (event, input) => {
      const devtoolsKey = input.key === 'F12'
        || (input.control && input.shift && input.key.toLowerCase() === 'i');
      if (devtoolsKey) event.preventDefault();
    });
  }
}
