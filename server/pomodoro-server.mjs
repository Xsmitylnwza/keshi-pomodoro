import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = process.env.POMODORO_DIST_DIR || path.join(rootDir, 'dist');
const dataDir = process.env.POMODORO_DATA_DIR || path.join(rootDir, 'data');
const port = Number(process.env.PORT || 4177);
const host = process.env.HOST || '127.0.0.1';
const legacyDefaultTaskId = 'inbox';

const legacyTasksFile = path.join(dataDir, 'tasks.json');
const legacySessionsFile = path.join(dataDir, 'pomodoros.json');
const legacyEventsFile = path.join(dataDir, 'events.json');
const legacyAppSettingsFile = path.join(dataDir, 'app-settings.json');
const legacyHistoryFile = path.join(dataDir, 'history.json');
const legacyTaskSnapshotsFile = path.join(dataDir, 'task-snapshots.json');
const legacyCronRunsFile = path.join(dataDir, 'cron-runs.json');
const legacyDisciplineDbFile = process.env.DISCIPLINE_DB_FILE || path.join(dataDir, 'discipline.sqlite');
const disciplineDbs = new Map();
const legacyScoreKeys = ['deep_work', 'reading', 'exercise', 'sleep', 'nutrition', 'discipline'];
const specScoreKeys = ['BUILD', 'JOB_APPS', 'FLEX', 'EXERCISE', 'FOCUS', 'SLEEP'];
const specScoreKeyMap = {
  BUILD: 'deep_work',
  JOB_APPS: 'reading',
  FLEX: 'nutrition',
  EXERCISE: 'exercise',
  FOCUS: 'discipline',
  SLEEP: 'sleep',
};
const HABIT_COLOR_KEYS = ['rose', 'amber', 'emerald', 'sky', 'lime', 'violet', 'orange', 'cyan', 'fuchsia', 'teal', 'indigo', 'pink'];
const HABIT_ICON_KEYS = [
  'bar-chart-3', 'book-open', 'dumbbell', 'moon', 'apple', 'badge-check',
  'target', 'brain', 'heart', 'coffee', 'code-2', 'pen-line', 'music',
  'sun', 'leaf', 'flame', 'timer', 'check-circle-2', 'sparkles', 'wallet',
  'users', 'phone', 'camera', 'globe', 'home', 'star',
];
const DEFAULT_HABITS = [
  { key: 'deep_work', label: 'Deep work', icon: 'bar-chart-3', color: 'rose', sortOrder: 0, active: true, system: true },
  { key: 'reading', label: 'Reading', icon: 'book-open', color: 'amber', sortOrder: 1, active: true, system: true },
  { key: 'exercise', label: 'Exercise', icon: 'dumbbell', color: 'emerald', sortOrder: 2, active: true, system: true },
  { key: 'sleep', label: 'Sleep', icon: 'moon', color: 'sky', sortOrder: 3, active: true, system: true },
  { key: 'nutrition', label: 'Nutrition', icon: 'apple', color: 'lime', sortOrder: 4, active: true, system: true },
  { key: 'discipline', label: 'Discipline', icon: 'badge-check', color: 'violet', sortOrder: 5, active: true, system: true },
];
const businessTimeZone = process.env.BUSINESS_TIME_ZONE || 'Asia/Bangkok';
const centralAuthEnabled = isTruthyEnv(process.env.CENTRAL_AUTH_ENABLED);
const centralAuthBaseUrl = centralAuthEnabled ? normalizeCentralAuthUrl(process.env.CENTRAL_AUTH_URL) : '';
const trustedCentralServiceToken = process.env.XSMITY_SERVICE_TOKEN || process.env.CENTRAL_SERVICE_TOKEN || '';
const defaultUserKey = process.env.POMODORO_DEFAULT_USER_ID || process.env.DEFAULT_OWNER_USER_ID || '';
const defaultAppSettings = {
  focusTime: 25,
  breakTime: 5,
  soundEnabled: true,
  selectedTaskId: '',
  theme: {
    focus: '#b91c1c',
    break: '#34d399',
    leftImage: null,
    rightImage: null,
  },
  radio: {
    volume: 50,
    tooltipSeen: false,
  },
};

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

function isTruthyEnv(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized !== '' && !['0', 'false', 'no', 'off'].includes(normalized);
}

function normalizeCentralAuthUrl(value) {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return (trimmed || 'http://localhost:3210').replace(/\/+$/, '');
}

function sanitizeUserKey(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.replace(/[^a-zA-Z0-9._@-]/g, '_').slice(0, 160);
}

function userDataDir(userKey) {
  const safeKey = sanitizeUserKey(userKey);
  return safeKey ? path.join(dataDir, 'users', safeKey) : dataDir;
}

function userFile(userKey, fileName, legacyFile) {
  const safeKey = sanitizeUserKey(userKey);
  return safeKey ? path.join(userDataDir(safeKey), fileName) : legacyFile;
}

function userIdentityKey(user) {
  return sanitizeUserKey(user?.id || user?.providerSubject || user?.email || '');
}

function serviceUserKey(req) {
  return sanitizeUserKey(
    req.headers['x-xsmity-user-id']
      || req.headers['x-xsmity-owner-id']
      || defaultUserKey
      || 'service-xsmity-auth',
  );
}

