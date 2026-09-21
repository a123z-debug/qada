import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

type Role = 'admin' | 'user';

type Session = {
  id: string;
  name: string;
  personName: string;
  email: string;
  nationalId: string;
  role: Role;
  agency?: string;
  loginMethod: 'admin_password' | 'email_password';
  loginAt: number;
};

type SessionPayload = Session & { iat: number; exp: number };

type AccountRecord = {
  version: 1;
  name: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: number;
};

const SESSION_COOKIE = 'qada_session_v4';
const OLD_SESSION_COOKIES = ['qada_session_v3', 'qada_session_v2'];
const SESSION_MAX_AGE = 12 * 60 * 60;
const PBKDF2_ITERATIONS = 210_000;
const ADMIN_CREDENTIAL_HASH = 'fd6c1229b3b7a4f740284e1fd113d274197316ecca6611be68e61cd14ac4ab54';

type AuthAttemptEntry = { count: number; resetAt: number };
const authAttempts = new Map<string, AuthAttemptEntry>();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 10;

function clientId(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded || req.socket?.remoteAddress || 'unknown';
  return String(raw).split(',')[0].trim().slice(0, 120);
}

function checkAuthAttempt(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const current = authAttempts.get(key);

  if (!current || current.resetAt <= now) {
    authAttempts.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (current.count >= AUTH_MAX_ATTEMPTS) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}

function b64(value: Buffer | string) {
  return Buffer.from(value).toString('base64url');
}

function fromB64(value: string) {
  return Buffer.from(value, 'base64url');
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

function rootSecret() {
  const explicit = process.env.AUTH_SECRET?.trim();
  if (explicit) {
    return createHash('sha256').update(`qada-session-v4:${explicit}`).digest();
  }

  // Never derive authentication keys from AI provider credentials.
  // This deployment-scoped fallback keeps auth functional when AUTH_SECRET is
  // not configured yet, but sessions are intentionally invalidated by deploys.
  const deploymentScope = [
    process.env.VERCEL_PROJECT_ID,
    process.env.VERCEL_DEPLOYMENT_ID,
  ].filter(Boolean).join(':');

  if (deploymentScope) {
    return createHash('sha256')
      .update(`qada-session-v4:vercel:${deploymentScope}:${ADMIN_CREDENTIAL_HASH}`)
      .digest();
  }

  throw new Error('AUTH_SECRET_MISSING');
}

function keyFor(purpose: string) {
  return createHmac('sha256', rootSecret()).update(purpose).digest();
}

function cookies(header?: string | string[]) {
  const raw = Array.isArray(header) ? header.join(';') : header || '';
  const out: Record<string, string> = {};
  for (const piece of raw.split(';')) {
    const index = piece.indexOf('=');
    if (index <= 0) continue;
    out[piece.slice(0, index).trim()] = piece.slice(index + 1).trim();
  }
  return out;
}

function encryptJson(value: unknown, purpose: string, version: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFor(purpose), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [version, b64(iv), b64(tag), b64(encrypted)].join('.');
}

function decryptJson<T>(token: string, purpose: string, version: string): T | null {
  try {
    const [v, ivPart, tagPart, encryptedPart] = token.split('.');
    if (v !== version || !ivPart || !tagPart || !encryptedPart) return null;
    const decipher = createDecipheriv('aes-256-gcm', keyFor(purpose), fromB64(ivPart));
    decipher.setAuthTag(fromB64(tagPart));
    const decrypted = Buffer.concat([
      decipher.update(fromB64(encryptedPart)),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString('utf8')) as T;
  } catch {
    return null;
  }
}

function createSessionToken(session: Session) {
  const now = Date.now();
  const payload: SessionPayload = {
    ...session,
    iat: now,
    exp: now + SESSION_MAX_AGE * 1000,
  };
  return encryptJson(payload, 'session', 'v4');
}

export function readSession(header?: string | string[]): Session | null {
  const token = cookies(header)[SESSION_COOKIE];
  if (!token) return null;
  const payload = decryptJson<SessionPayload>(token, 'session', 'v4');
  if (!payload || payload.exp <= Date.now() || !payload.id || !payload.email || !payload.role) return null;
  const { iat: _iat, exp: _exp, ...session } = payload;
  return session;
}

function cookieForSession(session: Session) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  return [
    `${SESSION_COOKIE}=${createSessionToken(session)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${SESSION_MAX_AGE}`,
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

function expiredCookie(name: string) {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  return [
    `${name}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    'Max-Age=0',
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

function passwordHash(password: string, salt: string) {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function makeUserSession(record: AccountRecord): Session {
  return {
    id: `user-${sha256(record.email).slice(0, 20)}`,
    name: record.name,
    personName: record.name,
    email: record.email,
    nationalId: '',
    role: 'user',
    loginMethod: 'email_password',
    loginAt: Date.now(),
  };
}

function createAccount(nameInput: string, emailInput: string, password: string) {
  const name = nameInput.trim();
  const email = normalizeEmail(emailInput);
  if (name.length < 3) throw new Error('INVALID_NAME');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INVALID_EMAIL');
  if (password.length < 8) throw new Error('WEAK_PASSWORD');

  const salt = randomBytes(16).toString('hex');
  const record: AccountRecord = {
    version: 1,
    name,
    email,
    passwordSalt: salt,
    passwordHash: passwordHash(password, salt),
    createdAt: Date.now(),
  };

  return {
    session: makeUserSession(record),
    accountProof: encryptJson(record, 'account-proof', 'v1'),
  };
}

function loginUser(emailInput: string, password: string, accountProof: string) {
  const record = decryptJson<AccountRecord>(accountProof, 'account-proof', 'v1');
  if (!record || record.version !== 1) throw new Error('ACCOUNT_NOT_FOUND');

  const email = normalizeEmail(emailInput);
  if (!safeEqual(email, record.email)) throw new Error('INVALID_CREDENTIALS');
  if (!safeEqual(passwordHash(password, record.passwordSalt), record.passwordHash)) {
    throw new Error('INVALID_CREDENTIALS');
  }
  return makeUserSession(record);
}

function loginAdmin(adminCodeInput: string, password: string): Session {
  const actual = sha256(`${adminCodeInput.trim()}:${password}`);
  if (!safeEqual(actual, ADMIN_CREDENTIAL_HASH)) throw new Error('INVALID_CREDENTIALS');

  return {
    id: 'admin-primary',
    name: 'Administration',
    personName: 'Administration',
    email: 'admin@qada.local',
    nationalId: '',
    role: 'admin',
    agency: 'إدارة أصول القضاء',
    loginMethod: 'admin_password',
    loginAt: Date.now(),
  };
}

function authError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'INVALID_NAME' || code === 'INVALID_EMAIL') return { status: 400, error: 'بيانات التسجيل غير صحيحة.' };
  if (code === 'WEAK_PASSWORD') return { status: 400, error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.' };
  if (code === 'ACCOUNT_NOT_FOUND') return { status: 401, error: 'هذا الحساب غير محفوظ على هذا المتصفح. أنشئ المستخدم أولاً.' };
  if (code === 'INVALID_CREDENTIALS') return { status: 401, error: 'بيانات الدخول غير صحيحة.' };
  if (code === 'AUTH_SECRET_MISSING') return { status: 503, error: 'إعداد المصادقة على الخادم غير مكتمل.' };
  return { status: 500, error: 'تعذر إكمال عملية المصادقة.' };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    if (String(req.query?.health || '') === '1') {
      try {
        rootSecret();
        return res.status(200).json({ ok: true, authConfigured: true });
      } catch {
        return res.status(503).json({ ok: false, authConfigured: false });
      }
    }

    const session = readSession(req.headers?.cookie);
    if (!session) return res.status(401).json({ authenticated: false });
    return res.status(200).json({ authenticated: true, session });
  }

  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', [
      expiredCookie(SESSION_COOKIE),
      ...OLD_SESSION_COOKIES.map(expiredCookie),
    ]);
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'register' || action === 'user-login' || action === 'admin-login') {
      const limit = checkAuthAttempt(`${action}:${clientId(req)}`);
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retryAfter));
        return res.status(429).json({ error: 'محاولات كثيرة. حاول مرة أخرى لاحقاً.' });
      }
    }

    let session: Session;
    let accountProof: string | undefined;

    if (action === 'register') {
      const result = createAccount(
        String(body.name || ''),
        String(body.email || ''),
        String(body.password || ''),
      );
      session = result.session;
      accountProof = result.accountProof;
    } else if (action === 'user-login') {
      session = loginUser(
        String(body.email || ''),
        String(body.password || ''),
        String(body.accountProof || ''),
      );
    } else if (action === 'admin-login') {
      session = loginAdmin(
        String(body.adminCode || ''),
        String(body.password || ''),
      );
    } else {
      return res.status(400).json({ error: 'عملية المصادقة غير معروفة.' });
    }

    res.setHeader('Set-Cookie', [
      ...OLD_SESSION_COOKIES.map(expiredCookie),
      cookieForSession(session),
    ]);

    return res.status(200).json({
      session,
      ...(accountProof ? { accountProof } : {}),
    });
  } catch (error) {
    const mapped = authError(error);
    return res.status(mapped.status).json({ error: mapped.error });
  }
}
