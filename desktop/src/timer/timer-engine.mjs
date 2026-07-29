import { randomUUID } from 'node:crypto';

import { timerStoreLimits } from './timer-store.mjs';

const VISIBLE_POLL_MS = 15_000;
const HIDDEN_POLL_MS = 60_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createDesktopTimerEngine({
  targetSession,
  store,
  timerOrigin,
  getCurrentUser,
  notifyCompletion,
  now = () => Date.now(),
  randomUUIDFn = randomUUID,
  random = Math.random,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  logger = console,
} = {}) {
  if (!targetSession?.fetch) throw new Error('desktop timer requires an Electron session');
  if (!store?.load || !store?.save || !store?.clear) {
    throw new Error('desktop timer requires a durable store');
  }
  if (typeof getCurrentUser !== 'function') throw new Error('desktop timer requires a user resolver');
  if (typeof notifyCompletion !== 'function') throw new Error('desktop timer requires notifications');
  const origin = exactHttpsOrigin(timerOrigin);
  if (!origin) throw new Error('desktop timer origin must use HTTPS');

  let cache = null;
  let currentUser = null;
  let status = 'initializing';
  let startEnabled = false;
  let soundEnabled = true;
  let visible = true;
  let stopped = false;
  let conflict = null;
  let operationChain = Promise.resolve();
  let completionTimer = null;
  let tickTimer = null;
  let pollTimer = null;
  let retryTimer = null;
  let retryDelayMs = 1000;
  const listeners = new Set();

  function serial(operation) {
    const result = operationChain.catch(() => {}).then(operation);
    operationChain = result;
    return result;
  }

  async function initialize() {
    cache = await store.load();
    await refreshUser();
    if (!currentUser) {
      status = 'signed_out';
      emit();
      return snapshot();
    }
    if (!prepareOwner(currentUser.id)) {
      status = 'wrong_user';
      emit();
      return snapshot();
    }
    await persist();
    await reconcileNow('startup');
    return snapshot();
  }

  async function refreshUser() {
    currentUser = await getCurrentUser().catch(() => null);
    if (!currentUser?.id) currentUser = null;
    return currentUser;
  }

  function prepareOwner(userId) {
    if (!cache.ownerUserId) {
      cache.ownerUserId = userId;
      return true;
    }
    if (cache.ownerUserId === userId) return true;
    if (cache.active || cache.queuedCommands.length > 0) return false;
    cache.ownerUserId = userId;
    cache.serverRevision = 0;
    return true;
  }

  async function onAuthChange() {
    return serial(async () => {
      await refreshUser();
      clearSchedules();
      conflict = null;
      startEnabled = false;
      if (!currentUser) {
        status = 'signed_out';
        emit();
        return snapshot();
      }
      if (!prepareOwner(currentUser.id)) {
        status = 'wrong_user';
        emit();
        return snapshot();
      }
      await persist();
      return reconcileNow('auth-change');
    });
  }

  async function reconcile(reason = 'manual') {
    return serial(() => reconcileNow(reason));
  }

  async function reconcileNow(reason) {
    if (stopped || !cache) return snapshot();
    if (!currentUser) {
      await refreshUser();
      if (currentUser && prepareOwner(currentUser.id)) await persist();
    }
    if (!currentUser || cache.ownerUserId !== currentUser.id) {
      status = currentUser ? 'wrong_user' : 'signed_out';
      emit();
      return snapshot();
    }

    try {
      const runtime = await fetchRuntime();
      status = 'online';
      conflict = null;
      startEnabled = runtime.startEnabled;
      cache.serverRevision = runtime.revision;
      cache.active = runtime.active;
      await persist();

      if (cache.queuedCommands.length > 0) {
        await replayQueue(runtime);
      } else if (cache.active?.status === 'running'
        && Number.isFinite(Date.parse(cache.active.endAt))
        && now() >= Date.parse(cache.active.endAt)) {
        await enqueueCompletion(cache.active);
        await replayQueue(runtime);
      }

      retryDelayMs = 1000;
      clearRetry();
      scheduleForActive();
      schedulePoll();
      emit();
      return snapshot();
    } catch (error) {
      handleNetworkOrProtocolError(error, reason);
      scheduleForActive();
      scheduleRetry();
      emit();
      return snapshot();
    }
  }

  async function replayQueue(initialRuntime) {
    let runtime = initialRuntime;
    while (cache.queuedCommands.length > 0) {
      const queued = cache.queuedCommands[0];
      const response = await sendRawCommand({
        ...queued,
        payload: { clientId: cache.clientId },
      });
      if (response.status === 401) {
        status = 'signed_out';
        currentUser = null;
        return;
      }
      if (response.status === 409) {
        conflict = response.payload?.error || 'timer_revision_conflict';
        status = 'conflict';
        cache.serverRevision = response.payload?.runtime?.revision ?? cache.serverRevision;
        cache.active = response.payload?.runtime?.active ?? cache.active;
        await persist();
        return;
      }
      if (!response.ok) throw timerError('timer_replay_failed', response.status);
      runtime = validateRuntime(response.payload?.runtime);
      cache.queuedCommands.shift();
      cache.serverRevision = runtime.revision;
      cache.active = runtime.active;
      await persist();
    }
    startEnabled = runtime.startEnabled ?? startEnabled;
  }

  async function enqueueCompletion(active) {
    if (cache.queuedCommands.some(item => item.runId === active.runId && item.type === 'complete')) return;
    if (cache.queuedCommands.length >= timerStoreLimits.maxQueuedCommands) {
      status = 'recovery_blocked';
      throw timerError('timer_completion_queue_full');
    }
    const queued = {
      commandId: randomUUIDFn(),
      type: 'complete',
      runId: active.runId,
      expectedRevision: cache.serverRevision,
      occurredAt: new Date(now()).toISOString(),
      notified: false,
    };
    cache.queuedCommands.push(queued);
    await persist();

    queued.notified = true;
    await persist();
    try {
      await notifyCompletion({
        mode: active.mode,
        taskTitle: active.taskTitle,
        soundEnabled,
      });
    } catch (error) {
      logger.warn('desktop timer notification failed', error?.message || 'unknown');
    }
    scheduleForActive();
    emit();
  }

  async function performCommand(type, input = {}) {
    return serial(async () => {
      try {
        await requireUsableOwner();
        const runtime = await fetchRuntime();
        status = 'online';
        startEnabled = runtime.startEnabled;
        cache.serverRevision = runtime.revision;
        cache.active = runtime.active;
        await persist();

        let command;
        if (type === 'start') {
          validateStartInput(input);
          if (!startEnabled) throw timerError('server_timer_disabled', 409);
          command = {
            commandId: randomUUIDFn(),
            type,
            runId: input.runId || randomUUIDFn(),
            expectedRevision: runtime.revision,
            occurredAt: new Date(now()).toISOString(),
            payload: {
              clientId: cache.clientId,
              ownerKind: 'desktop',
              mode: input.mode,
              taskId: input.taskId || null,
              taskTitle: input.taskTitle || null,
              plannedSeconds: input.plannedSeconds,
            },
          };
        } else {
          const active = runtime.active;
          if (!active || input.runId !== active.runId) throw timerError('timer_run_not_active', 409);
          if (active.ownerClientId !== cache.clientId) throw timerError('timer_owned_by_other_client', 409);
          if (input.expectedRevision !== undefined && input.expectedRevision !== runtime.revision) {
            throw timerError('timer_revision_conflict', 409);
          }
          command = {
            commandId: input.commandId || randomUUIDFn(),
            type,
            runId: active.runId,
            expectedRevision: runtime.revision,
            occurredAt: new Date(now()).toISOString(),
            payload: { clientId: cache.clientId },
          };
        }

        const response = await sendRawCommand(command);
        if (response.status === 401) {
          status = 'signed_out';
          currentUser = null;
          throw timerError('auth_required', 401);
        }
        if (response.status === 409) {
          conflict = response.payload?.error || 'timer_revision_conflict';
          status = 'conflict';
          if (response.payload?.runtime) {
            const latest = validateRuntime(response.payload.runtime);
            cache.serverRevision = latest.revision;
            cache.active = latest.active;
            await persist();
          }
          emit();
          throw timerError(conflict, 409);
        }
        if (!response.ok) throw timerError(response.payload?.error || 'timer_command_failed', response.status);

        const next = validateRuntime(response.payload.runtime);
        cache.serverRevision = next.revision;
        cache.active = next.active;
        conflict = null;
        retryDelayMs = 1000;
        await persist();
        scheduleForActive();
        schedulePoll();
        emit();
        return snapshot();
      } catch (error) {
        handleNetworkOrProtocolError(error, `command:${type}`);
        if (!error?.status || error.status >= 500) scheduleRetry();
        emit();
        throw error;
      }
    });
  }

  async function completeNow(input = {}) {
    return serial(async () => {
      await requireUsableOwner();
      const active = cache.active;
      if (!active || active.status !== 'running') return snapshot();
      if (input.runId && input.runId !== active.runId) throw timerError('timer_run_not_active', 409);
      const endAt = Date.parse(active.endAt);
      if (!Number.isFinite(endAt) || now() < endAt) throw timerError('timer_complete_too_early', 409);
      await enqueueCompletion(active);
      try {
        const runtime = await fetchRuntime();
        await replayQueue(runtime);
        status = conflict ? 'conflict' : 'online';
      } catch (error) {
        handleNetworkOrProtocolError(error, 'completion');
        scheduleRetry();
      }
      scheduleForActive();
      emit();
      return snapshot();
    });
  }

  async function requireUsableOwner() {
    if (!currentUser) throw timerError('auth_required', 401);
    if (cache.ownerUserId !== currentUser.id) throw timerError('timer_cache_wrong_user', 409);
    if (status === 'wrong_user' || status === 'recovery_blocked') throw timerError(status, 409);
  }

  async function cancelForLogout(confirmCancel) {
    const active = cache?.active;
    const completionQueued = active
      && cache.queuedCommands.some(item => item.runId === active.runId && item.type === 'complete');
    if (!active || completionQueued) return true;
    const confirmed = await confirmCancel(publicActive(active));
    if (!confirmed) throw timerError('logout_cancelled');
    await performCommand('cancel', {
      runId: active.runId,
      expectedRevision: cache.serverRevision,
    });
    return true;
  }

  async function fetchRuntime() {
    const response = await targetSession.fetch(new URL('/api/timer/runtime', origin), {
      credentials: 'include',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await safeJson(response);
    if (response.status === 401) throw timerError('auth_required', 401);
    if (!response.ok) throw timerError(payload?.error || 'timer_runtime_failed', response.status);
    return validateRuntime(payload, true);
  }

  async function sendRawCommand(command) {
    const response = await targetSession.fetch(new URL('/api/timer/commands', origin), {
      method: 'POST',
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(10_000),
    });
    return {
      ok: response.ok,
      status: response.status,
      payload: await safeJson(response),
    };
  }

  async function persist() {
    cache = await store.save(cache);
  }

  function scheduleForActive() {
    clearCompletionTimer();
    clearTick();
    const active = cache?.active;
    if (!active || cache.ownerUserId !== currentUser?.id) return;
    const completionQueued = cache.queuedCommands.some(item => item.runId === active.runId);
    if (active.status === 'running' && active.endAt && !completionQueued) {
      const delay = Math.max(0, Date.parse(active.endAt) - now());
      completionTimer = setTimeoutFn(() => {
        completionTimer = null;
        void completeNow({ runId: active.runId });
      }, delay);
      completionTimer?.unref?.();
    }
    tickTimer = setIntervalFn(() => emit(), 1000);
    tickTimer?.unref?.();
  }

  function schedulePoll() {
    if (stopped || !currentUser) return;
    if (pollTimer) clearTimeoutFn(pollTimer);
    const base = visible ? VISIBLE_POLL_MS : HIDDEN_POLL_MS;
    const delay = jitter(base, random);
    pollTimer = setTimeoutFn(() => {
      pollTimer = null;
      void reconcile('poll');
    }, delay);
    pollTimer?.unref?.();
  }

  function scheduleRetry() {
    if (stopped || retryTimer || !currentUser) return;
    const delay = jitter(retryDelayMs, random);
    retryTimer = setTimeoutFn(() => {
      retryTimer = null;
      void reconcile('retry');
    }, delay);
    retryTimer?.unref?.();
    retryDelayMs = Math.min(MAX_BACKOFF_MS, retryDelayMs * 2);
  }

  function clearRetry() {
    if (retryTimer) clearTimeoutFn(retryTimer);
    retryTimer = null;
  }

  function clearCompletionTimer() {
    if (completionTimer) clearTimeoutFn(completionTimer);
    completionTimer = null;
  }

  function clearTick() {
    if (tickTimer) clearIntervalFn(tickTimer);
    tickTimer = null;
  }

  function clearSchedules() {
    clearCompletionTimer();
    clearTick();
    clearRetry();
    if (pollTimer) clearTimeoutFn(pollTimer);
    pollTimer = null;
  }

  function handleNetworkOrProtocolError(error, reason) {
    if (error?.status === 401 || error?.code === 'auth_required') {
      status = 'signed_out';
      currentUser = null;
      return;
    }
    if (error?.status === 409) {
      status = 'conflict';
      conflict = error.code || 'timer_revision_conflict';
      return;
    }
    status = error?.status >= 400 && error.status < 500 ? 'error' : 'offline';
    logger.warn(`desktop timer ${reason} failed`, error?.code || error?.message || 'unknown');
  }

  function setVisible(nextVisible) {
    visible = Boolean(nextVisible);
    schedulePoll();
  }

  function setSoundEnabled(nextEnabled) {
    soundEnabled = Boolean(nextEnabled);
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new Error('timer listener must be a function');
    listeners.add(listener);
    listener(snapshot());
    return () => listeners.delete(listener);
  }

  function emit() {
    const value = snapshot();
    for (const listener of listeners) listener(value);
  }

  function snapshot() {
    const sameUser = Boolean(cache && currentUser && cache.ownerUserId === currentUser.id);
    const active = sameUser ? cache.active : null;
    const completionPending = Boolean(active
      && cache.queuedCommands.some(item => item.runId === active.runId && item.type === 'complete'));
    const visibleActive = completionPending ? null : active;
    const presentedMode = completionPending && active
      ? (active.mode === 'focus' ? 'break' : 'focus')
      : active?.mode || null;
    return {
      schemaVersion: 1,
      revision: sameUser ? cache.serverRevision : 0,
      active: visibleActive ? publicActive(visibleActive, now()) : null,
      startEnabled: sameUser && startEnabled && status === 'online',
      clientId: cache?.clientId || null,
      connection: status,
      conflict,
      completionPending,
      presentedMode,
      queuedCommandCount: sameUser ? cache.queuedCommands.length : 0,
    };
  }

  async function stop() {
    stopped = true;
    clearSchedules();
    listeners.clear();
    if (cache) await persist();
  }

  async function removeLocalData() {
    return serial(async () => {
      clearSchedules();
      await store.clear();
      cache = await store.load();
      currentUser = null;
      status = 'signed_out';
      startEnabled = false;
      conflict = null;
      emit();
      return snapshot();
    });
  }

  return Object.freeze({
    initialize: () => serial(initialize),
    onAuthChange,
    reconcile,
    snapshot,
    subscribe,
    setVisible,
    setSoundEnabled,
    start: input => performCommand('start', input),
    pause: input => performCommand('pause', input),
    resume: input => performCommand('resume', input),
    cancel: input => performCommand('cancel', input),
    complete: completeNow,
    cancelForLogout,
    removeLocalData,
    stop,
  });
}

function validateRuntime(value, includeStartEnabled = false) {
  if (!value || typeof value !== 'object'
    || value.schemaVersion !== 1
    || !Number.isInteger(value.revision)
    || value.revision < 0) {
    throw timerError('timer_runtime_invalid');
  }
  const runtime = {
    revision: value.revision,
    active: value.active === null ? null : validateActive(value.active),
  };
  if (includeStartEnabled) runtime.startEnabled = value.startEnabled === true;
  return runtime;
}

function validateActive(value) {
  if (!value || typeof value !== 'object'
    || !validUuid(value.runId)
    || !validUuid(value.ownerClientId)
    || !['web', 'desktop'].includes(value.ownerKind)
    || !['focus', 'break'].includes(value.mode)
    || !['running', 'paused'].includes(value.status)
    || !Number.isInteger(value.plannedSeconds)
    || !Number.isInteger(value.remainingSeconds)) {
    throw timerError('timer_runtime_invalid');
  }
  return {
    runId: value.runId,
    ownerClientId: value.ownerClientId,
    ownerKind: value.ownerKind,
    mode: value.mode,
    taskId: typeof value.taskId === 'string' ? value.taskId : null,
    taskTitle: typeof value.taskTitle === 'string' ? value.taskTitle : null,
    plannedSeconds: value.plannedSeconds,
    remainingSeconds: value.remainingSeconds,
    status: value.status,
    startedAt: value.startedAt,
    endAt: value.endAt,
    pausedAt: value.pausedAt,
    businessTimeZone: value.businessTimeZone,
  };
}

function publicActive(active, currentTime = Date.now()) {
  const copy = { ...active };
  if (copy.status === 'running' && copy.endAt) {
    copy.remainingSeconds = Math.max(0, Math.ceil((Date.parse(copy.endAt) - currentTime) / 1000));
  }
  return copy;
}

function validateStartInput(input) {
  if (!input || !['focus', 'break'].includes(input.mode)
    || !Number.isInteger(input.plannedSeconds)
    || input.plannedSeconds < 60
    || input.plannedSeconds > 14_400
    || (input.taskId != null && (typeof input.taskId !== 'string' || input.taskId.length > 128))
    || (input.taskTitle != null
      && (typeof input.taskTitle !== 'string' || Array.from(input.taskTitle).length > 300))) {
    throw timerError('timer_start_input_invalid', 400);
  }
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
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

function validUuid(value) {
  return UUID_RE.test(String(value || ''));
}

function jitter(base, random) {
  return Math.max(1, Math.round(base * (0.8 + random() * 0.4)));
}

function timerError(code, status = 0) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

export const desktopTimerBudgets = Object.freeze({
  visiblePollMs: VISIBLE_POLL_MS,
  hiddenPollMs: HIDDEN_POLL_MS,
  maxBackoffMs: MAX_BACKOFF_MS,
});
