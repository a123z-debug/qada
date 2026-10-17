// فهرس القضايا الهرمي لمنصة QADA.
// أربعة مستويات ثابتة: قطاع ← فرع ← تصنيف ← نوع القضية (ورقة).
// كل عقدة تحمل مساحة العمل التي تُفتح لها (workspace) ونظام المحكمة الدقيق (system) الذي يفهمه محرك المحاكم.
// هذا الملف تصنيف تنظيمي للوصول السريع فقط، وليس مصدراً نظامياً: لا يحتوي مواد ولا استشهادات.

import type { CourtSystemId } from '../lib/judicialSystem';

/** مساحات العمل الموجودة فعلاً في المنصة (مطابقة لـ CourtJurisdiction في الشريط الجانبي). */
export type TaxonomyWorkspace = 'commercial' | 'general' | 'administrative' | 'criminal';

export const TAXONOMY_LEVEL_NAMES = ['قطاع', 'فرع', 'تصنيف', 'نوع القضية'] as const;

export interface TaxonomyNode {
  /** مفتاح ثابت بالإنجليزية يُستخدم في الرابط، فريد بين الإخوة. */
  key: string;
  label: string;
  /** 1 = قطاع، 4 = ورقة. */
  level: 1 | 2 | 3 | 4;
  /** مساحة العمل التي تفتحها أدوات الصياغة لهذا النوع. */
  workspace: TaxonomyWorkspace;
  /** الجهة القضائية المرجّحة (قد تكون أدق من مساحة العمل، مثل العمالية أو الأحوال الشخصية). */
  system: CourtSystemId;
  /** تنبيه اختصاص موروث من أقرب أب، حين قد تختص بالنوع لجنة لا محكمة. */
  note?: string;
  /** مسار المفاتيح من القطاع حتى هذه العقدة. */
  path: string[];
  /** مرادفات وصياغات عامية تُستخدم في البحث فقط. */
  keywords: string[];
  description?: string;
  children: TaxonomyNode[];
}

export interface CourtAction {
  id: string;
  label: string;
  hint: string;
}

/** الإجراءات المتاحة لكل مساحة عمل — مطابقة لخدمات الشريط الجانبي ومساحات العمل. */
export const WORKSPACE_ACTIONS: Record<TaxonomyWorkspace, CourtAction[]> = {
  commercial: [
    { id: 'commercial_claim', label: 'لائحة دعوى تجارية', hint: 'صياغة دعوى مربوطة بالعقد والفواتير والمراسلات' },
    { id: 'commercial_appeal', label: 'اعتراض تجاري', hint: 'أسباب الاعتراض على الحكم التجاري' },
    { id: 'commercial_memo', label: 'مذكرة جوابية تجارية', hint: 'الرد على الدعوى التجارية' },
    { id: 'commercial_attachments', label: 'فحص العقود والفواتير', hint: 'ما تثبته العقود والفواتير والدفاتر فعلاً' },
  ],
  general: [
    { id: 'general_claim', label: 'لائحة دعوى', hint: 'صياغة مطالبة أو دعوى' },
    { id: 'general_appeal', label: 'اعتراض واستئناف', hint: 'أوجه الاعتراض على الحكم' },
    { id: 'general_memo', label: 'مذكرة جوابية', hint: 'الرد على الطرف الآخر' },
    { id: 'general_attachments', label: 'فحص السندات والعقود', hint: 'مراجعة العقود والسندات والبينات' },
  ],
  administrative: [
    { id: 'administrative_claim', label: 'لائحة دعوى', hint: 'صياغة دعوى أمام ديوان المظالم' },
    { id: 'administrative_appeal', label: 'اعتراض واستئناف', hint: 'مراجعة أسباب الحكم الإداري' },
    { id: 'administrative_memo', label: 'مذكرة دفوع', hint: 'الرد على دفاع الجهة الإدارية' },
    { id: 'administrative_attachments', label: 'فحص المرفقات والقرارات', hint: 'مراجعة القرار والمستندات' },
  ],
  criminal: [
    { id: 'criminal_defense', label: 'مذكرة دفاع', hint: 'تنظيم الوقائع والدفوع' },
    { id: 'criminal_appeal', label: 'اعتراض جزائي', hint: 'فحص أسباب الاعتراض' },
    { id: 'criminal_procedural', label: 'فحص سلامة الإجراءات', hint: 'مراجعة القبض والتفتيش والتوقيف' },
    { id: 'criminal_evidence', label: 'تدقيق محضر الضبط', hint: 'مقارنة المحضر ببقية الأدلة' },
  ],
};

/** أسماء الجهات كما في COURT_SYSTEMS (يتحقق الاختبار من تطابقها) — منسوخة هنا حتى لا يُحمَّل محرك المحاكم مع الفهرس. */
export const SYSTEM_LABELS: Record<CourtSystemId, string> = {
  commercial: 'المحاكم التجارية',
  general: 'المحاكم العامة',
  labor: 'المحاكم العمالية',
  'personal-status': 'محاكم الأحوال الشخصية',
  administrative: 'ديوان المظالم والمحاكم الإدارية',
  criminal: 'المحاكم الجزائية',
};

/**
 * تنبيهات الاختصاص: أنواع قد تختص بها لجنة أو جهة غير المحكمة، أو تمر بمسار إلزامي قبلها.
 * مفتاحها مسار العقدة، وتورَّث لكل ما تحتها. الصياغة احترازية عمداً لأن الاختصاص يتغير بتغير الوقائع والأنظمة.
 */
const JURISDICTION_NOTES: Record<string, string> = {
  'civil/debts/banking': 'قد تختص بهذه المنازعات لجان المنازعات المصرفية والتمويلية لا المحكمة. تحقّق من جهة الاختصاص قبل رفع الدعوى.',
  'civil/insurance/insurance-claims': 'قد تختص بهذه المنازعات لجان الفصل في المنازعات والمخالفات التأمينية لا المحكمة. تحقّق من جهة الاختصاص قبل رفع الدعوى.',
  'civil/insurance/medical-liability': 'قد تختص بدعاوى الأخطاء الطبية الهيئة الصحية الشرعية لا المحكمة. تحقّق من جهة الاختصاص قبل رفع الدعوى.',
  'commercial/intellectual/ecommerce/consumer-complaint': 'بعض شكاوى المستهلك تُقدَّم أولاً إلى الجهة الرقابية المختصة قبل أي دعوى.',
  'labor/injuries/safety/work-injury': 'تعويض إصابة العمل قد يمر عبر نظام التأمينات الاجتماعية (الأخطار المهنية). تحقّق من المسار قبل المطالبة.',
  'labor/injuries/labor-office': 'المنازعة العمالية تمر عادةً بالتسوية الودية قبل قيدها أمام المحكمة العمالية.',
  'admin/admin-contracts/regulatory/customs-tax': 'المنازعات الضريبية والجمركية تمر عادةً بلجان مختصة قبل القضاء الإداري. تحقّق من المسار والمدد.',
};

