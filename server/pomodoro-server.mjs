import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = process.env.POMODORO_DIST_DIR || path.join(rootDir, 'dist');
const dataDir = process.env.POMODORO_DATA_DIR || path.join(rootDir, 'data');
const port = Number(process.env.PORT || 4177);
const host = process.env.HOST || '127.0.0.1';

const tasksFile = path.join(dataDir, 'tasks.json');
const sessionsFile = path.join(dataDir, 'pomodoros.json');
const eventsFile = path.join(dataDir, 'events.json');
const disciplineDbFile = process.env.DISCIPLINE_DB_FILE || path.join(dataDir, 'discipline.sqlite');
let disciplineDb;
const defaultTasks = [
  {
    id: 'inbox',
    title: 'Inbox / planning',
    status: 'doing',
    sprint: 'Today',
    order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    subtasks: [],
  },
];

const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mp3', 'audio/mpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function requireDateKey(value, fallback = todayKey()) {
  const date = value || fallback;
  if (!isDateKey(date)) {
    const error = new Error('invalid_date');
    error.statusCode = 400;
    throw error;
  }
  return date;
}

function clampTrendDays(value) {
  const days = Number(value || 7);
  if (!Number.isFinite(days)) return 7;
  return Math.min(30, Math.max(7, Math.trunc(days)));
}

async function getDisciplineDb() {
  if (disciplineDb) return disciplineDb;

  await mkdir(path.dirname(disciplineDbFile), { recursive: true });
  disciplineDb = new DatabaseSync(disciplineDbFile);
  disciplineDb.exec(`
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
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercise_log (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      intensity TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_reading_log_date ON reading_log(date);
    CREATE INDEX IF NOT EXISTS idx_exercise_log_date ON exercise_log(date);
  `);

  return disciplineDb;
}

function parseScores(row) {
  if (!row) return null;
  return {
    date: row.date,
    scores: JSON.parse(row.scores_json),
    notes: row.notes || '',
    total: row.total,
    average: row.average,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function scoreStats(scores) {
  const values = Object.values(scores || {})
    .map(Number)
    .filter(value => Number.isFinite(value));
  const total = values.reduce((sum, value) => sum + value, 0);
  return {
    total,
    average: values.length ? Number((total / values.length).toFixed(2)) : 0,
  };
}

function normalizeLogRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const nextKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    return [nextKey, value];
  }));
}

