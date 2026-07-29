const SCHEMA_VERSION = 1;
const MAX_RECENT_COMMANDS = 100;
const MAX_TASK_TITLE_CODE_POINTS = 300;
const MIN_DURATION_SECONDS = 60;
const MAX_DURATION_SECONDS = 14_400;
const OCCURRED_AT_SKEW_MS = 5 * 60 * 1000;
const COMPLETE_EARLY_SKEW_MS = 2_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMAND_TYPES = new Set(['start', 'pause', 'resume', 'cancel', 'complete']);

export function createTimerRuntimeService({
  readRuntime,
  writeRuntime,
  readEvents,
  writeEvents,
  readHistory,
  writeHistory,
  readPomodoros,
  writePomodoros,
  isStartEnabled,
  toBusinessDateKey,
  businessTimeZone = 'Asia/Bangkok',
  now = () => new Date(),
} = {}) {
  const requiredFunctions = {
    readRuntime,
    writeRuntime,
    readEvents,
    writeEvents,
    readHistory,
    writeHistory,
    readPomodoros,
    writePomodoros,
    isStartEnabled,
    toBusinessDateKey,
  };
  for (const [name, value] of Object.entries(requiredFunctions)) {
    if (typeof value !== 'function') throw new Error(`timer runtime requires ${name}`);
  }

  async function runtime(userKey) {
    return safeRuntime(await loadRuntime(userKey), now());
  }

  async function command(userKey, ownerUserId, input) {
    const receivedAt = now();
    const parsed = validateCommand(input, receivedAt);
    if (!parsed.ok) return response(parsed.status, { error: parsed.error });

    const current = await loadRuntime(userKey);
    const receipt = current.recentCommands.find(item => item.commandId === parsed.command.commandId);
    if (receipt) {
      const duplicateBody = {
        status: 'ok',
        idempotent: true,
        resultRevision: receipt.resultRevision,
        runtime: safeRuntime(current, receivedAt),
      };
      if (parsed.command.type === 'complete') {
        const historyKey = `desktop:timer:${parsed.command.runId}:history`;
        const pomodoroKey = `desktop:timer:${parsed.command.runId}:pomodoro`;
        const history = (await readHistory(userKey)).find(item => item.idempotencyKey === historyKey);
        const pomodoro = (await readPomodoros(userKey)).find(item => item.idempotencyKey === pomodoroKey) || null;
        if (history) {
          duplicateBody.completion = {
            runId: parsed.command.runId,
            mode: history.mode,
            completedAt: pomodoro?.completedAt || history.syncedAt,
            businessDate: history.businessDate,
            history,
            pomodoro,
          };
        }
      }
      return response(200, {
        ...duplicateBody,
      });
    }

    if (parsed.command.expectedRevision !== current.revision) {
      return conflict('timer_revision_conflict', current, receivedAt);
    }

    if (parsed.command.type === 'start') {
      return startTimer({ userKey, ownerUserId, command: parsed.command, current, receivedAt });
    }
    return transitionTimer({ userKey, command: parsed.command, current, receivedAt });
  }

  async function startTimer({ userKey, ownerUserId, command: input, current, receivedAt }) {
    if (!isStartEnabled(userKey)) {
      return response(409, {
        error: 'server_timer_disabled',
        runtime: safeRuntime(current, receivedAt),
      });
    }
    if (current.active) return conflict('timer_already_active', current, receivedAt);

    const start = validateStartPayload(input.payload);
    if (!start.ok) return response(400, { error: start.error });
    const startedAt = receivedAt.toISOString();
    const active = {
      runId: input.runId,
      ownerClientId: start.value.clientId,
      ownerKind: start.value.ownerKind,
      ownerUserId: String(ownerUserId || userKey),
      mode: start.value.mode,
      taskId: start.value.taskId,
      taskTitle: start.value.taskTitle,
      plannedSeconds: start.value.plannedSeconds,
      remainingSeconds: start.value.plannedSeconds,
      status: 'running',
      startedAt,
      endAt: new Date(receivedAt.getTime() + start.value.plannedSeconds * 1000).toISOString(),
      pausedAt: null,
      businessTimeZone,
    };
    const next = nextRuntime(current, active, input.commandId, receivedAt);

    await upsertEvent(userKey, eventForTransition(active, 'start', input.commandId, receivedAt));
    await writeRuntime(userKey, next);
    return success(next, receivedAt);
  }

  async function transitionTimer({ userKey, command: input, current, receivedAt }) {
    const active = current.active;
    if (!active || active.runId !== input.runId) {
      return conflict('timer_run_not_active', current, receivedAt);
    }
    const clientId = validUuid(input.payload?.clientId);
    if (!clientId) return response(400, { error: 'timer_client_id_invalid' });
    if (clientId !== active.ownerClientId) {
      return conflict('timer_owned_by_other_client', current, receivedAt);
    }

    if (input.type === 'pause') {
      if (active.status !== 'running') return conflict('timer_invalid_transition', current, receivedAt);
      const remainingSeconds = runningRemaining(active, receivedAt);
      const nextActive = {
        ...active,
        status: 'paused',
        remainingSeconds,
        endAt: null,
        pausedAt: receivedAt.toISOString(),
      };
      const next = nextRuntime(current, nextActive, input.commandId, receivedAt);
      await upsertEvent(userKey, eventForTransition(nextActive, 'pause', input.commandId, receivedAt));
      await writeRuntime(userKey, next);
      return success(next, receivedAt);
    }

    if (input.type === 'resume') {
      if (active.status !== 'paused') return conflict('timer_invalid_transition', current, receivedAt);
      const nextActive = {
        ...active,
        status: 'running',
        endAt: new Date(receivedAt.getTime() + active.remainingSeconds * 1000).toISOString(),
        pausedAt: null,
      };
      const next = nextRuntime(current, nextActive, input.commandId, receivedAt);
      await upsertEvent(userKey, eventForTransition(nextActive, 'resume', input.commandId, receivedAt));
      await writeRuntime(userKey, next);
      return success(next, receivedAt);
    }

    if (input.type === 'cancel') {
      if (!['running', 'paused'].includes(active.status)) {
        return conflict('timer_invalid_transition', current, receivedAt);
      }
      const finalActive = active.status === 'running'
        ? { ...active, remainingSeconds: runningRemaining(active, receivedAt) }
        : active;
      const next = nextRuntime(current, null, input.commandId, receivedAt);
      await upsertEvent(userKey, eventForTransition(finalActive, 'cancel', input.commandId, receivedAt));
      await writeRuntime(userKey, next);
      return success(next, receivedAt);
    }

    if (input.type === 'complete') {
      if (active.status !== 'running') return conflict('timer_invalid_transition', current, receivedAt);
      const endAtMs = Date.parse(active.endAt);
      if (!Number.isFinite(endAtMs) || receivedAt.getTime() + COMPLETE_EARLY_SKEW_MS < endAtMs) {
        return conflict('timer_complete_too_early', current, receivedAt);
      }
      return completeTimer({ userKey, input, current, active, receivedAt });
    }

    return response(400, { error: 'timer_command_type_invalid' });
  }

  async function completeTimer({ userKey, input, current, active, receivedAt }) {
    const completedAt = receivedAt.toISOString();
    const businessDate = toBusinessDateKey(receivedAt);
    const eventKey = `desktop:timer:${active.runId}:completed-event`;
    const historyKey = `desktop:timer:${active.runId}:history`;
    const pomodoroKey = `desktop:timer:${active.runId}:pomodoro`;

    await upsertEvent(userKey, {
      ...eventForTransition({ ...active, remainingSeconds: 0 }, 'complete', input.commandId, receivedAt),
      businessDate,
      idempotencyKey: eventKey,
    });

    const historyItem = {
      id: active.runId,
      mode: active.mode,
      duration: Math.max(1, Math.round(active.plannedSeconds / 60)),
      date: formatHistoryDate(receivedAt, businessTimeZone),
      businessDate,
      taskId: active.taskId || undefined,
      taskTitle: active.taskTitle || undefined,
      syncedAt: completedAt,
      idempotencyKey: historyKey,
    };
    await upsertHistory(userKey, historyItem);

    let pomodoro = null;
    if (active.mode === 'focus') {
      pomodoro = {
        id: active.runId,
        sessionId: active.runId,
        taskId: active.taskId,
        taskTitle: active.taskTitle,
        durationMinutes: active.plannedSeconds / 60,
        completedAt,
        businessDate,
        source: active.ownerKind === 'desktop' ? 'keshi-desktop' : 'keshi-pomodoro',
        storedAt: completedAt,
        idempotencyKey: pomodoroKey,
      };
      await upsertPomodoro(userKey, pomodoro);
    }

    const next = nextRuntime(current, null, input.commandId, receivedAt);
    await writeRuntime(userKey, next);
    return response(200, {
      status: 'ok',
      idempotent: false,
      resultRevision: next.revision,
      runtime: safeRuntime(next, receivedAt),
      completion: {
        runId: active.runId,
        mode: active.mode,
        completedAt,
        businessDate,
        history: historyItem,
        pomodoro,
      },
    });
  }

  async function upsertEvent(userKey, event) {
    const events = await readEvents(userKey);
    if (findIdempotent(events, event.idempotencyKey)) return;
    await writeEvents(userKey, [event, ...events]);
  }

  async function upsertHistory(userKey, item) {
    const history = await readHistory(userKey);
    if (findIdempotent(history, item.idempotencyKey)) return;
    await writeHistory(userKey, [item, ...history]);
  }

  async function upsertPomodoro(userKey, item) {
    const pomodoros = await readPomodoros(userKey);
    if (findIdempotent(pomodoros, item.idempotencyKey)) return;
    await writePomodoros(userKey, [item, ...pomodoros]);
  }

  async function loadRuntime(userKey) {
    const raw = await readRuntime(userKey);
    return normalizeRuntime(raw);
  }

  return Object.freeze({ runtime, command });
}

