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
  adminAnalysis.includes("import { readActiveSession } from './session.ts';"),
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
  sessionApi.includes('QADA_ADMIN_CREDENTIAL_HASH_V6')
    && sessionApi.includes('BUILTIN_ADMIN_HASH_V6')
    && sessionApi.includes('adminCredentialRevision'),
  'admin login must use the versioned v6 credential path and invalidate stale admin sessions',
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
  loginScreen.includes('qada_test_mode=')
    && loginScreen.includes("mode: 'simple'")
    && loginScreen.includes("mode: 'professional'")
    && loginScreen.includes("mode: 'admin'")
    && loginScreen.includes('onLoginSuccess(session)'),
  'test portal must expose direct Simple, Professional, and Admin access through the browser test-mode cookie without API dependency',
);
assert(
  !loginScreen.includes('type="password"')
    && !loginScreen.includes('كلمة المرور'),
  'temporary test portal must not expose password fields',
);
assert(
  sessionApi.includes("const TEST_MODE_COOKIE = 'qada_test_mode'")
    && sessionApi.includes("mode === 'simple' || mode === 'professional' || mode === 'admin'")
    && sessionApi.includes("loginMethod: 'test_open'"),
  'server session must recognize role-aware passwordless test sessions from the test-mode cookie',
);
assert(
  envExample.includes('UPSTASH_REDIS_REST_URL')
    && envExample.includes('UPSTASH_REDIS_REST_TOKEN'),
  'production persistent store configuration must be documented',
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
  adminCredentialVersion: 'v6',
  temporaryOpenTestAccess: true,
  isolatedAuthSecret: true,
  checkedApiFiles: apiFiles.length,
}, null, 2));