function datesBetween(startDate, endDate) {
  const dates = [];
  const cursor = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function recomputeStreak() {
  const db = await getDisciplineDb();
  const rows = db.prepare('SELECT date FROM daily_scores ORDER BY date ASC').all();
  const scoredDates = new Set(rows.map(row => row.date));
  let current = 0;
  let longest = 0;
  let run = 0;
  let previous = null;

  for (const row of rows) {
    const date = new Date(`${row.date}T00:00:00.000Z`);
    const isConsecutive = previous && (date - previous) === 86400000;
    run = isConsecutive ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }

  const today = todayKey();
  const yesterdayDate = new Date(`${today}T00:00:00.000Z`);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);
  const lastScoreDate = rows.at(-1)?.date || null;

  if (scoredDates.has(today) || scoredDates.has(yesterday)) {
    let cursor = scoredDates.has(today) ? today : yesterday;
    while (scoredDates.has(cursor)) {
      current += 1;
      const date = new Date(`${cursor}T00:00:00.000Z`);
      date.setUTCDate(date.getUTCDate() - 1);
      cursor = date.toISOString().slice(0, 10);
    }
  }

  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO streaks (id, current_count, longest_count, last_score_date, updated_at)
    VALUES ('discipline', ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      current_count = excluded.current_count,
      longest_count = excluded.longest_count,
      last_score_date = excluded.last_score_date,
      updated_at = excluded.updated_at
  `).run(current, longest, lastScoreDate, now);

  return { current, longest, lastScoreDate, updatedAt: now };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('invalid_json');
    error.statusCode = 400;
    throw error;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function sendNotFound(res) {
  sendJson(res, 404, { error: 'not_found' });
}

function normalizeTask(task, fallbackOrder = 0) {
  const now = new Date().toISOString();
  return {
    ...task,
    status: task.status || 'doing',
    sprint: task.sprint || 'Today',
    order: task.order ?? fallbackOrder,
    createdAt: task.createdAt || task.updatedAt || now,
    updatedAt: task.updatedAt || now,
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
  };
}

function normalizeTasks(tasks) {
  const total = tasks.length;
  return tasks
    .map((task, index) => normalizeTask(task, total - index))
    .sort((a, b) => (b.order || 0) - (a.order || 0));
}

function safeStaticPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0] || '/');
  if (decoded === '/') return path.join(distDir, 'index.html');
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  const resolved = path.join(distDir, normalized);
  if (!resolved.startsWith(distDir)) return null;
  return resolved;
}

async function handleApi(req, res, url) {
  const pathname = url.pathname;
  if (pathname === '/api/health') {
    sendJson(res, 200, { ok: true, service: 'keshi-pomodoro' });
    return;
  }

  if (pathname === '/api/tasks' && req.method === 'GET') {
    const tasks = normalizeTasks(await readJson(tasksFile, defaultTasks));
    sendJson(res, 200, { tasks });
    return;
  }

  if (pathname === '/api/tasks' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body?.title || typeof body.title !== 'string') {
      sendJson(res, 400, { error: 'title_required' });
      return;
    }

    const tasks = normalizeTasks(await readJson(tasksFile, []));
    const nextOrder = tasks.length > 0 ? Math.max(...tasks.map(task => task.order || 0)) + 1 : 1;
    const task = {
      id: body.id || randomUUID(),
      title: body.title.trim(),
      status: body.status || 'doing',
      sprint: body.sprint || 'Today',
      order: body.order ?? nextOrder,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subtasks: Array.isArray(body.subtasks) ? body.subtasks : [],
    };
    await writeJson(tasksFile, normalizeTasks([normalizeTask(task), ...tasks]));
    sendJson(res, 201, { task });
    return;
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === 'PUT') {
    const taskId = decodeURIComponent(taskMatch[1]);
    const body = await readBody(req);
    const tasks = normalizeTasks(await readJson(tasksFile, defaultTasks));
    const index = tasks.findIndex(task => task.id === taskId);

    if (index === -1) {
      sendJson(res, 404, { error: 'task_not_found' });
      return;
    }

    const task = normalizeTask({
      ...tasks[index],
      ...body,
      id: taskId,
      title: typeof body?.title === 'string' && body.title.trim() ? body.title.trim() : tasks[index].title,
      updatedAt: new Date().toISOString(),
    });
    tasks[index] = task;
    await writeJson(tasksFile, tasks);
    sendJson(res, 200, { task });
    return;
  }

  if (taskMatch && req.method === 'DELETE') {
    const taskId = decodeURIComponent(taskMatch[1]);
    const tasks = normalizeTasks(await readJson(tasksFile, defaultTasks));
    const nextTasks = tasks.filter(task => task.id !== taskId);

    if (nextTasks.length === tasks.length) {
      sendJson(res, 404, { error: 'task_not_found' });
      return;
    }

    await writeJson(tasksFile, nextTasks);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/pomodoros' && req.method === 'GET') {
    const sessions = await readJson(sessionsFile, []);
    sendJson(res, 200, { pomodoros: sessions });
    return;
  }

  if (pathname === '/api/pomodoros' && req.method === 'POST') {
    const body = await readBody(req);
    const session = {
      id: body?.id || randomUUID(),
      taskId: body?.taskId || null,
      taskTitle: body?.taskTitle || null,
      durationMinutes: Number(body?.durationMinutes || 0),
      completedAt: body?.completedAt || new Date().toISOString(),
      source: body?.source || 'keshi-pomodoro',
      storedAt: new Date().toISOString(),
    };

    if (!session.durationMinutes || session.durationMinutes < 0) {
      sendJson(res, 400, { error: 'duration_required' });
      return;
    }

    const sessions = await readJson(sessionsFile, []);
    await writeJson(sessionsFile, [session, ...sessions]);
    sendJson(res, 201, { pomodoro: session });
    return;
  }

  if (pathname === '/api/events' && req.method === 'GET') {
    const date = url.searchParams.get('date');
    const events = await readJson(eventsFile, []);
    const filteredEvents = date ? events.filter(event => String(event.createdAt || '').startsWith(date)) : events;
    sendJson(res, 200, { events: filteredEvents });
    return;
  }

  if (pathname === '/api/events' && req.method === 'POST') {
    const body = await readBody(req);
    if (!body?.type || typeof body.type !== 'string') {
      sendJson(res, 400, { error: 'type_required' });
      return;
    }

    const event = {
      id: body.id || randomUUID(),
      sessionId: body.sessionId || randomUUID(),
      type: body.type,
      mode: body.mode || 'focus',
      taskId: body.taskId || null,
      taskTitle: body.taskTitle || null,
      plannedSeconds: Number(body.plannedSeconds || 0),
      elapsedSeconds: Number(body.elapsedSeconds || 0),
      remainingSeconds: Number(body.remainingSeconds || 0),
      createdAt: body.createdAt || new Date().toISOString(),
      source: body.source || 'keshi-pomodoro',
    };

    const events = await readJson(eventsFile, []);
    await writeJson(eventsFile, [event, ...events]);
    sendJson(res, 201, { event });
    return;
  }

  if (pathname === '/api/discipline/scores' && req.method === 'POST') {
    const body = await readBody(req);
    const date = requireDateKey(body?.date);
    const scores = body?.scores && typeof body.scores === 'object' && !Array.isArray(body.scores) ? body.scores : null;
    if (!scores || Object.keys(scores).length === 0) {
      sendJson(res, 400, { error: 'scores_required' });
      return;
    }

    const stats = scoreStats(scores);
    const now = new Date().toISOString();
    const db = await getDisciplineDb();
    db.prepare(`
      INSERT INTO daily_scores (date, scores_json, notes, total, average, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        scores_json = excluded.scores_json,
        notes = excluded.notes,
        total = excluded.total,
        average = excluded.average,
        updated_at = excluded.updated_at
    `).run(date, JSON.stringify(scores), body?.notes || '', stats.total, stats.average, now, now);

    const row = db.prepare('SELECT * FROM daily_scores WHERE date = ?').get(date);
    const streak = await recomputeStreak();
    sendJson(res, 200, { score: parseScores(row), streak });
    return;
  }

  if (pathname === '/api/discipline/scores' && req.method === 'GET') {
    const date = requireDateKey(url.searchParams.get('date'));
    const db = await getDisciplineDb();
    const score = parseScores(db.prepare('SELECT * FROM daily_scores WHERE date = ?').get(date));
    sendJson(res, 200, { score });
    return;
  }

  if (pathname === '/api/discipline/scores/trend' && req.method === 'GET') {
    const days = clampTrendDays(url.searchParams.get('days'));
    const endDate = requireDateKey(url.searchParams.get('endDate'));
    const start = new Date(`${endDate}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    const startDate = start.toISOString().slice(0, 10);
    const db = await getDisciplineDb();
    const rows = db.prepare('SELECT * FROM daily_scores WHERE date BETWEEN ? AND ? ORDER BY date ASC').all(startDate, endDate);
    const byDate = new Map(rows.map(row => [row.date, parseScores(row)]));
    const trend = datesBetween(startDate, endDate).map(date => byDate.get(date) || {
      date,
      scores: null,
      notes: '',
      total: 0,
      average: 0,
      createdAt: null,
      updatedAt: null,
    });
    sendJson(res, 200, { days, startDate, endDate, trend });
    return;
  }

  if (pathname === '/api/discipline/streak' && req.method === 'GET') {
    const streak = await recomputeStreak();
    sendJson(res, 200, { streak });
    return;
  }

  if (pathname === '/api/discipline/reading' && req.method === 'POST') {
    const body = await readBody(req);
    const date = requireDateKey(body?.date);
    const now = new Date().toISOString();
    const entry = {
      id: body?.id || randomUUID(),
      date,
      title: body?.title || '',
      pages: Math.max(0, Number(body?.pages || 0)),
      minutes: Math.max(0, Number(body?.minutes || 0)),
      notes: body?.notes || '',
      createdAt: now,
    };
    const db = await getDisciplineDb();
    db.prepare(`
      INSERT INTO reading_log (id, date, title, pages, minutes, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(entry.id, entry.date, entry.title, entry.pages, entry.minutes, entry.notes, entry.createdAt);
    sendJson(res, 201, { reading: entry });
    return;
  }

  if (pathname === '/api/discipline/reading' && req.method === 'GET') {
    const date = requireDateKey(url.searchParams.get('date'));
    const db = await getDisciplineDb();
    const reading = db.prepare('SELECT * FROM reading_log WHERE date = ? ORDER BY created_at DESC').all(date).map(normalizeLogRow);
    sendJson(res, 200, { date, reading });
    return;
  }

  if (pathname === '/api/discipline/exercise' && req.method === 'POST') {
    const body = await readBody(req);
    const date = requireDateKey(body?.date);
    const now = new Date().toISOString();
    const entry = {
      id: body?.id || randomUUID(),
      date,
      type: body?.type || '',
      durationMinutes: Math.max(0, Number(body?.durationMinutes || body?.minutes || 0)),
      intensity: body?.intensity || '',
      notes: body?.notes || '',
      createdAt: now,
    };
    const db = await getDisciplineDb();
    db.prepare(`
      INSERT INTO exercise_log (id, date, type, duration_minutes, intensity, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(entry.id, entry.date, entry.type, entry.durationMinutes, entry.intensity, entry.notes, entry.createdAt);
    sendJson(res, 201, { exercise: entry });
    return;
  }

  if (pathname === '/api/discipline/exercise' && req.method === 'GET') {
    const date = requireDateKey(url.searchParams.get('date'));
    const db = await getDisciplineDb();
    const exercise = db.prepare('SELECT * FROM exercise_log WHERE date = ? ORDER BY created_at DESC').all(date).map(normalizeLogRow);
    sendJson(res, 200, { date, exercise });
    return;
  }

  if (pathname === '/api/discipline/review' && req.method === 'GET') {
    const date = requireDateKey(url.searchParams.get('date'));
    const db = await getDisciplineDb();
    const score = parseScores(db.prepare('SELECT * FROM daily_scores WHERE date = ?').get(date));
    const streak = await recomputeStreak();
    const reading = db.prepare('SELECT * FROM reading_log WHERE date = ? ORDER BY created_at DESC').all(date).map(normalizeLogRow);
    const exercise = db.prepare('SELECT * FROM exercise_log WHERE date = ? ORDER BY created_at DESC').all(date).map(normalizeLogRow);
    const pomodoros = (await readJson(sessionsFile, [])).filter(session => String(session.completedAt || session.storedAt || '').startsWith(date));
    const events = (await readJson(eventsFile, [])).filter(event => String(event.createdAt || '').startsWith(date));

    sendJson(res, 200, {
      date,
      score,
      streak,
      reading,
      exercise,
      pomodoros,
      events,
      generatedAt: new Date().toISOString(),
    });
    return;
  }

  sendNotFound(res);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }

    const filePath = safeStaticPath(url.pathname);
    if (!filePath) {
      sendNotFound(res);
      return;
    }

    const staticPath = existsSync(filePath) ? filePath : path.join(distDir, 'index.html');
    const ext = path.extname(staticPath);
    res.writeHead(200, {
      'content-type': contentTypes.get(ext) || 'application/octet-stream',
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    });
    createReadStream(staticPath)
      .on('error', () => sendNotFound(res))
      .pipe(res);
  } catch (error) {
    console.error(error);
    sendJson(res, error.statusCode || 500, { error: error.message === 'invalid_json' ? 'invalid_json' : 'internal_error' });
  }
});

server.listen(port, host, () => {
  console.log(`Keshi Pomodoro listening on http://${host}:${port}`);
});
