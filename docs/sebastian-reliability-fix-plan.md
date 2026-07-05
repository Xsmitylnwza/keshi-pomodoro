# Sebastian Reliability Fix Plan

## Scope

Improve the Sebastian/Hermes automation flow without adding the authentication layer yet.

Authentication and write-signing are intentionally deferred. This plan focuses on correctness, idempotency, timezone safety, stable review data, cron observability, and regression tests.

## Problems Found

1. Day attribution is inconsistent.
   - Server derives task/review dates from UTC timestamps.
   - Hermes operates around Asia/Bangkok day boundaries.
   - Midnight and morning jobs can place the same work into different day buckets.

2. Append-only endpoints are not idempotent.
   - `POST /api/history`
   - `POST /api/pomodoros`
   - `POST /api/events`
   - `POST /api/discipline/reading`
   - `POST /api/discipline/exercise`
   - Repeated cron retries can inflate dashboard totals.

3. Daily review reconstructs old task state from mutable live tasks.
   - Historical task completion can change after later edits.
   - The review endpoint needs stable task snapshots.

4. Score schemas can drift.
   - Hermes can send spec score keys.
   - Dashboard and trend logic expect canonical lowercase keys.

5. Cron success/failure is not visible through the Pomodoro API.
   - Hermes logs exist, but the dashboard/API has no concise automation health surface.

6. Expected 400-level errors are logged like stack failures.
   - This makes production logs noisy and hides real failures.

7. No API-level regression tests cover Sebastian flows.

## Design Decisions

1. Use `businessDate` as the canonical day key.
   - Format: `YYYY-MM-DD`
   - Expected timezone: Asia/Bangkok
   - Existing timestamp fields remain for audit purposes.

2. Keep backward compatibility.
   - Existing clients can continue sending only timestamps.
   - Server derives a best-effort `businessDate` when missing.
   - New Hermes/Sebastian jobs should send `businessDate` explicitly.

3. Add idempotency without auth.
   - Accept `idempotencyKey` in write payloads.
   - Also accept `Idempotency-Key` request header.
   - If a matching key already exists, return the existing record instead of appending.

4. Store stable daily task snapshots.
   - Every review can include a snapshot created from current task state.
   - Add explicit API endpoints to read or refresh a snapshot.
   - Review falls back to live tasks only when no snapshot exists.

5. Canonicalize score keys at write time.
   - Store lowercase dashboard keys internally.
   - Accept the existing Hermes spec keys as input.

6. Add lightweight automation health logging.
   - New cron-run endpoint records scheduled job status.
   - This does not replace Hermes logs, but gives the dashboard/API a single health surface.

## API Contract Changes

### Business Date

New optional field accepted by task/session/event/history/log writes:

```json
{
  "businessDate": "2026-07-05"
}
```

Response objects should include `businessDate`.

### Idempotency

Accepted as either:

```http
Idempotency-Key: sebastian:morning:2026-07-05:task:test-full-system
```

or:

```json
{
  "idempotencyKey": "sebastian:morning:2026-07-05:task:test-full-system"
}
```

Duplicate write behavior:

- Return `200`
- Include the existing record
- Do not append a duplicate

### Task Snapshots

New endpoints:

```http
GET /api/task-snapshots?date=YYYY-MM-DD
PUT /api/task-snapshots?date=YYYY-MM-DD
```

`PUT` body:

```json
{
  "tasks": [],
  "source": "sebastian-evening-review",
  "idempotencyKey": "sebastian:review:2026-07-05:task-snapshot"
}
```

`GET /api/discipline/review?date=YYYY-MM-DD` should return:

- `tasks`
- `taskSnapshot`
- `taskSnapshotSource`
- `taskSnapshotGeneratedAt`

### Cron Runs

New endpoints:

```http
GET /api/cron-runs
GET /api/cron-runs?date=YYYY-MM-DD
POST /api/cron-runs
```

`POST` body:

```json
{
  "job": "Morning Brief",
  "status": "success",
  "businessDate": "2026-07-05",
  "startedAt": "2026-07-05T01:00:27.000Z",
  "finishedAt": "2026-07-05T01:02:54.000Z",
  "summary": "Pushed 4 tasks",
  "idempotencyKey": "sebastian:cron:morning:2026-07-05"
}
```

Allowed status values:

- `running`
- `success`
- `failed`
- `partial`

## Implementation Phases

### Phase 1: API Correctness

- Add business date helper functions.
- Add idempotency helper functions for JSON-backed lists.
- Add `businessDate` and `idempotencyKey` to task/history/pomodoro/event payloads.
- Add idempotency to reading/exercise tables.
- Canonicalize score schemas before saving.

### Phase 2: Stable Reviews

- Add task snapshot JSON storage.
- Add task snapshot endpoints.
- Update discipline review to prefer snapshot tasks.
- Add snapshot metadata to review response.

### Phase 3: Cron Observability

- Add cron-run JSON storage and endpoints.
- Add structured server error logging that does not print stack traces for expected 4xx errors.

### Phase 4: Client Updates

- Send `businessDate` for tasks, history, pomodoros, and events.
- Use stable local date helper in the frontend.
- Keep existing UI behavior unchanged.

### Phase 5: Tests

- Add Node API integration tests using a temp data directory.
- Cover:
  - duplicate task/session/event/log writes
  - businessDate review bucketing
  - score schema canonicalization
  - task snapshot stability
  - cron-run logging
  - missing-date 400 behavior

## Deferred

- API authentication/signature layer.
- Private network-only write separation.
- Full Hermes cron prompt rewrite.
- Calendar and finance webhook implementation changes outside this repo.

## Acceptance Criteria

- Repeated Sebastian writes do not duplicate tasks, events, sessions, reading logs, or exercise logs.
- Midnight and morning jobs can send explicit `businessDate` and land in the intended day.
- `GET /api/discipline/review` returns stable task snapshots when available.
- Spec score keys are accepted but stored as canonical lowercase keys.
- Cron job results can be recorded and queried through the API.
- API integration tests pass.
- `npm run build` passes.