export function normalizeRuntime(value) {
  if (value === null || value === undefined) return emptyRuntime();
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.schemaVersion !== SCHEMA_VERSION
    || !Number.isInteger(value.revision) || value.revision < 0
    || !Array.isArray(value.recentCommands)) {
    throw runtimeCorrupt();
  }
  const recentCommands = value.recentCommands.slice(-MAX_RECENT_COMMANDS).map(normalizeReceipt);
  const active = value.active === null ? null : normalizeActive(value.active);
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: value.revision,
    active,
    recentCommands,
  };
}

function normalizeActive(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw runtimeCorrupt();
  const plannedSeconds = integerInRange(value.plannedSeconds, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS);
  const remainingSeconds = integerInRange(value.remainingSeconds, 0, MAX_DURATION_SECONDS);
  const startedAt = validIso(value.startedAt);
  const ownerKind = ['web', 'desktop'].includes(value.ownerKind) ? value.ownerKind : '';
  const mode = ['focus', 'break'].includes(value.mode) ? value.mode : '';
  const status = ['running', 'paused'].includes(value.status) ? value.status : '';
  const endAt = value.endAt === null ? null : validIso(value.endAt);
  const pausedAt = value.pausedAt === null ? null : validIso(value.pausedAt);
  const taskId = nullableShortString(value.taskId, 128);
  const taskTitle = nullableCodePointString(value.taskTitle, MAX_TASK_TITLE_CODE_POINTS);
  if (!validUuid(value.runId) || !validUuid(value.ownerClientId)
    || typeof value.ownerUserId !== 'string' || !value.ownerUserId
    || !ownerKind || !mode || !plannedSeconds || remainingSeconds === null
    || !status || !startedAt
    || (status === 'running' && (!endAt || pausedAt))
    || (status === 'paused' && (endAt || !pausedAt))
    || (value.taskId != null && taskId === null)
    || (value.taskTitle != null && taskTitle === null)
    || value.businessTimeZone !== 'Asia/Bangkok') {
    throw runtimeCorrupt();
  }
  return {
    runId: value.runId,
    ownerClientId: value.ownerClientId,
    ownerKind,
    ownerUserId: value.ownerUserId,
    mode,
    taskId,
    taskTitle,
    plannedSeconds,
    remainingSeconds,
    status,
    startedAt,
    endAt,
    pausedAt,
    businessTimeZone: value.businessTimeZone,
  };
}

