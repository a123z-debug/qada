export type OfficialJudicialRegulationStatus = 'official-verified' | 'needs-correction';

export interface OfficialJudicialRegulationReference {
  id: string;
  parentSystem: string;
  regulationName: string;
  category: string;
  issueInstrument: string;
  issueDateHijri: string;
  publicationDateHijri: string;
  status: OfficialJudicialRegulationStatus;
  materialIndex: string[];
  amendments: string[];
  versions: string[];
  officialSourceAuthority: string;
  officialSourceUrl: string;
  verificationNote: string;
  textCoverage: 'metadata-only' | 'partial-verified' | 'full-verified';
}

/**
 * فهرس مستقل للوائح المرتبطة بالأنظمة القضائية.
 * لا يعتمد أي نص أو تعديل إلا بعد مطابقته بمصدر سعودي رسمي.
 * ترتيب السجل: النظام الأصل ← اللائحة ← المواد ← التعديلات ← النسخ ← المصدر.
 */
export const OFFICIAL_JUDICIAL_REGULATIONS: OfficialJudicialRegulationReference[] = [
  {
    id: 'criminal-procedure-executive-regulation-1436',
    parentSystem: 'نظام الإجراءات الجزائية',
    regulationName: 'اللائحة التنفيذية لنظام الإجراءات الجزائية',
    category: 'الإجراءات الجزائية',
    issueInstrument: 'قرار مجلس الوزراء رقم (142) وتاريخ 1436/3/21هـ',
    issueDateHijri: '1436-03-21',
    publicationDateHijri: '',
    status: 'official-verified',
    materialIndex: [
      'المادة 1', 'المادة 13', 'المادة 14', 'المادة 15', 'المادة 19', 'المادة 20',
      'المادة 30', 'المادة 35', 'المادة 37', 'المادة 38', 'المادة 39', 'المادة 43',
      'المادة 44', 'المادة 48', 'المادة 49', 'المادة 50', 'المادة 52', 'المادة 53',
      'المادة 54', 'المادة 59', 'المادة 60', 'المادة 61', 'المادة 62', 'المادة 63',
      'المادة 64', 'المادة 67', 'المادة 70', 'المادة 71', 'المادة 72', 'المادة 73',
      'المادة 74', 'المادة 75', 'المادة 76', 'المادة 77', 'المادة 78', 'المادة 79',
      'المادة 83', 'المادة 84', 'المادة 85', 'المادة 96', 'المادة 99', 'المادة 100',
      'المادة 103', 'المادة 104', 'المادة 105', 'المادة 108', 'المادة 114', 'المادة 115',
      'المادة 116', 'المادة 125', 'المادة 126', 'المادة 128', 'المادة 129', 'المادة 131',
      'المادة 132', 'المادة 133', 'المادة 139', 'المادة 140', 'المادة 157', 'المادة 158',
      'المادة 166', 'المادة 167', 'المادة 174', 'المادة 175', 'المادة 176',
    ],
    amendments: [],
    versions: ['نسخة بوابة الأنظمة السعودية التابعة لهيئة الخبراء بمجلس الوزراء'],
    officialSourceAuthority: 'هيئة الخبراء بمجلس الوزراء',
    officialSourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9a0249b7-f835-48fa-8d1e-a9a700f1981a/1',
    verificationNote: 'تم التحقق من اسم اللائحة وأداة إصدارها ومن المواد المفهرسة مباشرة من صفحة هيئة الخبراء الرسمية. وُسع فهرس المواد في جولة لاحقة فقط بالمواد التي ظهرت صراحة في المصدر الرسمي، دون استكمال تسلسلي بالاستنتاج. ترك تاريخ النشر فارغاً لأن تاريخ النشر لم يظهر في البيانات الرسمية المسترجعة، ولم يستنتج من تاريخ الإصدار. لا يعني فهرس المواد نسخ نصوصها إلى المنصة؛ النص الحرفي يرجع إلى المصدر الرسمي.',
    textCoverage: 'partial-verified',
  },
  {
    id: 'judicial-costs-executive-regulation-1443',
    parentSystem: 'نظام التكاليف القضائية',
    regulationName: 'اللائحة التنفيذية لنظام التكاليف القضائية',
    category: 'التقاضي والتكاليف القضائية',
    issueInstrument: 'قرار مجلس الوزراء رقم (519) وتاريخ 1443/9/11هـ',
    issueDateHijri: '1443-09-11',
    publicationDateHijri: '1443-09-21',
    status: 'official-verified',
    materialIndex: ['المادة 1', 'المادة 2', 'المادة 6', 'المادة 7', 'المادة 10', 'المادة 11'],
    amendments: [],
    versions: ['نسخة بوابة الأنظمة السعودية التابعة لهيئة الخبراء بمجلس الوزراء - الحالة: ساري'],
    officialSourceAuthority: 'هيئة الخبراء بمجلس الوزراء',
    officialSourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/d7e8efd3-4021-4413-8255-ae7c00f190de/1',
    verificationNote: 'تم التحقق من اسم اللائحة، قرار إصدارها، تاريخ الإصدار 1443/9/11هـ، تاريخ النشر 1443/9/21هـ، وحالتها السارية من صفحة هيئة الخبراء الرسمية. اقتصر فهرس المواد على المواد التي ظهرت صراحة في المصدر الرسمي المسترجع أثناء التحقق، ولم تُستكمل أرقام بقية المواد بالاستنتاج. لا تُعتمد هنا أي صياغة حرفية للمادة دون الرجوع إلى المصدر الرسمي.',
    textCoverage: 'partial-verified',
  },
];
