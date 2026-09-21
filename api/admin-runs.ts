import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readActiveSession } from './session.ts';
import { isRedisConfigured, redisCommand, redisPrefix } from './_redis.ts';
import { enforceRateLimit } from './_rateLimit.ts';
import { protectJson, unprotectJson } from './_secureStore.ts';

type AdminRunSnapshot = {
  runId?: string;
  documentTitle?: string;
  analyzedAt?: number;
  agentRuns?: unknown[];
  sourcePackets?: unknown[];
  report?: Record<string, unknown>;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
};

function runsKey() {
  return `${redisPrefix()}:admin:runs`;
}

function sanitizeSnapshot(input: unknown): AdminRunSnapshot {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_RUN');
  const snapshot = input as AdminRunSnapshot;
  const raw = JSON.stringify(snapshot);
  if (raw.length > 700_000) throw new Error('RUN_TOO_LARGE');
  return JSON.parse(raw) as AdminRunSnapshot;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const session = await readActiveSession(req.headers?.cookie);
  if (!session) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (session.role !== 'admin') return res.status(403).json({ error: 'ADMIN_ONLY' });
  if (!isRedisConfigured()) return res.status(503).json({ error: 'AUDIT_STORE_UNAVAILABLE' });

  try {
    const limit = await enforceRateLimit('admin-runs', session.id, 120, 10 * 60);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }

    if (req.method === 'GET') {
      const values = await redisCommand(['LRANGE', runsKey(), 0, 19]);
      const runs = (Array.isArray(values) ? values : [])
        .map((value) => unprotectJson<AdminRunSnapshot>(typeof value === 'string' ? value : '', 'admin-run'))
        .filter((value): value is AdminRunSnapshot => Boolean(value));
      return res.status(200).json({ runs });
    }

    if (req.method === 'POST') {
      const snapshot = sanitizeSnapshot((req.body as any)?.snapshot);
      const normalized: AdminRunSnapshot = {
        ...snapshot,
        runId: String(snapshot.runId || `run-${Date.now()}`).slice(0, 180),
        analyzedAt: Number(snapshot.analyzedAt || Date.now()),
      };
      await redisCommand(['LPUSH', runsKey(), protectJson(normalized, 'admin-run')]);
      await redisCommand(['LTRIM', runsKey(), 0, 49]);
      return res.status(201).json({ ok: true, runId: normalized.runId });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    console.error('Admin run store error:', code);
    if (code === 'INVALID_RUN') return res.status(400).json({ error: code });
    if (code === 'RUN_TOO_LARGE') return res.status(413).json({ error: code });
    return res.status(503).json({ error: 'AUDIT_STORE_UNAVAILABLE' });
  }
}