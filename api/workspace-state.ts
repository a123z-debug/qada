import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHash } from 'node:crypto';
import { readActiveSession } from './session.ts';
import { isRedisConfigured, redisCommand, redisPrefix } from './_redis.ts';
import { enforceRateLimit } from './_rateLimit.ts';
import { protectJson, unprotectJson } from './_secureStore.ts';
import { recordAuditEvent } from './_audit.ts';

type SimpleMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

type WorkspaceState = {
  version: 1;
  simpleMessages: SimpleMessage[];
  simpleDraft: string;
  updatedAt: number;
};

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 40);
}

function workspaceKey(userId: string): string {
  return `${redisPrefix()}:workspace:${digest(userId)}`;
}

function sanitizeMessage(input: unknown): SimpleMessage | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const item = input as Record<string, unknown>;
  const role = item.role === 'assistant' ? 'assistant' : item.role === 'user' ? 'user' : null;
  const content = typeof item.content === 'string' ? item.content.trim().slice(0, 40_000) : '';
  const id = typeof item.id === 'string' ? item.id.trim().slice(0, 180) : '';
  if (!role || !content || !id) return null;
  return { id, role, content };
}

function sanitizeState(input: unknown): WorkspaceState {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_WORKSPACE_STATE');
  const raw = input as Record<string, unknown>;
  const messages = Array.isArray(raw.simpleMessages)
    ? raw.simpleMessages.map(sanitizeMessage).filter((item): item is SimpleMessage => Boolean(item)).slice(-40)
    : [];
  const simpleDraft = typeof raw.simpleDraft === 'string' ? raw.simpleDraft.slice(0, 20_000) : '';
  const normalized: WorkspaceState = {
    version: 1,
    simpleMessages: messages,
    simpleDraft,
    updatedAt: Date.now(),
  };
  if (JSON.stringify(normalized).length > 250_000) throw new Error('WORKSPACE_STATE_TOO_LARGE');
  return normalized;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const session = await readActiveSession(req.headers?.cookie);
  if (!session) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (!isRedisConfigured()) return res.status(503).json({ error: 'WORKSPACE_STORE_UNAVAILABLE' });

  try {
    const limit = await enforceRateLimit('workspace-state', session.id, 120, 10 * 60);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }

    if (req.method === 'GET') {
      const stored = await redisCommand(['GET', workspaceKey(session.id)]);
      const state = unprotectJson<WorkspaceState>(
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
      const state = sanitizeState((req.body as any)?.state);
      await redisCommand(['SET', workspaceKey(session.id), protectJson(state, 'workspace-state')]);
      await recordAuditEvent({
        actorId: session.id,
        actorRole: session.role,
        action: 'workspace.save',
        targetType: 'workspace',
        targetId: session.id,
        outcome: 'success',
      });
      return res.status(200).json({ ok: true, state });
    }

    if (req.method === 'DELETE') {
      await redisCommand(['DEL', workspaceKey(session.id)]);
      await recordAuditEvent({
        actorId: session.id,
        actorRole: session.role,
        action: 'workspace.clear',
        targetType: 'workspace',
        targetId: session.id,
        outcome: 'success',
      });
      return res.status(204).end();
    }

    res.setHeader('Allow', 'GET, PUT, POST, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    console.error('Workspace state error:', code);
    if (code === 'INVALID_WORKSPACE_STATE') return res.status(400).json({ error: code });
    if (code === 'WORKSPACE_STATE_TOO_LARGE') return res.status(413).json({ error: code });
    return res.status(503).json({ error: 'WORKSPACE_STORE_UNAVAILABLE' });
  }
}
