import { runLegalSourceAgents, type LegalSourceAgentBundle } from '../src/lib/legalSourceAgents.js';
import { guardIntroducedLegalCitations } from '../src/lib/legalCitationGuard.js';
import { assessClaimLiberation } from '../src/lib/claimLiberationGate.js';
import { buildAgentContractInstruction } from '../src/lib/agentContracts.js';
import { buildCourtProfileInstruction } from '../src/lib/courtProfiles.js';
import { buildCaseStrategyInstruction } from '../src/lib/caseStrategyProfiles.js';
import { buildDeadlinesInstruction } from '../src/lib/litigationDeadlines.js';
import { buildJurisdictionInstruction, identifyCourt, jurisdictionIssuesFor } from '../src/lib/courtJurisdiction.js';
import {
  LAWYER_TEAM,
  MAX_SESSION_ROUNDS,
  benchSeatsFor,
  buildCourtRoster,
  clientPartyLabel,
  deliberatingSeatsFor,
  isCourtLevelId,
  isCourtSystemId,
  normalizeBenchRuling,
  normalizeDefenseBrief,
  normalizeProsecutionBrief,
  pleadingTypeFor,
  resolveSessionDecision,
  type BenchRuling,
  type ClientRole,
  type CourtLevelId,
  type CourtSystemId,
  type DefenseBrief,
  type DeterministicFindings,
  type ProsecutionBrief,
  type SessionDecision,
} from '../src/lib/judicialSystem.js';
import { redactDirectIdentifiers } from './_privacy.js';

export type CourtStageId = 'defense' | 'prosecution' | 'bench';

export type CourtCaseFile = {
  title: string;
  facts: string;
  requests: string;
  documentsText: string;
};

export type CourtStageInput = {
  stage: CourtStageId;
  systemId: CourtSystemId;
  levelId: CourtLevelId;
  clientRole: ClientRole;
  round: number;
  caseFile: CourtCaseFile;
  defense?: DefenseBrief;
  prosecution?: ProsecutionBrief;
  priorDefense?: DefenseBrief;
  priorProsecution?: ProsecutionBrief;
  priorBench?: BenchRuling;
};

export type CourtAttachmentPart = { inlineData: { mimeType: string; data: string } };

export type CourtGenerator = (
  prompt: string,
  options: { temperature: number; attachments: CourtAttachmentPart[] },
) => Promise<string>;

export type CourtSourceAudit = {
  officialSources: number;
  verifiedArticles: number;
  blockers: string[];
  literalQuotationReady: boolean;
  precedentCorpusReady: boolean;
};

export type CourtStageResult =
  | {
      stage: 'defense';
      round: number;
      brief: DefenseBrief;
      findings: DeterministicFindings;
      droppedAuthorities: string[];
      sourceAudit: CourtSourceAudit;
      redactions: number;
    }
  | { stage: 'prosecution'; round: number; brief: ProsecutionBrief; redactions: number }
  | {
      stage: 'bench';
      round: number;
      ruling: BenchRuling;
      decision: SessionDecision;
      findings: DeterministicFindings;
      redactions: number;
    };

export class CourtStageError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

const LIMITS = {
  title: 200,
  facts: 30000,
  requests: 4000,
  documentsText: 12000,
  attachments: 2,
  attachmentChars: 3_600_000,
};

const UNVERIFIED_TAG = '[غير متحقق من حزمة المصادر الرسمية]';

// ---------------------------------------------------------------------------
// قراءة الطلب (كل ما يأتي من المتصفح غير موثوق)
// ---------------------------------------------------------------------------

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\u0000/g, '').trim().slice(0, max) : '';
}

function normalizeAttachment(value: unknown): CourtAttachmentPart | null {
  if (!value || typeof value !== 'object') return null;
  const att = value as { name?: unknown; type?: unknown; data?: unknown };
  const data = typeof att.data === 'string' ? att.data.trim() : '';
  if (!data || data.length > LIMITS.attachmentChars) return null;

  const name = String(att.name || '').toLowerCase();
  let mimeType = String(att.type || '').trim().toLowerCase();
  if (mimeType === 'application/octet-stream' || !mimeType.includes('/')) {
    if (name.endsWith('.pdf')) mimeType = 'application/pdf';
    else if (name.endsWith('.png')) mimeType = 'image/png';
    else if (name.endsWith('.jpg') || name.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (name.endsWith('.webp')) mimeType = 'image/webp';
  }
  if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) return null;

  const base64 = data.startsWith('data:') && data.includes(',') ? data.slice(data.indexOf(',') + 1) : data;
  if (!/^[A-Za-z0-9+/=\s]+$/.test(base64.slice(0, 4096))) return null;
  return { inlineData: { mimeType, data: base64 } };
}

