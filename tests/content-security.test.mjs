import assert from 'node:assert/strict';
import test from 'node:test';

import {
  contentSecurityHeaders,
  POMODORO_CSP,
} from '../server/content-security.mjs';

test('production CSP is restrictive and contains only reviewed remote capabilities', () => {
  const headers = contentSecurityHeaders('enforce');
  assert.equal(headers['content-security-policy'], POMODORO_CSP);
  assert.match(POMODORO_CSP, /default-src 'self'/);
  assert.match(POMODORO_CSP, /object-src 'none'/);
  assert.match(POMODORO_CSP, /frame-ancestors 'none'/);
  assert.match(POMODORO_CSP, /frame-src https:\/\/www\.youtube\.com/);
  assert.doesNotMatch(POMODORO_CSP, /fonts\.googleapis|supabase/);
  assert.doesNotMatch(POMODORO_CSP, /script-src[^;]*unsafe-inline/);
});

test('CSP supports an explicit report-only rollout and an emergency disable', () => {
  assert.equal(
    contentSecurityHeaders('report-only')['content-security-policy-report-only'],
    POMODORO_CSP,
  );
  assert.deepEqual(contentSecurityHeaders('disabled'), {});
});
