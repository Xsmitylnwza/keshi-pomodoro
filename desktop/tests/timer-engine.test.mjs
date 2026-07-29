import assert from 'node:assert/strict';
import test from 'node:test';

import { createDesktopTimerEngine, desktopTimerBudgets } from '../src/timer/timer-engine.mjs';
import { emptyTimerCache } from '../src/timer/timer-store.mjs';

const CLIENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RUN_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COMMAND_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const USER = { id: 'central-user-1', email: 'owner@example.com' };
const START_AT = Date.parse('2026-07-05T10:00:00.000Z');

test('desktop timer starts, pauses, resumes, and cancels through server authority', async () => {
  const fixture = createFixture();
  await fixture.engine.initialize();
  assert.equal(fixture.engine.snapshot().startEnabled, true);

  await fixture.engine.start({
    mode: 'focus',
    plannedSeconds: 60,
    taskId: 'task-1',
    taskTitle: 'Ship desktop timer',
  });
  assert.equal(fixture.engine.snapshot().active.status, 'running');

  await fixture.engine.pause({ runId: RUN_ID, expectedRevision: 1 });
  assert.equal(fixture.engine.snapshot().active.status, 'paused');
  await fixture.engine.resume({ runId: RUN_ID, expectedRevision: 2 });
  assert.equal(fixture.engine.snapshot().active.status, 'running');
  await fixture.engine.cancel({ runId: RUN_ID, expectedRevision: 3 });
  assert.equal(fixture.engine.snapshot().active, null);
  assert.deepEqual(fixture.commandTypes, ['start', 'pause', 'resume', 'cancel']);
});

test('offline completion is durably queued, notified once, then replayed FIFO', async () => {
  const fixture = createFixture();
  await fixture.engine.initialize();
  await fixture.engine.start({ mode: 'focus', plannedSeconds: 60 });
  fixture.advance(60_000);
  fixture.setOnline(false);

  const offline = await fixture.engine.complete({ runId: RUN_ID });
  assert.equal(offline.completionPending, true);
  assert.equal(offline.queuedCommandCount, 1);
  assert.equal(offline.presentedMode, 'break');
  assert.equal(fixture.notifications.length, 1);
  assert.equal(fixture.saved.queuedCommands[0].commandId, COMMAND_ID);

  fixture.setOnline(true);
  await fixture.engine.reconcile('network-online');
  const recovered = fixture.engine.snapshot();
  assert.equal(recovered.queuedCommandCount, 0);
  assert.equal(recovered.active, null);
  assert.equal(fixture.notifications.length, 1);
  assert.equal(fixture.commandTypes.filter(type => type === 'complete').length, 1);
});

test('wrong user never sees or replays another user cache', async () => {
  const fixture = createFixture({
    initialCache: {
      ...emptyTimerCache(CLIENT_ID),
      ownerUserId: 'different-user',
      serverRevision: 1,
      active: activeRuntime(),
      queuedCommands: [queuedCompletion()],
    },
  });
  const snapshot = await fixture.engine.initialize();
  assert.equal(snapshot.connection, 'wrong_user');
  assert.equal(snapshot.active, null);
  assert.equal(snapshot.queuedCommandCount, 0);
  assert.equal(fixture.fetchCount, 0);
});

test('401 retains encrypted outbox and signs the desktop timer out', async () => {
  const fixture = createFixture({ runtimeStatus: 401 });
  const snapshot = await fixture.engine.initialize();
  assert.equal(snapshot.connection, 'signed_out');
  assert.equal(snapshot.active, null);
  assert.equal(fixture.saved.ownerUserId, USER.id);
});

test('409 during FIFO replay stops the queue and exposes a blocking conflict', async () => {
  const cache = {
    ...emptyTimerCache(CLIENT_ID),
    ownerUserId: USER.id,
    serverRevision: 1,
    active: activeRuntime(),
    queuedCommands: [queuedCompletion()],
  };
  const fixture = createFixture({
    initialCache: cache,
    commandConflict: true,
    initialRuntime: runtimeEnvelope(1, activeRuntime()),
  });
  const snapshot = await fixture.engine.initialize();
  assert.equal(snapshot.connection, 'conflict');
  assert.equal(snapshot.conflict, 'timer_revision_conflict');
  assert.equal(snapshot.queuedCommandCount, 1);
});

test('polling uses visible and hidden intervals with bounded jitter', async () => {
  const delays = [];
  const fixture = createFixture({
    random: () => 0,
    setTimeoutFn: (_callback, delay) => {
      delays.push(delay);
      return { unref() {} };
    },
    clearTimeoutFn: () => {},
  });
  await fixture.engine.initialize();
  assert.equal(delays.includes(desktopTimerBudgets.visiblePollMs * 0.8), true);
  fixture.engine.setVisible(false);
  assert.equal(delays.includes(desktopTimerBudgets.hiddenPollMs * 0.8), true);
});

