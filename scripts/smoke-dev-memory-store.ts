import { isRedisConfigured, redisCommand, redisPipeline } from '../api/_redis';
import { enforceRateLimit } from '../api/_rateLimit';
import { listSentinelEvents, recordSentinelTurn } from '../api/_sentinel';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// REDIS_URL=memory:// يشغّل المنصة كاملة على الجهاز بلا Redis (الحسابات، القضايا، Sentinel، سجل التدقيق)،
// ويجب أن يُرفض على Vercel وRailway حتى لا تضيع الحسابات والقضايا بصمت.
const HOSTED_ENV = ['VERCEL', 'VERCEL_ENV', 'RAILWAY_ENVIRONMENT', 'RAILWAY_ENVIRONMENT_NAME', 'RAILWAY_PROJECT_ID'];
for (const name of HOSTED_ENV) delete process.env[name];
process.env.REDIS_URL = 'memory://';
if ((process.env.DATA_SECRET || '').trim().length < 32) process.env.DATA_SECRET = 'local-memory-store-smoke-secret-0123456789';

assert(isRedisConfigured(), 'REDIS_URL=memory:// must enable the local store');
assert(await redisCommand(['PING']) === 'PONG', 'PING must answer PONG');

// النصوص: الحسابات والقضايا.
assert(await redisCommand(['SET', 'smoke:a', 'one']) === 'OK', 'SET must answer OK');
assert(await redisCommand(['SET', 'smoke:a', 'two', 'NX']) === null, 'SET NX must refuse an existing key (duplicate registration)');
assert(await redisCommand(['GET', 'smoke:a']) === 'one', 'GET must return the stored value');
const mget = await redisCommand(['MGET', 'smoke:a', 'smoke:missing']);
assert(mget[0] === 'one' && mget[1] === null, 'MGET must keep positions and return null for missing keys');
assert(await redisCommand(['DEL', 'smoke:a', 'smoke:missing']) === 1, 'DEL must count existing keys only');
assert(await redisCommand(['GET', 'smoke:a']) === null, 'a deleted key must be gone');

// المجموعات: فهارس الحسابات والقضايا.
assert(await redisCommand(['SADD', 'smoke:set', 'x', 'y', 'x']) === 2, 'SADD must count new members only');
assert(await redisCommand(['SREM', 'smoke:set', 'x', 'z']) === 1, 'SREM must count removed members only');
const members = await redisCommand(['SMEMBERS', 'smoke:set']);
assert(Array.isArray(members) && members.join(',') === 'y', 'SMEMBERS must list the remaining members');

// القوائم: Sentinel وسجل التدقيق وتشغيلات الإدارة — الأحدث أولاً، والقص يحفظ السقف.
for (let index = 1; index <= 5; index += 1) await redisCommand(['LPUSH', 'smoke:list', `e${index}`]);
await redisCommand(['LTRIM', 'smoke:list', 0, 2]);
const recent = await redisCommand(['LRANGE', 'smoke:list', 0, -1]);
assert(recent.join(',') === 'e5,e4,e3', `LPUSH/LTRIM/LRANGE must keep the newest entries first, got ${recent.join(',')}`);

let wrongType = '';
try { await redisCommand(['GET', 'smoke:list']); } catch (error) { wrongType = String(error); }
assert(wrongType.includes('WRONGTYPE'), 'reading a list as a string must fail like Redis');

let unsupported = '';
try { await redisCommand(['FLUSHALL']); } catch (error) { unsupported = String(error); }
assert(unsupported.includes('does not support FLUSHALL'), 'unsupported commands must fail loudly');

// حدود المحاولات تمر عبر المخزن نفسه.
const [count, expire] = await redisPipeline([['INCR', 'smoke:rate'], ['EXPIRE', 'smoke:rate', 60]]);
assert(count === 1 && expire === 1, 'the INCR/EXPIRE pipeline must work');
const limits = [];
for (let index = 0; index < 3; index += 1) limits.push(await enforceRateLimit('memory-smoke', 'user', 2, 3600));
assert(limits.map((item) => item.allowed).join(',') === 'true,true,false' && limits[0].backend === 'redis', 'rate limits must count through the store');

// Sentinel من الطرف إلى الطرف: ما تقرؤه صفحة الإدارة هو ما سجّلته المحادثة.
const event = await recordSentinelTurn({
  sessionId: 'memory-smoke',
  responseMode: 'simple',
  lastUserText: 'وش ناقص؟',
  conversationText: 'وش ناقص؟',
  reply: 'بوابة الاعتماد: BLOCK ودرجة الجاهزية 72',
});
assert(event, 'Sentinel must record a turn when the memory store is on');
const events = await listSentinelEvents(10);
assert(events.length === 1 && events[0].id === event.id && events[0].status === 'flagged', 'Sentinel must read back the recorded turn');

for (const name of HOSTED_ENV) {
  process.env[name] = name === 'VERCEL' ? '1' : 'production';
  assert(!isRedisConfigured(), `${name} must refuse REDIS_URL=memory://`);
  delete process.env[name];
}

console.log('Dev memory store smoke passed: accounts, cases, Sentinel, audit lists and rate limits work locally; hosted runtimes refuse it.');