// ---------------------------------------------------------------------------
// المصدر المختصر: ['مفتاح', 'العنوان', 'مرادفات اختيارية' | [أبناء]]
// ---------------------------------------------------------------------------
type Leaf = [string, string] | [string, string, string];
type Cat = [string, string, Leaf[]];
type Branch = [string, string, Cat[]];
type Sector = { key: string; label: string; workspace: TaxonomyWorkspace; system: CourtSystemId; description: string; keywords?: string; branches: Branch[] };

const SECTORS: Sector[] = [
  {
    key: 'civil', label: 'المعاملات المدنية والحقوق', workspace: 'general', system: 'general',
    description: 'العقود المدنية والالتزامات والمسؤولية والديون والمطالبات المالية بين الأفراد.',
    keywords: 'حقوق مدنية مطالبة',
    branches: [
      ['contracts', 'العقود المدنية', [
        ['sale', 'البيع', [
          ['movable', 'بيع المنقولات', 'سيارة جوال أجهزة'],
          ['installment', 'البيع بالتقسيط', 'أقساط'],
          ['defects', 'عيوب المبيع', 'عيب خفي ضمان'],
          ['delivery', 'التسليم والتأخر فيه', 'تأخير تسليم'],
          ['rescission', 'الفسخ والخيار', 'استرجاع المبلغ رد'],
        ]],
        ['lease', 'الإيجار والإعارة', [
          ['movable-lease', 'إيجار المنقولات والمعدات', 'تأجير معدات سيارات'],
          ['lease-termination', 'إنهاء الإيجار وتجديده', 'فسخ إيجار'],
          ['leased-damage', 'تلف العين المؤجرة', 'أضرار'],
          ['lease-arrears', 'أجرة متأخرة', 'تأخر سداد الإيجار'],
        ]],
        ['agency', 'الوكالة والوساطة والخدمات', [
          ['agency-contract', 'عقد الوكالة', 'وكيل موكل'],
          ['brokerage', 'السمسرة والوساطة', 'عمولة سمسار'],
          ['service-contract', 'عقود الخدمات', 'مقدم خدمة'],
          ['consulting', 'عقود الاستشارات', 'مستشار أتعاب'],
          ['agency-abuse', 'تجاوز الوكيل حدود الوكالة', 'وكالة تجاوز'],
        ]],
        ['loan-guarantee', 'القرض والكفالة والرهن', [
          ['loan', 'القرض بين الأفراد', 'سلفة دين شخصي'],
          ['suretyship', 'الكفالة', 'كفيل ضامن'],
          ['pledge', 'الرهن', 'رهن حيازي'],
          ['assignment', 'حوالة الحق والدين', 'حوالة'],
        ]],
      ]],
      ['obligations', 'الالتزامات والمسؤولية', [
        ['breach', 'الإخلال بالعقد', [
          ['specific-performance', 'طلب التنفيذ العيني', 'إلزام بالتنفيذ'],
          ['breach-damages', 'التعويض عن الإخلال', 'تعويض إخلال'],
          ['penalty-clause', 'الشرط الجزائي', 'غرامة تأخير'],
          ['force-majeure', 'القوة القاهرة والظروف الطارئة', 'ظرف طارئ كورونا'],
          ['contract-nullity', 'بطلان العقد', 'عقد باطل'],
        ]],
        ['tort', 'المسؤولية عن الفعل الضار', [
          ['bodily-harm-civil', 'التعويض عن الضرر الجسدي', 'إصابة'],
          ['property-harm', 'التعويض عن الضرر المادي', 'إتلاف'],
          ['moral-harm', 'التعويض عن الضرر المعنوي', 'سمعة'],
          ['third-party-liability', 'المسؤولية عن فعل الغير', 'تابع متبوع'],
          ['traffic-civil', 'التعويض عن حوادث السير', 'حادث مروري'],
        ]],
        ['unjust', 'الإثراء بلا سبب والفضالة', [
          ['restitution', 'استرداد ما دُفع بغير حق', 'رد مبلغ دفع خطأ'],
          ['negotiorum', 'الفضالة', 'تصرف نيابة عن الغير'],
          ['unjust-enrichment', 'الإثراء بلا سبب', 'إثراء'],
        ]],
      ]],
      ['debts', 'الديون والمطالبات المالية', [
        ['instruments', 'السندات والأوراق', [
          ['promissory-note', 'سند لأمر', 'سند'],
          ['cheque-civil', 'الشيك', 'شيك مرتجع بدون رصيد'],
          ['acknowledgment', 'إقرار الدين', 'إقرار مديونية'],
          ['bill-exchange', 'الكمبيالة', 'سفتجة'],
        ]],
        ['claims', 'المطالبات', [
          ['debt-claim', 'المطالبة بدين', 'سلفة مال لم يرد'],
          ['fees-claim', 'المطالبة بأتعاب أو أجر خدمة', 'أتعاب'],
          ['refund-claim', 'المطالبة برد مبلغ', 'استرداد'],
          ['partner-claim', 'المطالبة بين الشركاء والأقارب', 'مال بين أقارب'],
          ['interest-dispute', 'نزاع على فوائد أو غرامات', 'فائدة'],
        ]],
        ['banking', 'النزاعات المصرفية والتمويل', [
          ['bank-fraud-claim', 'مطالبة بسبب عملية احتيال مصرفية', 'تحويل احتيال'],
          ['finance-contract', 'عقد تمويل أو قرض بنكي', 'قرض بنك تمويل شخصي'],
          ['card-dispute', 'نزاع بطاقة ائتمانية', 'فيزا مدى'],
          ['bank-guarantee', 'ضمان بنكي', 'خطاب ضمان'],
        ]],
      ]],
      ['insurance', 'التأمين والتعويضات', [
        ['insurance-claims', 'مطالبات التأمين', [
          ['vehicle-insurance', 'تأمين المركبات', 'تأمين سيارة تحمل'],
          ['medical-insurance', 'التأمين الطبي', 'تأمين صحي رفض تغطية'],
          ['property-insurance', 'تأمين الممتلكات', 'حريق'],
          ['life-insurance', 'التأمين على الحياة', 'مستفيد'],
        ]],
        ['medical-liability', 'المسؤولية الطبية المدنية', [
          ['medical-error', 'الخطأ الطبي', 'خطأ طبيب'],
          ['hospital-liability', 'مسؤولية المنشأة الصحية', 'مستشفى'],
          ['consent-dispute', 'نزاع الموافقة على العلاج', 'إقرار'],
        ]],
      ]],
    ],
  },
  {
    key: 'commercial', label: 'التجارة والشركات والإفلاس', workspace: 'commercial', system: 'commercial',
    description: 'الشركات والشراكات والأوراق التجارية والوكالات والإفلاس والمنافسة والملكية التجارية.',
    keywords: 'تجاري محكمة تجارية',
    branches: [
      ['companies', 'الشركات', [
        ['formation', 'التأسيس والحصص', [
          ['founders-dispute', 'نزاع المؤسسين', 'تأسيس شركة'],
          ['capital-shares', 'رأس المال والحصص', 'حصة شريك'],
          ['partnership-agreement', 'عقد الشراكة أو نظام الشركة', 'عقد تأسيس'],
          ['share-transfer', 'التنازل عن الحصص أو الأسهم', 'بيع حصة'],
        ]],
        ['governance', 'الإدارة والحوكمة', [
          ['manager-liability', 'مسؤولية المدير أو الشريك المدير', 'مدير شركة'],
          ['removal-manager', 'عزل المدير', 'إقالة'],
          ['general-assembly', 'قرارات الجمعية والشركاء', 'جمعية عمومية بطلان قرار'],
          ['shareholder-rights', 'حقوق الشريك والمساهم', 'أرباح اطلاع'],
        ]],
        ['partner-disputes', 'نزاعات الشركاء', [
          ['profit-dispute', 'توزيع الأرباح', 'أرباح'],
          ['partner-exit', 'خروج الشريك', 'تخارج'],
          ['company-dissolution', 'حل الشركة وتصفيتها', 'تصفية'],
          ['non-compete', 'عدم المنافسة', 'منافسة شريك'],
        ]],
      ]],
      ['commercial-contracts', 'العقود والأعمال التجارية', [
        ['supply', 'التوريد والتوزيع', [
          ['supply-contract', 'عقد التوريد', 'مورد'],
          ['distribution', 'عقد التوزيع والوكالة التجارية', 'موزع حصري'],
          ['franchise', 'الامتياز التجاري', 'فرنشايز'],
          ['payment-delay', 'تأخر سداد قيمة البضاعة', 'مستحقات تاجر'],
        ]],
        ['trade-paper', 'الأوراق التجارية', [
          ['commercial-cheque', 'الشيك التجاري', 'شيك'],
          ['commercial-note', 'السند لأمر التجاري', 'سند'],
          ['paper-recourse', 'الرجوع على الموقعين', 'مظهر'],
        ]],
        ['commerce-misc', 'المعاملات التجارية الأخرى', [
          ['commercial-agency', 'الوكالة التجارية', 'وكيل تجاري'],
          ['commercial-register', 'السجل والاسم التجاري', 'اسم تجاري'],
          ['commercial-books', 'الدفاتر التجارية', 'محاسبة'],
          ['unfair-competition', 'المنافسة غير المشروعة', 'تقليد'],
        ]],
      ]],
      ['bankruptcy', 'الإفلاس والتسويات', [
        ['procedures', 'إجراءات الإفلاس', [
          ['preventive-settlement', 'التسوية الوقائية', 'تسوية مع الدائنين'],
          ['financial-reorg', 'إعادة التنظيم المالي', 'إعادة هيكلة'],
          ['liquidation', 'التصفية', 'تصفية أموال'],
          ['small-liquidation', 'التصفية للمنشآت الصغيرة', 'منشأة صغيرة'],
        ]],
        ['creditors', 'الدائنون والمدين', [
          ['creditor-claims', 'مطالبات الدائنين', 'ديون'],
          ['trustee', 'أمين الإفلاس', 'أمين'],
          ['preferential-transfers', 'التصرفات الضارة بالدائنين', 'تصرف ضار'],
          ['individual-bankruptcy', 'إفلاس الأفراد', 'تعثر شخصي'],
        ]],
      ]],
      ['intellectual', 'الملكية الفكرية والتجارة الإلكترونية', [
        ['trademarks', 'العلامات والأسماء', [
          ['trademark-infringement', 'التعدي على علامة تجارية', 'تقليد علامة'],
          ['trademark-registration', 'نزاع تسجيل العلامة', 'تسجيل'],
          ['trade-name-dispute', 'نزاع الاسم التجاري', 'اسم'],
        ]],
        ['copyright', 'حقوق المؤلف والأسرار التجارية', [
          ['copyright-infringement', 'التعدي على حقوق المؤلف', 'حق مؤلف'],
          ['trade-secrets', 'الأسرار التجارية', 'سر مهني'],
          ['licensing', 'عقود الترخيص', 'ترخيص'],
        ]],
        ['ecommerce', 'التجارة الإلكترونية', [
          ['online-store-dispute', 'نزاع متجر إلكتروني', 'متجر'],
          ['consumer-complaint', 'شكوى مستهلك', 'مستهلك'],
          ['digital-service', 'خدمات رقمية ومنصات', 'منصة'],
        ]],
      ]],
    ],
  },
  {
    key: 'realestate', label: 'العقار والملكية والمقاولات', workspace: 'general', system: 'general',
    description: 'الملكية العقارية والإيجار العقاري والمقاولات والبيع على الخارطة واتحاد الملاك.',
    keywords: 'عقارات أرض بيت شقة',
    branches: [
      ['ownership', 'الملكية العقارية', [
        ['title', 'الملكية والإفراغ', [
          ['transfer-deed', 'الإفراغ ونقل الملكية', 'صك إفراغ'],
          ['ownership-claim', 'دعوى استحقاق ملكية', 'أرض'],
          ['title-defect', 'عيب في الصك أو التسجيل', 'صك'],
          ['sale-promise', 'وعد بالبيع أو عربون', 'عربون'],
        ]],
        ['boundaries', 'الحدود والتعدي', [
          ['boundary-dispute', 'نزاع الحدود', 'جار'],
          ['encroachment', 'التعدي على ملك الغير', 'تعدي'],
          ['easement', 'حقوق الارتفاق والمرور', 'مسيل'],
          ['eviction', 'طلب الإخلاء', 'إخلاء'],
        ]],
        ['co-ownership', 'الشيوع والقسمة', [
          ['partition', 'قسمة العقار المشترك', 'تقسيم'],
          ['preemption', 'الشفعة', 'شفعة'],
          ['co-owner-dispute', 'نزاع الملاك المشتاعين', 'شريك في عقار'],
        ]],
      ]],
      ['real-lease', 'الإيجار العقاري', [
        ['residential', 'الإيجار السكني', [
          ['res-arrears', 'أجرة سكنية متأخرة', 'إيجار شقة'],
          ['res-eviction', 'إخلاء مسكن', 'طرد مستأجر'],
          ['res-deposit', 'التأمين والتجهيزات', 'مبلغ تأمين'],
          ['res-renewal', 'تجديد العقد وزيادة الأجرة', 'رفع الإيجار'],
        ]],
        ['commercial-lease', 'الإيجار التجاري', [
          ['com-arrears', 'أجرة تجارية متأخرة', 'محل'],
          ['com-eviction', 'إخلاء محل أو مكتب', 'مكتب'],
          ['com-renovation', 'التجهيزات والتحسينات', 'ديكور'],
          ['com-sublease', 'التأجير من الباطن', 'من الباطن'],
        ]],
        ['lease-registration', 'التوثيق والعقود الإلكترونية', [
          ['unregistered-lease', 'عقد غير موثق', 'غير موثق'],
          ['e-lease-dispute', 'نزاع عقد إيجار إلكتروني', 'عقد إلكتروني'],
        ]],
      ]],
      ['construction', 'المقاولات والتطوير', [
        ['contracting', 'عقود المقاولة', [
          ['contractor-delay', 'تأخر المقاول', 'تأخير مشروع'],
          ['payment-certificates', 'المستخلصات والدفعات', 'مستخلص'],
          ['variations', 'الأعمال الإضافية والتغييرات', 'أوامر تغيير'],
          ['subcontract', 'مقاول الباطن', 'باطن'],
        ]],
        ['defects', 'العيوب والضمان', [
          ['building-defects', 'عيوب البناء', 'شروخ تسريب'],
          ['structural-safety', 'سلامة المبنى والضمان', 'ضمان'],
          ['design-liability', 'مسؤولية المصمم والمشرف', 'مكتب هندسي'],
        ]],
        ['off-plan', 'البيع على الخارطة', [
          ['off-plan-delay', 'تأخر تسليم الوحدة', 'تأخر مشروع'],
          ['developer-default', 'تعثر المطور', 'مطور'],
          ['escrow', 'حساب الضمان وسداد الدفعات', 'ضمان دفعات'],
          ['unit-mismatch', 'اختلاف الوحدة عن المواصفات', 'مواصفات'],
        ]],
      ]],
      ['owners-assoc', 'اتحاد الملاك والإدارة', [
        ['owners', 'الملكية المشتركة', [
          ['association-fees', 'رسوم اتحاد الملاك', 'رسوم'],
          ['common-areas', 'المرافق والأجزاء المشتركة', 'مصعد'],
          ['association-decisions', 'قرارات الاتحاد', 'قرارات'],
        ]],
        ['property-mgmt', 'إدارة الأملاك', [
          ['mgmt-contract', 'عقد إدارة الأملاك', 'إدارة'],
          ['broker-dispute', 'نزاع الوسيط العقاري', 'وسيط'],
          ['valuation-dispute', 'نزاع التقييم العقاري', 'تقييم'],
        ]],
      ]],
    ],
  },
  {
    key: 'labor', label: 'العمل والعمال', workspace: 'general', system: 'labor',
    description: 'عقود العمل والأجور وإنهاء العلاقة العمالية والتعويضات والعمالة المنزلية.',
    keywords: 'موظف عامل صاحب عمل عمالية',
    branches: [
      ['contract', 'عقد العمل', [
        ['formation', 'إبرام العقد وشروطه', [
          ['contract-terms', 'شروط العقد وتعديلها', 'تعديل راتب'],
          ['probation', 'فترة التجربة', 'تجربة'],
          ['fixed-term', 'العقد محدد المدة', 'انتهاء مدة'],
          ['non-compete-labor', 'شرط عدم المنافسة', 'منع العمل عند منافس'],
        ]],
        ['transfer', 'النقل والانتداب', [
          ['job-transfer', 'نقل الموظف', 'تغيير موقع'],
          ['role-change', 'تغيير المسمى والمهام', 'تخفيض'],
          ['secondment', 'الإعارة والانتداب', 'إعارة'],
        ]],
      ]],
      ['wages', 'الأجور والمستحقات', [
        ['pay', 'الأجور', [
          ['unpaid-wages', 'أجور متأخرة', 'راتب لم يصرف'],
          ['allowances', 'البدلات والعمولات', 'بدل سكن'],
          ['overtime', 'العمل الإضافي', 'ساعات إضافية'],
          ['deductions', 'الخصومات من الأجر', 'خصم'],
        ]],
        ['leave', 'الإجازات والمزايا', [
          ['annual-leave', 'الإجازة السنوية', 'رصيد إجازة'],
          ['sick-leave', 'الإجازة المرضية', 'مرضية'],
          ['bonus', 'المكافآت والحوافز', 'مكافأة'],
        ]],
      ]],
      ['termination', 'إنهاء العلاقة العمالية', [
        ['dismissal', 'الفصل', [
          ['unjust-dismissal', 'الفصل دون مبرر مشروع', 'فصلوني تعسفي'],
          ['disciplinary', 'الفصل التأديبي', 'فصل بسبب مخالفة'],
          ['redundancy', 'إنهاء لأسباب اقتصادية', 'إلغاء وظيفة'],
          ['constructive', 'إجبار العامل على الاستقالة', 'استقالة إجبارية'],
        ]],
        ['end-of-service', 'مكافأة نهاية الخدمة والتعويض', [
          ['eos-reward', 'مكافأة نهاية الخدمة', 'نهاية خدمة'],
          ['notice-compensation', 'تعويض الإشعار', 'مدة الإشعار'],
          ['clearance', 'المخالصة وإبراء الذمة', 'مخالصة'],
        ]],
        ['resignation', 'استقالة العامل', [
          ['resign-dispute', 'نزاع استقالة', 'استقالة'],
          ['abandonment', 'الانقطاع عن العمل', 'غياب'],
        ]],
      ]],
      ['injuries', 'السلامة والإصابات والعمالة الخاصة', [
        ['safety', 'إصابات العمل', [
          ['work-injury', 'إصابة العمل والتعويض', 'إصابة'],
          ['occupational-disease', 'الأمراض المهنية', 'مرض مهني'],
          ['safety-violation', 'مخالفة اشتراطات السلامة', 'سلامة'],
        ]],
        ['special', 'فئات خاصة', [
          ['domestic-worker', 'العمالة المنزلية', 'عاملة منزلية سائق'],
          ['sports-contract', 'العقود الرياضية', 'لاعب'],
          ['women-youth', 'عمل المرأة والأحداث', 'حماية'],
        ]],
        ['labor-office', 'مسار التسوية الودية', [
          ['amicable', 'التسوية الودية قبل الدعوى', 'صلح عمالي'],
          ['labor-complaint', 'شكوى لدى جهة العمل', 'شكوى وزارة'],
        ]],
      ]],
    ],
  },
  {
    key: 'family', label: 'الأحوال الشخصية', workspace: 'general', system: 'personal-status',
    description: 'الزواج والفرقة والحضانة والنفقة والإرث والوصايا والأوقاف والولاية.',
    keywords: 'أسرة أحوال محكمة الأسرة',
    branches: [
      ['marriage', 'الزواج والفرقة', [
        ['marriage-contract', 'عقد الزواج', [
          ['marriage-validity', 'صحة العقد وشروطه', 'عقد نكاح'],
          ['dowry', 'المهر والشروط', 'مهر'],
          ['marriage-proof', 'إثبات الزواج', 'إثبات'],
        ]],
        ['separation', 'الطلاق والخلع والفسخ', [
          ['divorce', 'الطلاق', 'طلاق'],
          ['khul', 'الخلع', 'خلع'],
          ['annulment', 'فسخ النكاح', 'فسخ'],
          ['revocation', 'الرجعة والعدة', 'رجعة'],
        ]],
      ]],
      ['children', 'الأولاد والحضانة', [
        ['custody', 'الحضانة والزيارة', [
          ['custody-claim', 'طلب الحضانة', 'حضانة أطفال'],
          ['visitation', 'الزيارة والاستضافة', 'رؤية الأولاد'],
          ['custody-transfer', 'نقل الحضانة', 'إسقاط حضانة'],
          ['travel-child', 'سفر المحضون', 'منع سفر'],
        ]],
        ['support', 'النفقة', [
          ['child-support', 'نفقة الأولاد', 'نفقة'],
          ['spouse-support', 'نفقة الزوجة', 'نفقة زوجة'],
          ['relatives-support', 'نفقة الأقارب والوالدين', 'نفقة أب'],
          ['support-arrears', 'نفقة متأخرة', 'متجمد'],
          ['housing', 'السكن والأجرة', 'مسكن حاضنة'],
        ]],
        ['paternity', 'النسب والولاية', [
          ['paternity-proof', 'إثبات النسب', 'نسب'],
          ['guardianship', 'الولاية على القاصر', 'ولي'],
          ['interdiction', 'الحجر والقوامة', 'حجر'],
        ]],
      ]],
      ['inheritance', 'التركات والوصايا والأوقاف', [
        ['estates', 'التركات', [
          ['estate-division', 'قسمة التركة', 'ورثة'],
          ['heirs-proof', 'حصر الورثة', 'حصر إرث'],
          ['estate-debts', 'ديون التركة', 'دين على المتوفى'],
          ['estate-management', 'إدارة التركة وتصفيتها', 'تصفية تركة'],
        ]],
        ['wills', 'الوصايا', [
          ['will-validity', 'صحة الوصية', 'وصية'],
          ['will-execution', 'تنفيذ الوصية', 'تنفيذ وصية'],
          ['will-dispute', 'الطعن في الوصية', 'بطلان وصية'],
        ]],
        ['waqf', 'الأوقاف', [
          ['waqf-validity', 'صحة الوقف', 'وقف'],
          ['waqf-management', 'النظارة على الوقف', 'ناظر'],
          ['waqf-dispute', 'نزاع الوقف', 'نزاع أوقاف'],
        ]],
      ]],
    ],
  },
  {
    key: 'criminal', label: 'القضايا الجزائية', workspace: 'criminal', system: 'criminal',
    description: 'الجرائم الماسة بالنفس والمال والمعلوماتية والمخدرات والفساد، وسلامة الإجراءات الجزائية.',
    keywords: 'جنائي جريمة دفاع نيابة',
    branches: [
      ['persons', 'الجرائم الماسة بالأشخاص', [
        ['life', 'النفس وما دونها', [
          ['homicide', 'القتل والشروع فيه', 'قتل'],
          ['assault', 'الإيذاء والاعتداء', 'ضرب عراك'],
          ['threat', 'التهديد والإكراه', 'تهديد'],
          ['negligent-harm', 'الإيذاء الخطأ', 'خطأ'],
        ]],
        ['honor', 'الشرف والسمعة', [
          ['defamation', 'القذف والتشهير', 'قذف سب'],
          ['harassment', 'التحرش', 'تحرش'],
          ['family-violence', 'العنف الأسري', 'إيذاء أسري'],
        ]],
        ['liberty', 'الحرية', [
          ['unlawful-detention', 'الحجز غير المشروع', 'احتجاز'],
          ['kidnapping', 'الخطف', 'خطف'],
        ]],
      ]],
      ['property-crimes', 'الجرائم الماسة بالمال', [
        ['theft', 'الاستيلاء على المال', [
          ['theft-crime', 'السرقة', 'سرقة'],
          ['robbery', 'السطو والحرابة', 'سطو'],
          ['breach-trust', 'خيانة الأمانة', 'أمانة'],
          ['receiving', 'إخفاء المسروقات', 'حيازة مسروق'],
        ]],
        ['fraud', 'الاحتيال والتزوير', [
          ['fraud-crime', 'الاحتيال المالي', 'نصب'],
          ['forgery', 'التزوير', 'تزوير'],
          ['cheque-crime', 'جرائم الشيكات', 'شيك بدون رصيد'],
          ['fake-ads', 'الإعلان المضلل والغش التجاري', 'غش'],
        ]],
        ['money-laundering', 'غسل الأموال وتمويل الجرائم', [
          ['laundering', 'غسل الأموال', 'غسيل'],
          ['suspicious-transfers', 'التحويلات المشبوهة', 'تحويلات'],
        ]],
      ]],
      ['cyber', 'الجرائم المعلوماتية', [
        ['online', 'الجرائم عبر الإنترنت', [
          ['illegal-access', 'الدخول غير المشروع', 'اختراق'],
          ['blackmail', 'الابتزاز الإلكتروني', 'ابتزاز'],
          ['online-defamation', 'التشهير الإلكتروني', 'تشهير'],
          ['online-fraud', 'الاحتيال الإلكتروني', 'احتيال'],
        ]],
        ['data', 'البيانات والخصوصية', [
          ['data-leak', 'تسريب البيانات', 'بيانات'],
          ['privacy-violation', 'المساس بالخصوصية', 'تصوير'],
          ['account-hijack', 'الاستيلاء على الحسابات', 'اختراق حساب'],
        ]],
      ]],
      ['public-order', 'المخدرات والفساد والنظام العام', [
        ['drugs', 'المخدرات والمؤثرات', [
          ['possession', 'الحيازة والتعاطي', 'حيازة'],
          ['trafficking', 'الترويج والتهريب', 'ترويج'],
          ['drug-procedure', 'إجراءات الضبط في قضايا المخدرات', 'ضبط'],
        ]],
        ['corruption', 'الفساد والرشوة', [
          ['bribery', 'الرشوة', 'رشوة'],
          ['influence', 'استغلال النفوذ', 'نفوذ'],
          ['public-funds', 'المال العام', 'اختلاس'],
        ]],
        ['public-safety', 'السلامة والنظام العام', [
          ['traffic-crime', 'الجرائم المرورية', 'مرور تفحيط'],
          ['weapons', 'الأسلحة', 'سلاح'],
          ['public-disorder', 'الإخلال بالنظام العام', 'شغب'],
        ]],
      ]],
      ['criminal-procedure', 'الإجراءات الجزائية', [
        ['arrest', 'القبض والتفتيش والتوقيف', [
          ['arrest-legality', 'مشروعية القبض', 'قبض'],
          ['search-legality', 'مشروعية التفتيش', 'تفتيش'],
          ['detention-pretrial', 'التوقيف الاحتياطي', 'توقيف'],
          ['release-bail', 'الإفراج والكفالة', 'إفراج'],
        ]],
        ['investigation', 'التحقيق والمحاكمة', [
          ['interrogation', 'سلامة الاستجواب', 'تحقيق'],
          ['evidence-admissibility', 'قبول الأدلة', 'أدلة'],
          ['lapse', 'انقضاء الدعوى الجزائية', 'سقوط'],
          ['reconciliation', 'الصلح والتنازل', 'تنازل'],
        ]],
        ['judgment-review', 'الاعتراض على الأحكام', [
          ['criminal-appeal-grounds', 'أسباب الاعتراض', 'استئناف'],
          ['sentence-reduction', 'تخفيف العقوبة', 'تخفيف'],
          ['judgment-enforcement', 'تنفيذ الأحكام الجزائية', 'تنفيذ'],
        ]],
      ]],
    ],
  },
  {
    key: 'admin', label: 'القضايا الإدارية', workspace: 'administrative', system: 'administrative',
    description: 'القرارات الإدارية والوظيفة العامة والعقود الإدارية والتعويض عن أعمال الإدارة.',
    keywords: 'ديوان المظالم جهة حكومية',
    branches: [
      ['decisions', 'القرارات الإدارية', [
        ['annulment', 'إلغاء القرار', [
          ['decision-annulment', 'إلغاء قرار إداري', 'تظلم قرار'],
          ['negative-decision', 'القرار السلبي والامتناع', 'امتنعت الجهة'],
          ['licence', 'التراخيص والتصاريح', 'رخصة سحب رخصة'],
          ['administrative-penalty', 'الغرامات والعقوبات الإدارية', 'غرامة جهة'],
        ]],
        ['grievance', 'التظلم والإجراءات المسبقة', [
          ['prior-grievance', 'التظلم الإداري المسبق', 'تظلم'],
          ['grievance-reply', 'الرد على التظلم أو سكوت الجهة', 'لم ترد الجهة'],
          ['jurisdiction-admin', 'الاختصاص أمام القضاء الإداري', 'اختصاص'],
        ]],
        ['suspension', 'وقف التنفيذ والاستعجال', [
          ['stay-execution', 'طلب وقف تنفيذ القرار', 'إيقاف'],
          ['urgent-relief', 'الطلبات المستعجلة', 'مستعجل'],
        ]],
      ]],
      ['civil-service', 'الوظيفة العامة', [
        ['career', 'المسار الوظيفي', [
          ['promotion', 'الترقية', 'ترقية'],
          ['grade-allowance', 'الدرجة والعلاوات والبدلات', 'علاوة'],
          ['job-transfer-admin', 'النقل والانتداب', 'نقل'],
          ['leave-admin', 'الإجازات في الوظيفة العامة', 'إجازة'],
        ]],
        ['termination-admin', 'إنهاء الخدمة', [
          ['service-termination', 'إنهاء الخدمة والفصل', 'فصل موظف'],
          ['resignation-admin', 'الاستقالة وقبولها', 'استقالة'],
          ['retirement', 'التقاعد والمستحقات', 'تقاعد'],
          ['reinstatement', 'طلب العودة للعمل', 'إعادة'],
        ]],
        ['discipline', 'التأديب', [
          ['disciplinary-penalty', 'العقوبة التأديبية', 'عقوبة'],
          ['investigation-admin', 'التحقيق الإداري', 'تحقيق'],
          ['disciplinary-defects', 'عيوب الإجراءات التأديبية', 'بطلان'],
        ]],
      ]],
      ['military', 'الخدمة العسكرية والأمنية', [
        ['personnel', 'شؤون الأفراد', [
          ['military-promotion', 'الترقية والأقدمية', 'ضابط'],
          ['military-discharge', 'الإحالة للتقاعد أو الاستغناء', 'استغناء'],
          ['military-rights', 'الحقوق والمستحقات العسكرية', 'مستحقات'],
          ['military-discipline', 'الانضباط العسكري', 'انضباط'],
        ]],
        ['injury', 'الإصابة والشهادة', [
          ['military-injury', 'الإصابة أثناء الخدمة', 'إصابة'],
          ['martyr-rights', 'حقوق الشهيد وذويه', 'استشهاد'],
        ]],
      ]],
      ['admin-contracts', 'العقود الإدارية والتعويض', [
        ['contracts', 'العقود مع الجهات', [
          ['tender', 'المنافسات والمناقصات', 'منافسة'],
          ['gov-payments', 'تأخر المستحقات الحكومية', 'مستخلصات حكومية'],
          ['contract-termination', 'إنهاء العقد الإداري', 'سحب مشروع'],
          ['penalties-admin', 'غرامات التأخير على المتعاقد', 'غرامة تأخير'],
        ]],
        ['compensation', 'التعويض عن أعمال الإدارة', [
          ['admin-liability', 'مسؤولية الجهة عن الضرر', 'ضرر حكومي'],
          ['expropriation', 'نزع الملكية للمصلحة العامة', 'نزع ملكية'],
          ['unlawful-decision-damage', 'تعويض عن قرار معيب', 'تعويض'],
        ]],
        ['regulatory', 'المنازعات التنظيمية', [
          ['municipal', 'قرارات البلديات', 'بلدية'],
          ['customs-tax', 'الجمارك والضرائب (بعد المسار الإداري)', 'ضريبة زكاة جمارك'],
          ['licensing-bodies', 'قرارات الهيئات التنظيمية', 'هيئة'],
        ]],
      ]],
    ],
  },
  {
    key: 'execution', label: 'التنفيذ والإثبات والإجراءات', workspace: 'general', system: 'general',
    description: 'تنفيذ الأحكام والسندات، والإثبات، والاختصاص والمدد، والصلح والطعون في القضايا الحقوقية.',
    keywords: 'تنفيذ حجز إيقاف خدمات',
    branches: [
      ['enforcement', 'التنفيذ', [
        ['titles', 'سندات التنفيذ', [
          ['judgment-enforcement-civil', 'تنفيذ حكم قضائي', 'حكم نهائي'],
          ['note-enforcement', 'تنفيذ سند تنفيذي', 'سند لأمر'],
          ['foreign-judgment', 'تنفيذ حكم أجنبي', 'حكم أجنبي'],
        ]],
        ['measures', 'إجراءات التنفيذ', [
          ['attachment', 'الحجز على الأموال', 'حجز'],
          ['service-suspension', 'إيقاف الخدمات', 'إيقاف'],
          ['travel-ban', 'المنع من السفر', 'منع سفر'],
          ['auction', 'بيع المحجوز', 'مزاد'],
        ]],
        ['objections', 'الاعتراض على التنفيذ', [
          ['execution-objection', 'اعتراض المنفذ ضده', 'اعتراض'],
          ['third-party-claim', 'دعوى الغير على المحجوز', 'استحقاق'],
          ['stay-enforcement', 'وقف التنفيذ', 'إيقاف تنفيذ'],
          ['payment-schedule', 'جدولة السداد', 'تقسيط'],
        ]],
      ]],
      ['evidence', 'الإثبات', [
        ['means', 'وسائل الإثبات', [
          ['written-proof', 'الكتابة والمحررات', 'عقد مكتوب'],
          ['witness', 'الشهادة', 'شهود'],
          ['oath', 'اليمين', 'يمين'],
          ['expert', 'الخبرة', 'خبير'],
        ]],
        ['digital', 'الدليل الرقمي', [
          ['messages', 'الرسائل والمحادثات', 'واتساب'],
          ['e-signature', 'التوقيع الإلكتروني', 'توقيع'],
          ['digital-records', 'السجلات الرقمية والتصوير', 'تسجيل'],
        ]],
      ]],
      ['procedure', 'المرافعات والإجراءات', [
        ['filing', 'رفع الدعوى', [
          ['jurisdiction-venue', 'الاختصاص النوعي والمكاني', 'أي محكمة'],
          ['statement-claim', 'صحيفة الدعوى والطلبات', 'لائحة'],
          ['standing', 'الصفة والمصلحة', 'صفة'],
          ['limitation', 'مرور الزمن وسماع الدعوى', 'تقادم'],
        ]],
        ['defences', 'الدفوع والطلبات العارضة', [
          ['procedural-defence', 'الدفوع الشكلية', 'دفع شكلي'],
          ['counterclaim', 'الدعوى المتقابلة', 'متقابلة'],
          ['intervention', 'التدخل وإدخال الغير', 'إدخال'],
        ]],
        ['settlement', 'الصلح والوساطة', [
          ['court-settlement', 'الصلح القضائي', 'صلح'],
          ['mediation', 'الوساطة', 'وساطة'],
          ['arbitration', 'التحكيم', 'تحكيم'],
        ]],
      ]],
      ['review', 'الطعن في الأحكام', [
        ['ordinary', 'الاعتراض العادي', [
          ['appeal-grounds', 'أسباب الاعتراض بالاستئناف', 'استئناف'],
          ['appeal-deadline', 'المدد والإجراءات', 'مدة اعتراض'],
          ['appeal-reasoning', 'قصور التسبيب', 'تسبيب'],
        ]],
        ['extraordinary', 'الطعن غير العادي', [
          ['cassation', 'الطعن بالنقض', 'نقض'],
          ['reopening', 'التماس إعادة النظر', 'التماس'],
          ['third-party-objection', 'اعتراض الغير', 'غير'],
        ]],
      ]],
    ],
  },
];

