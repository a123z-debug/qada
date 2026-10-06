import {
  assessJudicialEvidenceGraph,
  buildJudicialEvidenceGraphInstruction,
} from '../src/lib/judicialEvidenceGraph.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const sourceContext = [
  'نظام خدمة الأفراد — المادة 16',
  'المصدر الرسمي: هيئة الخبراء بمجلس الوزراء',
].join('\n');

const factContext = [
  'ثبت صرف العلاوة الفنية للمدعي.',
  'مرفق: نموذج صرف المكافأة.pdf',
].join('\n');

const good = assessJudicialEvidenceGraph({
  raw: [{
    requirement: 'ثبوت الممارسة والاستحقاق',
    fact: 'ثبت صرف العلاوة الفنية للمدعي',
    evidence: 'نموذج صرف المكافأة.pdf',
    source: 'نظام خدمة الأفراد — المادة 16',
    effect: 'يستمر فحص شروط الجمع.',
    material: true,
    status: 'SATISFIED',
  }],
  factContext,
  sourceContext,
});

assert(good.complete, 'grounded element should complete the graph');
assert(good.verifiedCount === 1, 'grounded element should stay SATISFIED');
assert(good.blockers.length === 0, 'grounded element should not create blockers');

const hallucinated = assessJudicialEvidenceGraph({
  raw: [{
    requirement: 'استثناء مزعوم',
    fact: 'ثبت صدور قرار خاص بالمدعي',
    evidence: 'قرار سري غير مرفق',
    source: 'قرار مجلس الوزراء رقم 9999',
    effect: 'ينشئ استثناء.',
    material: true,
    status: 'SATISFIED',
  }],
  factContext,
  sourceContext,
});

assert(hallucinated.links[0]?.status === 'UNVERIFIED', 'unsupported SATISFIED must be downgraded');
assert(hallucinated.blockers.length >= 1, 'unsupported material element must block');
assert(hallucinated.materialUnverifiedCount === 1, 'material unverified count mismatch');

const missing = assessJudicialEvidenceGraph({
  raw: [],
  factContext,
  sourceContext,
});
assert(!missing.complete && missing.blockers.length === 1, 'empty graph must fail closed');
assert(buildJudicialEvidenceGraphInstruction().includes('SATISFIED ممنوع'), 'instruction contract missing');

console.log(JSON.stringify({
  ok: true,
  verified: good.verifiedCount,
  blockedHallucination: hallucinated.blockers.length,
  emptyGraphBlocked: missing.blockers.length,
}, null, 2));
