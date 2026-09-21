import fs from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const adminAnalysis = fs.readFileSync('api/admin-analysis.ts', 'utf8');
const sessionApi = fs.readFileSync('api/session.ts', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');

assert(
  adminAnalysis.includes("import { readSession } from './session.ts';"),
  'admin-analysis must read the active v4 session implementation',
);
assert(
  !adminAnalysis.includes('_auth'),
  'admin-analysis must not import the removed legacy auth module',
);
assert(
  sessionApi.includes("const SESSION_COOKIE = 'qada_session_v4';"),
  'active session cookie must remain qada_session_v4',
);
assert(
  sessionApi.includes("const OLD_SESSION_COOKIES = ['qada_session_v3', 'qada_session_v2'];"),
  'session handler must explicitly clear known legacy cookies',
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
  activeCookie: 'qada_session_v4',
  checkedApiFiles: apiFiles.length,
}, null, 2));
