# Sprint Task And Pomodoro Sync

Keshi can tag each focus Pomodoro with a sprint task. By default, tasks and
session history stay in `localStorage`, so the timer works offline. When the
app is built with the VPS API URL, Hermes can read and write sprint tasks,
completed Pomodoro sessions, and timer event logs.

To sync with a VPS/Hermes-controlled service, set this build-time environment
variable:

```bash
VITE_HERMES_TASKS_API_URL=https://pomodoro.your-domain.com/api
```

## API Contract

The deployed API is mounted at:

```txt
https://pomodoro.xsmity.cloud/api
```

### Tasks

```http
GET /tasks
```

Returns either an array or `{ "tasks": [...] }`:

```json
[
  {
    "id": "task-1",
    "title": "Build sprint tracker",
    "status": "doing",
    "sprint": "Today",
    "createdAt": "2026-07-03T00:00:00.000Z",
    "updatedAt": "2026-07-03T00:00:00.000Z",
    "subtasks": []
  }
]
```

```http
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
/opt/pomodoro/data/tasks.json
/opt/pomodoro/data/pomodoros.json
/opt/pomodoro/data/events.json
```
