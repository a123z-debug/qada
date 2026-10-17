/**
 * اختبار «المواطن المتضرر»: 1000 قضية بلهجة شخص حقيقي يشتكي، تمر على كل الوكلاء الحتمية
 * بنفس الترتيب الذي يستخدمه مسار المحادثة (api/chat.ts)، مع قياس الدقة مقابل إجابة معروفة سلفاً.
 *
 * لا يستدعي أي نموذج ذكاء اصطناعي ولا يكلّف شيئاً. هو أداة قياس، لا بوابة نجاح/فشل:
 * يطبع ملخصاً ويكتب تقريراً كاملاً بصيغة JSON إلى المسار المعطى في --out (اختياري).
 *
 * التشغيل: npx tsx scripts/stress-aggrieved-citizen-1000.ts [--out report.json]
 */
import fs from 'node:fs';
import { identifyCourt, isConfidentIdentification, isSourceForeignToCourt, resolveCourtSystem } from '../src/lib/courtJurisdiction';
import type { CourtSystemId } from '../src/lib/judicialSystem';
import { runLegalSourceAgents } from '../src/lib/legalSourceAgents';
import { analyzeLawOfficeRoute } from '../src/lib/lawOfficeExpert';
import { detectCourtProfile } from '../src/lib/courtProfiles';
import { detectCaseStrategyProfile } from '../src/lib/caseStrategyProfiles';
import { shouldActivateDrafting } from '../src/lib/conversationState';
import { guardIntroducedLegalCitations } from '../src/lib/legalCitationGuard';
import { buildDeadlinesInstruction } from '../src/lib/litigationDeadlines';
import { searchTaxonomy, findNode, withCaseType, SYSTEM_LABELS } from '../src/data/caseTaxonomy';
import { redactDirectIdentifiers } from '../api/_privacy';

// ---------------------------------------------------------------------------
// القصص الأساسية: [المعرّف، الجهة الصحيحة، مسار نوع القضية في الفهرس، ما يكتبه في البحث، القصة، جهات مقبولة أيضاً]
// ---------------------------------------------------------------------------
type Base = {
  id: string;
  system: CourtSystemId;
  leaf: string;
  query: string;
  story: string;
  alt?: CourtSystemId[];
  military?: boolean;
  appeal?: boolean;
};

const B = (id: string, system: CourtSystemId, leaf: string, query: string, story: string, extra: Partial<Base> = {}): Base =>
  ({ id, system, leaf, query, story, ...extra });

