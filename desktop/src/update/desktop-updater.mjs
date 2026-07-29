const FIRST_CHECK_DELAY_MS = 30_000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function createDesktopUpdater({
  autoUpdater,
  feedUrl,
  getTimerSnapshot,
  isPackaged,
  platform,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  logger = console,
} = {}) {
  if (!autoUpdater?.on || !autoUpdater?.checkForUpdates || !autoUpdater?.quitAndInstall) {
    throw new Error('desktop updater requires Electron autoUpdater');
  }
  if (typeof getTimerSnapshot !== 'function') {
    throw new Error('desktop updater requires timer snapshot access');
  }
  const updateOrigin = validateStableFeed(feedUrl);
  const listeners = new Set();
  let firstCheckTimer = null;
  let checkInterval = null;
  let started = false;
  let downloaded = false;
  let version = null;
  let errorCode = null;

  function snapshot() {
    const timer = getTimerSnapshot();
    return {
      enabled: Boolean(isPackaged && platform === 'win32'),
      downloaded,
      version,
      deferred: downloaded && timerBusy(timer),
      errorCode,
    };
  }

  function emit() {
    const value = snapshot();
    for (const listener of listeners) listener(value);
  }

  async function check() {
    if (!started) return;
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      errorCode = 'update_check_failed';
      logger.warn('desktop update check failed', error?.message || 'unknown');
      emit();
    }
  }

  function start() {
    if (started || !isPackaged || platform !== 'win32') return false;
    started = true;
    autoUpdater.setFeedURL({ url: updateOrigin });
    autoUpdater.on('update-downloaded', (_event, _notes, _name, _date, nextUrl) => {
      downloaded = true;
      version = releaseVersion(nextUrl);
      errorCode = null;
      emit();
    });
    autoUpdater.on('error', (error) => {
      errorCode = 'update_failed';
      logger.warn('desktop update failed', error?.message || 'unknown');
      emit();
    });
    firstCheckTimer = setTimeoutFn(() => {
      firstCheckTimer = null;
      void check();
    }, FIRST_CHECK_DELAY_MS);
    firstCheckTimer?.unref?.();
    checkInterval = setIntervalFn(() => void check(), CHECK_INTERVAL_MS);
    checkInterval?.unref?.();
    return true;
  }

  function installIfIdle() {
    if (!downloaded) return false;
    if (timerBusy(getTimerSnapshot())) {
      emit();
      return false;
    }
    autoUpdater.quitAndInstall(false, true);
    return true;
  }

  function onTimerSnapshot() {
    if (downloaded) emit();
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') throw new Error('updater listener must be a function');
    listeners.add(listener);
    listener(snapshot());
    return () => listeners.delete(listener);
  }

  function stop() {
    started = false;
    if (firstCheckTimer) clearTimeoutFn(firstCheckTimer);
    if (checkInterval) clearIntervalFn(checkInterval);
    firstCheckTimer = null;
    checkInterval = null;
    listeners.clear();
  }

  return Object.freeze({
    start,
    stop,
    snapshot,
    subscribe,
    installIfIdle,
    onTimerSnapshot,
  });
}

function timerBusy(snapshot) {
  return Boolean(snapshot?.active
    || snapshot?.completionPending
    || Number(snapshot?.queuedCommandCount) > 0);
}

function validateStableFeed(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:'
    || url.hostname !== 'github.com'
    || url.pathname !== '/Xsmitylnwza/keshi-pomodoro/releases/latest/download'
    || url.search
    || url.hash) {
    throw new Error('desktop_update_feed_invalid');
  }
  return url.toString().replace(/\/$/, '');
}

function releaseVersion(urlValue) {
  try {
    const match = new URL(urlValue).pathname.match(/KeshiPomodoro-([0-9]+\.[0-9]+\.[0-9]+)-full\.nupkg$/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export const desktopUpdateBudgets = Object.freeze({
  firstCheckDelayMs: FIRST_CHECK_DELAY_MS,
  checkIntervalMs: CHECK_INTERVAL_MS,
});
