# Hermes Discipline Log Guide

Use this guide when Hermes needs to write or read the new Discipline data in Keshi Pomodoro.

## Base URL

- Production API: `https://pomodoro.xsmity.cloud/api/discipline`
- Local dev proxy: `/api/discipline`
- Optional frontend env override: `VITE_HERMES_DISCIPLINE_API_URL`

Prefer the API over direct file access. Use files only if the API is unavailable.

## What This API Stores

- Daily discipline scores, keyed by date
- Reading logs, appended per entry
- Exercise logs, appended per entry
- Daily review snapshots that combine score, streak, reading, exercise, tasks, pomodoros, and events

Pomodoro session logs and timer events are written by the main Pomodoro API:

- `GET /api/pomodoros`
- `POST /api/pomodoros`
- `GET /api/events`
- `POST /api/events`

## Date Rule

All write and read endpoints use a date key in `YYYY-MM-DD` format.

Example:

```txt
2026-07-04
```

Use the exact date string you intend to log against. If a required date is missing or invalid, the API returns `400`.

## Score Blocks

Default score keys:

- `deep_work`
- `reading`
- `exercise`
- `sleep`
- `nutrition`
- `discipline`

Each score value should be a number from `0` to `10`.

The API also accepts the spec score set used by Hermes:

- `BUILD`
- `JOB_APPS`
- `FLEX`
- `EXERCISE`
- `FOCUS`
- `SLEEP`

Only send one complete set per request.

## Recommended Hermes Flow

1. Read the day first with `GET /review?date=YYYY-MM-DD`.
2. Write only the logs that are missing.
3. Save scores with `POST /scores` when the day score changes.
4. Append reading or exercise logs with `POST /reading` and `POST /exercise`.
5. Re-read `GET /review?date=YYYY-MM-DD` to verify the final state.

Important:

- `POST /scores` is an upsert for that date.
- `POST /reading` and `POST /exercise` are append-only.
- There are no edit/delete endpoints for reading or exercise yet.
- `GET /scores?date=YYYY-MM-DD` returns `404` if no score exists for that date.
- `GET /scores?date=` or any missing required date returns `400`.

## Endpoints

### 1. Save daily scores

`POST /api/discipline/scores`

Body:

```json
{
  "date": "2026-07-04",
  "scores": {
    "deep_work": 8,
    "reading": 6,
    "exercise": 5,
    "sleep": 7,
    "nutrition": 6,
    "discipline": 8
  },
  "notes": "Good focus day"
}
```

Response returns:

- saved `score`
- updated `streak`
- `score.is_good_day` and `score.isGoodDay` are both returned
- `streak.current_streak`, `streak.longest_streak`, and `streak.last_score_date` are also returned

### 2. Read daily scores

`GET /api/discipline/scores?date=YYYY-MM-DD`

Returns the saved score object for that date. If no row exists, the API returns `404`.

### 3. Read score trend

Preferred:

`GET /api/discipline/scores/trend?from=YYYY-MM-DD&to=YYYY-MM-DD`

Legacy compatibility is still accepted:

`GET /api/discipline/scores/trend?days=7|30&endDate=YYYY-MM-DD`

Use this for dashboard charts and weekly or monthly summaries.

### 4. Read streak

`GET /api/discipline/streak`

Returns:

- `current`
- `longest`
- `lastScoreDate`
- `updatedAt`
- plus snake_case aliases: `current_streak`, `longest_streak`, `last_score_date`, `updated_at`

### 5. Save a reading log

`POST /api/discipline/reading`

Body:

```json
{
  "date": "2026-07-04",
  "title": "Deep Work",
  "pages": 20,
  "minutes": 30,
  "notes": "Chapter 2"
}
```

### 6. Read reading logs

`GET /api/discipline/reading?date=YYYY-MM-DD`

### 7. Save an exercise log

`POST /api/discipline/exercise`

Body:

```json
{
  "date": "2026-07-04",
  "type": "Run",
  "durationMinutes": 25,
  "intensity": "moderate",
  "notes": "Easy pace"
}
```

### 8. Read exercise logs

`GET /api/discipline/exercise?date=YYYY-MM-DD`

### 9. Read the full daily review

`GET /api/discipline/review?date=YYYY-MM-DD`

This is the best endpoint for Hermes to inspect a day. It returns:

- `date`
- `score`
- `streak`
- `reading`
- `exercise`
- `tasks` (daily sprint task snapshot)
- `pomodoros`
- `events`
- `generatedAt`

## Example Hermes Decision Pattern

When Hermes needs to update a day:

1. Fetch `GET /review?date=YYYY-MM-DD`.
2. Check whether the score already exists.
3. Save or overwrite the score with `POST /scores` if needed.
4. Append reading or exercise entries only when there is new activity.
5. Fetch `GET /review?date=YYYY-MM-DD` again and trust that payload as the source of truth.

## Direct VPS Files

If Hermes must inspect storage directly on the VPS, the important files are:

- `/opt/pomodoro/data/discipline.sqlite`
- `/opt/pomodoro/data/pomodoros.json`
- `/opt/pomodoro/data/events.json`

Use the API first. Use files only for fallback inspection.