const BASES: Base[] = [
  // ----------------------------------------------------------------- عامة (مدني، عقار، تنفيذ)
  B('g01', 'general', 'civil/contracts/loan-guarantee/loan', 'سلفت فلوس وما رجعها',
    'سلفت ولد عمي {amount} {ago} بتحويل بنكي ووعدني يرجعها بعد شهرين، والحين صار يتهرب ولا يرد على اتصالاتي وحظرني بالواتساب. وش أسوي عشان أرجع فلوسي؟'),
  B('g02', 'general', 'civil/debts/claims/debt-claim', 'واحد ماخذ فلوسي',
    'واحد من أصحابي أخذ مني {amount} يقول بيشغلها في مشروع ويعطيني ربح، لا مشروع ولا ربح، وكل ما أكلمه يقول اصبر. ما عندي إلا محادثات واتساب وتحويل من حسابي.'),
  B('g03', 'general', 'civil/obligations/tort/traffic-civil', 'حادث سيارة تعويض',
    'صار علي حادث في {city} {ago} والطرف الثاني هو الغلطان حسب نجم مية بالمية، سيارتي تلفت وأنا تعالجت بالمستشفى، وشركة التأمين حقته تماطل وهو يقول مالي دخل. أبي تعويض عن السيارة والعلاج.'),
  B('g04', 'general', 'civil/contracts/sale/defects', 'اشتريت سيارة فيها عيب',
    'اشتريت سيارة مستعملة من معرض في {city} بـ{amount}، وبعد أسبوع طلع القير خربان وقال لي الفني إنه مصلّح قبل ومغطى. المعرض رفض يرجعها ويقول البيع على الحالة.', { alt: ['commercial'] }),
  B('g05', 'general', 'realestate/real-lease/residential/res-deposit', 'المؤجر ما رجع التأمين',
    'طلعت من الشقة اللي كنت مستأجرها في {city} وسلمت المفتاح، والمؤجر رافض يرجع مبلغ التأمين {amount} ويقول فيه أضرار، وأنا مصور الشقة يوم الطلعة وكلها سليمة.'),
  B('g06', 'general', 'realestate/real-lease/residential/res-arrears', 'مستأجر ما يدفع الايجار',
    'عندي شقة مأجرها على واحد صار له سبع شهور ما دفع الإيجار، والعقد في منصة إيجار، وكل مرة يقول بكرة بدفع. أبي أطلعه وآخذ حقي.'),
  B('g07', 'general', 'realestate/ownership/boundaries/encroachment', 'جاري تعدى على ارضي',
    'جاري بنى سور وأخذ من أرضي تقريباً ثلاث متر على طول الحد، وعندي صك الأرض والكروكي، كلمته وقال هذي حدوده وهو يكذب.'),
  B('g08', 'general', 'realestate/ownership/co-ownership/partition', 'قسمة ارض مع شريكي',
    'أنا وشريكي شارين أرض بالنص من {ago} وأبي أبيع نصيبي أو نقسمها، وهو رافض لا يبي يبيع ولا يقسم.'),
  B('g09', 'general', 'realestate/construction/contracting/contractor-delay', 'المقاول تأخر وهرب',
    'تعاقدت مع مقاول يبني بيتي في {city} وعطيته {amount} على دفعات، وقف الشغل من أربع شهور وسحب العمال وما يرد علي، والعقد مكتوب بيننا.'),
  B('g10', 'general', 'realestate/construction/defects/building-defects', 'عيوب بناء تسريب',
    'استلمت الفيلا من المقاول وبعد المطر صار تسريب في السقف وشروخ في الجدران، والمقاول يقول مو مسؤول. أبي يصلحها أو يعوضني.'),
  B('g11', 'general', 'realestate/construction/off-plan/off-plan-delay', 'شقة على الخارطة تأخر التسليم',
    'شريت شقة على الخارطة من مطور عقاري ودفعت {amount}، كان المفروض التسليم {ago} والمشروع للحين واقف وما أحد يرد علينا.', { alt: ['commercial'] }),
  B('g12', 'general', 'civil/debts/instruments/cheque-civil', 'شيك بدون رصيد',
    'واحد عطاني شيك بـ{amount} مقابل سيارة بعتها له، ورحت البنك وطلع الشيك بدون رصيد. وش الطريق اللي أسلكه؟', { alt: ['criminal', 'commercial'] }),
  B('g13', 'general', 'execution/enforcement/titles/judgment-enforcement-civil', 'عندي حكم وما نفذ',
    'عندي حكم نهائي من المحكمة يلزم واحد يدفع لي {amount} من {ago} وللحين ما دفع ولا ريال. كيف أنفذ الحكم؟'),
  B('g14', 'general', 'execution/enforcement/objections/execution-objection', 'وقفوا خدماتي',
    'تفاجأت إن خدماتي موقفة والبنك حاجز حسابي بسبب طلب تنفيذ من شركة تقسيط، وأنا مسدد المبلغ كامل وعندي المخالصة.'),
  B('g15', 'general', 'civil/insurance/medical-liability/medical-error', 'خطأ طبي',
    'أمي دخلت مستشفى خاص في {city} لعملية بسيطة وطلعت بمضاعفات بسبب خطأ الدكتور، والمستشفى يرفض يعترف. أبي آخذ حقها.'),
  B('g16', 'general', 'civil/debts/banking/bank-fraud-claim', 'سحبوا من حسابي',
    'جاني اتصال واحد يقول إنه من البنك وأخذ مني رمز التحقق وسحبوا من حسابي {amount}، والبنك يقول أنت اللي عطيت الرمز ومو مسؤولين.', { alt: ['criminal'] }),
  B('g17', 'general', 'civil/insurance/insurance-claims/vehicle-insurance', 'التأمين رفض يعوضني',
    'سيارتي مأمنة شامل وصار عليها حادث، وشركة التأمين رافضة تعوضني تقول السائق رخصته منتهية وهي كانت سارية.'),
  B('g18', 'general', 'civil/contracts/agency/service-contract', 'دفعت لمكتب وما سلم الشغل',
    'دفعت لمكتب تصميم {amount} يسوي لي شعار وموقع لمشروعي، أخذوا الفلوس وسلموا شغل ناقص وما يردون علي.', { alt: ['commercial'] }),
  B('g19', 'general', 'execution/review/ordinary/appeal-grounds', 'ابي اعترض على حكم',
    'طلع الحكم ضدي في قضية مطالبة مالية في المحكمة العامة، والقاضي ما سمع شهودي. أبي أعترض على الحكم، وش المدة؟', { appeal: true }),
  B('g20', 'general', 'civil/obligations/tort/property-harm', 'الجيران خربوا بيتي',
    'عمال البناء حق الجيران كسروا خزان الماء حقي وجدار الحوش، وهم رافضين يصلحون ويقولون مو إحنا.'),
  B('g21', 'general', 'realestate/ownership/title/sale-promise', 'عربون ارض',
    'عطيت واحد عربون {amount} على أرض، وبعدين تراجع وباعها لغيري ورافض يرجع العربون.'),
  B('g22', 'general', 'execution/procedure/filing/limitation', 'هل سقط حقي',
    'لي فلوس عند واحد من ثمان سنين وما طالبت فيها رسمي، هل سقط حقي أو أقدر أرفع قضية الحين؟'),

  // ----------------------------------------------------------------- عمالية
  B('l01', 'labor', 'labor/termination/dismissal/unjust-dismissal', 'فصلوني من الشغل',
    'فصلوني من الشغل فجأة بعد أربع سنين بدون أي إنذار ولا سبب، قالوا لي بكرة لا تجي، وعندي عقد مع الشركة في {city}. أبي حقوقي.'),
  B('l02', 'labor', 'labor/wages/pay/unpaid-wages', 'ما عطوني رواتبي',
    'الشركة اللي أشتغل فيها صار لها خمس شهور ما عطتني راتب، وكل شوي يقولون الشهر الجاي، وأنا عندي التزامات وأقساط.'),
  B('l03', 'labor', 'labor/termination/end-of-service/eos-reward', 'مكافأة نهاية الخدمة',
    'استقلت بعد تسع سنين خدمة والشركة رافضة تعطيني نهاية الخدمة كاملة، تقول لأنك مستقيل ما لك إلا الثلث.'),
  B('l04', 'labor', 'labor/wages/pay/overtime', 'ساعات اضافية بدون فلوس',
    'كنت أداوم اثنعش ساعة يومياً وأحياناً الجمعة، والشركة ما تعطيني ولا ريال إضافي، والعقد مكتوب فيه ثمان ساعات.'),
  B('l05', 'labor', 'labor/wages/pay/deductions', 'يخصمون من راتبي',
    'المدير يخصم من راتبي كل شهر {amount} بحجة أخطاء بسيطة بدون تحقيق ولا ورق.'),
  B('l06', 'labor', 'labor/contract/formation/probation', 'فترة التجربة',
    'فصلوني بعد شهرين من التعيين وقالوا أنت في فترة التجربة، بس أنا ما وقعت على أي شي فيه تجربة.'),
  B('l07', 'labor', 'labor/injuries/safety/work-injury', 'اصابة عمل',
    'طحت من سقالة في موقع الشغل وانكسرت رجلي، والشركة ما سجلتني في التأمينات وتبي تسفرني.'),
  B('l08', 'labor', 'labor/injuries/special/domestic-worker', 'العاملة هربت',
    'عندي عاملة منزلية هربت بعد ما دفعت تكاليف الاستقدام {amount}، والمكتب يقول ما لنا دخل.'),
  B('l09', 'labor', 'labor/termination/dismissal/constructive', 'اجبروني استقيل',
    'المدير ضغط علي وقال يا تستقيل يا نفصلك ونسوي لك مشاكل، واستقلت غصب، والحين ضاعت حقوقي.'),
  B('l10', 'labor', 'labor/wages/leave/annual-leave', 'رصيد الاجازات',
    'لي ثلاث سنين ما أخذت إجازة سنوية والشركة رافضة تعوضني عنها بعد ما تركت الشغل.'),
  B('l11', 'labor', 'labor/contract/formation/non-compete-labor', 'يمنعوني اشتغل عند منافس',
    'الشركة القديمة رفعت علي تبي تمنعني أشتغل عند منافس، وأنا ما وقعت على شرط عدم منافسة واضح.'),
  B('l12', 'labor', 'labor/termination/end-of-service/clearance', 'وقعت مخالصة',
    'وقعت على مخالصة نهائية وأنا مضغوط عشان يعطوني جوازي، وبعدين اكتشفت إنهم ناقصيني فلوس.'),
  B('l13', 'labor', 'labor/wages/pay/allowances', 'وقفوا بدل السكن',
    'العقد فيه بدل سكن وبدل نقل والشركة وقفتهم من سنة بدون ما تقول لي.'),
  B('l14', 'labor', 'labor/injuries/labor-office/amicable', 'شكوى مكتب العمل',
    'قدمت شكوى في مكتب العمل على الشركة وما حضروا جلسة التسوية، وش الخطوة الجاية؟'),
  B('l15', 'labor', 'labor/contract/transfer/role-change', 'غيروا وظيفتي',
    'نقلوني من وظيفتي محاسب إلى حارس أمن بنفس الراتب عشان أطفش، وهذا إهانة لي.'),
  B('l16', 'labor', 'labor/termination/dismissal/disciplinary', 'فصلوني بسبب الغياب',
    'فصلوني بحجة إني غبت عشر أيام، وأنا كنت منوم بالمستشفى وعندي تقارير.'),
  B('l17', 'labor', 'labor/termination/dismissal/unjust-dismissal', 'فصلوني لاني حامل',
    'أنا موظفة في القطاع الخاص وفصلوني لما عرفوا إني حامل، وقالوا الوظيفة ما تناسبك.'),
  B('l18', 'labor', 'labor/wages/pay/unpaid-wages', 'الكفيل ما يعطيني راتب',
    'أنا مقيم وكفيلي ما يعطيني رواتب من ثلاث شهور وماسك جوازي ويهددني يبلغ عني هروب.'),

  // ----------------------------------------------------------------- أحوال شخصية
  B('p01', 'personal-status', 'family/children/custody/custody-claim', 'ابي حضانة عيالي',
    'طليقي أخذ عيالي بعد الطلاق ورافض يرجعهم لي، وهم صغار أعمارهم أربع وست سنين. أبي حضانتهم.'),
  B('p02', 'personal-status', 'family/children/support/child-support', 'نفقة العيال',
    'تطلقت من سنة وأبو العيال ما يصرف عليهم ولا ريال، وأنا اللي أدفع مدارسهم وعلاجهم.'),
  B('p03', 'personal-status', 'family/children/custody/visitation', 'ما يخليني اشوف عيالي',
    'زوجتي السابقة مانعتني أشوف عيالي من ست شهور، كل ما أروح تقول مو موجودين.'),
  B('p04', 'personal-status', 'family/marriage/separation/khul', 'ابي اتطلق وهو رافض',
    'زوجي يضربني ويهينني وأبي أنفصل عنه وهو رافض يطلقني، وأهلي معي.', { alt: ['criminal'] }),
  B('p05', 'personal-status', 'family/inheritance/estates/estate-division', 'اخوي ماسك الورث',
    'أبوي الله يرحمه توفى من سنتين وأخوي الكبير ماسك كل الورث العمارة والفلوس ورافض يقسم، ويقول اصبروا.'),
  B('p06', 'personal-status', 'family/children/support/spouse-support', 'زوجي ما يصرف علي',
    'زوجي هاجرني من سنة ولا يصرف علي وأنا في بيت أهلي، لا هو مطلق ولا راجع.'),
  B('p07', 'personal-status', 'family/marriage/marriage-contract/dowry', 'المهر المؤخر',
    'زوجي ما عطاني المهر المؤخر اللي في العقد {amount} وتطلقنا.'),
  B('p08', 'personal-status', 'family/children/custody/travel-child', 'تبي تسافر بالعيال',
    'طليقتي تبي تسافر بالعيال برا السعودية وأنا خايف ما ترجعهم.'),
  B('p09', 'personal-status', 'family/inheritance/wills/will-dispute', 'وصية ظالمة',
    'خالي كتب وصية قبل وفاته تعطي واحد من الأولاد أكثر من الثلث وباقي الورثة معترضين.'),
  B('p10', 'personal-status', 'family/children/paternity/paternity-proof', 'الاب ما يعترف بالبنت',
    'تزوجت زواج ما وثقناه وجبت بنت، والأب رافض يعترف فيها.'),
  B('p11', 'personal-status', 'family/marriage/separation/divorce', 'طلقني بالواتساب',
    'زوجي طلقني بالواتساب وما وثق الطلاق، وأبي أثبت الطلاق وحقوقي.'),
  B('p12', 'personal-status', 'family/children/support/support-arrears', 'ما يدفع النفقة',
    'عندي حكم نفقة للعيال وطليقي ما يدفع من ثمان شهور.', { alt: ['general'] }),
  B('p13', 'personal-status', 'family/children/paternity/guardianship', 'فلوس الايتام',
    'أخوي متوفى وعياله أيتام، وعمهم الثاني ماسك فلوسهم ويتصرف فيها بدون رقابة.'),
  B('p14', 'personal-status', 'family/inheritance/estates/heirs-proof', 'حصر ورثة',
    'توفت جدتي وأبي أطلع صك حصر ورثة عشان نقسم البيت.'),
  B('p15', 'personal-status', 'family/children/custody/custody-transfer', 'نقل الحضانة',
    'أم العيال تزوجت وتهمل العيال وأبي أنقل الحضانة لي.'),

  // ----------------------------------------------------------------- تجارية
  B('c01', 'commercial', 'commercial/commercial-contracts/supply/payment-delay', 'شركة ما دفعت قيمة البضاعة',
    'أنا عندي مؤسسة توريد مواد بناء، وردت لشركة مقاولات بضاعة بـ{amount} بفواتير موقعة، ولها ثمان شهور ما سددت.'),
  B('c02', 'commercial', 'commercial/companies/partner-disputes/profit-dispute', 'شريكي ماكل الارباح',
    'أنا وشريكي عندنا شركة ذات مسؤولية محدودة، وهو المدير وماسك الحسابات وما يعطيني نصيبي من الأرباح من سنتين.'),
  B('c03', 'commercial', 'commercial/companies/partner-disputes/partner-exit', 'ابي اطلع من الشراكة',
    'أبي أطلع من الشراكة في المطعم وشريكي رافض يقيّم حصتي أو يشتريها.'),
  B('c04', 'commercial', 'commercial/bankruptcy/creditors/creditor-claims', 'شركة مفلسة علي فلوسها',
    'شركة لها عندي ديون أعلنت إفلاسها، وش أسوي عشان ما يضيع حقي؟'),
  B('c05', 'commercial', 'commercial/intellectual/trademarks/trademark-infringement', 'قلدوا اسم محلي',
    'محل فتح جنبي بنفس اسم محلي ونفس الشعار تقريباً، وعلامتي مسجلة.'),
  B('c06', 'commercial', 'commercial/commercial-contracts/supply/franchise', 'فرنشايز',
    'شريت امتياز تجاري لكوفي ودفعت {amount}، والشركة ما وفت بالتدريب ولا التوريد.'),
  B('c07', 'commercial', 'commercial/commercial-contracts/trade-paper/commercial-note', 'سند لامر ما سدده',
    'عميل تاجر وقع لي سند لأمر بـ{amount} وما سدده بالموعد.', { alt: ['general'] }),
  B('c08', 'commercial', 'commercial/companies/governance/manager-liability', 'المدير اخذ فلوس الشركة',
    'المدير اللي عيناه في شركتنا تصرف في فلوس الشركة لمصلحته واشترى أشياء باسمه.', { alt: ['criminal'] }),
  B('c09', 'commercial', 'commercial/intellectual/ecommerce/online-store-dispute', 'بضاعة مقلدة من متجر',
    'طلبت بضاعة لمتجري من متجر إلكتروني ودفعت {amount}، ووصلتني بضاعة مقلدة ورافضين يرجعون الفلوس.'),
  B('c10', 'commercial', 'commercial/commercial-contracts/supply/distribution', 'كسروا عقد التوزيع',
    'الشركة اللي أنا موزع حصري لها في {city} عينت موزع ثاني وكسرت العقد.'),
  B('c11', 'commercial', 'commercial/companies/formation/share-transfer', 'شريكي باع حصته',
    'شريكي باع حصته في الشركة لشخص غريب بدون ما يعرض علي أول.'),
  B('c12', 'commercial', 'commercial/bankruptcy/procedures/preventive-settlement', 'شركتي متعثرة',
    'شركتي الصغيرة متعثرة وعليها ديون للموردين، وأبي أوقف المطالبات وأرتب السداد.'),
  B('c13', 'commercial', 'commercial/commercial-contracts/commerce-misc/unfair-competition', 'موظف سابق اخذ العملاء',
    'موظف سابق أخذ قائمة عملائنا وفتح محل منافس، ويكلمهم واحد واحد.', { alt: ['labor'] }),

  // ----------------------------------------------------------------- إدارية (ديوان المظالم)
  B('a01', 'administrative', 'admin/civil-service/career/promotion', 'ما رقوني',
    'أنا موظف حكومي في وزارة الصحة، كل زملائي اللي بنفس مرتبتي ترقوا وأنا لا بدون سبب، وتظلمت للإدارة وما ردوا.'),
  B('a02', 'administrative', 'admin/decisions/annulment/licence', 'سحبوا رخصة محلي',
    'البلدية سحبت رخصة محلي وقفلته بحجة مخالفة ما سويتها، ودفعت الغرامة وقفلوه برضه.'),
  B('a03', 'administrative', 'admin/civil-service/termination-admin/service-termination', 'فصلوني من الجامعة',
    'فصلوني من وظيفتي في الجامعة الحكومية بقرار وما سووا معي أي تحقيق.'),
  B('a04', 'administrative', 'admin/admin-contracts/contracts/gov-payments', 'مستخلصات حكومية متاخرة',
    'أنا مقاول نفذت مشروع لإدارة التعليم وخلصته واستلموه، ومستخلصاتي {amount} متأخرة من سنة.'),
  B('a05', 'administrative', 'admin/civil-service/termination-admin/retirement', 'راتب التقاعد غلط',
    'تقاعدت من التعليم وحسبوا راتبي التقاعدي غلط، ناقصين سنوات من خدمتي.'),
  B('a06', 'administrative', 'admin/decisions/annulment/decision-annulment', 'رفضوا تجديد الاقامة',
    'الجوازات رفضت تجديد إقامة زوجتي بدون سبب واضح، وقدمت اعتراض وما فيه رد.'),
  B('a07', 'administrative', 'admin/admin-contracts/compensation/expropriation', 'نزعوا ارضي',
    'الحكومة نزعت جزء من أرضي لمشروع طريق، والتعويض اللي قدروه أقل بكثير من قيمتها.'),
  B('a08', 'administrative', 'admin/civil-service/discipline/disciplinary-penalty', 'عقوبة حسم من الراتب',
    'صدر علي قرار حسم من راتبي بعد تحقيق إداري في الإدارة، والتحقيق ما سمعوا فيه أقوالي.'),
  B('a09', 'administrative', 'admin/admin-contracts/regulatory/municipal', 'الامانة هدمت الملحق',
    'الأمانة هدمت ملحق في بيتي بدون إنذار ويقولون مخالف، وأنا عندي فسح البناء.'),
  B('a10', 'administrative', 'admin/civil-service/career/grade-allowance', 'بدل منطقة نائية',
    'أنا معلمة ومستحقة بدل منطقة نائية وما صرفوه لي من ثلاث سنين.'),
  B('a11', 'administrative', 'admin/decisions/grievance/grievance-reply', 'تظلم وما ردوا',
    'قدمت تظلم على قرار نقلي من {city} لمنطقة بعيدة وصار لي ثلاث شهور ما ردوا.'),
  B('a12', 'administrative', 'admin/admin-contracts/compensation/admin-liability', 'حفرة البلدية خربت سيارتي',
    'سيارتي طاحت في حفرة في الشارع ما عليها أي تحذير من أعمال البلدية وتلفت.'),
  B('a13', 'administrative', 'admin/admin-contracts/regulatory/customs-tax', 'غرامة جمارك',
    'الجمارك فرضت علي غرامة كبيرة على شحنة بحجة تصنيف غلط، وأنا مستورد بأوراق نظامية.'),
  B('a14', 'administrative', 'admin/military/personnel/military-rights', 'مستحقاتي العسكرية',
    'أنا فرد عسكري في وزارة الدفاع ومستحق علاوة فنية من سنتين وما صرفوها، ورفعت طلب ورفضوه.', { military: true }),
  B('a15', 'administrative', 'admin/military/personnel/military-discharge', 'احالوني للتقاعد العسكري',
    'أنا عسكري في الحرس الوطني وأحالوني للتقاعد قبل وقتي بدون سبب مقنع.', { military: true }),
  B('a16', 'administrative', 'admin/military/injury/military-injury', 'اصابة اثناء الخدمة العسكرية',
    'تعرضت لإصابة أثناء الخدمة العسكرية في الحد الجنوبي، وما صرفوا لي تعويض الإصابة.', { military: true }),

  // ----------------------------------------------------------------- جزائية
  B('r01', 'criminal', 'criminal/cyber/online/blackmail', 'واحد يبتزني',
    'واحد أعرفه من السناب صار يبتزني بصور ويطلب فلوس، وإذا ما دفعت يقول بينشرها. أنا خايفة مرة.'),
  B('r02', 'criminal', 'criminal/property-crimes/fraud/fraud-crime', 'نصب علي',
    'واحد نصب علي في سيارة، أخذ مني {amount} دفعة وقال بيجيبها من الكويت، وطلع حسابه وهمي واختفى.'),
  B('r03', 'criminal', 'criminal/persons/life/assault', 'واحد ضربني',
    'واحد ضربني في موقف السيارات في {city} وعندي تقرير طبي، وكاميرات المحل صورته.'),
  B('r04', 'criminal', 'criminal/property-crimes/theft/theft-crime', 'سرقوا بيتي',
    'سرقوا بيتي وأنا مسافر وأخذوا ذهب وفلوس، وبلغت الشرطة ومن ثلاث شهور ما فيه جديد.'),
  B('r05', 'criminal', 'criminal/cyber/online/illegal-access', 'اخترقوا حسابي',
    'واحد اخترق حسابي في الانستقرام وصار ينشر منه ويطلب فلوس من متابعيني.'),
  B('r06', 'criminal', 'criminal/persons/honor/defamation', 'تسبني في القروب',
    'واحدة تسبني وتقذفني في قروب الواتساب قدام الناس، وعندي سكرين شوت.'),
  B('r07', 'criminal', 'criminal/criminal-procedure/arrest/arrest-legality', 'قبضوا على اخوي',
    'قبضوا على أخوي وفتشوا سيارته بدون إذن، وقالوا لقوا فيها حبوب وهو يحلف إنها مو له، وموقوف من أسبوعين.'),
  B('r08', 'criminal', 'criminal/persons/honor/harassment', 'مديري يتحرش فيني',
    'مديري في الشغل يتحرش فيني بالكلام والرسايل، وخايفة أشتكي وأنفصل.', { alt: ['labor'] }),
  B('r09', 'criminal', 'criminal/property-crimes/theft/breach-trust', 'اخذ الامانة وانكر',
    'عطيت واحد أمانة {amount} يوصلها لأهلي وما وصلها، وأنكر إنه استلمها.', { alt: ['general'] }),
  B('r10', 'criminal', 'criminal/persons/life/threat', 'جاري يهددني',
    'جاري يهددني بالقتل ويرسل رسايل تهديد، وأنا وعيالي خايفين.'),
  B('r11', 'criminal', 'criminal/property-crimes/fraud/forgery', 'زور توقيعي',
    'اكتشفت إن واحد زور توقيعي على عقد بيع سيارتي ونقلها باسمه.'),
  B('r12', 'criminal', 'criminal/criminal-procedure/judgment-review/criminal-appeal-grounds', 'ابي اعترض على حكم السجن',
    'انحكم على ولدي بالسجن سنتين في قضية مضاربة، وأبي أعترض على الحكم، القاضي ما أخذ بأقوال الشهود.', { appeal: true }),
  B('r13', 'criminal', 'criminal/persons/honor/family-violence', 'ابوي يضربنا',
    'أبوي يضربنا أنا وأمي وإخواني ويحبسنا في البيت، وأبي أحد يحمينا.', { alt: ['personal-status'] }),
  B('r14', 'criminal', 'criminal/property-crimes/fraud/cheque-crime', 'اشتكي جنائي على شيك',
    'واحد عطاني شيك وطلع بدون رصيد، وأبي أشتكي عليه جنائي مو بس أطالب بالفلوس.', { alt: ['general'] }),
  B('r15', 'criminal', 'criminal/cyber/data/privacy-violation', 'صورني ونشر المقطع',
    'واحد صورني بدون علمي في مكان عام ونشر المقطع في التيك توك.'),
  B('r16', 'criminal', 'criminal/public-order/drugs/possession', 'ولدي انمسك معه حشيش',
    'ولدي انمسك معه حشيش للاستخدام الشخصي وهي أول مرة، وش يصير عليه وكيف أساعده؟'),
];

