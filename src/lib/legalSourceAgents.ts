import {
  retrieveOfficialJudicialAmendments,
  retrieveOfficialJudicialRegulations,
  retrieveOfficialLegalReferences,
  retrieveVerifiedMilitaryPersonnelRights,
} from './legalRetrieval.js';
import type { OfficialReferenceSystem } from '../data/officialReferenceIndex.js';
import { BOARD_OF_GRIEVANCES_LAW_1428 } from '../data/officialReferences/boardOfGrievancesLaw1428.js';
import { BOARD_OF_GRIEVANCES_PROCEDURE_LAW_1435 } from '../data/officialReferences/boardOfGrievancesProcedureLaw1435.js';
import { BOARD_OF_GRIEVANCES_EXECUTION_LAW_1443 } from '../data/officialReferences/boardOfGrievancesExecutionLaw1443.js';
import { CIVIL_PROCEDURE_LAW_1435 } from '../data/officialReferences/civilProcedureLaw1435.js';
import { COMMERCIAL_COURTS_LAW_1441 } from '../data/officialReferences/commercialCourtsLaw1441.js';
import { CRIMINAL_PROCEDURE_LAW_1435 } from '../data/officialReferences/criminalProcedureLaw1435.js';
import { EXECUTION_LAW_1447 } from '../data/officialReferences/executionLaw1447.js';
import { JUDICIARY_LAW_1428 } from '../data/officialReferences/judiciaryLaw1428.js';
import { LAW_PRACTICE_LAW_1422 } from '../data/officialReferences/lawPracticeLaw1422.js';
import { PERSONNEL_SERVICE_LAW_1397 } from '../data/officialReferences/personnelServiceLaw1397.js';
import {
  PERSONNEL_USER_TRANSCRIPT_META,
  retrievePersonnelUserReviewExcerpts,
} from '../data/reviewReferences/personnelServiceLaw1397UserTranscript.js';
import { COURT_CORE_LAWS, isSourceForeignToCourt } from './courtJurisdiction.js';
import { getCourtSystem, type CourtSystemId } from './judicialSystem.js';

export type SourceAgentStatus = 'success' | 'warning' | 'error';

export type LegalSourceAgentRun = {
  id: string;
  label: string;
  status: SourceAgentStatus;
  durationMs: number;
  summary: string;
  matchedSources: number;
  blockers: string[];
};

export type LegalSourcePacket = {
  agentId: string;
  label: string;
  status: SourceAgentStatus;
  scope: string;
  references: Array<{
    name: string;
    authority?: string;
    sourceUrl: string;
    issueInstrument?: string;
    coverage?: string;
    note: string;
  }>;
  verifiedArticles: Array<{
    system: string;
    article: string;
    sourceUrl: string;
    note: string;
  }>;
  reviewMaterials?: Array<{
    title: string;
    excerpt: string;
    provenance: 'user-supplied';
    status: 'review-only-unverified';
    note: string;
  }>;
  blockers: string[];
};

export type LegalSourceAgentBundle = {
  packets: LegalSourcePacket[];
  runs: LegalSourceAgentRun[];
  context: string;
  verification: {
    officialSources: number;
    verifiedArticles: number;
    blockers: string[];
    literalQuotationReady: boolean;
    precedentCorpusReady: boolean;
  };
};

const DETAILED_REFERENCE_SYSTEMS: OfficialReferenceSystem[] = [
  BOARD_OF_GRIEVANCES_LAW_1428,
  BOARD_OF_GRIEVANCES_PROCEDURE_LAW_1435,
  BOARD_OF_GRIEVANCES_EXECUTION_LAW_1443,
  CIVIL_PROCEDURE_LAW_1435,
  COMMERCIAL_COURTS_LAW_1441,
  CRIMINAL_PROCEDURE_LAW_1435,
  EXECUTION_LAW_1447,
  JUDICIARY_LAW_1428,
  LAW_PRACTICE_LAW_1422,
  PERSONNEL_SERVICE_LAW_1397,
];

