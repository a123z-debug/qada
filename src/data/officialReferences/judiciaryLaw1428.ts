import type { OfficialReferenceSystem } from '../officialReferenceIndex';

/**
 * سجل رسمي لنظام القضاء 1428هـ.
 * لا تُدرج هنا إلا البيانات والمواد التي أمكن مطابقتها مباشرة مع هيئة الخبراء بمجلس الوزراء.
 */
export const JUDICIARY_LAW_1428: OfficialReferenceSystem = {
  id: 'judiciary_law_1428',
  name: 'نظام القضاء',
  status: 'verified',
  royalDecree: 'م/78 بتاريخ 19/09/1428هـ',
  issueDateHijri: '1428-09-19',
  publicationDateHijri: '1428-09-23',
  sources: [
    {
      authority: 'هيئة الخبراء بمجلس الوزراء',
      url: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ea1765a3-dec3-41a0-a32f-a9a700f26d58/1',
      purpose: 'المرجع الرسمي لنظام القضاء، وبيانات الإصدار والنشر ونصوص المواد.',
    },
    {
      authority: 'هيئة الخبراء بمجلس الوزراء',
      url: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/8b59b6e9-94ff-4d7c-90df-acc60000e5ee/1',
      purpose: 'آلية العمل التنفيذية لنظام القضاء ونظام ديوان المظالم المرتبطة بالمرسوم الملكي م/78.',
    },
  ],
  articles: [
    { number: '1', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ea1765a3-dec3-41a0-a32f-a9a700f26d58/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق باستقلال القضاة وعدم التدخل في القضاء.' },
    { number: '2', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ea1765a3-dec3-41a0-a32f-a9a700f26d58/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بعدم قابلية القضاة للعزل إلا في الحالات المبينة في النظام.' },
    { number: '16', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ea1765a3-dec3-41a0-a32f-a9a700f26d58/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتبين دوائر محاكم الاستئناف.' },
    { number: '17', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ea1765a3-dec3-41a0-a32f-a9a700f26d58/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بنظر محاكم الاستئناف للأحكام القابلة للاستئناف وفق الإجراءات المقررة.' },
    { number: '18', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ea1765a3-dec3-41a0-a32f-a9a700f26d58/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بإنشاء محاكم الدرجة الأولى.' },
    { number: '19', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ea1765a3-dec3-41a0-a32f-a9a700f26d58/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بتأليف المحاكم العامة ودوائرها المتخصصة.' },
    { number: '20', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ea1765a3-dec3-41a0-a32f-a9a700f26d58/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بتأليف المحكمة الجزائية ودوائرها.' },
    { number: '21', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ea1765a3-dec3-41a0-a32f-a9a700f26d58/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بتأليف محكمة الأحوال الشخصية.' },
  ],
  regulations: [
    {
      name: 'آلية العمل التنفيذية لنظام القضاء ونظام ديوان المظالم',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/8b59b6e9-94ff-4d7c-90df-acc60000e5ee/1',
      note: 'أداة تنفيذية رسمية مرتبطة بنظام القضاء ونظام ديوان المظالم، منشورة في بوابة هيئة الخبراء.',
    },
  ],
  amendments: [],
  versions: [
    {
      label: 'الإصدار الأساسي 1428هـ',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/ea1765a3-dec3-41a0-a32f-a9a700f26d58/1',
      note: 'تاريخ الإصدار 19/09/1428هـ وتاريخ النشر 23/09/1428هـ وفق المصدر الرسمي. أي تعديل لاحق يفهرس مستقلاً بعد مطابقته من تبويب الإصدارات أو أداة رسمية أخرى.',
    },
  ],
};
