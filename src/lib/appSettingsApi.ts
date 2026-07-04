import type { HistoryItem } from '../types';
import { buildApiUrl } from './apiBase';

export interface AppThemeSettings {
  focus: string;
  break: string;
  leftImage: string | null;
  rightImage: string | null;
}

export interface AppRadioSettings {
  volume: number;
  tooltipSeen: boolean;
}

export interface AppSettings {
  focusTime: number;
  breakTime: number;
  soundEnabled: boolean;
  selectedTaskId: string;
  theme: AppThemeSettings;
  radio: AppRadioSettings;
  updatedAt?: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  focusTime: 25,
  breakTime: 5,
  soundEnabled: true,
  selectedTaskId: 'inbox',
  theme: {
    focus: '#b91c1c',
    break: '#34d399',
    leftImage: null,
    rightImage: null,
  },
  radio: {
    volume: 50,
    tooltipSeen: false,
  },
};

export interface AppSettingsResponse {
  settings: AppSettings;
}

export interface AppHistoryResponse {
  history: HistoryItem[];
}

async function appRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has('accept')) headers.set('accept', 'application/json');
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');

  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ? `App API error: ${payload.error}` : `App API request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export async function fetchAppSettings() {
  return appRequest<AppSettingsResponse>('/settings');
}

export async function updateAppSettings(patch: Partial<AppSettings>) {
  return appRequest<AppSettingsResponse>('/settings', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function fetchAppHistory() {
  return appRequest<AppHistoryResponse>('/history');
}

export async function appendAppHistory(item: HistoryItem) {
  return appRequest<AppHistoryResponse & { item: HistoryItem }>('/history', {
    method: 'POST',
    body: JSON.stringify(item),
  });
}

export async function clearAppHistory() {
  return appRequest<{ ok: true }>('/history', {
    method: 'DELETE',
  });
}
