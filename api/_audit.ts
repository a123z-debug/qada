import { createHash, randomBytes } from 'node:crypto';
import { isRedisConfigured, redisCommand, redisPrefix } from './_redis.ts';
import { protectJson, unprotectJson } from './_secureStore.ts';

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
};

function auditKey() {
  return `${redisPrefix()}:audit:v1`;
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
  const event: AuditEvent = {
    id: `audit-${Date.now()}-${randomBytes(5).toString('hex')}`,
    at: Date.now(),
    actorId: hashRef(input.actorId || 'unknown'),
    actorRole: input.actorRole,
    action: String(input.action || 'unknown').slice(0, 120),
    targetType: input.targetType ? String(input.targetType).slice(0, 80) : undefined,
    targetRef: input.targetId ? hashRef(input.targetId) : undefined,
    outcome: input.outcome,
    metadata: sanitizeMetadata(input.metadata),
  };
  try {
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