# Discipline Dashboard

Personal life-signal surface for Pomodoro discipline data. It mirrors patterns and shows quiet status signals so the owner can interpret their own life load, without coaching them.

## Habit model

Habits are binary completion checks, not quality grades.

- `0` = not done
- `1` = done
- Legacy history `1-10` maps as **any value > 0 => done**

Day total is `habits done / active habit count`.

Default system habits still seed as deep work, reading, exercise, sleep, nutrition, and discipline. Each user can add custom habits with unique icons and colors through the Habit catalog UI or Hermes API.

## Unique habit colors

Default system colors:

- Deep work: rose
- Reading: amber
- Exercise: emerald
- Sleep: sky
- Nutrition: lime
- Discipline: violet

Custom habits pick from the shared palette: rose, amber, emerald, sky, lime, violet, orange, cyan, fuchsia, teal, indigo, pink.

## Habit catalog API

Per-user habit definitions live in `habit_definitions` inside each user discipline DB.

- `GET /api/discipline/habits`
- `POST /api/discipline/habits` `{ label, icon?, color?, key?, sortOrder?, active? }`
- `PATCH /api/discipline/habits/:key`
- `DELETE /api/discipline/habits/:key` (system habits soft-deactivate; custom hard-delete)

Scores accept active habit keys as `0|1` (legacy 1-10 still maps >0 => done). Hermes can manage the catalog through the same agent gateway paths.

## Language

**Pattern Mirror**:
A dashboard mode that shows how life is forming over days and weeks through trends, consistency, and load signals.
_Avoid_: Coach, assistant, recommendation engine

**Quiet Decision Support**:
Numbers and status signals that help interpretation without telling the user what to do.
_Avoid_: Do/Stop copy, push/protect commands, action CTA coaching

**Readiness Signal**:
Top-level status for output load versus recovery capacity from completion rates (Balanced / Strained / Overloaded).
_Avoid_: Recovery prescriptions

**Habit Completion Matrix**:
Day x habit grid showing whether each habit was done. Colored cell = done.
_Avoid_: Score heatmaps that imply quality grades

## Matrix views

Habit matrix and focus matrix share the same view-switcher chrome, with per-matrix preferences stored in localStorage.

### Habit matrix views
- `Grid` (default): day rows x habit columns
- `Lanes`: one row per habit, solid runs for consecutive done days
- `Weeks`: week cards with multi-habit dots per day
- `Rank`: habits sorted by completion rate in the selected window

### Focus matrix views
- `Hours` (default): day rows x 24-hour timeline
- `Days`: day intensity bars by focus minutes
- `Rank`: days sorted by focus volume

### Shared rules
- Range `7D/30D` and selected day stay page-global
- View mode is per-matrix only
- Clicking a day in any view still selects the same review day
- No coach language; views re-encode the same facts


**Coaching Action**:
Explicit instruction telling the user what to start, stop, or protect next.
_Status_: Explicitly rejected
