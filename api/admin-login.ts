import {
  createCipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const SESSION_COOKIE = 'qada_session_v3';
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const EXPECTED_ADMIN_HASH = '76bc895c4191f79f8c4da75d52e8e4e765ac51c7df420808c8c13f66559348d9';

function hashHex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqualText(a: string, b: string): boolean {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function getRootSecret(): Buffer {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) return createHash('sha256').update(configured).digest();

  const fallback = process.env.GEMINI_API_KEY?.trim();
  if (fallback) return createHash('sha256').update(`qada-auth-v2:${fallback}`).digest();

  throw new Error('AUTH_SECRET is not configured.');
}

function deriveSessionKey(): Buffer {
  return createHmac('sha256', getRootSecret()).update('session-encryption').digest();
}

function createSessionToken(session: Record<string, unknown>): string {
  const now = Date.now();
  const payload = {
    ...session,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS * 1000,
  };

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveSessionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    'v3',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const adminCode = String(body.adminCode || '').trim();
    const password = String(body.password || '');
    const actual = hashHex(`${adminCode}:${password}`);

    if (!safeEqualText(actual, EXPECTED_ADMIN_HASH)) {
      return res.status(401).json({ error: 'بيانات الدخول غير صحيحة.' });
    }

    const session = {
      id: 'admin-primary',
      name: 'مدير النظام',
      personName: 'مدير النظام',
      nationalId: '',
      email: 'admin@qada.local',
      role: 'admin',
      agency: 'إدارة أصول القضاء',
      loginMethod: 'admin_password',
      loginAt: Date.now(),
    };

    const token = createSessionToken(session);
    const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
    const parts = [
      `${SESSION_COOKIE}=${token}`,
      'HttpOnly',
      'Path=/',
      'SameSite=Strict',
      `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    ];
    if (secure) parts.push('Secure');

    res.setHeader('Set-Cookie', parts.join('; '));
    return res.status(200).json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('AUTH_SECRET')) {
      return res.status(503).json({ error: 'إعداد المصادقة على الخادم غير مكتمل.' });
    }
    return res.status(500).json({ error: 'تعذر إكمال تسجيل دخول الإدارة.' });
  }
}
