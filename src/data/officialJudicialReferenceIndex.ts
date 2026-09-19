export type OfficialReferenceStatus = 'official-verified' | 'needs-correction';

export interface OfficialJudicialReference {
  id: string;
  systemName: string;
  category: string;
  issueInstrument: string;
  cabinetResolution?: string;
  issueDateHijri: string;
  publicationDateHijri: string;
  status: OfficialReferenceStatus;
  materialIndex: string[];
  regulation?: {
    name: string;
    instrument: string;
    issueDateHijri: string;
    publicationDateHijri: string;
    officialSourceUrl: string;
  };
  amendments: string[];
  versions: string[];
  officialSourceUrl: string;
  verificationNote: string;
}

/**
 * فهرس محافظ للمراجع القضائية المتحقق منها من بوابة الأنظمة السعودية
 * التابعة لهيئة الخبراء بمجلس الوزراء. لا يحتوي هذا الملف نصوص مواد من الذاكرة.
 * materialIndex فهرس بنيوي فقط، والنص الحرفي يُرجع دائماً إلى المصدر الرسمي.
 */
export const OFFICIAL_JUDICIAL_REFERENCE_INDEX: OfficialJudicialReference[] = [
  {
    id: 'administrative-enforcement-law-1443',
    systemName: 'نظام التنفيذ أمام ديوان المظالم',
    category: 'التنفيذ الإداري',
    issueInstrument: 'مرسوم ملكي رقم (م/15) وتاريخ 1443/1/27هـ',
    cabinetResolution: 'قرار مجلس الوزراء رقم (73) وتاريخ 1443/1/23هـ',
    issueDateHijri: '1443-01-27',
    publicationDateHijri: '1443-02-03',
    status: 'official-verified',
    materialIndex: ['المادة 1', 'المادة 2', 'المادة 6', 'المادة 7', 'المادة 10', 'المادة 11', 'المادة 14', 'المادة 15', 'المادة 16', 'المادة 19', 'المادة 20', 'المادة 21', 'المادة 22'],
    amendments: [],
    versions: ['نسخة بوابة الأنظمة السعودية - الحالة: ساري'],
    officialSourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ae1d79bf-3716-4bc5-a85e-ada100c8a870/1',
    verificationNote: 'تم التحقق من بيانات الإصدار والنشر والحالة وأرقام المواد المفهرسة من صفحة النظام الرسمية. لا يعتمد نص مادة إلا عند مطابقته بالمصدر الرسمي.',
  },
  {
    id: 'judicial-costs-law-1443',
    systemName: 'نظام التكاليف القضائية',
    category: 'التقاضي والتكاليف القضائية',
    issueInstrument: 'مرسوم ملكي رقم (م/16) وتاريخ 1443/1/30هـ',
    issueDateHijri: '1443-01-30',
    publicationDateHijri: '1443-02-10',
    status: 'official-verified',
    materialIndex: ['المادة 1', 'المادة 6', 'المادة 7'],
    regulation: {
      name: 'اللائحة التنفيذية لنظام التكاليف القضائية',
      instrument: 'قرار مجلس الوزراء رقم (519) وتاريخ 1443/9/11هـ',
      issueDateHijri: '1443-09-11',
      publicationDateHijri: '1443-09-21',
      officialSourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/d7e8efd3-4021-4413-8255-ae7c00f190de/1',
    },
    amendments: [],
    versions: ['نسخة بوابة الأنظمة السعودية - الحالة: ساري'],
    officialSourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/3e368087-7b31-46e7-8005-ada100b8f703/1',
    verificationNote: 'تم التحقق من بيانات الإصدار والنشر وربط اللائحة التنفيذية بمصدرها الرسمي. فهرسة المواد هنا لا تعني نسخ نصها داخل المنصة.',
  },
  {
    id: 'judiciary-law-1428',
    systemName: 'نظام القضاء',
    category: 'التنظيم القضائي',
    issueInstrument: 'مرسوم ملكي رقم (م/78) وتاريخ 1428/9/19هـ',
    issueDateHijri: '1428-09-19',
    publicationDateHijri: '',
    status: 'official-verified',
    materialIndex: ['المادة 1', 'المادة 2', 'المادة 3', 'المادة 4', 'المادة 5'],
    amendments: [],
    versions: ['نسخة بوابة الأنظمة السعودية'],
    officialSourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ea1765a3-dec3-41a0-a32f-a9a700f26d58/1',
    verificationNote: 'تم التحقق من أداة الإصدار والمواد المفهرسة من المصدر الرسمي. تُرك تاريخ النشر فارغاً في هذه الجولة لعدم تثبيته من نتيجة المصدر المسترجعة، منعاً للتخمين.',
  },
];
