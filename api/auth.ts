import {
  authErrorMessage,
  clearLegacySessionCookie,
  clearSessionCookie,
  loginAccount,
  loginAdmin,
  readSession,
  registerAccount,
  sessionCookie,
} from './_auth.ts';

type AttemptEntry = { count: number; resetAt: number };
const attempts = new Map<string, AttemptEntry>();
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const ATTEMPT_MAX = 12;

function clientKey(req: any, action: string): string {
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = Array.isArray(forwarded) ? forwarded[0] : forwarded || req.socket?.remoteAddress || 'unknown';
  const ip = String(rawIp).split(',')[0].trim().slice(0, 80);
  return `${action}:${ip}`;
}

function allowAttempt(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }
  if (current.count >= ATTEMPT_MAX) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function setFreshSessionCookies(res: any, cookie: string) {
  res.setHeader('Set-Cookie', [clearLegacySessionCookie(), cookie]);
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const session = readSession(req.headers.cookie);
    if (!session) return res.status(401).json({ authenticated: false });
    return res.status(200).json({ authenticated: true, session });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', [clearSessionCookie(), clearLegacySessionCookie()]);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const action = String(body.action || '');

  if (action === 'register' || action === 'login' || action === 'admin-login') {
    const limit = allowAttempt(clientKey(req, action));
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfter));
      return res.status(429).json({ error: 'محاولات كثيرة. حاول مرة أخرى لاحقاً.' });
    }
  }

  try {
    if (action === 'register') {
      const { session, accountProof } = registerAccount({
        name: String(body.name || ''),
        email: String(body.email || ''),
        password: String(body.password || ''),
      });
      setFreshSessionCookies(res, sessionCookie(session));
      return res.status(201).json({ session, accountProof });
    }

    if (action === 'login') {
      const session = loginAccount({
        email: String(body.email || ''),
        password: String(body.password || ''),
        accountProof: String(body.accountProof || ''),
      });
      setFreshSessionCookies(res, sessionCookie(session));
      return res.status(200).json({ session });
    }

    if (action === 'admin-login') {
      const session = loginAdmin({
        adminCode: String(body.adminCode || ''),
        password: String(body.password || ''),
      });
      setFreshSessionCookies(res, sessionCookie(session));
      return res.status(200).json({ session });
    }

    return res.status(400).json({ error: 'عملية المصادقة غير معروفة.' });
  } catch (error) {
    const mapped = authErrorMessage(error);
    return res.status(mapped.status).json({ error: mapped.error });
  }
}
