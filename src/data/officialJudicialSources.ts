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
  {
    id: 'administrative_enforcement_law_1443',
    name: 'نظام التنفيذ أمام ديوان المظالم',
    category: 'تنفيذ',
    royalDecree: 'م/15 بتاريخ 27/01/1443هـ',
    cabinetResolution: '73 بتاريخ 23/01/1443هـ',
    issueDateHijri: '1443-01-27',
    publicationDateHijri: '1443-02-03',
    status: 'ساري',
    sourceAuthority: 'هيئة الخبراء بمجلس الوزراء',
    officialSourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ae1d79bf-3716-4bc5-a85e-ada100c8a870/1',
    verificationNote: 'تحقق من الاسم والحالة وتاريخ الإصدار والنشر والمرسوم الملكي وقرار مجلس الوزراء من صفحة النظام الرسمية. الصفحة الرسمية تفهرس كذلك أبواب إجراءات التنفيذ والتنفيذ ضد الجهات الإدارية ولصالحها ومنازعات التنفيذ والجرائم والعقوبات.',
  },
  {
    id: 'judicial_costs_law_1443',
    name: 'نظام التكاليف القضائية',
    category: 'قضاء وتقاضي',
    royalDecree: 'م/16 بتاريخ 30/01/1443هـ',
    cabinetResolution: '65 بتاريخ 23/01/1443هـ',
    issueDateHijri: '1443-01-30',
    publicationDateHijri: '1443-02-10',
    status: 'ساري',
    sourceAuthority: 'هيئة الخبراء بمجلس الوزراء',
    officialSourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/3e368087-7b31-46e7-8005-ada100b8f703/1',
    verificationNote: 'تحقق من تاريخ الإصدار والنشر والمرسوم الملكي وقرار مجلس الوزراء من صفحة النظام الرسمية. اللائحة التنفيذية منشورة رسمياً بقرار مجلس الوزراء رقم 519 بتاريخ 11/09/1443هـ؛ تحفظ كمرجع مرتبط مستقل عند توسيع بنية الفهرس للوائح.',
  },
  {
    id: 'board_of_grievances_law_1428',
    name: 'نظام ديوان المظالم',
    category: 'قضاء وتقاضي',
    royalDecree: 'م/78 بتاريخ 19/09/1428هـ',
    cabinetResolution: '303 بتاريخ 19/09/1428هـ',
    issueDateHijri: '1428-09-19',
    publicationDateHijri: '1428-09-23',
    status: 'ساري',
    sourceAuthority: 'هيئة الخبراء بمجلس الوزراء',
    officialSourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/5d3379bd-3547-494e-9fbd-a9a700f26e24/1',
    verificationNote: 'تحقق من الاسم والحالة وتاريخ الإصدار والنشر والمرسوم الملكي وقرار مجلس الوزراء من صفحة النظام الرسمية. لا تعتمد أي نسخة تاريخية أو مادة معدلة قبل مطابقة تبويب الإصدارات في المصدر.',
  },
];