function normalizeArabic(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[^\p{L}\p{N}\s/]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAny(value: string, terms: string[]): boolean {
  const normalized = normalizeArabic(value);
  return terms.some((term) => normalized.includes(normalizeArabic(term)));
}

/** مطابقة كلمة أو عبارة كاملة (لا تعمل \b مع العربية): «عريف» لا تتطابق داخل «تعريف». */
function containsWord(value: string, terms: string[]): boolean {
  const normalized = normalizeArabic(value);
  return terms.some((term) => new RegExp(`(?:^|\\s)${normalizeArabic(term)}(?=\\s|$)`).test(normalized));
}

function sourceRelevantToQuery(sourceLabel: string, query: string): boolean {
  const q = normalizeArabic(query);
  const label = normalizeArabic(sourceLabel);

  const criminalQuery = containsAny(q, ['جزائي', 'جريمه', 'جنايه', 'نيابه', 'متهم', 'قبض', 'تفتيش', 'توقيف', 'تحقيق جنائي', 'عقوبه']);
  const administrativeQuery = containsAny(q, ['ديوان المظالم', 'اداري', 'وزاره', 'جهه اداريه', 'عسكري', 'خدمه الافراد', 'وظيفي', 'ترقيه', 'بدل', 'علاوه', 'مكافاه']);
  const civilMoneyQuery = containsAny(q, ['سلف', 'قرض', 'دين', 'تحويل بنكي', 'مطالبه ماليه', 'عقد', 'حقوقي', 'المحكمه العامه']);

  const criminalSource = containsAny(label, ['النيابه العامه', 'الاجراءات الجزائيه', 'جزائي']);
  const administrativeSource = containsAny(label, ['ديوان المظالم', 'المرافعات امام ديوان', 'التنفيذ امام ديوان', 'خدمه الافراد']);

  if (!criminalQuery && criminalSource) return false;
  if (civilMoneyQuery && !administrativeQuery && administrativeSource) return false;
  if (criminalQuery && !administrativeQuery && administrativeSource) return false;
  return true;
}

/** هل يشير الاستفسار (مطبَّعاً) إلى أداة التعديل الموصوفة في العنوان: رقم مرسومها أو المادة التي تعدلها؟ */
function referencesAmendment(normalizedQuery: string, label: string): boolean {
  const query = normalizedQuery.replace(/\s*\/\s*/g, '/');
  const decrees = Array.from(label.matchAll(/م\s*\/\s*(\d+)/g)).map((match) => match[1]);
  if (decrees.some((number) => new RegExp(`(?:^|[^\\p{L}\\p{N}])م\\s*/?\\s*${number}(?![0-9])`, 'u').test(query))) return true;
  const amendedArticles = Array.from(label.matchAll(/الماد(?:ة|ه)\s*\((\d+)\s*\/\s*([ء-ي])\)/g));
  return amendedArticles.some((match) => new RegExp(`(?:^|\\s)${match[1]}\\s*/?\\s*${normalizeArabic(match[2])}(?=\\s|$)`).test(query));
}

type ArticleOwner = 'personnel' | 'bog-law' | 'bog-procedure' | 'bog-execution' | 'other';

/** «المادة 16 من نظام خدمة الأفراد»: رقم المادة منسوباً إلى نظامه، حتى لا يُجلب الرقم نفسه من نظام آخر. */
function articleOwners(query: string): Map<string, Set<ArticleOwner>> {
  const owners = new Map<string, Set<ArticleOwner>>();
  const text = normalizeArabic(latinDigits(query));
  for (const match of text.matchAll(/الماده\s*\(?\s*(\d{1,3})\s*\)?(?:\s*\/\s*\S{1,3})?\s+(?:من\s+)?((?:ال)?نظام[^\n]{0,50}|اللائحه[^\n]{0,50})/g)) {
    const law = match[2];
    const owner: ArticleOwner = /الافراد|خدمه الضباط/.test(law) ? 'personnel'
      : /المرافعات امام ديوان المظالم/.test(law) ? 'bog-procedure'
        : /التنفيذ امام ديوان المظالم/.test(law) ? 'bog-execution'
          : /ديوان المظالم/.test(law) ? 'bog-law' : 'other';
    if (!owners.has(match[1])) owners.set(match[1], new Set());
    owners.get(match[1])!.add(owner);
  }
  return owners;
}

/**
 * أرقام المواد المطلوبة في الاستفسار. مع forSystem تُستبعد الأرقام المنسوبة صراحة إلى نظام آخر:
 * «المادة 16 من نظام خدمة الأفراد» لا تجلب المادة 16 من نظام ديوان المظالم (درجات القضاة).
 */
function articleNumbers(query: string, forSystem?: ArticleOwner): string[] {
  const values = new Set<string>();
  const text = latinDigits(query);
  const patterns = [
    /الماد(?:ة|ه)\s*\(?\s*(\d{1,3})(?:\s*\/\s*(\d{1,3}))?\s*\)?/g,
    /ماد(?:ة|ه)\s*\(?\s*(\d{1,3})(?:\s*\/\s*(\d{1,3}))?\s*\)?/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      values.add(match[2] ? `${match[1]}/${match[2]}` : match[1]);
    }
  }

  const list = Array.from(values).slice(0, 20);
  if (!forSystem) return list;
  const owners = articleOwners(query);
  return list.filter((value) => {
    const owner = owners.get(value.split('/')[0]);
    return !owner || owner.has(forSystem);
  });
}

function packetToContext(packet: LegalSourcePacket): string {
  const lines = [
    `[وكيل مصدر: ${packet.label}]`,
    `الحالة: ${packet.status}`,
    `النطاق: ${packet.scope}`,
  ];

  if (packet.references.length) {
    lines.push('المراجع الرسمية المرتبطة:');
    for (const reference of packet.references) {
      lines.push(
        `- ${reference.name}`,
        reference.authority ? `  الجهة: ${reference.authority}` : '',
        reference.issueInstrument ? `  أداة الإصدار: ${reference.issueInstrument}` : '',
        reference.coverage ? `  تغطية النص: ${reference.coverage}` : '',
        `  المصدر: ${reference.sourceUrl}`,
        `  ملاحظة: ${reference.note}`,
      );
    }
  }

  if (packet.verifiedArticles.length) {
    lines.push('مواد مفهرسة تم التحقق من وجودها في المصدر الرسمي:');
    for (const article of packet.verifiedArticles) {
      lines.push(
        `- ${article.system} — المادة ${article.article}`,
        `  المصدر: ${article.sourceUrl}`,
        `  ملاحظة: ${article.note}`,
      );
    }
  }

  if (packet.reviewMaterials?.length) {
    lines.push(
      'مواد مراجعة داخلية غير رسمية — للمقارنة والاستخراج الأولي فقط، ولا ترفع حالة التحقق ولا تصلح وحدها للاقتباس القضائي:'
    );
    for (const material of packet.reviewMaterials) {
      lines.push(
        `- ${material.title}`,
        `  المصدر الداخلي: ${PERSONNEL_USER_TRANSCRIPT_META.name}`,
        `  الحالة: ${material.status}`,
        `  مقتطف: ${material.excerpt}`,
        `  ملاحظة: ${material.note}`,
      );
    }
  }

  if (packet.blockers.length) {
    lines.push('قيود/موانع اعتماد:');
    for (const blocker of packet.blockers) lines.push(`- ${blocker}`);
  }

  return lines.filter(Boolean).join('\n');
}

