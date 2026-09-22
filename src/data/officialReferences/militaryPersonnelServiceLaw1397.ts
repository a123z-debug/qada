import type { OfficialReferenceSystem } from '../officialReferenceIndex';

/**
 * سجل محافظ لنظام خدمة الأفراد.
 * لا يُحوَّل أي ادعاء تاريخي عن تعديل أو بدل إلى "verified" ما لم تُطابق أداة التعديل
 * ونسختها الرسمية. المواد أدناه مثبت وجودها في صفحة النظام الرسمية؛ الملاحظات تلخص
 * وظيفتها فقط ولا تُعامل كنص حرفي بديل عن المصدر.
 */
export const MILITARY_PERSONNEL_SERVICE_LAW_1397: OfficialReferenceSystem = {
  id: 'military_personnel_service_law_1397',
  name: 'نظام خدمة الأفراد',
  status: 'verified',
  royalDecree: 'م/9 بتاريخ 24/03/1397هـ',
  issueDateHijri: '1397-03-24',
  sources: [
    {
      authority: 'هيئة الخبراء بمجلس الوزراء',
      url: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1',
      purpose: 'المرجع الرسمي لنظام خدمة الأفراد وبيانات الإصدار ونصوص المواد والإصدارات المتاحة.',
    },
  ],
  articles: [
    {
      number: '2',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1',
      note: 'المادة مفهرسة في المصدر الرسمي. الفقرة (هـ) تعرف الفرد الفني؛ ولا تكفي وحدها كسند مستقل لاستحقاق العلاوة الفنية.',
    },
    {
      number: '16',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1',
      note: 'المادة مفهرسة في المصدر الرسمي وتتعلق باستحقاق الفرد الفني للعلاوة الفنية وضوابطها. يجب الرجوع للنص الرسمي واللائحة عند تطبيقها على واقعة محددة.',
    },
    {
      number: '17',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1',
      note: 'المادة مفهرسة في المصدر الرسمي وتتعلق بقواعد العلاوات والجمع بينها. عند الاحتجاج بنسخة تاريخية أو تعديل لاحق يجب مطابقة الإصدار وأداة التعديل الرسمية قبل الجزم بالنص النافذ في التاريخ محل النزاع.',
    },
    {
      number: '19',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1',
      note: 'المادة مفهرسة في المصدر الرسمي وتتصل باستمرار أو سقوط بعض العلاوات بحسب مزاولة العمل الذي خصصت له؛ وهي ذات صلة مباشرة عند النزاع حول الممارسة الفعلية.',
    },
  ],
  regulations: [
    {
      name: 'اللائحة التنفيذية لنظام خدمة الأفراد',
      status: 'needs-correction',
      sourceUrl: 'https://www.uqn.gov.sa/details?p=23613',
      note: 'يوجد مصدر نشر رسمي مرتبط باللائحة، لكن لا يعتمد QADA نصاً حرفياً أو تاريخاً تفصيلياً متعارضاً قبل المطابقة المباشرة مع أصل النشر والنسخة النافذة.',
    },
  ],
  amendments: [
    {
      label: 'الادعاء بتعديل المادة (17/ب) بالمرسوم الملكي (م/37) وتاريخ 30/06/1430هـ',
      status: 'needs-correction',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1',
      note: 'ظهر هذا الاستناد في مستندات المستخدم ومصادر ثانوية، لكن أداة التعديل الرسمية المستقلة لم تُثبت داخل فهرس QADA بعد. يمنع عرضه كسند رسمي متحقق إلى أن تُطابق نسخة رسمية أو إصدار النظام الذي يثبت التعديل.',
    },
  ],
  versions: [
    {
      label: 'نسخة النظام الرسمية الحالية في بوابة الأنظمة السعودية',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1',
      note: 'تعتمد بوصفها مرجعاً للنظام الحالي والمواد المفهرسة. تطبيق النص على فترة تاريخية يتطلب مطابقة الإصدار النافذ في تلك الفترة.',
    },
  ],
};