function normalizeReceipt(value) {
  if (!value || typeof value !== 'object'
    || !validUuid(value.commandId)
    || !validUuid(value.runId)
    || !Number.isInteger(value.resultRevision) || value.resultRevision < 1
    || !validIso(value.appliedAt)) {
    throw runtimeCorrupt();
  }
  return {
    commandId: value.commandId,
    runId: value.runId,
    resultRevision: value.resultRevision,
    appliedAt: value.appliedAt,
  };
}

function validateCommand(input, receivedAt) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid('timer_command_required');
  const commandId = validUuid(input.commandId);
  const runId = validUuid(input.runId);
  const type = COMMAND_TYPES.has(input.type) ? input.type : '';
  const occurredAt = validIso(input.occurredAt);
  if (!commandId) return invalid('timer_command_id_invalid');
  if (!runId) return invalid('timer_run_id_invalid');
  if (!type) return invalid('timer_command_type_invalid');
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 0) {
    return invalid('timer_expected_revision_invalid');
  }
  const occurredAtMs = occurredAt ? Date.parse(occurredAt) : Number.NaN;
  const futureSkewMs = occurredAtMs - receivedAt.getTime();
  const pastSkewMs = receivedAt.getTime() - occurredAtMs;
  if (!occurredAt
    || futureSkewMs > OCCURRED_AT_SKEW_MS
    || (type !== 'complete' && pastSkewMs > OCCURRED_AT_SKEW_MS)) {
    return invalid('timer_occurred_at_invalid');
  }
  if (input.payload !== undefined && (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload))) {
    return invalid('timer_payload_invalid');
  }
  return {
    ok: true,
    command: {
      commandId,
      runId,
      type,
      expectedRevision: input.expectedRevision,
      occurredAt,
      payload: input.payload || {},
    },
  };
}

