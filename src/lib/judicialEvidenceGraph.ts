export type JudicialEvidenceStatus = 'SATISFIED' | 'NOT_SATISFIED' | 'UNVERIFIED';

export type JudicialEvidenceLink = {
  id: string;
  requirement: string;
  fact: string;
  evidence: string;
  source: string;
  effect: string;
  material: boolean;
  requestedStatus: JudicialEvidenceStatus;
  status: JudicialEvidenceStatus;
  factGrounded: boolean;
  evidenceGrounded: boolean;
  sourceGrounded: boolean;
};

export type JudicialEvidenceGraphAssessment = {
  links: JudicialEvidenceLink[];
  blockers: string[];
  warnings: string[];
  verifiedCount: number;
  unverifiedCount: number;
  materialUnverifiedCount: number;
  complete: boolean;
};

function normalizeArabic(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[^\p{L}\p{N}\s/]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(value: unknown, max = 2000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function statusOf(value: unknown): JudicialEvidenceStatus {
  const normalized = String(value || '').trim().toUpperCase().replace(/[ -]+/g, '_');
  if (normalized === 'SATISFIED') return 'SATISFIED';
  if (normalized === 'NOT_SATISFIED') return 'NOT_SATISFIED';
  return 'UNVERIFIED';
}

function absenceMarker(value: string): boolean {
  const normalized = normalizeArabic(value);
  return !normalized
    || /^(?:لا يوجد|لا توجد|غير متوفر|غير متوفره|غير مقدم|غير مرفق|مفقود|غير معلوم|غير محدد)$/.test(normalized);
}

function groundedLiteral(candidate: string, context: string): boolean {
  const needle = normalizeArabic(candidate);
  const haystack = normalizeArabic(context);
  if (!needle || !haystack || needle.length < 3) return false;
  if (haystack.includes(needle)) return true;

  const tokens = Array.from(new Set(
    needle
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  ));
  if (tokens.length < 4) return false;
  const matched = tokens.filter((token) => haystack.includes(token)).length;
  return matched / tokens.length >= 0.8;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function buildJudicialEvidenceGraphInstruction(): string {
  return `[خريطة الإثبات القضائي الإلزامية]
لكل عنصر جوهري في الحق أو الدفع أو سبب الطعن، أضف سجلاً مستقلاً في elementMatrix بهذه الحقول فقط:
- requirement: الشرط أو العنصر القانوني المطلوب إثباته.
- fact: عبارة قصيرة موجودة فعلياً في نص القضية/المذكرة، وليست إعادة صياغة حرة.
- evidence: عبارة قصيرة موجودة فعلياً في المرفقات/النص أو اسم المرفق الذي يثبت الواقعة. إذا لا يوجد دليل فاكتب "لا يوجد".
- source: اسم/رقم المادة أو المصدر كما يظهر فعلياً في حزمة المصادر الرسمية. لا تستدع مصدراً من الذاكرة.
- effect: الأثر القضائي المباشر لاكتمال أو نقص هذا العنصر.
- material: true إذا كان العنصر قد يغير القبول أو الاستحقاق أو المنطوق.
- status: SATISFIED أو NOT_SATISFIED أو UNVERIFIED.

قواعد صارمة:
1) SATISFIED ممنوع إذا لم تكن الواقعة والدليل والمصدر موجودة فعلياً في المدخلات/حزمة المصادر.
2) لا تستخدم الاستنتاج كبديل عن الدليل.
3) إذا كان الدليل صورة/PDF بلا نص مستخرج، يجوز أن يكون evidence هو اسم الملف فقط إذا كان الملف نفسه مرفقاً في الطلب.
4) العنصر الجوهري غير المتحقق يجب أن يكون NOT_SATISFIED أو UNVERIFIED، ولا تمنح PASS بوجوده.
5) لا تختصر العناصر المختلفة في عنصر واحد إذا كانت لكل منها شروط أو أدلة مستقلة.`;
}

export function assessJudicialEvidenceGraph(args: {
  raw: unknown;
  factContext: string;
  sourceContext: string;
}): JudicialEvidenceGraphAssessment {
  if (!Array.isArray(args.raw) || args.raw.length === 0) {
    return {
      links: [],
      blockers: ['لم يُنتج القاضي الافتراضي خريطة عناصر قضائية قابلة للتدقيق.'],
      warnings: [],
      verifiedCount: 0,
      unverifiedCount: 0,
      materialUnverifiedCount: 0,
      complete: false,
    };
  }

  const links: JudicialEvidenceLink[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];

  for (let index = 0; index < Math.min(args.raw.length, 40); index += 1) {
    const item = args.raw[index];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const raw = item as Record<string, unknown>;

    const requirement = compact(raw.requirement, 1200);
    const fact = compact(raw.fact, 2000);
    const evidence = compact(raw.evidence, 2000);
    const source = compact(raw.source, 1200);
    const effect = compact(raw.effect, 1600);
    const material = raw.material !== false;
    const requestedStatus = statusOf(raw.status);

    const factGrounded = !absenceMarker(fact) && groundedLiteral(fact, args.factContext);
    const evidenceGrounded = !absenceMarker(evidence) && groundedLiteral(evidence, args.factContext);
    const sourceGrounded = !absenceMarker(source) && groundedLiteral(source, args.sourceContext);

    let status = requestedStatus;
    if (
      status === 'SATISFIED'
      && (!requirement || !factGrounded || !evidenceGrounded || !sourceGrounded)
    ) {
      status = 'UNVERIFIED';
    }

    const link: JudicialEvidenceLink = {
      id: `element-${index + 1}`,
      requirement,
      fact,
      evidence,
      source,
      effect,
      material,
      requestedStatus,
      status,
      factGrounded,
      evidenceGrounded,
      sourceGrounded,
    };
    links.push(link);

    const label = requirement || `العنصر ${index + 1}`;
    if (material && status !== 'SATISFIED') {
      blockers.push(`خريطة الإثبات: العنصر الجوهري «${label}» حالته ${status}.`);
    } else if (!material && status !== 'SATISFIED') {
      warnings.push(`خريطة الإثبات: العنصر «${label}» يحتاج استكمالاً (${status}).`);
    }

    if (requestedStatus === 'SATISFIED' && status === 'UNVERIFIED') {
      const missing = [
        !factGrounded ? 'الواقعة' : '',
        !evidenceGrounded ? 'الدليل' : '',
        !sourceGrounded ? 'المصدر' : '',
      ].filter(Boolean).join('، ');
      const message = `خريطة الإثبات: رفض النظام وصف «${label}» بأنه SATISFIED لعدم تثبيت: ${missing}.`;
      if (material) blockers.push(message);
      else warnings.push(message);
    }
  }

  if (links.length === 0) {
    blockers.push('خريطة الإثبات المرسلة غير قابلة للقراءة أو خالية من العناصر الصالحة.');
  }

  const verifiedCount = links.filter((link) => link.status === 'SATISFIED').length;
  const unverifiedCount = links.filter((link) => link.status !== 'SATISFIED').length;
  const materialUnverifiedCount = links.filter((link) => link.material && link.status !== 'SATISFIED').length;

  return {
    links,
    blockers: unique(blockers),
    warnings: unique(warnings),
    verifiedCount,
    unverifiedCount,
    materialUnverifiedCount,
    complete: links.length > 0 && blockers.length === 0,
  };
}
