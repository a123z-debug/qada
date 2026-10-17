/**
 * تمييز الجهة القضائية ودرجة التقاضي من نص القضية أو الحكم، وسياسة المصادر لكل جهة.
 *
 * - identifyCourt: قراءة حتمية (بلا نموذج) لمؤشرات النص: اسم المحكمة صراحة أقوى مؤشر،
 *   ثم موضوع النزاع وأطرافه. تُرجع الجهة والدرجة ودرجة الثقة والأسباب.
 * - سياسة المصادر: لكل جهة أنظمتها الأساسية، وأنظمة جهات أخرى لا تدخل حزمة مصادرها،
 *   حتى لا تُستورد مفاهيم المحاكم التجارية (مثلاً) إلى قضية إدارية أو جزائية.
 *
 * الملف مشترك بين الواجهة والخادم.
 */

import { getCourtSystem, isCourtSystemId, type CourtLevelId, type CourtSystemId } from './judicialSystem.js';
import { LEGAL_SOURCES, type DeadlineSource } from './litigationDeadlines.js';

export type CourtConfidence = 'high' | 'medium' | 'low';

export type CourtIdentification = {
  systemId: CourtSystemId | null;
  confidence: CourtConfidence;
  levelId: CourtLevelId;
  levelConfidence: CourtConfidence;
  /** أسباب القراءة بالعربية كما تُعرض للمستخدم، الأقوى أولاً. */
  signals: string[];
  scores: Record<CourtSystemId, number>;
  isJudgment: boolean;
};

type Signal = { pattern: RegExp; weight: number; label: string; explicit?: boolean };

const CONFIDENCE_LABELS: Record<CourtConfidence, string> = {
  high: 'عالية',
  medium: 'متوسطة',
  low: 'منخفضة',
};

