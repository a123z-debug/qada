import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { isRedisConfigured, redisCommand, redisPrefix } from './_redis.ts';
import { clearRateLimit, enforceRateLimit } from './_rateLimit.ts';
import { protectJson, unprotectJson } from './_secureStore.ts';
import { recordAuditEvent } from './_audit.ts';

export type SessionRole = 'admin' | 'user';

export type AuthSession = {
  id: string;
  name: string;
  personName: string;
  email: string;
  nationalId: string;
  role: SessionRole;
  agency?: string;
  loginMethod: 'admin_password' | 'email_password';
  loginAt: number;
  sessionRevision?: number;
  adminCredentialRevision?: string;
};

type SessionPayload = AuthSession & { iat: number; exp: number };

type AccountRecord = {
  version: 2;
  id: string;
  name: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: number;
  sessionRevision?: number;
  disabledAt?: number;
};

const SESSION_COOKIE = 'qada_session_v6';
const OLD_SESSION_COOKIES = ['qada_session_v5', 'qada_session_v4', 'qada_session_v3', 'qada_session_v2'];
const SESSION_MAX_AGE = 12 * 60 * 60;
const PBKDF2_ITERATIONS = 310_000;
const AUTH_WINDOW_SECONDS = 15 * 60;
const AUTH_ATTEMPT_LIMIT = 10;

// Stable bootstrap hash for the owner-selected Administration credentials.
// A valid QADA_ADMIN_CREDENTIAL_HASH_V6 environment value overrides this.
const BUILTIN_ADMIN_HASH_V6 = '4b999367e80365715c601e9d36d406de28f980a5e75f9e38429322d057f3e0a2';
const localAccounts = new Map<string, string>();

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

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isProductionRuntime() {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
}

function rootSecret() {
  const explicit = process.env.AUTH_SECRET?.trim();
  if (!explicit || explicit.length < 32) {
    throw new Error('AUTH_SECRET_MISSING');
  }
  return createHash('sha256').update(`qada-session-v6:${explicit}`).digest();
}

function adminCredentialConfig() {
  const configured = process.env.QADA_ADMIN_CREDENTIAL_HASH_V6?.trim().toLowerCase() || '';
  if (/^[a-f0-9]{64}$/i.test(configured)) {
    return { hash: configured, source: 'environment' as const };
  }
  return { hash: BUILTIN_ADMIN_HASH_V6, source: 'bootstrap' as const };
}

function adminCredentialHash() {
  return adminCredentialConfig().hash;
}