function selectDetailedSystems(query: string): OfficialReferenceSystem[] {
  const q = normalizeArabic(query);
  const scored = DETAILED_REFERENCE_SYSTEMS.map((system) => {
    const haystack = normalizeArabic([
      system.name,
      system.royalDecree,
      system.cabinetResolution || '',
      ...system.articles.map((article) => `المادة ${article.number} ${article.note}`),
      ...system.regulations.map((regulation) => `${regulation.name} ${regulation.note}`),
      ...system.amendments.map((amendment) => `${amendment.label} ${amendment.note}`),
      ...system.versions.map((version) => `${version.label} ${version.note}`),
    ].join(' '));

    const queryTokens = q.split(' ').filter((token) => token.length >= 3);
    let score = 0;
    for (const token of queryTokens) {
      if (haystack.includes(token)) score += 1;
      if (normalizeArabic(system.name).includes(token)) score += 6;
    }
    return { system, score };
  });

  return scored
    .filter((item) => item.score > 0)
    .filter((item) => sourceRelevantToQuery(item.system.name, query))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => item.system);
}

function buildBogPacket(query: string): LegalSourcePacket {
  const refs = retrieveOfficialLegalReferences(
    [query, 'ديوان المظالم نظام المرافعات أمام ديوان المظالم التنفيذ الإداري'].join(' '),
    8,
  ).filter((ref) => containsAny(ref.name, ['ديوان المظالم', 'المرافعات أمام ديوان المظالم', 'التنفيذ أمام ديوان المظالم']));

  const regs = retrieveOfficialJudicialRegulations(
    [query, 'ديوان المظالم'].join(' '),
    6,
  ).filter((reg) => containsAny([reg.parentSystem, reg.regulationName].join(' '), ['ديوان المظالم']));

  const details = [
    BOARD_OF_GRIEVANCES_LAW_1428,
    BOARD_OF_GRIEVANCES_PROCEDURE_LAW_1435,
    BOARD_OF_GRIEVANCES_EXECUTION_LAW_1443,
  ];

  // أرقام المواد لكل نظام من أنظمة الديوان الثلاثة على حدة؛ وإن ذكر المستخدم مواد (من أي نظام) فلا تُسرد كل
  // مواد الديوان، بل المطلوب منها مع مواد الاختصاص والتظلم والطعن الحاكمة.
  const ownerOf = (systemId: string): ArticleOwner => systemId === BOARD_OF_GRIEVANCES_PROCEDURE_LAW_1435.id
    ? 'bog-procedure'
    : systemId === BOARD_OF_GRIEVANCES_EXECUTION_LAW_1443.id ? 'bog-execution' : 'bog-law';
  const requestedBySystem = new Map(details.map((system) => [system.id, new Set(articleNumbers(query, ownerOf(system.id)))]));
  const anyArticleRequested = articleNumbers(query).length > 0;
  const normalized = normalizeArabic(query);
  const supremeReview = containsAny(normalized, [
    'المحكمه الاداريه العليا', 'طعن', 'نقض', 'اعتراض', 'ميعاد', 'ثلاثين يوما', 'ثلاثين يوم',
  ]);
  const militaryServiceDispute = containsAny(normalized, [
    'خدمه عسكريه', 'فرد عسكري', 'القوات البريه', 'وزاره الدفاع', 'بدل', 'علاوه', 'مكافاه',
  ]);

  const verifiedArticles = details.flatMap((system) =>
    system.articles
      .filter((article) => article.status === 'verified')
      .filter((article) => {
        if (!anyArticleRequested) return true;
        if (requestedBySystem.get(system.id)!.has(article.number)) return true;
        if (supremeReview && system.id === BOARD_OF_GRIEVANCES_LAW_1428.id && ['11'].includes(article.number)) return true;
        if (militaryServiceDispute && system.id === BOARD_OF_GRIEVANCES_LAW_1428.id && article.number === '13') return true;
        // دعاوى الحقوق العسكرية: المادة (8) من نظام المرافعات تحكم التظلم السابق ومدته.
        if (militaryServiceDispute && system.id === BOARD_OF_GRIEVANCES_PROCEDURE_LAW_1435.id && article.number === '8') return true;
        if (
          supremeReview
          && system.id === BOARD_OF_GRIEVANCES_PROCEDURE_LAW_1435.id
          && ['33', '45', '46', '53', '54'].includes(article.number)
        ) return true;
        return false;
      })
      .map((article) => ({
        system: system.name,
        article: article.number,
        sourceUrl: article.sourceUrl,
        note: article.note,
      }))
  ).slice(0, 20);

  const blockers = details.flatMap((system) =>
    system.regulations
      .filter((regulation) => regulation.status !== 'verified')
      .map((regulation) => `${regulation.name}: ${regulation.note}`)
  );

  return {
    agentId: 'src-bog',
    label: 'وكيل ديوان المظالم',
    status: blockers.length ? 'warning' : 'success',
    scope: 'نظام ديوان المظالم، نظام المرافعات أمامه، التنفيذ الإداري، واللوائح المرتبطة بالمصادر الرسمية.',
    references: [
      ...refs.map((ref) => ({
        name: ref.name,
        sourceUrl: ref.officialSourceUrl,
        issueInstrument: ref.issueInstrument,
        coverage: ref.textCoverage,
        note: ref.verificationNote,
      })),
      ...regs.map((reg) => ({
        name: reg.regulationName,
        authority: reg.officialSourceAuthority,
        sourceUrl: reg.officialSourceUrl,
        issueInstrument: reg.issueInstrument,
        coverage: reg.textCoverage,
        note: reg.verificationNote,
      })),
    ].slice(0, 12),
    verifiedArticles,
    blockers,
  };
}

