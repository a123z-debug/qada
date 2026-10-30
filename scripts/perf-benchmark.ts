// In-process performance benchmark for the deterministic legal-source engine
// and the production bundle. Budgets are deliberately generous so CI noise does
// not flake; tighten them only from measured baselines.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';
import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.js';

const ENGINE_P95_BUDGET_MS = Number(process.env.PERF_ENGINE_P95_MS || 25);
const MAIN_CHUNK_GZIP_BUDGET_KB = Number(process.env.PERF_MAIN_GZIP_KB || 120);
const TOTAL_JS_GZIP_BUDGET_KB = Number(process.env.PERF_TOTAL_JS_GZIP_KB || 400);
const ITERATIONS = Number(process.env.PERF_ITERATIONS || 2000);

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

const QUERIES = [
  'ديوان المظالم القضاء الإداري نظام المرافعات أمام ديوان المظالم\nقرار إداري وتظلم وأريد إلغاء القرار',
  'المحاكم العامة نظام القضاء نظام المرافعات الشرعية نظام الإثبات\nدعوى مطالبة مالية',
  'المحاكم الجزائية نظام الإجراءات الجزائية نظام الإثبات\nإيقاف وتفتيش',
  'فرد عسكري وزارة الدفاع نظام خدمة الأفراد علاوة فنية واستحقاق',
  'أمر ملكي مرسوم تعديل سريان المادة 8',
  'x'.repeat(4000),
  '',
];

const failures: string[] = [];

// Engine latency
for (let i = 0; i < 50; i += 1) runLegalSourceAgents(QUERIES[i % QUERIES.length]);
const samples: number[] = [];
for (let i = 0; i < ITERATIONS; i += 1) {
  const query = `${QUERIES[i % QUERIES.length]} ${i}`;
  const start = performance.now();
  runLegalSourceAgents(query);
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
const engine = {
  iterations: ITERATIONS,
  p50: percentile(samples, 50),
  p95: percentile(samples, 95),
  p99: percentile(samples, 99),
  max: samples[samples.length - 1],
};
console.log(`engine runLegalSourceAgents: n=${engine.iterations} p50=${engine.p50.toFixed(2)}ms p95=${engine.p95.toFixed(2)}ms p99=${engine.p99.toFixed(2)}ms max=${engine.max.toFixed(2)}ms`);
if (engine.p95 > ENGINE_P95_BUDGET_MS) failures.push(`engine p95 ${engine.p95.toFixed(2)}ms > budget ${ENGINE_P95_BUDGET_MS}ms`);

// Bundle size
const assetsDir = path.join(process.cwd(), 'dist', 'assets');
if (!existsSync(assetsDir)) {
  console.log('bundle: dist/assets not found — run `vite build` first; bundle budget skipped');
} else {
  const js = readdirSync(assetsDir).filter((file) => file.endsWith('.js'));
  const sizes = js.map((file) => {
    const content = readFileSync(path.join(assetsDir, file));
    return { file, raw: statSync(path.join(assetsDir, file)).size, gzip: gzipSync(content).length };
  }).sort((a, b) => b.gzip - a.gzip);
  const totalGzipKb = sizes.reduce((sum, item) => sum + item.gzip, 0) / 1024;
  const main = sizes.find((item) => item.file.startsWith('index-'));
  const mainGzipKb = (main?.gzip || 0) / 1024;
  console.log(`bundle: ${js.length} js chunks, total gzip=${totalGzipKb.toFixed(1)}KB, main=${main?.file} gzip=${mainGzipKb.toFixed(1)}KB`);
  for (const item of sizes.slice(0, 5)) console.log(`  ${item.file} raw=${(item.raw / 1024).toFixed(1)}KB gzip=${(item.gzip / 1024).toFixed(1)}KB`);
  if (mainGzipKb > MAIN_CHUNK_GZIP_BUDGET_KB) failures.push(`main chunk gzip ${mainGzipKb.toFixed(1)}KB > budget ${MAIN_CHUNK_GZIP_BUDGET_KB}KB`);
  if (totalGzipKb > TOTAL_JS_GZIP_BUDGET_KB) failures.push(`total js gzip ${totalGzipKb.toFixed(1)}KB > budget ${TOTAL_JS_GZIP_BUDGET_KB}KB`);
}

if (failures.length) {
  console.error(`perf-benchmark FAILED:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('perf-benchmark passed');