function adminCredentialRevision() {
  return adminCredentialHash().slice(0, 16);
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

function createSessionToken(session: AuthSession) {
  const now = Date.now();
  const payload: SessionPayload = {
    ...session,
    iat: now,
    exp: now + SESSION_MAX_AGE * 1000,
  };
  return encryptJson(payload, 'session', 'v6');
}

function clientSession(session: AuthSession): Omit<AuthSession, 'adminCredentialRevision'> {
  const { adminCredentialRevision: _revision, ...publicSession } = session;
  return publicSession;
}

export function readSession(header?: string | string[]): AuthSession | null {
  try {
    const token = cookies(header)[SESSION_COOKIE];
    if (!token) return null;
    const payload = decryptJson<SessionPayload>(token, 'session', 'v6');
    if (!payload || payload.exp <= Date.now() || !payload.id || !payload.email || !payload.role) return null;
    const { iat: _iat, exp: _exp, ...session } = payload;
    return session;
  } catch {
    return null;
  }
}

function cookieForSession(session: AuthSession) {
  const secure = isProductionRuntime();
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
  const secure = isProductionRuntime();
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

function accountKey(email: string) {
  return `${redisPrefix()}:account:${sha256(normalizeEmail(email))}`;
}

function accountIndexKey() {
  return `${redisPrefix()}:accounts:index`;
}

function accountIdKey(userId: string) {
  return `${redisPrefix()}:account-id:${sha256(userId)}`;
}

function encodeAccount(record: AccountRecord) {
  return protectJson(record, 'account-record');
}

function decodeAccount(value: string | null | undefined): AccountRecord | null {
  if (!value) return null;
  const record = unprotectJson<AccountRecord>(value, 'account-record');
  return record?.version === 2 ? record : null;
}

async function loadAccount(email: string): Promise<AccountRecord | null> {
  const key = accountKey(email);
  if (isRedisConfigured()) {
    return decodeAccount(await redisCommand(['GET', key]));
  }
  if (isProductionRuntime()) throw new Error('ACCOUNT_STORE_UNAVAILABLE');
  return decodeAccount(localAccounts.get(key));
}

export async function readActiveSession(header?: string | string[]): Promise<AuthSession | null> {
  const session = readSession(header);
  if (!session) return null;
  if (session.role === 'admin') {
    return session.adminCredentialRevision === adminCredentialRevision() ? session : null;
  }

  try {
    const account = await loadAccount(session.email);
    if (!account || account.disabledAt || account.id !== session.id) return null;
    const accountRevision = Number(account.sessionRevision || 1);
    const sessionRevision = Number(session.sessionRevision || 1);
    if (accountRevision !== sessionRevision) return null;
    return session;
  } catch {
    // Fail closed if the account store cannot confirm an ordinary user session.
    // Admin sessions are handled above and do not depend on the user-account store.
    return isProductionRuntime() ? null : session;
  }
}

async function saveAccount(record: AccountRecord): Promise<void> {
  const key = accountKey(record.email);
  const encoded = encodeAccount(record);
  if (isRedisConfigured()) {
    await redisCommand(['SET', key, encoded]);
    await redisCommand(['SADD', accountIndexKey(), key]);
    await redisCommand(['SET', accountIdKey(record.id), key]);
    return;
  }
  if (isProductionRuntime()) throw new Error('ACCOUNT_STORE_UNAVAILABLE');
  localAccounts.set(key, encoded);
}

async function createAccount(nameInput: string, emailInput: string, password: string): Promise<AccountRecord> {
  const name = nameInput.trim();
  const email = normalizeEmail(emailInput);
  if (name.length < 3) throw new Error('INVALID_NAME');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INVALID_EMAIL');
  if (password.length < 10) throw new Error('WEAK_PASSWORD');

  const salt = randomBytes(16).toString('hex');
  const record: AccountRecord = {
    version: 2,
    id: `user-${sha256(email).slice(0, 20)}`,
    name,
    email,
    passwordSalt: salt,
    passwordHash: passwordHash(password, salt),
    createdAt: Date.now(),
    sessionRevision: 1,
  };
  const encoded = encodeAccount(record);
  const key = accountKey(email);

  if (isRedisConfigured()) {
    const result = await redisCommand(['SET', key, encoded, 'NX']);
    if (result !== 'OK') throw new Error('ACCOUNT_EXISTS');
    await redisCommand(['SADD', accountIndexKey(), key]);
    await redisCommand(['SET', accountIdKey(record.id), key]);
    return record;
  }

  if (isProductionRuntime()) throw new Error('ACCOUNT_STORE_UNAVAILABLE');
  if (localAccounts.has(key)) throw new Error('ACCOUNT_EXISTS');
  localAccounts.set(key, encoded);
  return record;
}

async function loginUser(emailInput: string, password: string): Promise<AuthSession> {
  const email = normalizeEmail(emailInput);
  const record = await loadAccount(email);
  if (!record) throw new Error('ACCOUNT_NOT_FOUND');
  if (record.disabledAt) throw new Error('ACCOUNT_DISABLED');
  if (!safeEqual(passwordHash(password, record.passwordSalt), record.passwordHash)) {
    throw new Error('INVALID_CREDENTIALS');
  }
  return {
    id: record.id,
    name: record.name,
    personName: record.name,
    email: record.email,
    nationalId: '',
    role: 'user',
    loginMethod: 'email_password',
    loginAt: Date.now(),
    sessionRevision: Number(record.sessionRevision || 1),
  };
}

export type AdminAccountSummary = {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  disabled: boolean;
  disabledAt?: number;
};

export async function listUserAccounts(): Promise<AdminAccountSummary[]> {
  if (!isRedisConfigured()) throw new Error('ACCOUNT_STORE_UNAVAILABLE');
  const members = await redisCommand(['SMEMBERS', accountIndexKey()]);
  const keys = Array.isArray(members) ? members.filter((item): item is string => typeof item === 'string') : [];
  if (!keys.length) return [];

  const values = await redisCommand(['MGET', ...keys]);
  const records = (Array.isArray(values) ? values : [])
    .map((value) => decodeAccount(typeof value === 'string' ? value : ''))
    .filter((value): value is AccountRecord => Boolean(value));

  return records
    .map((record) => ({
      id: record.id,
      name: record.name,
      email: record.email,
      createdAt: record.createdAt,
      disabled: Boolean(record.disabledAt),
      ...(record.disabledAt ? { disabledAt: record.disabledAt } : {}),
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

async function findAccountKeyById(userId: string): Promise<string | null> {
  const mapped = await redisCommand(['GET', accountIdKey(userId)]);
  if (typeof mapped === 'string' && mapped) return mapped;

  const members = await redisCommand(['SMEMBERS', accountIndexKey()]);
  const keys = Array.isArray(members) ? members.filter((item): item is string => typeof item === 'string') : [];
  if (!keys.length) return null;
  const values = await redisCommand(['MGET', ...keys]);

  for (let index = 0; index < keys.length; index += 1) {
    const record = decodeAccount(typeof values?.[index] === 'string' ? values[index] : '');
    if (record?.id === userId) {
      await redisCommand(['SET', accountIdKey(userId), keys[index]]);
      return keys[index];
    }
  }
  return null;
}

export async function setUserAccountDisabled(userId: string, disabled: boolean): Promise<AdminAccountSummary> {
  if (!isRedisConfigured()) throw new Error('ACCOUNT_STORE_UNAVAILABLE');
  const key = await findAccountKeyById(userId);
  if (!key) throw new Error('ACCOUNT_NOT_FOUND');

  const record = decodeAccount(await redisCommand(['GET', key]));
  if (!record) throw new Error('ACCOUNT_NOT_FOUND');

  const updated: AccountRecord = {
    ...record,
    ...(disabled ? { disabledAt: Date.now() } : { disabledAt: undefined }),
  };
  await redisCommand(['SET', key, encodeAccount(updated)]);

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    createdAt: updated.createdAt,
    disabled: Boolean(updated.disabledAt),
    ...(updated.disabledAt ? { disabledAt: updated.disabledAt } : {}),
  };
}

function loginAdmin(adminCodeInput: string, password: string): AuthSession {
  const adminCode = adminCodeInput.trim();
  if (!adminCode || adminCode.length > 128 || !password || password.length > 256) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const expected = adminCredentialHash();
  const actual = sha256(`${adminCode}:${password}`);
  if (!safeEqual(actual, expected)) throw new Error('INVALID_CREDENTIALS');

  return {
    id: 'admin-primary',
    name: process.env.ADMIN_DISPLAY_NAME?.trim() || 'مدير النظام',
    personName: process.env.ADMIN_DISPLAY_NAME?.trim() || 'مدير النظام',
    email: process.env.ADMIN_EMAIL?.trim() || 'admin@qada.local',
    nationalId: '',
    role: 'admin',
    agency: process.env.ADMIN_AGENCY?.trim() || 'إدارة أصول القضاء',
    loginMethod: 'admin_password',
    loginAt: Date.now(),
    adminCredentialRevision: adminCredentialRevision(),
  };
}

function clientId(req: any): string {
  const forwarded = req.headers?.['x-forwarded-for'];
  const raw = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded || req.socket?.remoteAddress || 'unknown';
  return String(raw).split(',')[0].trim().slice(0, 120);
}

function authError(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'INVALID_NAME' || code === 'INVALID_EMAIL') return { status: 400, code, error: 'تحقق من الاسم والبريد الإلكتروني ثم أعد المحاولة.' };
  if (code === 'WEAK_PASSWORD') return { status: 400, code, error: 'كلمة المرور يجب أن تكون 10 أحرف على الأقل.' };
  if (code === 'ACCOUNT_EXISTS') return { status: 409, code, error: 'يوجد حساب مسجل بهذا البريد. انتقل إلى تسجيل الدخول.' };
  if (code === 'ACCOUNT_NOT_FOUND') return { status: 401, code, error: 'الحساب غير موجود أو بيانات الدخول غير صحيحة.' };
  if (code === 'ACCOUNT_DISABLED') return { status: 403, code, error: 'الحساب موقوف. راجع إدارة المنصة.' };
  if (code === 'INVALID_CREDENTIALS') return { status: 401, code, error: 'رمز الدخول أو كلمة المرور غير صحيحة.' };
  if (code === 'AUTH_SECRET_MISSING') return { status: 503, code, error: 'خدمة تسجيل الدخول غير مهيأة على الخادم.' };
  if (code === 'DATA_SECRET_MISSING') return { status: 503, code, error: 'خدمة حماية البيانات غير مهيأة على الخادم.' };
  if (code === 'ACCOUNT_STORE_UNAVAILABLE' || code === 'RATE_LIMIT_STORE_UNAVAILABLE' || code.startsWith('REDIS_')) {
    return { status: 503, code, error: 'خدمة الحسابات غير متاحة مؤقتاً. أعد المحاولة بعد قليل.' };
  }
  return { status: 500, code: code || 'AUTH_UNKNOWN', error: 'تعذر إكمال تسجيل الدخول حالياً.' };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    if (String(req.query?.health || '') === '1') {
      let authConfigured = false;
      let adminConfigured = false;
      try {
        rootSecret();
        authConfigured = true;
      } catch {}
      try {
        adminCredentialHash();
        adminConfigured = true;
      } catch {}
      const dataConfigured = Boolean((process.env.DATA_SECRET || '').trim().length >= 32);
      const storeConfigured = isRedisConfigured();
      const adminReady = authConfigured && adminConfigured;
      const userReady = authConfigured && dataConfigured && (storeConfigured || !isProductionRuntime());
      const ready = adminReady && userReady;
      return res.status(ready ? 200 : 503).json({
        ok: ready,
        authConfigured,
        dataConfigured,
        adminConfigured,
        adminReady,
        userReady,
        adminCredentialSource: adminCredentialConfig().source,
        accountStore: storeConfigured ? 'redis' : (isProductionRuntime() ? 'missing' : 'memory-dev'),
        sessionCookie: SESSION_COOKIE,
      });
    }

    const session = await readActiveSession(req.headers?.cookie);
    if (!session) return res.status(401).json({ authenticated: false });
    return res.status(200).json({ authenticated: true, session: clientSession(session) });
  }

  if (req.method === 'DELETE') {
    const current = readSession(req.headers?.cookie);
    res.setHeader('Set-Cookie', [
      expiredCookie(SESSION_COOKIE),
      ...OLD_SESSION_COOKIES.map(expiredCookie),
    ]);
    if (current) {
      await recordAuditEvent({
        actorId: current.id,
        actorRole: current.role,
        action: 'auth.logout',
        outcome: 'success',
      });
    }
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    rootSecret();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = String(body.action || '');

    let rateLimitIdentity = '';
    if (action === 'register' || action === 'user-login' || action === 'admin-login' || action === 'change-password') {
      const accountHint = action === 'admin-login'
        ? String(body.adminCode || '').trim().toLowerCase()
        : normalizeEmail(String(body.email || ''));
      rateLimitIdentity = `${clientId(req)}:${accountHint.slice(0, 180)}`;
      const limit = await enforceRateLimit(`auth:${action}`, rateLimitIdentity, AUTH_ATTEMPT_LIMIT, AUTH_WINDOW_SECONDS);
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retryAfterSeconds));
        return res.status(429).json({
          code: 'RATE_LIMITED',
          error: 'تم إيقاف المحاولات مؤقتاً لحماية الحساب.',
          retryAfterSeconds: limit.retryAfterSeconds,
        });
      }
    }

    if (action === 'change-password') {
      const current = readSession(req.headers?.cookie);
      if (!current) return res.status(401).json({ error: 'AUTH_REQUIRED' });
      if (current.role !== 'user') return res.status(400).json({ error: 'ADMIN_PASSWORD_MANAGED_BY_SERVER' });

      const currentPassword = String(body.currentPassword || '');
      const newPassword = String(body.newPassword || '');
      if (newPassword.length < 10) throw new Error('WEAK_PASSWORD');
      if (currentPassword === newPassword) return res.status(400).json({ error: 'NEW_PASSWORD_MUST_DIFFER' });

      const record = await loadAccount(current.email);
      if (!record || record.disabledAt) throw new Error(record?.disabledAt ? 'ACCOUNT_DISABLED' : 'ACCOUNT_NOT_FOUND');
      if (!safeEqual(passwordHash(currentPassword, record.passwordSalt), record.passwordHash)) {
        throw new Error('INVALID_CREDENTIALS');
      }

      const salt = randomBytes(16).toString('hex');
      const updated: AccountRecord = {
        ...record,
        passwordSalt: salt,
        passwordHash: passwordHash(newPassword, salt),
        sessionRevision: Number(record.sessionRevision || 1) + 1,
      };
      await saveAccount(updated);
      await recordAuditEvent({
        actorId: current.id,
        actorRole: current.role,
        action: 'auth.password-change',
        targetType: 'user',
        targetId: current.id,
        outcome: 'success',
      });

      const refreshedSession: AuthSession = {
        ...current,
        sessionRevision: updated.sessionRevision,
        loginAt: Date.now(),
      };
      res.setHeader('Set-Cookie', cookieForSession(refreshedSession));
      return res.status(200).json({ ok: true, session: clientSession(refreshedSession) });
    }

    let session: AuthSession;

    if (action === 'register') {
      const record = await createAccount(
        String(body.name || ''),
        String(body.email || ''),
        String(body.password || ''),
      );
      session = {
        id: record.id,
        name: record.name,
        personName: record.name,
        email: record.email,
        nationalId: '',
        role: 'user',
        loginMethod: 'email_password',
        loginAt: Date.now(),
        sessionRevision: Number(record.sessionRevision || 1),
      };
    } else if (action === 'user-login') {
      session = await loginUser(
        String(body.email || ''),
        String(body.password || ''),
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

    if (rateLimitIdentity) {
      await clearRateLimit(`auth:${action}`, rateLimitIdentity, AUTH_WINDOW_SECONDS);
    }

    await recordAuditEvent({
      actorId: session.id,
      actorRole: session.role,
      action: action === 'register' ? 'auth.register' : action === 'admin-login' ? 'auth.admin-login' : 'auth.login',
      outcome: 'success',
    });

    return res.status(200).json({ session: clientSession(session) });
  } catch (error) {
    const mapped = authError(error);
    return res.status(mapped.status).json({ error: mapped.error, code: mapped.code });
  }
}