function normalize(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[^\p{L}\p{N}\s/]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// الأنماط مكتوبة على النص بعد normalize (ة→ه، أ/إ/آ→ا، ى→ي).
const SIGNALS: Record<CourtSystemId, Signal[]> = {
  administrative: [
    { pattern: /ديوان المظالم/, weight: 12, label: 'ورد «ديوان المظالم»', explicit: true },
    { pattern: /المحكمه الاداريه|الاستئناف الاداريه|الدائره الاداريه|الدوائر الاداريه/, weight: 12, label: 'ورد اسم محكمة إدارية', explicit: true },
    { pattern: /قرار(?:ا)? (?:ال)?اداري/, weight: 4, label: 'قرار إداري' },
    { pattern: /الجهه الاداريه|جهه الاداره/, weight: 4, label: 'الجهة الإدارية خصم' },
    { pattern: /الغاء (?:ال)?قرار/, weight: 4, label: 'طلب إلغاء قرار' },
    { pattern: /الخدمه المدنيه/, weight: 4, label: 'الخدمة المدنية' },
    { pattern: /موظف حكومي|موظف(?:ا)? مدني|موظفي الدوله/, weight: 3, label: 'موظف عام' },
    { pattern: /تظلم/, weight: 3, label: 'تظلم إداري' },
    { pattern: /خدمه الافراد|خدمه الضباط|عسكري/, weight: 3, label: 'الخدمة العسكرية' },
    { pattern: /جهه حكوميه|جهه عامه|الجهات الحكوميه/, weight: 3, label: 'جهة حكومية' },
    { pattern: /عقد اداري|المنافسات والمشتريات الحكوميه|منافسه حكوميه|مستخلص/, weight: 3, label: 'عقد إداري' },
    { pattern: /تاديب/, weight: 3, label: 'مساءلة تأديبية' },
    { pattern: /التقاعد|معاش تقاعدي/, weight: 2, label: 'التقاعد' },
    { pattern: /البلديه|امانه (?:ال)?منطقه/, weight: 2, label: 'البلدية أو الأمانة' },
    { pattern: /وزاره/, weight: 1.5, label: 'وزارة طرف في النزاع' },
    { pattern: /بدل|علاوه|ترقيه/, weight: 1.5, label: 'بدل أو علاوة أو ترقية' },
    // لغة الناس اليومية
    // وزن منخفض عمداً: قضايا جزائية وعمالية كثيرة فيها جهة حكومية (رشوة موظف، عقد مع شركة حكومية)، فلا يحسم الاختصاص وحده.
    { pattern: /حكومي|حكوميه|الحكومه/, weight: 1.5, label: 'جهة حكومية' },
    { pattern: /الجوازات|الاحوال المدنيه|الجمارك|هيئه الزكاه|الزكاه والضريبه/, weight: 3, label: 'جهة حكومية مختصة' },
    { pattern: /نزع (?:ال)?ملكيه|نزعت|نزعوا/, weight: 4, label: 'نزع الملكية' },
    { pattern: /الحرس الوطني|الحرس الملكي|وزاره الدفاع|وزاره الداخليه|القوات البريه|القوات الجويه|القوات البحريه|الدفاع الجوي|الامن العام|الدفاع المدني|حرس الحدود|امن الدوله|(?:^|\s)(?:جندي|عريف|وكيل رقيب|رقيب|رئيس رقباء)(?=\s|$)/, weight: 3, label: 'جهة أو رتبة عسكرية' },
    { pattern: /مكافاه الحاسب|الحاسب الالي|نهايه طرفيه|نهايات طرفيه|النهايات الطرفيه|العلاوه الفنيه|علاوه فنيه/, weight: 2, label: 'بدل الحاسب أو العلاوة الفنية' },
    { pattern: /معلم|اداره التعليم|وزاره التعليم|الجامعه الحكوميه/, weight: 1.5, label: 'وظيفة تعليمية عامة' },
    { pattern: /رخصه|ترخيص|فسح البناء/, weight: 1.5, label: 'ترخيص' },
  ],
  commercial: [
    { pattern: /المحكمه التجاريه|المحاكم التجاريه|الدائره التجاريه|الدوائر التجاريه/, weight: 12, label: 'ورد اسم محكمة تجارية', explicit: true },
    { pattern: /سجل تجاري|السجل التجاري/, weight: 4, label: 'السجل التجاري' },
    { pattern: /كمبياله|سند لامر|الاوراق التجاريه/, weight: 4, label: 'ورقة تجارية' },
    { pattern: /افلاس/, weight: 4, label: 'الإفلاس' },
    { pattern: /علامه تجاريه|وكاله تجاريه|امتياز تجاري/, weight: 4, label: 'علامة أو وكالة تجارية' },
    { pattern: /(?:^|\s)(?:تاجر|التاجر|تجار|التجار)(?=\s|$)/, weight: 3, label: 'صفة التاجر' },
    { pattern: /عمل تجاري|اعمال تجاريه|معامله تجاريه/, weight: 3, label: 'عمل تجاري' },
    { pattern: /توريد/, weight: 2.5, label: 'عقد توريد' },
    { pattern: /فاتوره|فواتير/, weight: 2, label: 'فواتير' },
    { pattern: /بضائع|بضاعه/, weight: 2, label: 'بضائع' },
    { pattern: /شريك|الشركاء|مساهم/, weight: 2, label: 'شركاء أو مساهمون' },
    { pattern: /شركه|شركت/, weight: 1.5, label: 'شركة' },
    // لغة الناس اليومية
    { pattern: /مؤسسه|مؤسستي/, weight: 1.5, label: 'مؤسسة' },
    { pattern: /الارباح|ارباح|حصتي|حصته|الشراكه/, weight: 2, label: 'الأرباح والحصص' },
    { pattern: /موزع|التوزيع|امتياز|فرنشايز|وكيل حصري/, weight: 3, label: 'توزيع أو امتياز' },
    { pattern: /الموردين|موردين|متعثر/, weight: 2.5, label: 'موردون أو تعثر' },
    { pattern: /علامتي|الشعار|مقلد/, weight: 2, label: 'علامة أو تقليد' },
    { pattern: /ذات مسؤوليه محدوده|شركتنا|شركتي/, weight: 2.5, label: 'شركة يملكها صاحب الشأن' },
    { pattern: /متجري|متجر/, weight: 1, label: 'متجر' },
  ],
  criminal: [
    { pattern: /المحكمه الجزائيه|المحاكم الجزائيه|الدائره الجزائيه|الدوائر الجزائيه/, weight: 12, label: 'ورد اسم محكمة جزائية', explicit: true },
    { pattern: /النيابه العامه|الادعاء العام/, weight: 5, label: 'النيابة العامة' },
    { pattern: /المتهم|متهم/, weight: 4, label: 'متهم' },
    { pattern: /ادانه|ادانته|بادانه/, weight: 4, label: 'إدانة' },
    { pattern: /الحق العام/, weight: 4, label: 'الحق العام' },
    { pattern: /قصاص/, weight: 4, label: 'القصاص' },
    { pattern: /جريمه|الجرم/, weight: 3, label: 'جريمة' },
    { pattern: /السجن|بسجن|سجنه|الجلد|جلده|تعزير/, weight: 3, label: 'عقوبة' },
    { pattern: /القبض|قبض عليه|التفتيش|توقيف|موقوف/, weight: 3, label: 'قبض أو تفتيش أو توقيف' },
    { pattern: /احتيال|سرقه|تزوير|رشوه|مخدرات|ابتزاز|غسل الاموال|اختلاس|تحرش/, weight: 3, label: 'وصف جرمي' },
    { pattern: /شيك بدون رصيد|شيك لا يقابله رصيد/, weight: 3, label: 'شيك بلا رصيد' },
    // لغة الناس اليومية
    { pattern: /(?:^|\s)(?:نصب|نصاب|نصبوا|احتال|احتالوا)(?=\s|$)/, weight: 3, label: 'احتيال' },
    { pattern: /(?:^|\s)(?:سرق|سرقوا|سرقني)/, weight: 3, label: 'سرقة' },
    { pattern: /يبتز|ابتزني/, weight: 4, label: 'ابتزاز' },
    { pattern: /اخترق|اختراق|هكر|هاكر|تهكير/, weight: 3, label: 'اختراق' },
    { pattern: /ضربني|ضربنا|يضربني|يضربنا|اعتدي علي|تهجم/, weight: 3, label: 'اعتداء' },
    { pattern: /يهددني|هددني|تهديد/, weight: 3, label: 'تهديد' },
    { pattern: /يسبني|تسبني|سبني|يقذف|تقذف|قذف|شتمني/, weight: 3, label: 'سب أو قذف' },
    { pattern: /(?:^|\s)زور(?=\s|$)|زور توقيع/, weight: 3, label: 'تزوير' },
    { pattern: /حشيش|حبوب|كبتاجون|مخدر/, weight: 3, label: 'مخدرات' },
    { pattern: /الشرطه|بلغت|البحث الجنائي|كلنا امن/, weight: 2.5, label: 'بلاغ أو شرطة' },
    { pattern: /انمسك|مسكوه|قبضوا/, weight: 3, label: 'القبض' },
    { pattern: /صورني|نشر (?:ال)?مقطع|ينشرها/, weight: 2.5, label: 'تصوير أو نشر' },
    { pattern: /خيانه (?:ال)?امانه|امانه .{0,30}انكر/, weight: 3, label: 'خيانة الأمانة' },
  ],
  labor: [
    { pattern: /المحكمه العماليه|المحاكم العماليه|الدائره العماليه|الدوائر العماليه/, weight: 12, label: 'ورد اسم محكمة عمالية', explicit: true },
    { pattern: /نظام العمل/, weight: 5, label: 'نظام العمل' },
    { pattern: /صاحب العمل/, weight: 4, label: 'صاحب العمل' },
    { pattern: /عقد (?:ال)?عمل/, weight: 4, label: 'عقد العمل' },
    { pattern: /علاقه العمل/, weight: 4, label: 'علاقة العمل' },
    { pattern: /نهايه الخدمه/, weight: 3, label: 'مكافأة نهاية الخدمة' },
    { pattern: /فصل تعسفي|فصلني|فصله|الفصل من العمل/, weight: 3, label: 'الفصل من العمل' },
    { pattern: /مكتب العمل|التسويه الوديه/, weight: 3, label: 'التسوية الودية' },
    { pattern: /(?:^|\s)(?:العامل|عامل|العمال|عمال)(?=\s|$)/, weight: 2, label: 'العامل' },
    { pattern: /الاستقاله|استقلت/, weight: 2, label: 'الاستقالة' },
    { pattern: /التامينات الاجتماعيه/, weight: 2, label: 'التأمينات الاجتماعية' },
    { pattern: /مؤسسه خاصه|القطاع الخاص|منشاه/, weight: 2, label: 'منشأة خاصة' },
    { pattern: /اجور|رواتب متاخره|الراتب المتاخر/, weight: 1.5, label: 'الأجور' },
    // لغة الناس اليومية
    { pattern: /فصلوني|فصلتني|طردوني|طردني|انهوا خدمتي|انهاء خدمتي/, weight: 3, label: 'الفصل من العمل' },
    { pattern: /راتبي|رواتبي|الراتب|رواتب|معاشي/, weight: 2, label: 'الأجر' },
    { pattern: /كفيلي|الكفيل|كفالتي|نقل (?:ال)?كفاله|بلاغ هروب|بلاغ تغيب|عني هروب/, weight: 4, label: 'الكفالة وبلاغات التغيب' },
    { pattern: /الشغل|الدوام|اداوم|دوامي/, weight: 1.5, label: 'العمل اليومي' },
    { pattern: /عامله منزليه|العماله المنزليه|شغاله|سائق خاص|استقدام/, weight: 4, label: 'العمالة المنزلية' },
    { pattern: /نهايه خدمه|ساعات اضافيه|العمل الاضافي|اوفرتايم/, weight: 2.5, label: 'مستحقات عمالية' },
    { pattern: /اجازه سنويه|رصيد (?:ال)?اجازات|فتره (?:ال)?تجربه|مخالصه/, weight: 2, label: 'شروط العمل' },
    { pattern: /الموارد البشريه|منصه ودي|مكتب العمل/, weight: 3, label: 'جهة العمل المختصة' },
    { pattern: /سقاله|موقع (?:ال)?شغل|موقع (?:ال)?عمل|اصابه عمل|التامينات/, weight: 2, label: 'إصابة أو تأمينات العمل' },
  ],
  'personal-status': [
    { pattern: /محكمه الاحوال الشخصيه|محاكم الاحوال الشخصيه|دائره الاحوال الشخصيه|دوائر الاحوال الشخصيه/, weight: 12, label: 'ورد اسم محكمة الأحوال الشخصية', explicit: true },
    { pattern: /حضانه|المحضون/, weight: 5, label: 'الحضانة' },
    { pattern: /فسخ (?:ال)?نكاح/, weight: 5, label: 'فسخ النكاح' },
    { pattern: /نفقه/, weight: 4, label: 'النفقة' },
    { pattern: /طلاق|طلقني|طلقها|المطلقه/, weight: 4, label: 'الطلاق' },
    { pattern: /خلع/, weight: 4, label: 'الخلع' },
    { pattern: /زياره (?:ال)?(?:اطفال|ابناء|اولاد)|رؤيه (?:ال)?(?:اطفال|ابناء|اولاد)/, weight: 4, label: 'زيارة الأولاد' },
    { pattern: /مهر|صداق/, weight: 3, label: 'المهر' },
    { pattern: /اثبات نسب|النسب/, weight: 3, label: 'النسب' },
    { pattern: /الولايه علي|عضل/, weight: 3, label: 'الولاية' },
    { pattern: /تركه|الورثه|حصر ورثه/, weight: 3, label: 'التركة والورثة' },
    { pattern: /نكاح|عقد الزواج|زوجتي|زوجي|الزوجه/, weight: 2.5, label: 'علاقة زوجية' },
    // لغة الناس اليومية
    { pattern: /طليقي|طليقتي|طليقها|طليقته|زوجتي السابقه|زوجي السابق|ام العيال|ابو العيال|ام عيالي|ابو عيالي/, weight: 4, label: 'طرف سابق في الزواج' },
    { pattern: /عيالي|اطفالي|بزراني|العيال|الاطفال/, weight: 1.5, label: 'الأولاد' },
    { pattern: /هاجرني|هجرني|ما يصرف علي/, weight: 3, label: 'الهجر وترك الإنفاق' },
    { pattern: /يطلقني|اتطلق|تطلقت|تطلقنا|انفصل عنه/, weight: 4, label: 'الطلاق' },
    { pattern: /الورث|(?:^|\s)ورث|الميراث|ميراث|الوصيه|وصيه/, weight: 3, label: 'الإرث والوصية' },
    { pattern: /توفي|توفت|متوفي|الله يرحم/, weight: 1.5, label: 'وفاة' },
    { pattern: /ايتام|يتيم|القاصر/, weight: 2.5, label: 'القاصرون والأيتام' },
    { pattern: /يعترف (?:فيها|فيه|ببنت|بولد)|زواج ما وثقناه|زواج غير موثق/, weight: 3, label: 'النسب أو الزواج غير الموثق' },
  ],
  general: [
    { pattern: /المحكمه العامه|المحاكم العامه|الدائره الحقوقيه|الدوائر الحقوقيه/, weight: 12, label: 'ورد اسم المحكمة العامة', explicit: true },
    { pattern: /حادث سير|حوادث السير|حادث مروري/, weight: 4, label: 'حادث سير' },
    { pattern: /اقرضت|قرض|سلفت|سلفه|سلف /, weight: 3, label: 'قرض أو سلف' },
    { pattern: /شفعه|قسمه (?:ال)?عقار/, weight: 3, label: 'الشفعة أو قسمة العقار' },
    { pattern: /عقار|صك ملكيه|الملكيه|ارض/, weight: 2.5, label: 'عقار أو ملكية' },
    { pattern: /ايجار|مستاجر|المؤجر/, weight: 2.5, label: 'الإيجار' },
    { pattern: /مطالبه ماليه/, weight: 2, label: 'مطالبة مالية' },
    { pattern: /(?:^|\s)(?:دين|الدين|ديون|الديون|مديونيه)(?=\s|$)/, weight: 1.5, label: 'دين' },
    { pattern: /تحويل بنكي/, weight: 1.5, label: 'تحويل بنكي' },
    // لغة الناس اليومية
    { pattern: /مقاول|المقاول/, weight: 2.5, label: 'مقاولة بناء' },
    { pattern: /جاري|الجيران|سور/, weight: 1.5, label: 'الجوار' },
    { pattern: /(?:^|\s)صك|الكروكي|عربون/, weight: 2, label: 'صك أو عربون' },
    { pattern: /نقسم|قسمه|نصيبي/, weight: 2, label: 'القسمة' },
    { pattern: /حادث|نجم|صدم/, weight: 2, label: 'حادث' },
    { pattern: /معرض|اشتريت|شريت/, weight: 1.5, label: 'شراء' },
    { pattern: /التنفيذ|ايقاف (?:ال)?خدمات|خدماتي موقفه|حاجز حسابي|(?:^|\s)حجز/, weight: 3, label: 'التنفيذ' },
    { pattern: /التامين(?!ات)|شركه التامين/, weight: 1.5, label: 'التأمين' },
    { pattern: /المستشفي|الدكتور|خطا طبي/, weight: 1.5, label: 'مسؤولية طبية' },
    { pattern: /البنك|رمز التحقق/, weight: 1.5, label: 'البنك' },
    { pattern: /فلوسي|فلوس/, weight: 1, label: 'مال' },
  ],
};

const SYSTEM_IDS = Object.keys(SIGNALS) as CourtSystemId[];

/** اسم محكمة يسبقه نقل عن الغير («قالوا لي روح…») لا يحسم الجهة: الناس تُنصح كثيراً بجهة خاطئة. */
const HEARSAY_MENTION = /(?:قالوا|قال لي|قال|يقولون|يقول|نصحوني|نصحني|سمعت|اقترحوا|ينصحون)(?:\s+\S+){0,3}\s*$/;
/** اسم محكمة منفي قبله مباشرة («مو المحكمة العامة») لا يُحسب لها. */
const NEGATED_MENTION = /(?:^|\s)(?:مو|مب|ليس|ليست|وليس|غير|بدل|لا)\s*$/;

const CASSATION_REQUEST = /طعن بالنقض|بطلب النقض|طلب النقض|لائحه نقض|صحيفه نقض|مذكره نقض|الاعتراض (?:امام|لدي) المحكمه (?:الاداريه )?العليا/;
const APPEAL_COURT_JUDGMENT = /حكم محكمه الاستئناف|حكمت محكمه الاستئناف|قررت محكمه الاستئناف|ايدت محكمه الاستئناف|الحكم الاستئنافي|حكم استئنافي|تاييد الحكم الابتدائي|الدائره الاستئنافيه/;
const APPEAL_REQUEST = /لائحه اعتراض|لائحه استئناف|صحيفه استئناف|اعتراض علي (?:ال)?حكم|اعترض علي (?:ال)?حكم|استئناف (?:ال)?حكم|اريد (?:ال)?اعتراض|ابي اعترض|ابغي اعترض|الاعتراض بالاستئناف/;
const FIRST_INSTANCE_JUDGMENT = /حكمت المحكمه|حكمت الدائره|منطوق الحكم|صك الحكم|نص الحكم|صدر (?:ال)?حكم|الحكم الابتدائي|لذلك حكمت/;

function identifyLevel(value: string): Pick<CourtIdentification, 'levelId' | 'levelConfidence' | 'isJudgment'> {
  const appealCourtJudgment = APPEAL_COURT_JUDGMENT.test(value);
  const firstInstanceJudgment = FIRST_INSTANCE_JUDGMENT.test(value);
  const isJudgment = appealCourtJudgment || firstInstanceJudgment;
  if (CASSATION_REQUEST.test(value)) return { levelId: 'supreme', levelConfidence: 'high', isJudgment };
  if (appealCourtJudgment) return { levelId: 'supreme', levelConfidence: 'medium', isJudgment };
  if (APPEAL_REQUEST.test(value)) return { levelId: 'appeal', levelConfidence: 'high', isJudgment };
  if (firstInstanceJudgment) return { levelId: 'appeal', levelConfidence: 'medium', isJudgment };
  return { levelId: 'first', levelConfidence: 'low', isJudgment };
}

export function identifyCourt(text: string): CourtIdentification {
  const value = normalize(text);
  const scores = Object.fromEntries(SYSTEM_IDS.map((id) => [id, 0])) as Record<CourtSystemId, number>;
  const matched = Object.fromEntries(SYSTEM_IDS.map((id) => [id, [] as Signal[]])) as Record<CourtSystemId, Signal[]>;

  // كل مؤشر يُحسب مرة واحدة: طول النص لا يرجّح جهة على أخرى.
  for (const id of SYSTEM_IDS) {
    for (const signal of SIGNALS[id]) {
      const match = signal.pattern.exec(value);
      if (!match) continue;
      if (signal.explicit) {
        const before = value.slice(Math.max(0, match.index - 30), match.index);
        if (NEGATED_MENTION.test(before)) continue;
        if (HEARSAY_MENTION.test(before)) {
          scores[id] += 2;
          matched[id].push({ ...signal, weight: 2, explicit: false, label: `${signal.label} (نقلاً عن غيره)` });
          continue;
        }
      }
      scores[id] += signal.weight;
      matched[id].push(signal);
    }
  }

  const ranked = [...SYSTEM_IDS].sort((a, b) => scores[b] - scores[a]);
  const top = ranked[0];
  const second = ranked[1];
  const explicitTop = matched[top].some((signal) => signal.explicit);
  const explicitOther = ranked.slice(1).some((id) => matched[id].some((signal) => signal.explicit));

  let confidence: CourtConfidence = 'low';
  if (scores[top] >= 10 && ((explicitTop && !explicitOther) || scores[top] >= scores[second] * 2)) confidence = 'high';
  else if (scores[top] >= 5 && scores[top] >= scores[second] * 1.5) confidence = 'medium';

  const systemId = scores[top] >= 3 ? top : null;
  const signals = systemId
    ? [...matched[top]].sort((a, b) => b.weight - a.weight).slice(0, 5).map((signal) => signal.label)
    : [];

  return { systemId, confidence, signals, scores, ...identifyLevel(value) };
}

/** قراءة يُعتمد عليها في التوجيه التلقائي أو التنبيه (لا تكفي القراءة المنخفضة). */
export function isConfidentIdentification(identification: CourtIdentification): boolean {
  return Boolean(identification.systemId) && identification.confidence !== 'low';
}

export function describeIdentification(identification: CourtIdentification): string {
  if (!identification.systemId) return 'لم تتضح الجهة القضائية من الملف بعد.';
  const system = getCourtSystem(identification.systemId);
  const level = system.levels[identification.levelId];
  return `${system.title} — ${level.courtName} (ثقة ${CONFIDENCE_LABELS[identification.confidence]})`;
}

// ---------------------------------------------------------------------------
// سياسة المصادر لكل جهة
// ---------------------------------------------------------------------------

/** الأنظمة الأساسية لكل جهة: هويتها وأداة إصدارها متحققة من بوابة هيئة الخبراء. */
export const COURT_CORE_LAWS: Record<CourtSystemId, DeadlineSource[]> = {
  commercial: [LEGAL_SOURCES.commercialCourts, LEGAL_SOURCES.shariaProcedure, LEGAL_SOURCES.civilTransactions],
  general: [LEGAL_SOURCES.shariaProcedure, LEGAL_SOURCES.civilTransactions],
  labor: [LEGAL_SOURCES.labor, LEGAL_SOURCES.shariaProcedure],
  'personal-status': [LEGAL_SOURCES.personalStatus, LEGAL_SOURCES.shariaProcedure],
  administrative: [LEGAL_SOURCES.grievancesLaw, LEGAL_SOURCES.grievancesProcedure],
  criminal: [LEGAL_SOURCES.criminalProcedure],
};

/** أنظمة جهات أخرى لا تدخل حزمة مصادر هذه الجهة. */
const FOREIGN_SOURCE_TERMS: Record<CourtSystemId, string[]> = {
  commercial: ['ديوان المظالم', 'الإجراءات الجزائية', 'النيابة العامة', 'التحقيق والادعاء العام', 'خدمة الأفراد', 'الأحوال الشخصية'],
  general: ['المحاكم التجارية', 'ديوان المظالم', 'الإجراءات الجزائية', 'النيابة العامة', 'التحقيق والادعاء العام', 'خدمة الأفراد'],
  labor: ['المحاكم التجارية', 'ديوان المظالم', 'الإجراءات الجزائية', 'النيابة العامة', 'التحقيق والادعاء العام', 'خدمة الأفراد', 'الأحوال الشخصية'],
  'personal-status': ['المحاكم التجارية', 'ديوان المظالم', 'الإجراءات الجزائية', 'النيابة العامة', 'التحقيق والادعاء العام', 'خدمة الأفراد', 'نظام العمل'],
  administrative: ['المحاكم التجارية', 'الإجراءات الجزائية', 'النيابة العامة', 'التحقيق والادعاء العام', 'الأحوال الشخصية'],
  criminal: ['المحاكم التجارية', 'ديوان المظالم', 'خدمة الأفراد', 'الأحوال الشخصية', 'نظام العمل', 'التحكيم'],
};

/** مفاهيم جهات أخرى ممنوع استيرادها في محاكاة هذه الجهة. */
const DO_NOT_IMPORT: Record<CourtSystemId, string[]> = {
  commercial: ['التظلم الإداري ومدد ديوان المظالم', 'قواعد الإجراءات الجزائية والنيابة العامة', 'أحكام علاقة العامل بصاحب العمل'],
  general: ['الصفة التجارية والدفاتر التجارية ومدد نظام المحاكم التجارية', 'التظلم الإداري ومدد ديوان المظالم', 'قواعد الإجراءات الجزائية'],
  labor: ['الصفة التجارية ونظام المحاكم التجارية', 'التظلم الإداري ومدد ديوان المظالم', 'قواعد الإجراءات الجزائية'],
  'personal-status': ['الصفة التجارية ونظام المحاكم التجارية', 'التظلم الإداري ومدد ديوان المظالم', 'قواعد الإجراءات الجزائية', 'أحكام نظام العمل'],
  administrative: ['الصفة التجارية والدفاتر التجارية وشرط التحكيم التجاري ومدد نظام المحاكم التجارية', 'قواعد الإجراءات الجزائية والنيابة العامة', 'مدد عدم السماع في نظام المعاملات المدنية بدل المادة الثامنة من نظام المرافعات أمام ديوان المظالم'],
  criminal: ['الصفة التجارية ونظام المحاكم التجارية', 'التظلم الإداري ومدد ديوان المظالم', 'قواعد إثبات الدين المدني بدل أدلة الإدانة'],
};

export function isSourceForeignToCourt(sourceName: string, systemId: CourtSystemId): boolean {
  const name = normalize(sourceName);
  return FOREIGN_SOURCE_TERMS[systemId].some((term) => name.includes(normalize(term)));
}

// ---------------------------------------------------------------------------
// تحديد الجهة لأدوات المنصة (المحادثة، المراجعة، تحويل القصة، البحث في المصادر)
// ---------------------------------------------------------------------------

export type CourtResolution = {
  systemId: CourtSystemId | null;
  /** document: مضمون النص يحسم الجهة؛ selection: اختيار المستخدم؛ inferred: ترجيح من النص. */
  basis: 'document' | 'selection' | 'inferred' | 'none';
  selectionSystemId: CourtSystemId | null;
  identification: CourtIdentification;
};

function selectionToSystem(selection: unknown): CourtSystemId | null {
  if (isCourtSystemId(selection)) return selection;
  if (typeof selection !== 'string' || !selection.trim()) return null;
  // اختيار الواجهة قد يكون تسمية عربية مثل «المحكمة الإدارية (ديوان المظالم)».
  const fromLabel = identifyCourt(selection);
  return fromLabel.confidence === 'high' ? fromLabel.systemId : null;
}

/**
 * مضمون النص أولاً: حكم صادر من المحكمة الإدارية يُعامل إدارياً ولو كان المستخدم
 * في مساحة تجارية. بعده اختيار المستخدم، ثم الترجيح متوسط الثقة.
 */
export function resolveCourtSystem(selection: unknown, text: string): CourtResolution {
  const identification = identifyCourt(text);
  const selectionSystemId = selectionToSystem(selection);
  if (identification.systemId && identification.confidence === 'high') {
    return { systemId: identification.systemId, basis: 'document', selectionSystemId, identification };
  }
  if (selectionSystemId) return { systemId: selectionSystemId, basis: 'selection', selectionSystemId, identification };
  if (isConfidentIdentification(identification)) {
    return { systemId: identification.systemId, basis: 'inferred', selectionSystemId, identification };
  }
  return { systemId: null, basis: 'none', selectionSystemId, identification };
}

const BASIS_LABELS: Record<CourtResolution['basis'], string> = {
  document: 'محسومة من مضمون النص',
  selection: 'حسب اختيار المستخدم في الواجهة',
  inferred: 'مرجحة من مضمون النص',
  none: 'غير محسومة',
};

export function buildCourtFrameInstruction(resolution: CourtResolution): string {
  if (!resolution.systemId) {
    return [
      '[تمييز الجهة القضائية]',
      'لم تتضح الجهة القضائية من النص. حددها من الوقائع أو اسأل عنها قبل تطبيق مدد أو إجراءات جهة بعينها، ولا تفترض أن القضية تجارية أو إدارية.',
    ].join('\n');
  }
  const system = getCourtSystem(resolution.systemId);
  const { identification } = resolution;
  const lines = [
    '[تمييز الجهة القضائية]',
    `الجهة: ${system.title} (${BASIS_LABELS[resolution.basis]}).`,
    identification.signals.length && identification.systemId === resolution.systemId
      ? `المؤشرات من النص: ${identification.signals.join('، ')}.`
      : '',
    `عالج المسألة بأنظمة ${system.title} وإجراءاتها ومددها: ${COURT_CORE_LAWS[resolution.systemId].map((law) => law.law).join('، ')}.`,
    `لا تستورد مفاهيم جهة أخرى: ${DO_NOT_IMPORT[resolution.systemId].join('؛ ')}.`,
  ];
  if (resolution.basis === 'document' && resolution.selectionSystemId && resolution.selectionSystemId !== resolution.systemId) {
    lines.push(`تنبيه للمستخدم: الواجهة على ${getCourtSystem(resolution.selectionSystemId).title}، لكن النص من اختصاص ${system.title}؛ نبّهه إلى ذلك صراحة.`);
  }
  if (resolution.basis === 'inferred') {
    lines.push('الجهة مرجحة لا قاطعة: اذكرها كترجيح، واطلب ما يحسمها قبل الجزم بالمدد والإجراءات.');
  }
  if (resolution.basis === 'selection' && isConfidentIdentification(identification) && identification.systemId !== resolution.systemId) {
    lines.push(`تنبيه: بعض مؤشرات النص تشير إلى ${getCourtSystem(identification.systemId as CourtSystemId).title}؛ نبّه المستخدم إلى فحص الاختصاص.`);
  }
  return lines.filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// فحص الاختصاص في المحكمة الافتراضية
// ---------------------------------------------------------------------------

/** عدم اختصاص ثابت: الملف يدل بثقة عالية على جهة أخرى غير المختارة. */
export function jurisdictionIssuesFor(selected: CourtSystemId, identification: CourtIdentification): string[] {
  if (!identification.systemId || identification.systemId === selected || identification.confidence !== 'high') return [];
  const identified = getCourtSystem(identification.systemId);
  return [
    `مؤشرات الملف تدل على اختصاص ${identified.title} لا ${getCourtSystem(selected).title} (${identification.signals.slice(0, 3).join('، ')}). أعد الجلسة أمام ${identified.levels[identification.levelId].courtName}.`,
  ];
}

export function buildJurisdictionInstruction(selected: CourtSystemId, identification: CourtIdentification): string {
  const system = getCourtSystem(selected);
  const mismatch = Boolean(identification.systemId) && identification.systemId !== selected;
  const lines = [
    '[فحص الاختصاص — قبل أي موضوع]',
    `الجهة المختارة للمحاكاة: ${system.title}.`,
    `قراءة الملف آلياً: ${describeIdentification(identification)}${identification.signals.length ? ` — المؤشرات: ${identification.signals.join('، ')}` : ''}.`,
  ];
  if (mismatch && identification.confidence === 'high') {
    lines.push('تنبيه حاسم: مؤشرات الملف تدل على اختصاص جهة أخرى. يفصل وكيل القاضي الأول في الاختصاص النوعي أولاً؛ فإن ثبت عدم الاختصاص فالنتيجة not-ready مع بيان الجهة المختصة، ولا يُحكم في الموضوع.');
  } else if (mismatch && identification.confidence === 'medium') {
    lines.push('تنبيه: بعض مؤشرات الملف تشير إلى جهة أخرى؛ افحصوا الاختصاص النوعي صراحة قبل الموضوع.');
  }
  lines.push(
    `طبّقوا أنظمة ${system.title} وإجراءاتها ومددها فقط: ${COURT_CORE_LAWS[selected].map((law) => law.law).join('، ')}.`,
    `ممنوع استيراد مفاهيم جهة أخرى إلى هذه القضية: ${DO_NOT_IMPORT[selected].join('؛ ')}.`,
  );
  return lines.join('\n');
}
