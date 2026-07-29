import assert from 'node:assert/strict';
import test from 'node:test';

import { createTimerRuntimeService, normalizeRuntime } from '../server/timer-runtime.mjs';

const USER_KEY = 'central-user-1';
const CLIENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_CLIENT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RUN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const START_COMMAND = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PAUSE_COMMAND = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const RESUME_COMMAND = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const COMPLETE_COMMAND = '11111111-1111-4111-8111-111111111111';

test('server runtime arbitrates ownership, revisions, pause/resume, and one completion projection', async () => {
  const fixture = createFixture();
  const service = fixture.service;

  assert.deepEqual(await service.runtime(USER_KEY), {
    schemaVersion: 1,
    revision: 0,
    active: null,
  });

  const started = await service.command(USER_KEY, USER_KEY, startCommand(fixture.clock()));
  assert.equal(started.status, 200);
  assert.equal(started.body.runtime.revision, 1);
  assert.equal(started.body.runtime.active.ownerUserId, undefined);
  assert.equal(started.body.runtime.active.remainingSeconds, 60);

  const secondStart = await service.command(USER_KEY, USER_KEY, {
    ...startCommand(fixture.clock()),
    commandId: '22222222-2222-4222-8222-222222222222',
    runId: '33333333-3333-4333-8333-333333333333',
    expectedRevision: 1,
  });
  assert.equal(secondStart.status, 409);
  assert.equal(secondStart.body.error, 'timer_already_active');

  const wrongOwner = await service.command(USER_KEY, USER_KEY, transitionCommand(
    'pause',
    PAUSE_COMMAND,
    1,
    fixture.clock(),
    OTHER_CLIENT_ID,
  ));
  assert.equal(wrongOwner.status, 409);
  assert.equal(wrongOwner.body.error, 'timer_owned_by_other_client');

  fixture.advance(20_100);
  const paused = await service.command(
    USER_KEY,
    USER_KEY,
    transitionCommand('pause', PAUSE_COMMAND, 1, fixture.clock()),
  );
  assert.equal(paused.status, 200);
  assert.equal(paused.body.runtime.active.status, 'paused');
  assert.equal(paused.body.runtime.active.remainingSeconds, 40);

  const stale = await service.command(
    USER_KEY,
    USER_KEY,
    transitionCommand('resume', RESUME_COMMAND, 1, fixture.clock()),
  );
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error, 'timer_revision_conflict');
  assert.equal(stale.body.runtime.revision, 2);

  const resumed = await service.command(
    USER_KEY,
    USER_KEY,
    transitionCommand('resume', RESUME_COMMAND, 2, fixture.clock()),
  );
  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.runtime.active.status, 'running');

  const early = await service.command(
    USER_KEY,
    USER_KEY,
    transitionCommand('complete', COMPLETE_COMMAND, 3, fixture.clock()),
  );
  assert.equal(early.status, 409);
  assert.equal(early.body.error, 'timer_complete_too_early');

  fixture.advance(40_000);
  const completed = await service.command(
    USER_KEY,
    USER_KEY,
    transitionCommand('complete', COMPLETE_COMMAND, 3, fixture.clock()),
  );
  assert.equal(completed.status, 200);
  assert.equal(completed.body.runtime.active, null);
  assert.equal(fixture.state.events.filter(item => item.type === 'pomodoro_completed').length, 1);
  assert.equal(fixture.state.history.length, 1);
  assert.equal(fixture.state.pomodoros.length, 1);
  assert.equal(fixture.state.history[0].taskTitle, 'Ship timer arbitration');

  const replay = await service.command(
    USER_KEY,
    USER_KEY,
    transitionCommand('complete', COMPLETE_COMMAND, 3, fixture.clock()),
  );
  assert.equal(replay.status, 200);
  assert.equal(replay.body.idempotent, true);
  assert.equal(replay.body.resultRevision, 4);
  assert.equal(replay.body.completion.runId, RUN_ID);
  assert.equal(replay.body.completion.history.idempotencyKey, `desktop:timer:${RUN_ID}:history`);
  assert.equal(fixture.state.events.filter(item => item.type === 'pomodoro_completed').length, 1);
  assert.equal(fixture.state.history.length, 1);
  assert.equal(fixture.state.pomodoros.length, 1);
});

test('break completion writes history and event but no focus Pomodoro', async () => {
  const fixture = createFixture();
  await fixture.service.command(USER_KEY, USER_KEY, startCommand(fixture.clock(), {
    mode: 'break',
    taskId: null,
    taskTitle: null,
  }));
  fixture.advance(60_000);
  const completed = await fixture.service.command(
    USER_KEY,
    USER_KEY,
    transitionCommand('complete', COMPLETE_COMMAND, 1, fixture.clock()),
  );
  assert.equal(completed.status, 200);
  assert.equal(completed.body.completion.mode, 'break');
  assert.equal(completed.body.completion.pomodoro, null);
  assert.equal(fixture.state.history.length, 1);
  assert.equal(fixture.state.pomodoros.length, 0);
});

for (const crashBoundary of ['completed-event', 'history', 'pomodoro', 'terminal-runtime']) {
  test(`retry heals a crash after ${crashBoundary} write without duplicates`, async () => {
    const fixture = createFixture();
    await fixture.service.command(USER_KEY, USER_KEY, startCommand(fixture.clock()));
    fixture.advance(60_000);
    fixture.failAfter(crashBoundary);
    const command = transitionCommand('complete', COMPLETE_COMMAND, 1, fixture.clock());

    await assert.rejects(() => fixture.service.command(USER_KEY, USER_KEY, command));
    const recovered = await fixture.service.command(USER_KEY, USER_KEY, command);
    assert.equal(recovered.status, 200);
    assert.equal(fixture.state.runtime.active, null);
    assert.equal(fixture.state.events.filter(item => item.type === 'pomodoro_completed').length, 1);
    assert.equal(fixture.state.history.length, 1);
    assert.equal(fixture.state.pomodoros.length, 1);
  });
}