// ---------------------------------------------------------------------------
// مجموعة مستقلة لقياس التعميم: قصص وعبارات بحث كُتبت بعد ضبط المؤشرات ولم يُضبط عليها شيء.
// أي تحسين يُقاس هنا أولاً؛ الأرقام على BASES وحدها متفائلة لأنها استُخدمت في الضبط.
// ---------------------------------------------------------------------------
const HOLDOUT: Base[] = [
  B('h-g1', 'general', 'civil/contracts/sale/delivery', 'محل الاثاث ما سلمني الطلب', 'دفعت عربون لمحل أثاث يجيب لي غرفة نوم وصار له شهرين ما جابها ولا رجع فلوسي، كل ما أتصل يقولون بكرة.'),
  B('h-g2', 'general', 'realestate/real-lease/residential/res-eviction', 'المالك يبي يطلعني من الشقة', 'المالك يبي يطلعني من الشقة قبل نهاية العقد ويقول بيأجرها لقريبه، وأنا ملتزم بالإيجار.'),
  B('h-g3', 'general', 'civil/obligations/tort/bodily-harm-civil', 'تعويض اصابة ولدي في استراحة', 'ولدي طاح في حفرة مسبح في استراحة مستأجرينها وانكسرت يده، وصاحب الاستراحة يقول مو مسؤول.'),
  B('h-g4', 'general', 'civil/debts/claims/refund-claim', 'يرجعون رسوم الدورة', 'دفعت رسوم دورة تدريبية لمعهد وألغوا الدورة ورافضين يرجعون المبلغ.'),
  B('h-g5', 'general', 'execution/enforcement/objections/payment-schedule', 'تقسيط مبلغ الحكم', 'علي حكم أسدد مبلغ كبير وما أقدر أدفعه مرة وحدة، وأبي أقسطه عشان لا يوقفون خدماتي.'),
  B('h-g6', 'general', 'realestate/ownership/co-ownership/preemption', 'جاري باع نصيبه بدون ما يعرض علي', 'جاري باع نصيبه من الأرض المشتركة بيننا لشخص ثاني بدون ما يعرض علي، وأنا أولى فيها.'),
  B('h-g7', 'general', 'civil/insurance/insurance-claims/medical-insurance', 'التامين الطبي رفض العملية', 'شركة التأمين الطبي رفضت تغطي عملية قلب لأبوي وتقول حالة سابقة، مع إن الوثيقة تغطيها.'),
  B('h-g8', 'general', 'realestate/construction/contracting/variations', 'المقاول يطالب بزيادة', 'المقاول يطالبني بفلوس زيادة على أعمال إضافية ما اتفقنا عليها ولا وقعت عليها.'),
  B('h-l1', 'labor', 'labor/wages/pay/unpaid-wages', 'ما نزل المعاش', 'صاحب المؤسسة اللي أشتغل عندها صار له ثلاث شهور ما نزّل المعاش، ويقول الوضع صعب.'),
  B('h-l2', 'labor', 'labor/termination/dismissal/redundancy', 'استغنوا عني في الشركة', 'استغنوا عني في الشركة بعد سبع سنين بحجة إعادة هيكلة، وجابوا واحد مكاني بعد أسبوع.'),
  B('h-l3', 'labor', 'labor/termination/end-of-service/eos-reward', 'المدرسة الاهلية ما صرفت مستحقاتي', 'خلصت عقدي مع المدرسة الأهلية بعد خمس سنين وما صرفوا لي مستحقاتي.'),
  B('h-l4', 'labor', 'labor/injuries/safety/work-injury', 'اصابة في المصنع', 'انقطع إصبعي في مكينة المصنع، والمصنع يقول أنت السبب ورافض يعوضني.'),
  B('h-l5', 'labor', 'labor/contract/transfer/job-transfer', 'ينقلوني لفرع ثاني غصب', 'الشركة تبي تنقلني من الرياض لفرع في جازان غصب، وإذا رفضت يقولون نفصلك.'),
  B('h-l6', 'labor', 'labor/wages/pay/deductions', 'يقطعون من معاشي', 'كل شهر يقطعون من معاشي بحجة التأخير وأنا أوقع حضور بالبصمة.'),
  B('h-l7', 'labor', 'labor/termination/resignation/resign-dispute', 'رافضين يقبلون استقالتي', 'قدمت استقالتي ورافضين يقبلونها ويقولون لازم تكمل سنة.'),
  B('h-l8', 'labor', 'labor/injuries/special/domestic-worker', 'السواق ترك البيت', 'السواق اللي عندي ترك البيت بدون ما يقول، وأبي أعرف وش أسوي بخصوص إقامته.'),
  B('h-p1', 'personal-status', 'family/children/support/child-support', 'تعديل النفقة', 'أم بناتي تطالبني بنفقة كبيرة فوق طاقتي، وأنا راتبي بسيط وأبي أعدلها.'),
  B('h-p2', 'personal-status', 'family/marriage/separation/annulment', 'افسخ عقد الزواج', 'زوجي مسافر من سنتين ولا يتواصل ولا يصرف، وأبي أفسخ العقد.'),
  B('h-p3', 'personal-status', 'family/inheritance/estates/estate-debts', 'ديون ابوي المتوفى', 'أبوي الله يرحمه عليه ديون للناس، والورثة مختلفين مين يسدد.'),
  B('h-p4', 'personal-status', 'family/children/custody/visitation', 'استضافة بنتي في الاجازة', 'بنتي عند أمها وأبي أستضيفها في الإجازة والأم ترفض.'),
  B('h-p5', 'personal-status', 'family/marriage/marriage-contract/marriage-proof', 'توثيق عقد الزواج', 'تزوجنا عند شيخ وما سجلنا العقد بالمحكمة، والحين نبي نوثق الزواج.'),
  B('h-p6', 'personal-status', 'family/inheritance/waqf/waqf-management', 'عمي ناظر الوقف ياخذ الايجار', 'جدي أوقف بيت وكتب الناظر عمي، وعمي يأخذ الإيجار لنفسه.'),
  B('h-p7', 'personal-status', 'family/children/paternity/interdiction', 'الحجر على اخوي', 'أخوي كبير بالسن وصار يصرف فلوسه بشكل غريب، ونخاف يضيعها وأبي أحجر عليه.'),
  B('h-p8', 'personal-status', 'family/children/support/relatives-support', 'نفقة ابوي على اخواني', 'أبوي كبير وما عنده دخل، وأخواني رافضين يساهمون في مصاريفه.'),
  B('h-c1', 'commercial', 'commercial/commercial-contracts/supply/supply-contract', 'المورد ما ورد المعدات', 'اتفقت مع مورد يوردني معدات لمطعمي ووصل نصفها، والباقي متأخر من شهرين والعقد فيه شرط جزائي.'),
  B('h-c2', 'commercial', 'commercial/companies/governance/general-assembly', 'قرار الشركاء بدون علمي', 'الشركاء صوتوا على قرار زيادة رأس المال بدون ما يبلغوني بالاجتماع.'),
  B('h-c3', 'commercial', 'commercial/companies/partner-disputes/company-dissolution', 'حل الشركة مع شريكي', 'أبي أحل الشركة اللي بيني وبين شريكي لأننا ما عاد نتفاهم، والشركة واقفة.'),
  B('h-c4', 'commercial', 'commercial/intellectual/copyright/trade-secrets', 'سرقوا وصفات المطعم', 'موظف سابق أخذ وصفات المطعم السرية وفتح مطعم بنفس الأكلات.', { alt: ['criminal', 'labor'] }),
  B('h-c5', 'commercial', 'commercial/commercial-contracts/trade-paper/commercial-cheque', 'شيكات شركة رجعت', 'شركة عطتني شيكات مقابل بضاعة ورجعت من البنك.', { alt: ['criminal', 'general'] }),
  B('h-c6', 'commercial', 'commercial/bankruptcy/procedures/liquidation', 'تصفية شركتي', 'شركتي عليها ديون كثيرة وما عاد تقدر تكمل، وأبي أصفيها بشكل نظامي.'),
  B('h-c7', 'commercial', 'commercial/intellectual/trademarks/trade-name-dispute', 'اسم تجاري يشبه اسمي', 'مؤسسة ثانية سجلت اسم تجاري قريب مرة من اسمي وصار العملاء يتلخبطون.'),
  B('h-c8', 'commercial', 'commercial/companies/formation/capital-shares', 'شريكي ينكر حصتي', 'دخلت شريك في مشروع وحطيت 200 ألف، والحين الشريك ينكر إن لي حصة.', { alt: ['general'] }),
  B('h-a1', 'administrative', 'admin/decisions/annulment/administrative-penalty', 'مخالفات مرور ما سويتها', 'المرور سجل علي مخالفات وأنا ما كنت في المدينة أصلاً، وعندي إثبات سفر.'),
  B('h-a2', 'administrative', 'admin/civil-service/career/job-transfer-admin', 'نقلوني لمدرسة بعيدة', 'نقلوني من مدرستي لمدرسة بعيدة في قرية بدون ما يراعون ظروفي، وأنا موظفة حكومية.'),
  B('h-a3', 'administrative', 'admin/civil-service/termination-admin/reinstatement', 'ارجع لوظيفتي الحكومية', 'أنهوا خدمتي في الوزارة بسبب غياب وأنا كنت منومة، وأبي أرجع لوظيفتي.'),
  B('h-a4', 'administrative', 'admin/admin-contracts/contracts/tender', 'استبعدوني من المناقصة', 'قدمت على منافسة حكومية وكان عرضي أقل سعر واستبعدوني بدون سبب.'),
  B('h-a5', 'administrative', 'admin/decisions/annulment/negative-decision', 'طلب منحة ارض معلق', 'قدمت طلب منحة أرض من سنوات والبلدية ما ترد ولا ترفض.'),
  B('h-a6', 'administrative', 'admin/civil-service/discipline/investigation-admin', 'حولوني للتحقيق', 'حولوني للتحقيق في الإدارة بسبب شكوى كيدية من زميل، وأنا موظف في جهة حكومية.'),
  B('h-a7', 'administrative', 'admin/military/personnel/military-promotion', 'ترقيتي العسكرية تاخرت', 'أنا رقيب في الجيش وتأخرت ترقيتي سنتين عن دفعتي بدون سبب.', { military: true }),
  B('h-a8', 'administrative', 'admin/admin-contracts/compensation/unlawful-decision-damage', 'تعويض عن اغلاق المحل', 'الأمانة أغلقت محلي ثلاث شهور وطلع القرار غلط، وأبي تعويض عن الخسارة.'),
  B('h-r1', 'criminal', 'criminal/cyber/online/online-fraud', 'حولت لحساب انستقرام وحظرني', 'طلبت جوال من حساب في الانستقرام وحولت المبلغ وبعدها حظرني.'),
  B('h-r2', 'criminal', 'criminal/persons/life/assault', 'تهاوشت مع واحد وجرحني', 'تهاوشت مع واحد في المطعم وكسر نظارتي وجرحني في وجهي.'),
  B('h-r3', 'criminal', 'criminal/cyber/data/account-hijack', 'سرقوا حسابي الواتساب', 'أخذوا حسابي في الواتساب وصاروا يطلبون فلوس من أهلي باسمي.'),
  B('h-r4', 'criminal', 'criminal/property-crimes/theft/robbery', 'خطف شنطتي', 'واحد خطف شنطتي في السوق وهو على دباب، وفيها جوالي وفلوسي.'),
  B('h-r5', 'criminal', 'criminal/criminal-procedure/arrest/detention-pretrial', 'موقوف من شهر', 'ولد خالي موقوف من شهر في قضية مضاربة وما عرضوه على القاضي.'),
  B('h-r6', 'criminal', 'criminal/cyber/online/online-defamation', 'تغريدة تتهمني', 'واحد كتب عني تغريدة يتهمني فيها بالسرقة وانتشرت.'),
  B('h-r7', 'criminal', 'criminal/public-order/corruption/bribery', 'موظف طلب رشوة', 'موظف في جهة حكومية طلب مني فلوس عشان يمشي معاملتي.'),
  B('h-r8', 'criminal', 'criminal/criminal-procedure/investigation/reconciliation', 'التنازل في قضية مضاربة', 'صارت مضاربة بين ولدي وولد الجيران، والحين أهله يبون يتنازلون، وش الإجراء؟'),
];

