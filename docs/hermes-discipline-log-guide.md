# Hermes Pomodoro Discipline Guide

Use this guide for Pomodoro-specific Discipline, task, Pomodoro, event, and
cron-run payloads.

Central authentication, service access, agent keys, scopes, and gateway rules
live in the central workspace document:

```txt
C:\letmecook\xsmity-central\_docs\access-management.md
```

Hermes production requests should use the central gateway base:

```txt
https://xsmity.cloud/api/agent/pomodoro
```

Direct Pomodoro API base for browser/service context:

```txt
https://pomodoro.xsmity.cloud/api
```

## Date Rule

All daily writes and reads use `YYYY-MM-DD`.

The business timezone is Asia/Bangkok. Hermes should explicitly send the exact
business date it is updating instead of relying on server time.

Example:

```txt
2026-07-08
```

Missing or invalid dates return `400`.

## Idempotency Rule

For repeated automation writes, send an `Idempotency-Key` header.

Recommended format:

```txt
hermes:<job>:<date>:<stable-item-id>
```

Examples:

```txt
hermes:nightly-review:2026-07-08:scores
hermes:reading:2026-07-08:deep-work-ch2
hermes:exercise:2026-07-08:run-evening
```

Supported by the Pomodoro API for append/write flows including tasks, history,
pomodoros, events, task snapshots, cron runs, reading logs, and exercise logs.

`POST /discipline/scores` is already an upsert by date, but using an
idempotency key is still fine for consistent agent behavior.

## Recommended Hermes Flow

1. Read the day first:

```http
GET /discipline/review?date=YYYY-MM-DD
```

2. Decide what is missing.
3. Write only missing append-only logs.
4. Save or update scores if needed.
5. Write a cron-run record for observability if Hermes is running a scheduled job.
6. Re-read the same review endpoint and trust the response as the source of truth.

Use the full gateway URL in production:

```txt
https://xsmity.cloud/api/agent/pomodoro/discipline/review?date=YYYY-MM-DD
```

## Discipline Endpoints

All endpoints below are shown as Pomodoro paths. Prefix them with:

```txt
https://xsmity.cloud/api/agent/pomodoro
```

### Read Full Daily Review

Best endpoint for Hermes to inspect a day:

```http
GET /discipline/review?date=YYYY-MM-DD
```

Returns:

- `date`
- `score`
- `streak`
- `reading`
- `exercise`
- `tasks`
- `taskSnapshot`
- `taskSnapshotSource`
- `taskSnapshotGeneratedAt`
- `pomodoros`
- `events`
- `generatedAt`

### Habit Catalog

Habits are per-user and binary:

- `0` = not done
- `1` = done
- Legacy values `2-10` still map as done

List habits for the authenticated user:

```http
GET /discipline/habits?includeInactive=1
```

Create a habit:

```http
POST /discipline/habits
```

```json
{
  "label": "No social media",
  "icon": "phone",
  "color": "orange"
}
```

Update a habit:

```http
PATCH /discipline/habits/:key
```

```json
{
  "label": "Phone free evening",
  "icon": "phone",
  "color": "orange",
  "active": true
}
```

Delete / deactivate:

```http
DELETE /discipline/habits/:key
```

- System habits soft-deactivate
- Custom habits hard-delete
- Allowed icons and colors are returned by `GET /discipline/habits`

### Save Daily Scores

```http
POST /discipline/scores
```

Body:

```json
{
  "date": "2026-07-08",
  "scores": {
    "deep_work": 1,
    "reading": 1,
    "exercise": 0,
    "sleep": 1,
    "nutrition": 1,
    "discipline": 1
  },
  "notes": "Good focus day"
}
```

Preferred shape: active habit keys from `GET /discipline/habits` with values `0` or `1`.

Partial maps are accepted and merge into existing same-day scores.

Legacy complete sets still work:

```txt
deep_work, reading, exercise, sleep, nutrition, discipline
```

and Hermes upper-case aliases:

```txt
BUILD, JOB_APPS, FLEX, EXERCISE, FOCUS, SLEEP
```

Any positive legacy value `1-10` is stored as done (`1`).

Recommended Hermes flow:

1. `GET /discipline/habits`
2. create missing habits if needed
3. `POST /discipline/scores` with those keys as `0|1`

Response includes:

- `score`
- `streak`
- camelCase and snake_case aliases such as `isGoodDay` and `is_good_day`
- good-day threshold is dynamic: `ceil(activeHabitCount * 0.66)`

### Read Daily Scores

```http
GET /discipline/scores?date=YYYY-MM-DD
```

Returns `404` if no score exists for that date.

### Read Score Trend

Preferred:

```http
GET /discipline/scores/trend?from=YYYY-MM-DD&to=YYYY-MM-DD
```

Legacy compatibility:

```http
GET /discipline/scores/trend?days=7&endDate=YYYY-MM-DD
GET /discipline/scores/trend?days=30&endDate=YYYY-MM-DD
```

### Read Streak

```http
GET /discipline/streak
```

Returns:

- `current`
- `longest`
- `lastScoreDate`
- `updatedAt`
- snake_case aliases

### Save Reading Log

```http
POST /discipline/reading
Idempotency-Key: hermes:reading:2026-07-08:deep-work-ch2
```

