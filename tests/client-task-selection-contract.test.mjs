import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

test('new and newly-doing tasks immediately become timer targets', () => {
  assert.match(appSource, /selectTask\(nextTask\.id, undefined, normalizedTasks\)/);
  const patchStart = appSource.indexOf('const patchTask =');
  const patchEnd = appSource.indexOf('const setTaskStatus =', patchStart);
  const patchTask = appSource.slice(patchStart, patchEnd);
  assert.match(patchTask, /patch\.status === 'doing'/);
  assert.match(patchTask, /selectTask\(taskId, undefined, nextTasks\)/);
});
