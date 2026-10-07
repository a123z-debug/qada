import {
  assessTemporalLaw,
  temporalLawInstruction,
} from '../src/lib/temporalLawGate.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const historical = assessTemporalLaw({
  query: 'أطالب بالمادة 17 عن استحقاق بتاريخ 1438/05/10هـ وبعد تعديل النظام',
  articlePresenceVerified: 1,
  effectiveTextReady: false,
});
assert(historical.status === 'UNRESOLVED', 'historical article application must fail closed without effective text');
assert(historical.blockers.length === 1, 'historical unresolved case must create blocker');
assert(historical.eventDateCandidates.length >= 1, 'historical date must be extracted');

const currentWithoutTemporalIssue = assessTemporalLaw({
  query: 'اشرح المادة 16 من نظام خدمة الأفراد',
  articlePresenceVerified: 1,
  effectiveTextReady: false,
});
assert(currentWithoutTemporalIssue.status === 'NOT_APPLICABLE', 'plain article lookup should not pretend temporal resolution is required');
assert(currentWithoutTemporalIssue.blockers.length === 0, 'plain lookup should warn, not hard-block');

const ready = assessTemporalLaw({
  query: 'ما النص النافذ بتاريخ 2026/01/10م للمادة 4؟',
  articlePresenceVerified: 1,
  effectiveTextReady: true,
});
assert(ready.status === 'READY', 'effective text ready should pass temporal gate');

const noArticle = assessTemporalLaw({
  query: 'وقع القرار بتاريخ 1445/01/01هـ',
  articlePresenceVerified: 0,
  effectiveTextReady: false,
});
assert(noArticle.status === 'NOT_APPLICABLE', 'date alone without legal article material must not trigger article temporal gate');

const instruction = temporalLawInstruction(historical);
assert(instruction.includes('لا تستخدم مجرد وجود المادة'), 'temporal instruction must distinguish presence from effectivity');

console.log(JSON.stringify({
  ok: true,
  historical: historical.status,
  lookup: currentWithoutTemporalIssue.status,
  ready: ready.status,
}, null, 2));