function buildPersonnelPacket(query: string): LegalSourcePacket {
  const rights = retrieveVerifiedMilitaryPersonnelRights(
    [query, 'نظام خدمة الأفراد الخدمة العسكرية الحقوق العسكرية'].join(' '),
    8,
  );

  const personnelRegulations = retrieveOfficialJudicialRegulations(
    [query, 'نظام خدمة الأفراد اللائحة التنفيذية'].join(' '),
    6,
  ).filter((regulation) =>
    containsAny([regulation.parentSystem, regulation.regulationName].join(' '), ['خدمة الأفراد'])
  );

  const reviewMaterials = retrievePersonnelUserReviewExcerpts(query, 6);

  const requestedArticles = new Set(articleNumbers(query, 'personnel'));
  const personnelQuery = normalizeArabic(query);
  const allowanceDispute = containsAny(personnelQuery, [
    'علاوه', 'بدل', 'مكافاه', 'حاسب', 'فني', 'ممارسه', 'مزاوله', 'جمع', '50', 'م 37', '1430',
  ]);
  // في نزاع العلاوات تكفي مواد الاستحقاق (2، 16، 17، 19) مع ما طلبه المستخدم؛ إرسال كل مواد النظام
  // (21 مادة) يشتت النموذج عن المواد الحاكمة. بلا نزاع علاوة ولا مادة مطلوبة تبقى كل المواد كما كانت.
  const verifiedArticles = PERSONNEL_SERVICE_LAW_1397.articles
    .filter((article) => article.status === 'verified')
    .filter((article) => {
      if (requestedArticles.has(article.number)) return true;
      if (allowanceDispute) return ['2', '16', '17', '19'].includes(article.number);
      return requestedArticles.size === 0;
    })
    .map((article) => ({
      system: PERSONNEL_SERVICE_LAW_1397.name,
      article: article.number,
      sourceUrl: article.sourceUrl,
      note: article.note,
    }))
    .slice(0, 24);

  const queryNormalized = normalizeArabic(query);
  const blockers = [
    ...PERSONNEL_SERVICE_LAW_1397.versions
      .filter((version) => version.status !== 'verified')
      .map((version) => `${version.label}: ${version.note}`),
    ...PERSONNEL_SERVICE_LAW_1397.regulations
      .filter((regulation) => regulation.status !== 'verified')
      .map((regulation) => `${regulation.name}: ${regulation.note}`),
    ...PERSONNEL_SERVICE_LAW_1397.amendments
      .filter((amendment) => amendment.status !== 'verified')
      // يظهر قيد التعديل غير المتحقق فقط حين يشير المستخدم إلى الأداة نفسها (رقم المرسوم أو المادة المعدلة).
      // كانت المطابقة بأي كلمة طويلة مشتركة («المادة»، «المرسوم»، «الصياغة»)، فيظهر قيد م/37 لمن لم يذكره،
      // وتحوله بوابة الاعتماد إلى منع قاطع لكل مسودة في قضايا العلاوات.
      .filter((amendment) => referencesAmendment(queryNormalized, amendment.label))
      .map((amendment) => `${amendment.label}: ${amendment.note}`),
  ];

  if (rights.length === 0 && verifiedArticles.length === 0) {
    blockers.push('لم يعثر الفهرس على مادة أو حق عسكري موثق ذي صلة كافية بالسؤال.');
  }

  return {
    agentId: 'src-personnel',
    label: 'وكيل نظام خدمة الأفراد',
    status: blockers.length ? 'warning' : 'success',
    scope: 'نظام خدمة الأفراد ومواده وتعديلاته واللائحة التنفيذية بحدود ما ثبت من المصادر الرسمية، مع ربط الحقوق العسكرية باختصاص ديوان المظالم.',
    references: [
      ...PERSONNEL_SERVICE_LAW_1397.sources.map((source) => ({
        name: PERSONNEL_SERVICE_LAW_1397.name,
        authority: source.authority,
        sourceUrl: source.url,
        issueInstrument: PERSONNEL_SERVICE_LAW_1397.royalDecree,
        coverage: PERSONNEL_SERVICE_LAW_1397.status === 'verified'
          ? 'مرجع نظامي مفهرس ومتحقق'
          : 'مرجع نظامي مفهرس مع قيد تحقق في بيانات أداة الإصدار',
        note: source.purpose,
      })),
      ...personnelRegulations.map((regulation) => ({
        name: regulation.regulationName,
        authority: regulation.officialSourceAuthority,
        sourceUrl: regulation.officialSourceUrl,
        issueInstrument: regulation.issueInstrument,
        coverage: regulation.textCoverage,
        note: regulation.verificationNote,
      })),
      ...rights.map((right) => ({
        name: right.title,
        authority: right.sourceAuthority,
        sourceUrl: right.officialSourceUrl,
        issueInstrument: right.affectedInstrument,
        coverage: 'حق/ضمانة موثقة بنطاق وشروط محددة',
        note: `${right.verificationNote} الشروط: ${right.conditions.join(' | ') || 'لا توجد شروط إضافية مفهرسة.'}`,
      })),
    ].slice(0, 16),
    verifiedArticles,
    reviewMaterials,
    blockers,
  };
}

