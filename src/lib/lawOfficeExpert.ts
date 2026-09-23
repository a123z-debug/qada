import type { LegalSourceAgentBundle } from './legalSourceAgents.js';

export type LawOfficeTask =
  | 'claim'
  | 'appeal'
  | 'cassation'
  | 'petition'
  | 'memo'
  | 'reply'
  | 'document-review'
  | 'consultation';

export type CourtStage = 'first-instance' | 'appeal' | 'supreme' | 'unknown';

export type LawOfficeRoute = {
  task: LawOfficeTask;
  stage: CourtStage;
  draftingRequested: boolean;
  allowDrafting: boolean;
  blocking: boolean;
  hasJudgmentSignals: boolean;
  reason: string;
  nextAction: string;
};

function normalize(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectLawOfficeTask(text: string): LawOfficeTask {
  const value = normalize(text);
  if (/(?:طعن|اعتراض).{0,16}(?:نقض)|(?:لائحه|صحيفه)\s+نقض|المحكمه\s+(?:الاداريه\s+)?العليا/.test(value)) return 'cassation';
  if (/التماس\s+اعاد(?:ه|ة)\s+النظر/.test(value)) return 'petition';
  if (/(?:لائحه\s+)?(?:اعتراض|استئناف)|اعترض\s+على\s+(?:حكم|قرار)/.test(value)) return 'appeal';
  if (/رد\s+على\s+مذكره|مذكره\s+رد|جواب\s+على\s+مذكره/.test(value)) return 'reply';
  if (/(?:لائحه|صحيفه)\s+دعوى|(?:اكتب|صغ|جهز|اعد).{0,24}دعوى/.test(value)) return 'claim';
  if (/(?:اكتب|صغ|جهز|اعد|راجع).{0,28}(?:مذكره|لائحه)|مذكره\s+(?:جوابيه|دفاع|دفوع|ختاميه)/.test(value)) return 'memo';
  if (/راجع|حلل|افحص|حكم|قرار|مستند/.test(value)) return 'document-review';
  return 'consultation';
}

export function detectCourtStage(text: string): CourtStage {
  const value = normalize(text);

  // Determine the stage from the judgment being reviewed, not from the destination
  // court named in the requested remedy (e.g. "أمام المحكمة الإدارية العليا").
  if (
    /حكم.{0,40}(?:المحكمه\s+الاداريه\s+العليا|المحكمه\s+العليا)|صادر.{0,24}(?:المحكمه\s+الاداريه\s+العليا|المحكمه\s+العليا)/.test(value)
  ) return 'supreme';

  if (
    /حكم.{0,50}محكمه\s+الاستئناف|محكمه\s+الاستئناف.{0,50}حكم|حكم\s+الاستئناف|حكم\s+في\s+الاستئناف|تأييد\s+الحكم|تاييد\s+الحكم|طلب\s+الاستئناف.{0,40}الحكم/.test(value)
  ) return 'appeal';

  if (
    /حكم\s+ابتدائي|الحكم\s+محل\s+الاستئناف.{0,80}المحكمه|الحكم\s+الصادر.{0,60}(?:المحكمه\s+الاداريه|المحكمه\s+العامه|المحكمه\s+الجزائيه)/.test(value)
  ) return 'first-instance';

  return 'unknown';
}

export function analyzeLawOfficeRoute(text: string, hasAttachmentEvidence = false): LawOfficeRoute {
  const task = detectLawOfficeTask(text);
  const stage = detectCourtStage(text);
  const value = normalize(text);
  const draftingRequested = ['claim','appeal','cassation','petition','memo','reply'].includes(task)
    || /اكتب|صغ|جهز|اعد|لائحه|مذكره|صحيفه/.test(value);
  const hasJudgmentSignals = hasAttachmentEvidence || /حكم|منطوق|اسباب الحكم|الحيثيات|رقم الدعوى|رقم الاستئناف|تاريخ التبليغ/.test(value);

  if (task === 'appeal' && (stage === 'appeal' || stage === 'supreme')) {
    return {
      task, stage, draftingRequested, allowDrafting: false, blocking: true, hasJudgmentSignals,
      reason: 'المادة المعروضة تبدو صادرة من مرحلة الاستئناف/العليا؛ لا يجوز للمنصة أن تنشئ لائحة استئناف جديدة تلقائياً قبل تحديد طريق الاعتراض التالي نظاماً.',
      nextAction: 'استخرج درجة الحكم ومنطوقه وتاريخ التبليغ، ثم تحقق من طريق الطعن التالي من المصدر الرسمي؛ إذا كان المطلوب نقضاً فحوّل المهمة إلى طعن بالنقض بعد التحقق.'
    };
  }

  if (task === 'cassation' && stage === 'first-instance') {
    return {
      task, stage, draftingRequested, allowDrafting: false, blocking: true, hasJudgmentSignals,
      reason: 'المادة المعروضة تبدو حكماً ابتدائياً؛ طلب النقض في هذه المرحلة يحتاج تصحيح المسار قبل الصياغة.',
      nextAction: 'حدد طريق الاعتراض على الحكم الابتدائي أولاً، ولا تصغ طعناً بالنقض قبل التحقق من المرحلة المختصة.'
    };
  }

  if (task === 'cassation' && stage === 'supreme') {
    return {
      task, stage, draftingRequested, allowDrafting: false, blocking: true, hasJudgmentSignals,
      reason: 'المادة المعروضة تبدو صادرة من المحكمة العليا/الإدارية العليا؛ لا تنشئ طعناً جديداً من النوع نفسه على الحكم دون تحديد طريق نظامي آخر.',
      nextAction: 'تحقق من طبيعة الحكم والطرق الاستثنائية المتاحة -إن وجدت- قبل أي صياغة.'
    };
  }

  if ((task === 'appeal' || task === 'cassation' || task === 'petition') && !hasJudgmentSignals) {
    return {
      task, stage, draftingRequested, allowDrafting: false, blocking: true, hasJudgmentSignals,
      reason: 'لا يمكن صياغة طريق اعتراض مهني من دون الحكم أو بياناته الجوهرية.',
      nextAction: 'اطلب الحكم أو نص المنطوق والأسباب ودرجة المحكمة وتاريخ التبليغ، ثم ابدأ تحليل طريق الاعتراض.'
    };
  }

  if ((task === 'appeal' || task === 'cassation') && stage === 'unknown') {
    return {
      task, stage, draftingRequested, allowDrafting: false, blocking: true, hasJudgmentSignals,
      reason: 'درجة الحكم غير محسومة من البيانات الحالية.',
      nextAction: 'حدد هل الحكم ابتدائي أم استئناف أم صادر من المحكمة العليا قبل صياغة اللائحة.'
    };
  }

  return {
    task, stage, draftingRequested, allowDrafting: true, blocking: false, hasJudgmentSignals,
    reason: 'المسار لا يظهر فيه تعارض إجرائي أولي يمنع بدء العمل.',
    nextAction: 'ابدأ بتحليل ملف القضية ثم الصياغة، مع إبقاء المواعيد والمواد خلف بوابة التحقق الرسمي.'
  };
}

function taskLabel(task: LawOfficeTask): string {
  return ({
    claim: 'دعوى',
    appeal: 'اعتراض/استئناف',
    cassation: 'طعن بالنقض',
    petition: 'التماس إعادة النظر',
    memo: 'مذكرة',
    reply: 'رد على مذكرة',
    'document-review': 'مراجعة حكم/مستند',
    consultation: 'استشارة عملية',
  } as const)[task];
}

function stageLabel(stage: CourtStage): string {
  return ({
    'first-instance': 'درجة أولى',
    appeal: 'استئناف',
    supreme: 'عليا',
    unknown: 'غير محسومة',
  } as const)[stage];
}

export function buildLawOfficeInstruction(route: LawOfficeRoute, sourceBundle: LegalSourceAgentBundle): string {
  const sourceReady = sourceBundle.verification.officialSources > 0;
  const routeGate = route.blocking
    ? `بوابة المسار: متوقفة. السبب: ${route.reason}\nالتصرف المطلوب: ${route.nextAction}\nممنوع صياغة محرر بعنوان أو طريق خاطئ حتى تصحيح المرحلة.`
    : `بوابة المسار: تسمح بالعمل المبدئي. الإجراء: ${route.nextAction}`;

  return `[خبير مكتب المحاماة — بوابة المرحلة والمرافعة]
تعامل مع المنصة كمكتب محاماة رقمي هدفه حل القضية، لا استعراض المعرفة.
المهمة المستنتجة: ${taskLabel(route.task)}.
مرحلة الحكم المستنتجة: ${stageLabel(route.stage)}.
${routeGate}

قبل أي اعتراض أو نقض أو التماس، ابنِ داخلياً بطاقة الحكم التالية:
1) المحكمة والدرجة الحالية.
2) الحكم السابق الذي تمت مراجعته إن وجد.
3) منطوق الحكم الحالي بدقة.
4) الأسباب التي حملت النتيجة فعلاً.
5) دفوع صاحب الشأن التي عالجها الحكم.
6) الدفوع الجوهرية التي يدعي صاحب الشأن أن الحكم أغفلها.
7) رد الخصم/الجهة على كل نقطة جوهرية.
8) المستند الذي يثبت كل واقعة مؤثرة.
9) تاريخ الحكم والتبليغ/التسلم عند الحاجة للمواعيد.
10) النتيجة التي يريدها العميل.

قواعد المكتب:
- لا تخلط بين الاستئناف والنقض والالتماس والدعوى الجديدة.
- في النقض: لا تعيد مناقشة الوقائع كأنك محكمة موضوع؛ استخرج أولاً مواضع الخطأ القانوني أو الإجرائي أو التسبيبي القابلة للبحث وفق المصدر الرسمي.
- في الاستئناف: اربط كل سبب بما وقع في الحكم والملف، ولا تخترع سبباً لم يثبت.
- لا تسرد مواد لا تخدم نقطة محددة في القضية، ولا تذكر نظاماً لمجرد وجود كلمة مشتركة.
- كل سند يجب أن يجيب: ما النقطة التي يثبتها؟ وكيف تؤثر في النتيجة؟
- لا تستخدم عبارة "استقر القضاء" ولا تنسب سابقة إلا من مصدر قضائي متحقق.
- إذا كان الحكم المرفق كافياً، ابدأ العمل فوراً؛ لا تعيد سؤال العميل عن معلومات موجودة في الحكم.
- إذا كان النقص مؤثراً، اسأل عن الناقص فقط.
- لا تشرح للعميل بنية QADA أو الوكلاء أو RAG.
- المخرج للمستخدم: تشخيص قصير للمسار، ثم العمل المطلوب مباشرة.
- حالة المصادر الحالية: ${sourceReady ? 'يوجد استرجاع رسمي، لكن يجب ربط كل مرجع بموضوعه.' : 'التحقق المرجعي غير مكتمل؛ امنع الجزم بالمادة أو الميعاد.'}
`;
}
