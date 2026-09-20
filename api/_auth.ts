import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  pbkdf2Sync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

export type SessionRole = 'admin' | 'user';

export interface AuthSession {
  id: string;
  name: string;
  personName: string;
  email: string;
  nationalId: string;
  role: SessionRole;
  agency?: string;
  loginMethod: 'admin_password' | 'email_password';
  loginAt: number;
}

interface SessionTokenPayload extends AuthSession {
  iat: number;
  exp: number;
}

interface AccountRecord {
  version: 1;
  name: string;
  nationalId?: string;
  email: string;
  passwordSalt: string;
  passwordHash: string;
  createdAt: number;
}

const SESSION_COOKIE = 'qada_session_v3';
const LEGACY_SESSION_COOKIE = 'qada_session_v2';
const SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;
const PBKDF2_ITERATIONS = 210_000;

// Bootstrap secrets are stored only as one-way hashes. Override with env vars when desired.
const DEFAULT_ADMIN_CREDENTIAL_HASH =
  '64276b52c8fa0a61a5013287af54cda44c9d6e705a6f966b9c4e7fb1ccc6d960';

function base64UrlEncode(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function base64UrlDecode(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function hashHex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeEqualText(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  return aBuffer.length === bBuffer.length && timingSafeEqual(aBuffer, bBuffer);
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function getRootSecret(): Buffer {
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured) return createHash('sha256').update(configured).digest();

  // Compatibility fallback for the current deployment. AUTH_SECRET should be set explicitly.
  const fallback = process.env.GEMINI_API_KEY?.trim();
  if (fallback) {
    return createHash('sha256').update(`qada-auth-v2:${fallback}`).digest();
  }

  throw new Error('AUTH_SECRET is not configured.');
}

function deriveKey(purpose: string): Buffer {
  return createHmac('sha256', getRootSecret()).update(purpose).digest();
}

function parseCookies(cookieHeader?: string | string[]): Record<string, string> {
  const raw = Array.isArray(cookieHeader) ? cookieHeader.join(';') : cookieHeader || '';
  return raw.split(';').reduce<Record<string, string>>((acc, item) => {
    const index = item.indexOf('=');
    if (index <= 0) return acc;
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    if (key) acc[key] = value;
    return acc;
  }, {});
}

function publicSession(payload: SessionTokenPayload): AuthSession {
  const { iat: _iat, exp: _exp, ...session } = payload;
  return session;
}

export function createSessionToken(session: AuthSession): string {
  const now = Date.now();
  const payload: SessionTokenPayload = {
    ...session,
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS * 1000,
  };

  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey('session-encryption'), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    'v3',
    base64UrlEncode(iv),
    base64UrlEncode(tag),
    base64UrlEncode(encrypted),
  ].join('.');
}

export function readSession(cookieHeader?: string | string[]): AuthSession | null {
  try {
    const token = parseCookies(cookieHeader)[SESSION_COOKIE];
    if (!token) return null;

    const [version, ivPart, tagPart, encryptedPart] = token.split('.');
    if (version !== 'v3' || !ivPart || !tagPart || !encryptedPart) return null;

    const decipher = createDecipheriv(
      'aes-256-gcm',
      deriveKey('session-encryption'),
      base64UrlDecode(ivPart),
    );
    decipher.setAuthTag(base64UrlDecode(tagPart));

    const decrypted = Buffer.concat([
      decipher.update(base64UrlDecode(encryptedPart)),
      decipher.final(),
    ]);

    const payload = JSON.parse(decrypted.toString('utf8')) as SessionTokenPayload;
    if (!payload?.id || !payload?.email || !payload?.role || payload.exp <= Date.now()) return null;
    return publicSession(payload);
  } catch {
    return null;
  }
}

export function sessionCookie(session: AuthSession): string {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const parts = [
    `${SESSION_COOKIE}=${createSessionToken(session)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function expiredCookie(name: string): string {
  const secure = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const parts = [
    `${name}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie(): string {
  return expiredCookie(SESSION_COOKIE);
}

export function clearLegacySessionCookie(): string {
  return expiredCookie(LEGACY_SESSION_COOKIE);
}

function encryptAccount(record: AccountRecord): string {
  const key = deriveKey('account-proof-encryption');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(record), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return ['v1', base64UrlEncode(iv), base64UrlEncode(tag), base64UrlEncode(encrypted)].join('.');
}

function decryptAccount(accountProof: string): AccountRecord | null {
  try {
    const [version, ivPart, tagPart, encryptedPart] = accountProof.split('.');
    if (version !== 'v1' || !ivPart || !tagPart || !encryptedPart) return null;

    const decipher = createDecipheriv(
      'aes-256-gcm',
      deriveKey('account-proof-encryption'),
      base64UrlDecode(ivPart),
    );
    decipher.setAuthTag(base64UrlDecode(tagPart));
    const decrypted = Buffer.concat([
      decipher.update(base64UrlDecode(encryptedPart)),
      decipher.final(),
    ]);

    const parsed = JSON.parse(decrypted.toString('utf8')) as AccountRecord;
    return parsed?.version === 1 ? parsed : null;
  } catch {
    return null;
  }
}

function passwordHash(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
}

function createUserSession(record: AccountRecord): AuthSession {
  const stableId = hashHex(record.email).slice(0, 20);
  return {
    id: `user-${stableId}`,
    name: record.name,
    personName: record.name,
    nationalId: record.nationalId || '',
    email: record.email,
    role: 'user',
    loginMethod: 'email_password',
    loginAt: Date.now(),
  };
}

export function registerAccount(input: {
  name: string;
  email: string;
  password: string;
}): { session: AuthSession; accountProof: string } {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (name.length < 3) throw new Error('INVALID_NAME');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('INVALID_EMAIL');
  if (password.length < 10) throw new Error('WEAK_PASSWORD');

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
    session: createUserSession(record),
    accountProof: encryptAccount(record),
  };
}

export function loginAccount(input: {
  email: string;
  password: string;
  accountProof: string;
}): AuthSession {
  const record = decryptAccount(input.accountProof);
  if (!record) throw new Error('INVALID_ACCOUNT_PROOF');

  const email = normalizeEmail(input.email);
  if (!safeEqualText(email, record.email)) throw new Error('INVALID_CREDENTIALS');

  const actual = passwordHash(input.password, record.passwordSalt);
  if (!safeEqualText(actual, record.passwordHash)) throw new Error('INVALID_CREDENTIALS');

  return createUserSession(record);
}

export function loginAdmin(input: { adminCode: string; password: string }): AuthSession {
  const expected =
    process.env.ADMIN_CREDENTIAL_HASH?.trim() || DEFAULT_ADMIN_CREDENTIAL_HASH;
  const actual = hashHex(`${input.adminCode.trim()}:${input.password}`);
  if (!safeEqualText(actual, expected)) throw new Error('INVALID_CREDENTIALS');

  return {
    id: 'admin-primary',
    name: process.env.ADMIN_DISPLAY_NAME?.trim() || 'مدير النظام',
    personName: process.env.ADMIN_DISPLAY_NAME?.trim() || 'مدير النظام',
    nationalId: '',
    email: process.env.ADMIN_EMAIL?.trim() || 'admin@qada.local',
    role: 'admin',
    agency: process.env.ADMIN_AGENCY?.trim() || 'إدارة أصول القضاء',
    loginMethod: 'admin_password',
    loginAt: Date.now(),
  };
}

export function authErrorMessage(error: unknown): { status: number; error: string } {
  const code = error instanceof Error ? error.message : '';
  if (code === 'WEAK_PASSWORD') return { status: 400, error: 'كلمة المرور يجب أن تكون 10 أحرف على الأقل.' };
  if (code === 'INVALID_NAME' || code === 'INVALID_EMAIL') {
    return { status: 400, error: 'بيانات التسجيل غير صحيحة.' };
  }
  if (code === 'INVALID_ACCOUNT_PROOF') {
    return { status: 401, error: 'بيانات هذا الحساب غير موجودة في هذا المتصفح. أعد إنشاء الحساب على هذا الجهاز.' };
  }
  if (code === 'INVALID_CREDENTIALS') return { status: 401, error: 'بيانات الدخول غير صحيحة.' };
  if (code.includes('AUTH_SECRET')) return { status: 503, error: 'إعداد المصادقة على الخادم غير مكتمل.' };
  return { status: 500, error: 'تعذر إكمال عملية المصادقة.' };
}
