export const apiBaseUrl = import.meta.env.VITE_HERMES_TASKS_API_URL?.replace(/\/$/, '') ?? '/api';

export function buildApiUrl(path = '', baseUrl = apiBaseUrl) {
  if (!path) return baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}
