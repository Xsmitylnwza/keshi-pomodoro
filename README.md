<p align="center">
  <img src="public/logo.png" alt="Keshi Pomodoro logo" width="88" />
</p>

<h1 align="center">Keshi Pomodoro</h1>

<p align="center">
  <strong>A lo-fi focus timer and daily sprint manager.</strong>
</p>

<p align="center">
  <a href="https://pomodoro.xsmity.cloud/"><img src="https://img.shields.io/badge/Live-pomodoro.xsmity.cloud-b91c1c?style=for-the-badge" alt="Live app" /></a>
  <a href="https://github.com/Xsmitylnwza/keshi-pomodoro"><img src="https://img.shields.io/badge/GitHub-keshi--pomodoro-181717?style=for-the-badge&logo=github" alt="GitHub" /></a>
</p>

Keshi Pomodoro owns the immediate work loop: start a timer, choose today's tasks, see the next Calendar event, and keep a reliable focus-session history.

Habit definitions, habit outcomes, long-range habit analytics, and the Hermes habit integration live in [Rhythm — Habit Intelligence](https://habits.xsmity.cloud). `/discipline` redirects there.

## Features

- Pomodoro focus and break timer with keyboard controls
- Day-scoped Tasks / Doing / Done sprint board
- Google Calendar read-only Schedule with Now / Next cues
- Focus-session and timer-event history
- Themes, radio, sound, and lo-fi visual atmosphere
- Central Auth session integration
- Aggregate focus projection for Rhythm, with task titles excluded

<p align="center">
  <img src="public/demo/main_page.gif" alt="Keshi Pomodoro timer and sprint panel" width="100%" />
</p>

## Product boundary

```text
Keshi Pomodoro
  timer · tasks · focus sessions · Calendar cues
               │
               └─ aggregate focus only ─> Rhythm

Rhythm
  habits · outcomes · structured evidence · historical analytics · read-only MCP
               ▲
               └─ Hermes via Central Auth /api/agent/habits
```

Hermes must send habit data to `https://xsmity.cloud/api/agent/habits`, not `/api/agent/pomodoro/discipline`.

The old SQLite Discipline store is an immutable migration source. `/api/discipline/*` returns `410 habit_api_moved` by default; it can be re-enabled only for an explicit rollback window with `POMODORO_ENABLE_LEGACY_DISCIPLINE=true`. It is not the product's canonical habit store and must not receive new integrations.

## Focus analytics projection

Rhythm reads this authenticated Pomodoro endpoint:

```http
GET /api/analytics/focus/trend?from=YYYY-MM-DD&to=YYYY-MM-DD
```

It returns only daily aggregates:

- focus minutes
- completed session count
- first start time
- 24 hourly minute buckets

It does not return habit scores, task titles, notes, or raw session segments.

## Sprint panel and Calendar

The right-side panel keeps Tasks and Schedule in one linear flow. Calendar access is read-only through Central Auth:

```text
GET /auth/google/calendar/status
GET /auth/google/calendar/connect?return_to=...
GET /auth/google/calendar/events?date=YYYY-MM-DD
```

Production auth: `https://xsmity.cloud`

Production app: `https://pomodoro.xsmity.cloud`

## Run locally

```powershell
npm install
npm run dev:all
```

Or run API and Vite separately:

```powershell
npm run api
npm run dev
```

Useful scripts:

| Script | Purpose |
| --- | --- |
| `npm run dev:all` | API and frontend |
| `npm run seed:local` | Seed local timer/task fixtures |
| `npm test` | Focused API contract tests |
| `npm run build` | Typecheck and production build |
| `npm run preview` | Preview built frontend |

## Architecture

```text
React / Vite browser
  ├─ timer and local interaction state
  └─ REST
       └─ Node API
            ├─ tasks
            ├─ Pomodoro sessions
            ├─ timer events
            └─ aggregate focus projection

Central Auth
  ├─ shared browser session
  ├─ Google Calendar OAuth
  └─ agent gateway
```

Dates use `YYYY-MM-DD` in `Asia/Bangkok`.

### Windows desktop client

The independent Electron package is under `desktop/`. It is a client of the
same production UI, Central Auth session database, and Pomodoro VPS data; it
does not create local identities or a second business database.

```powershell
cd desktop
npm ci
npm run check
npm test
npm run smoke
```

Run the interactive desktop development client from the repository root:

```powershell
npm run desktop:dev
```

Desktop dev mode loads `https://pomodoro.xsmity.cloud` by default and uses the
real Central Auth Google login, shared production session database, and
per-user Pomodoro data on the VPS. It does not use the local mock user or a
local business database. `KESHI_DESKTOP_APP_URL` is only for an explicit
localhost renderer override.

Timer rollout controls:

| Variable | Values | Purpose |
| --- | --- | --- |
| `SERVER_TIMER_ENABLED` | truthy / false | Enables server-arbitrated starts |
| `SERVER_TIMER_ALLOWED_USER_IDS` | comma-separated Central user IDs | Limits starts to staged users; `SERVER_TIMER_ALLOWLIST` remains a compatibility alias |
| `POMODORO_CSP_MODE` | `report-only`, `enforce`, `disabled` | Stages restrictive CSP; production target is `enforce` |

The accurate product label is “connected desktop app with resilient in-flight
timer recovery.” New starts and pause/resume/cancel require connectivity;
completion alone has a durable encrypted offline outbox.

## Habit migration note

Do not delete or mutate a legacy `discipline.sqlite` file. Rhythm's importer reads a backup snapshot, preserves explicit positive scores as completed outcomes, and maps ambiguous legacy `0` values to `legacy_unrecorded` rather than `missed`.

Hermes routing details are in [docs/hermes-discipline-log-guide.md](docs/hermes-discipline-log-guide.md).

## Deploy

Push to `main`. The GitHub Actions workflow on the self-hosted `pomodoro` runner builds and restarts the service:

[.github/workflows/deploy.yml](.github/workflows/deploy.yml)

## License

MIT
