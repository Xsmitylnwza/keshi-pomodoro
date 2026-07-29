import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createEncryptedTimerStore,
  emptyTimerCache,
  normalizeTimerCache,
  timerStoreLimits,
} from '../src/timer/timer-store.mjs';

const CLIENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RUN_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const COMMAND_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

test('encrypted timer store round trips atomically without plaintext and preserves client ID', async (t) => {
  const directory = await temporaryDirectory(t);
  const store = createEncryptedTimerStore({
    directory,
    safeStorage: fakeSafeStorage(),
    randomUUIDFn: () => CLIENT_ID,
  });
  const initial = await store.load();
  assert.equal(initial.clientId, CLIENT_ID);

  initial.ownerUserId = 'central-user-1';
  initial.active = activeRuntime({ taskTitle: 'private task title' });
  initial.queuedCommands.push(queuedCompletion());
  await store.save(initial);

  const raw = await readFile(store.filePath, 'utf8');
  assert.doesNotMatch(raw, /private task title|central-user-1/);
  const restarted = createEncryptedTimerStore({
    directory,
    safeStorage: fakeSafeStorage(),
    randomUUIDFn: () => 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  });
  assert.deepEqual(await restarted.load(), initial);
  await restarted.clear();
  assert.equal((await restarted.load()).ownerUserId, null);
});

test('unknown schema and corrupt ciphertext are quarantined instead of deleted', async (t) => {
  const directory = await temporaryDirectory(t);
  const store = createEncryptedTimerStore({
    directory,
    safeStorage: fakeSafeStorage(),
    randomUUIDFn: () => CLIENT_ID,
    now: () => 1234,
  });
  await writeFile(store.filePath, '{"schemaVersion":999,"ciphertext":"AA=="}\n');
  assert.deepEqual(await store.load(), emptyTimerCache(CLIENT_ID));

  const names = await readdir(directory);
  assert.equal(names.some(name => name.includes('.quarantine-1234-timer_cache_schema_invalid')), true);
  assert.equal(names.includes(path.basename(store.filePath)), false);
});

test('queue bound and schema validation reject unsafe cache values', () => {
  const cache = emptyTimerCache(CLIENT_ID);
  cache.queuedCommands = Array.from(
    { length: timerStoreLimits.maxQueuedCommands + 1 },
    (_, index) => queuedCompletion({
      commandId: uuidFor(index + 1),
      runId: uuidFor(index + 100),
    }),
  );
  assert.throws(() => normalizeTimerCache(cache), /timer_cache_schema_invalid/);
  assert.throws(
    () => normalizeTimerCache({ ...emptyTimerCache(CLIENT_ID), schemaVersion: 2 }),
    /timer_cache_schema_invalid/,
  );
});

test('atomic write failure removes the temporary file and leaves the previous file untouched', async () => {
  const operations = [];
  const previous = '{"previous":true}\n';
  const fs = {
    mkdir: async () => {},
    stat: async () => ({ size: previous.length }),
    readFile: async () => previous,
    rename: async (...args) => operations.push(['rename', ...args]),
    unlink: async (target) => operations.push(['unlink', target]),
    open: async (target) => ({
      async writeFile() {
        operations.push(['write', target]);
        throw new Error('disk_full');
      },
      async sync() {},
      async close() {
        operations.push(['close', target]);
      },
    }),
  };
  const store = createEncryptedTimerStore({
    directory: 'C:\\keshi-test',
    safeStorage: fakeSafeStorage(),
    fs,
    randomUUIDFn: () => CLIENT_ID,
  });
  await assert.rejects(() => store.save(emptyTimerCache(CLIENT_ID)), /disk_full/);
  assert.equal(operations.some(([name]) => name === 'unlink'), true);
  assert.equal(operations.some(([name]) => name === 'rename'), false);
});

function fakeSafeStorage() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: value => Buffer.from(`safe:${Buffer.from(value).toString('base64')}`),
    decryptString: value => Buffer.from(
      value.toString().slice('safe:'.length),
      'base64',
    ).toString(),
  };
}

function activeRuntime(overrides = {}) {
  return {
    runId: RUN_ID,
    ownerClientId: CLIENT_ID,
    ownerKind: 'desktop',
    mode: 'focus',
    taskId: 'task-1',
    taskTitle: 'Task',
    plannedSeconds: 60,
    remainingSeconds: 60,
    status: 'running',
    startedAt: '2026-07-05T10:00:00.000Z',
    endAt: '2026-07-05T10:01:00.000Z',
    pausedAt: null,
    businessTimeZone: 'Asia/Bangkok',
    ...overrides,
  };
}

function queuedCompletion(overrides = {}) {
  return {
    commandId: COMMAND_ID,
    type: 'complete',
    runId: RUN_ID,
    expectedRevision: 1,
    occurredAt: '2026-07-05T10:01:00.000Z',
    notified: true,
    ...overrides,
  };
}

function uuidFor(value) {
  const tail = value.toString(16).padStart(12, '0').slice(-12);
  return `11111111-1111-4111-8111-${tail}`;
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'keshi-timer-store-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
