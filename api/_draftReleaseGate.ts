import { GoogleGenAI } from '@google/genai';
import { runLegalSourceAgents } from '../src/lib/legalSourceAgents.js';
import { guardIntroducedLegalCitations } from '../src/lib/legalCitationGuard.js';
import { analyzeLawOfficeRoute, buildLawOfficeInstruction } from '../src/lib/lawOfficeExpert.js';
import { buildCourtProfileInstruction } from '../src/lib/courtProfiles.js';
import { withTimeout } from './_async.js';
import {
  USER_AI_MODELS,
  isModelCoolingDown,
  isQuotaError,
  markModelQuotaError,
} from './_aiRuntime.js';

export type DraftReleaseGateDecision = 'PASS' | 'RETURN' | 'BLOCK';

export type DraftReleaseGateResult = {
  gateDecision: DraftReleaseGateDecision;
  readinessScore: number;
  readinessTarget: 95;
  idealReadinessTarget: 99;
  hardBlockers: string[];
  materialFindings: string[];
  sourceBlockers: string[];
  verifiedArticles: number;
  officialSources: number;
  provider?: string;
};

type ReviewShape = {
  gateDecision?: string;
  fatalDefects?: string[];
  temporalErrors?: string[];
  hierarchyErrors?: string[];
  exceptionErrors?: string[];
  rebuttalErrors?: string[];
  evidenceErrors?: string[];
  remedyErrors?: string[];
  contradictions?: string[];
};

function geminiClients(): GoogleGenAI[] {
  return [1, 2, 3, 4]
    .map((index) => process.env[`GEMINI_API_KEY${index === 1 ? '' : `_${index}`}`]?.trim())
    .filter((key): key is string => Boolean(key))
    .map((apiKey) => new GoogleGenAI({ apiKey }));
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

function parseJson(raw: string): ReviewShape | null {
  const text = String(raw || '').trim();
  if (!text) return null;
  const candidates = [
    text,
    text.replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/i, '').trim(),
  ];
  const object = text.match(/\{[\s\S]*\}/);
  if (object) candidates.push(object[0]);
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as ReviewShape;
    } catch {}
  }
  return null;
}

