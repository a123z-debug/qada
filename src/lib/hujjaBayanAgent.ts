import type { LegalSourceAgentBundle } from './legalSourceAgents.js';

export type HujjaDraftingIntent =
  | 'claim'
  | 'appeal'
  | 'memo'
  | 'reply'
  | 'cassation'
  | 'petition'
  | 'none';

function normalize(value: string): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function detectHujjaDraftingIntent(text: string): HujjaDraftingIntent {
  const value = normalize(text);
  if (!value) return 'none';
  if (/(?:لائحة|صحيفة)\s+دعوى|(?:اكتب|صغ|جهز|جهّز|اعد|أعد).{0,24}دعوى/i.test(value)) return 'claim';
  if (/(?:لائحة\s+)?(?:اعتراض|استئناف)|اعترض\s+على\s+(?:حكم|قرار)|أعترض\s+على\s+(?:حكم|قرار)/i.test(value)) return 'appeal';
  if (/(?:طعن\s+بالنقض|صحيفة\s+نقض|لائحة\s+نقض)/i.test(value)) return 'cassation';
  if (/(?:التماس\s+إعادة\s+النظر|التماس\s+اعادة\s+النظر)/i.test(value)) return 'petition';
  if (/(?:رد\s+على\s+مذكرة|مذكرة\s+رد|جواب\s+على\s+مذكرة)/i.test(value)) return 'reply';
  if (/(?:اكتب|صغ|جهز|جهّز|اعد|أعد|راجع).{0,28}(?:مذكرة|لائحة)|(?:مذكرة\s+(?:جوابية|دفاع|دفوع|ختامية))/i.test(value)) return 'memo';
  return 'none';
}

export function isHujjaDraftingRequest(text: string): boolean {
  return detectHujjaDraftingIntent(text) !== 'none';
}

function intentLabel(intent: HujjaDraftingIntent): string {
  if (intent === 'claim') return 'صحيفة/لائحة دعوى';
  if (intent === 'appeal') return 'لائحة اعتراض أو استئناف';
  if (intent === 'cassation') return 'طعن بالنقض';
  if (intent === 'petition') return 'التماس إعادة النظر';
  if (intent === 'reply') return 'رد على مذكرة';
  if (intent === 'memo') return 'مذكرة قضائية';
  return 'محرر قضائي';
}

export function buildHujjaBayanInstruction(
  userText: string,
  sourceBundle: LegalSourceAgentBundle,
): string {
  const intent = detectHujjaDraftingIntent(userText);
  if (intent === 'none') return '';

  const precedentPacket = sourceBundle.packets.find((packet) => packet.agentId === 'src-precedents');
  const precedentReferences = precedentPacket?.references || [];
  const verifiedPrecedentReady =
    sourceBundle.verification.precedentCorpusReady && precedentReferences.length > 0;

  const precedentState = verifiedPrecedentReady
    ? [
        'توجد سوابق أو مبادئ قضائية متحققة في حزمة المصادر الحالية.',
        'استخلص منها فقط منهج التسبيب والمبدأ المرتبط بالمسألة، ولا تنسخ لغة حكم بعينه إلا عند الاقتباس المسموح والمتحقق.',
      ].join('\n')
    : [
        'قاعدة السوابق القضائية المتحققة في الحزمة الحالية غير مكتملة.',
        'إذا كان المستخدم قد أرفق حكماً أو قراراً قضائياً، فادرس ذلك المستند نفسه أولاً من حيث المنطوق والتسبيب والدفوع التي عالجها.',
        'إذا لم يوجد حكم مرفق ولا سابقة قضائية متحققة، فلا تدّع أنك درست أحكاماً مشابهة، ولا تنسب مبدأ أو رقماً أو دائرة قضائية من الذاكرة.',
      ].join('\n');

  return `[وكيل الصياغة النهائي: صاحب حُجّة وبيان]
المهمة الحالية: ${intentLabel(intent)}.

هذه مرحلة صياغة بعد التحليل وليست دردشة عامة. نفّذ العمل على مرحلتين متتاليتين داخلياً، ولا تعرض خطوات التفكير الداخلية للمستخدم:

المرحلة الأولى — الاستقراء قبل الكتابة:
- راجع الحكم أو القرار أو المذكرة المرفقة إن وجدت، وحدد داخلياً: الوقائع المؤثرة، منطوق الحكم، أسباب الحكم، الدفوع التي عولجت أو أغفلت، وأثر كل مستند.
- راجع فقط الأحكام والمبادئ القضائية الموجودة فعلاً في حزمة QADA أو في مستندات المستخدم.
- لا تستنتج "مزاج" قاضٍ بعينه ولا تخصص الصياغة لشخصه؛ استخلص فقط أنماط التسبيب القضائي العامة والمبادئ المتحققة.
- ${precedentState.replace(/\n/g, '\n- ')}
- طابق الحجج مع الأسانيد الرسمية المتحققة، وحدد داخلياً أي نقطة لا تزال تحتاج تحققاً قبل نسبتها إلى نظام أو حكم.

المرحلة الثانية — الصياغة:
- اكتب بقوة حجة ووضوح بيان: لغة عربية قضائية رصينة، عزيزة، مباشرة، بلا تملق أو استعطاف أو مدح للمحكمة.
- لا تجعل البلاغة هدفاً مستقلاً؛ الدقة والحجة والاختصار مقدمة على الزخرفة اللفظية.
- اجعل كل فقرة تؤدي وظيفة: واقعة منتجة، دفع محدد، سند متحقق، أثر قانوني، أو طلب.
- الجمل قصيرة نسبياً، مترابطة، وخالية من الحشو والمقدمات الإنشائية.
- لا تخترع واقعة أو مادة أو حكماً أو مبدأ قضائياً. لا تستخدم عبارة "استقر القضاء" إلا إذا كانت الحزمة المتحققة تسند ذلك فعلاً.
- لا تقل للمستخدم إنك "راجعت أحكاماً مشابهة" إلا إذا وُجدت أحكام فعلية في المدخلات أو الحزمة.
- عند وجود نقص جوهري يمنع الصياغة الصحيحة، اطلب الناقص فقط بدلاً من ملء الفراغ بالتخمين.
- لا تشرح طريقة عمل الوكيل ولا تعرض التحليل الداخلي.

بنية المخرج الافتراضية:
1) عنوان المحرر والجهة أو القضية إذا كانت بياناتها متوفرة.
2) الوقائع: مختصرة ومرتبة زمنياً دون جدل زائد.
3) الأسباب أو الدفوع: كل سبب بعنوان قاطع، ثم الواقعة، ثم السند المتحقق إن وجد، ثم وجه الأثر.
4) الطلبات: محددة وقابلة للفهم ولا تتجاوز ما تسمح به الوقائع.
5) عند الحاجة فقط: قائمة قصيرة بما يلزم استكماله قبل الاعتماد النهائي.

النبرة: صاحب حق يعرف حجته ويعرضها بلسان مبين؛ لا متوسل ولا متعالٍ.`;
}
