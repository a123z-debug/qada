import type { OfficialReferenceSystem } from '../officialReferenceIndex';

/**
 * سجل رسمي لنظام المحاماة 1422هـ.
 * لا يعتمد هنا إلا ما أمكن مطابقته مباشرة مع هيئة الخبراء بمجلس الوزراء.
 */
export const LAW_PRACTICE_LAW_1422: OfficialReferenceSystem = {
  id: 'law_practice_law_1422',
  name: 'نظام المحاماة',
  status: 'verified',
  royalDecree: 'م/38 بتاريخ 28/07/1422هـ',
  cabinetResolution: '199 بتاريخ 14/07/1422هـ',
  issueDateHijri: '1422-07-28',
  publicationDateHijri: '1422-07-28',
  sources: [
    {
      authority: 'هيئة الخبراء بمجلس الوزراء',
      url: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f42655be-79b0-4fd4-bb90-a9a700f26a3e/1',
      purpose: 'المرجع الرسمي لنظام المحاماة وبيانات الإصدار والنشر والحالة ونصوص المواد والإصدارات.',
    },
  ],
  articles: [
    {
      number: '1',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f42655be-79b0-4fd4-bb90-a9a700f26a3e/1',
      note: 'ظهرت المادة صراحة في المصدر الرسمي وتعرّف مهنة المحاماة ونطاق الترافع والاستشارات وحق الشخص في الترافع عن نفسه.',
    },
    {
      number: '2',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f42655be-79b0-4fd4-bb90-a9a700f26a3e/1',
      note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بجداول قيد المحامين الممارسين وغير الممارسين وإحالتها إلى اللائحة التنفيذية.',
    },
  ],
  regulations: [
    {
      name: 'اللائحة التنفيذية لنظام المحاماة',
      status: 'needs-correction',
      note: 'وجود الإحالة إلى اللائحة ثابت في النظام، لكن لا يعتمد نصها أو بيانات إصدارها في هذا السجل حتى تتم مطابقة نسخة رسمية مستقلة.',
    },
  ],
  amendments: [],
  versions: [
    {
      label: 'الإصدار الأساسي 1422هـ',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/f42655be-79b0-4fd4-bb90-a9a700f26a3e/1',
      note: 'تاريخ الإصدار والنشر 28/07/1422هـ والحالة ساري وفق هيئة الخبراء. لا يعتمد أي تعديل لاحق إلا بعد مطابقته من أداة رسمية مستقلة.',
    },
  ],
};
