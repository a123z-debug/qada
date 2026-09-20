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
];