export function parseCourtStageRequest(body: unknown):
  | { ok: true; input: CourtStageInput; attachments: CourtAttachmentPart[] }
  | { ok: false; error: string } {
  const source = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const stage = source.stage;
  if (stage !== 'defense' && stage !== 'prosecution' && stage !== 'bench') {
    return { ok: false, error: 'INVALID_STAGE' };
  }
  if (!isCourtSystemId(source.systemId)) return { ok: false, error: 'INVALID_COURT_SYSTEM' };
  if (!isCourtLevelId(source.levelId)) return { ok: false, error: 'INVALID_COURT_LEVEL' };

  const roundNumber = Number(source.round);
  if (!Number.isInteger(roundNumber) || roundNumber < 1 || roundNumber > MAX_SESSION_ROUNDS) {
    return { ok: false, error: 'INVALID_ROUND' };
  }

  const caseRaw = (source.caseFile && typeof source.caseFile === 'object' ? source.caseFile : {}) as Record<string, unknown>;
  const caseFile: CourtCaseFile = {
    title: text(caseRaw.title, LIMITS.title),
    facts: text(caseRaw.facts, LIMITS.facts),
    requests: text(caseRaw.requests, LIMITS.requests),
    documentsText: text(caseRaw.documentsText, LIMITS.documentsText),
  };
  if (caseFile.facts.length < 30) return { ok: false, error: 'CASE_FACTS_REQUIRED' };

  const levelId = source.levelId;
  const input: CourtStageInput = {
    stage,
    systemId: source.systemId,
    levelId,
    clientRole: source.clientRole === 'defendant' ? 'defendant' : 'claimant',
    round: roundNumber,
    caseFile,
  };

  if (stage === 'prosecution' || stage === 'bench') {
    const defense = normalizeDefenseBrief(source.defense);
    if (!defense.pleading) return { ok: false, error: 'DEFENSE_BRIEF_REQUIRED' };
    input.defense = defense;
  }
  if (stage === 'bench') {
    const prosecution = normalizeProsecutionBrief(source.prosecution);
    if (!prosecution.strongestAttack && prosecution.attacks.length === 0) {
      return { ok: false, error: 'PROSECUTION_BRIEF_REQUIRED' };
    }
    input.prosecution = prosecution;
  }
  if (stage === 'defense' && roundNumber > 1) {
    const priorDefense = normalizeDefenseBrief(source.priorDefense);
    const priorBench = normalizeBenchRuling(source.priorBench, levelId);
    if (!priorDefense.pleading || priorBench.opinions.every((opinion) => !opinion.delivered)) {
      return { ok: false, error: 'PRIOR_ROUND_REQUIRED' };
    }
    input.priorDefense = priorDefense;
    input.priorBench = priorBench;
    input.priorProsecution = normalizeProsecutionBrief(source.priorProsecution);
  }

  const attachments = (Array.isArray(source.attachments) ? source.attachments : [])
    .slice(0, LIMITS.attachments)
    .map(normalizeAttachment)
    .filter((part): part is CourtAttachmentPart => Boolean(part));

  return { ok: true, input, attachments };
}

// ---------------------------------------------------------------------------
// الخصوصية والمصادر والفحوص الحتمية
// ---------------------------------------------------------------------------

function redactDeep<T>(value: T, counter: { count: number }): T {
  if (typeof value === 'string') {
    const result = redactDirectIdentifiers(value);
    counter.count += result.redactions;
    return result.text as T;
  }
  if (Array.isArray(value)) return value.map((item) => redactDeep(item, counter)) as T;
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) output[key] = redactDeep(item, counter);
    return output as T;
  }
  return value;
}