function buildRoyalPacket(query: string): LegalSourcePacket {
  const amendments = retrieveOfficialJudicialAmendments(query, 10);
  const refs = retrieveOfficialLegalReferences(query, 8);

  const references = [
    ...amendments.map((amendment) => ({
      name: `${amendment.instrument} — ${amendment.systemName}`,
      sourceUrl: amendment.officialSourceUrl,
      issueInstrument: amendment.instrument,
      coverage: 'تعديل رسمي موثق',
      note: `${amendment.effect} ${amendment.verificationNote}`,
    })),
    ...refs
      .filter((ref) => containsAny(ref.issueInstrument, ['مرسوم ملكي', 'أمر ملكي']))
      .map((ref) => ({
        name: ref.name,
        sourceUrl: ref.officialSourceUrl,
        issueInstrument: ref.issueInstrument,
        coverage: ref.textCoverage,
        note: ref.verificationNote,
      })),
  ].slice(0, 14);

  const blockers = references.length
    ? []
    : ['لم يظهر في الفهرس الرسمي الداخلي أمر أو مرسوم أو تعديل موثق مرتبط بما يكفي مع هذا الاستفسار.'];

  return {
    agentId: 'src-royal',
    label: 'وكيل الأوامر والمراسيم والتعديلات',
    status: blockers.length ? 'warning' : 'success',
    scope: 'أدوات الإصدار والتعديل الرسمية المرتبطة بالأنظمة واللوائح، دون استنتاج أوامر غير مفهرسة.',
    references,
    verifiedArticles: [],
    blockers,
  };
}

function buildPrecedentPacket(): LegalSourcePacket {
  return {
    agentId: 'src-precedents',
    label: 'وكيل المبادئ والأحكام القضائية',
    status: 'warning',
    scope: 'السوابق والمبادئ القضائية المنشورة رسمياً.',
    references: [],
    verifiedArticles: [],
    blockers: [
      'لا توجد حالياً في المستودع قاعدة سوابق قضائية كاملة ومتحققة تكفي لإسناد مبدأ قضائي حرفي لكل قضية.',
      'يجب عدم اختراع رقم حكم أو دائرة أو مبدأ قضائي؛ أي مبدأ غير موجود بمصدر قضائي رسمي يوسم بأنه يحتاج تحققاً مستقلاً.',
    ],
  };
}

function buildExactTextPacket(query: string): LegalSourcePacket {
  const systems = selectDetailedSystems(query);
  const requested = articleNumbers(query);
  const verifiedArticles = systems.flatMap((system) =>
    system.articles
      .filter((article) => article.status === 'verified')
      .filter((article) => requested.length === 0 || requested.includes(article.number))
      .map((article) => ({
        system: system.name,
        article: article.number,
        sourceUrl: article.sourceUrl,
        note: article.note,
      }))
  ).slice(0, 24);

  const blockers: string[] = [];
  if (requested.length > 0 && verifiedArticles.length === 0) {
    blockers.push(`ذُكرت مواد (${requested.join('، ')}) لكن لم يوجد لها سجل مادة متحقق في الفهرس التفصيلي الحالي.`);
  }
  blockers.push('سجلات المواد التفصيلية تثبت وجود المادة وملاحظات تحققها، لكنها لا تمثل بالضرورة نسخة نصية حرفية كاملة قابلة للاقتباس؛ يلزم الرجوع للمصدر الرسمي عند طلب النص الحرفي.');

  return {
    agentId: 'exact-text',
    label: 'مدقق النص الحرفي',
    status: 'warning',
    scope: 'مطابقة رقم المادة ومصدرها وحالة تحققها قبل السماح بأي اقتباس حرفي.',
    references: systems.flatMap((system) =>
      system.sources.map((source) => ({
        name: system.name,
        authority: source.authority,
        sourceUrl: source.url,
        issueInstrument: system.royalDecree,
        coverage: 'فهرسة مواد ومصدر رسمي؛ ليست مخزناً كاملاً للنص الحرفي',
        note: source.purpose,
      }))
    ).slice(0, 12),
    verifiedArticles,
    blockers,
  };
}

