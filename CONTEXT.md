# Pomodoro product boundary

Keshi Pomodoro owns timer sessions, daily tasks, Calendar cues, and focus-session history.

It does not own habit definitions, daily habit outcomes, habit history, or habit analysis. Those belong to Rhythm at `https://habits.xsmity.cloud`.

## Integration rules

- `/discipline` redirects to Rhythm.
- Rhythm reads aggregate focus from `GET /api/analytics/focus/trend`.
- The focus projection excludes task titles, notes, habit scores, and raw segments.
- Hermes sends Pomodoro tasks/sessions to `/api/agent/pomodoro`.
- Hermes sends habit definitions, outcomes, and structured evidence to `/api/agent/habits`.
- AI clients read habit analytics through Rhythm's read-only MCP endpoint.
- DailyCoach is not an active dependency.

## Legacy boundary

`/api/discipline/*` returns `410 habit_api_moved` by default. Legacy Discipline SQLite code remains only for an explicit rollback window and is not canonical.

Legacy source databases are immutable migration inputs. A legacy score of `0` is ambiguous and must become `legacy_unrecorded`, never an inferred miss.
