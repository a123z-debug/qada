import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { readActiveSession } from './session.js';
import { isRedisConfigured, redisCommand, redisPrefix } from './_redis.js';
import { enforceRateLimit } from './_rateLimit.js';
import { protectJson, unprotectJson } from './_secureStore.js';
import { recordAuditEvent } from './_audit.js';

type StoredCase = {
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  record: Record<string, unknown>;
  savedAt: number;
};

type SharedWorkspaceMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type SharedWorkspaceState = {
  version: 1;
  simpleMessages: SharedWorkspaceMessage[];
  simpleDraft: string;
  updatedAt: number;
};

const MAX_CASES_PER_USER = 100;
const MAX_CASES_ADMIN_VIEW = 300;

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 40);
}

function userIndexKey(ownerId: string) {
  return `${redisPrefix()}:cases:user:${digest(ownerId)}`;
}

function allIndexKey() {
  return `${redisPrefix()}:cases:all`;
}

function caseKey(ownerId: string, caseId: string) {
  return `${redisPrefix()}:case:${digest(ownerId)}:${digest(caseId)}`;
}

function workspaceKey(ownerId: string) {
  return `${redisPrefix()}:workspace:${digest(ownerId)}`;
}

function sanitizeWorkspaceMessage(input: unknown): SharedWorkspaceMessage | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const item = input as Record<string, unknown>;
  const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null;
  const content = typeof item.content === 'string' ? item.content.trim().slice(0, 40_000) : '';
  const id = typeof item.id === 'string' ? item.id.trim().slice(0, 180) : '';
  if (!role || !content || !id) return null;
  return { id, role, content };
}

function sanitizeWorkspaceState(input: unknown): SharedWorkspaceState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_WORKSPACE_STATE');
  const raw = input as Record<string, unknown>;
  const simpleMessages = Array.isArray(raw.simpleMessages)
    ? raw.simpleMessages
        .map(sanitizeWorkspaceMessage)
        .filter((item): item is SharedWorkspaceMessage => Boolean(item))
        .slice(-40)
    : [];
  const simpleDraft = typeof raw.simpleDraft === 'string' ? raw.simpleDraft.slice(0, 20_000) : '';
  const state: SharedWorkspaceState = {
    version: 1,
    simpleMessages,
    simpleDraft,
    updatedAt: Date.now(),
  };
  if (JSON.stringify(state).length > 250_000) throw new Error('WORKSPACE_STATE_TOO_LARGE');
  return state;
}

function sanitizeRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_CASE');
  const record = input as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim().slice(0, 180) : '';
  if (!id) throw new Error('INVALID_CASE_ID');
  const raw = JSON.stringify(record);
  if (raw.length > 350_000) throw new Error('CASE_TOO_LARGE');
  return JSON.parse(raw) as Record<string, unknown>;
}

