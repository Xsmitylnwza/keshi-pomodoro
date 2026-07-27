import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const appSource = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');

function functionBody(name, nextMarker) {
  const start = appSource.indexOf(name);
  const end = appSource.indexOf(nextMarker, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextMarker} must follow ${name}`);
  return appSource.slice(start, end);
}

test('focus completion is attributed to the day it happened, not the selected task day', () => {
  const completion = functionBody('function handleComplete()', 'const newMode =');
  assert.match(completion, /const completedBusinessDate = todayKey\(\);/);
  assert.doesNotMatch(completion, /taskBusinessDate\(selectedTask\)/);
});

test('timer events are attributed to the day they happened, not the selected task day', () => {
  const eventLogger = functionBody('const logTimerEvent =', 'const cancelActiveTimer =');
  assert.match(eventLogger, /const businessDate = todayKey\(\);/);
  assert.doesNotMatch(eventLogger, /taskBusinessDate\(selectedTask\)/);
});
