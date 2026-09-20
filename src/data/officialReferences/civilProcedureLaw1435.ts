import type { OfficialReferenceSystem } from '../officialReferenceIndex';

/**
 * سجل رسمي لنظام المرافعات الشرعية 1435هـ.
 * لا تُدرج هنا إلا البيانات والمواد التي أمكن مطابقتها مباشرة مع مصادر حكومية رسمية.
 */
export const CIVIL_PROCEDURE_LAW_1435: OfficialReferenceSystem = {
  id: 'civil_procedure_law_1435',
  name: 'نظام المرافعات الشرعية',
  status: 'verified',
  royalDecree: 'م/1 بتاريخ 22/01/1435هـ',
  cabinetResolution: '11 بتاريخ 08/01/1435هـ',
  issueDateHijri: '1435-01-22',
  publicationDateHijri: '1435-02-03',
  sources: [
    {
      authority: 'هيئة الخبراء بمجلس الوزراء',
      url: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f0eaae46-9f84-40ee-815e-a9a700f268b3/1',
      purpose: 'المرجع الرسمي للنظام، وبيانات الإصدار والنشر والحالة ونصوص المواد والإصدارات.',
    },
    {
      authority: 'وزارة العدل',
      url: 'https://www.moj.gov.sa/Documents/Regulations/pdf/LegalPleadingsSystemAndItsExecutiveRegulations.pdf',
      purpose: 'نسخة حكومية رسمية تتضمن قرار مجلس الوزراء رقم (11) ونظام المرافعات الشرعية ولائحته التنفيذية.',
    },
  ],
  articles: [
    { number: '1', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f0eaae46-9f84-40ee-815e-a9a700f268b3/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بما تطبقه المحاكم على القضايا المعروضة عليها وتقيدها بإجراءات النظام.' },
    { number: '2', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f0eaae46-9f84-40ee-815e-a9a700f268b3/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق ببقاء الإجراء الصحيح الذي تم في ظل نظام معمول به صحيحاً ما لم ينص على غير ذلك.' },
    { number: '3', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f0eaae46-9f84-40ee-815e-a9a700f268b3/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بالمصلحة اللازمة لقبول الطلب أو الدفع.' },
  ],
  regulations: [
    {
      name: 'اللائحة التنفيذية لنظام المرافعات الشرعية',
      status: 'verified',
      sourceUrl: 'https://www.moj.gov.sa/Documents/Regulations/pdf/LegalPleadingsSystemAndItsExecutiveRegulations.pdf',
      note: 'نسخة منشورة على موقع وزارة العدل الرسمي؛ يفهرس نص كل بند منها لاحقاً بعد المطابقة المباشرة، ولا يُستنتج النص من مصادر غير رسمية.',
    },
  ],
  amendments: [],
  versions: [
    {
      label: 'الإصدار الأساسي 1435هـ',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f0eaae46-9f84-40ee-815e-a9a700f268b3/1',
      note: 'تاريخ الإصدار 22/01/1435هـ وتاريخ النشر 03/02/1435هـ، وحالة النظام ساري وفق هيئة الخبراء. التعديلات اللاحقة تفهرس مستقلة بعد مطابقة أداة كل تعديل رسمياً.',
    },
  ],
};