function validateStartPayload(payload) {
  const clientId = validUuid(payload?.clientId);
  const ownerKind = ['web', 'desktop'].includes(payload?.ownerKind) ? payload.ownerKind : '';
  const mode = ['focus', 'break'].includes(payload?.mode) ? payload.mode : '';
  const plannedSeconds = integerInRange(payload?.plannedSeconds, MIN_DURATION_SECONDS, MAX_DURATION_SECONDS);
  const taskId = nullableShortString(payload?.taskId, 128);
  const taskTitle = nullableCodePointString(payload?.taskTitle, MAX_TASK_TITLE_CODE_POINTS);
  if (!clientId) return invalid('timer_client_id_invalid');
  if (!ownerKind) return invalid('timer_owner_kind_invalid');
  if (!mode) return invalid('timer_mode_invalid');
  if (!plannedSeconds) return invalid('timer_duration_invalid');
  if (payload?.taskId != null && taskId === null) return invalid('timer_task_id_invalid');
  if (payload?.taskTitle != null && taskTitle === null) return invalid('timer_task_title_invalid');
  return { ok: true, value: { clientId, ownerKind, mode, plannedSeconds, taskId, taskTitle } };
}

function nextRuntime(current, active, commandId, appliedAt) {
  const revision = current.revision + 1;
  return {
    schemaVersion: SCHEMA_VERSION,
    revision,
    active,
    recentCommands: [
      ...current.recentCommands,
      {
        commandId,
        runId: active?.runId || current.active?.runId,
        resultRevision: revision,
        appliedAt: appliedAt.toISOString(),
      },
    ].slice(-MAX_RECENT_COMMANDS),
  };
}

function safeRuntime(runtime, currentTime) {
  const active = runtime.active ? { ...runtime.active } : null;
  if (active) {
    delete active.ownerUserId;
    if (active.status === 'running') active.remainingSeconds = runningRemaining(active, currentTime);
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: runtime.revision,
    active,
  };
}

function eventForTransition(active, type, commandId, at) {
  const remainingSeconds = type === 'complete' ? 0 : active.remainingSeconds;
  return {
    id: commandId,
    sessionId: active.runId,
    type: `pomodoro_${type === 'start' ? 'started' : type === 'pause' ? 'paused' : type === 'resume' ? 'resumed' : type === 'cancel' ? 'cancelled' : 'completed'}`,
    mode: active.mode,
    taskId: active.taskId,
    taskTitle: active.taskTitle,
    plannedSeconds: active.plannedSeconds,
    elapsedSeconds: Math.max(0, active.plannedSeconds - remainingSeconds),
    remainingSeconds,
    createdAt: at.toISOString(),
    businessDate: null,
    source: active.ownerKind === 'desktop' ? 'keshi-desktop' : 'keshi-pomodoro',
    idempotencyKey: type === 'complete'
      ? `desktop:timer:${active.runId}:completed-event`
      : `desktop:timer:${active.runId}:${commandId}:event`,
  };
}

function runningRemaining(active, currentTime) {
  const endAtMs = Date.parse(active.endAt);
  if (!Number.isFinite(endAtMs)) throw runtimeCorrupt();
  return Math.max(0, Math.ceil((endAtMs - currentTime.getTime()) / 1000));
}

function success(runtime, at) {
  return response(200, {
    status: 'ok',
    idempotent: false,
    resultRevision: runtime.revision,
    runtime: safeRuntime(runtime, at),
  });
}

function conflict(error, runtime, at) {
  return response(409, { error, runtime: safeRuntime(runtime, at) });
}

function response(status, body) {
  return { status, body };
}

function invalid(error) {
  return { ok: false, status: 400, error };
}

function emptyRuntime() {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    active: null,
    recentCommands: [],
  };
}

function validUuid(value) {
  const normalized = String(value || '');
  return UUID_RE.test(normalized) ? normalized : '';
}

function validIso(value) {
  if (typeof value !== 'string' || !value) return '';
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value ? value : '';
}

function integerInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max ? value : null;
}

function nullableShortString(value, maxLength) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > maxLength) return null;
  return value;
}

function nullableCodePointString(value, maxCodePoints) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || Array.from(value).length > maxCodePoints) return null;
  return value;
}

function findIdempotent(records, key) {
  return records.find(item => item?.idempotencyKey === key) || null;
}

function formatHistoryDate(date, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function runtimeCorrupt() {
  const error = new Error('timer_runtime_corrupt');
  error.statusCode = 500;
  return error;
}
