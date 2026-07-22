import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
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
      POMODORO_ENABLE_LEGACY_DISCIPLINE: 'true',
      HABIT_INTELLIGENCE_URL: 'https://habits.example.test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { stdout += chunk.toString(); });
  server.stderr.on('data', chunk => { stderr += chunk.toString(); });
  await waitForHealth();
});

test('discipline UI redirects to Habit Intelligence while legacy APIs remain available', async () => {
  const response = await fetch(`${baseUrl}/discipline`, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), 'https://habits.example.test');

  const legacyApi = await api('/api/discipline/habits');
  assert.equal(legacyApi.response.status, 200);
  assert.ok(Array.isArray(legacyApi.body.habits));
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

test('calendar events can be loaded from secret ICS URL settings', async () => {
  const icsBody = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Keshi//Test//EN',
    'BEGIN:VEVENT',
    'UID:event-standup@test',
    'SUMMARY:Team standup',
    'LOCATION:Zoom',
    'DTSTART:20260705T020000Z',
    'DTEND:20260705T023000Z',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:event-otherday@test',
    'SUMMARY:Other day',
    'DTSTART:20260706T020000Z',
    'DTEND:20260706T030000Z',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\n');

  const icsServer = createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/calendar; charset=utf-8' });
    res.end(icsBody);
  });

  await new Promise(resolve => icsServer.listen(0, '127.0.0.1', resolve));
  const icsPort = icsServer.address().port;
  const icsUrl = `http://127.0.0.1:${icsPort}/basic.ics`;

  try {
    const disabled = await api('/api/calendar/events?date=2026-07-05');
    assert.equal(disabled.response.status, 200);
    assert.equal(disabled.body.enabled, false);
    assert.equal(disabled.body.events.length, 0);

    const saved = await api('/api/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        calendar: {
          enabled: true,
          icsUrl,
        },
      }),
    });
    assert.equal(saved.response.status, 200);
    assert.equal(saved.body.settings.calendar.enabled, true);
    assert.equal(saved.body.settings.calendar.icsUrl, icsUrl);

    const events = await api('/api/calendar/events?date=2026-07-05');
    assert.equal(events.response.status, 200);
    assert.equal(events.body.enabled, true);
    assert.equal(events.body.configured, true);
    assert.equal(events.body.events.length, 1);
    assert.equal(events.body.events[0].title, 'Team standup');
    assert.equal(events.body.events[0].location, 'Zoom');
  } finally {
    await new Promise(resolve => icsServer.close(resolve));
  }
});