function caseOriginalText(caseFile: CourtCaseFile): string {
  return [caseFile.title, caseFile.facts, caseFile.requests, caseFile.documentsText].filter(Boolean).join('\n');
}

export function buildCourtSourceBundle(input: CourtStageInput): { bundle: LegalSourceAgentBundle; context: string } {
  const roster = buildCourtRoster(input.systemId, input.levelId);
  const bundle = runLegalSourceAgents([
    roster.system.title,
    ...roster.system.sourceHints,
    roster.level.courtName,
    input.caseFile.title,
    input.caseFile.facts.slice(0, 16000),
    input.caseFile.requests,
  ].filter(Boolean).join('\n'), { courtSystem: input.systemId });

  // The deadlines block is part of the verified context, so the citation guard
  // accepts an article cited from it and the judges see the same periods.
  const context = [
    bundle.context,
    `المصادر الرسمية الفريدة: ${bundle.verification.officialSources}`,
    `المواد المفهرسة المتحقق من وجودها: ${bundle.verification.verifiedArticles}`,
    'النص الحرفي الكامل للمواد غير معتمد من المستودع؛ لا يُقتبس نص حرفي إلا إذا ورد في ملف القضية نفسه أو في كتلة المدد النظامية أدناه.',
    'قاعدة السوابق القضائية الرسمية الكاملة غير جاهزة؛ لا يُنسب رقم أو مبدأ إلى حكم غير موجود صراحة في حزمة المصدر.',
    buildDeadlinesInstruction(input.systemId, input.levelId),
  ].filter(Boolean).join('\n\n');

  return { bundle, context };
}

function markerKey(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function assessDefenseFindings(
  input: CourtStageInput,
  defense: DefenseBrief,
  sourceContext: string,
): DeterministicFindings {
  const defenseText = [defense.pleading, ...defense.oralArguments, ...defense.authorities].join('\n');
  const guard = guardIntroducedLegalCitations(caseOriginalText(input.caseFile), defenseText, sourceContext);

  let claimLiberationIssues: string[] = [];
  if (input.levelId === 'first' && input.clientRole === 'claimant') {
    const claim = assessClaimLiberation({ draft: defense.pleading, task: 'claim' });
    if (claim.applicable && !claim.complete) {
      claimLiberationIssues = [
        ...claim.missingPillars.map((pillar) => `قسم ${pillar} مفقود أو غير مكتمل`),
        ...claim.linkageIssues,
      ];
    }
  }

  return {
    unsupportedCitations: Array.from(new Set(guard.unsupportedMarkers.map(markerKey))).slice(0, 20),
    claimLiberationIssues: claimLiberationIssues.slice(0, 8),
    jurisdictionIssues: jurisdictionIssuesFor(input.systemId, identifyCourt(caseOriginalText(input.caseFile))),
  };
}

/** علامات غير متحققة في نص صادر عن أي دور في الجلسة، مقارنةً بملف القضية وحزمة المصادر. */
function guardMarkers(input: CourtStageInput, value: string, sourceContext: string): string[] {
  if (!value) return [];
  return guardIntroducedLegalCitations(caseOriginalText(input.caseFile), value, sourceContext).unsupportedMarkers.map(markerKey);
}

function annotateUnsupported(value: string, markers: string[]): string {
  let output = value;
  for (const marker of markers) {
    if (!marker || output.includes(`${marker} ${UNVERIFIED_TAG}`)) continue;
    output = output.split(marker).join(`${marker} ${UNVERIFIED_TAG}`);
  }
  return output;
}

// ---------------------------------------------------------------------------
// المطالبات (prompts)
// ---------------------------------------------------------------------------

function bullet(items: string[], empty = '- لا يوجد'): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : empty;
}

function courtContextBlock(input: CourtStageInput): string {
  const roster = buildCourtRoster(input.systemId, input.levelId);
  return [
    '[المحكمة الافتراضية]',
    `الجهة القضائية: ${roster.system.title}`,
    `المحكمة والدرجة: ${roster.level.courtName} — ${roster.level.shortName}`,
    `وظيفة هذه الدرجة: ${roster.level.mission}`,
    `صفة الموكل: ${clientPartyLabel(input.systemId, input.levelId, input.clientRole)}`,
    `المحرر المطلوب من الدفاع: ${pleadingTypeFor(input.systemId, input.levelId, input.clientRole)}`,
    'محاور تخصص هذه الجهة القضائية:',
    bullet(roster.system.lawyerFocus),
    '',
    buildJurisdictionInstruction(input.systemId, identifyCourt(caseOriginalText(input.caseFile))),
    '',
    buildCourtProfileInstruction(roster.level.profileHint),
  ].join('\n');
}

