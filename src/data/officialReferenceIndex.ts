export type ReferenceVerification = 'verified' | 'needs-correction';

export type OfficialReferenceVersion = {
  label: string;
  status: ReferenceVerification;
  sourceUrl: string;
  note: string;
};

export type OfficialReferenceRegulation = {
  name: string;
  status: ReferenceVerification;
  sourceUrl?: string;
  note: string;
};

export type OfficialReferenceSystem = {
  id: string;
  name: string;
  status: ReferenceVerification;
  royalDecree: string;
  cabinetResolution?: string;
  issueDateHijri: string;
  publicationDateHijri?: string;
  effectiveRule?: string;
  sources: Array<{
    authority: string;
    url: string;
    purpose: string;
  }>;
  articles: Array<{
    number: string;
    status: ReferenceVerification;
    sourceUrl: string;
    note: string;
  }>;
  regulations: OfficialReferenceRegulation[];
  amendments: OfficialReferenceVersion[];
  versions: OfficialReferenceVersion[];
};

/**
 * فهرس هرمي لمركز المراجع: النظام ← المواد ← اللائحة ← التعديلات ← النسخ ← المصدر.
 * لا تُضاف نصوص المواد هنا إلا بعد التحقق من المصدر الرسمي، وتبقى المصفوفات فارغة
 * عندما تكون بيانات الأداة النظامية فقط هي التي أمكن إثباتها في الجولة الحالية.
 */
export const OFFICIAL_REFERENCE_INDEX: OfficialReferenceSystem[] = [
  {
    id: 'commercial_courts_law_1441',
    name: 'نظام المحاكم التجارية',
    status: 'verified',
    royalDecree: 'م/93 بتاريخ 15/08/1441هـ',
    cabinetResolution: '511 بتاريخ 14/08/1441هـ',
    issueDateHijri: '1441-08-15',
    publicationDateHijri: '1441-08-24',
    effectiveRule: 'يعمل بالنظام بعد ستين يوماً من تاريخ نشره في الجريدة الرسمية وفق المادة (96).',
    sources: [
      {
        authority: 'هيئة الخبراء بمجلس الوزراء',
        url: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/38334008-3b70-4c6c-b3af-aba3016a8061/1',
        purpose: 'المرجع الرسمي للنظام وبياناته وإصداراته.',
      },
      {
        authority: 'وزارة العدل',
        url: 'https://sjp.moj.gov.sa/RegisterationFIles/Documents/monthlyreports/MonReportForSysCirAndRegV11.pdf',
        purpose: 'مرجع حكومي مساند لأداة الاعتماد وتعميم النظام.',
      },
    ],
    articles: [],
    regulations: [
      {
        name: 'اللائحة التنفيذية لنظام المحاكم التجارية',
        status: 'needs-correction',
        note: 'لا يعتمد نص اللائحة أو بيانات إصدارها في هذا الفهرس حتى تتم مطابقتها مباشرة مع نسخة رسمية قابلة للتحقق؛ وجود إحالة إلى اللائحة في مصادر حكومية لا يكفي لاعتماد نصها.',
      },
    ],
    amendments: [],
    versions: [
      {
        label: 'الإصدار الأساسي 1441هـ',
        status: 'verified',
        sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/38334008-3b70-4c6c-b3af-aba3016a8061/1',
        note: 'تعتمد بيانات الإصدار فقط. أي مادة معدلة أو نسخة تاريخية تُضاف مستقلة بعد مطابقة تبويب الإصدارات بالمصدر الرسمي.',
      },
    ],
  },
];
