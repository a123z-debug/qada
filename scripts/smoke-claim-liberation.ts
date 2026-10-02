import fs from 'node:fs';
import { assessClaimLiberation } from '../src/lib/claimLiberationGate';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const valid = `
صحيفة دعوى

أولاً: البيانات
المدعي: صاحب الشأن، بصفته صاحب الحق محل المطالبة.
المدعى عليه: الجهة المدعى عليها بصفتها النظامية.
المحكمة: المحكمة المختصة وفق بيانات الملف.

ثانياً: الوقائع
صدر القرار محل النزاع ثم بلغ به المدعي، وتقدم بطلبه إلى الجهة، واستمر الرفض رغم تمسكه بحقه والمستندات المقدمة في ملف القضية.

ثالثاً: المستندات
1. القرار محل الدعوى — يثبت الإجراء محل النزاع.
2. خطاب التظلم — يثبت مطالبة المدعي وموقف الجهة.

رابعاً: الطلبات
أطلب الحكم بإلغاء القرار محل الدعوى وإلزام الجهة بما يترتب على ذلك وفق ما يثبت من الملف.
`;

const good = assessClaimLiberation({ draft: valid, task: 'claim' });
assert(good.applicable, 'claim gate must apply to claim task');
assert(good.complete, 'fully liberated claim must pass deterministic gate');
assert(good.missingPillars.length === 0, 'valid claim must have no missing pillars');

for (const pillar of ['البيانات', 'الوقائع', 'المستندات', 'الطلبات'] as const) {
  const stripped = valid.replace(new RegExp(`(?:أولاً|ثانياً|ثالثاً|رابعاً): ${pillar}[\\s\\S]*?(?=\\n(?:أولاً|ثانياً|ثالثاً|رابعاً):|$)`), '');
  const assessment = assessClaimLiberation({ draft: stripped, task: 'claim' });
  assert(!assessment.complete, 'claim missing ' + pillar + ' must not pass');
  assert(assessment.missingPillars.includes(pillar), 'missing pillar must be named: ' + pillar);
}

const wrongOrder = `
أولاً: البيانات
المدعي: شخص، والمدعى عليه: جهة، والمحكمة: المحكمة المختصة.
ثانياً: الوقائع
هذه وقائع مفصلة بما يكفي لتحرير أصل النزاع وتسلسله وبيان سبب اللجوء إلى القضاء دون افتراض.
ثالثاً: الطلبات
أطلب الحكم بإلغاء القرار محل الدعوى وإلزام الجهة بما يترتب عليه.
رابعاً: المستندات
القرار محل الدعوى يثبت الواقعة الأساسية.
`;
const badOrder = assessClaimLiberation({ draft: wrongOrder, task: 'claim' });
assert(!badOrder.complete && !badOrder.sectionOrderValid, 'wrong pillar order must block claim');

const placeholder = valid.replace(
  'المدعي: صاحب الشأن، بصفته صاحب الحق محل المطالبة.\nالمدعى عليه: الجهة المدعى عليها بصفتها النظامية.\nالمحكمة: المحكمة المختصة وفق بيانات الملف.',
  'يحتاج استكمال.'
);
const placeholderResult = assessClaimLiberation({ draft: placeholder, task: 'claim' });
assert(!placeholderResult.complete && placeholderResult.missingPillars.includes('البيانات'), 'placeholder data must not count as liberation');

const noDocsButDisclosed = valid.replace(
  '1. القرار محل الدعوى — يثبت الإجراء محل النزاع.\n2. خطاب التظلم — يثبت مطالبة المدعي وموقف الجهة.',
  'لا توجد مستندات مقدمة حتى الآن، ويلزم من المستخدم إرفاق الدليل قبل الاعتماد النهائي.'
);
const disclosed = assessClaimLiberation({ draft: noDocsButDisclosed, task: 'claim' });
assert(!disclosed.missingPillars.includes('المستندات'), 'explicit absence of documents must be disclosed rather than fabricated');

const nonClaim = assessClaimLiberation({
  draft: 'مذكرة رد\nالوقائع: كذا\nالطلبات: رفض الطلب.',
  task: 'reply',
});
assert(!nonClaim.applicable && nonClaim.complete, 'claim liberation must not block non-claim documents');

for (let index = 0; index < 1000; index += 1) {
  const city = ['خميس مشيط', 'أبها', 'الرياض', 'جدة', 'الدمام'][index % 5];
  const draft = valid.replace('المحكمة المختصة وفق بيانات الملف', `محكمة ${city} المختصة وفق بيانات الملف`);
  const assessment = assessClaimLiberation({ draft, task: 'claim' });
  assert(assessment.complete, 'valid claim liberation regressed at iteration ' + index);
}

const hujja = fs.readFileSync('src/lib/hujjaBayanAgent.ts', 'utf8');
const gate = fs.readFileSync('api/_draftReleaseGate.ts', 'utf8');
const judges = fs.readFileSync('api/judges-review.ts', 'utf8');
const sentinel = fs.readFileSync('api/_sentinel.ts', 'utf8');

for (const label of ['أولاً: البيانات', 'ثانياً: الوقائع', 'ثالثاً: المستندات', 'رابعاً: الطلبات']) {
  assert(hujja.includes(label), 'Hujja must know claim pillar: ' + label);
}
assert(gate.includes('assessClaimLiberation') && gate.includes('الدعوى غير محررة'), 'release gate must deterministically block unliberated claims');
assert(judges.includes('K. CLAIM_LIBERATION_TEST') && judges.includes('claimLiberationBlockers'), 'virtual judge must enforce claim liberation');
assert(sentinel.includes("code: 'UNLIBERATED_CLAIM'") && sentinel.includes("severity: 'P0'"), 'Sentinel must raise P0 on unliberated claims');

console.log(JSON.stringify({
  ok: true,
  pillars: ['البيانات', 'الوقائع', 'المستندات', 'الطلبات'],
  deterministicPassCases: 1001,
  missingPillarCases: 4,
  orderGate: true,
  placeholderGate: true,
  sentinelSeverity: 'P0',
}, null, 2));
