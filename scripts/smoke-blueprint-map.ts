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

console.log(JSON.stringify({ ok: true, nodes: requiredIds.length, canonicalBlueprint: true }, null, 2));
