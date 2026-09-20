import type { OfficialReferenceSystem } from '../officialReferenceIndex';

/**
 * سجل رسمي لنظام التنفيذ الجديد 1447هـ.
 * المصدر المعتمد في هذه الجولة: جريدة أم القرى؛ لا تُعتمد اللائحة التنفيذية الجديدة
 * قبل نشرها رسمياً ومطابقتها. النظام منشور لكنه لا يعمل به إلا بعد مضي 180 يوماً من النشر.
 */
export const EXECUTION_LAW_1447: OfficialReferenceSystem = {
  id: 'execution_law_1447',
  name: 'نظام التنفيذ',
  status: 'verified',
  royalDecree: 'م/237 بتاريخ 03/11/1447هـ',
  cabinetResolution: '746 بتاريخ 26/10/1447هـ',
  issueDateHijri: '1447-11-03',
  publicationDateHijri: '1447-11-14',
  effectiveRule: 'يعمل بالنظام بعد مضي (مائة وثمانين) يوماً من تاريخ نشره في الجريدة الرسمية وفق الفقرة (2) من المادة (65).',
  sources: [
    {
      authority: 'جريدة أم القرى',
      url: 'https://www.uqn.gov.sa/decisions-and-regulations/rules-and-regulations/4000869',
      purpose: 'النص الرسمي المنشور لنظام التنفيذ ومواده، ومنه حكم النفاذ والإحلال في المادة (65).',
    },
    {
      authority: 'جريدة أم القرى',
      url: 'https://www.uqn.gov.sa/decisions-and-regulations/council-of-ministers-decisions/4000867',
      purpose: 'قرار مجلس الوزراء رقم (746) وتاريخ 26/10/1447هـ بالموافقة على نظام التنفيذ والأحكام الانتقالية.',
    },
    {
      authority: 'جريدة أم القرى',
      url: 'https://www.uqn.gov.sa/decisions-and-regulations/royal-decrees/4000866',
      purpose: 'المرسوم الملكي رقم (م/237) وتاريخ 03/11/1447هـ بالموافقة على النظام.',
    },
  ],
  articles: [
    { number: '1', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/decisions-and-regulations/rules-and-regulations/4000869', note: 'ظهرت المادة صراحة في النشر الرسمي، وتتضمن تعريفات النظام.' },
    { number: '7', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/decisions-and-regulations/rules-and-regulations/4000869', note: 'ظهرت المادة صراحة في النشر الرسمي، وتتضمن السندات التنفيذية المشمولة بالنظام.' },
    { number: '45', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/decisions-and-regulations/rules-and-regulations/4000869', note: 'ظهرت المادة صراحة في النشر الرسمي، وتتعلق بمنازعة التنفيذ.' },
    { number: '64', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/decisions-and-regulations/rules-and-regulations/4000869', note: 'تلزم بإصدار اللائحة خلال 180 يوماً من تاريخ صدور النظام، والعمل بها من تاريخ العمل بالنظام.' },
    { number: '65', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/decisions-and-regulations/rules-and-regulations/4000869', note: 'تقرر إحلال النظام محل نظام التنفيذ الصادر بالمرسوم م/53، وأن العمل بالنظام يبدأ بعد مضي 180 يوماً من تاريخ نشره.' },
  ],
  regulations: [
    {
      name: 'اللائحة التنفيذية لنظام التنفيذ 1447هـ',
      status: 'needs-correction',
      note: 'المادة (64) توجب إصدار اللائحة خلال 180 يوماً من تاريخ صدور النظام. لم يُعتمد في هذه الجولة نص للائحة الجديدة لعدم التحقق من نشر نسخة رسمية نهائية مرتبطة بهذا النظام.',
    },
  ],
  amendments: [],
  versions: [
    {
      label: 'النشر الرسمي 14/11/1447هـ',
      status: 'verified',
      sourceUrl: 'https://www.uqn.gov.sa/decisions-and-regulations/rules-and-regulations/4000869',
      note: 'نسخة منشورة رسمياً. لا تُعامل كنسخة نافذة قبل انقضاء مدة النفاذ المقررة في المادة (65/2).',
    },
    {
      label: 'النظام السابق م/53 بتاريخ 13/08/1433هـ - مرحلة انتقالية',
      status: 'verified',
      sourceUrl: 'https://www.uqn.gov.sa/decisions-and-regulations/council-of-ministers-decisions/4000867',
      note: 'قرار مجلس الوزراء يثبت استمرار بعض أحكام الحجز التحفظي والإعسار من النظام السابق مؤقتاً وفق البندين السادس والسابع، فلا يصح إسقاط النظام السابق كلياً قبل تحقق شروط الانتقال والنفاذ.',
    },
  ],
};
