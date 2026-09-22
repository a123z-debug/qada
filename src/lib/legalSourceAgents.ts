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

function articleNumbers(query: string): string[] {
  const values = new Set<string>();
  const patterns = [
    /الماد(?:ة|ه)\s*\(?\s*(\d{1,3})(?:\s*\/\s*(\d{1,3}))?\s*\)?/g,
    /ماد(?:ة|ه)\s*\(?\s*(\d{1,3})(?:\s*\/\s*(\d{1,3}))?\s*\)?/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(query)) !== null) {
      values.add(match[2] ? `${match[1]}/${match[2]}` : match[1]);
    }
  }

  return Array.from(values).slice(0, 20);
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

  const requestedArticles = articleNumbers(query);
  const verifiedArticles = details.flatMap((system) =>
    system.articles
      .filter((article) => article.status === 'verified')
      .filter((article) => requestedArticles.length === 0 || requestedArticles.includes(article.number))
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

  const requestedArticles = articleNumbers(query);
  const verifiedArticles = PERSONNEL_SERVICE_LAW_1397.articles
    .filter((article) => article.status === 'verified')
    .filter((article) => requestedArticles.length === 0 || requestedArticles.includes(article.number))
    .map((article) => ({
      system: PERSONNEL_SERVICE_LAW_1397.name,
      article: article.number,
      sourceUrl: article.sourceUrl,
      note: article.note,
    }))
    .slice(0, 24);

  const blockers = [
    ...PERSONNEL_SERVICE_LAW_1397.versions
      .filter((version) => version.status !== 'verified')
      .map((version) => `${version.label}: ${version.note}`),
    ...PERSONNEL_SERVICE_LAW_1397.regulations
      .filter((regulation) => regulation.status !== 'verified')
      .map((regulation) => `${regulation.name}: ${regulation.note}`),
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
  const refs = retrieveOfficialLegalReferences(query, 10);
  const regs = retrieveOfficialJudicialRegulations(query, 8);
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

  const verifiedArticles = refs.flatMap((ref) =>
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
  const amendments = retrieveOfficialJudicialAmendments(query, 12);
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

export function runLegalSourceAgents(query: string): LegalSourceAgentBundle {
  const started = Date.now();
  const normalizedQuery = normalizeArabic(query);

  const packets: LegalSourcePacket[] = [
    buildOfficialSourcePacket(query),
    buildAmendmentPacket(query),
    buildExactTextPacket(query),
  ];

  if (containsAny(normalizedQuery, ['ديوان المظالم', 'قضاء اداري', 'اداري', 'قرار اداري', 'تظلم', 'جهه اداريه'])) {
    packets.push(buildBogPacket(query));
  }

  if (containsAny(normalizedQuery, ['خدمه الافراد', 'عسكري', 'عسكريين', 'فرد عسكري', 'ترقيه عسكريه', 'بدل ترحيل', 'حقوق عسكريه'])) {
    packets.push(buildPersonnelPacket(query));
  }

  if (containsAny(normalizedQuery, ['مرسوم ملكي', 'امر ملكي', 'اوامر ملكيه', 'قرار مجلس الوزراء', 'تعديل نظام', 'اداه الاصدار'])) {
    packets.push(buildRoyalPacket(query));
  }

  if (containsAny(normalizedQuery, ['مبدأ قضائي', 'مبادئ قضائيه', 'سابقه قضائيه', 'حكم رقم', 'المحكمه العليا', 'نقض', 'استئناف'])) {
    packets.push(buildPrecedentPacket());
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