Body:

```json
{
  "date": "2026-07-08",
  "title": "Deep Work",
  "pages": 20,
  "minutes": 30,
  "notes": "Chapter 2"
}
```

### Read Reading Logs

```http
GET /discipline/reading?date=YYYY-MM-DD
```

### Save Exercise Log

```http
POST /discipline/exercise
Idempotency-Key: hermes:exercise:2026-07-08:run-evening
```

Body:

```json
{
  "date": "2026-07-08",
  "type": "Run",
  "durationMinutes": 25,
  "intensity": "moderate",
  "notes": "Easy pace"
}
```

### Read Exercise Logs

```http
GET /discipline/exercise?date=YYYY-MM-DD
```

## Pomodoro And Task Endpoints

All endpoints below also use the central gateway prefix:

```txt
https://xsmity.cloud/api/agent/pomodoro
```

### Settings

```http
GET /settings
PATCH /settings
```

### History

```http
GET /history
POST /history
DELETE /history
```

### Tasks

```http
GET /tasks
POST /tasks
PUT /tasks/:id
DELETE /tasks/:id
```

### Task Snapshots

Use this when Hermes wants to freeze the task state for a completed day:

```http
GET /task-snapshots?date=YYYY-MM-DD
POST /task-snapshots?date=YYYY-MM-DD
PUT /task-snapshots?date=YYYY-MM-DD
```

Body:

```json
{
  "tasks": [],
  "source": "hermes"
}
```

If `tasks` is omitted or empty, the server can build from live tasks.

### Completed Pomodoros

```http
GET /pomodoros
POST /pomodoros
```

Body:

```json
{
  "id": "session-id",
  "taskId": "task-1",
  "taskTitle": "Build sprint tracker",
  "durationMinutes": 25,
  "completedAt": "2026-07-08T15:00:00.000Z",
  "businessDate": "2026-07-08",
  "source": "hermes"
}
```

### Timer Events

```http
GET /events
GET /events?date=YYYY-MM-DD
POST /events
```

Known event types:

```txt
pomodoro_started
pomodoro_paused
pomodoro_resumed
pomodoro_cancelled
pomodoro_completed
```

### Cron Runs

Use this to record Hermes scheduled job execution:

```http
GET /cron-runs
GET /cron-runs?date=YYYY-MM-DD
POST /cron-runs
```

Body:

```json
{
  "job": "hermes-nightly-review",
  "status": "success",
  "businessDate": "2026-07-08",
  "startedAt": "2026-07-08T16:55:00.000Z",
  "finishedAt": "2026-07-08T16:56:00.000Z",
  "summary": "Reviewed day and saved scores",
  "source": "hermes"
}
```

Allowed statuses:

```txt
running
success
failed
partial
```

## Curl Examples

Read a day:

```bash
curl -sS \
  -H "Authorization: Bearer $HERMES_AGENT_KEY" \
  "https://xsmity.cloud/api/agent/pomodoro/discipline/review?date=2026-07-08"
```

Save scores:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $HERMES_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: hermes:nightly-review:2026-07-08:scores" \
  "https://xsmity.cloud/api/agent/pomodoro/discipline/scores" \
  -d '{
    "date": "2026-07-08",
    "scores": {
      "BUILD": 1,
      "JOB_APPS": 1,
      "FLEX": 1,
      "EXERCISE": 0,
      "FOCUS": 1,
      "SLEEP": 1
    },
    "notes": "Good focus day"
  }'
```

Record a cron run:

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $HERMES_AGENT_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: hermes:cron:2026-07-08:nightly-review" \
  "https://xsmity.cloud/api/agent/pomodoro/cron-runs" \
  -d '{
    "job": "hermes-nightly-review",
    "status": "success",
    "businessDate": "2026-07-08",
    "summary": "Saved nightly review",
    "source": "hermes"
  }'
```

## Local Development

Pomodoro API local default:

```txt
http://127.0.0.1:4177/api
```

Important local env in Pomodoro:

```txt
CENTRAL_AUTH_ENABLED=true
CENTRAL_AUTH_URL=http://localhost:3210
XSMITY_SERVICE_TOKEN=<same shared secret>
BUSINESS_TIME_ZONE=Asia/Bangkok
```

## Direct File Fallback

Prefer the API. Use files only if the API is unavailable and Hermes is already
on the VPS.

Legacy/global files:

```txt
/opt/pomodoro/data/discipline.sqlite
/opt/pomodoro/data/tasks.json
/opt/pomodoro/data/pomodoros.json
/opt/pomodoro/data/events.json
/opt/pomodoro/data/app-settings.json
/opt/pomodoro/data/history.json
/opt/pomodoro/data/task-snapshots.json
/opt/pomodoro/data/cron-runs.json
```

With central auth enabled, data may be scoped per central user:

```txt
/opt/pomodoro/data/users/<central-user-id>/
```

Do not write these files directly unless recovery requires it.

## Practical Rules For Hermes

- Use the central access-management document for auth and gateway rules.
- Send explicit `businessDate` or `date` for daily records.
- Send `Idempotency-Key` on repeated writes.
- Read `GET /discipline/review?date=...` before and after updates.
- Treat append-only logs as immutable unless a future edit/delete endpoint is added.
