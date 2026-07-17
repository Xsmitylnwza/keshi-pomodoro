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
}

export async function fetchCalendarEvents(date: string): Promise<CalendarEventsResponse> {
  const response = await fetch(buildApiUrl(`/calendar/events?date=${encodeURIComponent(date)}`), {
    credentials: 'include',
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ? `Calendar API error: ${payload.error}` : `Calendar API request failed (${response.status})`);
  }

  return response.json() as Promise<CalendarEventsResponse>;
}
