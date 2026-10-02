import { createHash, randomUUID } from 'node:crypto';
import { isRedisConfigured, redisCommand, redisPrefix } from './_redis.js';
import { protectJson, unprotectJson } from './_secureStore.js';

export type SentinelSeverity = 'P0' | 'P1' | 'P2';
export type SentinelFinding = {
  severity: SentinelSeverity;
  code: string;
  title: string;
  conclusion: string;
  expected?: string;
  actual?: string;
  agent?: string;
};

export type SentinelTurnInput = {
  sessionId: string;
  responseMode: 'simple' | 'professional';
  lastUserText: string;
  conversationText?: string;
  reply: string;
  routeTask?: string;
  routeStage?: string;
  draftingActive?: boolean;
  releaseGateDecision?: string;
  releaseGateScore?: number;
  sourceBlockers?: number;
  unsupportedCitations?: number;
  providerMode?: string;
};

export type SentinelEvent = {
  id: string;
  at: number;
  sessionFingerprint: string;
  status: 'clean' | 'flagged';
  maxSeverity: SentinelSeverity | 'OK';
  responseMode: 'simple' | 'professional';
  routeTask: string;
  routeStage: string;
  draftingActive: boolean;
  releaseGateDecision: string;
  releaseGateScore: number | null;
  sourceBlockers: number;
  unsupportedCitations: number;
  providerMode: string;
  userSnippet: string;
  replySnippet: string;
  findings: SentinelFinding[];
};

function sentinelKey() {
  return `${redisPrefix()}:sentinel:events`;
}

function fingerprint(value: string): string {
  return createHash('sha256').update(String(value || '')).digest('hex').slice(0, 20);
}

