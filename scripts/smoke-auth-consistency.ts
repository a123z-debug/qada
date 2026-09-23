import fs from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const adminAnalysis = fs.readFileSync('api/admin-analysis.ts', 'utf8');
const sessionApi = fs.readFileSync('api/session.ts', 'utf8');
const loginScreen = fs.readFileSync('src/components/LoginScreen.tsx', 'utf8');
const envExample = fs.readFileSync('.env.example', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');

assert(
  adminAnalysis.includes("import { readActiveSession } from './session.js';"),
  'admin-analysis must verify that the account behind the signed session is still active',
);
assert(
  !adminAnalysis.includes('_auth'),
  'admin-analysis must not import the removed legacy auth module',
);
assert(
  sessionApi.includes("const SESSION_COOKIE = 'qada_session_v6';"),
  'active session cookie must remain qada_session_v6',
);
assert(
  sessionApi.includes("const OLD_SESSION_COOKIES = ['qada_session_v5', 'qada_session_v4', 'qada_session_v3', 'qada_session_v2'];"),
  'session handler must explicitly clear known legacy cookies',
);
assert(
  sessionApi.includes('process.env.AUTH_SECRET?.trim()')
    && !sessionApi.includes("process.env.AUTH_SECRET?.trim() || process.env.GEMINI_API_KEY"),
  'authentication secret must be isolated from AI provider keys',
);
assert(
  sessionApi.includes('QADA_ADMIN_CREDENTIAL_HASH_V7')
    && sessionApi.includes('ADMIN_CREDENTIAL_MISSING')
    && !sessionApi.includes('BUILTIN_ADMIN_HASH_V7')
    && sessionApi.includes('adminCredentialRevision'),
  'production admin login must require the versioned v7 environment credential and invalidate stale admin sessions',
);
assert(
  sessionApi.includes('normalizeAdminCredentialHash')
    && sessionApi.includes("replace(/^sha-?256")
    && sessionApi.includes('missing-or-invalid'),
  'admin credential parser must safely normalize quoted/prefixed SHA-256 hashes and expose non-secret readiness diagnostics',
);
assert(
  sessionApi.includes("redisCommand(['SET', key, encoded, 'NX'])"),
  'user registration must persist through the server account store',
);
assert(
  sessionApi.includes("redisCommand(['GET', key])"),
  'user login must load the account from the server store',
);
assert(
  sessionApi.includes('export async function readActiveSession')
    && sessionApi.includes('account.disabledAt'),
  'disabled accounts must invalidate active sessions on protected API requests',
);
assert(
  sessionApi.includes('sessionRevision')
    && sessionApi.includes('accountRevision !== sessionRevision')
    && sessionApi.includes('Number(record.sessionRevision || 1) + 1'),
  'password rotation must invalidate older signed sessions',
);
assert(
  !loginScreen.includes('accountProof')
    && !loginScreen.includes('qada_account_proofs_v1'),
  'browser-bound account proofs must not return',
);
assert(
  loginScreen.includes("action: authMode === 'register' ? 'register' : 'user-login'")
    && loginScreen.includes("credentials: 'include'")
    && loginScreen.includes('إنشاء مستخدم جديد')
    && loginScreen.includes('البريد الإلكتروني')
    && loginScreen.includes('كلمة المرور')
    && !loginScreen.includes("action: 'test-access'")
    && loginScreen.includes('setInterfaceMenuOpen')
    && loginScreen.includes("setAdminOpen(true)"),
  'User access must use email/password registration or login while Admin stays hidden behind the interface chooser',
);
assert(
  !sessionApi.includes("cookies(header)[TEST_MODE_COOKIE]")
    && sessionApi.includes("process.env.QADA_OPEN_TEST_MODE === 'true'")
    && sessionApi.includes("action === 'test-access'")
    && sessionApi.includes("requestedMode === 'admin'")
    && sessionApi.includes("test-${workspaceMode}-${randomBytes(10).toString('hex')}"),
  'direct access must be unique and server-signed and must not mint admin access',
);
assert(
  envExample.includes('REDIS_URL')
    && envExample.includes('UPSTASH_REDIS_REST_URL')
    && envExample.includes('UPSTASH_REDIS_REST_TOKEN'),
  'production persistent store configuration must document Railway/native Redis and Upstash REST',
);
assert(
  server.includes("import sessionHandler from './api/session';")
    && server.includes("app.all('/api/session'"),
  'local runtime must delegate session requests to api/session',
);
assert(
  !fs.existsSync('api/_auth.ts'),
  'legacy api/_auth.ts must not return',
);

const apiFiles = fs.readdirSync('api').filter((name) => name.endsWith('.ts'));
for (const name of apiFiles) {
  const text = fs.readFileSync(`api/${name}`, 'utf8');
  assert(!text.includes("from './_auth"), `${name} still imports legacy auth`);
}

console.log(JSON.stringify({
  ok: true,
  activeCookie: 'qada_session_v6',
  persistentAccounts: true,
  adminCredentialVersion: 'v7',
  userAccess: 'email-password-register-login',
  isolatedAuthSecret: true,
  checkedApiFiles: apiFiles.length,
}, null, 2));
