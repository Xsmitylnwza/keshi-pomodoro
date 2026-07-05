# Discipline Dashboard Implementation Plan

## Product Direction

The Discipline Dashboard should become a retrospective life dashboard, not a live today tracker.

Hermes updates the discipline review around midnight, so the dashboard should focus on completed days:

- Last 7 days momentum
- Latest completed day review
- 30-day life map
- Habit trends and weak signals
- Hermes-readable patterns for tomorrow's focus

The dashboard should answer: "Am I showing up consistently, and what pattern is my life forming?"

## Approved Decisions

1. Lead with Last 7 Days Momentum.
2. Define momentum as consistency first, balance second.
3. Use a 30-day heatmap as the monthly backbone.
4. Add habit trend lines below the heatmap.
5. Score heatmap cells with the existing total discipline score first.
6. Keep the six current habit blocks:
   - deep_work
   - reading
   - exercise
   - sleep
   - nutrition
   - discipline
7. De-emphasize live today data.
8. Use latest completed day as the main daily detail.
9. Add insight cards:
   - consistency rate
   - best habit
   - weakest habit
   - focus volume
   - recovery risk
   - task completion
10. Tone should be calm truth, not shame.
11. Task completion is a secondary output signal, not the main life score.
12. Clearly show the data freshness rule, such as "Data through YYYY-MM-DD".

## Current Problems

The current dashboard mostly displays raw facts:

- Average score
- Current streak
- Pomodoro count
- Total points
- Score trend
- Score sliders
- Reading log
- Exercise log
- Pomodoros
- Events timeline

This is useful storage visibility, but it does not yet create a strong interpretation layer. It does not clearly show weekly momentum, month-level life pattern, best and weakest habits, or what to improve next.

## Target Information Architecture

### 1. Header

Purpose:

- Identify this as the Discipline Dashboard.
- Show the latest completed day, not live today progress.
- Keep date controls available for review, but do not let them dominate.

Content:

- Title: Discipline Dashboard
- Subtitle: "Retrospective life map"
- Data freshness: "Data through YYYY-MM-DD"
- Controls: previous day, selected date, next day, refresh

### 2. Seven-Day Momentum

This is the first major section.

Cards:

- Consistency rate
- Average score
- Best habit
- Weakest habit
- Recovery risk

Visualization:

- Seven compact day columns or cells.
- Each day shows total score intensity.
- Each day can include small dots for habits that were touched.

Calculation:

- A day counts as "shown up" when total score is greater than zero.
- Consistency rate = shown-up days / available days.
- Average score = mean total score over seven days.
- Best habit = habit with highest seven-day average.
- Weakest habit = habit with lowest seven-day average.
- Recovery risk = true when sleep, exercise, or nutrition average is low while deep_work is high.

### 3. Thirty-Day Life Map

Visualization:

- 30-day heatmap.
- Color intensity based on total discipline score.
- Tooltip or accessible label shows date, total, and top habit.

Purpose:

- Reveal gaps, streaks, and life rhythm over a month.
- Make weak periods visible without turning the dashboard into a guilt screen.

### 4. Habit Trend Lines

Visualization:

- One compact sparkline per habit.
- Show 30-day movement for the six score keys.

Purpose:

- Explain why the heatmap looks the way it looks.
- Show whether a habit is rising, flat, or falling.

### 5. Latest Completed Day Review

Use selected date detail, defaulting to latest completed day.

Content:

- Total score and notes
- Habit breakdown
- Completed tasks
- Pomodoro minutes and completed sessions
- Reading summary
- Exercise summary
- Event summary

This replaces the old "today dashboard" feeling.

### 6. Hermes Insight Panel

Initial implementation should generate deterministic insights in the frontend from available data.

Examples:

- "You showed up 5 of the last 7 days."
- "Deep work is strong, but sleep/recovery is lagging."
- "Your weakest habit this week is exercise."
- "Tomorrow's best focus: protect recovery before increasing workload."

Later, Hermes can provide richer generated text through a dedicated endpoint.

