export type OfficialSourceEntry = {
  id: string;
  name: string;
  category: 'قضاء وتقاضي' | 'إثبات' | 'تنفيذ' | 'إجراءات جزائية';
  royalDecree: string;
  cabinetResolution?: string;
  issueDateHijri: string;
  publicationDateHijri: string;
  status: 'ساري';
  sourceAuthority: 'هيئة الخبراء بمجلس الوزراء';
  officialSourceUrl: string;
  verificationNote: string;
};

/**
 * فهرس مصادر رسمية متحقق منها يدوياً من بوابة الأنظمة السعودية بهيئة الخبراء.
 * لا يحتوي هذا الملف على نصوص مواد من الذاكرة؛ الغرض منه تثبيت بيانات المصدر
 * والنشر والأداة النظامية قبل إدخال النصوص والتعديلات إلى مركز المراجع.
 */
export const OFFICIAL_JUDICIAL_SOURCES: OfficialSourceEntry[] = [
  {
    id: 'evidence_law_1443',
    name: 'نظام الإثبات',
    category: 'إثبات',
    royalDecree: 'م/43 بتاريخ 26/05/1443هـ',
    cabinetResolution: '283 بتاريخ 24/05/1443هـ',
    issueDateHijri: '1443-05-26',
    publicationDateHijri: '1443-06-04',
    status: 'ساري',
    sourceAuthority: 'هيئة الخبراء بمجلس الوزراء',
    officialSourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/2716057c-c097-4bad-8e1e-ae1400c678d5/1',
    verificationNote: 'تحقق من بيانات الإصدار والنشر والحالة وأداة الإصدار وقرار مجلس الوزراء من صفحة النظام الرسمية. المادة 129 تقرر العمل بالنظام بعد 180 يوماً من تاريخ نشره.',
  },
  {
    id: 'enforcement_law_1433',
    name: 'نظام التنفيذ',
    category: 'تنفيذ',
    royalDecree: 'م/53 بتاريخ 13/08/1433هـ',
    issueDateHijri: '1433-08-13',
    publicationDateHijri: '1433-10-13',
    status: 'ساري',
    sourceAuthority: 'هيئة الخبراء بمجلس الوزراء',
    officialSourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/c81ba2f1-1bf1-443b-9b1c-a9a700f27110/1',
    verificationNote: 'تحقق من بيانات الإصدار والنشر والحالة وأداة الإصدار من صفحة النظام الرسمية. يجب الرجوع إلى تبويب الإصدارات في المصدر الرسمي قبل اعتماد أي مادة معدلة أو ملغاة.',
  },
  {
    id: 'civil_procedure_law_1435',
    name: 'نظام المرافعات الشرعية',
    category: 'قضاء وتقاضي',
    royalDecree: 'م/1 بتاريخ 22/01/1435هـ',
    issueDateHijri: '1435-01-22',
    publicationDateHijri: '1435-02-03',
    status: 'ساري',
    sourceAuthority: 'هيئة الخبراء بمجلس الوزراء',
    officialSourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f0eaae46-9f84-40ee-815e-a9a700f268b3/1',
    verificationNote: 'تحقق من بيانات الإصدار والنشر والحالة من صفحة النظام الرسمية. نظام الإثبات اللاحق ألغى الباب التاسع من هذا النظام؛ لذلك لا يعتمد نص قديم في الإثبات دون فحص النسخة النافذة.',
  },
  {
    id: 'criminal_procedure_law_1435',
    name: 'نظام الإجراءات الجزائية',
    category: 'إجراءات جزائية',
    royalDecree: 'م/2 بتاريخ 22/01/1435هـ',
    cabinetResolution: '12 بتاريخ 18/01/1435هـ',
    issueDateHijri: '1435-01-22',
    publicationDateHijri: '1435-02-03',
    status: 'ساري',
    sourceAuthority: 'هيئة الخبراء بمجلس الوزراء',
    officialSourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/8f1b7079-a5f0-425d-b5e0-a9a700f26b2d/1',
    verificationNote: 'تحقق من بيانات الإصدار والنشر والحالة وقرار مجلس الوزراء من صفحة النظام الرسمية. لا تعتمد المواد المعدلة أو الملغاة إلا بعد مطابقة تبويب الإصدارات بالمصدر الرسمي.',
  },
];
