import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDesktopAuthController,
  desktopLoginUrl,
  validateAttemptResponse,
} from '../src/auth/desktop-auth.mjs';

const ATTEMPT_ID = '11111111-1111-4111-8111-111111111111';
const USER = {
  id: '22222222-2222-4222-8222-222222222222',
  email: 'same-user@example.com',
  name: 'Same User',
};
const CENTRAL = 'https://xsmity.cloud';
const APP = 'https://pomodoro.xsmity.cloud';

test('desktop login validates the server URL, keeps the secret in main, and verifies the normal session', async () => {
  const requests = [];
  let exchangeCount = 0;
  let openedUrl = '';
  let authenticatedUser = null;
  let modalClosed = false;

  const targetSession = mockSession(async (url, options) => {
    requests.push({ url: String(url), options });
    const path = new URL(url).pathname;
    if (path === '/auth/desktop/attempts') {
      const body = JSON.parse(options.body);
      assert.match(body.secretHash, /^[A-Za-z0-9_-]{43}$/);
      assert.equal('secret' in body, false);
      return jsonResponse(201, attemptPayload());
    }
    if (path.endsWith('/exchange')) {
      assert.match(options.headers.authorization, /^Desktop [A-Za-z0-9_-]{43}$/);
      exchangeCount += 1;
      return exchangeCount === 1
        ? jsonResponse(202, { status: 'pending', pollAfterMs: 1500 })
        : jsonResponse(200, { status: 'authenticated', user: USER });
    }
    if (path === '/auth/session') {
      return jsonResponse(200, { authenticated: true, user: USER });
    }
    throw new Error(`unexpected request ${url}`);
  });

  const controller = createDesktopAuthController({
    targetSession,
    centralOrigin: CENTRAL,
    appOrigin: APP,
    appVersion: '0.1.0',
    platform: 'win32',
    openExternal: async (url) => {
      openedUrl = url;
    },
    createLoginModal: (details) => {
      assert.equal(details.displayCode, 'K7M4Q2');
      return {
        cancelled: new Promise(() => {}),
        close: () => {
          modalClosed = true;
        },
      };
    },
    onAuthenticated: (user) => {
      authenticatedUser = user;
    },
    sleep: async () => {},
  });

  assert.deepEqual(await controller.login(), { status: 'authenticated' });
  assert.equal(openedUrl, `${CENTRAL}/auth/desktop/login?attempt=${ATTEMPT_ID}`);
  assert.deepEqual(authenticatedUser, USER);
  assert.equal(modalClosed, true);
  assert.equal(requests.some(({ url }) => url === `${CENTRAL}/auth/session`), true);

  const serialized = JSON.stringify(requests.map(({ url, options }) => ({
    url,
    body: options.body,
  })));
  assert.doesNotMatch(serialized, /authorization/i);
});

test('closing the modal aborts polling and cancels the attempt best effort', async () => {
  const methods = [];
  const targetSession = mockSession(async (url, options = {}) => {
    methods.push([new URL(url).pathname, options.method || 'GET']);
    if (new URL(url).pathname === '/auth/desktop/attempts') {
      return jsonResponse(201, attemptPayload());
    }
    if (options.method === 'DELETE') return jsonResponse(200, { status: 'denied' });
    throw new DOMException('Aborted', 'AbortError');
  });

  const controller = createDesktopAuthController({
    targetSession,
    centralOrigin: CENTRAL,
    appOrigin: APP,
    appVersion: '0.1.0',
    platform: 'win32',
    openExternal: async () => {},
    createLoginModal: () => ({
      cancelled: Promise.resolve(),
      close() {},
    }),
    sleep: (_ms, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    }),
  });

  assert.deepEqual(await controller.login(), { status: 'cancelled' });
  assert.equal(methods.some(([, method]) => method === 'DELETE'), true);
});

test('logout confirms the server response before removing the shared-domain cookie', async () => {
  const order = [];
  const targetSession = mockSession(async (url, options) => {
    order.push(`fetch:${new URL(url).pathname}:${options.method}`);
    return jsonResponse(200, { ok: true });
  }, (url, name) => {
    order.push(`remove:${new URL(url).origin}:${name}`);
  });

  const controller = createDesktopAuthController({
    targetSession,
    centralOrigin: CENTRAL,
    appOrigin: APP,
    appVersion: '0.1.0',
    platform: 'win32',
    openExternal: async () => {},
    createLoginModal: () => {
      throw new Error('not used');
    },
    onLoggedOut: () => order.push('logged-out'),
  });
  await controller.logout();
  assert.deepEqual(order, [
    'fetch:/auth/logout:POST',
    'remove:https://xsmity.cloud:xsmity.sid',
    'remove:https://pomodoro.xsmity.cloud:xsmity.sid',
    'logged-out',
  ]);
});

test('attempt response rejects arbitrary login destinations and malformed contracts', () => {
  assert.throws(
    () => validateAttemptResponse({ ...attemptPayload(), loginUrl: 'https://evil.test/login' }, CENTRAL),
    /desktop_attempt_response_invalid/,
  );
  assert.throws(
    () => validateAttemptResponse({ ...attemptPayload(), attemptId: 'not-a-uuid' }, CENTRAL),
    /desktop_attempt_response_invalid/,
  );
  assert.equal(
    desktopLoginUrl(CENTRAL, ATTEMPT_ID),
    `${CENTRAL}/auth/desktop/login?attempt=${ATTEMPT_ID}`,
  );
});

function attemptPayload() {
  return {
    attemptId: ATTEMPT_ID,
    displayCode: 'K7M4Q2',
    loginUrl: `${CENTRAL}/auth/desktop/login?attempt=${ATTEMPT_ID}`,
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    pollAfterMs: 1500,
  };
}

function mockSession(fetchImpl, removeImpl = () => {}) {
  return {
    fetch: fetchImpl,
    cookies: {
      remove: async (url, name) => removeImpl(url, name),
    },
  };
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