function caseFileBlock(caseFile: CourtCaseFile): string {
  return [
    '[ملف القضية — المصدر الوحيد للوقائع]',
    caseFile.title ? `العنوان: ${caseFile.title}` : '',
    'الوقائع / المسودة / نص الحكم:',
    '"""',
    caseFile.facts,
    '"""',
    caseFile.requests ? `ما يريد الموكل كسبه: ${caseFile.requests}` : '',
    caseFile.documentsText ? `بيانات المرفقات: ${caseFile.documentsText}` : '',
  ].filter(Boolean).join('\n');
}

function defenseBlock(defense: DefenseBrief, title = '[مرافعة فريق الدفاع]'): string {
  const facts = defense.lawyers.find((lawyer) => lawyer.roleId === 'facts-references');
  return [
    title,
    defense.theory ? `نظرية القضية: ${defense.theory}` : '',
    facts?.delivered ? `مصفوفة الوقائع كما قدمها الدفاع (ادعاء يحتاج إثباتاً):\n${bullet(facts.points)}` : '',
    'المذكرة:',
    '"""',
    defense.pleading,
    '"""',
    `الطلبات:\n${bullet(defense.requests)}`,
    `الحجج الشفهية:\n${bullet(defense.oralArguments)}`,
    `الأسانيد التي ذكرها الدفاع:\n${bullet(defense.authorities)}`,
  ].filter(Boolean).join('\n');
}

function prosecutionBlock(prosecution: ProsecutionBrief, title = '[مرافعة المدعي العام]'): string {
  return [
    title,
    `أقوى هجوم: ${prosecution.strongestAttack || 'لم يحدد'}`,
    'الهجمات:',
    prosecution.attacks.length
      ? prosecution.attacks.map((attack, index) => `${index + 1}. [${attack.severity}] (${attack.target}) ${attack.point}`).join('\n')
      : '- لا يوجد',
    prosecution.demands ? `طلبات المدعي العام: ${prosecution.demands}` : '',
  ].filter(Boolean).join('\n');
}

function benchBlock(ruling: BenchRuling, level: CourtLevelId): string {
  const seats = benchSeatsFor(level);
  const seatTitle = (seatId: string) => seats.find((seat) => seat.id === seatId)?.title || seatId;
  return [
    '[حكم الهيئة في الجولة السابقة]',
    `النتيجة: ${ruling.finalJudgment.outcome}`,
    ruling.finalJudgment.operative ? `المنطوق: ${ruling.finalJudgment.operative}` : '',
    `الأسباب:\n${bullet(ruling.finalJudgment.reasons)}`,
    'آراء الهيئة:',
    ruling.opinions.map((opinion) => `- ${seatTitle(opinion.seatId)} (${opinion.vote}): ${opinion.reasoning}`).join('\n'),
    `عيوب قابلة للعلاج حددتها الهيئة:\n${bullet(ruling.curableDefects)}`,
    `نواقص إثبات حددتها الهيئة:\n${bullet(ruling.evidentiaryGaps)}`,
  ].filter(Boolean).join('\n');
}

function pleadingStructure(input: CourtStageInput): string {
  if (input.levelId === 'supreme') {
    return 'البيانات، الحكم محل الاعتراض، أسباب النقض (كل سبب: العيب النظامي أو الإجرائي أو التسبيبي ← موضعه في الحكم ← سنده ← أثره في النتيجة)، الطلبات';
  }
  if (input.levelId === 'appeal') {
    return 'البيانات، الحكم محل الاعتراض، أسباب الاعتراض (كل سبب: الخطأ ← موضعه في الحكم ← السند أو الدليل ← الأثر)، الطلبات';
  }
  if (input.clientRole === 'defendant') {
    return input.systemId === 'criminal'
      ? 'البيانات، ملخص الاتهام، الدفوع الإجرائية، الدفوع الموضوعية ومناقشة الأدلة، المستندات، الطلبات'
      : 'البيانات، ملخص الدعوى المقامة، الدفوع الشكلية، الدفوع الموضوعية، المستندات، الطلبات';
  }
  return 'البيانات، الوقائع (مع الأسانيد والحجج)، المستندات، الطلبات — بهذه العناوين وهذا الترتيب';
}