// ---------------------------------------------------------------------------
// بناء الشجرة
// ---------------------------------------------------------------------------
function words(text?: string): string[] {
  return text ? text.split(/\s+/).filter(Boolean) : [];
}

function noteFor(path: string[], inherited?: string): string | undefined {
  return JURISDICTION_NOTES[path.join('/')] || inherited;
}

function buildTree(): TaxonomyNode[] {
  return SECTORS.map((sector) => {
    const base = { workspace: sector.workspace, system: sector.system };
    const sectorPath = [sector.key];
    const sectorNote = noteFor(sectorPath);
    return {
      ...base,
      key: sector.key,
      label: sector.label,
      level: 1 as const,
      note: sectorNote,
      path: sectorPath,
      keywords: words(sector.keywords),
      description: sector.description,
      children: sector.branches.map(([bKey, bLabel, cats]) => {
        const bPath = [...sectorPath, bKey];
        const bNote = noteFor(bPath, sectorNote);
        return {
          ...base, key: bKey, label: bLabel, level: 2 as const, note: bNote, path: bPath, keywords: [],
          children: cats.map(([cKey, cLabel, leaves]) => {
            const cPath = [...bPath, cKey];
            const cNote = noteFor(cPath, bNote);
            return {
              ...base, key: cKey, label: cLabel, level: 3 as const, note: cNote, path: cPath, keywords: [],
              children: leaves.map(([lKey, lLabel, lKw]) => {
                const lPath = [...cPath, lKey];
                return {
                  ...base, key: lKey, label: lLabel, level: 4 as const, note: noteFor(lPath, cNote),
                  path: lPath, keywords: words(lKw), children: [],
                };
              }),
            };
          }),
        };
      }),
    };
  });
}

