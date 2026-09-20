export type OfficialAmendmentStatus = 'official-verified' | 'needs-correction';

export interface OfficialJudicialAmendment {
  id: string;
  systemName: string;
  affectedProvision: string;
  instrument: string;
  publicationDateHijri: string;
  effect: string;
  status: OfficialAmendmentStatus;
  officialSourceAuthority: string;
  officialSourceUrl: string;
  verificationNote: string;
}

/**
 * سجل مستقل للتعديلات القضائية التي أمكن إثباتها من مصدر سعودي رسمي.
 * لا يُنشئ هذا الملف نصوصاً نظامية من الذاكرة، ولا يعني وجود التعديل هنا
 * اعتماد أي نص آخر غير ما يثبته المصدر الرسمي المشار إليه.
 */
export const OFFICIAL_JUDICIAL_AMENDMENTS: OfficialJudicialAmendment[] = [
  {
    id: 'law-practice-article-18-amendment-1443',
    systemName: 'نظام المحاماة',
    affectedProvision: 'المادة الثامنة عشرة',
    instrument: 'مرسوم ملكي رقم (م/66) وتاريخ 1443/7/15هـ',
    publicationDateHijri: '1443-07-24',
    effect: 'تعديل المادة الثامنة عشرة، مع حكم انتقالي باستمرار الجهات المختصة في نظر القضايا المقيدة لديها التي كان يترافع فيها الوكيل المشار إليه في الفقرة (أ) قبل حذفها حتى الانتهاء منها.',
    status: 'official-verified',
    officialSourceAuthority: 'جريدة أم القرى',
    officialSourceUrl: 'https://www.uqn.gov.sa/details?p=19050',
    verificationNote: 'تم التحقق من المرسوم الملكي والحكم الانتقالي مباشرة من النشر الرسمي في جريدة أم القرى. لا يعتمد نص المادة المعدلة هنا دون الرجوع إلى النسخة النافذة في المصدر الرسمي.',
  },
  {
    id: 'commercial-courts-article-16-3-amendment-1444',
    systemName: 'نظام المحاكم التجارية',
    affectedProvision: 'الفقرة (3) من المادة السادسة عشرة',
    instrument: 'مرسوم ملكي رقم (م/191) وتاريخ 1444/11/29هـ',
    publicationDateHijri: '1444-12-01',
    effect: 'تعديل الفقرة (3) من المادة السادسة عشرة اعتباراً من تاريخ العمل بنظام المعاملات المدنية.',
    status: 'official-verified',
    officialSourceAuthority: 'جريدة أم القرى',
    officialSourceUrl: 'https://www.uqn.gov.sa/details?p=23124',
    verificationNote: 'تم التحقق من التعديل وتاريخ النشر مباشرة من المرسوم الملكي المنشور في جريدة أم القرى. النص النافذ للمادة يرجع إلى النسخة الرسمية المحدثة للنظام.',
  },
  {
    id: 'criminal-procedure-article-218-1-evidence-amendment-1443',
    systemName: 'نظام الإجراءات الجزائية',
    affectedProvision: 'الفقرة (1) من المادة الثامنة عشرة بعد المائتين',
    instrument: 'مرسوم ملكي رقم (م/43) وتاريخ 1443/5/26هـ، بناءً على قرار مجلس الوزراء رقم (283) وتاريخ 1443/5/24هـ',
    publicationDateHijri: '1443-06-04',
    effect: 'تعديل الفقرة (1) لإدخال نظام الإثبات ضمن الأحكام المطبقة فيما لم يرد فيه حكم في نظام الإجراءات الجزائية، بما لا يتعارض مع طبيعة القضايا الجزائية. يسري التعديل في تاريخ متزامن مع نفاذ نظام الإثبات.',
    status: 'official-verified',
    officialSourceAuthority: 'جريدة أم القرى',
    officialSourceUrl: 'https://www.uqn.gov.sa/details?p=18825',
    verificationNote: 'تم التحقق من أداة التعديل، قرار مجلس الوزراء، الحكم المعدل، وحكم تزامن السريان مباشرة من المرسوم الملكي المنشور رسمياً. لا يعاد هنا نسخ النص الحرفي للمادة.',
  },
  {
    id: 'administrative-pleadings-article-60-evidence-amendment-1443',
    systemName: 'نظام المرافعات أمام ديوان المظالم',
    affectedProvision: 'المادة الستون',
    instrument: 'مرسوم ملكي رقم (م/43) وتاريخ 1443/5/26هـ، بناءً على قرار مجلس الوزراء رقم (283) وتاريخ 1443/5/24هـ',
    publicationDateHijri: '1443-06-04',
    effect: 'تعديل المادة الستين لإدخال نظام الإثبات مع نظام المرافعات الشرعية ضمن الأحكام المطبقة على الدعاوى أمام محاكم ديوان المظالم فيما لم يرد فيه حكم، بما لا يتعارض مع طبيعة المنازعة الإدارية. يسري التعديل في تاريخ متزامن مع نفاذ نظام الإثبات.',
    status: 'official-verified',
    officialSourceAuthority: 'جريدة أم القرى',
    officialSourceUrl: 'https://www.uqn.gov.sa/details?p=18825',
    verificationNote: 'تم التحقق من أداة التعديل، قرار مجلس الوزراء، الحكم المعدل، وحكم تزامن السريان مباشرة من المرسوم الملكي المنشور رسمياً. هذا السجل يفصل التعديل التاريخي عن النص النافذ للمادة.',
  },
];