export async function reviewDraftBeforeClientRelease(args: {
  draft: string;
  sourceInputText: string;
  court?: string;
  documentTitle?: string;
  hasEvidence?: boolean;
}): Promise<DraftReleaseGateResult> {
  const draft = String(args.draft || '').trim();
  if (!draft) {
    return {
      gateDecision: 'BLOCK',
      readinessScore: 0,
      readinessTarget: 95,
      idealReadinessTarget: 99,
      hardBlockers: ['لم تتولد مسودة قابلة للمراجعة.'],
      materialFindings: [],
      sourceBlockers: [],
      verifiedArticles: 0,
      officialSources: 0,
    };
  }

  const sourceQuery = [
    args.court || '',
    args.documentTitle || '',
    args.sourceInputText || '',
    draft.slice(0, 18000),
  ].filter(Boolean).join('\n').slice(0, 30000);

  const sourceBundle = runLegalSourceAgents(sourceQuery);
  const route = analyzeLawOfficeRoute(
    [args.court || '', args.documentTitle || '', args.sourceInputText || '', draft].join('\n'),
    Boolean(args.hasEvidence),
  );
  const lawOfficeInstruction = buildLawOfficeInstruction(route, sourceBundle);
  const courtProfileInstruction = buildCourtProfileInstruction(
    [args.court || '', args.documentTitle || '', draft].join('\n'),
  );

  const citationGuard = guardIntroducedLegalCitations(
    String(args.sourceInputText || ''),
    draft,
    sourceBundle.context,
  );

  const profileText = [args.court || '', args.documentTitle || '', args.sourceInputText || '', draft]
    .join('\n')
    .toLowerCase();
  const militaryPersonnelCase =
    /خدمة\s*الأفراد|فرد\s*عسكري|عسكري|وزارة\s*الدفاع|القوات\s*(?:البرية|الجوية|البحرية)|علاوة\s*فنية|مكافأة\s*الحاسب|مكافاه\s*الحاسب/.test(profileText);
  const administrativeCase =
    militaryPersonnelCase
    || /ديوان\s*المظالم|المحكمة\s*الإدارية|المحكمه\s*الاداريه|قرار\s*إداري|قرار\s*اداري|جهة\s*إدارية|جهه\s*اداريه/.test(profileText)
    || String(args.court || '').toLowerCase().includes('administrative');

  const personnelPacket = sourceBundle.packets.find((packet) => packet.agentId === 'src-personnel');
  const bogPacket = sourceBundle.packets.find((packet) => packet.agentId === 'src-bog');

  const hardBlockers: string[] = [];
  if (route.blocking) hardBlockers.push(route.reason);
  if (citationGuard.blocked) {
    hardBlockers.push('المسودة أدخلت إحالة قانونية جديدة غير متحققة من حزمة المصادر الرسمية.');
  }
  if (sourceBundle.verification.officialSources === 0) {
    hardBlockers.push('لا يوجد مصدر رسمي متحقق كافٍ للمسودة.');
  }
  if (militaryPersonnelCase && (personnelPacket?.verifiedArticles.length || 0) === 0) {
    hardBlockers.push('القضية العسكرية/الوظيفية لم تربط بمادة متحققة من نظام خدمة الأفراد.');
  }
  if (administrativeCase && (bogPacket?.verifiedArticles.length || 0) === 0) {
    hardBlockers.push('القضية الإدارية لم تربط بمادة متحققة من منظومة ديوان المظالم.');
  }
  for (const blocker of sourceBundle.verification.blockers) {
    if (
      /ذُكرت مواد|سجل مادة متحقق|غير متحقق|needs-correction|لم يعثر الفهرس على مادة|أداة الإصدار غير مكتملة|م\/37/i.test(blocker)
    ) {
      hardBlockers.push(blocker);
    }
  }

  const prompt = `${lawOfficeInstruction}

${courtProfileInstruction}

[بوابة اعتماد المسودة قبل إظهارها للعميل]
هذه ليست مهمة صياغة جديدة. افحص المسودة الحالية فقط، ولا تحسنها ولا تعيد كتابتها.
لا تمنح PASS للمجاملة. إذا كانت نقطة جوهرية غير متحققة فاختر BLOCK أو RETURN.

اختبر إلزامياً:
1) المحكمة والمرحلة وطريق الدعوى/الاعتراض.
2) السريان الزمني ومرتبة المصدر.
3) كل عنصر جوهري: الواقعة → الدليل → السند → الأثر.
4) الاستثناءات والقيود، خصوصاً منع الجمع والحدود المالية والشروط الخاصة عند صلتها.
5) أقوى دفع للخصم وهل عولج فعلاً.
6) في النقض: الفرق بين إعادة وزن الدليل وبين التكييف/الإغفال/التسبيب/الخطأ النظامي.
7) التناقضات بين الوقائع والدليل والدفع وأسباب الحكم.
8) هل الأسباب تنتج الطلب النهائي فعلاً.
9) لا تنسب توجهاً لمحكمة أو قاضٍ إلا من سابقة رسمية متحققة.

أعد JSON فقط:
{
  "gateDecision": "PASS|RETURN|BLOCK",
  "fatalDefects": [],
  "temporalErrors": [],
  "hierarchyErrors": [],
  "exceptionErrors": [],
  "rebuttalErrors": [],
  "evidenceErrors": [],
  "remedyErrors": [],
  "contradictions": []
}

حزمة المصادر:
${sourceBundle.context}

المسودة:
${draft.slice(0, 30000)}
`;

  let review: ReviewShape | null = null;
  let provider = '';
  let lastError: unknown;
  const clients = geminiClients();

  outer: for (const model of USER_AI_MODELS) {
    if (isModelCoolingDown(model)) continue;
    for (let clientIndex = 0; clientIndex < clients.length; clientIndex += 1) {
      try {
        const response = await withTimeout(
          clients[clientIndex].models.generateContent({
            model,
            contents: prompt,
            config: { temperature: 0.02 },
          }),
          28_000,
          'DRAFT_RELEASE_GATE_TIMEOUT',
        );
        review = parseJson(response.text || '');
        if (review) {
          provider = `key${clientIndex + 1}:${model}`;
          break outer;
        }
      } catch (error) {
        lastError = error;
        if (isQuotaError(error)) {
          markModelQuotaError(model, error);
          break;
        }
      }
    }
  }

  if (!review) {
    console.error('Draft release gate unavailable:', lastError instanceof Error ? lastError.message : lastError);
    return {
      gateDecision: 'BLOCK',
      readinessScore: 0,
      readinessTarget: 95,
      idealReadinessTarget: 99,
      hardBlockers: [...hardBlockers, 'تعذر تشغيل القاضي الافتراضي على المسودة.'],
      materialFindings: [],
      sourceBlockers: sourceBundle.verification.blockers,
      verifiedArticles: sourceBundle.verification.verifiedArticles,
      officialSources: sourceBundle.verification.officialSources,
    };
  }

  const materialFindings = [
    ...stringArray(review.fatalDefects),
    ...stringArray(review.temporalErrors),
    ...stringArray(review.hierarchyErrors),
    ...stringArray(review.exceptionErrors),
    ...stringArray(review.rebuttalErrors),
    ...stringArray(review.evidenceErrors),
    ...stringArray(review.remedyErrors),
    ...stringArray(review.contradictions),
  ];

  for (const fatal of stringArray(review.fatalDefects)) hardBlockers.push(fatal);

  let readinessScore = 100;
  readinessScore -= Math.min(35, hardBlockers.length * 15);
  readinessScore -= stringArray(review.temporalErrors).length * 12;
  readinessScore -= stringArray(review.hierarchyErrors).length * 10;
  readinessScore -= stringArray(review.exceptionErrors).length * 12;
  readinessScore -= stringArray(review.rebuttalErrors).length * 6;
  readinessScore -= stringArray(review.evidenceErrors).length * 7;
  readinessScore -= stringArray(review.remedyErrors).length * 8;
  readinessScore -= stringArray(review.contradictions).length * 8;
  readinessScore = Math.max(0, Math.min(100, readinessScore));

  const requested = String(review.gateDecision || '').toUpperCase();
  let gateDecision: DraftReleaseGateDecision = 'RETURN';
  if (hardBlockers.length > 0 || requested === 'BLOCK') {
    gateDecision = 'BLOCK';
  } else if (requested === 'PASS' && readinessScore >= 95 && materialFindings.length === 0) {
    gateDecision = 'PASS';
  }

  return {
    gateDecision,
    readinessScore,
    readinessTarget: 95,
    idealReadinessTarget: 99,
    hardBlockers: Array.from(new Set(hardBlockers)),
    materialFindings: Array.from(new Set(materialFindings)),
    sourceBlockers: sourceBundle.verification.blockers,
    verifiedArticles: sourceBundle.verification.verifiedArticles,
    officialSources: sourceBundle.verification.officialSources,
    provider,
  };
}