test('logout requires a successful online cancel and offline failure keeps the user signed in', async () => {
  const fixture = createFixture();
  await fixture.engine.initialize();
  await fixture.engine.start({ mode: 'focus', plannedSeconds: 60 });
  fixture.setOnline(false);

  await assert.rejects(
    () => fixture.engine.cancelForLogout(async () => true),
    /network_unavailable/,
  );
  assert.notEqual(fixture.engine.snapshot().active, null);
});

function createFixture({
  initialCache = emptyTimerCache(CLIENT_ID),
  initialRuntime = runtimeEnvelope(0, null),
  runtimeStatus = 200,
  commandConflict = false,
  random = () => 0.5,
  setTimeoutFn = () => ({ unref() {} }),
  clearTimeoutFn = () => {},
} = {}) {
  let currentMs = START_AT;
  let online = true;
  let runtime = structuredClone(initialRuntime);
  let saved = structuredClone(initialCache);
  let uuidIndex = 0;
  let fetchCount = 0;
  const commandTypes = [];
  const notifications = [];
  const uuidValues = [COMMAND_ID, RUN_ID, COMMAND_ID];

  const targetSession = {
    async fetch(url, options = {}) {
      fetchCount += 1;
      if (!online) throw Object.assign(new Error('network_unavailable'), { code: 'network_unavailable' });
      if (new URL(url).pathname === '/api/timer/runtime') {
        return jsonResponse(runtimeStatus, runtimeStatus === 200 ? runtime : { error: 'auth_required' });
      }
      const command = JSON.parse(options.body);
      commandTypes.push(command.type);
      if (commandConflict) {
        return jsonResponse(409, {
          error: 'timer_revision_conflict',
          runtime,
        });
      }
      runtime = applyCommand(runtime, command, currentMs);
      return jsonResponse(200, {
        status: 'ok',
        idempotent: false,
        resultRevision: runtime.revision,
        runtime,
      });
    },
  };
  const store = {
    async load() {
      return structuredClone(saved);
    },
    async save(value) {
      saved = structuredClone(value);
      return structuredClone(saved);
    },
    async clear() {
      saved = emptyTimerCache(CLIENT_ID);
    },
  };
  const engine = createDesktopTimerEngine({
    targetSession,
    store,
    timerOrigin: 'https://pomodoro.xsmity.cloud',
    getCurrentUser: async () => USER,
    notifyCompletion: async value => notifications.push(value),
    now: () => currentMs,
    randomUUIDFn: () => uuidValues[uuidIndex++] || `11111111-1111-4111-8111-${uuidIndex.toString().padStart(12, '0')}`,
    random,
    setTimeoutFn,
    clearTimeoutFn,
    setIntervalFn: () => ({ unref() {} }),
    clearIntervalFn: () => {},
    logger: { warn() {} },
  });

  return {
    engine,
    commandTypes,
    notifications,
    get saved() {
      return saved;
    },
    get fetchCount() {
      return fetchCount;
    },
    advance(ms) {
      currentMs += ms;
    },
    setOnline(value) {
      online = value;
    },
  };
}

function applyCommand(current, command, now) {
  const revision = current.revision + 1;
  if (command.type === 'start') {
    return runtimeEnvelope(revision, activeRuntime({
      runId: command.runId,
      ownerClientId: command.payload.clientId,
      mode: command.payload.mode,
      taskId: command.payload.taskId,
      taskTitle: command.payload.taskTitle,
      plannedSeconds: command.payload.plannedSeconds,
      remainingSeconds: command.payload.plannedSeconds,
      startedAt: new Date(now).toISOString(),
      endAt: new Date(now + command.payload.plannedSeconds * 1000).toISOString(),
    }));
  }
  if (command.type === 'pause') {
    return runtimeEnvelope(revision, {
      ...current.active,
      status: 'paused',
      endAt: null,
      pausedAt: new Date(now).toISOString(),
    });
  }
  if (command.type === 'resume') {
    return runtimeEnvelope(revision, {
      ...current.active,
      status: 'running',
      endAt: new Date(now + current.active.remainingSeconds * 1000).toISOString(),
      pausedAt: null,
    });
  }
  return runtimeEnvelope(revision, null);
}

function runtimeEnvelope(revision, active) {
  return {
    schemaVersion: 1,
    revision,
    active,
    startEnabled: true,
  };
}

function activeRuntime(overrides = {}) {
  return {
    runId: RUN_ID,
    ownerClientId: CLIENT_ID,
    ownerKind: 'desktop',
    mode: 'focus',
    taskId: null,
    taskTitle: null,
    plannedSeconds: 60,
    remainingSeconds: 60,
    status: 'running',
    startedAt: new Date(START_AT).toISOString(),
    endAt: new Date(START_AT + 60_000).toISOString(),
    pausedAt: null,
    businessTimeZone: 'Asia/Bangkok',
    ...overrides,
  };
}

function queuedCompletion() {
  return {
    commandId: COMMAND_ID,
    type: 'complete',
    runId: RUN_ID,
    expectedRevision: 1,
    occurredAt: new Date(START_AT + 60_000).toISOString(),
    notified: true,
  };
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
