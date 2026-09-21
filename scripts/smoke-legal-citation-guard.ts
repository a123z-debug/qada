import { guardIntroducedLegalCitations } from '../src/lib/legalCitationGuard.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const preserved = guardIntroducedLegalCitations(
  'أتمسك بالمادة (8) من النظام.',
  'أتمسك بالمادة (8) من النظام مع تحسين الصياغة.',
  '',
);
assert(!preserved.blocked, 'citation already present in original text must not be blocked');

const invented = guardIntroducedLegalCitations(
  'هذه مذكرة لا تتضمن رقم مادة.',
  'تستند المذكرة إلى المادة (999) وإلى الوقائع المبينة.',
  'المصدر الرسمي المتاح لا يتضمن هذه المادة.',
);
assert(invented.blocked, 'new unsupported article must be blocked');
assert(invented.unsupportedMarkers.some((item) => item.includes('999')), 'unsupported marker should be reported');

const supported = guardIntroducedLegalCitations(
  'هذه مذكرة لا تتضمن رقم مادة.',
  'يحتاج الأمر إلى مراجعة المادة (60).',
  'تم التحقق من وجود المادة (60) في المصدر الرسمي المفهرس.',
);
assert(!supported.blocked, 'new citation present in verified context should be allowed');

const decree = guardIntroducedLegalCitations(
  'النص الأصلي بلا مرسوم.',
  'صدر بموجب مرسوم ملكي رقم م/3.',
  'المصدر الرسمي يتضمن مرسوم ملكي رقم م/3.',
);
assert(!decree.blocked, 'verified royal decree marker should be allowed');

console.log(JSON.stringify({
  ok: true,
  preserved,
  invented,
  supported,
  decree,
}, null, 2));
