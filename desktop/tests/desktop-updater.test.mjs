import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import {
  createDesktopUpdater,
  desktopUpdateBudgets,
} from '../src/update/desktop-updater.mjs';

const FEED = 'https://github.com/Xsmitylnwza/keshi-pomodoro/releases/latest/download';

test('stable updater configures the exact feed and schedules bounded checks', () => {
  const fixture = createFixture();
  assert.equal(fixture.updater.start(), true);
  assert.deepEqual(fixture.autoUpdater.feed, { url: FEED });
  assert.equal(fixture.timeouts[0], desktopUpdateBudgets.firstCheckDelayMs);
  assert.equal(fixture.intervals[0], desktopUpdateBudgets.checkIntervalMs);
});

test('downloaded update cannot install while a timer or completion outbox exists', () => {
  const fixture = createFixture({ timer: { active: { runId: 'run' }, queuedCommandCount: 0 } });
  fixture.updater.start();
  fixture.autoUpdater.emit(
    'update-downloaded',
    {},
    '',
    '',
    '',
    'https://github.com/Xsmitylnwza/keshi-pomodoro/releases/download/v0.2.0/KeshiPomodoro-0.2.0-full.nupkg',
  );
  assert.equal(fixture.updater.snapshot().deferred, true);
  assert.equal(fixture.updater.installIfIdle(), false);
  assert.equal(fixture.autoUpdater.installCount, 0);

  fixture.setTimer({ active: null, completionPending: true, queuedCommandCount: 1 });
  assert.equal(fixture.updater.installIfIdle(), false);
  fixture.setTimer({ active: null, completionPending: false, queuedCommandCount: 0 });
  assert.equal(fixture.updater.installIfIdle(), true);
  assert.equal(fixture.autoUpdater.installCount, 1);
});

test('development and non-Windows runtimes never contact the update feed', () => {
  const unpackaged = createFixture({ isPackaged: false });
  assert.equal(unpackaged.updater.start(), false);
  assert.equal(unpackaged.autoUpdater.feed, null);

  const otherPlatform = createFixture({ platform: 'darwin' });
  assert.equal(otherPlatform.updater.start(), false);
  assert.equal(otherPlatform.autoUpdater.feed, null);
});

test('arbitrary or non-stable feeds are rejected', () => {
  assert.throws(
    () => createFixture({ feedUrl: 'https://evil.example/releases/latest/download' }),
    /desktop_update_feed_invalid/,
  );
});

function createFixture({
  timer = { active: null, completionPending: false, queuedCommandCount: 0 },
  isPackaged = true,
  platform = 'win32',
  feedUrl = FEED,
} = {}) {
  class FakeUpdater extends EventEmitter {
    feed = null;
    installCount = 0;
    setFeedURL(value) {
      this.feed = value;
    }
    async checkForUpdates() {}
    quitAndInstall() {
      this.installCount += 1;
    }
  }
  const autoUpdater = new FakeUpdater();
  const timeouts = [];
  const intervals = [];
  let currentTimer = timer;
  const updater = createDesktopUpdater({
    autoUpdater,
    feedUrl,
    getTimerSnapshot: () => currentTimer,
    isPackaged,
    platform,
    setTimeoutFn: (_callback, delay) => {
      timeouts.push(delay);
      return { unref() {} };
    },
    clearTimeoutFn: () => {},
    setIntervalFn: (_callback, delay) => {
      intervals.push(delay);
      return { unref() {} };
    },
    clearIntervalFn: () => {},
    logger: { warn() {} },
  });
  return {
    updater,
    autoUpdater,
    timeouts,
    intervals,
    setTimer(value) {
      currentTimer = value;
    },
  };
}