// ---------------------------------------------------------------------------
// المتغيرات العشر لكل قصة
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261017);
const pick = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)];
const digits = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 10)).join('');
const toArabicIndic = (value: string) => value.replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);

const AMOUNTS = ['5 آلاف ريال', '15 ألف', '38,000 ريال', 'مية وعشرين ألف', '2500 ريال', '70 ألف ريال', 'ثلاث مية ألف', '9800 ريال'];
const CITIES = ['الرياض', 'جدة', 'الدمام', 'مكة', 'المدينة', 'أبها', 'تبوك', 'حائل', 'بريدة', 'الخبر', 'الطائف', 'جازان', 'نجران'];
const AGOS = ['قبل سنة', 'قبل ست شهور', 'من ثلاث سنين', 'الشهر اللي فات', 'من 2023', 'قبل سنتين'];

const VARIANTS = ['plain', 'pii-latin', 'pii-arabic', 'emotional', 'short', 'drafting', 'wrong-court', 'english-mix', 'typos', 'attachment-date'] as const;
type Variant = typeof VARIANTS[number];

type Pii = { kind: 'national-id' | 'phone' | 'iban' | 'email'; format: 'latin' | 'arabic-indic' | 'spaced' | 'intl'; value: string };

function fillSlots(story: string): string {
  return story.replace('{amount}', pick(AMOUNTS)).replace('{city}', pick(CITIES)).replace('{ago}', pick(AGOS));
}

