import { centralAuthBaseUrl } from './centralAuth';
import { buildApiUrl } from './apiBase';

export interface CalendarEvent {
  id: string;
  title: string;
  location: string;
  allDay: boolean;
  start: string;
  end: string | null;
  startDateKey: string;
  endDateKey: string;
  status: string;
}

export interface CalendarEventsResponse {
  enabled: boolean;
  configured: boolean;
  date: string;
  events: CalendarEvent[];
  source?: 'google_oauth' | 'ics' | string;
  connectUrl?: string;
  error?: string;
}

async function fetchGoogleOAuthCalendarEvents(date: string): Promise<CalendarEventsResponse> {
  const response = await fetch(
    `${centralAuthBaseUrl()}/auth/google/calendar/events?date=${encodeURIComponent(date)}`,
    {
      credentials: 'include',
      headers: { accept: 'application/json' },
    },
  );

  const payload = await response.json().catch(() => null) as
    | (CalendarEventsResponse & { error?: string; connectUrl?: string })
    | null;

  if (response.status === 401) {
    throw new Error('auth_required');
  }

  if (response.status === 409) {
    return {
      enabled: true,
      configured: false,
      date,
      events: [],
      source: 'google_oauth',
      connectUrl: payload?.connectUrl || `${centralAuthBaseUrl()}/auth/google/calendar/connect`,
      error: payload?.error || 'google_reauth_required',
    };
  }

  if (!response.ok) {
    throw new Error(payload?.error ? `Calendar API error: ${payload.error}` : `Calendar API request failed (${response.status})`);
  }

  return {
    enabled: Boolean(payload?.enabled ?? true),
    configured: Boolean(payload?.configured),
    date: payload?.date || date,
    events: Array.isArray(payload?.events) ? payload.events : [],
    source: payload?.source || 'google_oauth',
    connectUrl: payload?.connectUrl,
  };
}

async function fetchIcsCalendarEvents(date: string): Promise<CalendarEventsResponse> {
  const response = await fetch(buildApiUrl(`/calendar/events?date=${encodeURIComponent(date)}`), {
    credentials: 'include',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ? `Calendar API error: ${payload.error}` : `Calendar API request failed (${response.status})`);
  }

  const payload = await response.json() as CalendarEventsResponse;
  return {
    ...payload,
    source: payload.source || 'ics',
  };
}

export async function fetchCalendarEvents(date: string): Promise<CalendarEventsResponse> {
  try {
    const google = await fetchGoogleOAuthCalendarEvents(date);
    if (google.configured || google.events.length > 0) return google;

    // Not connected yet — try ICS fallback if configured in pomodoro settings.
    try {
      const ics = await fetchIcsCalendarEvents(date);
      if (ics.configured || ics.events.length > 0) return ics;
    } catch {
      // ignore ICS fallback errors when Google is preferred path
    }

    return google;
  } catch (error) {
    // If Google endpoint is unavailable (local/dev), fall back to ICS.
    try {
      return await fetchIcsCalendarEvents(date);
    } catch {
      throw error;
    }
  }
}

export function googleCalendarConnectUrl(returnTo = typeof window !== 'undefined' ? window.location.href : '/') {
  return `${centralAuthBaseUrl()}/auth/google/calendar/connect?return_to=${encodeURIComponent(returnTo)}`;
}
