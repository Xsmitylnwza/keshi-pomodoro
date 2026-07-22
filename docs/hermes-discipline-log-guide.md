# Hermes habit routing migration

Habit ownership moved from Keshi Pomodoro to Rhythm. This file remains at the old path so existing operator links lead to the new contract.

## Use these endpoints

Public base:

```text
https://xsmity.cloud/api/agent/habits
```

Hermes needs `habits:write` for writes and `habits:read` for REST/MCP reads.

```text
GET    /                         list habits
POST   /                         create habit
PATCH  /:habitId                 update habit
PUT    /:habitId/outcomes/:date  record an explicit outcome
POST   /:habitId/outcomes/:date/void
GET    /:habitId/evidence?range=30&to=YYYY-MM-DD
POST   /:habitId/evidence        record structured habit detail
POST   /:habitId/evidence/:evidenceId/void
GET    /review?range=30&to=YYYY-MM-DD
GET    /history?habitId=:habitId&range=30&to=YYYY-MM-DD
POST   /mcp                      read-only MCP
```

Example:

```http
PUT /api/agent/habits/reading/outcomes/2026-07-22
Authorization: Bearer <hermes-agent-key>
Idempotency-Key: hermes:reading:2026-07-22:v1
Content-Type: application/json

{
  "status": "completed",
  "occurredAt": "2026-07-22T20:15:00+07:00",
  "sourceRef": "hermes:reading:2026-07-22"
}
```

Allowed explicit statuses are `completed`, `missed`, and `skipped`. No data means unrecorded; Hermes must not manufacture `missed` from silence.

Use a stable, unique `Idempotency-Key` for every write. Replaying the same key and payload returns the original result. Reusing a key with a different operation or payload is rejected.

Dates are `YYYY-MM-DD` in `Asia/Bangkok`.

Outcome and evidence are separate. Record the explicit completion state with the outcome endpoint, then attach reading/workout detail without making the detail itself imply success:

```http
POST /api/agent/habits/reading/evidence
Authorization: Bearer <hermes-agent-key>
Idempotency-Key: hermes:reading-session:2026-07-22:1:v1
Content-Type: application/json

{
  "localDate": "2026-07-22",
  "evidenceType": "reading",
  "sourceRef": "hermes:reading-session:2026-07-22:1",
  "expectedRevision": 0,
  "payload": {
    "title": "Designing Data-Intensive Applications",
    "pages": 18,
    "minutes": 35,
    "notes": "Replication chapter"
  }
}
```

Exercise evidence uses the same endpoint shape with `evidenceType: "exercise"` and fields such as `type`, `durationMinutes`, `intensity`, and `notes`. To correct an existing evidence record, keep the same `sourceRef`, send the current `expectedRevision`, and use a new idempotency key.

## Do not use

Do not send new habit writes to:

```text
/api/agent/pomodoro/discipline/*
/api/discipline/*
```

Those paths are legacy migration compatibility only. Pomodoro tasks, Pomodoro sessions, and timer events continue to use `/api/agent/pomodoro`.

## Compatibility payload

During a controlled cutover only, an old score payload can be sent to:

```text
POST /api/agent/habits/compat/discipline/scores
```

Positive values become `completed`. Zero values become `legacy_unrecorded`, not `missed`. New Hermes workflows should use explicit per-habit outcomes plus structured evidence instead.