export const CASE_TAXONOMY: TaxonomyNode[] = buildTree();

// ---------------------------------------------------------------------------
// أدوات الاستعلام
// ---------------------------------------------------------------------------
export function pathToHash(path: string[]): string {
  return path.length ? `#/catalog/${path.join('/')}` : '#/catalog';
}

export function hashToPath(hash: string): string[] {
  const match = /^#\/catalog\/?(.*)$/.exec(hash || '');
  if (!match) return [];
  return match[1].split('/').map((part) => part.trim()).filter(Boolean);
}

/** يحلّ مساراً إلى عقدة، ويُرجع null إذا كان أي جزء غير صالح. */
export function findNode(path: string[]): TaxonomyNode | null {
  let level: TaxonomyNode[] = CASE_TAXONOMY;
  let node: TaxonomyNode | null = null;
  for (const key of path) {
    node = level.find((candidate) => candidate.key === key) || null;
    if (!node) return null;
    level = node.children;
  }
  return node;
}

/** سلسلة العقد من القطاع حتى العقدة المطلوبة (لمسار التنقل). */
export function getTrail(path: string[]): TaxonomyNode[] {
  const trail: TaxonomyNode[] = [];
  for (let i = 1; i <= path.length; i++) {
    const node = findNode(path.slice(0, i));
    if (!node) break;
    trail.push(node);
  }
  return trail;
}

