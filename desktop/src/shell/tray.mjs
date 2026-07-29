import { Menu, Tray, nativeImage } from 'electron';

function trayImage() {
  const svg = encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32">
      <rect width="32" height="32" rx="8" fill="#151816"/>
      <circle cx="16" cy="17" r="9" fill="none" stroke="#f3eee4" stroke-width="3"/>
      <path d="M16 17V11M16 17l5 3M12 5h8" stroke="#9ce66f" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `);
  return nativeImage.createFromDataURL(`data:image/svg+xml,${svg}`);
}

export function createTray({ showWindow, quitApp, installUpdate }) {
  const tray = new Tray(trayImage());
  let lastLabel = '';

  function update(snapshot = null, updater = null) {
    const active = snapshot?.active;
    const label = active
      ? `${active.mode === 'focus' ? 'Focus' : 'Break'} ${formatRemaining(active.remainingSeconds)}`
      : snapshot?.completionPending
        ? 'Completion waiting to sync'
        : 'No active timer';
    const updateLabel = updater?.downloaded
      ? updater.deferred
        ? 'Update ready — installs after this timer'
        : 'Restart to install update'
      : '';
    const stateKey = `${label}|${updateLabel}`;
    if (stateKey === lastLabel) return;
    lastLabel = stateKey;
    tray.setToolTip(`Keshi Pomodoro — ${label}`);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: `Open Keshi — ${label}`, click: showWindow },
      ...(updateLabel ? [
        { type: 'separator' },
        {
          label: updateLabel,
          enabled: !updater.deferred,
          click: installUpdate,
        },
      ] : []),
      { type: 'separator' },
      { label: 'Quit Keshi', click: quitApp },
    ]));
  }

  update();
  tray.on('click', showWindow);
  return Object.freeze({
    update,
    destroy: () => tray.destroy(),
  });
}

function formatRemaining(value) {
  const seconds = Math.max(0, Number.isFinite(value) ? Math.ceil(value) : 0);
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60)
    .toString()
    .padStart(2, '0')}`;
}