export function buildDefensePrompt(input: CourtStageInput, sourceContext: string): string {
  const roster = buildCourtRoster(input.systemId, input.levelId);
  const pleadingType = pleadingTypeFor(input.systemId, input.levelId, input.clientRole);
  const priorFindings = input.priorDefense ? assessDefenseFindings(input, input.priorDefense, sourceContext) : null;

  const roundBlock = input.round > 1 && input.priorDefense && input.priorBench
    ? [
        `[الجولة ${input.round}: حكم الجولة السابقة لم يكن لصالح الموكل — المطلوب نسخة أقوى]`,
        benchBlock(input.priorBench, input.levelId),
        input.priorProsecution ? prosecutionBlock(input.priorProsecution, '[هجوم المدعي العام في الجولة السابقة]') : '',
        priorFindings?.unsupportedCitations.length
          ? `إحالات غير متحققة يجب حذفها أو استبدالها بسند من الحزمة:\n${bullet(priorFindings.unsupportedCitations)}`
          : '',
        priorFindings?.claimLiberationIssues.length
          ? `نواقص تحرير الدعوى التي رصدتها البوابة:\n${bullet(priorFindings.claimLiberationIssues)}`
          : '',
        'عالجوا كل سبب حكم ضد الموكل: بالرد الحاسم، أو إعادة التكييف، أو تعديل الطلبات إلى ما يمكن الحكم به، أو إضافة طلب احتياطي، أو نقل ما لا يُعالج إلا بالدليل إلى missingEvidence. لا تكرروا المذكرة السابقة؛ ابنوا نسخة أقوى منها.',
        defenseBlock(input.priorDefense, '[مذكرة الجولة السابقة]'),
      ].filter(Boolean).join('\n\n')
    : '';

  return [
    LAWYER_TEAM.map((seat) => buildAgentContractInstruction(seat.contractId)).join('\n\n'),
    courtContextBlock(input),
    buildCaseStrategyInstruction(caseOriginalText(input.caseFile), input.systemId),
    [
      '[تكليف فريق الدفاع]',
      `أنتم فريق دفاع من ستة محامين يعملون معاً لموكل واحد أمام ${roster.level.courtName} (${roster.system.title}).`,
      'الهدف: كسب القضية لصالح الموكل بكل وسيلة مشروعة — أقوى نظرية، أقوى ترتيب للحجج، سد كل ثغرة قبل أن يراها الخصم، واستباق كل دفع للمدعي العام.',
      'توزيع العمل:',
      LAWYER_TEAM.map((seat) => `- ${seat.title} (${seat.id}): ${seat.mission}`).join('\n'),
      'حدود لا تُتجاوز مهما كان الهدف:',
      '- لا تخترعوا واقعة أو مستنداً أو تاريخاً أو مبلغاً غير وارد في ملف القضية أو مرفقاته.',
      '- لا تذكروا مادة أو نظاماً أو قراراً أو حكماً أو مبدأً إلا إذا ورد في ملف القضية أو في حزمة المصادر الرسمية أدناه.',
      '- لا تعِدوا الموكل بنتيجة؛ القوة تأتي من الحجة والدليل لا من الوعد.',
      '- ما لا يمكن إثباته من الملف يُنقل إلى missingEvidence ولا يُدّعى.',
      '- استخرجوا من المرفقات المرسلة ما فيها فعلاً، وصرّحوا بما لم يُقرأ.',
    ].join('\n'),
    roundBlock,
    sourceContext,
    caseFileBlock(input.caseFile),
    [
      'أعيدوا JSON صالحاً فقط دون أي نص خارجه، بهذه المفاتيح:',
      '{',
      '  "theory": "نظرية القضية الفائزة في فقرة واحدة",',
      '  "lawyers": [',
      ...LAWYER_TEAM.map((seat, index) => `    {"roleId":"${seat.id}","summary":"جملتان","points":["3 إلى 6 نقاط محددة"]}${index < LAWYER_TEAM.length - 1 ? ',' : ''}`),
      '  ],',
      `  "pleading": "النص الكامل لـ${pleadingType} (600 إلى 1500 كلمة) بالترتيب: ${pleadingStructure(input)}",`,
      '  "requests": ["طلب جازم محدد قابل للحكم به"],',
      '  "oralArguments": ["حجة موجزة تُلقى أمام القاضي"],',
      '  "missingEvidence": ["مستند أو واقعة يلزم أن يقدمها الموكل"],',
      '  "authorities": ["اسم النظام — المادة (رقم) كما وردت في حزمة المصادر أو ملف القضية فقط"]',
      '}',
      'اكتبوا كل القيم بالعربية الفصحى القضائية. لا تذكروا بيانات هوية أو أرقام اتصال.',
    ].join('\n'),
  ].filter(Boolean).join('\n\n');
}

