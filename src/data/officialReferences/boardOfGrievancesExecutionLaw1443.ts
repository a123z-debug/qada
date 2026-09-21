import type { OfficialReferenceSystem } from '../officialReferenceIndex';

/**
 * سجل رسمي لنظام التنفيذ أمام ديوان المظالم 1443هـ.
 * لا يعتمد في هذا الملف إلا ما أمكن التحقق منه مباشرة من هيئة الخبراء بمجلس الوزراء.
 */
export const BOARD_OF_GRIEVANCES_EXECUTION_LAW_1443: OfficialReferenceSystem = {
  id: 'board_of_grievances_execution_law_1443',
  name: 'نظام التنفيذ أمام ديوان المظالم',
  status: 'verified',
  royalDecree: 'م/15 بتاريخ 27/01/1443هـ',
  cabinetResolution: '73 بتاريخ 23/01/1443هـ',
  issueDateHijri: '1443-01-27',
  publicationDateHijri: '1443-02-03',
  sources: [
    {
      authority: 'هيئة الخبراء بمجلس الوزراء',
      url: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ae1d79bf-3716-4bc5-a85e-ada100c8a870/1',
      purpose: 'المرجع الرسمي للنظام، وبيانات الإصدار والنشر والحالة وأدوات الإصدار ونص النظام.',
    },
  ],
  articles: [],
  regulations: [
    {
      name: 'اللائحة التنفيذية لنظام التنفيذ أمام ديوان المظالم',
      status: 'needs-correction',
      note: 'لا يعتمد نص اللائحة أو بيانات إصدارها حتى تتم مطابقتها مباشرة مع نسخة رسمية مستقلة منشورة وقابلة للتحقق.',
    },
  ],
  amendments: [],
  versions: [
    {
      label: 'الإصدار الأساسي 1443هـ',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ae1d79bf-3716-4bc5-a85e-ada100c8a870/1',
      note: 'تاريخ الإصدار 27/01/1443هـ، وتاريخ النشر 03/02/1443هـ، والحالة ساري وفق هيئة الخبراء. تفهرس المواد والتعديلات لاحقاً بعد المطابقة المباشرة ولا تستنتج من الذاكرة أو المصادر الثانوية.',
    },
  ],
};
