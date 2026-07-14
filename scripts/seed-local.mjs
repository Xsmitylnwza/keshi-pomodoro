import { mkdir, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataDir = process.env.POMODORO_DATA_DIR || path.join(rootDir, 'data')
const force = process.argv.includes('--force') || process.env.POMODORO_SEED_FORCE === '1'
const businessTimeZone = process.env.BUSINESS_TIME_ZONE || 'Asia/Bangkok'

function toBusinessDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: businessTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${byType.year}-${byType.month}-${byType.day}`
}

function shiftBusinessDate(days) {
  const base = new Date()
  base.setDate(base.getDate() + days)
  return toBusinessDateKey(base)
}

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

async function exists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

async function writeJsonIfNeeded(filePath, value, label) {
  if (!force && (await exists(filePath))) {
    console.log(`[seed] skip existing ${label}`)
    return false
  }
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  console.log(`[seed] wrote ${label}`)
  return true
}

const today = toBusinessDateKey()
const day1 = shiftBusinessDate(-1)
const day2 = shiftBusinessDate(-2)
const day3 = shiftBusinessDate(-3)

const tasks = [
  {
    id: 'task-ship-local-demo',
    title: 'Ship local demo flow',
    status: 'doing',
    sprint: 'Today',
    order: 3,
    createdAt: hoursAgo(30),
    updatedAt: hoursAgo(2),
    businessDate: today,
    subtasks: [
      { id: 'sub-auth', title: 'Mock auth path', done: true, createdAt: hoursAgo(28) },
      { id: 'sub-seed', title: 'Seed sample data', done: true, createdAt: hoursAgo(26) },
      { id: 'sub-verify', title: 'Verify timer + tasks', done: false, createdAt: hoursAgo(4) },
    ],
  },
  {
    id: 'task-polish-ui',
    title: 'Polish timer UI microcopy',
    status: 'todo',
    sprint: 'Today',
    order: 2,
    createdAt: hoursAgo(20),
    updatedAt: hoursAgo(5),
    businessDate: today,
    subtasks: [],
  },
  {
    id: 'task-review-resume',
    title: 'Review resume bullet points',
    status: 'done',
    sprint: 'Today',
    order: 1,
    createdAt: hoursAgo(48),
    updatedAt: hoursAgo(10),
    businessDate: day1,
    subtasks: [
      { id: 'sub-story', title: 'Tighten storytelling draft', done: true, createdAt: hoursAgo(40) },
    ],
  },
  {
    id: 'task-deep-work',
    title: 'Deep work: feature sketch',
    status: 'done',
    sprint: 'Backlog',
    order: 0,
    createdAt: hoursAgo(72),
    updatedAt: hoursAgo(50),
    businessDate: day2,
    subtasks: [],
  },
]

const history = [
  {
    id: 'hist-focus-today-1',
    mode: 'focus',
    duration: 25,
    date: 'Today, 9:15 AM',
    businessDate: today,
    taskId: 'task-ship-local-demo',
    taskTitle: 'Ship local demo flow',
    syncedAt: hoursAgo(3),
  },
  {
    id: 'hist-break-today-1',
    mode: 'break',
    duration: 5,
    date: 'Today, 9:40 AM',
    businessDate: today,
    syncedAt: hoursAgo(2.5),
  },
  {
    id: 'hist-focus-today-2',
    mode: 'focus',
    duration: 25,
    date: 'Today, 10:00 AM',
    businessDate: today,
    taskId: 'task-polish-ui',
    taskTitle: 'Polish timer UI microcopy',
    syncedAt: hoursAgo(2),
  },
  {
    id: 'hist-focus-y-1',
    mode: 'focus',
    duration: 25,
    date: 'Yesterday, 2:00 PM',
    businessDate: day1,
    taskId: 'task-review-resume',
    taskTitle: 'Review resume bullet points',
    syncedAt: hoursAgo(20),
  },
  {
    id: 'hist-focus-y-2',
    mode: 'focus',
    duration: 25,
    date: 'Yesterday, 3:00 PM',
    businessDate: day1,
    taskId: 'task-review-resume',
    taskTitle: 'Review resume bullet points',
    syncedAt: hoursAgo(19),
  },
]

const pomodoros = [
  {
    id: 'pomo-today-1',
    sessionId: 'session-today-1',
    taskId: 'task-ship-local-demo',
    taskTitle: 'Ship local demo flow',
    durationMinutes: 25,
    completedAt: hoursAgo(3),
    businessDate: today,
    source: 'local-seed',
    storedAt: hoursAgo(3),
  },
  {
    id: 'pomo-today-2',
    sessionId: 'session-today-2',
    taskId: 'task-polish-ui',
    taskTitle: 'Polish timer UI microcopy',
    durationMinutes: 25,
    completedAt: hoursAgo(2),
    businessDate: today,
    source: 'local-seed',
    storedAt: hoursAgo(2),
  },
  {
    id: 'pomo-y-1',
    sessionId: 'session-y-1',
    taskId: 'task-review-resume',
    taskTitle: 'Review resume bullet points',
    durationMinutes: 25,
    completedAt: hoursAgo(20),
    businessDate: day1,
    source: 'local-seed',
    storedAt: hoursAgo(20),
  },
  {
    id: 'pomo-y-2',
    sessionId: 'session-y-2',
    taskId: 'task-review-resume',
    taskTitle: 'Review resume bullet points',
    durationMinutes: 25,
    completedAt: hoursAgo(19),
    businessDate: day1,
    source: 'local-seed',
    storedAt: hoursAgo(19),
  },
  {
    id: 'pomo-d2-1',
    sessionId: 'session-d2-1',
    taskId: 'task-deep-work',
    taskTitle: 'Deep work: feature sketch',
    durationMinutes: 25,
    completedAt: hoursAgo(50),
    businessDate: day2,
    source: 'local-seed',
    storedAt: hoursAgo(50),
  },
]

const events = [
  {
    id: 'event-today-1-start',
    sessionId: 'session-today-1',
    type: 'pomodoro_started',
    mode: 'focus',
    taskId: 'task-ship-local-demo',
    taskTitle: 'Ship local demo flow',
    plannedSeconds: 1500,
    elapsedSeconds: 0,
    remainingSeconds: 1500,
    createdAt: hoursAgo(3.42),
    businessDate: today,
    source: 'local-seed',
  },
  {
    id: 'event-today-1-done',
    sessionId: 'session-today-1',
    type: 'pomodoro_completed',
    mode: 'focus',
    taskId: 'task-ship-local-demo',
    taskTitle: 'Ship local demo flow',
    plannedSeconds: 1500,
    elapsedSeconds: 1500,
    remainingSeconds: 0,
    createdAt: hoursAgo(3),
    businessDate: today,
    source: 'local-seed',
  },
  {
    id: 'event-today-2-start',
    sessionId: 'session-today-2',
    type: 'pomodoro_started',
    mode: 'focus',
    taskId: 'task-polish-ui',
    taskTitle: 'Polish timer UI microcopy',
    plannedSeconds: 1500,
    elapsedSeconds: 0,
    remainingSeconds: 1500,
    createdAt: hoursAgo(2.42),
    businessDate: today,
    source: 'local-seed',
  },
  {
    id: 'event-today-2-done',
    sessionId: 'session-today-2',
    type: 'pomodoro_completed',
    mode: 'focus',
    taskId: 'task-polish-ui',
    taskTitle: 'Polish timer UI microcopy',
    plannedSeconds: 1500,
    elapsedSeconds: 1500,
    remainingSeconds: 0,
    createdAt: hoursAgo(2),
    businessDate: today,
    source: 'local-seed',
  },
]

const settings = {
  focusTime: 25,
  breakTime: 5,
  soundEnabled: true,
  selectedTaskId: 'task-ship-local-demo',
  theme: {
    focus: '#b91c1c',
    break: '#34d399',
    leftImage: null,
    rightImage: null,
  },
  radio: {
    volume: 45,
    tooltipSeen: true,
  },
  updatedAt: new Date().toISOString(),
}

const taskSnapshots = {
  [today]: {
    date: today,
    tasks,
    source: 'local-seed',
    generatedAt: new Date().toISOString(),
  },
}

await mkdir(dataDir, { recursive: true })
await writeJsonIfNeeded(path.join(dataDir, 'tasks.json'), tasks, 'tasks.json')
await writeJsonIfNeeded(path.join(dataDir, 'history.json'), history, 'history.json')
await writeJsonIfNeeded(path.join(dataDir, 'pomodoros.json'), pomodoros, 'pomodoros.json')
await writeJsonIfNeeded(path.join(dataDir, 'events.json'), events, 'events.json')
await writeJsonIfNeeded(path.join(dataDir, 'app-settings.json'), settings, 'app-settings.json')
await writeJsonIfNeeded(path.join(dataDir, 'task-snapshots.json'), taskSnapshots, 'task-snapshots.json')

const dbFile = path.join(dataDir, 'discipline.sqlite')
const dbExists = await exists(dbFile)
if (!force && dbExists) {
  console.log('[seed] skip existing discipline.sqlite')
} else {
  if (dbExists && force) {
    // Recreate by wiping tables after open
  }
  const db = new DatabaseSync(dbFile)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS daily_scores (
      date TEXT PRIMARY KEY,
      scores_json TEXT NOT NULL,
      notes TEXT,
      total INTEGER NOT NULL DEFAULT 0,
      average REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS streaks (
      id TEXT PRIMARY KEY,
      current_count INTEGER NOT NULL DEFAULT 0,
      longest_count INTEGER NOT NULL DEFAULT 0,
      last_score_date TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS reading_log (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      title TEXT,
      pages INTEGER NOT NULL DEFAULT 0,
      minutes INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL,
      idempotency_key TEXT
    );
    CREATE TABLE IF NOT EXISTS exercise_log (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      intensity TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      idempotency_key TEXT
    );
  `)

  if (force) {
    db.exec(`
      DELETE FROM daily_scores;
      DELETE FROM streaks;
      DELETE FROM reading_log;
      DELETE FROM exercise_log;
    `)
  }

  const scoreRows = [
    {
      date: today,
      scores: { deep_work: 8, reading: 6, exercise: 5, sleep: 7, nutrition: 6, discipline: 8 },
      notes: 'Local demo day — solid deep work blocks.',
    },
    {
      date: day1,
      scores: { deep_work: 7, reading: 8, exercise: 4, sleep: 6, nutrition: 5, discipline: 7 },
      notes: 'Interview prep + reading focus.',
    },
    {
      date: day2,
      scores: { deep_work: 9, reading: 5, exercise: 7, sleep: 7, nutrition: 6, discipline: 8 },
      notes: 'Heavy build day.',
    },
    {
      date: day3,
      scores: { deep_work: 5, reading: 4, exercise: 6, sleep: 8, nutrition: 7, discipline: 6 },
      notes: 'Recovery + light planning.',
    },
  ]

  const upsertScore = db.prepare(`
    INSERT INTO daily_scores (date, scores_json, notes, total, average, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      scores_json = excluded.scores_json,
      notes = excluded.notes,
      total = excluded.total,
      average = excluded.average,
      updated_at = excluded.updated_at
  `)

  for (const row of scoreRows) {
    const values = Object.values(row.scores)
    const total = values.reduce((sum, n) => sum + n, 0)
    const average = Number((total / values.length).toFixed(2))
    const now = new Date().toISOString()
    upsertScore.run(row.date, JSON.stringify(row.scores), row.notes, total, average, now, now)
  }

  db.prepare(`
    INSERT INTO streaks (id, current_count, longest_count, last_score_date, updated_at)
    VALUES ('default', 3, 5, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      current_count = excluded.current_count,
      longest_count = excluded.longest_count,
      last_score_date = excluded.last_score_date,
      updated_at = excluded.updated_at
  `).run(today, new Date().toISOString())

  db.prepare(`
    INSERT OR REPLACE INTO reading_log (id, date, title, pages, minutes, notes, created_at, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'read-local-1',
    today,
    'Designing Data-Intensive Applications',
    18,
    40,
    'Local seed reading log',
    hoursAgo(6),
    'seed:reading:1',
  )

  db.prepare(`
    INSERT OR REPLACE INTO exercise_log (id, date, type, duration_minutes, intensity, notes, created_at, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'ex-local-1',
    today,
    'walk',
    30,
    'easy',
    'Local seed exercise log',
    hoursAgo(8),
    'seed:exercise:1',
  )

  db.close()
  console.log('[seed] wrote discipline.sqlite')
}

console.log(`[seed] local mock data ready in ${dataDir}`)
console.log(`[seed] today business date: ${today}`)
