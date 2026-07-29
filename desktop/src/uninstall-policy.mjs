import path from 'node:path';
import { rmSync } from 'node:fs';

export function removeDesktopUserDataForUninstall({
  appData,
  userData,
  remove = rmSync,
} = {}) {
  const base = path.resolve(String(appData || ''));
  const target = path.resolve(String(userData || ''));
  const relative = path.relative(base, target);
  if (!base
    || !target
    || !relative
    || relative.startsWith(`..${path.sep}`)
    || relative === '..'
    || path.isAbsolute(relative)) {
    throw new Error('desktop_uninstall_path_invalid');
  }
  remove(target, { recursive: true, force: true });
  return target;
}