async function loadMany(keys: string[]): Promise<StoredCase[]> {
  if (!keys.length) return [];
  const values = await redisCommand(['MGET', ...keys]);
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => unprotectJson<StoredCase>(typeof value === 'string' ? value : '', 'case-record'))
    .filter((value): value is StoredCase => Boolean(value));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const session = await readActiveSession(req.headers?.cookie);
  if (!session) return res.status(401).json({ error: 'AUTH_REQUIRED' });

  if (!isRedisConfigured() && req.method === 'GET') {
    return res.status(200).json({
      records: [],
      degraded: true,
      warning: 'مخزن القضايا الدائم غير مهيأ بعد.',
      meta: { scope: String(req.query?.scope || '') === 'all' ? 'all' : 'user', count: 0, truncated: false },
    });
  }
  if (!isRedisConfigured()) return res.status(503).json({ error: 'CASE_STORE_UNAVAILABLE' });

  try {
    const limit = await enforceRateLimit('cases', session.id, 120, 10 * 60);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }

    const workspaceMode = String(req.query?.workspace || '') === '1';
    if (workspaceMode) {
      if (req.method === 'GET') {
        const stored = await redisCommand(['GET', workspaceKey(session.id)]);
        const state = unprotectJson<SharedWorkspaceState>(
          typeof stored === 'string' ? stored : '',
          'workspace-state',
        );
        return res.status(200).json({
          state: state?.version === 1
            ? state
            : { version: 1, simpleMessages: [], simpleDraft: '', updatedAt: 0 },
        });
      }

      if (req.method === 'PUT' || req.method === 'POST') {
        const state = sanitizeWorkspaceState((req.body as any)?.state);
        await redisCommand(['SET', workspaceKey(session.id), protectJson(state, 'workspace-state')]);
        return res.status(200).json({ ok: true, state });
      }

      if (req.method === 'DELETE') {
        await redisCommand(['DEL', workspaceKey(session.id)]);
        return res.status(204).end();
      }

      res.setHeader('Allow', 'GET, PUT, POST, DELETE');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    if (req.method === 'GET') {
      const wantsAll = String(req.query?.scope || '') === 'all';
      if (wantsAll && session.role !== 'admin') return res.status(403).json({ error: 'ADMIN_ONLY' });
      const index = wantsAll ? allIndexKey() : userIndexKey(session.id);
      const members = await redisCommand(['SMEMBERS', index]);
      const keys = Array.isArray(members) ? members.filter((item): item is string => typeof item === 'string') : [];
      const limitedKeys = keys.slice(0, wantsAll ? MAX_CASES_ADMIN_VIEW : MAX_CASES_PER_USER);
      const stored = await loadMany(limitedKeys);
      stored.sort((a, b) => Number(b.record.updatedAt || b.savedAt) - Number(a.record.updatedAt || a.savedAt));
      return res.status(200).json({
        records: stored.map((item) => wantsAll
          ? { ...item.record, storageOwnerId: item.ownerId }
          : item.record),
        meta: { scope: wantsAll ? 'all' : 'user', count: stored.length, truncated: keys.length > limitedKeys.length },
      });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const record = sanitizeRecord((req.body as any)?.record);
      const requestedOwner = typeof record.storageOwnerId === 'string' ? record.storageOwnerId.trim() : '';
      const ownerId = session.role === 'admin' && requestedOwner ? requestedOwner : session.id;
      const { storageOwnerId: _storageOwnerId, ...cleanRecord } = record;
      const id = String(cleanRecord.id);
      const key = caseKey(ownerId, id);
      const value: StoredCase = {
        ownerId,
        ownerName: ownerId === session.id ? session.name : 'مستخدم المنصة',
        ownerEmail: ownerId === session.id ? session.email : '',
        record: cleanRecord,
        savedAt: Date.now(),
      };
      await redisCommand(['SET', key, protectJson(value, 'case-record')]);
      await redisCommand(['SADD', userIndexKey(ownerId), key]);
      await redisCommand(['SADD', allIndexKey(), key]);
      await recordAuditEvent({
        actorId: session.id,
        actorRole: session.role,
        action: 'case.save',
        targetType: 'case',
        targetId: `${ownerId}:${id}`,
        outcome: 'success',
        metadata: { adminCrossUser: ownerId !== session.id },
      });
      return res.status(200).json({ ok: true, record: session.role === 'admin' ? { ...cleanRecord, storageOwnerId: ownerId } : cleanRecord });
    }

    if (req.method === 'DELETE') {
      const caseId = String(req.query?.id || '').trim();
      if (!caseId) return res.status(400).json({ error: 'CASE_ID_REQUIRED' });
      const requestedOwner = String(req.query?.ownerId || '').trim();
      const ownerId = session.role === 'admin' && requestedOwner ? requestedOwner : session.id;
      const key = caseKey(ownerId, caseId);
      await redisCommand(['DEL', key]);
      await redisCommand(['SREM', userIndexKey(ownerId), key]);
      await redisCommand(['SREM', allIndexKey(), key]);
      await recordAuditEvent({
        actorId: session.id,
        actorRole: session.role,
        action: 'case.delete',
        targetType: 'case',
        targetId: `${ownerId}:${caseId}`,
        outcome: 'success',
        metadata: { adminCrossUser: ownerId !== session.id },
      });
      return res.status(204).end();
    }

    res.setHeader('Allow', 'GET, PUT, POST, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    console.error('Case store error:', code);
    if (code === 'INVALID_CASE' || code === 'INVALID_CASE_ID' || code === 'INVALID_WORKSPACE_STATE') return res.status(400).json({ error: code });
    if (code === 'CASE_TOO_LARGE') return res.status(413).json({ error: 'CASE_TOO_LARGE' });
    if (code === 'WORKSPACE_STATE_TOO_LARGE') return res.status(413).json({ error: 'WORKSPACE_STATE_TOO_LARGE' });
    return res.status(503).json({ error: 'CASE_STORE_UNAVAILABLE' });
  }
}