function typoNoise(value: string): string {
  return value
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة(?=[\s،.؟!]|$)/g, 'ه')
    .replace(/ى(?=[\s،.؟!]|$)/g, 'ي')
    .replace(/اللي/g, 'الي')
    .replace(/(^|\s)ما\s+/g, '$1ما')
    .replace(/(^|\s)لا\s+/g, '$1لا');
}

function firstClause(value: string): string {
  const parts = value.split(/[،.؟!]/).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return value;
  return parts[0].length >= 18 || parts.length === 1 ? parts[0] : `${parts[0]}، ${parts[1]}`;
}

function buildCase(base: Base, variant: Variant): { text: string; pii: Pii[] } {
  const story = fillSlots(base.story);
  const pii: Pii[] = [];
  switch (variant) {
    case 'plain':
      return { text: story, pii };
    case 'pii-latin': {
      const id = `${pick(['1', '2'])}${digits(9)}`;
      const phone = `05${digits(8)}`;
      const iban = `SA${digits(22)}`;
      const email = `user${digits(4)}@gmail.com`;
      pii.push({ kind: 'national-id', format: 'latin', value: id }, { kind: 'phone', format: 'latin', value: phone }, { kind: 'iban', format: 'latin', value: iban }, { kind: 'email', format: 'latin', value: email });
      return { text: `اسمي محمد ورقم هويتي ${id} وجوالي ${phone} وايبان حسابي ${iban} وايميلي ${email}. ${story}`, pii };
    }
    case 'pii-arabic': {
      const id = toArabicIndic(`${pick(['1', '2'])}${digits(9)}`);
      const phone = toArabicIndic(`05${digits(8)}`);
      const raw = digits(7);
      const spaced = `055 ${raw.slice(0, 3)} ${raw.slice(3)}`;
      const intl = `+9665${digits(8)}`;
      pii.push({ kind: 'national-id', format: 'arabic-indic', value: id }, { kind: 'phone', format: 'arabic-indic', value: phone }, { kind: 'phone', format: 'spaced', value: spaced }, { kind: 'phone', format: 'intl', value: intl });
      return { text: `هويتي ${id} وجوالي ${phone} أو ${spaced} أو ${intl}. ${story}`, pii };
    }
    case 'emotional':
      return { text: `السلام عليكم، والله تعبت ومدري لمين أروح. ${story} الله يجزاكم خير ساعدوني`, pii };
    case 'short':
      return { text: firstClause(story), pii };
    case 'drafting':
      return { text: `${story} ${base.appeal ? 'ابي تكتب لي لائحة اعتراض' : 'ابي تكتب لي لائحة دعوى'}`, pii };
    case 'wrong-court':
      return { text: `${story} وقالوا لي ${base.system === 'general' ? 'روح المحكمة التجارية' : 'روح المحكمة العامة'}`, pii };
    case 'english-mix':
      return { text: `${story} وعندي screenshots وكل الإثباتات PDF`, pii };
    case 'typos':
      return { text: typoNoise(story), pii };
    case 'attachment-date':
      return { text: `${story} صار هذا بتاريخ ١٤٤٥/٨/١٢ وعندي صور العقد والتحويلات أرسلها لكم`, pii };
  }
}

