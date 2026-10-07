export type TemporalLawStatus = 'NOT_APPLICABLE' | 'READY' | 'UNRESOLVED';

export type TemporalLawAssessment = {
  status: TemporalLawStatus;
  requiresTemporalResolution: boolean;
  eventDateCandidates: string[];
  temporalSignals: string[];
  articlePresenceVerified: number;
  effectiveTextReady: boolean;
  blockers: string[];
  warnings: string[];
};

function normalizeArabic(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function extractDates(value: string): string[] {
  const results: string[] = [];
  const patterns = [
    /\b(?:13|14)\d{2}[/-]\d{1,2}[/-]\d{1,2}\s*(?:هـ)?\b/g,
    /\b(?:19|20)\d{2}[/-]\d{1,2}[/-]\d{1,2}\s*(?:م)?\b/g,
    /\b\d{1,2}[/-]\d{1,2}[/-](?:13|14)\d{2}\s*(?:هـ)?\b/g,
    /\b\d{1,2}[/-]\d{1,2}[/-](?:19|20)\d{2}\s*(?:م)?\b/g,
    /\b(?:13|14)\d{2}\s*هـ\b/g,
    /\b(?:19|20)\d{2}\s*م\b/g,
  ];
  for (const pattern of patterns) {
    for (const match of value.matchAll(pattern)) {
      if (match[0]) results.push(match[0].trim());
    }
  }
  return unique(results).slice(0, 20);
}

export function assessTemporalLaw(args: {
  query: string;
  articlePresenceVerified: number;
  effectiveTextReady: boolean;
}): TemporalLawAssessment {
  const query = String(args.query || '');
  const normalized = normalizeArabic(query);
  const eventDateCandidates = extractDates(query);

  const signalMap: Array<[RegExp, string]> = [
    [/تاريخ\s+(?:الواقعه|القرار|المطالبه|الاستحقاق|الحكم|التبليغ)/, 'تاريخ مؤثر في التطبيق'],
    [/(?:وقت|حين|اثناء)\s+(?:الواقعه|الاستحقاق|الخدمه|المطالبه)/, 'تطبيق النظام وقت الواقعة'],
    [/(?:قبل|بعد)\s+(?:التعديل|المرسوم|القرار|النفاذ)/, 'مقارنة ما قبل/بعد تعديل'],
    [/(?:تعديل|معدل|الغاء|نسخ|نفاذ|نافذ|نسخه\s+سابقه|صيغه\s+سابقه)/, 'سريان أو تعديل تشريعي'],
    [/(?:منذ|خلال\s+الفتره|الفتره\s+من|اعتبارا\s+من)/, 'فترة زمنية'],
    [/اثر\s+رجعي|باثر\s+رجعي/, 'أثر رجعي'],
  ];

  const temporalSignals = signalMap
    .filter(([pattern]) => pattern.test(normalized))
    .map(([, label]) => label);

  const hasArticleMaterial = Math.max(0, Number(args.articlePresenceVerified || 0)) > 0;
  const explicitTemporalIssue = eventDateCandidates.length > 0 || temporalSignals.length > 0;
  const requiresTemporalResolution = hasArticleMaterial && explicitTemporalIssue;

  if (!requiresTemporalResolution) {
    return {
      status: 'NOT_APPLICABLE',
      requiresTemporalResolution: false,
      eventDateCandidates,
      temporalSignals: unique(temporalSignals),
      articlePresenceVerified: Math.max(0, Number(args.articlePresenceVerified || 0)),
      effectiveTextReady: Boolean(args.effectiveTextReady),
      blockers: [],
      warnings: hasArticleMaterial && !args.effectiveTextReady
        ? ['النص النافذ زمنياً للحزمة غير مكتمل، لكن لم يظهر في المدخل الحالي تاريخ/إشارة زمنية تكفي لتفعيل بوابة السريان الحتمية.']
        : [],
    };
  }

  if (!args.effectiveTextReady) {
    return {
      status: 'UNRESOLVED',
      requiresTemporalResolution: true,
      eventDateCandidates,
      temporalSignals: unique(temporalSignals),
      articlePresenceVerified: Math.max(0, Number(args.articlePresenceVerified || 0)),
      effectiveTextReady: false,
      blockers: [
        'السريان الزمني غير محسوم: ثبت وجود مادة/مواد في مصدر رسمي، لكن النسخة النافذة بتاريخ الواقعة أو المطالبة لم تُثبت بعد. يمنع اعتماد المادة كأساس زمني نهائي حتى مطابقة التعديلات وأداة النفاذ.',
      ],
      warnings: eventDateCandidates.length === 0
        ? ['ظهرت مسألة تعديل/نفاذ دون تاريخ واقعة محدد؛ يلزم تاريخ مؤثر قبل حسم النسخة النظامية.']
        : [],
    };
  }

  return {
    status: 'READY',
    requiresTemporalResolution: true,
    eventDateCandidates,
    temporalSignals: unique(temporalSignals),
    articlePresenceVerified: Math.max(0, Number(args.articlePresenceVerified || 0)),
    effectiveTextReady: true,
    blockers: [],
    warnings: [],
  };
}

export function temporalLawInstruction(assessment: TemporalLawAssessment): string {
  return [
    '[بوابة السريان الزمني]',
    `الحالة: ${assessment.status}`,
    `يتطلب حسم نسخة زمنية: ${assessment.requiresTemporalResolution ? 'نعم' : 'لا'}`,
    assessment.eventDateCandidates.length
      ? `التواريخ المرصودة: ${assessment.eventDateCandidates.join(' | ')}`
      : 'التواريخ المرصودة: لا يوجد تاريخ صريح كافٍ',
    assessment.temporalSignals.length
      ? `إشارات السريان: ${assessment.temporalSignals.join(' | ')}`
      : 'إشارات السريان: لا توجد',
    assessment.blockers.length
      ? `موانع:\n- ${assessment.blockers.join('\n- ')}`
      : '',
    'قاعدة: لا تستخدم مجرد وجود المادة في المصدر لإثبات أن صياغتها الحالية كانت نافذة في التاريخ محل النزاع.',
  ].filter(Boolean).join('\n');
}
