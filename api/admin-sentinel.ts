import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readActiveSession } from './session.js';
import { enforceRateLimit } from './_rateLimit.js';
import { isRedisConfigured } from './_redis.js';
import { listSentinelEvents, type SentinelSeverity } from './_sentinel.js';

function severityRank(value: string): number {
  if (value === 'P0') return 3;
  if (value === 'P1') return 2;
  if (value === 'P2') return 1;
  return 0;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  const session = await readActiveSession(req.headers?.cookie);
  if (!session) return res.status(401).json({ error: 'AUTH_REQUIRED' });
  if (session.role !== 'admin') return res.status(403).json({ error: 'ADMIN_ONLY' });
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!isRedisConfigured()) {
    return res.status(200).json({
      events: [],
      summary: { total: 0, flagged: 0, clean: 0, P0: 0, P1: 0, P2: 0 },
      degraded: true,
      warning: 'QADA Sentinel يحتاج Redis لحفظ المراقبة الحية.',
    });
  }

  try {
    const limitCheck = await enforceRateLimit('admin-sentinel', session.id, 900, 10 * 60);
    if (!limitCheck.allowed) {
      res.setHeader('Retry-After', String(limitCheck.retryAfterSeconds));
      return res.status(429).json({ error: 'RATE_LIMITED' });
    }

    const requested = Math.max(1, Math.min(500, Number(req.query?.limit || 250)));
    const severity = String(req.query?.severity || '').toUpperCase();
    const onlyFlagged = String(req.query?.flagged || '') === '1';
    let events = await listSentinelEvents(requested);

    if (severityRank(severity) > 0) {
      events = events.filter((event) =>
        event.findings.some((finding) => finding.severity === severity as SentinelSeverity),
      );
    }
    if (onlyFlagged) events = events.filter((event) => event.status === 'flagged');

    const all = await listSentinelEvents(Math.min(500, Math.max(requested, 250)));
    const summary = {
      total: all.length,
      flagged: all.filter((event) => event.status === 'flagged').length,
      clean: all.filter((event) => event.status === 'clean').length,
      P0: all.filter((event) => event.findings.some((finding) => finding.severity === 'P0')).length,
      P1: all.filter((event) => event.findings.some((finding) => finding.severity === 'P1')).length,
      P2: all.filter((event) => event.findings.some((finding) => finding.severity === 'P2')).length,
    };

    return res.status(200).json({
      events,
      summary,
      meta: {
        mode: 'QADA Sentinel',
        retention: 500,
        privacy: 'encrypted-redacted-snippets',
        sampledAt: Date.now(),
      },
    });
  } catch (error) {
    console.error('QADA Sentinel read failed:', error instanceof Error ? error.message : error);
    return res.status(503).json({ error: 'SENTINEL_STORE_UNAVAILABLE' });
  }
}
