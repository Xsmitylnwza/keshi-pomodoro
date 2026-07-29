export const APP_ORIGIN = 'https://pomodoro.xsmity.cloud';
export const CENTRAL_ORIGIN = 'https://xsmity.cloud';

const externalDestinations = new Set([
  CENTRAL_ORIGIN,
  'https://habits.xsmity.cloud',
]);

export function parseHttpsUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed : null;
  } catch {
    return null;
  }
}

export function isAppNavigation(value) {
  return parseHttpsUrl(value)?.origin === APP_ORIGIN;
}

export function isAllowedExternalNavigation(value) {
  const parsed = parseHttpsUrl(value);
  return Boolean(parsed && externalDestinations.has(parsed.origin));
}
