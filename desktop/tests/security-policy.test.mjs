import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isAllowedExternalNavigation,
  isAppNavigation,
  parseHttpsUrl,
} from '../src/url-policy.mjs';

test('only the exact Pomodoro origin may navigate in-app', () => {
  assert.equal(isAppNavigation('https://pomodoro.xsmity.cloud/'), true);
  assert.equal(isAppNavigation('https://pomodoro.xsmity.cloud.evil.test/'), false);
  assert.equal(isAppNavigation('http://pomodoro.xsmity.cloud/'), false);
});

test('external destinations use exact HTTPS origins', () => {
  assert.equal(isAllowedExternalNavigation('https://xsmity.cloud/auth/login'), true);
  assert.equal(isAllowedExternalNavigation('https://habits.xsmity.cloud/'), true);
  assert.equal(isAllowedExternalNavigation('https://evil.test/'), false);
  assert.equal(isAllowedExternalNavigation('javascript:alert(1)'), false);
  assert.equal(parseHttpsUrl('not a url'), null);
});
