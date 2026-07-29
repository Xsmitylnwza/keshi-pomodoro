import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import path from 'node:path';

import electronPath from 'electron';

const host = '127.0.0.1';
const server = createServer((_request, response) => {
  response.writeHead(200, {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': "default-src 'self'; script-src 'none'; object-src 'none'",
  });
  response.end('<!doctype html><html><body><main>Keshi shell smoke</main></body></html>');
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, host, resolve);
});

const address = server.address();
const url = `http://${host}:${address.port}`;
const executable = process.env.KESHI_DESKTOP_EXECUTABLE || electronPath;
const packaged = Boolean(process.env.KESHI_DESKTOP_EXECUTABLE);
const child = spawn(executable, packaged ? [] : ['.'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    KESHI_DESKTOP_APP_URL: url,
    KESHI_DESKTOP_SMOKE: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => {
  stdout += chunk;
});
child.stderr.on('data', (chunk) => {
  stderr += chunk;
});

const timeout = setTimeout(() => {
  child.kill();
}, 20_000);

const outcome = await new Promise((resolve) => {
  child.once('error', error => resolve({ exitCode: null, error }));
  child.once('exit', exitCode => resolve({ exitCode, error: null }));
});

clearTimeout(timeout);
await new Promise((resolve) => server.close(resolve));

if (outcome.error || outcome.exitCode !== 0 || !stdout.includes('KESHI_DESKTOP_SMOKE_OK')) {
  process.stderr.write(stderr);
  process.stderr.write(stdout);
  const reason = outcome.error
    ? `${outcome.error.code || outcome.error.name}: ${outcome.error.message}`
    : `exit code ${outcome.exitCode}`;
  throw new Error(`Electron runtime smoke failed with ${reason}`);
}

process.stdout.write(
  `Electron runtime smoke passed (${packaged ? path.basename(executable) : 'development runtime'})\n`,
);
