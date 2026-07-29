import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, open, readFile, rename, stat, unlink } from 'node:fs/promises';

const SCHEMA_VERSION = 1;
const MAX_FILE_BYTES = 256 * 1024;
const MAX_QUEUED_COMMANDS = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createEncryptedTimerStore({
  directory,
  safeStorage,
  fileName = 'timer-state.v1.enc.json',
  fs = { mkdir, open, readFile, rename, stat, unlink },
  now = () => Date.now(),
  randomUUIDFn = randomUUID,
} = {}) {
  if (!directory) throw new Error('timer store directory is required');
  if (!safeStorage?.encryptString || !safeStorage?.decryptString) {
    throw new Error('timer store safeStorage is required');
  }
  const filePath = path.join(directory, fileName);

  async function load() {
    try {
      const fileInfo = await fs.stat(filePath);
      if (fileInfo.size > MAX_FILE_BYTES) throw new Error('timer_cache_too_large');
      const envelope = JSON.parse(await fs.readFile(filePath, 'utf8'));
      if (envelope?.schemaVersion !== SCHEMA_VERSION
        || typeof envelope.ciphertext !== 'string'
        || Buffer.byteLength(envelope.ciphertext, 'base64') > MAX_FILE_BYTES) {
        throw new Error('timer_cache_schema_invalid');
      }
      const plaintext = safeStorage.decryptString(Buffer.from(envelope.ciphertext, 'base64'));
      return normalizeTimerCache(JSON.parse(plaintext));
    } catch (error) {
      if (error?.code === 'ENOENT') return emptyTimerCache(randomUUIDFn());
      await quarantine(error?.message || 'timer_cache_corrupt');
      return emptyTimerCache(randomUUIDFn());
    }
  }

  async function save(value) {
    const normalized = normalizeTimerCache(value);
    if (!safeStorage.isEncryptionAvailable?.()) {
      throw new Error('timer_cache_encryption_unavailable');
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(normalized));
    const envelope = `${JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      ciphertext: encrypted.toString('base64'),
    })}\n`;
    if (Buffer.byteLength(envelope) > MAX_FILE_BYTES) throw new Error('timer_cache_too_large');
    await atomicWrite(filePath, envelope, fs, randomUUIDFn);
    return normalized;
  }

  async function quarantine(reason) {
    const suffix = String(reason || 'corrupt').replace(/[^a-z0-9_-]/gi, '_').slice(0, 48);
    const destination = `${filePath}.quarantine-${now()}-${suffix}`;
    await fs.rename(filePath, destination).catch(error => {
      if (error?.code !== 'ENOENT') throw error;
    });
    return destination;
  }

  async function clear() {
    await fs.unlink(filePath).catch(error => {
      if (error?.code !== 'ENOENT') throw error;
    });
  }

  return Object.freeze({ filePath, load, save, quarantine, clear });
}

export function normalizeTimerCache(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || value.schemaVersion !== SCHEMA_VERSION
    || !validUuid(value.clientId)
    || (value.ownerUserId !== null && typeof value.ownerUserId !== 'string')
    || !Number.isInteger(value.serverRevision) || value.serverRevision < 0
    || !Array.isArray(value.queuedCommands)
    || value.queuedCommands.length > MAX_QUEUED_COMMANDS) {
    throw new Error('timer_cache_schema_invalid');
  }
  const active = value.active === null ? null : normalizeCachedActive(value.active);
  return {
    schemaVersion: SCHEMA_VERSION,
    clientId: value.clientId,
    ownerUserId: value.ownerUserId,
    serverRevision: value.serverRevision,
    active,
    queuedCommands: value.queuedCommands.map(normalizeQueuedCommand),
  };
}

export function emptyTimerCache(clientId) {
  if (!validUuid(clientId)) throw new Error('timer_cache_client_id_invalid');
  return {
    schemaVersion: SCHEMA_VERSION,
    clientId,
    ownerUserId: null,
    serverRevision: 0,
    active: null,
    queuedCommands: [],
  };
}

function normalizeCachedActive(value) {
  if (!value || typeof value !== 'object'
    || !validUuid(value.runId)
    || !validUuid(value.ownerClientId)
    || !['web', 'desktop'].includes(value.ownerKind)
    || !['focus', 'break'].includes(value.mode)
    || !['running', 'paused'].includes(value.status)
    || !Number.isInteger(value.plannedSeconds)
    || !Number.isInteger(value.remainingSeconds)
    || typeof value.startedAt !== 'string') {
    throw new Error('timer_cache_active_invalid');
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
    businessTimeZone: value.businessTimeZone === 'Asia/Bangkok'
      ? value.businessTimeZone
      : 'Asia/Bangkok',
  };
}

function normalizeQueuedCommand(value) {
  if (!value || typeof value !== 'object'
    || value.type !== 'complete'
    || !validUuid(value.commandId)
    || !validUuid(value.runId)
    || !Number.isInteger(value.expectedRevision) || value.expectedRevision < 0
    || typeof value.occurredAt !== 'string') {
    throw new Error('timer_cache_queue_invalid');
  }
  return {
    commandId: value.commandId,
    type: 'complete',
    runId: value.runId,
    expectedRevision: value.expectedRevision,
    occurredAt: value.occurredAt,
    notified: value.notified === true,
  };
}

async function atomicWrite(filePath, text, fs, randomUUIDFn) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUIDFn()}.tmp`,
  );
  let handle;
  try {
    handle = await fs.open(tempPath, 'wx');
    await handle.writeFile(text, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(tempPath, filePath);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fs.unlink(tempPath).catch(() => {});
    throw error;
  }
}

function validUuid(value) {
  return UUID_RE.test(String(value || ''));
}

export const timerStoreLimits = Object.freeze({
  maxFileBytes: MAX_FILE_BYTES,
  maxQueuedCommands: MAX_QUEUED_COMMANDS,
});
