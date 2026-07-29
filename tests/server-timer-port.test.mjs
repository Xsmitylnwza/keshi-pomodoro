import assert from 'node:assert/strict';
import test from 'node:test';

import { createServerTimerPort, validateRuntime } from '../src/lib/timer/ServerTimerPort.mjs';

const CLIENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const COMMAND_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const RUN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

test('server timer port persists one client identity and sends versioned commands', async () => {
  const values = new Map();
  const requests = [];
  const port = createServerTimerPort({
    baseUrl: '/api',
    storage: {
      getItem: key => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    },
    randomUUID: sequence([CLIENT_ID, COMMAND_ID, RUN_ID]),
    now: () => new Date('2026-07-05T10:00:00.000Z'),
    ownerKind: 'web',
    fetchFn: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith('/runtime')) {
        return jsonResponse(200, {
          schemaVersion: 1,
          revision: 0,
          active: null,
          startEnabled: true,
        });
      }
      const command = JSON.parse(options.body);
      return jsonResponse(200, {
        status: 'ok',
        idempotent: false,
        resultRevision: 1,
        runtime: {
          schemaVersion: 1,
          revision: 1,
          active: activeRuntime(command),
        },
      });
    },
  });

  assert.equal(port.clientId, CLIENT_ID);
  assert.equal((await port.runtime()).startEnabled, true);
  const started = await port.start({
    expectedRevision: 0,
    mode: 'focus',
    taskId: 'task-1',
    taskTitle: 'Server timer',
    plannedSeconds: 1500,
  });
  assert.equal(started.runtime.active.runId, RUN_ID);
  const command = JSON.parse(requests[1].options.body);
  assert.equal(command.commandId, COMMAND_ID);
  assert.equal(command.runId, RUN_ID);
  assert.equal(command.payload.clientId, CLIENT_ID);
  assert.equal(command.payload.ownerKind, 'web');
  assert.equal(command.occurredAt, '2026-07-05T10:00:00.000Z');

  const retryPort = createServerTimerPort({
    storage: {
      getItem: () => CLIENT_ID,
      setItem() {},
    },
    randomUUID: () => {
      throw new Error('command id should be reused');
    },
    fetchFn: async (_url, options) => {
      const retried = JSON.parse(options.body);
      assert.equal(retried.commandId, COMMAND_ID);
      return jsonResponse(200, {
        status: 'ok',
        idempotent: true,
        resultRevision: 1,
        runtime: { schemaVersion: 1, revision: 1, active: null },
      });
    },
  });
  await retryPort.complete({
    runId: RUN_ID,
    expectedRevision: 1,
    commandId: COMMAND_ID,
  });
});

test('server timer port exposes conflict runtime without accepting malformed snapshots', async () => {
  const port = createServerTimerPort({
    storage: null,
    randomUUID: sequence([CLIENT_ID, COMMAND_ID]),
    fetchFn: async () => jsonResponse(409, {
      error: 'timer_revision_conflict',
      runtime: { schemaVersion: 1, revision: 2, active: null },
    }),
  });

  await assert.rejects(
    () => port.pause({ runId: RUN_ID, expectedRevision: 1 }),
    error => error.code === 'timer_revision_conflict' && error.runtime.revision === 2,
  );
  assert.throws(
    () => validateRuntime({ schemaVersion: 1, revision: 1, active: { runId: 'bad' } }),
    /timer_runtime_invalid/,
  );
});

function activeRuntime(command) {
  return {
    runId: command.runId,
    ownerClientId: CLIENT_ID,
    ownerKind: 'web',
    mode: 'focus',
    taskId: 'task-1',
    taskTitle: 'Server timer',
    plannedSeconds: 1500,
    remainingSeconds: 1500,
    status: 'running',
    startedAt: '2026-07-05T10:00:00.000Z',
    endAt: '2026-07-05T10:25:00.000Z',
    pausedAt: null,
    businessTimeZone: 'Asia/Bangkok',
  };
}

function sequence(values) {
  let index = 0;
  return () => values[index++];
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
