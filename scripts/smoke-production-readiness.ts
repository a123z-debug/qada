import fs from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const env = fs.readFileSync('.env.example', 'utf8');
for (const key of ['AUTH_SECRET', 'DATA_SECRET', 'QADA_ADMIN_CREDENTIAL_HASH_V7', 'REDIS_URL', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'QADA_OPEN_TEST_MODE', 'QADA_GUEST_ACCESS']) {
  assert(env.includes(key + '='), '.env.example missing ' + key);
}


const session = fs.readFileSync('api/session.ts', 'utf8');
assert(session.includes("const OPEN_TEST_MODE = process.env.QADA_OPEN_TEST_MODE === 'true';"), 'test access must be explicit and fail closed');
assert(session.includes("const GUEST_ACCESS_ENABLED = process.env.QADA_GUEST_ACCESS === 'true';"), 'guest access must be explicit and fail closed');
assert(session.includes('if (!GUEST_ACCESS_ENABLED)'), 'guest login must reject when not explicitly enabled');

const redis = fs.readFileSync('api/_redis.ts', 'utf8');
assert(redis.includes('process.env.REDIS_URL'), 'Redis adapter must support Railway/native Redis');
assert(redis.includes("from 'node:net'"), 'native Redis adapter must use Node TCP without extra runtime dependency');
assert(redis.includes('UPSTASH_REDIS_REST_URL'), 'Redis adapter must preserve Upstash REST compatibility');

const health = fs.readFileSync('api/health.ts', 'utf8');
assert(health.includes("hasLongSecret('AUTH_SECRET')"), 'health must require AUTH_SECRET');
assert(health.includes("hasLongSecret('DATA_SECRET')"), 'health must require DATA_SECRET');
assert(health.includes('geminiConfigured'), 'health must verify Gemini for multimodal evidence');
assert(health.includes('redisReachable'), 'health must verify Redis reachability');

const server = fs.readFileSync('server.ts', 'utf8');
assert(server.includes("import healthHandler from './api/health';"), 'local server must reuse production health handler');
assert(server.includes("app.get('/api/health'"), 'local health route missing');
assert(server.includes("app.all('/api/cases'"), 'local cases route missing');
assert(server.includes("express.json({ limit: '4mb' })"), 'local JSON payload limit must match serverless design');

const casesApi = fs.readFileSync('api/cases.ts', 'utf8');
assert(casesApi.includes("String(req.query?.workspace || '') === '1'"), 'shared workspace mode missing from cases API');
assert(casesApi.includes("protectJson(state, 'workspace-state')"), 'shared workspace must be encrypted at rest');
assert(casesApi.includes("unprotectJson<SharedWorkspaceState>"), 'shared workspace restore path missing');
assert(casesApi.includes("enforceRateLimit('cases'"), 'shared workspace must remain behind the cases API rate limit');

const apiDir = fs.readdirSync('api').filter((name) => name.endsWith('.ts'));
for (const name of apiDir) {
  const source = fs.readFileSync('api/' + name, 'utf8');
  assert(!source.includes('new Map<string, RateEntry>'), name + ': legacy in-memory rate limiter found');
  assert(
    !/from\s+['"]\.\.?\/[^'"]+\.ts['"]/.test(source),
    name + ': serverless runtime import must use the emitted .js specifier rather than .ts',
  );
}

const srcFiles = [
  'src/App.tsx',
  'src/components/LoginScreen.tsx',
  'src/components/admin/AdminAnalysisRoom.tsx',
  'src/components/admin/AdminAgentMap.tsx',
];
for (const file of srcFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert(!source.includes('qada_account_proofs_v1'), file + ': browser account proof returned');
  assert(!source.includes("localStorage.setItem('qada_admin_agent_runtime"), file + ': admin runtime persisted locally');
  assert(!source.includes("localStorage.setItem('qada_admin_agent_run_history"), file + ': admin run history persisted locally');
}

const app = fs.readFileSync('src/App.tsx', 'utf8');
assert(!app.includes('مركز التحليل متصل:'), 'static connected status must not return');

const boundedAiFiles = [
  'api/chat.ts',
  'api/admin-analysis.ts',
  'api/judges-review.ts',
  'api/convert-story.ts',
];
for (const file of boundedAiFiles) {
  const source = fs.readFileSync(file, 'utf8');
  assert(source.includes("from './_async.js'"), file + ': bounded async helper missing');
  assert(source.includes('withTimeout(') || source.includes('AbortSignal.timeout('), file + ': provider timeout missing');
}
const secureStore = fs.readFileSync('api/_secureStore.ts', 'utf8');
assert(secureStore.includes("process.env.DATA_SECRET"), 'persistent encryption must use DATA_SECRET');
assert(!secureStore.includes('process.env.DATA_SECRET || process.env.AUTH_SECRET'), 'persistent encryption must not fall back to AUTH_SECRET');

console.log(JSON.stringify({ ok: true, apiFilesChecked: apiDir.length, readinessGate: true }, null, 2));