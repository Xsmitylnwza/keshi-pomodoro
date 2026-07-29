export const POMODORO_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self' https://xsmity.cloud https://habits.xsmity.cloud",
  'frame-src https://www.youtube.com https://www.youtube-nocookie.com',
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self' https://xsmity.cloud",
  "frame-ancestors 'none'",
].join('; ');

export function contentSecurityHeaders(mode = process.env.POMODORO_CSP_MODE || 'enforce') {
  if (mode === 'disabled') return {};
  if (mode === 'report-only') {
    return { 'content-security-policy-report-only': POMODORO_CSP };
  }
  return { 'content-security-policy': POMODORO_CSP };
}