export function countLeaves(node: TaxonomyNode): number {
  return node.level === 4 ? 1 : node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

export function flattenLeaves(nodes: TaxonomyNode[] = CASE_TAXONOMY): TaxonomyNode[] {
  return nodes.flatMap((node) => (node.level === 4 ? [node] : flattenLeaves(node.children)));
}

export function flattenAll(nodes: TaxonomyNode[] = CASE_TAXONOMY): TaxonomyNode[] {
  return nodes.flatMap((node) => [node, ...flattenAll(node.children)]);
}

export function normalizeArabic(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface TaxonomySearchHit {
  node: TaxonomyNode;
  score: number;
  trail: TaxonomyNode[];
}

/**
 * بحث بسيط ومحدد: كل كلمة في الاستعلام يجب أن تظهر في العنوان أو المرادفات أو عناوين الآباء.
 * الترتيب: تطابق العنوان الكامل ثم بداية العنوان ثم العنوان ثم المرادفات ثم الآباء. الأوراق أولاً عند التساوي.
 */
export function searchTaxonomy(query: string, limit = 60): TaxonomySearchHit[] {
  const terms = normalizeArabic(query).split(' ').filter(Boolean);
  if (!terms.length) return [];
  const hits: TaxonomySearchHit[] = [];
  for (const node of flattenAll()) {
    const trail = getTrail(node.path);
    const label = normalizeArabic(node.label);
    const keywords = normalizeArabic(node.keywords.join(' '));
    const ancestors = normalizeArabic(trail.slice(0, -1).map((item) => item.label).join(' '));
    let score = 0;
    let matched = true;
    for (const term of terms) {
      if (label === term) score += 12;
      else if (label.startsWith(term)) score += 9;
      else if (label.includes(term)) score += 6;
      else if (keywords.includes(term)) score += 5;
      else if (ancestors.includes(term)) score += 2;
      else { matched = false; break; }
    }
    if (!matched) continue;
    if (node.level === 4) score += 1;
    hits.push({ node, score, trail });
  }
  hits.sort((a, b) => b.score - a.score || b.node.level - a.node.level || a.node.label.localeCompare(b.node.label, 'ar'));
  return hits.slice(0, limit);
}

export function taxonomyStats() {
  const all = flattenAll();
  return {
    sectors: CASE_TAXONOMY.length,
    branches: all.filter((n) => n.level === 2).length,
    categories: all.filter((n) => n.level === 3).length,
    leaves: all.filter((n) => n.level === 4).length,
  };
}

/**
 * سياق نوع القضية المختار من الفهرس، يُضاف أول الطلب. يُحلّ المسار عبر الشجرة الثابتة فقط،
 * فلا يمكن تمرير نص حر إلى الطلب. المسار غير الصالح يُرجع الطلب كما هو.
 */
export function withCaseType(prompt: string, path?: string[] | null): string {
  const node = path && path.length === 4 ? findNode(path) : null;
  if (!node) return prompt;
  const trail = getTrail(node.path).map((item) => item.label).join(' › ');
  const note = node.note ? `\nتنبيه اختصاص من الفهرس: ${node.note}` : '';
  return `تصنيف القضية الذي اختاره المستخدم من الفهرس: ${trail}.
الجهة القضائية المرجّحة لهذا النوع: ${SYSTEM_LABELS[node.system]} (قد تختلف عن مساحة العمل المفتوحة؛ حدّد الجهة الصحيحة من الوقائع).${note}
هذا التصنيف للتوجيه فقط؛ إن تعارض مع الوقائع أو المستندات المرفقة فالمعتمد هو الوقائع، ونبّه المستخدم إلى التعارض.

${prompt}`;
}