export function buildProsecutionPrompt(input: CourtStageInput, sourceContext: string): string {
  const roster = buildCourtRoster(input.systemId, input.levelId);
  return [
    buildAgentContractInstruction(roster.prosecutor.contractId),
    courtContextBlock(input),
    [
      `[${roster.prosecutor.title}]`,
      `أنت المدعي العام في هذه المحاكاة (${roster.prosecutor.represents}).`,
      roster.prosecutor.focus,
      'مهمتك مهاجمة موقف الموكل بأقوى صورة مشروعة؛ قوة الدفاع لا تُعرف إلا أمام أقوى خصم.',
      input.levelId === 'supreme'
        ? 'في النقض: بيّن لماذا أسباب النقض مجرد مجادلة في وزن الدليل أو لا أثر لها في النتيجة، متى كان ذلك صحيحاً.'
        : 'هاجم الاختصاص والقبول والمواعيد والصفة والإثبات والتكييف والطلبات متى وجد لذلك سبب في الملف.',
      'حدود: لا تخترع واقعة أو دليلاً أو مادة أو عقوبة أو حكماً؛ هاجم بما في الملف وحزمة المصادر وبالثغرات المنطقية والإجرائية والإثباتية.',
    ].join('\n'),
    sourceContext,
    caseFileBlock(input.caseFile),
    input.defense ? defenseBlock(input.defense) : '',
    [
      'أعد JSON صالحاً فقط دون أي نص خارجه:',
      '{',
      '  "strongestAttack": "أقوى هجوم في فقرة واحدة",',
      '  "attacks": [{"point":"الهجوم ووجهه","target":"الاختصاص|القبول|المواعيد|الصفة|الإثبات|التكييف|الطلبات|السند النظامي","severity":"high|medium|low"}],',
      '  "demands": "ما يطلبه المدعي العام من المحكمة"',
      '}',
      'رتب attacks من الأقوى إلى الأضعف، من 3 إلى 8 هجمات.',
    ].join('\n'),
  ].filter(Boolean).join('\n\n');
}

