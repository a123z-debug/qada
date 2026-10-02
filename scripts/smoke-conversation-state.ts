import {
  buildConversationStateInstruction,
  isLikelyContinuationAnswer,
  latestUserTurnText,
  shouldActivateDrafting,
} from '../src/lib/conversationState.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const regression = [
  { role: 'user', content: 'أبي تجهز لي صحيفة دعوى بعد ما أعطيك البيانات' },
  { role: 'assistant', content: 'تمام. وش اسم المحكمة المختصة أو المحكمة اللي عندك؟' },
  { role: 'user', content: 'محكمة خميس مشيط' },
];

assert(latestUserTurnText(regression) === 'محكمة خميس مشيط', 'latest user turn extraction failed');
assert(isLikelyContinuationAnswer(regression), 'court-name answer must be treated as conversation continuation');
assert(!shouldActivateDrafting(regression), 'court-name answer must never reactivate stale drafting intent');
assert(
  buildConversationStateInstruction(regression).includes('إجابة استكمال لسؤال سابق'),
  'continuation state instruction missing',
);

assert(
  shouldActivateDrafting([
    { role: 'user', content: 'أبي تجهز لي صحيفة دعوى' },
    { role: 'assistant', content: 'أرسل الوقائع أولاً' },
    { role: 'user', content: 'كمل الصياغة الآن' },
  ]),
  'explicit continuation command should reactivate a prior drafting request',
);

assert(
  shouldActivateDrafting([{ role: 'user', content: 'اكتب لي صحيفة دعوى مطالبة مالية' }]),
  'explicit current drafting request must activate drafting',
);

for (const courtAnswer of [
  'محكمة الاستئناف الإدارية',
  'المحكمة الإدارية العليا',
  'المحكمة العليا',
  'محكمة الاستئناف',
  'المحكمة الجزائية',
  'المحكمة العامة',
]) {
  const messages = [
    { role: 'user', content: 'أريد صحيفة دعوى' },
    { role: 'assistant', content: 'ما اسم المحكمة؟' },
    { role: 'user', content: courtAnswer },
  ];
  assert(isLikelyContinuationAnswer(messages), `court answer must remain continuation: ${courtAnswer}`);
  assert(!shouldActivateDrafting(messages), `court answer must not become drafting request: ${courtAnswer}`);
}

const fieldValues = [
  'محكمة خميس مشيط',
  'المحكمة العامة بخميس مشيط',
  'محكمة الاستئناف الإدارية',
  '1448/04/20',
  '20 ألف ريال',
  'وزارة الدفاع',
  'شركة النور',
  'رفض الطلب',
  'أبغى إلغاء القرار',
  'عندي تحويل بنكي',
  'نعم',
  'لا',
  'قبل شهر',
  'صدر القرار أمس',
  'ما عندي عقد',
  'عندي رسالة واتساب',
  'المدعى عليه شخص',
  'الجهة حكومية',
  'الحكم ابتدائي',
  'وصلني التبليغ اليوم',
];

let continuationChecks = 0;
for (let i = 0; i < 1000; i += 1) {
  const value = fieldValues[i % fieldValues.length];
  const messages = [
    { role: 'user', content: i % 2 === 0 ? 'أريد لائحة دعوى' : 'أريد إعداد اعتراض' },
    { role: 'assistant', content: i % 3 === 0 ? 'اذكر المعلومة الناقصة: ما المحكمة؟' : 'أرسل المعلومة المطلوبة أو المستند الناقص.' },
    { role: 'user', content: value },
  ];
  assert(isLikelyContinuationAnswer(messages), `continuation misclassified at case ${i}: ${value}`);
  assert(!shouldActivateDrafting(messages), `stale drafting reactivated at case ${i}: ${value}`);
  continuationChecks += 2;
}

console.log(JSON.stringify({
  ok: true,
  regression: 'محكمة خميس مشيط',
  continuationScenarios: 1000,
  continuationChecks,
}, null, 2));
