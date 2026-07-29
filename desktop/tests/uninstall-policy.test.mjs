import assert from 'node:assert/strict';
import test from 'node:test';

import { removeDesktopUserDataForUninstall } from '../src/uninstall-policy.mjs';

test('uninstall removes only the resolved application userData below appData', () => {
  const calls = [];
  const target = removeDesktopUserDataForUninstall({
    appData: 'C:\\Users\\owner\\AppData\\Roaming',
    userData: 'C:\\Users\\owner\\AppData\\Roaming\\Keshi Pomodoro',
    remove: (...args) => calls.push(args),
  });
  assert.match(target, /Keshi Pomodoro$/);
  assert.deepEqual(calls[0][1], { recursive: true, force: true });
});

test('uninstall refuses broad, parent, and unrelated targets', () => {
  const remove = () => assert.fail('remove must not be called');
  for (const userData of [
    'C:\\Users\\owner\\AppData\\Roaming',
    'C:\\Users\\owner',
    'D:\\OtherApp',
  ]) {
    assert.throws(
      () => removeDesktopUserDataForUninstall({
        appData: 'C:\\Users\\owner\\AppData\\Roaming',
        userData,
        remove,
      }),
      /desktop_uninstall_path_invalid/,
    );
  }
});
