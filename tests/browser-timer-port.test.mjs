import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCompletionHistoryItem,
  createTimerEvent,
  nextMode,
  plannedSeconds,
  remainingSeconds,
} from '../src/lib/timer/BrowserTimerPort.mjs';

test('timer math uses absolute end time and current mode durations', () => {
  assert.equal(plannedSeconds('focus', { focusMinutes: 25, breakMinutes: 5 }), 1500);
  assert.equal(plannedSeconds('break', { focusMinutes: 25, breakMinutes: 5 }), 300);
  assert.equal(remainingSeconds(11_001, 10_000), 2);
  assert.equal(remainingSeconds(9_000, 10_000), 0);
  assert.equal(nextMode('focus'), 'break');
  assert.equal(nextMode('break'), 'focus');
});

test('timer event preserves task snapshot, business date, and stable source shape', () => {
  const ids = ['event-id'];
  const result = createTimerEvent({
    type: 'pomodoro_paused',
    mode: 'focus',
    selectedTask: { id: 'task-1', title: 'Deep work' },
    plannedSeconds: 1500,
    remainingSeconds: 900,
    sessionId: 'session-1',
    businessDate: '2026-07-29',
  }, {
    randomUUID: () => ids.shift(),
    now: () => new Date('2026-07-29T03:00:00.000Z'),
  });

  assert.equal(result.sessionId, 'session-1');
  assert.deepEqual(result.event, {
    id: 'event-id',
    sessionId: 'session-1',
    type: 'pomodoro_paused',
    mode: 'focus',
    taskId: 'task-1',
    taskTitle: 'Deep work',
    plannedSeconds: 1500,
    elapsedSeconds: 600,
    remainingSeconds: 900,
    createdAt: '2026-07-29T03:00:00.000Z',
    businessDate: '2026-07-29',
    source: 'keshi-pomodoro',
    idempotencyKey: 'keshi:event:event-id',
  });
});

test('focus and break completion history retain current public semantics', () => {
  const runtime = {
    randomUUID: () => 'history-id',
    now: () => new Date('2026-07-29T03:00:00.000Z'),
    formatDate: () => 'Jul 29, 10:00 AM',
  };
  const common = {
    durations: { focusMinutes: 25, breakMinutes: 5 },
    selectedTask: { id: 'task-1', title: 'Deep work' },
    businessDate: '2026-07-29',
  };

  const focus = createCompletionHistoryItem({ ...common, mode: 'focus' }, runtime);
  const rest = createCompletionHistoryItem({ ...common, mode: 'break' }, runtime);

  assert.equal(focus.duration, 25);
  assert.equal(rest.duration, 5);
  assert.equal(focus.businessDate, '2026-07-29');
  assert.equal(focus.idempotencyKey, 'keshi:history:history-id');
  assert.equal(rest.taskTitle, 'Deep work');
});
