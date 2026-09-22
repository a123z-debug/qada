import type { OfficialReferenceSystem } from '../officialReferenceIndex';

/**
 * سجل رسمي تفصيلي لنظام خدمة الأفراد 1397هـ.
 * المصدر الأساس: هيئة الخبراء بمجلس الوزراء، مع أدوات تعديل منشورة في جريدة أم القرى.
 *
 * ملاحظة تحقق مهمة:
 * يوجد تعارض في التاريخ المعروض لقرار مجلس الوزراء رقم (324):
 * - بيانات أداة الإصدار في صفحة هيئة الخبراء تعرض 24/03/1397هـ.
 * - نص المرسوم الملكي داخل الصفحة يحيل إلى القرار بتاريخ 16/03/1397هـ.
 * - النشر الرسمي اللاحق في أم القرى عند تعديل اللائحة التنفيذية سنة 1445هـ يصف
 *   اللائحة بأنها صادرة بقرار مجلس الوزراء رقم (324) بتاريخ 16/03/1397هـ.
 * لذلك يبقى السجل العام needs-correction في خانة تاريخ قرار مجلس الوزراء،
 * بينما المواد والتعديلات الآتية تعتمد منفردة متى ثبتت من المصدر الرسمي.
 */
export const PERSONNEL_SERVICE_LAW_1397: OfficialReferenceSystem = {
  id: 'personnel_service_law_1397',
  name: 'نظام خدمة الأفراد',
  status: 'needs-correction',
  royalDecree: 'م/9 بتاريخ 24/03/1397هـ',
  cabinetResolution: '324 — تاريخ القرار يحتاج تصحيحاً: 24/03/1397هـ في بيانات هيئة الخبراء مقابل 16/03/1397هـ في نص المرسوم ومصادر أم القرى اللاحقة',
  issueDateHijri: '1397-03-24',
  effectiveRule: 'يبدأ العمل بالنظام من غرة ربيع الثاني سنة 1397هـ وفق المرسوم الملكي رقم (م/9).',
  sources: [
    {
      authority: 'هيئة الخبراء بمجلس الوزراء',
      url: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1',
      purpose: 'المرجع الرسمي لنظام خدمة الأفراد ونصوص مواده وتعديلاته الظاهرة في بوابة الأنظمة.',
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
    { number: '2', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتضمن التعريفات الأساسية للنظام.' },
    { number: '3', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتبين الرتب العسكرية للأفراد.' },
    { number: '4', status: 'verified', sourceUrl: 'https://www.uqn.gov.sa/details?p=18231', note: 'ثبتت الفقرة (د) بصيغتها المعدلة رسمياً: حد أدنى 18 عاماً وحد أقصى 40 عاماً، مع عدم الإخلال بالتعيينات السابقة لنفاذ التعديل.' },
    { number: '8', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ظهرت المادة صراحة في المصدر الرسمي وتتعلق بشروط ترقية الأفراد.' },
    { number: '14 مكرراً', status: 'verified', sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1', note: 'ثبتت إضافة المادة بموجب المرسوم الملكي رقم (م/30) وتاريخ 01/06/1425هـ، وتتعلق بالحجز على راتب الفرد وحدوده وأولوية دين النفقة.' },
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
      status: 'needs-correction',
      sourceUrl: 'https://www.uqn.gov.sa/details?p=23613',
      note: 'ثبت رسمياً وجود اللائحة وإحالة أم القرى إلى صدورها بقرار مجلس الوزراء رقم (324) وتاريخ 16/03/1397هـ، لكن النص الأصلي الكامل للائحة لم تتم مطابقته بعد من نسخة رسمية مستقلة؛ لذلك لا يعتمد نصها الكامل حالياً.',
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
      label: 'الإصدار الأساسي 1397هـ — مع ملاحظة تعارض تاريخ قرار مجلس الوزراء رقم (324)',
      status: 'needs-correction',
      sourceUrl: 'https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/9b461caf-dc11-46bd-a8fd-ac74009a8724/1',
      note: 'المرسوم الملكي رقم (م/9) وتاريخ 24/03/1397هـ والنفاذ من غرة ربيع الثاني ثابتان؛ أما تاريخ قرار مجلس الوزراء رقم (324) فيحتاج حسم التعارض الرسمي قبل اعتماده كبيان نهائي.',
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
