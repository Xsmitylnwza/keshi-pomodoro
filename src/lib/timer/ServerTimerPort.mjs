const CLIENT_ID_KEY = 'keshi.timerClientId.v1';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createServerTimerPort({
  baseUrl = '/api',
  fetchFn = (...args) => fetch(...args),
  storage = typeof window !== 'undefined' ? window.localStorage : null,
  randomUUID = () => crypto.randomUUID(),
  now = () => new Date(),
  ownerKind = typeof window !== 'undefined' && window.keshiDesktop ? 'desktop' : 'web',
} = {}) {
  const clientId = loadClientId(storage, randomUUID);
  const timerBase = `${String(baseUrl).replace(/\/$/, '')}/timer`;

  async function runtime() {
    const response = await fetchFn(`${timerBase}/runtime`, {
      credentials: 'include',
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await safeJson(response);
    if (!response.ok) throw timerError(payload?.error || 'timer_runtime_failed', response.status, payload);
    return validateRuntime(payload, { includeStartEnabled: true });
  }

  async function send(type, input) {
    const command = {
      commandId: input.commandId || randomUUID(),
      type,
      runId: type === 'start' ? input.runId || randomUUID() : input.runId,
      expectedRevision: input.expectedRevision,
      occurredAt: now().toISOString(),
      payload: type === 'start'
        ? {
            clientId,
            ownerKind,
            mode: input.mode,
            taskId: input.taskId || null,
            taskTitle: input.taskTitle || null,
            plannedSeconds: input.plannedSeconds,
          }
        : { clientId },
    };
    const response = await fetchFn(`${timerBase}/commands`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(command),
    });
    const payload = await safeJson(response);
    if (!response.ok) {
      throw timerError(payload?.error || 'timer_command_failed', response.status, payload);
    }
    return {
      ...payload,
      runtime: validateRuntime(payload?.runtime),
    };
  }

  return Object.freeze({
    kind: 'server',
    clientId,
    runtime,
    start: input => send('start', input),
    pause: input => send('pause', input),
    resume: input => send('resume', input),
    cancel: input => send('cancel', input),
    complete: input => send('complete', input),
  });
}

export function validateRuntime(value, { includeStartEnabled = false } = {}) {
  if (!value || typeof value !== 'object'
    || value.schemaVersion !== 1
    || !Number.isInteger(value.revision)
    || value.revision < 0) {
    throw timerError('timer_runtime_invalid');
  }
  const active = value.active === null ? null : validateActive(value.active);
  const runtime = { schemaVersion: 1, revision: value.revision, active };
  if (includeStartEnabled) runtime.startEnabled = value.startEnabled === true;
  return runtime;
}

function validateActive(value) {
  if (!value || typeof value !== 'object'
    || !validUuid(value.runId)
    || !validUuid(value.ownerClientId)
    || !['web', 'desktop'].includes(value.ownerKind)
    || !['focus', 'break'].includes(value.mode)
    || !['running', 'paused'].includes(value.status)
    || !Number.isInteger(value.plannedSeconds)
    || !Number.isInteger(value.remainingSeconds)
    || typeof value.startedAt !== 'string') {
    throw timerError('timer_runtime_invalid');
  }
  return {
    runId: value.runId,
    ownerClientId: value.ownerClientId,
    ownerKind: value.ownerKind,
    mode: value.mode,
    taskId: typeof value.taskId === 'string' ? value.taskId : null,
    taskTitle: typeof value.taskTitle === 'string' ? value.taskTitle : null,
    plannedSeconds: value.plannedSeconds,
    remainingSeconds: value.remainingSeconds,
    status: value.status,
    startedAt: value.startedAt,
    endAt: typeof value.endAt === 'string' ? value.endAt : null,
    pausedAt: typeof value.pausedAt === 'string' ? value.pausedAt : null,
    businessTimeZone: value.businessTimeZone,
  };
}

function loadClientId(storage, randomUUID) {
  try {
    const existing = storage?.getItem(CLIENT_ID_KEY);
    if (validUuid(existing)) return existing;
    const next = randomUUID();
    if (!validUuid(next)) throw timerError('timer_client_id_invalid');
    storage?.setItem(CLIENT_ID_KEY, next);
    return next;
  } catch (error) {
    if (error?.code === 'timer_client_id_invalid') throw error;
    const fallback = randomUUID();
    if (!validUuid(fallback)) throw timerError('timer_client_id_invalid');
    return fallback;
  }
}

function validUuid(value) {
  return UUID_RE.test(String(value || ''));
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function timerError(code, status = 0, payload = null) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  error.runtime = payload?.runtime || null;
  return error;
}

export const serverTimerPort = createServerTimerPort();
