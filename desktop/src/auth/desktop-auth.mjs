import { createHash, randomBytes } from 'node:crypto';

const ATTEMPT_PATH = '/auth/desktop/attempts';
const SESSION_PATH = '/auth/session';
const LOGOUT_PATH = '/auth/logout';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createDesktopAuthController({
  targetSession,
  centralOrigin,
  appOrigin,
  appVersion,
  platform,
  openExternal,
  createLoginModal,
  onAuthenticated = () => {},
  onLoggedOut = () => {},
  now = () => Date.now(),
  sleep = abortableSleep,
} = {}) {
  if (!targetSession?.fetch) throw new Error('desktop auth requires an Electron session');
  if (typeof openExternal !== 'function') throw new Error('desktop auth requires an external browser launcher');
  if (typeof createLoginModal !== 'function') throw new Error('desktop auth requires a login modal');

  const central = exactHttpsOrigin(centralOrigin);
  const app = exactHttpsOrigin(appOrigin);
  if (!central || !app) throw new Error('desktop auth origins must use HTTPS');

  let loginPromise = null;

  async function performLogin() {
    if (platform !== 'win32') throw safeError('desktop_platform_unsupported');
    const secret = randomBytes(32);
    const controller = new AbortController();
    let attempt = null;
    let modal = null;

    try {
      attempt = await createAttempt({
        targetSession,
        central,
        appVersion,
        platform,
        secretHash: createHash('sha256').update(secret).digest('base64url'),
        signal: controller.signal,
      });
      const loginUrl = desktopLoginUrl(central, attempt.attemptId);
      modal = createLoginModal({
        displayCode: attempt.displayCode,
        appVersion,
        expiresAt: attempt.expiresAt,
      });

      const cancelled = modal.cancelled.then(() => {
        controller.abort();
        return { status: 'cancelled' };
      });
      await openExternal(loginUrl);

      const result = await Promise.race([
        exchangeUntilResolved({
          targetSession,
          central,
          attempt,
          secret,
          signal: controller.signal,
          now,
          sleep,
        }),
        cancelled,
      ]);

      if (result.status === 'cancelled') {
        await cancelAttemptBestEffort({ targetSession, central, attemptId: attempt.attemptId, secret });
        return result;
      }
      if (result.status === 'expired') return result;
      if (result.status === 'denied') return { status: 'cancelled' };

      const sessionPayload = await fetchSession(targetSession, central);
      if (!sessionPayload.authenticated
        || String(sessionPayload.user?.id || '') !== String(result.user?.id || '')) {
        throw safeError('desktop_session_verification_failed');
      }
      modal.close();
      await onAuthenticated(sessionPayload.user);
      return { status: 'authenticated' };
    } catch (error) {
      if (controller.signal.aborted) {
        if (attempt) {
          await cancelAttemptBestEffort({ targetSession, central, attemptId: attempt.attemptId, secret });
        }
        return { status: 'cancelled' };
      }
      throw sanitizeDesktopAuthError(error);
    } finally {
      controller.abort();
      secret.fill(0);
      modal?.close();
    }
  }

  return Object.freeze({
    login() {
      if (!loginPromise) {
        loginPromise = performLogin().finally(() => {
          loginPromise = null;
        });
      }
      return loginPromise;
    },
    async logout() {
      const response = await targetSession.fetch(new URL(LOGOUT_PATH, central), {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: '{}',
        credentials: 'include',
      });
      if (!response.ok) throw safeError('desktop_logout_failed');
      await targetSession.cookies.remove(`${central}/`, 'xsmity.sid');
      await targetSession.cookies.remove(`${app}/`, 'xsmity.sid');
      await onLoggedOut();
    },
  });
}

async function createAttempt({
  targetSession,
  central,
  appVersion,
  platform,
  secretHash,
  signal,
}) {
  const response = await targetSession.fetch(new URL(ATTEMPT_PATH, central), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ secretHash, appVersion, platform }),
    credentials: 'include',
    signal,
  });
  if (!response.ok) throw safeError(response.status === 429 ? 'desktop_auth_rate_limited' : 'desktop_attempt_create_failed');
  return validateAttemptResponse(await response.json(), central);
}