export function buildBenchPrompt(
  input: CourtStageInput,
  sourceContext: string,
  findings: DeterministicFindings,
): string {
  const roster = buildCourtRoster(input.systemId, input.levelId);
  const deliberating = deliberatingSeatsFor(input.levelId);
  const contractIds = Array.from(new Set(roster.bench.map((seat) => seat.contractId)));

  const rules = input.levelId === 'supreme'
    ? [
        'دائرة نقض من ثلاثة قضاة: كل قاضٍ يصوّت برأي مسبب، والقرار بالأغلبية.',
        'لا تعيدوا وزن الأدلة كمحكمة موضوع؛ ابحثوا عن العيب النظامي أو الإجرائي أو التسبيبي المؤثر فقط.',
        'ميّزوا: مجادلة تقدير الدليل (مرفوضة)، الخطأ في تكييف الواقعة، إغفال مستند حاسم، قصور أو تناقض الأسباب، الخطأ في تطبيق النص أو الاستثناء.',
        'إذا كان المسار غير صحيح لهذه الدرجة فالنتيجة not-ready.',
      ]
    : input.levelId === 'appeal'
      ? [
          'وكيلا القاضي يقدمان رأيين مستقلين، ثم يصدر رئيس الدائرة الحكم.',
          'انظروا في حدود أسباب الاعتراض وما يتصل بها، ولا تعيدوا كتابة الدعوى من الصفر.',
          'إذا لم يتضمن الملف الحكم الابتدائي أو بياناته الجوهرية فالنتيجة not-ready.',
        ]
      : [
          'وكيلا القاضي يقدمان رأيين مستقلين، ثم يصدر القاضي ناظر القضية الحكم.',
          'افحصوا الاختصاص والقبول قبل الموضوع، ثم الإثبات ومقدار الحق والطلبات.',
          'إذا كان نقص الملف يمنع الفصل فالنتيجة not-ready.',
        ];

  return [
    contractIds.map((id) => buildAgentContractInstruction(id)).join('\n\n'),
    courtContextBlock(input),
    buildCaseStrategyInstruction(caseOriginalText(input.caseFile), input.systemId),
    [
      `[هيئة الحكم — ${roster.level.courtName}]`,
      'الحياد واجب: لا تجاملوا الموكل ولا المدعي العام. الحكم للحجة الأقوى والدليل الثابت والسند المتحقق.',
      'تشكيل الهيئة:',
      roster.bench.map((seat) => `- ${seat.title} (${seat.id}): ${seat.focus}`).join('\n'),
      'قواعد المداولة:',
      bullet(rules),
      '- أي إحالة نظامية غير متحققة في مذكرة الدفاع لا يُعتد بها.',
      '- ميّزوا بين ما يعالجه المحامون بالحجة أو الصياغة أو تعديل الطلب (curableDefects) وما لا يعالج إلا بدليل أو واقعة من الموكل (evidentiaryGaps).',
      '- هذه محاكاة تحليلية؛ اكتبوا المنطوق بصيغة الحكم المحاكى دون ادعاء أنه حكم قضائي فعلي.',
    ].join('\n'),
    [
      '[نتائج الفحص الآلي على مذكرة الدفاع]',
      `إحالات غير متحققة:\n${bullet(findings.unsupportedCitations)}`,
      `نواقص تحرير الدعوى:\n${bullet(findings.claimLiberationIssues)}`,
      `عدم اختصاص ثابت من مؤشرات الملف:\n${bullet(findings.jurisdictionIssues || [])}`,
    ].join('\n'),
    sourceContext,
    caseFileBlock(input.caseFile),
    input.defense ? defenseBlock(input.defense) : '',
    input.prosecution ? prosecutionBlock(input.prosecution) : '',
    [
      'أعيدوا JSON صالحاً فقط دون أي نص خارجه:',
      '{',
      '  "opinions": [',
      ...deliberating.map((seat, index) => `    {"seatId":"${seat.id}","vote":"favorable|partial|unfavorable","reasoning":"رأي مسبب","decisiveIssues":["مسألة حاسمة"]}${index < deliberating.length - 1 ? ',' : ''}`),
      '  ],',
      '  "finalJudgment": {"outcome":"favorable|partial|unfavorable|not-ready","operative":"منطوق الحكم المحاكى","reasons":["سبب"]},',
      '  "curableDefects": ["عيب يعالجه الدفاع بالحجة أو الصياغة أو تعديل الطلب"],',
      '  "evidentiaryGaps": ["نقص لا يعالج إلا بمستند أو واقعة من الموكل"]',
      '}',
      'vote وoutcome من منظور الموكل: favorable يعني لصالحه.',
    ].join('\n'),
  ].filter(Boolean).join('\n\n');
}

// ---------------------------------------------------------------------------
// التشغيل
// ---------------------------------------------------------------------------