// ---------------------------------------------------------------------------
// أدوات القياس
// ---------------------------------------------------------------------------
const SYSTEMS: CourtSystemId[] = ['commercial', 'general', 'labor', 'personal-status', 'administrative', 'criminal'];

function profileSystem(id: string): CourtSystemId | 'unknown' {
  if (id === 'supreme' || id === 'unknown') return 'unknown';
  const found = SYSTEMS.find((system) => id.startsWith(system));
  return found || 'unknown';
}

function strategySystem(id: string): CourtSystemId | 'unknown' {
  if (['military-personnel-rights', 'administrative-annulment', 'administrative-compensation', 'administrative-contract', 'disciplinary'].includes(id)) return 'administrative';
  if (id === 'general-money-claim' || id === 'general-contract') return 'general';
  if (id === 'commercial-dispute') return 'commercial';
  if (id === 'labor-dispute') return 'labor';
  if (id === 'personal-status-family') return 'personal-status';
  if (id === 'criminal-defense') return 'criminal';
  return 'unknown';
}

function acceptable(base: Base, system: string | null | undefined): boolean {
  return system === base.system || Boolean(system && base.alt?.includes(system as CourtSystemId));
}

function pct(part: number, whole: number): string {
  return whole ? `${((part / whole) * 100).toFixed(1)}%` : '—';
}

