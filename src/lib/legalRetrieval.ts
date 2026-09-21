import {
  OFFICIAL_JUDICIAL_REFERENCE_INDEX,
  OfficialJudicialReference,
} from '../data/officialJudicialReferenceIndex.ts';
import {
  OFFICIAL_JUDICIAL_REGULATIONS,
  OfficialJudicialRegulationReference,
} from '../data/officialJudicialRegulations.ts';
import {
  OFFICIAL_JUDICIAL_AMENDMENTS,
  OfficialJudicialAmendment,
} from '../data/officialJudicialAmendments.ts';
import {
  VERIFIED_MILITARY_PERSONNEL_RIGHTS,
  VerifiedMilitaryPersonnelRight,
} from '../data/verifiedMilitaryPersonnelRights.ts';

function normalizeArabic(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(value: string): string[] {
  return Array.from(new Set(
    normalizeArabic(value)
      .split(' ')
      .filter((token) => token.length >= 3)
      .slice(0, 80)
  ));
}

function referenceSearchText(reference: OfficialJudicialReference): string {
  return [
    reference.systemName,
    reference.category,
    reference.issueInstrument,
    reference.cabinetResolution || '',
    reference.materialIndex.join(' '),
    reference.regulation?.name || '',
    reference.regulation?.instrument || '',
    reference.amendments.join(' '),
    reference.versions.join(' '),
    reference.verificationNote,
  ].join(' ');
}

function regulationSearchText(reference: OfficialJudicialRegulationReference): string {
  return [
    reference.parentSystem,
    reference.regulationName,
    reference.category,
    reference.issueInstrument,
    reference.materialIndex.join(' '),
    reference.amendments.join(' '),
    reference.versions.join(' '),
    reference.verificationNote,
  ].join(' ');
}

function amendmentSearchText(amendment: OfficialJudicialAmendment): string {
  return [
    amendment.systemName,
    amendment.affectedProvision,
    amendment.instrument,
    amendment.publicationDateHijri,
    amendment.effect,
    amendment.verificationNote,
  ].join(' ');
}

function rightSearchText(right: VerifiedMilitaryPersonnelRight): string {
  return [
    right.title,
    right.kind,
    right.affectedInstrument,
    right.legalBasis.join(' '),
    right.scope,
    right.conditions.join(' '),
    right.verificationNote,
  ].join(' ');
}

function scoreText(value: string, queryTokens: string[]): number {
  const normalized = normalizeArabic(value);
  let score = 0;
  for (const token of queryTokens) {
    if (normalized.includes(token)) score += 1;
  }
  return score;
}

function scoreReference(reference: OfficialJudicialReference, queryTokens: string[]): number {
  if (reference.status !== 'official-verified' || !reference.officialSourceUrl) return -1;
  const name = normalizeArabic(reference.systemName);
  const category = normalizeArabic(reference.category);
  const materialIndex = normalizeArabic(reference.materialIndex.join(' '));
  const rest = referenceSearchText(reference);

  let score = scoreText(rest, queryTokens);
  for (const token of queryTokens) {
    if (name.includes(token)) score += 8;
    if (category.includes(token)) score += 3;
    if (materialIndex.includes(token)) score += 4;
  }
  return score;
}

function scoreRegulation(reference: OfficialJudicialRegulationReference, queryTokens: string[]): number {
  if (reference.status !== 'official-verified' || !reference.officialSourceUrl) return -1;
  const name = normalizeArabic(reference.regulationName);
  const parent = normalizeArabic(reference.parentSystem);
  const materialIndex = normalizeArabic(reference.materialIndex.join(' '));
  let score = scoreText(regulationSearchText(reference), queryTokens);

  for (const token of queryTokens) {
    if (name.includes(token)) score += 8;
    if (parent.includes(token)) score += 5;
    if (materialIndex.includes(token)) score += 4;
  }
  return score;
}

function scoreAmendment(amendment: OfficialJudicialAmendment, queryTokens: string[]): number {
  if (amendment.status !== 'official-verified' || !amendment.officialSourceUrl) return -1;
  const systemName = normalizeArabic(amendment.systemName);
  const provision = normalizeArabic(amendment.affectedProvision);
  let score = scoreText(amendmentSearchText(amendment), queryTokens);

  for (const token of queryTokens) {
    if (systemName.includes(token)) score += 7;
    if (provision.includes(token)) score += 5;
  }
  return score;
}

function scoreRight(right: VerifiedMilitaryPersonnelRight, queryTokens: string[]): number {
  const title = normalizeArabic(right.title);
  const instrument = normalizeArabic(right.affectedInstrument);
  let score = scoreText(rightSearchText(right), queryTokens);
  for (const token of queryTokens) {
    if (title.includes(token)) score += 7;
    if (instrument.includes(token)) score += 5;
  }
  return score;
}

export function retrieveOfficialLegalReferences(query: string, limit = 5) {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return [];

  return OFFICIAL_JUDICIAL_REFERENCE_INDEX
    .map((reference) => ({ reference, score: scoreReference(reference, queryTokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ reference, score }) => ({
      id: reference.id,
      name: reference.systemName,
      category: reference.category,
      issueInstrument: reference.issueInstrument,
      cabinetResolution: reference.cabinetResolution,
      issueDateHijri: reference.issueDateHijri,
      publicationDateHijri: reference.publicationDateHijri,
      materialIndex: reference.materialIndex,
      regulation: reference.regulation,
      amendments: reference.amendments,
      versions: reference.versions,
      officialSourceUrl: reference.officialSourceUrl,
      verificationNote: reference.verificationNote,
      textCoverage: reference.textCoverage || 'metadata-only',
      score,
    }));
}

export function retrieveOfficialJudicialRegulations(query: string, limit = 4) {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return [];

  return OFFICIAL_JUDICIAL_REGULATIONS
    .map((reference) => ({ reference, score: scoreRegulation(reference, queryTokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ reference, score }) => ({ ...reference, score }));
}

export function retrieveOfficialJudicialAmendments(query: string, limit = 4) {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return [];

  return OFFICIAL_JUDICIAL_AMENDMENTS
    .map((amendment) => ({ amendment, score: scoreAmendment(amendment, queryTokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ amendment, score }) => ({ ...amendment, score }));
}

export function retrieveVerifiedMilitaryPersonnelRights(query: string, limit = 4) {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return [];

  return VERIFIED_MILITARY_PERSONNEL_RIGHTS
    .map((right) => ({ right, score: scoreRight(right, queryTokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ right, score }) => ({ ...right, score }));
}

export function buildOfficialLegalReferenceContext(query: string, limit = 5): string {
  const refs = retrieveOfficialLegalReferences(query, limit);
  const regulations = retrieveOfficialJudicialRegulations(query, 4);
  const amendments = retrieveOfficialJudicialAmendments(query, 4);
  const militaryRights = retrieveVerifiedMilitaryPersonnelRights(query, 4);

  if (refs.length === 0 && regulations.length === 0 && amendments.length === 0 && militaryRights.length === 0) {
    return [
      '[المراجع الرسمية المسترجعة]',
      'لم يعثر الفهرس الرسمي الداخلي على مرجع موثق ذي صلة كافية.',
      'ممنوع اختلاق مادة أو ميعاد أو مرسوم أو نص من الذاكرة. صرّح بأن التحقق المرجعي غير مكتمل.',
    ].join('\n');
  }

  const referenceBlocks = refs.map((ref, index) => [
    `[نظام/مرجع رسمي ${index + 1}]`,
    `الاسم: ${ref.name}`,
    `التصنيف: ${ref.category}`,
    ref.issueInstrument ? `أداة الإصدار: ${ref.issueInstrument}` : '',
    ref.cabinetResolution ? `قرار مجلس الوزراء: ${ref.cabinetResolution}` : '',
    ref.issueDateHijri ? `تاريخ الإصدار: ${ref.issueDateHijri}هـ` : '',
    ref.publicationDateHijri ? `تاريخ النشر: ${ref.publicationDateHijri}هـ` : 'تاريخ النشر: غير مثبت في الفهرس',
    `تغطية النص داخل المستودع الموثق: ${ref.textCoverage}`,
    ref.materialIndex.length ? `المواد المفهرسة المتحقق منها: ${ref.materialIndex.join('، ')}` : '',
    ref.regulation ? [
      `اللائحة المرتبطة: ${ref.regulation.name}`,
      `أداة اللائحة: ${ref.regulation.instrument}`,
      `مصدر اللائحة الرسمي: ${ref.regulation.officialSourceUrl}`,
    ].join('\n') : '',
    ref.amendments.length ? `التعديلات الموثقة:\n- ${ref.amendments.join('\n- ')}` : '',
    ref.versions.length ? `النسخ/الإصدارات: ${ref.versions.join(' | ')}` : '',
    `المصدر الرسمي: ${ref.officialSourceUrl}`,
    `ملاحظة التحقق: ${ref.verificationNote}`,
  ].filter(Boolean).join('\n'));

  const regulationBlocks = regulations.map((reference, index) => [
    `[لائحة/ضابط رسمي ${index + 1}]`,
    `النظام الأصل: ${reference.parentSystem}`,
    `الاسم: ${reference.regulationName}`,
    `أداة الإصدار: ${reference.issueInstrument}`,
    reference.issueDateHijri ? `تاريخ الإصدار: ${reference.issueDateHijri}هـ` : '',
    reference.publicationDateHijri ? `تاريخ النشر: ${reference.publicationDateHijri}هـ` : 'تاريخ النشر: غير مثبت في الفهرس',
    `تغطية النص: ${reference.textCoverage}`,
    reference.materialIndex.length ? `المواد المفهرسة: ${reference.materialIndex.join('، ')}` : '',
    reference.amendments.length ? `التعديلات الموثقة:\n- ${reference.amendments.join('\n- ')}` : '',
    `المصدر الرسمي: ${reference.officialSourceUrl}`,
    `ملاحظة التحقق: ${reference.verificationNote}`,
  ].filter(Boolean).join('\n'));

  const amendmentBlocks = amendments.map((amendment, index) => [
    `[تعديل رسمي ${index + 1}]`,
    `النظام/اللائحة: ${amendment.systemName}`,
    `الحكم المتأثر: ${amendment.affectedProvision}`,
    `أداة التعديل: ${amendment.instrument}`,
    amendment.publicationDateHijri ? `تاريخ النشر: ${amendment.publicationDateHijri}هـ` : '',
    `الأثر الموثق: ${amendment.effect}`,
    `المصدر الرسمي: ${amendment.officialSourceUrl}`,
    `ملاحظة التحقق: ${amendment.verificationNote}`,
  ].filter(Boolean).join('\n'));

  const rightsBlocks = militaryRights.map((right, index) => [
    `[حق/ضمانة عسكرية موثقة ${index + 1}]`,
    `العنوان: ${right.title}`,
    `النوع: ${right.kind}`,
    `الأداة ذات الصلة: ${right.affectedInstrument}`,
    `الأساس الرسمي: ${right.legalBasis.join(' | ')}`,
    `النطاق: ${right.scope}`,
    right.conditions.length ? `الشروط والقيود: ${right.conditions.join(' | ')}` : '',
    `المصدر الرسمي: ${right.officialSourceUrl}`,
    `ملاحظة التحقق: ${right.verificationNote}`,
  ].filter(Boolean).join('\n'));

  return [
    '[المراجع الرسمية المسترجعة من مركز المراجع]',
    'يشمل الاسترجاع الآن الأنظمة واللوائح والضوابط والتعديلات الموثقة، ولا يستخدم scratch/legal_database ولا أي سجل حالته needs-correction.',
    'لا يوجد نص حرفي صالح للاقتباس لمجرد وجود رابط رسمي؛ لا تنقل نص مادة حرفياً إلا إذا كانت تغطية النص full-verified أو كان النص الرسمي قد استرجع وتحقق منه في نفس الطلب.',
    'عند وجود حق أو ميزة للأفراد العسكريين يجب عرض شروطها وقيودها من المصدر نفسه، وعدم تعميمها خارج نطاقها.',
    ...referenceBlocks,
    ...regulationBlocks,
    ...amendmentBlocks,
    ...rightsBlocks,
  ].join('\n\n');
}