export function parseModelJson(raw: string): unknown {
  const value = (raw || '').trim();
  if (!value) return null;
  const candidates = [value, value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()];
  const match = value.match(/\{[\s\S]*\}/);
  if (match) candidates.push(match[0]);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function sourceAuditFrom(bundle: LegalSourceAgentBundle): CourtSourceAudit {
  return {
    officialSources: bundle.verification.officialSources,
    verifiedArticles: bundle.verification.verifiedArticles,
    blockers: bundle.verification.blockers.slice(0, 4),
    literalQuotationReady: bundle.verification.literalQuotationReady,
    precedentCorpusReady: bundle.verification.precedentCorpusReady,
  };
}

export async function runCourtStage(
  rawInput: CourtStageInput,
  generate: CourtGenerator,
  attachments: CourtAttachmentPart[] = [],
): Promise<CourtStageResult> {
  // Never forward direct identifiers to the AI provider, and never echo them back.
  const counter = { count: 0 };
  const input = redactDeep(rawInput, counter);
  const { bundle, context } = buildCourtSourceBundle(input);

  const ask = async (prompt: string, temperature: number): Promise<unknown> => {
    const raw = await generate(prompt, { temperature, attachments });
    if (!raw.trim()) throw new CourtStageError('AI_UNAVAILABLE', 503);
    const parsed = parseModelJson(raw);
    if (!parsed) throw new CourtStageError('AI_INVALID_RESPONSE', 502);
    return redactDeep(parsed, counter);
  };

  if (input.stage === 'defense') {
    const brief = normalizeDefenseBrief(await ask(buildDefensePrompt(input, context), 0.35));
    if (!brief.pleading) throw new CourtStageError('AI_INVALID_RESPONSE', 502);

    const findings = assessDefenseFindings(input, brief, context);
    const unsupported = new Set(findings.unsupportedCitations);
    const droppedAuthorities = brief.authorities.filter((authority) => [...unsupported].some((marker) => authority.includes(marker)));
    brief.authorities = brief.authorities.filter((authority) => !droppedAuthorities.includes(authority));
    brief.pleading = annotateUnsupported(brief.pleading, findings.unsupportedCitations);
    brief.oralArguments = brief.oralArguments.map((item) => annotateUnsupported(item, findings.unsupportedCitations));
    brief.theory = annotateUnsupported(brief.theory, guardMarkers(input, brief.theory, context));

    return {
      stage: 'defense',
      round: input.round,
      brief,
      findings,
      droppedAuthorities,
      sourceAudit: sourceAuditFrom(bundle),
      redactions: counter.count,
    };
  }

  if (input.stage === 'prosecution') {
    const brief = normalizeProsecutionBrief(await ask(buildProsecutionPrompt(input, context), 0.3));
    if (!brief.strongestAttack && brief.attacks.length === 0) throw new CourtStageError('AI_INVALID_RESPONSE', 502);
    // المدعي العام يخضع لحارس الاستشهادات كالدفاع: مادة أو قرار أو «استقرار قضاء» بلا سند يوسم.
    const tag = (value: string) => annotateUnsupported(value, guardMarkers(input, value, context));
    brief.strongestAttack = tag(brief.strongestAttack);
    brief.attacks = brief.attacks.map((attack) => ({ ...attack, point: tag(attack.point) }));
    brief.demands = tag(brief.demands);
    return { stage: 'prosecution', round: input.round, brief, redactions: counter.count };
  }

  // Bench: findings are recomputed on the server from the submitted defense brief,
  // so a client cannot hide unverified citations from the judges.
  const findings = assessDefenseFindings(input, input.defense as DefenseBrief, context);
  const ruling = normalizeBenchRuling(await ask(buildBenchPrompt(input, context, findings), 0.1), input.levelId);
  if (ruling.opinions.every((opinion) => !opinion.delivered) && !ruling.finalJudgment.operative) {
    throw new CourtStageError('AI_INVALID_RESPONSE', 502);
  }
  // أسباب القضاة ومنطوقهم: ما يُسند إلى مادة أو سابقة غير متحققة يوسم قبل العرض.
  const tag = (value: string) => annotateUnsupported(value, guardMarkers(input, value, context));
  ruling.opinions = ruling.opinions.map((opinion) => ({ ...opinion, reasoning: tag(opinion.reasoning) }));
  ruling.finalJudgment = { ...ruling.finalJudgment, operative: tag(ruling.finalJudgment.operative), reasons: ruling.finalJudgment.reasons.map(tag) };
  const resolved = resolveSessionDecision(ruling, input.levelId, input.round, findings);
  return {
    stage: 'bench',
    round: input.round,
    ruling: resolved.ruling,
    decision: resolved.decision,
    findings,
    redactions: counter.count,
  };
}