function buildOfficialSourcePacket(query: string): LegalSourcePacket {
  const refs = retrieveOfficialLegalReferences(query, 12)
    .filter((ref) => sourceRelevantToQuery(`${ref.name} ${ref.category}`, query))
    .slice(0, 10);
  const regs = retrieveOfficialJudicialRegulations(query, 10)
    .filter((reg) => sourceRelevantToQuery(`${reg.parentSystem} ${reg.regulationName} ${reg.category}`, query))
    .slice(0, 8);
  const requested = articleNumbers(query);

  const references = [
    ...refs.map((ref) => ({
      name: ref.name,
      sourceUrl: ref.officialSourceUrl,
      issueInstrument: ref.issueInstrument,
      coverage: ref.textCoverage,
      note: ref.verificationNote,
    })),
    ...regs.map((reg) => ({
      name: reg.regulationName,
      authority: reg.officialSourceAuthority,
      sourceUrl: reg.officialSourceUrl,
      issueInstrument: reg.issueInstrument,
      coverage: reg.textCoverage,
      note: reg.verificationNote,
    })),
  ].slice(0, 16);

  const verifiedArticles = refs
    .filter((ref) => ref.status === 'official-verified')
    .flatMap((ref) =>
    ref.materialIndex
      .map((label) => {
        const match = label.match(/(?:المادة|مادة)\s*\(?\s*(\d{1,3}(?:\s*\/\s*\d{1,3})?)\s*\)?/);
        if (!match) return null;
        const article = match[1].replace(/\s+/g, '');
        if (requested.length > 0 && !requested.includes(article)) return null;
        return {
          system: ref.name,
          article,
          sourceUrl: ref.officialSourceUrl,
          note: ref.textCoverage === 'full-verified'
            ? 'المادة مفهرسة ضمن مصدر رسمي بتغطية نصية كاملة.'
            : 'المادة مثبتة في الفهرس الرسمي؛ يعرض QADA رقمها ومضمون التحليل المتحقق، ويحتفظ بالرابط للتحقق دون طباعته في متن الإجابة.',
        };
      })
      .filter((item): item is { system: string; article: string; sourceUrl: string; note: string } => Boolean(item))
  ).slice(0, 24);

  const blockers = references.length
    ? []
    : ['لم يعثر الفهرس الرسمي الداخلي على مصدر متحقق ذي صلة كافية.'];

  if (references.length > 0 && verifiedArticles.length === 0) {
    blockers.push('عُثر على مصدر رسمي، لكن لا توجد مادة مرقمة مفهرسة بدرجة كافية لهذا الاستفسار؛ لا تُعرض الروابط بديلاً عن المادة.');
  }

  return {
    agentId: 'official-source',
    label: 'مدقق المصدر الرسمي',
    status: blockers.length ? 'warning' : 'success',
    scope: 'تثبيت هوية المصدر الرسمي وأداة الإصدار، ثم تقديم المواد النظامية المفهرسة قبل روابط التحقق.',
    references,
    verifiedArticles,
    blockers,
  };
}

function buildAmendmentPacket(query: string): LegalSourcePacket {
  const amendments = retrieveOfficialJudicialAmendments(query, 16)
    .filter((amendment) => sourceRelevantToQuery(`${amendment.systemName} ${amendment.affectedProvision}`, query))
    .slice(0, 12);
  const blockers = amendments.length
    ? []
    : ['لا توجد تعديلات رسمية مفهرسة ذات صلة كافية في الاسترجاع الحالي؛ لا يعني ذلك عدم وجود تعديل خارج الفهرس.'];

  return {
    agentId: 'amendments',
    label: 'مدقق السريان والتعديلات',
    status: blockers.length ? 'warning' : 'success',
    scope: 'التعديلات والنسخ والأثر النظامي المثبت في الفهرس الرسمي.',
    references: amendments.map((amendment) => ({
      name: `${amendment.systemName} — ${amendment.affectedProvision}`,
      sourceUrl: amendment.officialSourceUrl,
      issueInstrument: amendment.instrument,
      coverage: 'تعديل رسمي مفهرس',
      note: `${amendment.effect} ${amendment.verificationNote}`,
    })),
    verifiedArticles: [],
    blockers,
  };
}

function buildCourtFramePacket(courtSystem: CourtSystemId): LegalSourcePacket {
  const system = getCourtSystem(courtSystem);
  return {
    agentId: 'court-frame',
    label: `الإطار النظامي لـ${system.title}`,
    status: 'success',
    scope: `الأنظمة الأساسية لـ${system.title}؛ أنظمة الجهات الأخرى مستبعدة من هذه الحزمة.`,
    references: COURT_CORE_LAWS[courtSystem].map((law) => ({
      name: law.law,
      sourceUrl: law.url,
      issueInstrument: law.decree,
      coverage: 'هوية النظام وأداة إصداره',
      note: 'هوية النظام وأداة إصداره متحققة من بوابة هيئة الخبراء؛ أرقام المواد لا تُستخدم منه إلا ما ورد مفهرساً أو في كتلة المدد النظامية.',
    })),
    verifiedArticles: [],
    blockers: [],
  };
}

