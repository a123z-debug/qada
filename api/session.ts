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
import { enforceRateLimit } from './_rateLimit.ts';
import { protectJson, unprotectJson } from './_secureStore.ts';

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
  disabledAt?: number;
};

const SESSION_COOKIE = 'qada_session_v5';
const OLD_SESSION_COOKIES = ['qada_session_v4', 'qada_session_v3', 'qada_session_v2'];
const SESSION_MAX_AGE = 12 * 60 * 60;
const PBKDF2_ITERATIONS = 310_000;
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
  return createHash('sha256').update(`qada-session-v5:${explicit}`).digest();
}

function adminCredentialHash() {
  const configured = process.env.QADA_ADMIN_CREDENTIAL_HASH_V4?.trim();
  if (!configured || !/^[a-f0-9]{64}$/i.test(configured)) {
    throw new Error('ADMIN_CREDENTIAL_NOT_CONFIGURED');
  }
  return configured.toLowerCase();
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
  return encryptJson(payload, 'session', 'v5');
}

export function readSession(header?: string | string[]): AuthSession | null {
  try {
    const token = cookies(header)[SESSION_COOKIE];
    if (!token) return null;
    const payload = decryptJson<SessionPayload>(token, 'session', 'v5');
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
  const expected = adminCredentialHash();
  const actual = sha256(`${adminCodeInput.trim()}:${password}`);
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
  if (code === 'INVALID_NAME' || code === 'INVALID_EMAIL') return { status: 400, error: 'بيانات التسجيل غير صحيحة.' };
  if (code === 'WEAK_PASSWORD') return { status: 400, error: 'كلمة المرور يجب أن تكون 10 أحرف على الأقل.' };
  if (code === 'ACCOUNT_EXISTS') return { status: 409, error: 'يوجد حساب مسجل بهذا البريد.' };
  if (code === 'ACCOUNT_NOT_FOUND') return { status: 401, error: 'الحساب غير موجود أو بيانات الدخول غير صحيحة.' };
  if (code === 'ACCOUNT_DISABLED') return { status: 403, error: 'الحساب موقوف. راجع إدارة المنصة.' };
  if (code === 'INVALID_CREDENTIALS') return { status: 401, error: 'بيانات الدخول غير صحيحة.' };
  if (code === 'AUTH_SECRET_MISSING') return { status: 503, error: 'AUTH_SECRET غير مضبوط أو أقصر من الحد المطلوب.' };
  if (code === 'ADMIN_CREDENTIAL_NOT_CONFIGURED') return { status: 503, error: 'بيانات اعتماد الإدارة غير مضبوطة على الخادم.' };
  if (code === 'ACCOUNT_STORE_UNAVAILABLE' || code === 'RATE_LIMIT_STORE_UNAVAILABLE' || code.startsWith('REDIS_')) {
    return { status: 503, error: 'مخزن الحسابات والحماية الموزعة غير متاح.' };
  }
  return { status: 500, error: 'تعذر إكمال عملية المصادقة.' };
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
      const storeConfigured = isRedisConfigured();
      const ready = authConfigured && adminConfigured && (storeConfigured || !isProductionRuntime());
      return res.status(ready ? 200 : 503).json({
        ok: ready,
        authConfigured,
        adminConfigured,
        accountStore: storeConfigured ? 'redis' : (isProductionRuntime() ? 'missing' : 'memory-dev'),
        sessionCookie: SESSION_COOKIE,
      });
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
    rootSecret();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'register' || action === 'user-login' || action === 'admin-login') {
      const limit = await enforceRateLimit(`auth:${action}`, clientId(req), 10, 15 * 60);
      if (!limit.allowed) {
        res.setHeader('Retry-After', String(limit.retryAfterSeconds));
        return res.status(429).json({ error: 'محاولات كثيرة. حاول مرة أخرى لاحقاً.' });
      }
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

    return res.status(200).json({ session });
  } catch (error) {
    const mapped = authError(error);
    return res.status(mapped.status).json({ error: mapped.error });
  }
}
