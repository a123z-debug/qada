import {
  retrieveOfficialJudicialAmendments,
  retrieveOfficialJudicialRegulations,
  retrieveOfficialLegalReferences,
  retrieveVerifiedMilitaryPersonnelRights,
} from './legalRetrieval.ts';
import type { OfficialReferenceSystem } from '../data/officialReferenceIndex.ts';
import { BOARD_OF_GRIEVANCES_LAW_1428 } from '../data/officialReferences/boardOfGrievancesLaw1428.ts';
import { BOARD_OF_GRIEVANCES_PROCEDURE_LAW_1435 } from '../data/officialReferences/boardOfGrievancesProcedureLaw1435.ts';
import { BOARD_OF_GRIEVANCES_EXECUTION_LAW_1443 } from '../data/officialReferences/boardOfGrievancesExecutionLaw1443.ts';
import { CIVIL_PROCEDURE_LAW_1435 } from '../data/officialReferences/civilProcedureLaw1435.ts';
import { COMMERCIAL_COURTS_LAW_1441 } from '../data/officialReferences/commercialCourtsLaw1441.ts';
import { CRIMINAL_PROCEDURE_LAW_1435 } from '../data/officialReferences/criminalProcedureLaw1435.ts';
import { EXECUTION_LAW_1447 } from '../data/officialReferences/executionLaw1447.ts';
import { JUDICIARY_LAW_1428 } from '../data/officialReferences/judiciaryLaw1428.ts';
import { LAW_PRACTICE_LAW_1422 } from '../data/officialReferences/lawPracticeLaw1422.ts';

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

  const refs = retrieveOfficialLegalReferences(
    [query, 'نظام خدمة الأفراد الخدمة العسكرية'].join(' '),
    8,
  );

  const personnelRef = refs.find((ref) => containsAny(ref.name, ['خدمة الأفراد']));
  const blockers = [
    'السجل العام لنظام خدمة الأفراد في الفهرس القضائي موسوم needs-correction بسبب تعارض تاريخ قرار مجلس الوزراء رقم (324) بين البيانات الرسمية؛ لذلك لا يعتمد النظام كاملاً كنص حرفي من هذا المسار.',
  ];

  if (rights.length === 0) {
    blockers.push('لم يعثر فهرس الحقوق العسكرية الموثقة على حق محدد ذي صلة كافية بالسؤال.');
  }

  return {
    agentId: 'src-personnel',
    label: 'وكيل نظام خدمة الأفراد',
    status: 'warning',
    scope: 'حقوق وضمانات الأفراد العسكريين التي ثبتت بمصدر رسمي مستقل، مع منع تعميم أي حق خارج شروطه.',
    references: [
      ...(personnelRef ? [{
        name: personnelRef.name,
        sourceUrl: personnelRef.officialSourceUrl,
        issueInstrument: personnelRef.issueInstrument,
        coverage: personnelRef.textCoverage,
        note: personnelRef.verificationNote,
      }] : []),
      ...rights.map((right) => ({
        name: right.title,
        authority: right.sourceAuthority,
        sourceUrl: right.officialSourceUrl,
        issueInstrument: right.affectedInstrument,
        coverage: 'حق/ضمانة موثقة بنطاق وشروط محددة',
        note: `${right.verificationNote} الشروط: ${right.conditions.join(' | ') || 'لا توجد شروط إضافية مفهرسة.'}`,
      })),
    ].slice(0, 12),
    verifiedArticles: [],
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

  const blockers = references.length
    ? []
    : ['لم يعثر الفهرس الرسمي الداخلي على مصدر متحقق ذي صلة كافية.'];

  return {
    agentId: 'official-source',
    label: 'مدقق المصدر الرسمي',
    status: blockers.length ? 'warning' : 'success',
    scope: 'تثبيت هوية المصدر الرسمي وأداة الإصدار والتغطية المتاحة.',
    references,
    verifiedArticles: [],
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

  const packets: LegalSourcePacket[] = [
    buildOfficialSourcePacket(query),
    buildBogPacket(query),
    buildPersonnelPacket(query),
    buildRoyalPacket(query),
    buildAmendmentPacket(query),
    buildExactTextPacket(query),
    buildPrecedentPacket(),
  ];

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
