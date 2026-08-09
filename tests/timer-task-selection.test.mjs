import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveTimerTaskSelection } from '../src/lib/timerTaskSelection.mjs';

const task = (overrides = {}) => ({
  id: 'task-a',
  title: 'Today task',
  status: 'doing',
  businessDate: '2026-08-09',
  updatedAt: '2026-08-09T03:00:00.000Z',
  ...overrides,
});

test('only todo or doing tasks from the requested business day are eligible', () => {
  assert.equal(resolveTimerTaskSelection([task({ status: 'todo' })], 'task-a', '2026-08-09'), 'task-a');
  assert.equal(resolveTimerTaskSelection([task({ status: 'doing' })], 'task-a', '2026-08-09'), 'task-a');
});

test('a persisted task from a previous business day is not restored for the timer', () => {
  assert.equal(resolveTimerTaskSelection([task({ businessDate: '2026-08-08' })], 'task-a', '2026-08-09'), '');
});

test('a completed or missing task is not restored for the timer', () => {
  assert.equal(resolveTimerTaskSelection([task({ status: 'done' })], 'task-a', '2026-08-09'), '');
  assert.equal(resolveTimerTaskSelection([task()], 'missing', '2026-08-09'), '');
});