async function exchangeUntilResolved({
  targetSession,
  central,
  attempt,
  secret,
  signal,
  now,
  sleep,
}) {
  const expiresAtMs = Date.parse(attempt.expiresAt);
  const endpoint = new URL(`${ATTEMPT_PATH}/${attempt.attemptId}/exchange`, central);
  let delayMs = boundedPollDelay(attempt.pollAfterMs);

  while (now() < expiresAtMs) {
    await sleep(delayMs, signal);
    const response = await targetSession.fetch(endpoint, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Desktop ${secret.toString('base64url')}`,
      },
      credentials: 'include',
      signal,
    });
    const payload = await safeJson(response);

    if (response.status === 202 && payload?.status === 'pending') {
      delayMs = boundedPollDelay(payload.pollAfterMs);
      continue;
    }
    if (response.ok && payload?.status === 'authenticated' && validPublicUser(payload.user)) {
      return { status: 'authenticated', user: payload.user };
    }
    if (response.status === 403 && payload?.error === 'desktop_login_denied') return { status: 'denied' };
    if (response.status === 410 && payload?.error === 'desktop_attempt_expired') return { status: 'expired' };
    if (response.status === 429) {
      delayMs = retryAfterMs(response.headers.get('retry-after'), delayMs);
      continue;
    }
    if (response.status === 409 && payload?.error === 'desktop_attempt_already_redeemed') {
      throw safeError('desktop_attempt_already_redeemed');
    }
    throw safeError('desktop_exchange_failed');
  }
  return { status: 'expired' };
}

async function cancelAttemptBestEffort({ targetSession, central, attemptId, secret }) {
  try {
    await targetSession.fetch(new URL(`${ATTEMPT_PATH}/${attemptId}`, central), {
      method: 'DELETE',
      headers: {
        accept: 'application/json',
        authorization: `Desktop ${secret.toString('base64url')}`,
      },
      credentials: 'include',
    });
  } catch {
    // The attempt expires after five minutes; cancellation is best effort.
  }
}

async function fetchSession(targetSession, central) {
  const response = await targetSession.fetch(new URL(SESSION_PATH, central), {
    headers: { accept: 'application/json' },
    credentials: 'include',
  });
  if (!response.ok) throw safeError('desktop_session_verification_failed');
  return response.json();
}

export function validateAttemptResponse(payload, centralOrigin) {
  const attemptId = String(payload?.attemptId || '');
  const displayCode = String(payload?.displayCode || '');
  const expiresAt = String(payload?.expiresAt || '');
  if (!UUID_RE.test(attemptId)
    || !/^[A-Z2-9]{6}$/.test(displayCode)
    || !Number.isFinite(Date.parse(expiresAt))
    || desktopLoginUrl(centralOrigin, attemptId) !== String(payload?.loginUrl || '')
    || !Number.isInteger(payload?.pollAfterMs)) {
    throw safeError('desktop_attempt_response_invalid');
  }
  return {
    attemptId,
    displayCode,
    expiresAt,
    pollAfterMs: boundedPollDelay(payload.pollAfterMs),
  };
}

export function desktopLoginUrl(centralOrigin, attemptId) {
  if (!UUID_RE.test(String(attemptId || ''))) throw safeError('desktop_attempt_response_invalid');
  const central = exactHttpsOrigin(centralOrigin);
  if (!central) throw safeError('desktop_attempt_response_invalid');
  const url = new URL('/auth/desktop/login', central);
  url.searchParams.set('attempt', attemptId);
  return url.toString();
}

function exactHttpsOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === url.toString().replace(/\/$/, '')
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function validPublicUser(user) {
  return Boolean(user && typeof user === 'object'
    && typeof user.id === 'string'
    && user.id.length <= 128
    && typeof user.email === 'string'
    && user.email.length <= 320);
}

function boundedPollDelay(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 1500;
  return Math.min(5000, Math.max(500, Math.round(number)));
}

function retryAfterMs(value, fallback) {
  const seconds = Number(value);
  return Number.isInteger(seconds) && seconds > 0
    ? Math.min(30_000, seconds * 1000)
    : fallback;
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function abortableSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason || new DOMException('Aborted', 'AbortError'));
      return;
    }
    const finish = () => {
      signal.removeEventListener('abort', abort);
      resolve();
    };
    const timer = setTimeout(finish, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}

function safeError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function sanitizeDesktopAuthError(error) {
  const allowedCodes = new Set([
    'desktop_platform_unsupported',
    'desktop_auth_rate_limited',
    'desktop_attempt_create_failed',
    'desktop_attempt_response_invalid',
    'desktop_attempt_already_redeemed',
    'desktop_exchange_failed',
    'desktop_session_verification_failed',
  ]);
  return safeError(allowedCodes.has(error?.code) ? error.code : 'desktop_auth_failed');
}
