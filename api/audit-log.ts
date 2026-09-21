import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readSession } from './session.ts';
import { enforceRateLimit } from './_rateLimit.ts';
import { listAuditEvents, recordAuditEvent } from './_audit.ts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const session = readSession(req.headers?.cookie);
  if (!session) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (session.role !== 'admin') {
    await recordAuditEvent({ actorId: session.id, actorRole: session.role, action: 'audit.read', outcome: 'denied' });
    return res.status(403).json({ error: 'ADMIN_ONLY' });
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const limit = await enforceRateLimit('audit-log', session.id, 120, 10 * 60);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }
    const requested = Number(req.query?.limit || 150);
    const events = await listAuditEvents(Number.isFinite(requested) ? requested : 150);
    return res.status(200).json({ events, count: events.length });
  } catch (error) {
    console.error('Audit log read failed:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'AUDIT_STORE_UNAVAILABLE' });
  }
}