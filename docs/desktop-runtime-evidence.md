# Keshi Pomodoro desktop runtime evidence

This file is an evidence ledger, not a prose sign-off. Attach screenshots,
terminal logs, test artifacts, VM details, release URLs, and timestamps. Do not
mark a gate passed from code inspection alone.

## Gate status

| Gate | Status | Required direct evidence | Evidence path |
| --- | --- | --- | --- |
| G1 secure remote renderer | Pending external run | Clean Windows VM; UI, local Web Audio tones, tasks, settings, and allowed YouTube embed under sandbox/webSecurity/CSP | Pending |
| G2 real session handoff | Pass for staged owner in dev mode | System-browser Google login; `persist:keshi` Domain cookie authenticates both domains; no renderer cookie copy | `docs/evidence/production-dev-auth-rollout-2026-07-29.txt` |
| G3 crash healing | Pass | Kill API process after each event/history/Pomodoro/runtime boundary, restart, replay, and inspect exactly one projection record | `tests/timer-runtime.test.mjs`; `tests/timer-process-kill.integration.mjs`; `docs/evidence/timer-process-kill-2026-07-29.txt` |
| G4 Windows lifecycle | Unit and Electron startup smoke pass; lifecycle run pending | hide, quit, restart, sleep, offline completion, notification click, one run/notification, correct restore | `desktop/tests/`; clean-VM artifact pending |
| G5 signed update | Unsigned local Squirrel make passes; signed run pending | Valid Authenticode N and N+1; clean-VM install/update; state retained; tamper rejected | `.github/workflows/desktop-release.yml`; `docs/evidence/desktop-local-package-2026-07-29.txt`; signed release artifact pending |
| G6 asset rights | Pass for current safe asset set | Inventory of every redistributed asset with original provenance or license | `desktop/ASSET_PROVENANCE.md` |

## Five login/logout cycles

| Cycle | UTC time | App version | Central user ID hash | Login result | Logout result | Session independence proof | Artifact |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Pending | | | | | | |
| 2 | Pending | | | | | | |
| 3 | Pending | | | | | | |
| 4 | Pending | | | | | | |
| 5 | Pending | | | | | | |

Never record email, cookie value, pairing secret, Google token, or CSRF value.

## Twenty-session staged matrix

| Session | Scenario | Run ID suffix | Result | Projection counts | Notification count | Artifact |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | baseline focus | | Pending | | | |
| 2 | renderer reload | | Pending | | | |
| 3 | close to tray | | Pending | | | |
| 4 | explicit quit/restart | | Pending | | | |
| 5 | sleep past end | | Pending | | | |
| 6 | offline at end | | Pending | | | |
| 7 | reconnect replay | | Pending | | | |
| 8 | start web/observe desktop | | Pending | | | |
| 9 | start desktop/observe web | | Pending | | | |
| 10 | competing start | | Pending | | | |
| 11 | pause/resume | | Pending | | | |
| 12 | cancel | | Pending | | | |
| 13 | notification click | | Pending | | | |
| 14 | sound disabled | | Pending | | | |
| 15 | online logout cancel | | Pending | | | |
| 16 | offline logout blocked | | Pending | | | |
| 17 | break completion | | Pending | | | |
| 18 | update deferred | | Pending | | | |
| 19 | app restart queued completion | | Pending | | | |
| 20 | final soak | | Pending | | | |

For each focus completion, inspect one completed event, one history item, and
one Pomodoro projection. For each break completion, inspect one event and one
history item with no focus Pomodoro projection.

## Performance evidence

Target Windows machine:

- OS/build:
- CPU/RAM:
- network:
- clean/warm profile:

| Budget | Required | Measured | Tool/artifact | Status |
| --- | --- | --- | --- | --- |
| ready-to-show p95 | < 3 s | Pending | | |
| idle CPU with timer, 5 min avg | < 2% | Pending | | |
| idle working set | < 300 MiB | Pending | | |
| runtime poll rate | <= one per configured interval | Pending | | |
| timer command p95 | < 750 ms | Pending | | |

## Signed update evidence

- N tag/release:
- N installer SHA-256:
- N Authenticode signer/status:
- N+1 tag/release:
- N+1 installer SHA-256:
- N+1 Authenticode signer/status:
- clean VM recording:
- retained session proof:
- retained encrypted recovery proof:
- tamper rejection proof:
- downgrade result:

## Local packaging evidence (not a substitute for G5)

- Date: 2026-07-29 Asia/Bangkok
- Node: v22.23.1 x64
- Forge package/make: pass
- Artifacts: Setup.exe, RELEASES, and full nupkg present with recorded SHA-256
- Packaged Electron fuses: required security fuses verified
- Local signature: `NotSigned` because release certificate was not supplied
- Packaged launch: blocked before process creation by workstation Windows
  Application Control, which rejects this unsigned binary
- Evidence: `docs/evidence/desktop-local-package-2026-07-29.txt`

## Live rollout preflight

- Read-only production and GitHub prerequisite check:
  `docs/evidence/live-rollout-preflight-2026-07-29.txt`
- Central production cookie domain: confirmed `.xsmity.cloud` without exposing
  cookie or secret values
- Desktop-auth route and owner-only rollout flags: deployed
- Pomodoro server-timer owner allowlist: deployed
- Pomodoro CSP: deployed in report-only observation mode
- Windows signing Actions secrets: not configured
