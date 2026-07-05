import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

let dataDir;
let server;
let baseUrl;
let stdout = '';
let stderr = '';

async function waitForHealth() {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`server exited early\nstdout:\n${stdout}\nstderr:\n${stderr}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  throw new Error(`server did not become healthy\nstdout:\n${stdout}\nstderr:\n${stderr}`);
}

async function api(pathname, init = {}) {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const response = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers,
  });
  const body = await response.json().catch(() => null);
  return { response, body };
}

async function post(pathname, payload, headers) {
  return api(pathname, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
}

before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'keshi-api-'));
  const port = 48000 + Math.floor(Math.random() * 1000);
  baseUrl = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ['server/pomodoro-server.mjs'], {
    cwd: rootDir,
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      POMODORO_DATA_DIR: dataDir,
      POMODORO_DIST_DIR: path.join(dataDir, 'dist'),
      BUSINESS_TIME_ZONE: 'Asia/Bangkok',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { stdout += chunk.toString(); });
  server.stderr.on('data', chunk => { stderr += chunk.toString(); });
  await waitForHealth();
});

after(async () => {
  if (server && server.exitCode === null) {
    server.kill();
    await new Promise(resolve => server.once('exit', resolve));
  }
  if (dataDir) await rm(dataDir, { recursive: true, force: true });
});

test('tasks are idempotent and carry businessDate', async () => {
  const payload = {
    id: 'task-a',
    title: 'Write reliability plan',
    status: 'doing',
    businessDate: '2026-07-05',
    idempotencyKey: 'sebastian:task:2026-07-05:plan',
  };

  const first = await post('/api/tasks', payload);
  assert.equal(first.response.status, 201);
  assert.equal(first.body.task.businessDate, '2026-07-05');

  const duplicate = await post('/api/tasks', {
    ...payload,
    id: 'task-b',
    title: 'Duplicate should not win',
  });
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.body.idempotent, true);
  assert.equal(duplicate.body.task.id, 'task-a');
  assert.equal(duplicate.body.task.title, 'Write reliability plan');

  const listed = await api('/api/tasks');
  assert.equal(listed.response.status, 200);
  assert.equal(listed.body.tasks.length, 1);
});

test('pomodoros and events are idempotent and review by businessDate', async () => {
  const pomodoro = {
    id: 'pomo-a',
    taskId: 'task-a',
    taskTitle: 'Write reliability plan',
    durationMinutes: 25,
    completedAt: '2026-07-04T18:00:00.000Z',
    businessDate: '2026-07-05',
    idempotencyKey: 'sebastian:pomodoro:2026-07-05:1',
  };

  assert.equal((await post('/api/pomodoros', pomodoro)).response.status, 201);
  const duplicatePomodoro = await post('/api/pomodoros', { ...pomodoro, id: 'pomo-b' });
  assert.equal(duplicatePomodoro.response.status, 200);
  assert.equal(duplicatePomodoro.body.idempotent, true);
  assert.equal(duplicatePomodoro.body.pomodoro.id, 'pomo-a');

  const event = {
    id: 'event-a',
    sessionId: 'session-a',
    type: 'pomodoro_completed',
    mode: 'focus',
    taskId: 'task-a',
    taskTitle: 'Write reliability plan',
    plannedSeconds: 1500,
    elapsedSeconds: 1500,
    remainingSeconds: 0,
    createdAt: '2026-07-04T18:00:00.000Z',
    businessDate: '2026-07-05',
    idempotencyKey: 'sebastian:event:2026-07-05:1',
  };

  assert.equal((await post('/api/events', event)).response.status, 201);
  const duplicateEvent = await post('/api/events', { ...event, id: 'event-b' });
  assert.equal(duplicateEvent.response.status, 200);
  assert.equal(duplicateEvent.body.idempotent, true);
  assert.equal(duplicateEvent.body.event.id, 'event-a');

  const review = await api('/api/discipline/review?date=2026-07-05');
  assert.equal(review.response.status, 200);
  assert.equal(review.body.pomodoros.length, 1);
  assert.equal(review.body.events.length, 1);
});

test('discipline logs are idempotent', async () => {
  const reading = {
    date: '2026-07-05',
    title: 'System Design',
    pages: 12,
    minutes: 20,
    idempotencyKey: 'sebastian:reading:2026-07-05:book',
  };
  assert.equal((await post('/api/discipline/reading', reading)).response.status, 201);
  const duplicateReading = await post('/api/discipline/reading', { ...reading, id: 'other-reading-id' });
  assert.equal(duplicateReading.response.status, 200);
  assert.equal(duplicateReading.body.idempotent, true);

  const exercise = {
    date: '2026-07-05',
    type: 'walk',
    durationMinutes: 35,
    intensity: 'easy',
    idempotencyKey: 'sebastian:exercise:2026-07-05:walk',
  };
  assert.equal((await post('/api/discipline/exercise', exercise)).response.status, 201);
  const duplicateExercise = await post('/api/discipline/exercise', { ...exercise, id: 'other-exercise-id' });
  assert.equal(duplicateExercise.response.status, 200);
  assert.equal(duplicateExercise.body.idempotent, true);

  const review = await api('/api/discipline/review?date=2026-07-05');
  assert.equal(review.body.reading.length, 1);
  assert.equal(review.body.exercise.length, 1);
});

test('spec score keys are stored as canonical lowercase dashboard keys', async () => {
  const result = await post('/api/discipline/scores', {
    date: '2026-07-05',
    scores: {
      BUILD: 8,
      JOB_APPS: 7,
      FLEX: 6,
      EXERCISE: 5,
      FOCUS: 4,
      SLEEP: 3,
    },
    notes: 'contract test',
  });
  assert.equal(result.response.status, 200);
  assert.deepEqual(Object.keys(result.body.score.scores).sort(), [
    'deep_work',
    'discipline',
    'exercise',
    'nutrition',
    'reading',
    'sleep',
  ]);
  assert.equal(result.body.score.total, 33);

  const invalid = await post('/api/discipline/scores', {
    date: '2026-07-06',
    scores: {
      BUILD: 99,
      JOB_APPS: 7,
      FLEX: 6,
      EXERCISE: 5,
      FOCUS: 4,
      SLEEP: 3,
    },
  });
  assert.equal(invalid.response.status, 400);
});

test('task snapshots stabilize review task state', async () => {
  const snapshot = await api('/api/task-snapshots?date=2026-07-05', {
    method: 'PUT',
    body: JSON.stringify({
      source: 'sebastian-evening-review',
      idempotencyKey: 'sebastian:snapshot:2026-07-05',
    }),
  });
  assert.equal(snapshot.response.status, 201);
  assert.equal(snapshot.body.snapshot.tasks[0].title, 'Write reliability plan');

  const updated = await api('/api/tasks/task-a', {
    method: 'PUT',
    body: JSON.stringify({ title: 'Edited after review', status: 'done' }),
  });
  assert.equal(updated.response.status, 200);

  const review = await api('/api/discipline/review?date=2026-07-05');
  assert.equal(review.response.status, 200);
  assert.equal(review.body.tasks[0].title, 'Write reliability plan');
  assert.equal(review.body.taskSnapshotSource, 'sebastian-evening-review');
  assert.ok(review.body.taskSnapshotGeneratedAt);
});

test('cron runs can be recorded and duplicate keys return the original record', async () => {
  const run = {
    job: 'Morning Brief',
    status: 'success',
    businessDate: '2026-07-05',
    startedAt: '2026-07-05T01:00:00.000Z',
    finishedAt: '2026-07-05T01:01:00.000Z',
    summary: 'Pushed 1 task',
    idempotencyKey: 'sebastian:cron:morning:2026-07-05',
  };
  const first = await post('/api/cron-runs', run);
  assert.equal(first.response.status, 201);
  const duplicate = await post('/api/cron-runs', { ...run, status: 'failed', summary: 'retry failed' });
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.body.idempotent, true);
  assert.equal(duplicate.body.run.status, 'success');
  assert.equal(duplicate.body.run.summary, 'Pushed 1 task');

  const listed = await api('/api/cron-runs?date=2026-07-05');
  assert.equal(listed.response.status, 200);
  assert.equal(listed.body.runs.length, 1);
});

test('required date parameters return 400', async () => {
  const missingScoreDate = await api('/api/discipline/scores');
  assert.equal(missingScoreDate.response.status, 400);

  const missingReviewDate = await api('/api/discipline/review');
  assert.equal(missingReviewDate.response.status, 400);
});