async function requestAuthContext(req) {
  if (hasValidCentralServiceAuth(req)) {
    return { authenticated: true, userKey: serviceUserKey(req), service: true };
  }
  if (!centralAuthEnabled) return { authenticated: true, userKey: '', service: false };

  const cookieHeader = Array.isArray(req.headers.cookie) ? req.headers.cookie.join('; ') : req.headers.cookie;
  if (typeof cookieHeader !== 'string' || !cookieHeader.trim()) return { authenticated: false };

  try {
    const response = await fetch(`${centralAuthBaseUrl}/auth/session`, {
      headers: {
        accept: 'application/json',
        cookie: cookieHeader,
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return { authenticated: false };

    const session = await response.json().catch(() => null);
    const authenticated = session?.authenticated === true
      && session?.user
      && typeof session.user === 'object'
      && !Array.isArray(session.user);
    if (!authenticated) return { authenticated: false };
    const userKey = userIdentityKey(session.user);
    return userKey ? { authenticated: true, userKey, service: false, user: session.user } : { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}

function hasValidCentralServiceAuth(req) {
  if (!trustedCentralServiceToken) return false;
  const serviceName = String(req.headers['x-xsmity-service'] || '').trim();
  const serviceToken = String(req.headers['x-xsmity-service-token'] || '').trim();
  return serviceName === 'xsmity-auth' && safeEqualSecret(serviceToken, trustedCentralServiceToken);
}

function safeEqualSecret(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function normalizeThemeSettings(value) {
  return {
    focus: typeof value?.focus === 'string' && value.focus.trim() ? value.focus.trim() : defaultAppSettings.theme.focus,
    break: typeof value?.break === 'string' && value.break.trim() ? value.break.trim() : defaultAppSettings.theme.break,
    leftImage: typeof value?.leftImage === 'string' ? value.leftImage : null,
    rightImage: typeof value?.rightImage === 'string' ? value.rightImage : null,
  };
}

function normalizeRadioSettings(value) {
  const volume = Number(value?.volume);
  return {
    volume: Number.isFinite(volume) ? Math.min(100, Math.max(0, Math.trunc(volume))) : defaultAppSettings.radio.volume,
    tooltipSeen: Boolean(value?.tooltipSeen),
  };
}

function normalizeAppSettings(value) {
  const focusTime = Number(value?.focusTime);
  const breakTime = Number(value?.breakTime);

  return {
    focusTime: Number.isFinite(focusTime) && focusTime > 0 ? Math.trunc(focusTime) : defaultAppSettings.focusTime,
    breakTime: Number.isFinite(breakTime) && breakTime > 0 ? Math.trunc(breakTime) : defaultAppSettings.breakTime,
    soundEnabled: typeof value?.soundEnabled === 'boolean' ? value.soundEnabled : defaultAppSettings.soundEnabled,
    selectedTaskId: typeof value?.selectedTaskId === 'string' && value.selectedTaskId.trim() ? value.selectedTaskId : defaultAppSettings.selectedTaskId,
    theme: normalizeThemeSettings(value?.theme),
    radio: normalizeRadioSettings(value?.radio),
    updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
  };
}

async function readAppSettings(userKey) {
  return normalizeAppSettings(await readJson(userFile(userKey, 'app-settings.json', legacyAppSettingsFile), defaultAppSettings));
}

async function writeAppSettings(userKey, nextSettings) {
  const normalized = normalizeAppSettings(nextSettings);
  await writeJson(userFile(userKey, 'app-settings.json', legacyAppSettingsFile), normalized);
  return normalized;
}

function mergeAppSettings(current, patch) {
  return normalizeAppSettings({
    ...current,
    ...patch,
    theme: patch?.theme ? { ...current.theme, ...patch.theme } : current.theme,
    radio: patch?.radio ? { ...current.radio, ...patch.radio } : current.radio,
    updatedAt: new Date().toISOString(),
  });
}

function normalizeHistoryItem(item) {
  const duration = Number(item?.duration);
  const idempotencyKey = typeof item?.idempotencyKey === 'string' && item.idempotencyKey.trim() ? item.idempotencyKey.trim() : undefined;
  const businessDate = resolveBusinessDate(item);
  return {
    id: typeof item?.id === 'string' && item.id ? item.id : randomUUID(),
    mode: typeof item?.mode === 'string' ? item.mode : 'focus',
    duration: Number.isFinite(duration) && duration > 0 ? Math.trunc(duration) : 0,
    date: typeof item?.date === 'string' ? item.date : new Date().toISOString(),
    businessDate,
    taskId: typeof item?.taskId === 'string' ? item.taskId : undefined,
    taskTitle: typeof item?.taskTitle === 'string' ? item.taskTitle : undefined,
    syncedAt: typeof item?.syncedAt === 'string' ? item.syncedAt : new Date().toISOString(),
    syncError: typeof item?.syncError === 'string' ? item.syncError : undefined,
    idempotencyKey,
  };
}

async function readHistory(userKey) {
  const history = await readJson(userFile(userKey, 'history.json', legacyHistoryFile), []);
  return Array.isArray(history) ? history.map(normalizeHistoryItem) : [];
}

async function writeHistory(userKey, history) {
  const normalized = Array.isArray(history) ? history.map(normalizeHistoryItem) : [];
  await writeJson(userFile(userKey, 'history.json', legacyHistoryFile), normalized);
  return normalized;
}

function todayKey() {
  return toBusinessDateKey(new Date());
}

function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toBusinessDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return todayKey();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: businessTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function requireDateKey(value, fieldName = 'date') {
  if (!value) {
    const error = new Error(`${fieldName}_required`);
    error.statusCode = 400;
    throw error;
  }

  if (!isDateKey(value)) {
    const error = new Error('invalid_date');
    error.statusCode = 400;
    throw error;
  }

  return value;
}

function optionalDateKey(value, fieldName = 'date') {
  if (value === undefined || value === null || value === '') return null;
  return requireDateKey(value, fieldName);
}

function resolveBusinessDate(source, fallbackValue = new Date()) {
  const dateField = isDateKey(source?.date) ? source.date : null;
  const explicit = optionalDateKey(source?.businessDate ?? source?.business_date ?? dateField, 'businessDate');
  if (explicit) return explicit;
  const timestamp = source?.createdAt ?? source?.completedAt ?? source?.updatedAt ?? source?.storedAt ?? source?.date ?? fallbackValue;
  return toBusinessDateKey(timestamp);
}

function getIdempotencyKey(req, body) {
  const headerValue = req.headers['idempotency-key'];
  const headerKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  const key = headerKey ?? body?.idempotencyKey ?? body?.idempotency_key;
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}

function findIdempotentRecord(records, idempotencyKey, id) {
  if (!Array.isArray(records)) return null;
  if (idempotencyKey) {
    const match = records.find(record => record?.idempotencyKey === idempotencyKey || record?.idempotency_key === idempotencyKey);
    if (match) return match;
  }
  if (id) {
    const match = records.find(record => record?.id === id);
    if (match) return match;
  }
  return null;
}

function clampTrendDays(value) {
  const days = Number(value || 7);
  if (!Number.isFinite(days)) return 7;
  return Math.min(30, Math.max(7, Math.trunc(days)));
}

function isExactKeySet(source, allowedKeys) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return false;
  const keys = Object.keys(source);
  return keys.length === allowedKeys.length && allowedKeys.every(key => Object.hasOwn(source, key));
}

function toBinaryHabitScore(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 10) {
    const error = new Error('invalid_score_value');
    error.statusCode = 400;
    throw error;
  }
  // Accept legacy 0-10 history and current 0/1 checks. Any positive mark counts as done.
  return number > 0 ? 1 : 0;
}

function normalizeScoreValue(value) {
  return toBinaryHabitScore(value);
}

function slugifyHabitKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function normalizeHabitIcon(value, fallback = 'target') {
  const icon = String(value || '').trim().toLowerCase();
  return HABIT_ICON_KEYS.includes(icon) ? icon : fallback;
}

function normalizeHabitColor(value, fallback = 'violet') {
  const color = String(value || '').trim().toLowerCase();
  return HABIT_COLOR_KEYS.includes(color) ? color : fallback;
}

function colorForIndex(index) {
  return HABIT_COLOR_KEYS[index % HABIT_COLOR_KEYS.length];
}

function goodDayThresholdForCount(count) {
  const total = Math.max(0, Number(count) || 0);
  if (total <= 0) return 0;
  return Math.max(1, Math.ceil(total * 0.66));
}

function mapHabitRow(row) {
  if (!row) return null;
  return {
    key: row.key,
    label: row.label,
    icon: row.icon,
    color: row.color,
    sortOrder: Number(row.sort_order || 0),
    active: Number(row.active) === 1,
    system: Number(row.system) === 1,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

async function ensureHabitDefinitions(db) {
  const now = new Date().toISOString();
  const count = db.prepare('SELECT COUNT(*) AS count FROM habit_definitions').get()?.count || 0;
  if (count > 0) return;
  const insert = db.prepare(`
    INSERT INTO habit_definitions (key, label, icon, color, sort_order, active, system, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const habit of DEFAULT_HABITS) {
    insert.run(
      habit.key,
      habit.label,
      habit.icon,
      habit.color,
      habit.sortOrder,
      habit.active ? 1 : 0,
      habit.system ? 1 : 0,
      now,
      now,
    );
  }
}

async function listHabitDefinitions(userKey, { includeInactive = true } = {}) {
  const db = await getDisciplineDb(userKey);
  await ensureHabitDefinitions(db);
  const rows = includeInactive
    ? db.prepare('SELECT * FROM habit_definitions ORDER BY sort_order ASC, key ASC').all()
    : db.prepare('SELECT * FROM habit_definitions WHERE active = 1 ORDER BY sort_order ASC, key ASC').all();
  return rows.map(mapHabitRow);
}

async function createHabitDefinition(userKey, input = {}) {
  const db = await getDisciplineDb(userKey);
  await ensureHabitDefinitions(db);
  const label = String(input.label || '').trim();
  if (!label) {
    const error = new Error('habit_label_required');
    error.statusCode = 400;
    throw error;
  }
  let key = slugifyHabitKey(input.key || label);
  if (!key) {
    const error = new Error('habit_key_invalid');
    error.statusCode = 400;
    throw error;
  }
  const existing = db.prepare('SELECT key FROM habit_definitions WHERE key = ?').get(key);
  if (existing) {
    if (input.key) {
      const error = new Error('habit_key_exists');
      error.statusCode = 409;
      throw error;
    }
    key = `${key}_${Math.random().toString(36).slice(2, 6)}`;
  }

  const maxSort = db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS maxSort FROM habit_definitions').get()?.maxSort ?? -1;
  const now = new Date().toISOString();
  const habit = {
    key,
    label,
    icon: normalizeHabitIcon(input.icon, 'target'),
    color: normalizeHabitColor(input.color, colorForIndex(maxSort + 1)),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Math.trunc(Number(input.sortOrder)) : maxSort + 1,
    active: input.active === false ? 0 : 1,
    system: 0,
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(`
    INSERT INTO habit_definitions (key, label, icon, color, sort_order, active, system, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(habit.key, habit.label, habit.icon, habit.color, habit.sortOrder, habit.active, habit.system, habit.createdAt, habit.updatedAt);

  return mapHabitRow(db.prepare('SELECT * FROM habit_definitions WHERE key = ?').get(habit.key));
}

async function updateHabitDefinition(userKey, key, input = {}) {
  const db = await getDisciplineDb(userKey);
  await ensureHabitDefinitions(db);
  const existing = db.prepare('SELECT * FROM habit_definitions WHERE key = ?').get(key);
  if (!existing) {
    const error = new Error('habit_not_found');
    error.statusCode = 404;
    throw error;
  }

  const next = {
    label: input.label !== undefined ? String(input.label || '').trim() : existing.label,
    icon: input.icon !== undefined ? normalizeHabitIcon(input.icon, existing.icon) : existing.icon,
    color: input.color !== undefined ? normalizeHabitColor(input.color, existing.color) : existing.color,
    sortOrder: input.sortOrder !== undefined && Number.isFinite(Number(input.sortOrder))
      ? Math.trunc(Number(input.sortOrder))
      : existing.sort_order,
    active: input.active !== undefined ? (input.active ? 1 : 0) : existing.active,
  };
  if (!next.label) {
    const error = new Error('habit_label_required');
    error.statusCode = 400;
    throw error;
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE habit_definitions
    SET label = ?, icon = ?, color = ?, sort_order = ?, active = ?, updated_at = ?
    WHERE key = ?
  `).run(next.label, next.icon, next.color, next.sortOrder, next.active, now, key);

  return mapHabitRow(db.prepare('SELECT * FROM habit_definitions WHERE key = ?').get(key));
}

async function deleteHabitDefinition(userKey, key) {
  const db = await getDisciplineDb(userKey);
  await ensureHabitDefinitions(db);
  const existing = db.prepare('SELECT * FROM habit_definitions WHERE key = ?').get(key);
  if (!existing) {
    const error = new Error('habit_not_found');
    error.statusCode = 404;
    throw error;
  }
  if (Number(existing.system) === 1) {
    const now = new Date().toISOString();
    db.prepare('UPDATE habit_definitions SET active = 0, updated_at = ? WHERE key = ?').run(now, key);
    return mapHabitRow(db.prepare('SELECT * FROM habit_definitions WHERE key = ?').get(key));
  }
  db.prepare('DELETE FROM habit_definitions WHERE key = ?').run(key);
  return { key, deleted: true };
}

function validateScoresPayload(scores, habits = DEFAULT_HABITS, existingScores = {}) {
  if (!scores || typeof scores !== 'object' || Array.isArray(scores)) {
    const error = new Error('scores_required');
    error.statusCode = 400;
    throw error;
  }

  const habitKeys = habits.map(habit => habit.key);
  const activeKeys = habits.filter(habit => habit.active).map(habit => habit.key);
  const knownKeys = new Set([...habitKeys, ...legacyScoreKeys]);

  const currentShape = isExactKeySet(scores, legacyScoreKeys);
  const specShape = isExactKeySet(scores, specScoreKeys);
  const exactActiveShape = activeKeys.length > 0 && isExactKeySet(scores, activeKeys);

  let incoming = {};
  if (currentShape) {
    for (const key of legacyScoreKeys) incoming[key] = normalizeScoreValue(scores[key]);
  } else if (specShape) {
    for (const key of specScoreKeys) incoming[specScoreKeyMap[key]] = normalizeScoreValue(scores[key]);
  } else if (exactActiveShape) {
    for (const key of activeKeys) incoming[key] = normalizeScoreValue(scores[key]);
  } else {
    const sourceKeys = Object.keys(scores);
    if (sourceKeys.length === 0) {
      const error = new Error('scores_invalid_schema');
      error.statusCode = 400;
      throw error;
    }
    for (const key of sourceKeys) {
      const mapped = specScoreKeyMap[key] || key;
      if (!knownKeys.has(mapped) && !habitKeys.includes(mapped)) {
        const error = new Error(`unknown_habit_key:${mapped}`);
        error.statusCode = 400;
        throw error;
      }
      incoming[mapped] = normalizeScoreValue(scores[key]);
    }
  }

  const normalized = {};
  const targetKeys = activeKeys.length > 0 ? activeKeys : habitKeys;
  for (const key of targetKeys) {
    if (Object.hasOwn(incoming, key)) {
      normalized[key] = incoming[key];
    } else if (Object.hasOwn(existingScores, key)) {
      normalized[key] = toBinaryHabitScore(existingScores[key]);
    } else {
      normalized[key] = 0;
    }
  }
  for (const [key, value] of Object.entries(incoming)) {
    if (!Object.hasOwn(normalized, key) && knownKeys.has(key)) {
      normalized[key] = value;
    }
  }
  return normalized;
}


function taskMatchesDate(task, dateKey) {
  if (isDateKey(task?.businessDate)) return task.businessDate === dateKey;
  const dateSource = task.createdAt ?? task.updatedAt;
  if (!dateSource) return dateKey === todayKey();
  const parsed = new Date(dateSource);
  if (Number.isNaN(parsed.getTime())) return false;
  return toBusinessDateKey(parsed) === dateKey;
}

function addScoreAliases(score, habitCount = DEFAULT_HABITS.length) {
  if (!score) return null;
  const isGoodDay = score.total >= goodDayThresholdForCount(habitCount);
  return {
    ...score,
    isGoodDay,
    is_good_day: isGoodDay,
    created_at: score.createdAt,
    updated_at: score.updatedAt,
  };
}

function addStreakAliases(streak) {
  if (!streak) return streak;
  return {
    ...streak,
    current_streak: streak.current,
    longest_streak: streak.longest,
    last_score_date: streak.lastScoreDate,
    updated_at: streak.updatedAt,
  };
}

function buildTrendRange(url) {
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  if (from || to) {
    const startDate = requireDateKey(from, 'from');
    const endDate = requireDateKey(to, 'to');
    if (startDate > endDate) {
      const error = new Error('invalid_trend_range');
      error.statusCode = 400;
      throw error;
    }
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);
    const days = Math.floor((end - start) / 86400000) + 1;
    return { from: startDate, to: endDate, days, startDate, endDate };
  }

  const days = clampTrendDays(url.searchParams.get('days'));
  const endDate = requireDateKey(url.searchParams.get('endDate'), 'endDate');
  const start = new Date(`${endDate}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const startDate = start.toISOString().slice(0, 10);
  return { days, startDate, endDate, from: startDate, to: endDate };
}

function buildReviewTasks(tasks, dateKey) {
  return tasks.filter(task => taskMatchesDate(task, dateKey));
}

function normalizePomodoroSession(session = {}) {
  const now = new Date().toISOString();
  const completedAt = typeof session.completedAt === 'string' ? session.completedAt : now;
  const storedAt = typeof session.storedAt === 'string' ? session.storedAt : now;
  const idempotencyKey = typeof session.idempotencyKey === 'string' && session.idempotencyKey.trim() ? session.idempotencyKey.trim() : undefined;
  return {
    id: typeof session.id === 'string' && session.id ? session.id : randomUUID(),
    sessionId: typeof session.sessionId === 'string' && session.sessionId ? session.sessionId : null,
    taskId: typeof session.taskId === 'string' && session.taskId ? session.taskId : null,
    taskTitle: typeof session.taskTitle === 'string' && session.taskTitle ? session.taskTitle : null,
    durationMinutes: Number(session.durationMinutes || 0),
    completedAt,
    businessDate: resolveBusinessDate(session, completedAt || storedAt),
    source: typeof session.source === 'string' && session.source ? session.source : 'keshi-pomodoro',
    storedAt,
    idempotencyKey,
  };
}

async function readPomodoros(userKey) {
  const sessions = await readJson(userFile(userKey, 'pomodoros.json', legacySessionsFile), []);
  return Array.isArray(sessions) ? sessions.map(normalizePomodoroSession) : [];
}

async function writePomodoros(userKey, sessions) {
  const normalized = Array.isArray(sessions) ? sessions.map(normalizePomodoroSession) : [];
  await writeJson(userFile(userKey, 'pomodoros.json', legacySessionsFile), normalized);
  return normalized;
}

function pomodoroMatchesDate(session, dateKey) {
  if (isDateKey(session?.businessDate)) return session.businessDate === dateKey;
  const dateSource = session?.completedAt ?? session?.storedAt;
  return dateSource ? toBusinessDateKey(dateSource) === dateKey : false;
}

function normalizePomodoroEvent(event = {}) {
  const now = new Date().toISOString();
  const createdAt = typeof event.createdAt === 'string' ? event.createdAt : now;
  const idempotencyKey = typeof event.idempotencyKey === 'string' && event.idempotencyKey.trim() ? event.idempotencyKey.trim() : undefined;
  return {
    id: typeof event.id === 'string' && event.id ? event.id : randomUUID(),
    sessionId: typeof event.sessionId === 'string' && event.sessionId ? event.sessionId : randomUUID(),
    type: typeof event.type === 'string' && event.type ? event.type : 'unknown',
    mode: typeof event.mode === 'string' && event.mode ? event.mode : 'focus',
    taskId: typeof event.taskId === 'string' && event.taskId ? event.taskId : null,
    taskTitle: typeof event.taskTitle === 'string' && event.taskTitle ? event.taskTitle : null,
    plannedSeconds: Number(event.plannedSeconds || 0),
    elapsedSeconds: Number(event.elapsedSeconds || 0),
    remainingSeconds: Number(event.remainingSeconds || 0),
    createdAt,
    businessDate: resolveBusinessDate(event, createdAt),
    source: typeof event.source === 'string' && event.source ? event.source : 'keshi-pomodoro',
    idempotencyKey,
  };
}

async function readPomodoroEvents(userKey) {
  const events = await readJson(userFile(userKey, 'events.json', legacyEventsFile), []);
  return Array.isArray(events) ? events.map(normalizePomodoroEvent) : [];
}

async function writePomodoroEvents(userKey, events) {
  const normalized = Array.isArray(events) ? events.map(normalizePomodoroEvent) : [];
  await writeJson(userFile(userKey, 'events.json', legacyEventsFile), normalized);
  return normalized;
}

function eventMatchesDate(event, dateKey) {
  if (isDateKey(event?.businessDate)) return event.businessDate === dateKey;
  return event?.createdAt ? toBusinessDateKey(event.createdAt) === dateKey : false;
}

function resolveLogDate(body) {
  const date = body?.date ? requireDateKey(body.date, 'date') : null;
  const businessDate = body?.businessDate || body?.business_date
    ? requireDateKey(body.businessDate || body.business_date, 'businessDate')
    : null;
  if (date && businessDate && date !== businessDate) {
    const error = new Error('date_business_date_mismatch');
    error.statusCode = 400;
    throw error;
  }
  return date || businessDate || requireDateKey(null, 'date');
}

async function getDisciplineDb(userKey) {
  const safeKey = sanitizeUserKey(userKey);
  const dbFile = safeKey ? path.join(userDataDir(safeKey), 'discipline.sqlite') : legacyDisciplineDbFile;
  if (disciplineDbs.has(dbFile)) return disciplineDbs.get(dbFile);

  await mkdir(path.dirname(dbFile), { recursive: true });
  const disciplineDb = new DatabaseSync(dbFile);
  disciplineDbs.set(dbFile, disciplineDb);
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

    CREATE TABLE IF NOT EXISTS habit_definitions (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'target',
      color TEXT NOT NULL DEFAULT 'violet',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      system INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const readingColumns = new Set(disciplineDb.prepare('PRAGMA table_info(reading_log)').all().map(column => column.name));
  if (!readingColumns.has('idempotency_key')) {
    disciplineDb.exec('ALTER TABLE reading_log ADD COLUMN idempotency_key TEXT');
  }
  const exerciseColumns = new Set(disciplineDb.prepare('PRAGMA table_info(exercise_log)').all().map(column => column.name));
  if (!exerciseColumns.has('idempotency_key')) {
    disciplineDb.exec('ALTER TABLE exercise_log ADD COLUMN idempotency_key TEXT');
  }
  disciplineDb.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reading_log_idempotency_key
      ON reading_log(idempotency_key)
      WHERE idempotency_key IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_log_idempotency_key
      ON exercise_log(idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  `);

  return disciplineDb;
}

function parseScores(row, habits = DEFAULT_HABITS) {
  if (!row) return null;
  let raw = {};
  try {
    raw = JSON.parse(row.scores_json || '{}') || {};
  } catch {
    raw = {};
  }
  const keys = habits.length > 0 ? habits.map(habit => habit.key) : legacyScoreKeys;
  const scores = {};
  for (const key of keys) {
    try {
      scores[key] = toBinaryHabitScore(raw[key] ?? 0);
    } catch {
      scores[key] = 0;
    }
  }
  for (const [key, value] of Object.entries(raw)) {
    if (Object.hasOwn(scores, key)) continue;
    try {
      scores[key] = toBinaryHabitScore(value);
    } catch {
      // ignore invalid historical values
    }
  }
  const activeCount = habits.filter(habit => habit.active).length || keys.length;
  const stats = scoreStats(scores);
  return addScoreAliases({
    date: row.date,
    scores,
    notes: row.notes || '',
    total: stats.total,
    average: stats.average,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }, activeCount);
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
  const normalized = Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const nextKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    return [nextKey, value];
  }));
  return {
    ...normalized,
    businessDate: normalized.date,
  };
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

function emptyFocusActivity() {
  return {
    focusMinutes: 0,
    completedSessions: 0,
    firstStartedAt: null,
    hourlyMinutes: Array.from({ length: 24 }, () => 0),
    segments: [],
  };
}

function businessHour(value) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: businessTimeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  return Number(parts.find(part => part.type === 'hour')?.value ?? 0);
}

function addFocusSegment(activity, segment) {
  const start = new Date(segment.startedAt);
  const end = new Date(segment.endedAt);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) return;

  const minutes = (end.getTime() - start.getTime()) / 60000;
  activity.focusMinutes += minutes;
  activity.segments.push(segment);
  if (!activity.firstStartedAt || start < new Date(activity.firstStartedAt)) activity.firstStartedAt = segment.startedAt;

  for (let cursor = start.getTime(); cursor < end.getTime(); cursor += 60000) {
    const chunkEnd = Math.min(cursor + 60000, end.getTime());
    activity.hourlyMinutes[businessHour(cursor)] += (chunkEnd - cursor) / 60000;
  }
}

function buildFocusActivityByDate(range, sessions, events) {
  const activityByDate = new Map(datesBetween(range.startDate, range.endDate).map(date => [date, emptyFocusActivity()]));
  const sessionsByTimerId = new Map(sessions
    .filter(session => session.sessionId)
    .map(session => [session.sessionId, session]));
  const eventsBySession = new Map();

  for (const event of events) {
    if (event.mode !== 'focus' || !sessionsByTimerId.has(event.sessionId)) continue;
    const group = eventsBySession.get(event.sessionId) ?? [];
    group.push(event);
    eventsBySession.set(event.sessionId, group);
  }

  const matchedSessionIds = new Set();
  for (const [sessionId, sessionEvents] of eventsBySession) {
    const session = sessionsByTimerId.get(sessionId);
    const activity = activityByDate.get(session.businessDate);
    if (!activity) continue;
    const completed = sessionEvents.some(event => event.type === 'pomodoro_completed');
    if (!completed) continue;

    matchedSessionIds.add(session.id);
    const ordered = [...sessionEvents].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    let activeStart = null;
    let added = false;
    for (const event of ordered) {
      if (event.type === 'pomodoro_started' || event.type === 'pomodoro_resumed') {
        activeStart ??= event.createdAt;
        continue;
      }
      if (!activeStart || !['pomodoro_paused', 'pomodoro_cancelled', 'pomodoro_completed'].includes(event.type)) continue;
      addFocusSegment(activity, {
        sessionId,
        startedAt: activeStart,
        endedAt: event.createdAt,
        durationMinutes: (new Date(event.createdAt).getTime() - new Date(activeStart).getTime()) / 60000,
        taskTitle: session.taskTitle,
        source: 'event',
      });
      added = true;
      activeStart = null;
    }
    if (!added) matchedSessionIds.delete(session.id);
  }

  for (const session of sessions) {
    if (matchedSessionIds.has(session.id)) continue;
    const activity = activityByDate.get(session.businessDate);
    const endedAt = new Date(session.completedAt);
    const durationMinutes = Math.max(0, Number(session.durationMinutes || 0));
    if (!activity || !Number.isFinite(endedAt.getTime()) || durationMinutes <= 0) continue;
    const startedAt = new Date(endedAt.getTime() - durationMinutes * 60000);
    addFocusSegment(activity, {
      sessionId: session.sessionId ?? session.id,
      startedAt: startedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      durationMinutes,
      taskTitle: session.taskTitle,
      source: 'inferred',
    });
  }

  for (const activity of activityByDate.values()) {
    activity.focusMinutes = Math.round(activity.focusMinutes);
    activity.hourlyMinutes = activity.hourlyMinutes.map(minutes => Math.round(minutes));
    activity.completedSessions = new Set(activity.segments.map(segment => segment.sessionId)).size;
  }
  return activityByDate;
}

async function recomputeStreak(userKey) {
  const db = await getDisciplineDb(userKey);
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
    businessDate: resolveBusinessDate(task, task.createdAt || task.updatedAt || now),
    idempotencyKey: typeof task.idempotencyKey === 'string' && task.idempotencyKey.trim() ? task.idempotencyKey.trim() : undefined,
    subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
  };
}

function stripLegacyDefaultTasks(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.filter(task => task?.id !== legacyDefaultTaskId);
}

function normalizeTasks(tasks) {
  const total = tasks.length;
  return tasks
    .map((task, index) => normalizeTask(task, total - index))
    .sort((a, b) => (b.order || 0) - (a.order || 0));
}

async function readTasks(userKey) {
  const taskFile = userFile(userKey, 'tasks.json', legacyTasksFile);
  const rawTasks = await readJson(taskFile, []);
  const cleanedTasks = normalizeTasks(stripLegacyDefaultTasks(rawTasks));
  if (Array.isArray(rawTasks) && rawTasks.length !== cleanedTasks.length) {
    await writeJson(taskFile, cleanedTasks);
  }
  return cleanedTasks;
}

async function readTaskSnapshots(userKey) {
  const snapshots = await readJson(userFile(userKey, 'task-snapshots.json', legacyTaskSnapshotsFile), {});
  return snapshots && typeof snapshots === 'object' && !Array.isArray(snapshots) ? snapshots : {};
}

async function writeTaskSnapshots(userKey, snapshots) {
  await writeJson(userFile(userKey, 'task-snapshots.json', legacyTaskSnapshotsFile), snapshots);
  return snapshots;
}

function normalizeTaskSnapshot(date, value = {}) {
  const now = new Date().toISOString();
  const tasks = Array.isArray(value.tasks) ? normalizeTasks(value.tasks).map(task => ({
    ...task,
    businessDate: date,
  })) : [];
  return {
    date,
    tasks,
    source: typeof value.source === 'string' && value.source.trim() ? value.source.trim() : 'pomodoro-api',
    generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : now,
    idempotencyKey: typeof value.idempotencyKey === 'string' && value.idempotencyKey.trim() ? value.idempotencyKey.trim() : undefined,
  };
}

async function readCronRuns(userKey) {
  const runs = await readJson(userFile(userKey, 'cron-runs.json', legacyCronRunsFile), []);
  return Array.isArray(runs) ? runs.map(normalizeCronRun) : [];
}

async function writeCronRuns(userKey, runs) {
  const normalized = Array.isArray(runs) ? runs.map(normalizeCronRun) : [];
  await writeJson(userFile(userKey, 'cron-runs.json', legacyCronRunsFile), normalized);
  return normalized;
}

function normalizeCronRun(run = {}) {
  const now = new Date().toISOString();
  const allowedStatuses = new Set(['running', 'success', 'failed', 'partial']);
  const status = allowedStatuses.has(run.status) ? run.status : 'running';
  const startedAt = typeof run.startedAt === 'string' ? run.startedAt : now;
  const businessDate = resolveBusinessDate(run, startedAt);
  const idempotencyKey = typeof run.idempotencyKey === 'string' && run.idempotencyKey.trim() ? run.idempotencyKey.trim() : undefined;
  return {
    id: typeof run.id === 'string' && run.id ? run.id : randomUUID(),
    job: typeof run.job === 'string' && run.job.trim() ? run.job.trim() : 'unknown',
    status,
    businessDate,
    startedAt,
    finishedAt: typeof run.finishedAt === 'string' ? run.finishedAt : null,
    summary: typeof run.summary === 'string' ? run.summary : '',
    source: typeof run.source === 'string' && run.source.trim() ? run.source.trim() : 'sebastian',
    idempotencyKey,
    updatedAt: now,
  };
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

  const authContext = await requestAuthContext(req);
  if (!authContext.authenticated) {
    sendJson(res, 401, { error: 'auth_required' });
    return;
  }
  const userKey = authContext.userKey;

  if (pathname === '/api/settings' && req.method === 'GET') {
    sendJson(res, 200, { settings: await readAppSettings(userKey) });
    return;
  }

  if (pathname === '/api/settings' && (req.method === 'PATCH' || req.method === 'PUT')) {
    const body = await readBody(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      sendJson(res, 400, { error: 'settings_required' });
      return;
    }

    const current = await readAppSettings(userKey);
    const nextSettings = await writeAppSettings(userKey, mergeAppSettings(current, body));
    sendJson(res, 200, { settings: nextSettings });
    return;
  }

  if (pathname === '/api/history' && req.method === 'GET') {
    sendJson(res, 200, { history: await readHistory(userKey) });
    return;
  }

  if (pathname === '/api/history' && req.method === 'POST') {
    const body = await readBody(req);
    const idempotencyKey = getIdempotencyKey(req, body);
    const entry = normalizeHistoryItem({ ...body, idempotencyKey: idempotencyKey ?? body?.idempotencyKey });
    if (!entry.duration || entry.duration < 0) {
      sendJson(res, 400, { error: 'duration_required' });
      return;
    }

    const history = await readHistory(userKey);
    const existing = findIdempotentRecord(history, entry.idempotencyKey, entry.id);
    if (existing) {
      sendJson(res, 200, { history, item: existing, idempotent: true });
      return;
    }
    const nextHistory = [entry, ...history];
    await writeHistory(userKey, nextHistory);
    sendJson(res, 201, { history: nextHistory, item: entry });
    return;
  }

  if (pathname === '/api/history' && req.method === 'DELETE') {
    await writeHistory(userKey, []);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/tasks' && req.method === 'GET') {
    const tasks = await readTasks(userKey);
    sendJson(res, 200, { tasks });
    return;
  }

  if (pathname === '/api/tasks' && req.method === 'POST') {
    const body = await readBody(req);
    const idempotencyKey = getIdempotencyKey(req, body);
    if (!body?.title || typeof body.title !== 'string') {
      sendJson(res, 400, { error: 'title_required' });
      return;
    }

    const tasks = await readTasks(userKey);
    const existing = findIdempotentRecord(tasks, idempotencyKey, body?.id);
    if (existing) {
      sendJson(res, 200, { task: existing, idempotent: true });
      return;
    }
    const nextOrder = tasks.length > 0 ? Math.max(...tasks.map(task => task.order || 0)) + 1 : 1;
    const task = normalizeTask({
      id: body.id || randomUUID(),
      title: body.title.trim(),
      status: body.status || 'doing',
      sprint: body.sprint || 'Today',
      order: body.order ?? nextOrder,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      businessDate: resolveBusinessDate(body, body.createdAt || new Date()),
      idempotencyKey: idempotencyKey ?? undefined,
      subtasks: Array.isArray(body.subtasks) ? body.subtasks : [],
    });
    await writeJson(userFile(userKey, 'tasks.json', legacyTasksFile), normalizeTasks([task, ...tasks]));
    sendJson(res, 201, { task });
    return;
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch && req.method === 'PUT') {
    const taskId = decodeURIComponent(taskMatch[1]);
    const body = await readBody(req);
    const tasks = await readTasks(userKey);
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
    await writeJson(userFile(userKey, 'tasks.json', legacyTasksFile), tasks);
    sendJson(res, 200, { task });
    return;
  }

  if (taskMatch && req.method === 'DELETE') {
    const taskId = decodeURIComponent(taskMatch[1]);
    const tasks = await readTasks(userKey);
    const nextTasks = tasks.filter(task => task.id !== taskId);

    if (nextTasks.length === tasks.length) {
      sendJson(res, 404, { error: 'task_not_found' });
      return;
    }

    await writeJson(userFile(userKey, 'tasks.json', legacyTasksFile), nextTasks);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (pathname === '/api/task-snapshots' && req.method === 'GET') {
    const date = requireDateKey(url.searchParams.get('date'));
    const snapshots = await readTaskSnapshots(userKey);
    const snapshot = snapshots[date] ? normalizeTaskSnapshot(date, snapshots[date]) : null;
    sendJson(res, 200, { date, snapshot });
    return;
  }

  if (pathname === '/api/task-snapshots' && (req.method === 'PUT' || req.method === 'POST')) {
    const date = requireDateKey(url.searchParams.get('date'));
    const body = await readBody(req);
    const idempotencyKey = getIdempotencyKey(req, body);
    const snapshots = await readTaskSnapshots(userKey);
    const current = snapshots[date] ? normalizeTaskSnapshot(date, snapshots[date]) : null;
    if (current && idempotencyKey && current.idempotencyKey === idempotencyKey) {
      sendJson(res, 200, { date, snapshot: current, idempotent: true });
      return;
    }
    const snapshot = normalizeTaskSnapshot(date, {
      tasks: Array.isArray(body?.tasks) ? body.tasks : buildReviewTasks(await readTasks(userKey), date),
      source: body?.source,
      idempotencyKey: idempotencyKey ?? body?.idempotencyKey,
    });
    snapshots[date] = snapshot;
    await writeTaskSnapshots(userKey, snapshots);
    sendJson(res, current ? 200 : 201, { date, snapshot });
    return;
  }

  if (pathname === '/api/cron-runs' && req.method === 'GET') {
    const date = url.searchParams.has('date') ? requireDateKey(url.searchParams.get('date')) : null;
    const runs = await readCronRuns(userKey);
    const filteredRuns = date ? runs.filter(run => run.businessDate === date) : runs;
    sendJson(res, 200, { runs: filteredRuns });
    return;
  }

  if (pathname === '/api/cron-runs' && req.method === 'POST') {
    const body = await readBody(req);
    const idempotencyKey = getIdempotencyKey(req, body);
    const runs = await readCronRuns(userKey);
    const existing = findIdempotentRecord(runs, idempotencyKey, body?.id);
    const run = normalizeCronRun({ ...body, idempotencyKey: idempotencyKey ?? body?.idempotencyKey });
    if (existing) {
      sendJson(res, 200, { run: existing, idempotent: true });
      return;
    }
    const nextRuns = [run, ...runs].slice(0, 500);
    await writeCronRuns(userKey, nextRuns);
    sendJson(res, 201, { run });
    return;
  }

  if (pathname === '/api/pomodoros' && req.method === 'GET') {
    const sessions = await readPomodoros(userKey);
    sendJson(res, 200, { pomodoros: sessions });
    return;
  }

  if (pathname === '/api/pomodoros' && req.method === 'POST') {
    const body = await readBody(req);
    const idempotencyKey = getIdempotencyKey(req, body);
    const session = normalizePomodoroSession({
      ...body,
      storedAt: new Date().toISOString(),
      idempotencyKey: idempotencyKey ?? body?.idempotencyKey,
    });

    if (!session.durationMinutes || session.durationMinutes < 0) {
      sendJson(res, 400, { error: 'duration_required' });
      return;
    }

    const sessions = await readPomodoros(userKey);
    const existing = findIdempotentRecord(sessions, session.idempotencyKey, session.id);
    if (existing) {
      sendJson(res, 200, { pomodoro: existing, idempotent: true });
      return;
    }
    await writePomodoros(userKey, [session, ...sessions]);
    sendJson(res, 201, { pomodoro: session });
    return;
  }

  if (pathname === '/api/events' && req.method === 'GET') {
    const date = url.searchParams.has('date') ? requireDateKey(url.searchParams.get('date')) : null;
    const events = await readPomodoroEvents(userKey);
    const filteredEvents = date ? events.filter(event => eventMatchesDate(event, date)) : events;
    sendJson(res, 200, { events: filteredEvents });
    return;
  }

  if (pathname === '/api/events' && req.method === 'POST') {
    const body = await readBody(req);
    const idempotencyKey = getIdempotencyKey(req, body);
    if (!body?.type || typeof body.type !== 'string') {
      sendJson(res, 400, { error: 'type_required' });
      return;
    }

    const event = normalizePomodoroEvent({
      ...body,
      idempotencyKey: idempotencyKey ?? body?.idempotencyKey,
    });

    const events = await readPomodoroEvents(userKey);
    const existing = findIdempotentRecord(events, event.idempotencyKey, event.id);
    if (existing) {
      sendJson(res, 200, { event: existing, idempotent: true });
      return;
    }
    await writePomodoroEvents(userKey, [event, ...events]);
    sendJson(res, 201, { event });
    return;
  }

  if (pathname === '/api/discipline/scores' && req.method === 'POST') {
    const body = await readBody(req);
    const date = requireDateKey(body?.date);
    const habits = await listHabitDefinitions(userKey, { includeInactive: true });
    const db = await getDisciplineDb(userKey);
    const existingRow = db.prepare('SELECT * FROM daily_scores WHERE date = ?').get(date);
    const existingParsed = parseScores(existingRow, habits);
    const scores = validateScoresPayload(body?.scores, habits, existingParsed?.scores || {});

    const stats = scoreStats(scores);
    const now = new Date().toISOString();
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
    const streak = await recomputeStreak(userKey);
    sendJson(res, 200, { score: parseScores(row, habits), streak, habits });
    return;
  }

  if (pathname === '/api/discipline/scores' && req.method === 'GET') {
    const date = requireDateKey(url.searchParams.get('date'));
    const habits = await listHabitDefinitions(userKey, { includeInactive: true });
    const db = await getDisciplineDb(userKey);
    const score = parseScores(db.prepare('SELECT * FROM daily_scores WHERE date = ?').get(date), habits);
    if (!score) {
      sendJson(res, 404, { error: 'score_not_found' });
      return;
    }
    sendJson(res, 200, { score, habits });
    return;
  }

  if (pathname === '/api/discipline/scores/trend' && req.method === 'GET') {
    const range = buildTrendRange(url);
    const habits = await listHabitDefinitions(userKey, { includeInactive: true });
    const db = await getDisciplineDb(userKey);
    const rows = db.prepare('SELECT * FROM daily_scores WHERE date BETWEEN ? AND ? ORDER BY date ASC').all(range.startDate, range.endDate);
    const byDate = new Map(rows.map(row => [row.date, parseScores(row, habits)]));
    const focusActivityByDate = buildFocusActivityByDate(
      range,
      await readPomodoros(userKey),
      await readPomodoroEvents(userKey),
    );
    const trend = datesBetween(range.startDate, range.endDate).map(date => ({
      ...(byDate.get(date) || {
        date,
        scores: null,
        notes: '',
        total: 0,
        average: 0,
        createdAt: null,
        updatedAt: null,
      }),
      activity: focusActivityByDate.get(date) ?? emptyFocusActivity(),
    }));
    sendJson(res, 200, {
      days: range.days,
      from: range.from,
      to: range.to,
      startDate: range.startDate,
      endDate: range.endDate,
      habits,
      trend,
    });
    return;
  }

  if (pathname === '/api/discipline/streak' && req.method === 'GET') {
    const streak = addStreakAliases(await recomputeStreak(userKey));
    sendJson(res, 200, { streak });
    return;
  }

  if (pathname === '/api/discipline/reading' && req.method === 'POST') {
    const body = await readBody(req);
    const date = resolveLogDate(body);
    const idempotencyKey = getIdempotencyKey(req, body);
    const now = new Date().toISOString();
    const entry = {
      id: body?.id || randomUUID(),
      date,
      businessDate: date,
      title: body?.title || '',
      pages: Math.max(0, Number(body?.pages || 0)),
      minutes: Math.max(0, Number(body?.minutes || 0)),
      notes: body?.notes || '',
      createdAt: now,
      idempotencyKey: idempotencyKey ?? undefined,
    };
    const db = await getDisciplineDb(userKey);
    const existing = entry.idempotencyKey
      ? db.prepare('SELECT * FROM reading_log WHERE idempotency_key = ?').get(entry.idempotencyKey)
      : db.prepare('SELECT * FROM reading_log WHERE id = ?').get(entry.id);
    if (existing) {
      sendJson(res, 200, { reading: normalizeLogRow(existing), idempotent: true });
      return;
    }
    db.prepare(`
      INSERT INTO reading_log (id, date, title, pages, minutes, notes, created_at, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(entry.id, entry.date, entry.title, entry.pages, entry.minutes, entry.notes, entry.createdAt, entry.idempotencyKey || null);
    sendJson(res, 201, { reading: entry });
    return;
  }

  if (pathname === '/api/discipline/reading' && req.method === 'GET') {
    const date = requireDateKey(url.searchParams.get('date'));
    const db = await getDisciplineDb(userKey);
    const reading = db.prepare('SELECT * FROM reading_log WHERE date = ? ORDER BY created_at DESC').all(date).map(normalizeLogRow);
    sendJson(res, 200, { date, reading });
    return;
  }

  if (pathname === '/api/discipline/exercise' && req.method === 'POST') {
    const body = await readBody(req);
    const date = resolveLogDate(body);
    const idempotencyKey = getIdempotencyKey(req, body);
    const now = new Date().toISOString();
    const entry = {
      id: body?.id || randomUUID(),
      date,
      businessDate: date,
      type: body?.type || '',
      durationMinutes: Math.max(0, Number(body?.durationMinutes || body?.minutes || 0)),
      intensity: body?.intensity || '',
      notes: body?.notes || '',
      createdAt: now,
      idempotencyKey: idempotencyKey ?? undefined,
    };
    const db = await getDisciplineDb(userKey);
    const existing = entry.idempotencyKey
      ? db.prepare('SELECT * FROM exercise_log WHERE idempotency_key = ?').get(entry.idempotencyKey)
      : db.prepare('SELECT * FROM exercise_log WHERE id = ?').get(entry.id);
    if (existing) {
      sendJson(res, 200, { exercise: normalizeLogRow(existing), idempotent: true });
      return;
    }
    db.prepare(`
      INSERT INTO exercise_log (id, date, type, duration_minutes, intensity, notes, created_at, idempotency_key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(entry.id, entry.date, entry.type, entry.durationMinutes, entry.intensity, entry.notes, entry.createdAt, entry.idempotencyKey || null);
    sendJson(res, 201, { exercise: entry });
    return;
  }

  if (pathname === '/api/discipline/exercise' && req.method === 'GET') {
    const date = requireDateKey(url.searchParams.get('date'));
    const db = await getDisciplineDb(userKey);
    const exercise = db.prepare('SELECT * FROM exercise_log WHERE date = ? ORDER BY created_at DESC').all(date).map(normalizeLogRow);
    sendJson(res, 200, { date, exercise });
    return;
  }

  if (pathname === '/api/discipline/review' && req.method === 'GET') {
    const date = requireDateKey(url.searchParams.get('date'));
    const habits = await listHabitDefinitions(userKey, { includeInactive: true });
    const db = await getDisciplineDb(userKey);
    const score = parseScores(db.prepare('SELECT * FROM daily_scores WHERE date = ?').get(date), habits);
    const streak = addStreakAliases(await recomputeStreak(userKey));
    const reading = db.prepare('SELECT * FROM reading_log WHERE date = ? ORDER BY created_at DESC').all(date).map(normalizeLogRow);
    const exercise = db.prepare('SELECT * FROM exercise_log WHERE date = ? ORDER BY created_at DESC').all(date).map(normalizeLogRow);
    const pomodoros = (await readPomodoros(userKey)).filter(session => pomodoroMatchesDate(session, date));
    const events = (await readPomodoroEvents(userKey)).filter(event => eventMatchesDate(event, date));
    const snapshots = await readTaskSnapshots(userKey);
    const taskSnapshot = snapshots[date] ? normalizeTaskSnapshot(date, snapshots[date]) : null;
    const tasks = taskSnapshot ? taskSnapshot.tasks : buildReviewTasks(await readTasks(userKey), date);

    sendJson(res, 200, {
      date,
      score,
      streak,
      habits,
      reading,
      exercise,
      tasks,
      taskSnapshot,
      taskSnapshotSource: taskSnapshot?.source || 'live-tasks',
      taskSnapshotGeneratedAt: taskSnapshot?.generatedAt || null,
      pomodoros,
      events,
      generatedAt: new Date().toISOString(),
    });
    return;
  }

  if (pathname === '/api/discipline/habits' && req.method === 'GET') {
    const includeInactive = url.searchParams.get('includeInactive') !== '0';
    const habits = await listHabitDefinitions(userKey, { includeInactive });
    sendJson(res, 200, {
      habits,
      activeCount: habits.filter(habit => habit.active).length,
      colors: HABIT_COLOR_KEYS,
      icons: HABIT_ICON_KEYS,
    });
    return;
  }

  if (pathname === '/api/discipline/habits' && req.method === 'POST') {
    const body = await readBody(req);
    const habit = await createHabitDefinition(userKey, body || {});
    const habits = await listHabitDefinitions(userKey, { includeInactive: true });
    sendJson(res, 201, { habit, habits });
    return;
  }

  if (pathname.startsWith('/api/discipline/habits/') && (req.method === 'PUT' || req.method === 'PATCH')) {
    const key = decodeURIComponent(pathname.slice('/api/discipline/habits/'.length));
    if (!key || key.includes('/')) {
      sendNotFound(res);
      return;
    }
    const body = await readBody(req);
    const habit = await updateHabitDefinition(userKey, key, body || {});
    const habits = await listHabitDefinitions(userKey, { includeInactive: true });
    sendJson(res, 200, { habit, habits });
    return;
  }

  if (pathname.startsWith('/api/discipline/habits/') && req.method === 'DELETE') {
    const key = decodeURIComponent(pathname.slice('/api/discipline/habits/'.length));
    if (!key || key.includes('/')) {
      sendNotFound(res);
      return;
    }
    const result = await deleteHabitDefinition(userKey, key);
    const habits = await listHabitDefinitions(userKey, { includeInactive: true });
    sendJson(res, 200, { ...result, habits });
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
    const statusCode = error.statusCode || 500;
    if (statusCode >= 500) {
      console.error(error);
    } else {
      console.warn(`[api:${statusCode}] ${error.message || 'bad_request'}`);
    }
    const errorBody = statusCode >= 500
      ? { error: 'internal_error' }
      : { error: error.message || 'bad_request' };
    sendJson(res, statusCode, errorBody);
  }
});

server.listen(port, host, () => {
  console.log(`Keshi Pomodoro listening on http://${host}:${port}`);
});
