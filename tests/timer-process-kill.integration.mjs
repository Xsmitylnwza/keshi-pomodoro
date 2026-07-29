import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const RUN_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const START_COMMAND = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const COMPLETE_COMMAND = '11111111-1111-4111-8111-111111111111';
const BOUNDARIES = ['completed-event', 'history', 'pomodoro', 'terminal-runtime'];

for (const boundary of BOUNDARIES) {
  test(`real process kill heals completion after ${boundary}`, async (t) => {
    const dataDir = await mkdtemp(path.join(os.tmpdir(), `keshi-kill-${boundary}-`));
    const markerPath = path.join(dataDir, 'evidence', `${boundary}.json`);
    const port = await reservePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    let server = null;

    t.after(async () => {
      await stopServer(server);
      await rm(dataDir, { recursive: true, force: true });
    });

    server = startServer({
      dataDir,
      port,
      pauseBoundary: boundary,
      markerPath,
    });
    await waitForHealth(server, baseUrl);

    const startResponse = await postCommand(baseUrl, {
      commandId: START_COMMAND,
      type: 'start',
      runId: RUN_ID,
      expectedRevision: 0,
      occurredAt: new Date().toISOString(),
      payload: {
        clientId: CLIENT_ID,
        ownerKind: 'desktop',
        mode: 'focus',
        taskId: 'task-process-kill',
        taskTitle: 'Process kill recovery',
        plannedSeconds: 60,
      },
    });
    assert.equal(startResponse.status, 200);

    const runtimePath = path.join(dataDir, 'timer-runtime.json');
    const runtime = JSON.parse(await readFile(runtimePath, 'utf8'));
    runtime.active.endAt = new Date(Date.now() - 1_000).toISOString();
    runtime.active.remainingSeconds = 0;
    await writeFile(runtimePath, `${JSON.stringify(runtime, null, 2)}\n`, 'utf8');

    const completion = {
      commandId: COMPLETE_COMMAND,
      type: 'complete',
      runId: RUN_ID,
      expectedRevision: 1,
      occurredAt: new Date().toISOString(),
      payload: { clientId: CLIENT_ID },
    };
    const interruptedRequest = postCommand(baseUrl, completion).catch(error => error);

    const marker = await waitForMarker(server, markerPath);
    assert.equal(marker.boundary, boundary);
    assert.equal(marker.pid, server.child.pid);

    const killedPid = server.child.pid;
    await stopServer(server, 'SIGKILL');
    await interruptedRequest;
    assert.equal(server.child.pid, killedPid);

    server = startServer({ dataDir, port });
    await waitForHealth(server, baseUrl);
    const recovered = await postCommand(baseUrl, completion);
    assert.equal(recovered.status, 200);

    const [events, history, pomodoros, healedRuntime] = await Promise.all([
      readJson(path.join(dataDir, 'events.json')),
      readJson(path.join(dataDir, 'history.json')),
      readJson(path.join(dataDir, 'pomodoros.json')),
      readJson(runtimePath),
    ]);

    assert.equal(
      events.filter(item => item.idempotencyKey === `desktop:timer:${RUN_ID}:completed-event`).length,
      1,
    );
    assert.equal(
      history.filter(item => item.idempotencyKey === `desktop:timer:${RUN_ID}:history`).length,
      1,
    );
    assert.equal(
      pomodoros.filter(item => item.idempotencyKey === `desktop:timer:${RUN_ID}:pomodoro`).length,
      1,
    );
    assert.equal(healedRuntime.active, null);
    assert.equal(healedRuntime.revision, 2);
    assert.equal(
      healedRuntime.recentCommands.filter(item => item.commandId === COMPLETE_COMMAND).length,
      1,
    );
  });
}

function startServer({
  dataDir,
  port,
  pauseBoundary = '',
  markerPath = '',
}) {
  const child = spawn(process.execPath, ['server/pomodoro-server.mjs'], {
    cwd: rootDir,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: String(port),
      POMODORO_DATA_DIR: dataDir,
      POMODORO_DIST_DIR: path.join(dataDir, 'dist'),
      CENTRAL_AUTH_ENABLED: 'false',
      SERVER_TIMER_ENABLED: 'true',
      POMODORO_TEST_PAUSE_AFTER_TIMER_WRITE: pauseBoundary,
      POMODORO_TEST_TIMER_WRITE_MARKER: markerPath,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const state = { child, stdout: '', stderr: '' };
  child.stdout.on('data', chunk => {
    state.stdout += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    state.stderr += chunk.toString();
  });
  return state;
}

async function stopServer(server, signal = 'SIGTERM') {
  if (!server?.child || server.child.exitCode !== null) return;
  const exited = new Promise(resolve => server.child.once('exit', resolve));
  server.child.kill(signal);
  await exited;
}

async function waitForHealth(server, baseUrl) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (server.child.exitCode !== null) {
      throw new Error(
        `server exited early (${server.child.exitCode})\nstdout:\n${server.stdout}\nstderr:\n${server.stderr}`,
      );
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await delay(50);
  }
  throw new Error(`server health timeout\nstdout:\n${server.stdout}\nstderr:\n${server.stderr}`);
}

async function waitForMarker(server, markerPath) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (server.child.exitCode !== null) {
      throw new Error(
        `server exited before marker\nstdout:\n${server.stdout}\nstderr:\n${server.stderr}`,
      );
    }
    try {
      return JSON.parse(await readFile(markerPath, 'utf8'));
    } catch {}
    await delay(25);
  }
  throw new Error(
    `timer boundary marker timeout\nstdout:\n${server.stdout}\nstderr:\n${server.stderr}`,
  );
}

async function postCommand(baseUrl, body) {
  const response = await fetch(`${baseUrl}/api/timer/commands`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return {
    status: response.status,
    body: await response.json(),
  };
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  await new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  });
  return address.port;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
