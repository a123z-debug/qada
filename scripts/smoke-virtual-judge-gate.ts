import fs from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const judges = fs.readFileSync('api/judges-review.ts', 'utf8');

for (const marker of [
  'A. JURISDICTION_AND_STAGE',
  'B. TIMELINE_AND_TEMPORAL_LAW',
  'C. SOURCE_HIERARCHY',
  'D. ELEMENT_TEST',
  'E. EXCEPTION_TEST',
  'F. OPPOSING_PARTY_RED_TEAM',
  'G. CASSATION_BOUNDARY',
  'H. PRECEDENT_TEST',
  'I. REMEDY_TEST',
  'J. CONTRADICTION_TEST',
]) {
  assert(judges.includes(marker), 'virtual judge review stage missing: ' + marker);
}

for (const marker of [
  'gateDecision',
  "'PASS' | 'RETURN' | 'BLOCK'",
  'sourceBlockers',
  'materialErrorCount',
  "serverGate = 'BLOCK'",
  "serverGate = 'PASS'",
  'fact-extraction / retrieval-temporal / legal-analysis / drafting / virtual-judge-gate',
]) {
  assert(judges.includes(marker), 'virtual judge gate invariant missing: ' + marker);
}

assert(
  judges.includes('لا تعيد وزن الأدلة كمحكمة موضوع')
    && judges.includes('الخطأ في تكييف الواقعة')
    && judges.includes('إغفال مستند حاسم'),
  'cassation review must distinguish reweighing evidence from reviewable legal defects',
);

assert(
  judges.includes('ابحث عن الاستثناءات والقيود والموانع')
    && judges.includes('النص الخاص والاستثناء الصريح'),
  'virtual judge must test exceptions and special rules before applying a general rule',
);

assert(
  judges.includes('اختبر هل الأسباب التي بنيت عليها المذكرة تنتج فعلاً الطلب النهائي المطلوب'),
  'virtual judge must test whether the pleaded grounds support the requested remedy',
);

console.log(JSON.stringify({
  ok: true,
  scenario: 'generic administrative cassation quality gate',
  stages: 10,
  gate: ['PASS', 'RETURN', 'BLOCK'],
  piiFixture: false,
}, null, 2));