test('history writes are idempotent via Idempotency-Key', async () => {
  const payload = {
    id: 'history-a',
    mode: 'focus',
    duration: 25,
    date: 'Jul 5, 8:00 AM',
    businessDate: '2026-07-05',
    taskId: 'task-a',
    taskTitle: 'Write reliability plan',
  };
  const headers = { 'Idempotency-Key': 'sebastian:history:2026-07-05:focus-1' };

  const first = await post('/api/history', payload, headers);
  assert.equal(first.response.status, 201);
  assert.equal(first.body.item.businessDate, '2026-07-05');

  const duplicate = await post('/api/history', { ...payload, id: 'history-b' }, headers);
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.body.idempotent, true);
  assert.equal(duplicate.body.item.id, 'history-a');
  assert.equal(duplicate.body.history.length, 1);
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

test('focus analytics projects completed sessions without habit or task-title data', async () => {
  const { response, body } = await api('/api/analytics/focus/trend?from=2026-07-05&to=2026-07-06');
  assert.equal(response.status, 200);
  const activeDay = body.trend.find(day => day.date === '2026-07-05');
  const emptyDay = body.trend.find(day => day.date === '2026-07-06');

  assert.equal(activeDay.activity.focusMinutes, 25);
  assert.equal(activeDay.activity.completedSessions, 1);
  assert.equal(activeDay.activity.hourlyMinutes[0], 25);
  assert.equal(emptyDay.activity.focusMinutes, 0);
  assert.deepEqual(emptyDay.activity.hourlyMinutes, Array.from({ length: 24 }, () => 0));
  assert.equal('habits' in body, false);
  assert.equal('scores' in activeDay, false);
  assert.equal('segments' in activeDay.activity, false);
  assert.equal(JSON.stringify(body).includes('Write reliability plan'), false);
});

test('trend activity uses the recorded timer start for linked sessions', async () => {
  const sessionId = 'timer-session-timeline';
  await post('/api/pomodoros', {
    id: 'pomo-timeline',
    sessionId,
    durationMinutes: 25,
    completedAt: '2026-07-06T03:25:00.000Z',
    businessDate: '2026-07-06',
  });
  await post('/api/events', {
    id: 'event-timeline-start',
    sessionId,
    type: 'pomodoro_started',
    mode: 'focus',
    plannedSeconds: 1500,
    elapsedSeconds: 0,
    remainingSeconds: 1500,
    createdAt: '2026-07-06T03:00:00.000Z',
    businessDate: '2026-07-06',
  });
  await post('/api/events', {
    id: 'event-timeline-complete',
    sessionId,
    type: 'pomodoro_completed',
    mode: 'focus',
    plannedSeconds: 1500,
    elapsedSeconds: 1500,
    remainingSeconds: 0,
    createdAt: '2026-07-06T03:25:00.000Z',
    businessDate: '2026-07-06',
  });

  const { body } = await api('/api/analytics/focus/trend?from=2026-07-06&to=2026-07-06');
  const activity = body.trend[0].activity;
  assert.equal(activity.focusMinutes, 25);
  assert.equal(activity.firstStartedAt, '2026-07-06T03:00:00.000Z');
  assert.equal(activity.hourlyMinutes[10], 25);
  assert.equal('segments' in activity, false);
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
  // Legacy 1-10 values map to binary done (1)
  assert.equal(result.body.score.total, 6);
  assert.equal(result.body.score.scores.deep_work, 1);
  assert.equal(result.body.score.scores.sleep, 1);

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

test('habit catalog supports create update and binary custom scores', async () => {
  const listed = await api('/api/discipline/habits');
  assert.equal(listed.response.status, 200);
  assert.ok(Array.isArray(listed.body.habits));
  assert.ok(listed.body.habits.length >= 6);
  assert.ok(listed.body.icons.includes('target'));
  assert.ok(listed.body.colors.includes('violet'));

  const created = await post('/api/discipline/habits', {
    label: 'No social media',
    icon: 'phone',
    color: 'orange',
    key: 'no_social',
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.habit.key, 'no_social');
  assert.equal(created.body.habit.icon, 'phone');
  assert.equal(created.body.habit.color, 'orange');
  assert.equal(created.body.habit.system, false);

  const updated = await api('/api/discipline/habits/no_social', {
    method: 'PATCH',
    body: JSON.stringify({ label: 'Phone free', icon: 'phone', color: 'cyan', active: true }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.habit.label, 'Phone free');
  assert.equal(updated.body.habit.color, 'cyan');

  const scored = await post('/api/discipline/scores', {
    date: '2026-07-07',
    scores: {
      deep_work: 1,
      reading: 0,
      exercise: 1,
      sleep: 1,
      nutrition: 0,
      discipline: 1,
      no_social: 1,
    },
    notes: 'custom habit day',
  });
  assert.equal(scored.response.status, 200);
  assert.equal(scored.body.score.scores.no_social, 1);
  assert.equal(scored.body.score.total, 5);

  const review = await api('/api/discipline/review?date=2026-07-07');
  assert.equal(review.response.status, 200);
  assert.ok(review.body.habits.some((habit) => habit.key === 'no_social'));
  assert.equal(review.body.score.scores.no_social, 1);

  const deleted = await api('/api/discipline/habits/no_social', { method: 'DELETE' });
  assert.equal(deleted.response.status, 200);
  assert.equal(deleted.body.deleted, true);
  assert.equal(deleted.body.habits.some((habit) => habit.key === 'no_social'), false);
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

test('central auth protects API routes when enabled', async () => {
  const protectedDataDir = await mkdtemp(path.join(tmpdir(), 'keshi-auth-api-'));
  const authPort = 50000 + Math.floor(Math.random() * 1000);
  const appPort = 51000 + Math.floor(Math.random() * 1000);
  const protectedBaseUrl = `http://127.0.0.1:${appPort}`;
  const seenCookies = [];
  let protectedServer;
  let protectedStdout = '';
  let protectedStderr = '';

  const authServer = createServer((req, res) => {
    if (req.url !== '/auth/session') {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
      return;
    }

    const cookie = req.headers.cookie ?? '';
    seenCookies.push(cookie);
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({
      authenticated: String(cookie).includes('xsmity.sid=valid'),
      user: String(cookie).includes('xsmity.sid=valid')
        ? { id: 'central-user-1', email: 'user@example.com', name: 'Central User' }
        : null,
    }));
  });

  await new Promise(resolve => authServer.listen(authPort, '127.0.0.1', resolve));

  try {
    protectedServer = spawn(process.execPath, ['server/pomodoro-server.mjs'], {
      cwd: rootDir,
      env: {
        ...process.env,
        HOST: '127.0.0.1',
        PORT: String(appPort),
        POMODORO_DATA_DIR: protectedDataDir,
        POMODORO_DIST_DIR: path.join(protectedDataDir, 'dist'),
        CENTRAL_AUTH_ENABLED: 'true',
        CENTRAL_AUTH_URL: `http://127.0.0.1:${authPort}`,
        XSMITY_SERVICE_TOKEN: 'central-service-test-token',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    protectedServer.stdout.on('data', chunk => { protectedStdout += chunk.toString(); });
    protectedServer.stderr.on('data', chunk => { protectedStderr += chunk.toString(); });

    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      if (protectedServer.exitCode !== null) {
        throw new Error(`protected server exited early\nstdout:\n${protectedStdout}\nstderr:\n${protectedStderr}`);
      }

      try {
        const response = await fetch(`${protectedBaseUrl}/api/health`);
        if (response.ok) break;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    const health = await fetch(`${protectedBaseUrl}/api/health`);
    assert.equal(health.status, 200);

    const rejected = await fetch(`${protectedBaseUrl}/api/settings`, {
      headers: { accept: 'application/json' },
    });
    assert.equal(rejected.status, 401);
    assert.equal((await rejected.json()).error, 'auth_required');

    const rejectedService = await fetch(`${protectedBaseUrl}/api/settings`, {
      headers: {
        accept: 'application/json',
        'x-xsmity-service': 'xsmity-auth',
        'x-xsmity-service-token': 'wrong-token',
      },
    });
    assert.equal(rejectedService.status, 401);

    const acceptedService = await fetch(`${protectedBaseUrl}/api/settings`, {
      headers: {
        accept: 'application/json',
        'x-xsmity-service': 'xsmity-auth',
        'x-xsmity-service-token': 'central-service-test-token',
      },
    });
    assert.equal(acceptedService.status, 200);
    assert.ok((await acceptedService.json()).settings);

    const movedDiscipline = await fetch(`${protectedBaseUrl}/api/discipline/habits`, {
      headers: {
        accept: 'application/json',
        'x-xsmity-service': 'xsmity-auth',
        'x-xsmity-service-token': 'central-service-test-token',
      },
    });
    assert.equal(movedDiscipline.status, 410);
    assert.equal((await movedDiscipline.json()).error, 'habit_api_moved');

    const accepted = await fetch(`${protectedBaseUrl}/api/settings`, {
      headers: {
        accept: 'application/json',
        cookie: 'xsmity.sid=valid',
      },
    });
    assert.equal(accepted.status, 200);
    assert.ok((await accepted.json()).settings);
    assert.ok(seenCookies.includes('xsmity.sid=valid'));
  } finally {
    if (protectedServer && protectedServer.exitCode === null) {
      protectedServer.kill();
      await new Promise(resolve => protectedServer.once('exit', resolve));
    }
    await new Promise(resolve => authServer.close(resolve));
    await rm(protectedDataDir, { recursive: true, force: true });
  }
});