test('completion business date is computed in Bangkok across UTC midnight boundaries', async () => {
  const fixture = createFixture('2026-07-05T16:59:30.000Z');
  await fixture.service.command(USER_KEY, USER_KEY, startCommand(fixture.clock()));
  fixture.advance(60_000);
  const result = await fixture.service.command(
    USER_KEY,
    USER_KEY,
    transitionCommand('complete', COMPLETE_COMMAND, 1, fixture.clock()),
  );
  assert.equal(result.body.completion.businessDate, '2026-07-06');
  assert.equal(fixture.state.history[0].businessDate, '2026-07-06');
  assert.equal(fixture.state.pomodoros[0].businessDate, '2026-07-06');
});

test('offline completion can replay after a long outage while future timestamps stay rejected', async () => {
  const fixture = createFixture();
  await fixture.service.command(USER_KEY, USER_KEY, startCommand(fixture.clock()));
  fixture.advance(60_000);
  const queuedAt = fixture.clock();
  fixture.advance(24 * 60 * 60 * 1000);

  const replayed = await fixture.service.command(
    USER_KEY,
    USER_KEY,
    transitionCommand('complete', COMPLETE_COMMAND, 1, queuedAt),
  );
  assert.equal(replayed.status, 200);
  assert.equal(replayed.body.runtime.active, null);

  const futureFixture = createFixture();
  const futureTimestamp = new Date(Date.parse(futureFixture.clock()) + 5 * 60_000 + 1).toISOString();
  const rejected = await futureFixture.service.command(
    USER_KEY,
    USER_KEY,
    startCommand(futureTimestamp),
  );
  assert.equal(rejected.status, 400);
  assert.equal(rejected.body.error, 'timer_occurred_at_invalid');
});

test('runtime rejects corruption and command bounds before changing storage', async () => {
  assert.throws(
    () => normalizeRuntime({ schemaVersion: 1, revision: 0, active: {}, recentCommands: [] }),
    /timer_runtime_corrupt/,
  );

  const fixture = createFixture();
  const longTitle = '🧠'.repeat(301);
  const invalid = await fixture.service.command(USER_KEY, USER_KEY, startCommand(fixture.clock(), {
    plannedSeconds: 59,
    taskTitle: longTitle,
  }));
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.error, 'timer_duration_invalid');
  assert.equal(fixture.state.runtime, null);

  const invalidTitle = await fixture.service.command(USER_KEY, USER_KEY, startCommand(fixture.clock(), {
    plannedSeconds: 60,
    taskTitle: longTitle,
  }));
  assert.equal(invalidTitle.status, 400);
  assert.equal(invalidTitle.body.error, 'timer_task_title_invalid');
  assert.equal(fixture.state.runtime, null);
});

function createFixture(initialTime = '2026-07-05T10:00:00.000Z') {
  let currentMs = Date.parse(initialTime);
  let failBoundary = '';
  const state = {
    runtime: null,
    events: [],
    history: [],
    pomodoros: [],
  };

  function maybeFail(boundary) {
    if (failBoundary !== boundary) return;
    failBoundary = '';
    throw new Error(`injected crash after ${boundary}`);
  }

  const service = createTimerRuntimeService({
    readRuntime: async () => state.runtime ? structuredClone(state.runtime) : null,
    writeRuntime: async (_userKey, value) => {
      state.runtime = structuredClone(value);
      if (value.active === null) maybeFail('terminal-runtime');
    },
    readEvents: async () => structuredClone(state.events),
    writeEvents: async (_userKey, value) => {
      state.events = structuredClone(value);
      if (value[0]?.type === 'pomodoro_completed') maybeFail('completed-event');
    },
    readHistory: async () => structuredClone(state.history),
    writeHistory: async (_userKey, value) => {
      state.history = structuredClone(value);
      maybeFail('history');
    },
    readPomodoros: async () => structuredClone(state.pomodoros),
    writePomodoros: async (_userKey, value) => {
      state.pomodoros = structuredClone(value);
      maybeFail('pomodoro');
    },
    isStartEnabled: () => true,
    toBusinessDateKey: bangkokDateKey,
    now: () => new Date(currentMs),
  });

  return {
    service,
    state,
    clock: () => new Date(currentMs).toISOString(),
    advance: ms => {
      currentMs += ms;
    },
    failAfter: boundary => {
      failBoundary = boundary;
    },
  };
}

function startCommand(occurredAt, overrides = {}) {
  return {
    commandId: START_COMMAND,
    type: 'start',
    runId: RUN_ID,
    expectedRevision: 0,
    occurredAt,
    payload: {
      clientId: CLIENT_ID,
      ownerKind: 'desktop',
      mode: 'focus',
      taskId: 'task-1',
      taskTitle: 'Ship timer arbitration',
      plannedSeconds: 60,
      ...overrides,
    },
  };
}

function transitionCommand(type, commandId, expectedRevision, occurredAt, clientId = CLIENT_ID) {
  return {
    commandId,
    type,
    runId: RUN_ID,
    expectedRevision,
    occurredAt,
    payload: { clientId },
  };
}

function bangkokDateKey(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}
