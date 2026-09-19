import { LEGAL_REFERENCE_SYSTEMS, LegalReferenceSystem } from '../data/legalReferences';

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

function scoreSystem(system: LegalReferenceSystem, queryTokens: string[]): number {
  if (system.verificationStatus !== 'official' || !system.officialSourceUrl) return -1;
  const name = normalizeArabic(system.name);
  const tags = normalizeArabic(system.tags.join(' '));
  const category = normalizeArabic(`${system.category} ${system.subCategory}`);
  const body = normalizeArabic(
    `${system.lawText} ${system.executiveText} ${system.amendmentsText}`.slice(0, 24000)
  );

  let score = 0;
  for (const token of queryTokens) {
    if (name.includes(token)) score += 8;
    if (tags.includes(token)) score += 5;
    if (category.includes(token)) score += 3;
    if (body.includes(token)) score += 1;
  }
  return score;
}

function excerpt(text: string, queryTokens: string[], max = 1800): string {
  const clean = (text || '').trim();
  if (!clean) return '';
  const normalized = normalizeArabic(clean);
  let firstIndex = -1;

  for (const token of queryTokens) {
    const index = normalized.indexOf(token);
    if (index >= 0 && (firstIndex < 0 || index < firstIndex)) firstIndex = index;
  }

  if (firstIndex < 0 || clean.length <= max) return clean.slice(0, max);

  const start = Math.max(0, firstIndex - Math.floor(max * 0.25));
  return clean.slice(start, start + max);
}

export function retrieveOfficialLegalReferences(query: string, limit = 4) {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return [];

  return LEGAL_REFERENCE_SYSTEMS
    .map((system) => ({ system, score: scoreSystem(system, queryTokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ system, score }) => ({
      id: system.id,
      name: system.name,
      category: system.category,
      royalDecree: system.royalDecree,
      cabinetResolution: system.cabinetResolution,
      status: system.status,
      officialSourceUrl: system.officialSourceUrl,
      lawExcerpt: excerpt(system.lawText, queryTokens),
      executiveExcerpt: excerpt(system.executiveText, queryTokens, 1000),
      amendmentsExcerpt: excerpt(system.amendmentsText, queryTokens, 800),
      score,
    }));
}

export function buildOfficialLegalReferenceContext(query: string, limit = 4): string {
  const refs = retrieveOfficialLegalReferences(query, limit);
  if (refs.length === 0) {
    return [
      '[المراجع الرسمية المسترجعة]',
      'لم يعثر الفهرس الرسمي الداخلي على مرجع موثق ذي صلة كافية.',
      'ممنوع اختلاق مادة أو ميعاد أو مرسوم. اطلب من المستخدم فتح مركز المراجع أو صرّح بأن التحقق المرجعي غير مكتمل.',
    ].join('\n');
  }

  const blocks = refs.map((ref, index) => [
    `[مرجع رسمي ${index + 1}]`,
    `الاسم: ${ref.name}`,
    `التصنيف: ${ref.category}`,
    ref.royalDecree ? `أداة الإصدار: ${ref.royalDecree}` : '',
    ref.cabinetResolution ? `قرار مجلس الوزراء: ${ref.cabinetResolution}` : '',
    ref.status ? `الحالة المسجلة: ${ref.status}` : '',
    `المصدر الرسمي: ${ref.officialSourceUrl}`,
    ref.lawExcerpt ? `مقتطف مفهرس من نص النظام:\n${ref.lawExcerpt}` : '',
    ref.executiveExcerpt ? `مقتطف مفهرس من اللائحة/الملحقات:\n${ref.executiveExcerpt}` : '',
    ref.amendmentsExcerpt ? `مقتطف مفهرس من سجل التعديلات:\n${ref.amendmentsExcerpt}` : '',
  ].filter(Boolean).join('\n'));

  return [
    '[المراجع الرسمية المسترجعة من مركز المراجع]',
    'هذه المقتطفات هي النصوص المفهرسة داخل المنصة والمرتبطة بمصدر رسمي. لا تنسب نصاً حرفياً أو تعديلاً غير ظاهر في المقتطف، ولا تستبدل المصدر الرسمي بالمقتطف الداخلي.',
    ...blocks,
  ].join('\n\n');
}
