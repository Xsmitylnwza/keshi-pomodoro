# Sprint Task And Pomodoro Sync

Keshi uses the API as the source of truth for sprint tasks, Pomodoro history,
selected task, timer preferences, theme, and radio state. `localStorage` is no
longer the default data store for these flows.

To point the app at a different VPS or service, set this build-time environment
variable:

```bash
VITE_HERMES_TASKS_API_URL=https://pomodoro.your-domain.com/api
```

## API Contract

The deployed API is mounted at:

```txt
https://pomodoro.xsmity.cloud/api
```

### App Settings

```http
GET /settings
PATCH /settings
```

Returns and updates persisted UI settings:

```json
{
  "focusTime": 25,
  "breakTime": 5,
  "soundEnabled": true,
  "selectedTaskId": "inbox",
  "theme": {
    "focus": "#b91c1c",
    "break": "#34d399",
    "leftImage": null,
    "rightImage": null
  },
  "radio": {
    "volume": 50,
    "tooltipSeen": false
  }
}
```

### History

```http
GET /history
POST /history
DELETE /history
```

History entries are stored server-side and replace the old localStorage log.

### Tasks

```http
GET /tasks
POST /tasks
PUT /tasks/:id
DELETE /tasks/:id
```

### Completed Pomodoros

```http
GET /pomodoros
POST /pomodoros
```

Receives completed focus sessions:

```json
{
  "id": "session-id",
  "taskId": "task-1",
  "taskTitle": "Build sprint tracker",
  "durationMinutes": 25,
  "completedAt": "2026-07-03T00:00:00.000Z",
  "source": "keshi-pomodoro"
}
```

### Timer Events

```http
GET /events
GET /events?date=2026-07-03
POST /events
```

Events are append-only records for timer lifecycle activity:

```json
{
  "id": "event-id",
  "sessionId": "session-id",
  "type": "pomodoro_cancelled",
  "mode": "focus",
  "taskId": "task-1",
  "taskTitle": "Build sprint tracker",
  "plannedSeconds": 1500,
  "elapsedSeconds": 640,
  "remainingSeconds": 860,
  "createdAt": "2026-07-03T00:00:00.000Z",
  "source": "keshi-pomodoro"
}
```

Known event types:

```txt
pomodoro_started
pomodoro_paused
pomodoro_resumed
pomodoro_cancelled
pomodoro_completed
```

## VPS Files

Hermes can also read the JSON files directly on the VPS:

```txt
/opt/pomodoro/data/app-settings.json
/opt/pomodoro/data/history.json
/opt/pomodoro/data/tasks.json
/opt/pomodoro/data/pomodoros.json
/opt/pomodoro/data/events.json
```

## Related Guide

- [Hermes Discipline Log Guide](./hermes-discipline-log-guide.md)