function scopePacketToCourt(packet: LegalSourcePacket, courtSystem: CourtSystemId): LegalSourcePacket {
  const references = packet.references.filter((reference) => !isSourceForeignToCourt(reference.name, courtSystem));
  const verifiedArticles = packet.verifiedArticles.filter((article) => !isSourceForeignToCourt(article.system, courtSystem));
  const removed = packet.references.length - references.length;
  return {
    ...packet,
    references,
    verifiedArticles,
    blockers: removed > 0 && references.length === 0
      ? [...packet.blockers, `لا يوجد في هذا الاسترجاع مصدر مفهرس خاص بـ${getCourtSystem(courtSystem).title}؛ استُبعدت مصادر جهات أخرى.`]
      : packet.blockers,
  };
}

export type LegalSourceAgentOptions = {
  /** عند تحديد الجهة: تُضاف أنظمتها الأساسية وتُستبعد أنظمة الجهات الأخرى. */
  courtSystem?: CourtSystemId | null;
};

// تصريح دالة (لا ثابت) حتى تُرفع إلى أعلى الملف: تستخدمها articleNumbers المعرّفة قبل هذا الموضع.
function latinDigits(value: string): string {
  return value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
}

type CitedInstrument = { kind: 'decree' | 'cabinet'; number: string; year: string; raw: string };

/** المراسيم الملكية وقرارات مجلس الوزراء التي يستشهد بها المستخدم، برقمها وسنتها إن وردت. */
function citedInstruments(query: string): CitedInstrument[] {
  const text = latinDigits(query);
  const yearPart = '(?:\\s*\\)?\\s*(?:و?تاريخ|بتاريخ|لعام|عام|في|لسنه|لسنة)\\s*(?:\\d{1,2}\\s*/\\s*\\d{1,2}\\s*/\\s*)?(\\d{4}))?';
  const found: CitedInstrument[] = [];
  for (const match of text.matchAll(new RegExp(`(?:المرسوم الملكي|مرسوم ملكي)\\s*(?:رقم)?\\s*\\(?\\s*م\\s*/?\\s*(\\d{1,4})(?:\\s*\\))?${yearPart}`, 'g'))) {
    found.push({ kind: 'decree', number: match[1], year: match[2] || '', raw: match[0].trim() });
  }
  for (const match of text.matchAll(new RegExp(`قرار\\s+مجلس\\s+الوزراء\\s*(?:رقم)?\\s*\\(?\\s*(\\d{1,4})(?:\\s*\\))?${yearPart}`, 'g'))) {
    found.push({ kind: 'cabinet', number: match[1], year: match[2] || '', raw: match[0].trim() });
  }
  return found.slice(0, 8);
}

/**
 * تنبيه صريح لكل أداة يذكرها المستخدم ولا يعرفها الفهرس (أو يعرف رقمها بتاريخ آخر)، حتى لا يُنسب إليها
 * مضمون من الذاكرة ولا تُخلط بأداة مفهرسة تحمل الرقم نفسه. الصياغة متعمدة: تنبيه لا منع.
 */
function unindexedInstrumentNotes(query: string, packets: LegalSourcePacket[]): string[] {
  const haystack = latinDigits(normalizeArabic(packets.flatMap((packet) => [
    ...packet.references.flatMap((reference) => [reference.name, reference.issueInstrument || '', reference.note]),
    ...packet.blockers,
  ]).join('\n'))).replace(/\s*\/\s*/g, '/');
  const notes: string[] = [];
  for (const instrument of citedInstruments(query)) {
    const head = instrument.kind === 'decree' ? `م/?\\s*${instrument.number}(?![0-9])` : `مجلس الوزراء(?: رقم)?\\s*\\(?${instrument.number}(?![0-9])`;
    const sameNumber = new RegExp(head).test(haystack);
    const exact = instrument.year ? new RegExp(`${head}[^\\n]{0,40}${instrument.year}`).test(haystack) : sameNumber;
    if (exact) continue;
    notes.push(sameNumber
      ? `يذكر المستخدم «${instrument.raw}»، والمفهرس في المنصة بالرقم نفسه مؤرخ بغير ذلك أو لموضوع آخر؛ تحقق من رقم الأداة وتاريخها وموضوعها قبل الاستناد إليها.`
      : `أداة يذكرها المستخدم ولم تُفهرس في المنصة بعد: «${instrument.raw}». تُذكر كما أوردها المستخدم، ولا يُنسب إليها مضمون أو يُبنى عليها استحقاق قبل مطابقة نصها الرسمي من هيئة الخبراء أو أم القرى.`);
  }
  return notes;
}