function privacySnippet(value: string, max: number): string {
  return String(value || '')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[EMAIL]')
    .replace(/\b\d{8,}\b/g, '[ID]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

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

export function looksLikeBareCourtAnswer(text: string): boolean {
  const value = normalizeArabic(text);
  if (!value || value.length > 120) return false;
  if (/(?:ابي|ابغى|اريد|اكتب|صغ|جهز|اعد|اعترض|اطعن|ارفع|دعوى|مذكره|استئناف على|نقض على)/.test(value)) return false;
  return /^(?:في\s+)?(?:المحكمه\s+)?(?:الاداريه|العامه|الجزائيه|التجاريه|العماليه|الاحوال\s+الشخصيه|الاستئناف\s+الاداريه|الاستئناف|العليا|الاداريه\s+العليا|محكمه\s+.+|[\p{L}\s]{2,40}\s+محكمه)$/u.test(value)
    || /^محكمه\s+[\p{L}\s]{2,60}$/u.test(value);
}

function looksLikeShortCompletion(text: string): boolean {
  const value = normalizeArabic(text);
  if (!value || value.length > 140) return false;
  if (looksLikeBareCourtAnswer(value)) return true;
  if (/^(?:نعم|لا|اي|ايوه|صح|تمام|امس|اليوم|قبل\s+\d+\s+ايام?|\d{1,4}(?:[/-]\d{1,2}){1,2}|\d{1,7})$/.test(value)) return true;
  if (/^(?:بتاريخ|تاريخ|المبلغ|رقم|المدعي|المدعى عليه|الجهه|الوزاره)\s*[:：-]?\s*.+/.test(value)) return true;
  return false;
}

function maxSeverity(findings: SentinelFinding[]): SentinelSeverity | 'OK' {
  if (findings.some((item) => item.severity === 'P0')) return 'P0';
  if (findings.some((item) => item.severity === 'P1')) return 'P1';
  if (findings.some((item) => item.severity === 'P2')) return 'P2';
  return 'OK';
}

export function detectSentinelFindings(input: Omit<SentinelTurnInput, 'sessionId'>): SentinelFinding[] {
  const findings: SentinelFinding[] = [];
  const lastUser = String(input.lastUserText || '').trim();
  const conversation = normalizeArabic(input.conversationText || lastUser);
  const reply = normalizeArabic(input.reply || '');
  const bareCourt = looksLikeBareCourtAnswer(lastUser);
  const shortCompletion = looksLikeShortCompletion(lastUser);

  if (bareCourt && input.draftingActive) {
    findings.push({
      severity: 'P0',
      code: 'STATE_INTENT_CONFLICT',
      title: 'تعارض حالة المحادثة مع نية الصياغة',
      conclusion: 'رسالة المستخدم تبدو إجابة عن المحكمة، لكن مسار الصياغة تم تفعيله.',
      expected: 'تسجيل المحكمة كبيان في حالة القضية ثم الانتقال للمعلومة التالية الناقصة.',
      actual: 'تفعيل مسار الصياغة/صاحب حجة وبيان.',
      agent: 'case-router',
    });
  }

  if (shortCompletion && input.releaseGateDecision && input.releaseGateDecision !== 'PASS') {
    findings.push({
      severity: 'P1',
      code: 'PREMATURE_RELEASE_GATE',
      title: 'تشغيل بوابة اعتماد قبل اكتمال جمع البيانات',
      conclusion: 'المستخدم أرسل معلومة استكمالية قصيرة بينما بوابة اعتماد المسودة دخلت المسار.',
      expected: 'تحديث حالة القضية فقط وعدم مراجعة مسودة حتى تكتمل شروط الصياغة.',
      actual: `Release Gate = ${input.releaseGateDecision}`,
      agent: 'virtual-judge',
    });
  }

  if (input.responseMode === 'simple' && /(?:بوابه الاعتماد|درجه الجاهزيه|القاضي الافتراضي|x-qada|تم حجب نص المسوده|المسوده قبل تسليمها)/.test(reply)) {
    findings.push({
      severity: 'P1',
      code: 'INTERNAL_PIPELINE_LEAK',
      title: 'تسرب تفاصيل داخلية إلى المستخدم البسيط',
      conclusion: 'الرد يعرض لغة تشغيل داخلية يفترض أن تبقى داخل Admin.',
      expected: 'سؤال استكمال أو نتيجة عملية بلغة المستخدم.',
      actual: 'ظهور مصطلحات بوابة الاعتماد/المسودة/القاضي الافتراضي.',
      agent: 'qada-core',
    });
  }

  const doctrineTerms = [
    'الاثراء بلا سبب',
    'المسؤوليه المدنيه عن الفعل الضار',
    'الفعل الضار',
    'المسؤوليه التقصيريه',
  ];
  const introducedDoctrine = doctrineTerms.find((term) => reply.includes(term) && !conversation.includes(term));
  if (shortCompletion && introducedDoctrine) {
    findings.push({
      severity: 'P0',
      code: 'UNSUPPORTED_RECHARACTERIZATION',
      title: 'تكييف قانوني جديد غير مبرر من رسالة استكمالية',
      conclusion: `ظهر تكييف «${introducedDoctrine}» رغم أن رسالة المستخدم الحالية مجرد استكمال قصير ولم يظهر هذا التكييف في سياق المستخدم.`,
      expected: 'حفظ المعلومة واستكمال الحقول الناقصة دون تغيير نظرية القضية.',
      actual: 'إدخال تكييف قانوني جديد في الرد.',
      agent: 'reasoning-flaws',
    });
  }

  if (Number(input.unsupportedCitations || 0) > 0) {
    findings.push({
      severity: 'P0',
      code: 'UNVERIFIED_CITATION',
      title: 'إحالة قانونية غير متحققة',
      conclusion: 'الجواب احتوى إحالة لم تجتز حزمة المصادر الرسمية.',
      expected: 'حجب الإحالة أو إبقاؤها كعنصر يحتاج تحققاً.',
      actual: `${Number(input.unsupportedCitations || 0)} إحالة غير متحققة.`,
      agent: 'official-source',
    });
  }

  if (input.responseMode === 'simple' && String(input.reply || '').length > 3200 && !/(?:بالتفصيل|تفصيل|المواد|المراجع|تحليل قانوني|تحليل نظامي)/i.test(lastUser)) {
    findings.push({
      severity: 'P2',
      code: 'SIMPLE_OVERFLOW',
      title: 'رد Simple أطول من اللازم',
      conclusion: 'الرد يتجاوز الحجم المتوقع لواجهة المستخدم البسيطة دون طلب تفصيل صريح.',
      expected: 'توجيه عملي مختصر ثم سؤال عن الناقص.',
      actual: `طول الرد ${String(input.reply || '').length} حرفاً.`,
      agent: 'qada-core',
    });
  }

  return findings;
}

export async function recordSentinelTurn(input: SentinelTurnInput): Promise<SentinelEvent | null> {
  if (!isRedisConfigured()) return null;

  const findings = detectSentinelFindings(input);
  const event: SentinelEvent = {
    id: randomUUID(),
    at: Date.now(),
    sessionFingerprint: fingerprint(input.sessionId),
    status: findings.length ? 'flagged' : 'clean',
    maxSeverity: maxSeverity(findings),
    responseMode: input.responseMode,
    routeTask: String(input.routeTask || '').slice(0, 80),
    routeStage: String(input.routeStage || '').slice(0, 80),
    draftingActive: Boolean(input.draftingActive),
    releaseGateDecision: String(input.releaseGateDecision || '').slice(0, 20),
    releaseGateScore: Number.isFinite(Number(input.releaseGateScore)) ? Number(input.releaseGateScore) : null,
    sourceBlockers: Math.max(0, Number(input.sourceBlockers || 0)),
    unsupportedCitations: Math.max(0, Number(input.unsupportedCitations || 0)),
    providerMode: String(input.providerMode || '').slice(0, 40),
    userSnippet: privacySnippet(input.lastUserText, 900),
    replySnippet: privacySnippet(input.reply, 1400),
    findings,
  };

  await redisCommand(['LPUSH', sentinelKey(), protectJson(event, 'sentinel-event')]);
  await redisCommand(['LTRIM', sentinelKey(), 0, 499]);
  return event;
}

export async function listSentinelEvents(limit = 200): Promise<SentinelEvent[]> {
  if (!isRedisConfigured()) return [];
  const safeLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const values = await redisCommand(['LRANGE', sentinelKey(), 0, safeLimit - 1]);
  return (Array.isArray(values) ? values : [])
    .map((value) => unprotectJson<SentinelEvent>(typeof value === 'string' ? value : '', 'sentinel-event'))
    .filter((value): value is SentinelEvent => Boolean(value));
}
