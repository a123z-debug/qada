export type ClaimLiberationPillar = 'البيانات' | 'الوقائع' | 'المستندات' | 'الطلبات';

export type ClaimLiberationAssessment = {
  applicable: boolean;
  complete: boolean;
  missingPillars: ClaimLiberationPillar[];
  linkageIssues: string[];
  sectionOrderValid: boolean;
};

function normalize(value: string): string {
  return String(value || '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/\r/g, '')
    .trim();
}

function normalizedLine(value: string): string {
  return normalize(value)
    .replace(/^\s*(?:#{1,6}|[-*•]+|\d+[.)-]?|[اأإآ]ولاً|ثانياً|ثالثاً|رابعاً|اولا|ثانيا|ثالثا|رابعا)\s*[:：.)-]?\s*/i, '')
    .trim();
}

function detectHeading(line: string): ClaimLiberationPillar | null {
  const value = normalizedLine(line);
  if (/^(?:البيانات|بيانات الدعوى|بيانات الاطراف|اطراف الدعوى|بيانات المدعي والمدعى عليه)(?:\s|$)/.test(value)) return 'البيانات';
  if (/^(?:الوقائع|وقائع الدعوى)(?:\s|$)/.test(value)) return 'الوقائع';
  if (/^(?:المستندات|المرفقات|الادله والمستندات|المستندات والادله)(?:\s|$)/.test(value)) return 'المستندات';
  if (/^(?:الطلبات|طلبات الدعوى|الطلبات الختاميه)(?:\s|$)/.test(value)) return 'الطلبات';
  return null;
}

function isPlaceholder(value: string): boolean {
  const text = normalize(value);
  return !text
    || /(?:يحتاج\s+استكمال|تحتاج\s+الى\s+استكمال|غير\s+محدد|غير\s+معلوم|غير\s+متوفر|لم\s+يذكر|لم\s+تذكر|يستكمل\s+لاحقا|\.\.\.|___|\[\s*\])/.test(text);
}

function sectionMap(draft: string): {
  bodies: Map<ClaimLiberationPillar, string>;
  indexes: Map<ClaimLiberationPillar, number>;
} {
  const lines = String(draft || '').split(/\n/);
  const bodies = new Map<ClaimLiberationPillar, string>();
  const indexes = new Map<ClaimLiberationPillar, number>();

  let current: ClaimLiberationPillar | null = null;
  const buffers = new Map<ClaimLiberationPillar, string[]>();

  for (let index = 0; index < lines.length; index += 1) {
    const heading = detectHeading(lines[index]);
    if (heading) {
      current = heading;
      if (!indexes.has(heading)) indexes.set(heading, index);
      if (!buffers.has(heading)) buffers.set(heading, []);
      continue;
    }
    if (current) buffers.get(current)!.push(lines[index]);
  }

  for (const [pillar, parts] of buffers.entries()) {
    bodies.set(pillar, parts.join('\n').trim());
  }

  return { bodies, indexes };
}

export function assessClaimLiberation(args: {
  draft: string;
  task?: string;
  sourceInputText?: string;
}): ClaimLiberationAssessment {
  const task = String(args.task || '').trim().toLowerCase();
  const combined = normalize([args.sourceInputText || '', args.draft || ''].join('\n'));
  const applicable =
    task === 'claim'
    || /(?:صحيفه|لائحه)\s+دعوى/.test(combined)
    || /(?:رفع|اقامه|اقامة)\s+دعوى/.test(combined);

  if (!applicable) {
    return {
      applicable: false,
      complete: true,
      missingPillars: [],
      linkageIssues: [],
      sectionOrderValid: true,
    };
  }

  const required: ClaimLiberationPillar[] = ['البيانات', 'الوقائع', 'المستندات', 'الطلبات'];
  const { bodies, indexes } = sectionMap(args.draft);
  const missingPillars: ClaimLiberationPillar[] = [];
  const linkageIssues: string[] = [];

  for (const pillar of required) {
    const body = bodies.get(pillar) || '';
    if (!indexes.has(pillar) || isPlaceholder(body)) {
      missingPillars.push(pillar);
    }
  }

  const data = normalize(bodies.get('البيانات') || '');
  if (!missingPillars.includes('البيانات')) {
    const identitySignals = [
      /المدعي/,
      /المدعى\s+عليه/,
      /الجهه\s+المدعى\s+عليها/,
      /المحكمه/,
      /الصفه/,
    ].filter((rule) => rule.test(data)).length;
    if (data.length < 30 || identitySignals < 2) {
      linkageIssues.push('قسم البيانات لا يعرّف أطراف الدعوى/صفاتهم والمحكمة أو الجهة بدرجة كافية.');
    }
  }

  const facts = normalize(bodies.get('الوقائع') || '');
  if (!missingPillars.includes('الوقائع') && facts.length < 45) {
    linkageIssues.push('قسم الوقائع مختصر لدرجة لا تحرر أصل النزاع أو تسلسله المؤثر.');
  }

  const documents = normalize(bodies.get('المستندات') || '');
  if (!missingPillars.includes('المستندات')) {
    const hasDocumentSignal = /(?:مستند|مرفق|خطاب|قرار|حكم|عقد|سند|ايصال|تحويل|محضر|صوره|كشف|شهاده)/.test(documents);
    const explicitNoDocuments = /(?:لا\s+يوجد|لا\s+توجد|لم\s+يقدم|لم\s+تقدم|لم\s+يرفق|لم\s+ترفق).{0,25}(?:مستند|مرفق|دليل)/.test(documents);
    if (documents.length < 15 || (!hasDocumentSignal && !explicitNoDocuments)) {
      linkageIssues.push('قسم المستندات لا يحدد ما يثبت الوقائع ولا يصرح بوضوح بعدم وجود مستندات مقدمة.');
    }
  }

  const requests = normalize(bodies.get('الطلبات') || '');
  if (!missingPillars.includes('الطلبات')) {
    const hasRemedySignal = /(?:اطلب|نطلب|الحكم|الزام|الغاء|ابطال|فسخ|تعويض|اثبات|رفض|رد\s+الدعوى|وقف\s+تنفيذ|اعاده)/.test(requests);
    if (requests.length < 20 || !hasRemedySignal) {
      linkageIssues.push('قسم الطلبات لا يتضمن طلباً قضائياً جازماً ومحدداً يمكن ربطه بالوقائع.');
    }
  }

  const positions = required.map((pillar) => indexes.get(pillar) ?? Number.POSITIVE_INFINITY);
  const sectionOrderValid = positions.every((value, index) => index === 0 || positions[index - 1] < value);
  if (!sectionOrderValid) {
    linkageIssues.push('ترتيب تحرير الدعوى يجب أن يكون: البيانات ثم الوقائع ثم المستندات ثم الطلبات.');
  }

  return {
    applicable,
    complete: missingPillars.length === 0 && linkageIssues.length === 0,
    missingPillars,
    linkageIssues,
    sectionOrderValid,
  };
}
