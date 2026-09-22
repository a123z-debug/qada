import type { OfficialReferenceSystem } from '../officialReferenceIndex';

/**
 * سجل رسمي تفصيلي لنظام خدمة الأفراد 1397هـ.
 * المصدر الأساس: هيئة الخبراء بمجلس الوزراء، مع أدوات تعديل منشورة في جريدة أم القرى.
 *
 * تحقق تاريخ قرار مجلس الوزراء رقم (324):
 * يعتمد السجل تاريخ 16/03/1397هـ؛ إذ يرد هذا التاريخ في متن المرسوم الملكي
 * المنشور في بوابة هيئة الخبراء، وفي النسخة الحكومية لوزارة الداخلية، كما أعادت
 * جريدة أم القرى إثباته عند تعديل اللائحة التنفيذية سنة 1445هـ.
 * تعرض خانة عنوان قرار مجلس الوزراء في صفحة هيئة الخبراء تاريخاً مختلفاً،
 * لذلك تحفظ هذه الملاحظة كاختلاف عرض في المصدر مع اعتماد التاريخ المؤيد
 * بالوثائق الرسمية المتعددة.
 */
export const PERSONNEL_SERVICE_LAW_1397: OfficialReferenceSystem = {
  id: 'personnel_service_law_1397',
  name: 'نظام خدمة الأفراد',
  status: 'verified',
  royalDecree: 'م/9 بتاريخ 24/03/1397هـ',
  cabinetResolution: '324 بتاريخ 16/03/1397هـ',
  issueDateHijri: '1397-03-24',
  effectiveRule: 'يبدأ العمل بالنظام من غرة ربيع الثاني سنة 1397هـ وفق المرسوم الملكي رقم (م/9).',
  sources: [
    {
      authority: 'هيئة الخبراء بمجلس الوزراء',
      url: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1',
      purpose: 'المرجع الرسمي لنظام خدمة الأفراد ونصوص مواده وتعديلاته الظاهرة في بوابة الأنظمة.',
    },
    {
      authority: 'وزارة الداخلية',
      url: 'https://www.moi.gov.sa/wps/wcm/connect/78a98571-0345-4de1-bdec-588ba3dd4d67/Indiviual%2BService.pdf?MOD=AJPERES',
      purpose: 'نسخة حكومية لنظام خدمة الأفراد تؤكد أن قرار مجلس الوزراء رقم (324) مؤرخ في 16/03/1397هـ، وتستخدم كمرجع مساند لمطابقة اللائحة التنفيذية.',
    },
    {
      authority: 'جريدة أم القرى',
      url: 'https://www.uqn.gov.sa/details?p=18231',
      purpose: 'قرار مجلس الوزراء رقم (44) وتاريخ 16/01/1443هـ المتضمن تعديل الفقرة (د) من المادة (4).',
    },
    {
      authority: 'جريدة أم القرى',
      url: 'https://www.uqn.gov.sa/details?p=18210',
      purpose: 'المرسوم الملكي رقم (م/7) وتاريخ 18/01/1443هـ المتضمن تعديل الفقرة (د) من المادة (4).',
    },
    {
      authority: 'جريدة أم القرى',
      url: 'https://uqn.gov.sa/wp-content/uploads/2022/09/4858.pdf',
      purpose: 'النشر الرسمي لتعديلات 1442هـ على نظامي خدمة الضباط وخدمة الأفراد، ومنها المواد (46) و(47) وإضافة المادة (53 مكرر2).',
    },
    {
      authority: 'جريدة أم القرى',
      url: 'https://www.uqn.gov.sa/details?p=23613',
      purpose: 'قرار مجلس الوزراء رقم (115) وتاريخ 06/02/1445هـ؛ تعديل المادة (28) والفقرة (أ) من البند (الثاني عشر) من اللائحة التنفيذية.',
    },
    {
      authority: 'جريدة أم القرى',
      url: 'https://www.uqn.gov.sa/details?p=23626',
      purpose: 'المرسوم الملكي رقم (م/28) وتاريخ 11/02/1445هـ المتضمن تعديل المادة (28).',
    },
  ],
  articles: [
    { number: '1', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتحدد نطاق تطبيق النظام.' },
    { number: '2', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتضمن التعريفات الأساسية؛ الفقرة (هـ) تعرف الفرد الفني، ولا تعد وحدها نص الاستحقاق المالي للعلاوة الفنية.' },
    { number: '3', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتبين الرتب العسكرية للأفراد.' },
    { number: '4', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/details?p=18231', note: 'ثبتت الفقرة (د) بصيغتها المعدلة رسمياً: حد أدنى 18 عاماً وحد أقصى 40 عاماً، مع عدم الإخلال بالتعيينات السابقة لنفاذ التعديل.' },
    { number: '8', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بشروط ترقية الأفراد.' },
    { number: '14 مكرراً', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ثبتت إضافة المادة بموجب المرسوم الملكي رقم (م/30) وتاريخ 01/06/1425هـ، وتتعلق بالحجز على راتب الفرد وحدوده وأولوية دين النفقة.' },
    { number: '16', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق باستحقاق الفرد الفني للعلاوة الفنية وفق الجدول والضوابط النظامية. عند التطبيق يجب الرجوع إلى النص واللائحة والنسخة النافذة في فترة المطالبة.' },
    { number: '17', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بالعلاوات الأخرى وقواعد الجمع. لا يعتمد QADA صيغة تاريخية منسوبة إلى تعديل سابق إلا بعد مطابقة أداة التعديل الرسمية أو نسخة النظام النافذة في التاريخ محل النزاع.' },
    { number: '19', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتصل باستمرار أو سقوط العلاوات بحسب مزاولة العمل المخصص لها، وهي ذات صلة مباشرة بالنزاع حول ثبوت الممارسة الفعلية.' },
    { number: '28', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/details?p=23613', note: 'ثبت تعديل المادة رسمياً في 1445هـ لتشمل حالات بدل الترحيل، ومنها الانتداب لمدة أو لمدد ثلاثة أشهر فأكثر.' },
    { number: '46', status: 'verified', sourceUrl: 'https://uqn.gov.sa/wp-content/uploads/2022/09/4858.pdf', note: 'ثبت تعديل المادة رسمياً ضمن تعديلات 1442هـ المتعلقة بأنواع الإجازات.' },
    { number: '47', status: 'verified', sourceUrl: 'https://uqn.gov.sa/wp-content/uploads/2022/09/4858.pdf', note: 'ثبت تعديل الفقرة (ج) من المادة ضمن تعديلات 1442هـ.' },
    { number: '53', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بالإجازة المرضية.' },
    { number: '53 مكرر', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ثبتت إضافة إجازة أداء الامتحان الدراسي بموجب المرسوم الملكي رقم (م/11) وتاريخ 10/03/1424هـ.' },
    { number: '53 مكرر2', status: 'verified', sourceUrl: 'https://uqn.gov.sa/wp-content/uploads/2022/09/4858.pdf', note: 'ثبتت إضافة إجازة المرافقة الدراسية بموجب المرسوم الملكي رقم (م/28) وتاريخ 26/03/1442هـ.' },
    { number: '56', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بأسباب انتهاء خدمة الفرد.' },
    { number: '59', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بواجبات الفرد.' },
    { number: '60', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بالمحظورات على الأفراد.' },
    { number: '68', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة وتقرر آلية إعداد أي إضافة أو تعديل للنظام أو لائحته التنفيذية.' },
    { number: '69', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة وتقرر صدور اللائحة التنفيذية بقرار من مجلس الوزراء.' },
    { number: '70', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة وتتعلق بصلاحية مجلس الوزراء في تغيير النظام.' },
  ],
  regulations: [
    {
      name: 'اللائحة التنفيذية لنظام خدمة الأفراد',
      status: 'verified',
      sourceUrl: 'https://www.moi.gov.sa/wps/wcm/connect/78a98571-0345-4de1-bdec-588ba3dd4d67/Indiviual%2BService.pdf?MOD=AJPERES',
      note: 'ثبت صدور اللائحة بقرار مجلس الوزراء رقم (324) وتاريخ 16/03/1397هـ، وثبت نشرها في جريدة أم القرى بالعدد (2666) وتاريخ 21/03/1397هـ. فهرسة النص داخل QADA جزئية حالياً، ولا يسمح بالاقتباس الحرفي من بند غير مطابق صفحةً بصفحة مع النسخة الرسمية.',
    },
    {
      name: 'اللائحة التنفيذية لنظام خدمة الأفراد — الفقرة (أ) من البند (الثاني عشر) بعد تعديل 1445هـ',
      status: 'verified',
      sourceUrl: 'https://www.uqn.gov.sa/details?p=23613',
      note: 'ثبت نص التعديل رسمياً بقرار مجلس الوزراء رقم (115) وتاريخ 06/02/1445هـ والمتعلق بمقدار بدل الترحيل في الحالات المحددة.',
    },
  ],
  amendments: [
    {
      label: 'الاستناد إلى المرسوم الملكي (م/37) وتاريخ 30/06/1430هـ لتعديل المادة (17/ب)',
      status: 'needs-correction',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1',
      note: 'ورد هذا الاستناد في مستندات المستخدم ومصادر ثانوية، لكن أداة التعديل الرسمية المستقلة أو نسخة الإصدار التي تثبت الصياغة المنسوبة لم تُفهرس بعد داخل QADA. يمنع تقديمه كسند رسمي متحقق إلى حين المطابقة.',
    },
    {
      label: 'إضافة المادة (14 مكرراً) - 1425هـ',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1',
      note: 'المصدر الرسمي يثبت الإضافة بموجب المرسوم الملكي رقم (م/30) وتاريخ 01/06/1425هـ.',
    },
    {
      label: 'تعديلات الإجازات - 1442هـ',
      status: 'verified',
      sourceUrl: 'https://uqn.gov.sa/wp-content/uploads/2022/09/4858.pdf',
      note: 'قرار مجلس الوزراء رقم (194) وتاريخ 24/03/1442هـ والمرسوم الملكي رقم (م/28) وتاريخ 26/03/1442هـ: تعديل المادة (46)، والفقرة (ج) من المادة (47)، وإضافة المادة (53 مكرر2).',
    },
    {
      label: 'تعديل الفقرة (د) من المادة (4) - 1443هـ',
      status: 'verified',
      sourceUrl: 'https://www.uqn.gov.sa/details?p=18231',
      note: 'قرار مجلس الوزراء رقم (44) وتاريخ 16/01/1443هـ، وصدر المرسوم الملكي رقم (م/7) وتاريخ 18/01/1443هـ.',
    },
    {
      label: 'تعديل المادة (28) وبدل الترحيل في اللائحة - 1445هـ',
      status: 'verified',
      sourceUrl: 'https://www.uqn.gov.sa/details?p=23613',
      note: 'قرار مجلس الوزراء رقم (115) وتاريخ 06/02/1445هـ، والمرسوم الملكي رقم (م/28) وتاريخ 11/02/1445هـ بالنسبة للمادة (28)، مع تعديل الفقرة (أ) من البند (الثاني عشر) من اللائحة التنفيذية.',
    },
    {
      label: 'إحلال مصطلحات القوات العسكرية - 1436هـ',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1',
      note: 'تثبت صفحة النظام الرسمية قرار مجلس الوزراء رقم (197) وتاريخ 27/04/1436هـ بإحلال عبارة «القوات العسكرية» وعبارة «بأمر من القائد الأعلى لكافة القوات العسكرية» في المواضع المحددة.',
    },
  ],
  versions: [
    {
      label: 'الإصدار الأساسي 1397هـ',
      status: 'verified',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1',
      note: 'المرسوم الملكي رقم (م/9) وتاريخ 24/03/1397هـ والنفاذ من غرة ربيع الثاني ثابتان. يعتمد تاريخ قرار مجلس الوزراء رقم (324) في 16/03/1397هـ استناداً إلى متن المرسوم والنسخة الحكومية لوزارة الداخلية والإحالات الرسمية اللاحقة في أم القرى.',
    },
    {
      label: 'نسخة ما بعد تعديلات الإجازات 1442هـ',
      status: 'verified',
      sourceUrl: 'https://uqn.gov.sa/wp-content/uploads/2022/09/4858.pdf',
      note: 'تثبت أداة النشر الرسمية تعديل المواد المتعلقة بالإجازات وإضافة إجازة المرافقة الدراسية.',
    },
    {
      label: 'نسخة ما بعد تعديل شرط السن 1443هـ',
      status: 'verified',
      sourceUrl: 'https://www.uqn.gov.sa/details?p=18210',
      note: 'تثبت أداة المرسوم الملكي تعديل الفقرة (د) من المادة (4).',
    },
    {
      label: 'نسخة ما بعد تعديل بدل الترحيل 1445هـ',
      status: 'verified',
      sourceUrl: 'https://www.uqn.gov.sa/details?p=23626',
      note: 'تثبت أداة المرسوم الملكي تعديل المادة (28)، ويثبت قرار مجلس الوزراء تعديل الجزء المقابل من اللائحة التنفيذية.',
    },
  ],
};
