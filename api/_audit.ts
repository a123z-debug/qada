import { createHash, randomBytes } from 'node:crypto';
import { isRedisConfigured, redisCommand, redisPrefix } from './_redis.js';
import {
  protectJson,
  signIntegrityPayload,
  unprotectJson,
  verifyIntegrityPayload,
} from './_secureStore.js';

export type AuditRole = 'admin' | 'user' | 'system';

export type AuditEvent = {
  id: string;
  at: number;
  actorId: string;
  actorRole: AuditRole;
  action: string;
  targetType?: string;
  targetRef?: string;
  outcome: 'success' | 'warning' | 'denied' | 'error';
  metadata?: Record<string, string | number | boolean | null>;
  sequence?: number;
  integritySignature?: string;
};

function auditKey() {
  return `${redisPrefix()}:audit:v1`;
}

function auditSequenceKey() {
  return `${redisPrefix()}:audit:sequence:v2`;
}

function hashRef(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 20);
}

function sanitizeMetadata(input?: Record<string, unknown>) {
  const output: Record<string, string | number | boolean | null> = {};
  if (!input) return output;
  for (const [key, value] of Object.entries(input).slice(0, 20)) {
    const safeKey = key.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 80);
    if (!safeKey) continue;
    if (typeof value === 'string') output[safeKey] = value.slice(0, 240);
    else if (typeof value === 'number' && Number.isFinite(value)) output[safeKey] = value;
    else if (typeof value === 'boolean') output[safeKey] = value;
    else if (value === null) output[safeKey] = null;
  }
  return output;
}

function canonicalAuditPayload(event: AuditEvent): string {
  const metadata = event.metadata || {};
  const sortedMetadata = Object.keys(metadata)
    .sort()
    .map((key) => [key, metadata[key]]);
  return JSON.stringify([
    Number(event.sequence || 0),
    event.id,
    event.at,
    event.actorId,
    event.actorRole,
    event.action,
    event.targetType || '',
    event.targetRef || '',
    event.outcome,
    sortedMetadata,
  ]);
}

export function sealAuditEventIntegrity(event: AuditEvent, sequence: number): AuditEvent {
  const normalizedSequence = Math.max(1, Math.floor(sequence));
  const withSequence: AuditEvent = {
    ...event,
    sequence: normalizedSequence,
    integritySignature: undefined,
  };
  return {
    ...withSequence,
    integritySignature: signIntegrityPayload(canonicalAuditPayload(withSequence), 'audit-event-v2'),
  };
}

export function verifyAuditEventIntegrity(event: AuditEvent): boolean {
  if (!Number.isInteger(event.sequence) || Number(event.sequence) <= 0 || !event.integritySignature) return false;
  return verifyIntegrityPayload(
    canonicalAuditPayload({ ...event, integritySignature: undefined }),
    event.integritySignature,
    'audit-event-v2',
  );
}

export function assessAuditIntegrity(events: AuditEvent[]) {
  const signed = events.filter((event) => Number.isInteger(event.sequence) && Boolean(event.integritySignature));
  const legacyEvents = events.length - signed.length;
  const invalidSignatures = signed.filter((event) => !verifyAuditEventIntegrity(event)).length;

  const sequences = signed
    .map((event) => Number(event.sequence))
    .filter((sequence) => Number.isInteger(sequence) && sequence > 0)
    .sort((a, b) => b - a);

  const seen = new Set<number>();
  let duplicateSequences = 0;
  let sequenceGaps = 0;
  for (let index = 0; index < sequences.length; index += 1) {
    const sequence = sequences[index];
    if (seen.has(sequence)) duplicateSequences += 1;
    seen.add(sequence);
    const next = sequences[index + 1];
    if (typeof next === 'number' && sequence - next > 1) {
      sequenceGaps += sequence - next - 1;
    }
  }

  const status = invalidSignatures > 0 || duplicateSequences > 0
    ? 'failed'
    : sequenceGaps > 0 || legacyEvents > 0
      ? 'warning'
      : 'ok';

  return {
    status,
    checkedEvents: events.length,
    signedEvents: signed.length,
    legacyEvents,
    invalidSignatures,
    duplicateSequences,
    sequenceGaps,
    newestSequence: sequences[0] || null,
    oldestSequence: sequences[sequences.length - 1] || null,
  } as const;
}

export async function recordAuditEvent(input: {
  actorId: string;
  actorRole: AuditRole;
  action: string;
  targetType?: string;
  targetId?: string;
  outcome: AuditEvent['outcome'];
  metadata?: Record<string, unknown>;
}): Promise<void> {
  if (!isRedisConfigured()) return;
  try {
    const sequenceRaw = await redisCommand(['INCR', auditSequenceKey()]);
    const sequence = Number(sequenceRaw || 0);
    if (!Number.isInteger(sequence) || sequence <= 0) throw new Error('AUDIT_SEQUENCE_INVALID');

    const event = sealAuditEventIntegrity({
      id: `audit-${Date.now()}-${randomBytes(5).toString('hex')}`,
      at: Date.now(),
      actorId: hashRef(input.actorId || 'unknown'),
      actorRole: input.actorRole,
      action: String(input.action || 'unknown').slice(0, 120),
      targetType: input.targetType ? String(input.targetType).slice(0, 80) : undefined,
      targetRef: input.targetId ? hashRef(input.targetId) : undefined,
      outcome: input.outcome,
      metadata: sanitizeMetadata(input.metadata),
    }, sequence);

    await redisCommand(['LPUSH', auditKey(), protectJson(event, 'audit-event')]);
    await redisCommand(['LTRIM', auditKey(), 0, 499]);
  } catch (error) {
    console.error('Audit write failed:', error instanceof Error ? error.message : error);
  }
}

export async function listAuditEvents(limit = 150): Promise<AuditEvent[]> {
  if (!isRedisConfigured()) throw new Error('AUDIT_STORE_UNAVAILABLE');
  const end = Math.max(0, Math.min(499, Math.floor(limit) - 1));
  const values = await redisCommand(['LRANGE', auditKey(), 0, end]);
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => unprotectJson<AuditEvent>(typeof value === 'string' ? value : '', 'audit-event'))
    .filter((value): value is AuditEvent => Boolean(value));
}