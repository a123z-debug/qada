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
      'المادة 1',
      'المادة 19',
      'المادة 20',
      'المادة 35',
      'المادة 37',
      'المادة 38',
      'المادة 39',
      'المادة 43',
      'المادة 44',
      'المادة 50',
      'المادة 52',
      'المادة 53',
      'المادة 54',
      'المادة 62',
      'المادة 63',
      'المادة 64',
      'المادة 67',
      'المادة 70',
      'المادة 71',
      'المادة 72',
      'المادة 75',
      'المادة 76',
      'المادة 77',
      'المادة 78',
      'المادة 83',
      'المادة 84',
      'المادة 85',
      'المادة 96',
      'المادة 99',
      'المادة 100',
      'المادة 103',
      'المادة 104',
      'المادة 105',
      'المادة 115',
      'المادة 125',
      'المادة 126',
      'المادة 128',
      'المادة 129',
      'المادة 139',
      'المادة 140',
      'المادة 157',
      'المادة 158',
      'المادة 166',
      'المادة 167',
      'المادة 174',
      'المادة 175',
      'المادة 176',
    ],
    amendments: [],
    versions: ['نسخة بوابة الأنظمة السعودية التابعة لهيئة الخبراء بمجلس الوزراء'],
    officialSourceAuthority: 'هيئة الخبراء بمجلس الوزراء',
    officialSourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9a0249b7-f835-48fa-8d1e-a9a700f1981a/1',
    verificationNote: 'تم التحقق من اسم اللائحة وأداة إصدارها ومن المواد المفهرسة مباشرة من صفحة هيئة الخبراء الرسمية. ترك تاريخ النشر فارغاً لأن تاريخ النشر لم يظهر في البيانات الرسمية المسترجعة في هذه الجولة، ولم يستنتج من تاريخ الإصدار. لا يعني فهرس المواد نسخ نصوصها إلى المنصة؛ النص الحرفي يرجع إلى المصدر الرسمي.',
    textCoverage: 'partial-verified',
  },
];