export function runLegalSourceAgents(query: string, options: LegalSourceAgentOptions = {}): LegalSourceAgentBundle {
  const started = Date.now();
  const normalizedQuery = normalizeArabic(query);
  const courtSystem = options.courtSystem || null;
  const administrativeCourtAllowed = !courtSystem || courtSystem === 'administrative';

  const packets: LegalSourcePacket[] = [
    ...(courtSystem ? [buildCourtFramePacket(courtSystem)] : []),
    buildOfficialSourcePacket(query),
    buildAmendmentPacket(query),
    buildExactTextPacket(query),
  ];

  const personnelCore = containsAny(normalizedQuery, [
    'خدمه الافراد',
    'نظام الافراد',
    'عسكري',
    'عسكريين',
    'فرد عسكري',
    'ترقيه عسكريه',
    'بدل ترحيل',
    'حقوق عسكريه',
    'علاوه فنيه',
    'مكافاه الحاسب',
    'وزاره الدفاع',
    'القوات البريه',
  ]);
  // جهات وقطاعات ورتب يخضع منسوبوها من الأفراد لنظام خدمة الأفراد، لكنها تُذكر أيضاً في سياقات أخرى
  // (بلاغ للأمن العام، معاملة جوازات)، فلا تكفي وحدها: يلزم معها حق مالي أو وظيفي محل مطالبة.
  const militaryBodyOrRank = containsAny(normalizedQuery, [
    'الحرس الوطني', 'الحرس الملكي', 'وزاره الداخليه', 'الامن العام', 'الدفاع المدني', 'حرس الحدود',
    'امن الدوله', 'القوات الجويه', 'القوات البحريه', 'الدفاع الجوي', 'المديريه العامه للسجون', 'الجوازات',
  ]) || containsWord(normalizedQuery, ['جندي', 'جندي اول', 'عريف', 'وكيل رقيب', 'رقيب', 'رقيب اول', 'رئيس رقباء']);
  const entitlementSignals = containsAny(normalizedQuery, [
    'علاوه', 'بدل', 'مكافاه', 'الحاسب', 'حاسب الي', 'نهايه طرفيه', 'نهايات طرفيه', 'النهايات الطرفيه', 'مستحقات', 'ترقيه', 'رتبه', 'التقاعد',
  ]);
  const personnelSignals = personnelCore || (militaryBodyOrRank && entitlementSignals);
  const disputeSignals = containsAny(normalizedQuery, [
    'دعوى',
    'مطالبه',
    'حكم',
    'اعتراض',
    'استئناف',
    'نقض',
    'تظلم',
    'رفض',
    'قرار',
    'صرف',
    'استحقاق',
    'يطالب',
    'اطالب',
    'طالبت',
    'مستحق',
    'حرموني',
    'اوقفوا',
    'وقفوا',
  ]);
  const administrativeSignals = containsAny(normalizedQuery, [
    'ديوان المظالم',
    'قضاء اداري',
    'اداري',
    'قرار اداري',
    'تظلم',
    'جهه اداريه',
  ]);

  if (administrativeCourtAllowed && (administrativeSignals || (personnelSignals && disputeSignals))) {
    packets.push(buildBogPacket(query));
  }

  if (administrativeCourtAllowed && personnelSignals) {
    packets.push(buildPersonnelPacket(query));
  }

  if (containsAny(normalizedQuery, ['مرسوم ملكي', 'امر ملكي', 'اوامر ملكيه', 'قرار مجلس الوزراء', 'تعديل نظام', 'اداه الاصدار'])) {
    packets.push(buildRoyalPacket(query));
  }

  if (containsAny(normalizedQuery, ['مبدأ قضائي', 'مبادئ قضائيه', 'سابقه قضائيه', 'حكم رقم', 'المحكمه العليا', 'نقض', 'استئناف'])) {
    packets.push(buildPrecedentPacket());
  }

  const instrumentNotes = unindexedInstrumentNotes(query, packets);
  if (instrumentNotes.length) {
    const officialPacket = packets.find((packet) => packet.agentId === 'official-source');
    if (officialPacket) {
      officialPacket.blockers.push(...instrumentNotes);
      officialPacket.status = 'warning';
    }
  }

  if (courtSystem) {
    packets.forEach((packet, index) => {
      packets[index] = scopePacketToCourt(packet, courtSystem);
    });
  }

  const elapsed = Math.max(1, Date.now() - started);
  const runs = packets.map((packet, index): LegalSourceAgentRun => ({
    id: packet.agentId,
    label: packet.label,
    status: packet.status,
    durationMs: Math.max(1, Math.round(elapsed / Math.max(1, packets.length)) + index),
    summary: packet.blockers.length
      ? `${packet.references.length} مرجع؛ ${packet.blockers.length} قيد تحقق.`
      : `${packet.references.length} مرجع رسمي مسترجع.`,
    matchedSources: packet.references.length,
    blockers: packet.blockers,
  }));

  const blockers = Array.from(new Set(packets.flatMap((packet) => packet.blockers)));
  const officialSources = new Set(
    packets.flatMap((packet) => packet.references.map((reference) => reference.sourceUrl)).filter(Boolean),
  ).size;
  const verifiedArticles = packets.reduce((sum, packet) => sum + packet.verifiedArticles.length, 0);

  const context = [
    '[حزمة وكلاء المراجع القانونية — QADA]',
    'هذه الحزمة تحدد ما تم العثور عليه فعلياً في الفهارس الرسمية الداخلية وما بقي غير متحقق.',
    'ممنوع تحويل حالة warning إلى سند قطعي، وممنوع الاقتباس الحرفي من مجرد ملاحظة فهرسة.',
    ...packets.map(packetToContext),
  ].join('\n\n');

  return {
    packets,
    runs,
    context,
    verification: {
      officialSources,
      verifiedArticles,
      blockers,
      literalQuotationReady: false,
      precedentCorpusReady: false,
    },
  };
}
