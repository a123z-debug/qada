import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listUserAccounts, readActiveSession, setUserAccountDisabled } from './session.js';
import { enforceRateLimit } from './_rateLimit.js';
import { recordAuditEvent } from './_audit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const session = await readActiveSession(req.headers?.cookie);
  if (!session) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (session.role !== 'admin') return res.status(403).json({ error: 'ADMIN_ONLY' });

  try {
    const limit = await enforceRateLimit('admin-users', session.id, 120, 10 * 60);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }

    if (req.method === 'GET') {
      const users = await listUserAccounts();
      return res.status(200).json({ users, count: users.length });
    }

    if (req.method === 'PATCH') {
      const body = (req.body ?? {}) as { userId?: string; disabled?: boolean };
      const userId = typeof body.userId === 'string' ? body.userId.trim() : '';
      if (!userId || typeof body.disabled !== 'boolean') {
        return res.status(400).json({ error: 'INVALID_ACCOUNT_UPDATE' });
      }
      const user = await setUserAccountDisabled(userId, body.disabled);
      await recordAuditEvent({
        actorId: session.id,
        actorRole: session.role,
        action: body.disabled ? 'user.disable' : 'user.enable',
        targetType: 'user',
        targetId: userId,
        outcome: 'success',
      });
      return res.status(200).json({ user });
    }

    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    console.error('Admin users error:', code);
    if (code === 'ACCOUNT_NOT_FOUND') return res.status(404).json({ error: code });
    return res.status(503).json({ error: 'ACCOUNT_STORE_UNAVAILABLE' });
  }
}