## Data Requirements

Existing endpoints are enough for the first implementation:

- `GET /api/discipline/review?date=YYYY-MM-DD`
- `GET /api/discipline/scores/trend?from=YYYY-MM-DD&to=YYYY-MM-DD`

The trend endpoint should be used for:

- Last 7 days momentum
- 30-day heatmap
- Habit trend lines

The review endpoint should be used for:

- Latest completed day detail
- Tasks
- Pomodoros
- Events
- Reading and exercise logs

## Proposed Frontend Architecture

Add a view-model layer so the dashboard component does not contain all calculation logic.

New file:

- `src/lib/disciplineDashboardModel.ts`

Responsibilities:

- Date helpers
- Build 7-day momentum summary
- Build 30-day heatmap cells
- Build habit trend summaries
- Compute best and weakest habits
- Compute recovery risk
- Produce deterministic Hermes insight strings

Update:

- `src/components/DisciplineDashboard.tsx`

Responsibilities:

- Fetch review and 30-day trend
- Render new retrospective layout
- Keep save score, reading, and exercise functionality if still useful
- Show clear loading, error, and empty states

## UI Implementation Details

Design direction:

- Dense but calm operational dashboard
- No marketing hero layout
- No giant decorative sections
- Use compact panels and full-width bands
- Keep cards for repeated metrics and records only

Recommended layout:

1. Header band
2. 7-day momentum band
3. 30-day heatmap band
4. Habit trend band
5. Latest completed day detail grid
6. Hermes insight panel

Mobile:

- Stack sections vertically.
- Heatmap should stay readable with fixed-size cells and horizontal wrapping.
- Trend lines should use stable compact heights.

## Implementation Phases

### Phase 1: Plan and Model

- Create this plan.
- Create dashboard view model.
- Add calculations for seven-day and thirty-day data.

### Phase 2: Dashboard UI

- Replace the current top stats with 7-day momentum.
- Add 30-day heatmap.
- Add habit trends.
- Convert daily section into latest completed day review.
- Keep existing forms only if they do not distract from retrospective review.

### Phase 3: Verification

- Run `npm run build`.
- Verify no TypeScript errors.
- Spot-check the production API:
  - `/api/health`
  - `/api/discipline/review`
  - `/api/discipline/scores/trend`
- Review UI for empty data, partial data, and full data.

### Phase 4: Deploy

- Commit changes.
- Push to `main`.
- Confirm GitHub Actions deploy succeeds.
- Report deployment run URL.

## Sub-Agent Delegation Plan

The main agent owns coordination, code review, final integration, verification, and deployment.

Sub-agents should use `gpt-5.4`.

### Sub-Agent 1: View Model Worker

Ownership:

- `src/lib/disciplineDashboardModel.ts`
- Related type exports only

Task:

- Implement dashboard summary calculations.
- Keep functions pure and deterministic.
- Avoid editing React components.

Deliverables:

- New model file
- Summary of functions and assumptions

### Sub-Agent 2: Dashboard UI Worker

Ownership:

- `src/components/DisciplineDashboard.tsx`

Task:

- Refactor the dashboard to use the new retrospective layout.
- Use the view model from Sub-Agent 1 once available.
- Keep existing API calls and save handlers working.
- Do not modify server files.

Deliverables:

- Updated dashboard component
- Notes on changed sections

### Sub-Agent 3: Verification Worker

Ownership:

- No production code unless fixing clearly isolated build issues after approval

Task:

- Run build and static checks.
- Inspect for broken imports, layout risks, and empty-state risks.
- Report issues with file and line references.

Deliverables:

- Build status
- Findings list
- Suggested fixes

## Acceptance Criteria

The work is complete when:

- Dashboard leads with 7-day momentum.
- Dashboard includes 30-day heatmap.
- Dashboard includes habit trend visualization.
- Today/live-progress framing is removed or clearly de-emphasized.
- Latest completed day is clearly shown.
- Insight cards explain patterns, not just raw counts.
- Build passes.
- Deployment succeeds through GitHub Actions.
