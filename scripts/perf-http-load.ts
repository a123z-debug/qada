// HTTP load test against a running QADA server (local or staging only).
// Usage: PERF_BASE_URL=http://localhost:3000 tsx scripts/perf-http-load.ts
// Authenticated endpoints are exercised only when the server allows
// `test-access` (QADA_OPEN_TEST_MODE=true), which must never be on in production.
// AI endpoints are intentionally excluded: they hit paid providers.
import { performance } from 'node:perf_hooks';

const BASE_URL = (process.env.PERF_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const CONCURRENCY = Number(process.env.PERF_CONCURRENCY || 20);
const REQUESTS = Number(process.env.PERF_REQUESTS || 500);
const P95_BUDGET_MS = Number(process.env.PERF_HTTP_P95_MS || 200);

if (/vercel\.app|railway\.app/i.test(BASE_URL) && process.env.PERF_ALLOW_REMOTE !== 'true') {
  console.error('Refusing to load-test a deployed host without PERF_ALLOW_REMOTE=true');
  process.exit(2);
}

type Scenario = { name: string; method: 'GET' | 'POST'; path: string; body?: unknown; auth?: boolean; requests?: number; p95BudgetMs?: number };

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

async function login(): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'test-access', workspaceMode: 'simple' }),
  });
  if (!res.ok) return null;
  const cookies = res.headers.getSetCookie?.() || [];
  return cookies.map((cookie) => cookie.split(';')[0]).join('; ') || null;
}

async function run(scenario: Scenario, cookie: string | null) {
  const total = scenario.requests ?? REQUESTS;
  const latencies: number[] = [];
  const statuses = new Map<number, number>();
  let errors = 0;
  let next = 0;
  const started = performance.now();
  async function worker() {
    while (next < total) {
      next += 1;
      const start = performance.now();
      try {
        const res = await fetch(`${BASE_URL}${scenario.path}`, {
          method: scenario.method,
          headers: {
            ...(scenario.body ? { 'content-type': 'application/json' } : {}),
            ...(cookie ? { cookie } : {}),
          },
          body: scenario.body ? JSON.stringify(scenario.body) : undefined,
        });
        await res.arrayBuffer();
        statuses.set(res.status, (statuses.get(res.status) || 0) + 1);
      } catch {
        errors += 1;
      }
      latencies.push(performance.now() - start);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
  const elapsed = (performance.now() - started) / 1000;
  latencies.sort((a, b) => a - b);
  return {
    name: scenario.name,
    n: latencies.length,
    rps: latencies.length / elapsed,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    statuses: Object.fromEntries(statuses),
    errors,
  };
}

const cookie = await login();
console.log(`target=${BASE_URL} concurrency=${CONCURRENCY} auth=${cookie ? 'test-access session' : 'none (authenticated scenarios skipped)'}`);

const scenarios: Scenario[] = [
  { name: 'GET /api/live', method: 'GET', path: '/api/live' },
  { name: 'GET /api/health', method: 'GET', path: '/api/health' },
  { name: 'GET / (index.html)', method: 'GET', path: '/' },
  // The endpoint is rate limited at 90 requests / 10 min per session, so keep
  // this run under the limit to measure latency rather than 429s. The engine is
  // synchronous CPU (~12ms/request), so concurrent requests queue on the event
  // loop; its budget reflects that rather than the light endpoints.
  { name: 'POST /api/legal-source-search', method: 'POST', path: '/api/legal-source-search', auth: true, requests: 80,
    p95BudgetMs: Number(process.env.PERF_SEARCH_P95_MS || 500),
    body: { court: 'administrative', query: 'قرار إداري وتظلم وأريد إلغاء القرار' } },
];

const failures: string[] = [];
for (const scenario of scenarios) {
  if (scenario.auth && !cookie) continue;
  const result = await run(scenario, scenario.auth ? cookie : null);
  console.log(`${result.name}: n=${result.n} rps=${result.rps.toFixed(0)} p50=${result.p50.toFixed(1)}ms p95=${result.p95.toFixed(1)}ms p99=${result.p99.toFixed(1)}ms statuses=${JSON.stringify(result.statuses)} errors=${result.errors}`);
  if (result.errors > 0) failures.push(`${result.name}: ${result.errors} network errors`);
  const budget = scenario.p95BudgetMs ?? P95_BUDGET_MS;
  if (result.p95 > budget) failures.push(`${result.name}: p95 ${result.p95.toFixed(1)}ms > ${budget}ms`);
  const serverErrors = Object.entries(result.statuses).filter(([status]) => Number(status) >= 500 && Number(status) !== 503);
  if (serverErrors.length) failures.push(`${result.name}: 5xx responses ${JSON.stringify(Object.fromEntries(serverErrors))}`);
}

if (failures.length) {
  console.error(`perf-http-load FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('perf-http-load passed');
