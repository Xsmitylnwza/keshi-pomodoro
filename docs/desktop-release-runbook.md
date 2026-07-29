# Keshi Pomodoro desktop release and rollback runbook

Last updated: 2026-07-29
Product label: connected desktop app with resilient in-flight timer recovery

## Release invariants

- Central Auth remains the only identity provider and session database.
- PostgreSQL `auth_users`, `auth_sessions`, and Google tokens are not migrated.
- The Pomodoro VPS remains canonical for tasks, settings, runtime, events,
  history, and Rhythm focus projections.
- Electron owns desktop scheduling and encrypted recovery only; it is not a
  second business database.
- The browser and desktop never run two completion writers for the same user.
- Existing active server runs are drained before any rollback enables the
  legacy browser timer.

## Feature controls

| Service | Control | Dark value | Staged value |
| --- | --- | --- | --- |
| Central Auth | `DESKTOP_AUTH_ENABLED` | `false` | `true` |
| Central Auth | `DESKTOP_AUTH_ALLOWED_USER_IDS` | owner ID only before enable | comma-separated approved Central IDs |
| Pomodoro | `SERVER_TIMER_ENABLED` | `false` | `true` |
| Pomodoro | `SERVER_TIMER_ALLOWED_USER_IDS` | owner ID only | comma-separated rollout IDs |
| Pomodoro static | `POMODORO_CSP_MODE` | `report-only` during observation | `enforce` after clean report |

`SERVER_TIMER_ALLOWLIST` is accepted only as a compatibility alias. New
configuration uses `SERVER_TIMER_ALLOWED_USER_IDS`.

## Preflight

1. Record the exact Central and Pomodoro commits.
2. Back up PostgreSQL and the Pomodoro data directory. Retain both backups.
3. Confirm `desktop_login_attempts` exists and its expiry index is present.
4. Confirm the owner Central user ID in both allowlists.
5. Confirm `GET /api/timer/runtime` is disabled for new starts or owner-only.
6. Run the required repository checks from the handoff matrix.
7. Confirm the safe asset build contains only `public-safe/` plus generated
   hashed bundles.
8. Confirm runtime dependency audit is zero high/critical and full build-chain
   audit has zero critical findings.
9. Confirm the release tag exactly equals `desktop/package.json` as `vX.Y.Z`.
10. Confirm signing secrets exist in GitHub Actions; never put a certificate or
    password in the app, repo, logs, or release assets.

## Deployment order

### Stage 1 — dark server capability

1. Deploy the Central migration and routes with
   `DESKTOP_AUTH_ENABLED=false`.
2. Deploy the Pomodoro timer endpoint with `SERVER_TIMER_ENABLED=false`.
3. Deploy the self-hosted fonts and safe assets with
   `POMODORO_CSP_MODE=report-only`.
4. Confirm ordinary web login, Calendar, tasks, history, Hermes, and Rhythm.

### Stage 2 — owner web timer

1. Set both allowlists to the owner's existing Central user ID.
2. Enable `SERVER_TIMER_ENABLED=true`.
3. Keep desktop auth disabled.
4. Complete at least 20 real web sessions.
5. Inspect for duplicate stable run IDs, projection mismatch, 5xx, and runtime
   conflicts. Stop expansion on any duplicate or cross-user mismatch.

### Stage 3 — owner desktop auth

1. Enable `DESKTOP_AUTH_ENABLED=true`.
2. Complete five real Google login/logout cycles from a clean desktop profile.
3. Record G2 evidence: the same `xsmity.sid` is sent by `persist:keshi` to
   Central and Pomodoro without copying its value to renderer code.
4. Revoke one desktop session and prove the normal browser session is
   unaffected.

### Stage 4 — internal desktop timer

Run 20 real focus sessions covering:

- renderer reload;
- close to tray;
- explicit quit and restart;
- sleep past `endAt`;
- network loss at completion and FIFO replay;
- start on web and observe on desktop;
- start on desktop and observe on web;
- notification click restore;
- sound disabled;
- sign-out cancel while online and rejected sign-out while offline.

Record every session in `desktop-runtime-evidence.md`.

### Stage 5 — signed release candidate

1. Push an annotated `vX.Y.Z` tag.
2. The Windows workflow verifies, makes, signs, checks Authenticode, generates
   SHA-256 checksums, and uploads Squirrel artifacts.
3. Install on a clean supported Windows VM.
4. Upgrade signed N to signed N+1.
5. Verify `persist:keshi`, encrypted cache, and installation client ID survive.
6. Tamper with an update artifact and prove it is rejected.
7. Verify a manual downgrade either reads schema N-1 safely or refuses it
   without deleting the newer recovery file.
8. Only then expose the stable installer publicly.

## Update behavior

- Update checks run only in packaged Windows builds.
- Downloads may occur during a timer.
- `quitAndInstall` is unreachable while an active timer, completion-pending
  state, or queued command exists.
- The tray reads “Update ready — installs after this timer” while busy.
- Installation requires the explicit “Restart to install update” tray action
  after the timer and outbox are idle.
- There is one stable channel and no automatic downgrade.

## Backout

1. Stop publishing or replace the `RELEASES` update metadata first.
2. Set `DESKTOP_AUTH_ENABLED=false` to stop new pairings.
3. Remove expansion IDs from both allowlists.
4. Set `SERVER_TIMER_ENABLED=false` to stop new server-timer starts.
5. Do not delete `desktop_login_attempts`; allow TTL cleanup.
6. Do not delete `timer-runtime.json`.
7. For each rollout user, wait until `/api/timer/runtime` returns
   `active: null` and all desktop recovery queues are drained or explicitly
   recovered through the web path.
8. Only after that state may the browser legacy timer be re-enabled.
9. Retain the previous signed installer, PostgreSQL backup, Pomodoro data
   backup, runtime files, and evidence.

Backout never rewrites or deletes existing users, sessions, Google tokens,
tasks, history, events, or Pomodoros.

## Local data

- Normal update preserves the partition, installation client ID, and encrypted
  recovery cache.
- Normal sign-out clears the Central session while retaining a same-user
  completion outbox for later recovery.
- “Sign out & remove desktop data” requires confirmation and removes the
  partition, cache, and old installation ID. Server data is unaffected.
- Squirrel uninstall validates that the target is a child of Windows AppData,
  then removes only Keshi userData.
- Forced uninstall can lose an unacknowledged local recovery record but cannot
  delete canonical server history.

## Stop conditions

- Any cross-user data display or replay: disable desktop auth and timer
  expansion immediately.
- Any duplicate completion for one stable run ID: stop timer rollout.
- Desktop auth exchange failures above 5%, excluding cancellation: investigate.
- Timer command 5xx above 1%: stop expansion.
- Queue older than 24 hours: surface manual recovery; never discard silently.
- Any mandatory gate G1–G6 without direct evidence: do not advance the
  corresponding release stage.
