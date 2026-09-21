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
  {
    id: 'evidence_law_1443',
    name: 'نظام الإثبات',
    status: 'verified',
    royalDecree: 'م/43 بتاريخ 26/05/1443هـ',
    cabinetResolution: '283 بتاريخ 24/05/1443هـ',
    issueDateHijri: '1443-05-26',
    publicationDateHijri: '1443-06-04',
    effectiveRule: 'يعمل بالنظام بعد مضي (مائة وثمانين) يوماً من تاريخ نشره في الجريدة الرسمية وفق المادة (129).',
    sources: [
      {
        authority: 'هيئة الخبراء بمجلس الوزراء',
        url: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/2716057c-c097-4bad-8e1e-ae1400c678d5/1',
        purpose: 'المرجع الرسمي للنظام وبيانات الإصدار والنشر والحالة ونصوص المواد.',
      },
      {
        authority: 'جريدة أم القرى',
        url: 'https://www.uqn.gov.sa/details?p=18818',
        purpose: 'النص الرسمي المنشور لنظام الإثبات ومواد النظام.',
      },
      {
        authority: 'جريدة أم القرى',
        url: 'https://www.uqn.gov.sa/details?p=18820',
        purpose: 'قرار مجلس الوزراء رقم (283) المتضمن الموافقة على نظام الإثبات.',
      },
      {
        authority: 'جريدة أم القرى',
        url: 'https://www.uqn.gov.sa/wp-content/uploads/2022/10/%D8%A7%D9%84%D8%B9%D8%AF%D8%AF-4954.pdf',
        purpose: 'إثبات نشر قرار وزير العدل رقم (921) والأدوات التنفيذية لنظام الإثبات.',
      },
    ],
    articles: [
      { number: '1', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/2716057c-c097-4bad-8e1e-ae1400c678d5/1', note: 'ظهرت المادة صراحة في المصدر الرسمي، وتحدد نطاق سريان النظام على المعاملات المدنية والتجارية.' },
      { number: '2', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/2716057c-c097-4bad-8e1e-ae1400c678d5/1', note: 'ظهرت المادة صراحة في المصدر الرسمي ضمن الأحكام العامة للإثبات.' },
      { number: '3', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/2716057c-c097-4bad-8e1e-ae1400c678d5/1', note: 'ظهرت المادة صراحة في المصدر الرسمي ضمن الأحكام العامة وقواعد عبء الإثبات.' },
      { number: '4', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/2716057c-c097-4bad-8e1e-ae1400c678d5/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بالتعامل مع تعارض أدلة الإثبات وتسبيب المحكمة.' },
      { number: '10', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/details?p=18818', note: 'ظهرت المادة صراحة في النشر الرسمي وتتعلق بإجراءات الإثبات الإلكترونية.' },
      { number: '53', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/details?p=18818', note: 'ظهرت المادة صراحة في النشر الرسمي ضمن باب الدليل الرقمي.' },
      { number: '54', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/details?p=18818', note: 'ظهرت المادة صراحة في النشر الرسمي ضمن باب الدليل الرقمي.' },
      { number: '55', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/details?p=18818', note: 'ظهرت المادة صراحة في النشر الرسمي ضمن باب الدليل الرقمي.' },
      { number: '56', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/details?p=18818', note: 'ظهرت المادة صراحة في النشر الرسمي ضمن باب الدليل الرقمي.' },
      { number: '80', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/details?p=18818', note: 'ظهرت المادة صراحة في النشر الرسمي وتتعلق بإحالة الشهادة الزور إلى النيابة العامة.' },
      { number: '81', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/details?p=18818', note: 'ظهرت المادة صراحة في النشر الرسمي ضمن الدعوى المستعجلة لسماع الشهادة.' },
      { number: '126', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/wp-content/uploads/2022/10/%D8%A7%D9%84%D8%B9%D8%AF%D8%AF-4954.pdf', note: 'وردت الإحالة إلى المادة (126) صراحة في ديباجة قرار وزير العدل رقم (921) المنشور رسمياً.' },
      { number: '129', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/2716057c-c097-4bad-8e1e-ae1400c678d5/1', note: 'ثبتت من المصدر الرسمي بوصفها مادة النشر والنفاذ؛ يعمل بالنظام بعد مضي 180 يوماً من تاريخ نشره في الجريدة الرسمية.' },
    ],
    regulations: [
      {
        name: 'ضوابط إجراءات الإثبات إلكترونياً',
        status: 'verified',
        sourceUrl: 'https://www.uqn.gov.sa/details?p=20765',
        note: 'اعتمدت بقرار وزير العدل رقم (921) وتاريخ 16/03/1444هـ، ونشرت في أم القرى بتاريخ 03/04/1444هـ.',
      },
      {
        name: 'الأدلة الإجرائية لنظام الإثبات',
        status: 'verified',
        sourceUrl: 'https://www.uqn.gov.sa/details?p=20767',
        note: 'اعتمدت بقرار وزير العدل رقم (921) وتاريخ 16/03/1444هـ، ونشرت في أم القرى بتاريخ 03/04/1444هـ. يظهر المصدر الرسمي تاريخ آخر تعديل 19/03/1448هـ (01/09/2026م).',
      },
      {
        name: 'القواعد الخاصة بتنظيم شؤون الخبرة أمام المحاكم',
        status: 'verified',
        sourceUrl: 'https://www.uqn.gov.sa/wp-content/uploads/2022/10/%D8%A7%D9%84%D8%B9%D8%AF%D8%AF-4954.pdf',
        note: 'ثبتت الموافقة عليها ونشرها ضمن قرار وزير العدل رقم (921) المنشور في العدد (4954) من جريدة أم القرى.',
      },
    ],
    amendments: [],
    versions: [
      {
        label: 'النشر الرسمي لنظام الإثبات بتاريخ 04/06/1443هـ',
        status: 'verified',
        sourceUrl: 'https://www.uqn.gov.sa/details?p=18818',
        note: 'مرجع النسخة المنشورة؛ لا يعتمد أي تعديل لاحق إلا بعد إثباته من مصدر رسمي مستقل.',
      },
      {
        label: 'الأدلة الإجرائية - آخر تعديل ظاهر بالمصدر الرسمي 19/03/1448هـ',
        status: 'verified',
        sourceUrl: 'https://www.uqn.gov.sa/details?p=20767',
        note: 'يسجل تاريخ آخر تعديل الظاهر في أم القرى دون استنتاج مضمون التعديل؛ تفاصيل التعديل تحتاج مطابقة مستقلة قبل إدخالها.',
      },
    ],
  },
];
