import {
  OFFICIAL_JUDICIAL_REFERENCE_INDEX,
  OfficialJudicialReference,
} from '../data/officialJudicialReferenceIndex';
import {
  VERIFIED_MILITARY_PERSONNEL_RIGHTS,
  VerifiedMilitaryPersonnelRight,
} from '../data/verifiedMilitaryPersonnelRights';

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
  const militaryRights = retrieveVerifiedMilitaryPersonnelRights(query, 4);

  if (refs.length === 0 && militaryRights.length === 0) {
    return [
      '[المراجع الرسمية المسترجعة]',
      'لم يعثر الفهرس الرسمي الداخلي على مرجع موثق ذي صلة كافية.',
      'ممنوع اختلاق مادة أو ميعاد أو مرسوم أو نص من الذاكرة. صرّح بأن التحقق المرجعي غير مكتمل.',
    ].join('\n');
  }

  const referenceBlocks = refs.map((ref, index) => [
    `[مرجع رسمي ${index + 1}]`,
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
    'طبقة الاسترجاع هذه لا تستخدم scratch/legal_database ولا النصوص القديمة الموسومة needs-correction.',
    'لا يوجد نص حرفي صالح للاقتباس لمجرد وجود رابط رسمي؛ لا تنقل نص مادة حرفياً إلا إذا كانت تغطية النص full-verified أو كان النص الرسمي قد استرجع وتحقق منه في نفس الطلب.',
    'عند وجود حق أو ميزة للأفراد العسكريين يجب عرض شروطها وقيودها من المصدر نفسه، وعدم تعميمها خارج نطاقها.',
    ...referenceBlocks,
    ...rightsBlocks,
  ].join('\n\n');
}