function articleNumbersIn(text: string): number[] {
  return Array.from(text.matchAll(/الماد[ةه]\s*\(?\s*(\d{1,3})/g)).map((m) => Number(m[1]));
}

// ---------------------------------------------------------------------------
// التشغيل
// ---------------------------------------------------------------------------
type CaseResult = {
  id: string; base: string; variant: Variant; expected: CourtSystemId;
  court: { systemId: string | null; confidence: string; correct: boolean; confidentWrong: boolean; none: boolean; followedWrongMention?: boolean };
  profile: string; strategy: string; strategyCorrect: boolean;
  sources: { packets: string[]; foreign: string[]; bogOnNonAdmin: boolean; personnelOnNonMilitary: boolean; scopedForeign: string[] };
  route: { task: string; blocking: boolean; allowDrafting: boolean };
  drafting?: { intentDetected: boolean };
  pii?: Array<Pii & { leaked: boolean }>;
  ms: number; error?: string;
};

const results: CaseResult[] = [];
const guard = { cases: 0, latin: 0, arabicIndic: 0, words: 0, crossLaw: 0, crossLawTried: 0, prefix: 0, prefixTried: 0, legitBlocked: 0, legitTried: 0 };

for (const base of BASES) {
  for (const variant of VARIANTS) {
    const started = performance.now();
    const { text, pii } = buildCase(base, variant);
    const id = `${base.id}-${variant}`;
    try {
      // نفس ترتيب api/chat.ts: حجب المعرّفات، ثم تمييز الجهة وتقييد وكلاء المصادر بها متى حُسمت، ثم مسار مكتب المحاماة.
      const redacted = redactDirectIdentifiers(text).text;
      const chatQuery = ['الاستشارة القضائية العامة', redacted].join('\n');
      const resolution = resolveCourtSystem('الاستشارة القضائية العامة', redacted);
      const bundle = runLegalSourceAgents(chatQuery, resolution.systemId ? { courtSystem: resolution.systemId } : {});
      const route = analyzeLawOfficeRoute(chatQuery, false);
      const identification = identifyCourt(redacted);
      const profile = detectCourtProfile(redacted).id;
      const strategy = detectCaseStrategyProfile(redacted).id;
      const scoped = runLegalSourceAgents(redacted, { courtSystem: base.system });

      const referenceNames = (b: typeof bundle) => b.packets.flatMap((packet) => packet.references.map((reference) => reference.name));
      const foreign = Array.from(new Set(referenceNames(bundle).filter((name) => isSourceForeignToCourt(name, base.system))));
      const scopedForeign = Array.from(new Set(referenceNames(scoped).filter((name) => isSourceForeignToCourt(name, base.system))));
      const packetIds = bundle.packets.map((packet) => packet.agentId);

      const systemId = identification.systemId;
      const correct = acceptable(base, systemId);
      const confident = isConfidentIdentification(identification);
      const result: CaseResult = {
        id, base: base.id, variant, expected: base.system,
        court: {
          systemId, confidence: identification.confidence, correct,
          confidentWrong: Boolean(systemId) && !correct && confident,
          none: !systemId,
          ...(variant === 'wrong-court' ? { followedWrongMention: systemId === (base.system === 'general' ? 'commercial' : 'general') && !correct } : {}),
        },
        profile, strategy, strategyCorrect: acceptable(base, strategySystem(strategy)),
        sources: {
          packets: packetIds, foreign, scopedForeign,
          bogOnNonAdmin: base.system !== 'administrative' && packetIds.includes('src-bog'),
          personnelOnNonMilitary: !base.military && packetIds.includes('src-personnel'),
        },
        route: { task: route.task, blocking: route.blocking, allowDrafting: route.allowDrafting },
        ms: 0,
      };

      if (variant === 'drafting') {
        result.drafting = { intentDetected: shouldActivateDrafting([{ role: 'user', content: text }]) };
      }
      if (pii.length) {
        result.pii = pii.map((item) => {
          const digitsOnly = (value: string) => value.replace(/[^0-9٠-٩]/g, '');
          const leaked = item.kind === 'email' ? redacted.includes(item.value) : digitsOnly(redacted).includes(digitsOnly(item.value));
          return { ...item, leaked };
        });
      }

      // حارس الاستشهادات: ردود مصطنعة فيها استشهاد مختلق بصيغ مختلفة، على حزمة المصادر الفعلية للقضية.
      guard.cases += 1;
      const context = bundle.context;
      const numbers = new Set(articleNumbersIn(context));
      let fake = 913;
      while (numbers.has(fake)) fake += 1;
      const reply = (citation: string) => `خلاصة الرأي: يحق لك المطالبة ${citation} وننصح بجمع المستندات.`;
      if (guardIntroducedLegalCitations(text, reply(`وفق المادة ${fake} من نظام العمل`), context).blocked) guard.latin += 1;
      if (guardIntroducedLegalCitations(text, reply(`وفق المادة ${toArabicIndic(String(fake))} من نظام العمل`), context).blocked) guard.arabicIndic += 1;
      if (guardIntroducedLegalCitations(text, reply('وفق المادة الحادية والتسعين بعد التسعمئة من نظام العمل'), context).blocked) guard.words += 1;
      const real = [...numbers].find((n) => n >= 10);
      if (real !== undefined) {
        guard.crossLawTried += 1;
        if (guardIntroducedLegalCitations(text, reply(`وفق المادة ${real} من نظام الأحوال الشخصية`), context).blocked) guard.crossLaw += 1;
        const prefix = Number(String(real).slice(0, -1));
        if (prefix > 0 && !numbers.has(prefix)) {
          guard.prefixTried += 1;
          if (guardIntroducedLegalCitations(text, reply(`وفق المادة ${prefix} من نظام المرافعات`), context).blocked) guard.prefix += 1;
        }
        guard.legitTried += 1;
        if (guardIntroducedLegalCitations(text, reply(`وفق المادة ${real}`), context).blocked) guard.legitBlocked += 1;
      }

      // المدد ونوع القضية: يجب ألا ينهار أي منهما لأي جهة. الجزائي بلا مدد ابتدائية بطبيعته، فيكفي وجودها في درجة ما.
      if (!(['first', 'appeal', 'supreme'] as const).some((level) => buildDeadlinesInstruction(base.system, level, false))) throw new Error('no deadlines at any level');
      if (!withCaseType('P', base.leaf.split('/')).includes(SYSTEM_LABELS[findNode(base.leaf.split('/'))!.system])) throw new Error('withCaseType lost the court label');

      result.ms = performance.now() - started;
      results.push(result);
    } catch (error) {
      results.push({
        id, base: base.id, variant, expected: base.system,
        court: { systemId: null, confidence: 'low', correct: false, confidentWrong: false, none: true },
        profile: 'error', strategy: 'error', strategyCorrect: false,
        sources: { packets: [], foreign: [], scopedForeign: [], bogOnNonAdmin: false, personnelOnNonMilitary: false },
        route: { task: 'error', blocking: false, allowDrafting: false },
        ms: performance.now() - started,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// الفهرس: هل يجد المتضرر نوع قضيته من كلماته؟ (100 عبارة + نفس العبارات بأخطاء إملائية)
// ---------------------------------------------------------------------------
const catalog = { queries: 0, top1Leaf: 0, top5Leaf: 0, top5Category: 0, top1System: 0, empty: 0, misses: [] as string[] };
for (const base of BASES) {
  for (const query of [base.query, typoNoise(base.query)]) {
    catalog.queries += 1;
    const hits = searchTaxonomy(query, 10);
    const leaves = hits.filter((hit) => hit.node.level === 4);
    if (!hits.length) { catalog.empty += 1; catalog.misses.push(`${base.id}: «${query}» → لا نتائج`); continue; }
    const leafPaths = leaves.map((hit) => hit.node.path.join('/'));
    const category = base.leaf.split('/').slice(0, 3).join('/');
    if (leafPaths[0] === base.leaf) catalog.top1Leaf += 1;
    if (leafPaths.slice(0, 5).includes(base.leaf)) catalog.top5Leaf += 1;
    else catalog.misses.push(`${base.id}: «${query}» → ${leaves[0]?.node.label || hits[0].node.label}`);
    if (hits.slice(0, 5).some((hit) => hit.node.path.join('/').startsWith(category))) catalog.top5Category += 1;
    if (acceptable(base, hits[0].node.system)) catalog.top1System += 1;
  }
}

// ---------------------------------------------------------------------------
// المجموعة المستقلة (لم يُضبط عليها شيء)
// ---------------------------------------------------------------------------
const holdout = { stories: HOLDOUT.length, courtCorrect: 0, courtNone: 0, courtConfidentWrong: 0, catalogTop1: 0, catalogTop5: 0, catalogEmpty: 0, misses: [] as string[] };
for (const item of HOLDOUT) {
  const identification = identifyCourt(redactDirectIdentifiers(item.story).text);
  const correct = acceptable(item, identification.systemId);
  if (correct) holdout.courtCorrect += 1;
  else if (!identification.systemId) holdout.courtNone += 1;
  else {
    if (isConfidentIdentification(identification)) holdout.courtConfidentWrong += 1;
    holdout.misses.push(`${item.id}: المحكمة ${item.system} ← ${identification.systemId} (${identification.confidence})`);
  }
  const leaves = searchTaxonomy(item.query, 10).filter((hit) => hit.node.level === 4).map((hit) => hit.node.path.join('/'));
  if (!leaves.length) holdout.catalogEmpty += 1;
  if (leaves[0] === item.leaf) holdout.catalogTop1 += 1;
  if (leaves.slice(0, 5).includes(item.leaf)) holdout.catalogTop5 += 1;
  else holdout.misses.push(`${item.id}: البحث «${item.query}» ← ${leaves[0] ? findNode(leaves[0].split('/'))!.label : 'لا نتائج'}`);
}

// ---------------------------------------------------------------------------
// الملخص
// ---------------------------------------------------------------------------
const ok = results.filter((r) => !r.error);
const errors = results.filter((r) => r.error);
const byVariant = Object.fromEntries(VARIANTS.map((v) => {
  const rows = ok.filter((r) => r.variant === v);
  return [v, `${pct(rows.filter((r) => r.court.correct).length, rows.length)} صحيح، ${pct(rows.filter((r) => r.court.none).length, rows.length)} بلا جهة`];
}));
const bySystem = Object.fromEntries(SYSTEMS.map((s) => {
  const rows = ok.filter((r) => r.expected === s);
  return [s, `${pct(rows.filter((r) => r.court.correct).length, rows.length)} (${rows.length} قضية)`];
}));
const confusion: Record<string, Record<string, number>> = {};
for (const r of ok) {
  const row = (confusion[r.expected] ||= {});
  const key = r.court.systemId || 'لا جهة';
  row[key] = (row[key] || 0) + 1;
}
const piiRows = ok.flatMap((r) => r.pii || []);
const piiSummary: Record<string, string> = {};
for (const kind of ['national-id', 'phone', 'iban', 'email'] as const) {
  for (const format of ['latin', 'arabic-indic', 'spaced', 'intl'] as const) {
    const rows = piiRows.filter((p) => p.kind === kind && p.format === format);
    if (rows.length) piiSummary[`${kind}/${format}`] = `${pct(rows.filter((p) => p.leaked).length, rows.length)} تسرّب (${rows.length})`;
  }
}
const drafting = ok.filter((r) => r.variant === 'drafting');
const appealPlain = ok.filter((r) => BASES.find((b) => b.id === r.base)?.appeal && r.variant === 'plain');
const wrongCourt = ok.filter((r) => r.variant === 'wrong-court');
const times = ok.map((r) => r.ms).sort((a, b) => a - b);
const wrongExamples = ok.filter((r) => r.court.confidentWrong).slice(0, 12).map((r) => `${r.id}: المتوقع ${r.expected} ← ${r.court.systemId} (${r.court.confidence})`);
const noneExamples = ok.filter((r) => r.court.none && r.variant === 'plain').map((r) => r.base);

const summary = {
  cases: results.length,
  errors: errors.length,
  court: {
    accuracy: pct(ok.filter((r) => r.court.correct).length, ok.length),
    noSystem: pct(ok.filter((r) => r.court.none).length, ok.length),
    confidentWrong: pct(ok.filter((r) => r.court.confidentWrong).length, ok.length),
    confidentWrongExcludingWrongCourtMentions: pct(ok.filter((r) => r.court.confidentWrong && r.variant !== 'wrong-court').length, ok.filter((r) => r.variant !== 'wrong-court').length),
    bySystem, byVariant, confusion,
    wrongCourtFollowed: pct(wrongCourt.filter((r) => r.court.followedWrongMention).length, wrongCourt.length),
    plainStoriesWithNoSystem: noneExamples,
    confidentWrongExamples: wrongExamples,
  },
  agentsAgreement: {
    courtProfileUnknown: pct(ok.filter((r) => profileSystem(r.profile) === 'unknown').length, ok.length),
    courtProfileMatches: pct(ok.filter((r) => acceptable(BASES.find((b) => b.id === r.base)!, profileSystem(r.profile))).length, ok.length),
    strategyMatches: pct(ok.filter((r) => r.strategyCorrect).length, ok.length),
    strategyUnknown: pct(ok.filter((r) => r.strategy === 'unknown').length, ok.length),
  },
  sources: {
    chatPathForeignLeak: pct(ok.filter((r) => r.sources.foreign.length).length, ok.length),
    scopedPathForeignLeak: pct(ok.filter((r) => r.sources.scopedForeign.length).length, ok.length),
    bogOnNonAdmin: pct(ok.filter((r) => r.sources.bogOnNonAdmin).length, ok.filter((r) => r.expected !== 'administrative').length),
    personnelOnNonMilitary: pct(ok.filter((r) => r.sources.personnelOnNonMilitary).length, ok.filter((r) => !BASES.find((b) => b.id === r.base)?.military).length),
    foreignExamples: Array.from(new Set(ok.flatMap((r) => r.sources.foreign.map((name) => `${r.expected}: ${name}`)))).slice(0, 10),
    militaryPersonnelRecall: pct(ok.filter((r) => BASES.find((b) => b.id === r.base)?.military && r.sources.packets.includes('src-personnel')).length, ok.filter((r) => BASES.find((b) => b.id === r.base)?.military).length),
    adminBogRecall: pct(ok.filter((r) => r.expected === 'administrative' && r.sources.packets.includes('src-bog')).length, ok.filter((r) => r.expected === 'administrative').length),
  },
  drafting: {
    draftingIntentDetected: pct(drafting.filter((r) => r.drafting?.intentDetected).length, drafting.length),
    appealWithoutJudgmentBlocked: pct(appealPlain.filter((r) => r.route.blocking).length, appealPlain.length),
  },
  privacy: piiSummary,
  citationGuard: {
    fabricatedLatinCaught: pct(guard.latin, guard.cases),
    fabricatedArabicIndicCaught: pct(guard.arabicIndic, guard.cases),
    fabricatedWordsCaught: pct(guard.words, guard.cases),
    crossLawCaught: pct(guard.crossLaw, guard.crossLawTried),
    prefixCollisionCaught: pct(guard.prefix, guard.prefixTried),
    legitimateWronglyBlocked: pct(guard.legitBlocked, guard.legitTried),
  },
  catalog: {
    queries: catalog.queries,
    top1Leaf: pct(catalog.top1Leaf, catalog.queries),
    top5Leaf: pct(catalog.top5Leaf, catalog.queries),
    top5Category: pct(catalog.top5Category, catalog.queries),
    top1System: pct(catalog.top1System, catalog.queries),
    empty: pct(catalog.empty, catalog.queries),
    misses: catalog.misses.slice(0, 40),
  },
  holdout: {
    stories: holdout.stories,
    courtAccuracy: pct(holdout.courtCorrect, holdout.stories),
    courtNone: pct(holdout.courtNone, holdout.stories),
    courtConfidentWrong: pct(holdout.courtConfidentWrong, holdout.stories),
    catalogTop1Leaf: pct(holdout.catalogTop1, holdout.stories),
    catalogTop5Leaf: pct(holdout.catalogTop5, holdout.stories),
    catalogEmpty: pct(holdout.catalogEmpty, holdout.stories),
    misses: holdout.misses,
  },
  performance: {
    medianMs: Number((times[Math.floor(times.length / 2)] || 0).toFixed(2)),
    p95Ms: Number((times[Math.floor(times.length * 0.95)] || 0).toFixed(2)),
    maxMs: Number((times[times.length - 1] || 0).toFixed(2)),
  },
  errorSamples: errors.slice(0, 5).map((r) => `${r.id}: ${r.error}`),
};

console.log(JSON.stringify(summary, null, 2));

// --strict: ضمانات أمان لا يجوز أن تنكسر (لا نسب دقة؛ تلك تتغير مع تطور المؤشرات وتُقرأ من الملخص).
if (process.argv.includes('--strict')) {
  const failures: string[] = [];
  const rate = (part: number, whole: number) => (whole ? part / whole : 0);
  const nonHearsay = ok.filter((r) => r.variant !== 'wrong-court');
  const confidentCases = ok.filter((r) => r.court.systemId && (r.court.confidence === 'high' || r.court.confidence === 'medium'));
  if (errors.length) failures.push(`${errors.length} cases crashed`);
  if (piiRows.some((p) => p.leaked)) failures.push(`${piiRows.filter((p) => p.leaked).length} identifiers leaked past redaction`);
  if (guard.latin !== guard.cases || guard.arabicIndic !== guard.cases || guard.words !== guard.cases) failures.push('a fabricated citation format was not flagged');
  if (guard.legitBlocked) failures.push(`${guard.legitBlocked} legitimate citations were flagged`);
  if (appealPlain.some((r) => !r.route.blocking)) failures.push('an appeal without the judgment was not blocked');
  if (rate(nonHearsay.filter((r) => r.court.confidentWrong).length, nonHearsay.length) > 0.01) failures.push('confident wrong court above 1% (excluding hearsay mentions)');
  if (rate(holdout.courtConfidentWrong, holdout.stories) > 0.05) failures.push('confident wrong court above 5% on the holdout set');
  if (confidentCases.some((r) => r.sources.foreign.length)) failures.push('foreign-court sources reached a case whose court was resolved');
  if (rate(catalog.empty, catalog.queries) > 0.05) failures.push('catalog search returned nothing for more than 5% of everyday queries');
  if (rate(holdout.catalogEmpty, holdout.stories) > 0.2) failures.push('catalog search returned nothing for more than 20% of holdout queries');
  if (failures.length) {
    console.error(`\nSTRICT FAILED:\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }
  console.log('\nSTRICT OK');
}

const outIndex = process.argv.indexOf('--out');
if (outIndex > 0 && process.argv[outIndex + 1]) {
  fs.writeFileSync(process.argv[outIndex + 1], JSON.stringify({ summary, results }, null, 2), 'utf8');
}
