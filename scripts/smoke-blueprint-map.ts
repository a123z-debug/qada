import fs from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const map = fs.readFileSync('src/components/admin/AdminAgentMap.tsx', 'utf8');

const requiredIds = [
  'auth','search','laws','judgments','references','cases','advisor','settings',
  'document-reader','case-router','src-bog','src-personnel','src-royal','src-precedents',
  'qada-core','facts','jurisdiction','characterization','evidence','reasoning','procedure',
  'official-source','exact-text','amendments','conflicts','final-review','drafting','hujja-bayan','virtual-judge','final-output',
  'editor-tool','execution-tool','evaluation-tool','agents-tool','security-007',
  'admin-entry','judgment-audit','memo-audit','legislative-flaws','judicial-flaws',
  'procedural-flaws','evidence-flaws','reasoning-flaws','rebuttal-review','admin-final'
];

for (const id of requiredIds) {
  assert(map.includes(`id: '${id}'`), 'Blueprint node missing: ' + id);
}

for (const label of [
  'منصة QADA العامة',
  'مستخدمو المنصة',
  'مختبر البيانات والأدلة',
  'محرك التحليل القضائي الذكي',
  'الصياغة والمخرجات',
  'بيئة التشغيل والتحكم',
  'غرفة التحليل الخاصة بالأدمن'
]) {
  assert(map.includes(label), 'Blueprint section missing: ' + label);
}

assert(
  map.includes('صاحب حُجّة وبيان')
    && map.includes("from: 'drafting', to: 'hujja-bayan'")
    && map.includes("from: 'hujja-bayan', to: 'virtual-judge'")
    && map.includes("from: 'virtual-judge', to: 'final-output'"),
  'Drafting must pass through the Virtual Judge before final output',
);
assert(map.includes('Editor') && map.includes('Execution') && map.includes('Evaluation') && map.includes('Agents'),
  'Operations tool row is incomplete');
assert(map.includes('runtimeById') && map.includes('sourcePacketById'),
  'Blueprint must be wired to real runtime/source telemetry');
assert(map.includes("fetch('/api/admin-runs'") && map.includes("fetch('/api/health'"),
  'Blueprint must load central run history and live readiness');
assert(
  map.includes("id: 'security-007'") && map.includes("id: 'security-007', title: '007 — AppSec'") && map.includes("status: 'warning'"),
  '007 must remain visibly warning until authenticated dynamic staging security testing is completed',
);

// One central brain: every agent on the map must be reachable from QADA AI, including the admin room and the virtual court.
const nodesBlock = map.match(/const nodes: AgentNode\[\] = \[([\s\S]*?)\n\];/);
const edgesBlock = map.match(/const edges: Edge\[\] = \[([\s\S]*?)\n\];/);
assert(nodesBlock && edgesBlock, 'Map nodes/edges blocks not found');
const mapIds = Array.from(nodesBlock[1].matchAll(/\bid:\s*'([^']+)'/g)).map((match) => match[1]);
const adjacency = new Map<string, string[]>();
for (const match of edgesBlock[1].matchAll(/from:\s*'([^']+)',\s*to:\s*'([^']+)'/g)) {
  adjacency.set(match[1], [...(adjacency.get(match[1]) || []), match[2]]);
  adjacency.set(match[2], [...(adjacency.get(match[2]) || []), match[1]]);
}
const reached = new Set(['qada-core']);
const queue = ['qada-core'];
while (queue.length) {
  for (const next of adjacency.get(queue.shift() as string) || []) {
    if (!reached.has(next)) {
      reached.add(next);
      queue.push(next);
    }
  }
}
const orphans = mapIds.filter((id) => !reached.has(id));
assert(orphans.length === 0, 'Agents disconnected from the central brain: ' + orphans.join(', '));
assert(map.includes("{ from: 'qada-core', to: 'admin-entry', kind: 'admin' }"), 'Admin room must run through the same central brain');
assert(map.includes("{ from: 'qada-core', to: 'virtual-court', kind: 'court' }"), 'Virtual court must run through the same central brain');
for (const id of ['virtual-court', 'lawyer-facts-references', 'lawyer-gaps', 'lawyer-drafting-advocacy', 'lawyer-statutes', 'lawyer-super', 'lawyer-former-judge', 'judge-agent', 'presiding-judge', 'cassation-judge', 'public-prosecutor']) {
  assert(mapIds.includes(id), 'Virtual court agent missing from the map: ' + id);
}

// The living layer: spreading activation from the core, phase-locked signals, honest real-run state, reduced motion.
for (const marker of [
  "const BRAIN_ORIGIN = 'qada-core'",
  'computeBrainHops',
  'calcMode="linear"',
  'keyPoints={signal.timing.keyPoints}',
  "'qada-map-pulse '",
  'qada-neuron-running',
  'usePrefersReducedMotion',
  'aria-pressed={pulseOn}',
  'strongLink',
]) {
  assert(map.includes(marker), 'Living brain layer missing: ' + marker);
}
assert(map.includes('setInterval') && map.includes("document.visibilityState === 'visible'"), 'Run history must refresh while the room is visible');
const css = fs.readFileSync('src/qada-8k.css', 'utf8');
const livingCss = css.slice(css.indexOf('Living central brain'));
for (const marker of ['@keyframes qada-neuron-fire', '@keyframes qada-neuron-flicker', '@keyframes qada-core-ripple', 'var(--fire-delay', 'var(--fire-strength', '@media (prefers-reduced-motion: reduce)']) {
  assert(livingCss.includes(marker), 'Living brain CSS missing: ' + marker);
}
const animatedProps = Array.from(livingCss.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)).map((match) => match[1]).join('\n');
assert(!/\b(?:width|height|top|left|box-shadow|filter)\s*:/.test(animatedProps), 'Living brain keyframes must animate only opacity/transform');

console.log(JSON.stringify({ ok: true, nodes: requiredIds.length, mapAgents: mapIds.length, connectedToCore: reached.size, canonicalBlueprint: true }, null, 2));
