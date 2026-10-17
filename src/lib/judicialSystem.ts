/**
 * هيكل المحكمة الافتراضية في QADA.
 *
 * ست جهات قضائية، لكل جهة ثلاث درجات (ابتدائية/عامة ← استئناف ← عليا).
 * المدد النظامية لكل جهة في src/lib/litigationDeadlines.ts.
 * في الدرجتين الابتدائية والاستئنافية: وكيلا قاضٍ + قاضٍ مُصدر للحكم + مدعٍ عام.
 * في العليا (النقض): ثلاثة قضاة نقض يقررون بالأغلبية + مدعٍ عام.
 * وفي كل محكمة فريق دفاع من ستة محامين.
 *
 * هذا الملف مشترك بين الواجهة والخادم: بيانات الهيكل وأنواع المخرجات
 * وقواعد الحكم الحتمية. المطالبات (prompts) والاتصال بالنموذج في api/_courtEngine.ts.
 */

export type CourtSystemId = 'commercial' | 'general' | 'labor' | 'personal-status' | 'administrative' | 'criminal';
export type CourtLevelId = 'first' | 'appeal' | 'supreme';
export type ClientRole = 'claimant' | 'defendant';

export type LawyerRoleId =
  | 'facts-references'
  | 'gaps'
  | 'drafting-advocacy'
  | 'statutes'
  | 'super-lawyer'
  | 'former-judge';

export type BenchSeatKind = 'judge-agent' | 'presiding-judge' | 'cassation-judge';

export type BenchSeat = {
  id: string;
  kind: BenchSeatKind;
  contractId: 'judge-agent' | 'presiding-judge' | 'cassation-judge';
  title: string;
  focus: string;
  issuesRuling: boolean;
};

export type ProsecutorSeat = {
  id: 'prosecutor';
  contractId: 'public-prosecutor';
  title: string;
  represents: string;
  focus: string;
};

export type LawyerSeat = {
  id: LawyerRoleId;
  contractId: string;
  title: string;
  mission: string;
};

export type CourtLevelProfile = {
  id: CourtLevelId;
  courtName: string;
  shortName: string;
  mission: string;
  /** نص يمرر إلى detectCourtProfile لاختيار بروفايل المحكمة المناسب. */
  profileHint: string;
};

export type CourtSystem = {
  id: CourtSystemId;
  title: string;
  subtitle: string;
  /** أسماء أنظمة تضاف إلى استعلام حزمة المصادر الرسمية فقط؛ ليست إسناداً. */
  sourceHints: string[];
  levels: Record<CourtLevelId, CourtLevelProfile>;
  prosecutor: { represents: string; focus: string };
  lawyerFocus: string[];
};

export type CourtRoster = {
  system: CourtSystem;
  level: CourtLevelProfile;
  bench: BenchSeat[];
  prosecutor: ProsecutorSeat;
  lawyers: LawyerSeat[];
};

export const COURT_LEVEL_ORDER: CourtLevelId[] = ['first', 'appeal', 'supreme'];

export const MAX_SESSION_ROUNDS = 3;

export const COURT_SYSTEMS: CourtSystem[] = [
  {
    id: 'commercial',
    title: 'المحاكم التجارية',
    subtitle: 'المنازعات التجارية بين التجار والشركات والعقود التجارية',
    sourceHints: ['نظام المحاكم التجارية', 'اللائحة التنفيذية لنظام المحاكم التجارية', 'القضاء التجاري'],
    levels: {
      first: {
        id: 'first',
        courtName: 'المحكمة التجارية',
        shortName: 'الابتدائية',
        mission: 'نظر الدعوى التجارية ابتداءً: الاختصاص النوعي والصفة التجارية والقبول، ثم الموضوع والإثبات والطلبات.',
        profileHint: 'المحكمة التجارية',
      },
      appeal: {
        id: 'appeal',
        courtName: 'محكمة الاستئناف — الدوائر التجارية',
        shortName: 'الاستئناف',
        mission: 'مراجعة الحكم التجاري الابتدائي في حدود أسباب الاعتراض: موضع الخطأ في الحكم وأثره والطلب الاستئنافي.',
        profileHint: 'محكمة الاستئناف الدوائر التجارية',
      },
      supreme: {
        id: 'supreme',
        courtName: 'المحكمة العليا',
        shortName: 'العليا — النقض',
        mission: 'رقابة قانونية على الحكم التجاري: العيب النظامي أو الإجرائي أو التسبيبي القابل للمراجعة، دون إعادة وزن الأدلة.',
        profileHint: 'المحكمة العليا',
      },
    },
    prosecutor: {
      represents: 'يمثل دفوع الخصم التجاري',
      focus: 'يتقمص دفاع الخصم بأقوى صوره: الاختصاص وشرط التحكيم والصفة التجارية والإثبات بالدفاتر والسداد والمقاصة والإخلال المقابل.',
    },
    lawyerFocus: [
      'الصفة التجارية للأطراف وللعمل محل النزاع وأثرها على الاختصاص النوعي.',
      'وجود شرط تحكيم أو اتفاق على جهة نظر النزاع أو إجراء ودي سابق للقيد.',
      'العقود والفواتير والدفاتر التجارية والمراسلات وكشوف الحساب كأدلة، وما ينقص منها.',
      'تحديد المبلغ المطالب به وأساس احتسابه وتاريخ استحقاقه وما سُدد منه.',
      'دفوع الخصم المتوقعة: السداد، المقاصة، الإخلال المقابل، انتفاء الصفة.',
    ],
  },
  {
    id: 'general',
    title: 'المحاكم العامة',
    subtitle: 'الدعاوى الحقوقية والمالية والعقارية والمدنية',
    sourceHints: ['المحاكم العامة', 'نظام المرافعات الشرعية', 'نظام القضاء'],
    levels: {
      first: {
        id: 'first',
        courtName: 'المحكمة العامة',
        shortName: 'العامة',
        mission: 'نظر الدعوى الحقوقية ابتداءً: صفة الأطراف ومصدر الالتزام والإثبات ومقدار الحق والطلب القابل للتنفيذ.',
        profileHint: 'المحكمة العامة',
      },
      appeal: {
        id: 'appeal',
        courtName: 'محكمة الاستئناف — الدوائر الحقوقية',
        shortName: 'الاستئناف',
        mission: 'مراجعة الحكم الحقوقي الابتدائي في حدود أسباب الاعتراض: موضع الخطأ في الحكم وأثره والطلب الاستئنافي.',
        profileHint: 'محكمة الاستئناف مسار عام حقوقي',
      },
      supreme: {
        id: 'supreme',
        courtName: 'المحكمة العليا',
        shortName: 'العليا — النقض',
        mission: 'رقابة قانونية على الحكم الحقوقي: العيب النظامي أو الإجرائي أو التسبيبي القابل للمراجعة، دون إعادة وزن الأدلة.',
        profileHint: 'المحكمة العليا',
      },
    },
    prosecutor: {
      represents: 'يمثل دفوع الخصم',
      focus: 'يبني أقوى دفاع للطرف المقابل: إنكار الالتزام، السداد، الدفع بعدم القبول أو عدم السماع متى ثبت سنده، ضعف الإثبات، عدم الاختصاص.',
    },
    lawyerFocus: [
      'صفة الأطراف وأهليتهم ومصلحتهم في الدعوى.',
      'مصدر الالتزام: عقد أو فعل ضار أو إثراء أو إقرار، وما يثبته من مستندات.',
      'عبء الإثبات ووسائله المتاحة في الملف: مستندات، شهود، إقرار، خبرة.',
      'الاختصاص النوعي والمكاني قبل الصياغة.',
      'تحديد الحق أو المبلغ بدقة قابلة للحكم والتنفيذ.',
    ],
  },
  {
    id: 'labor',
    title: 'المحاكم العمالية',
    subtitle: 'منازعات العمل بين العامل وصاحب العمل والأجور ومستحقات نهاية الخدمة',
    sourceHints: ['المحاكم العمالية', 'نظام العمل', 'نظام المرافعات الشرعية'],
    levels: {
      first: {
        id: 'first',
        courtName: 'المحكمة العمالية',
        shortName: 'الابتدائية',
        mission: 'نظر النزاع العمالي ابتداءً: ثبوت علاقة العمل ونوع العقد والأجر، ثم كل مستحق بأساسه ومقداره ودليله، مع فحص المواعيد والقبول.',
        profileHint: 'المحكمة العمالية',
      },
      appeal: {
        id: 'appeal',
        courtName: 'محكمة الاستئناف — الدوائر العمالية',
        shortName: 'الاستئناف',
        mission: 'مراجعة الحكم العمالي الابتدائي في حدود أسباب الاعتراض: موضع الخطأ في الحكم وأثره والطلب الاستئنافي.',
        profileHint: 'محكمة الاستئناف الدوائر العمالية',
      },
      supreme: {
        id: 'supreme',
        courtName: 'المحكمة العليا',
        shortName: 'العليا — النقض',
        mission: 'رقابة قانونية على الحكم العمالي: العيب النظامي أو الإجرائي أو التسبيبي القابل للمراجعة، دون إعادة وزن الأدلة.',
        profileHint: 'المحكمة العليا',
      },
    },
    prosecutor: {
      represents: 'يمثل دفوع الطرف الآخر في النزاع العمالي',
      focus: 'يتقمص دفاع الطرف الآخر بأقوى صوره: انتفاء علاقة العمل أو اختلاف نوع العقد والأجر، السداد والمخالصة، مشروعية الإنهاء، فوات المواعيد متى ثبت سندها، ضعف الإثبات.',
    },
    lawyerFocus: [
      'إثبات علاقة العمل ونوع العقد ومدته والأجر الفعلي بالعقد ومسيرات الرواتب والتحويلات.',
      'تاريخ انتهاء علاقة العمل وسببه، وأثره على المستحقات وعلى المواعيد.',
      'تفصيل كل مطالبة مستقلة: الأجور المتأخرة، مكافأة نهاية الخدمة، بدل الإجازات، التعويض — بأساسها ومبلغها ودليلها.',
      'الإجراءات السابقة على القيد ومحاولات التسوية متى لزمت ومحاضرها.',
      'دفوع الخصم المتوقعة: المخالصة، الاستقالة، الإنهاء المشروع، فوات المدة.',
    ],
  },
  {
    id: 'personal-status',
    title: 'محاكم الأحوال الشخصية',
    subtitle: 'النفقة والحضانة والزيارة والطلاق والخلع وإثبات العلاقات الأسرية',
    sourceHints: ['محاكم الأحوال الشخصية', 'نظام الأحوال الشخصية', 'نظام المرافعات الشرعية'],
    levels: {
      first: {
        id: 'first',
        courtName: 'محكمة الأحوال الشخصية',
        shortName: 'الابتدائية',
        mission: 'نظر الدعوى الأسرية ابتداءً: ثبوت العلاقة محل الدعوى والاختصاص، ثم الطلب بأساسه ودليله وقابليته للتنفيذ، مع مراعاة مصلحة المحضون.',
        profileHint: 'محكمة الأحوال الشخصية',
      },
      appeal: {
        id: 'appeal',
        courtName: 'محكمة الاستئناف — دوائر الأحوال الشخصية',
        shortName: 'الاستئناف',
        mission: 'مراجعة حكم الأحوال الشخصية الابتدائي في حدود أسباب الاعتراض: موضع الخطأ في الحكم وأثره والطلب الاستئنافي.',
        profileHint: 'محكمة الاستئناف دوائر الأحوال الشخصية',
      },
      supreme: {
        id: 'supreme',
        courtName: 'المحكمة العليا',
        shortName: 'العليا — النقض',
        mission: 'رقابة قانونية على حكم الأحوال الشخصية: العيب النظامي أو الإجرائي أو التسبيبي القابل للمراجعة، دون إعادة وزن الأدلة.',
        profileHint: 'المحكمة العليا',
      },
    },
    prosecutor: {
      represents: 'يمثل دفوع الطرف الآخر في النزاع الأسري',
      focus: 'يتقمص دفاع الطرف الآخر بأقوى صوره: الاختصاص، عدم ثبوت العلاقة أو الواقعة بصك أو دليل، قدرة المنفق وحاجة المنفق عليه، مصلحة المحضون، ضعف الإثبات.',
    },
    lawyerFocus: [
      'ثبوت العلاقة محل الدعوى بالصكوك الرسمية: عقد النكاح، صك الطلاق أو الخلع، إثبات النسب.',
      'في الحضانة والزيارة: مصلحة المحضون ووقائعها ومستنداتها.',
      'في النفقة: حاجة المنفق عليه وقدرة المنفق، والمستندات المالية لكل منهما.',
      'الاختصاص المكاني والنوعي، والصلح أو الإصلاح الأسري متى لزم.',
      'تحديد الطلب بدقة قابلة للتنفيذ: المبلغ ودوريته، أو ترتيب الحضانة والزيارة زماناً ومكاناً.',
    ],
  },
  {
    id: 'administrative',
    title: 'ديوان المظالم والمحاكم الإدارية',
    subtitle: 'القرارات الإدارية والحقوق الوظيفية والعقود الإدارية والتعويض',
    sourceHints: ['ديوان المظالم', 'نظام المرافعات أمام ديوان المظالم', 'القضاء الإداري'],
    levels: {
      first: {
        id: 'first',
        courtName: 'المحكمة الإدارية',
        shortName: 'الابتدائية',
        mission: 'نظر الدعوى الإدارية ابتداءً: القرار أو الحق محل النزاع، والقبول والتظلم والمواعيد متى لزمت، ثم المشروعية والإثبات والطلبات.',
        profileHint: 'المحكمة الإدارية ديوان المظالم',
      },
      appeal: {
        id: 'appeal',
        courtName: 'محكمة الاستئناف الإدارية',
        shortName: 'الاستئناف',
        mission: 'مراجعة الحكم الإداري الابتدائي في حدود أسباب الاعتراض، مع كشف ما عالجه الحكم من دفوع ومستندات وما أغفله.',
        profileHint: 'محكمة الاستئناف الإدارية',
      },
      supreme: {
        id: 'supreme',
        courtName: 'المحكمة الإدارية العليا',
        shortName: 'العليا — النقض',
        mission: 'رقابة قانونية على الحكم الإداري: العيب النظامي أو الإجرائي أو التسبيبي القابل للمراجعة، دون إعادة وزن الأدلة.',
        profileHint: 'المحكمة الإدارية العليا',
      },
    },
    prosecutor: {
      represents: 'يمثل دفاع الجهة الإدارية',
      focus: 'يتقمص دفاع الجهة الإدارية: عدم القبول شكلاً، فوات المواعيد، سلامة القرار وسببه، السلطة التقديرية، انتفاء الضرر أو علاقة السببية.',
    },
    lawyerFocus: [
      'تحديد القرار أو التصرف أو الحق الإداري محل النزاع بدقة وتاريخ العلم به.',
      'التظلم والمواعيد والإجراءات السابقة على القيد متى لزمت، مع ربطها بمصدر متحقق.',
      'أوجه عدم المشروعية: عيب الاختصاص أو الشكل أو السبب أو مخالفة النظام أو إساءة استعمال السلطة.',
      'المستندات التي بيد الجهة وإمكان طلب تقديمها.',
      'التمييز بين دعوى الإلغاء والتعويض والحقوق الوظيفية والعقود الإدارية.',
    ],
  },
  {
    id: 'criminal',
    title: 'المحاكم الجزائية',
    subtitle: 'الدعوى الجزائية والدفاع والاعتراض على الأحكام الجزائية',
    sourceHints: ['المحاكم الجزائية', 'نظام الإجراءات الجزائية'],
    levels: {
      first: {
        id: 'first',
        courtName: 'المحكمة الجزائية',
        shortName: 'الابتدائية',
        mission: 'نظر الدعوى الجزائية: الوصف المنسوب والأدلة ونسبتها وسلامة الإجراءات والدفوع، دون افتراض الإدانة.',
        profileHint: 'المحكمة الجزائية',
      },
      appeal: {
        id: 'appeal',
        courtName: 'محكمة الاستئناف — الدوائر الجزائية',
        shortName: 'الاستئناف',
        mission: 'مراجعة الحكم الجزائي في حدود أسباب الاعتراض: أسباب الإدانة أو البراءة والأدلة الجوهرية والإجراءات المؤثرة.',
        profileHint: 'محكمة الاستئناف مسار جزائي',
      },
      supreme: {
        id: 'supreme',
        courtName: 'المحكمة العليا',
        shortName: 'العليا — النقض',
        mission: 'رقابة قانونية على الحكم الجزائي: العيب النظامي أو الإجرائي أو التسبيبي القابل للمراجعة، دون إعادة وزن الأدلة.',
        profileHint: 'المحكمة العليا',
      },
    },
    prosecutor: {
      represents: 'النيابة العامة — الادعاء الجزائي',
      focus: 'يقدم الاتهام بأقوى صوره: ترابط الأدلة وسلامة الإجراءات والاعتراف أو التقارير الفنية متى وجدت، دون اختراع وصف جرمي أو عقوبة.',
    },
    lawyerFocus: [
      'سلامة إجراءات القبض والتفتيش والتوقيف والتحقيق وأثر أي خلل فيها على الدليل.',
      'كفاية الأدلة ونسبتها للموكل، وقيام الشك المعقول، وتناقض الأقوال والمحاضر.',
      'الاعتراف وظروف صدوره وقيمته، والتقارير الفنية وحدودها.',
      'الدفوع الموضوعية والظروف المخففة دون التسليم بالاتهام.',
      'الحق الخاص إن وجد وأثر الصلح أو التنازل متى ثبت سنده.',
    ],
  },
];

export const LAWYER_TEAM: LawyerSeat[] = [
  {
    id: 'facts-references',
    contractId: 'lawyer-facts-references',
    title: 'وكيل الوقائع والمراجع',
    mission: 'يبني مصفوفة الوقائع (واقعة ← دليل ← مصدر) وتسلسلها الزمني، ويجمع المراجع المتاحة من حزمة المصادر الرسمية دون غيرها.',
  },
  {
    id: 'gaps',
    contractId: 'lawyer-gaps',
    title: 'وكيل الثغرات',
    mission: 'يكشف ثغرات الخصم والحكم محل الاعتراض، ويكشف ثغرات ملف الموكل قبل أن يكشفها الخصم، ويقترح طريقة سد كل ثغرة.',
  },
  {
    id: 'drafting-advocacy',
    contractId: 'lawyer-drafting-advocacy',
    title: 'وكيل الصياغة والحجج وتحرير الدعوى',
    mission: 'يحرر الدعوى أو المذكرة تحريراً كاملاً، ويصوغ الحجج الموجزة التي تُلقى أمام القاضي.',
  },
  {
    id: 'statutes',
    contractId: 'lawyer-statutes',
    title: 'وكيل المواد والأنظمة',
    mission: 'يحدد الأنظمة والمواد المتحققة في حزمة المصادر ونسختها النافذة زمنياً واستثناءاتها، ويمنع أي سند غير متحقق.',
  },
  {
    id: 'super-lawyer',
    contractId: 'lawyer-super',
    title: 'المحامي الخارق',
    mission: 'قائد فريق الدفاع: يبني نظرية القضية الفائزة، ويرتب الحجج من الأقوى، ويضع الطلب الأصلي والاحتياطي، ويستبق ضربات المدعي العام.',
  },
  {
    id: 'former-judge',
    contractId: 'lawyer-former-judge',
    title: 'المحامي القاضي السابق',
    mission: 'يقرأ الملف بعين القاضي: ما الذي يقنع الدائرة وما الذي تردّه شكلاً أو موضوعاً، ويضبط الطلبات لتكون قابلة للحكم بها.',
  },
];

export function getCourtSystem(id: string): CourtSystem {
  return COURT_SYSTEMS.find((system) => system.id === id) || COURT_SYSTEMS[0];
}

export function isCourtSystemId(value: unknown): value is CourtSystemId {
  return COURT_SYSTEMS.some((system) => system.id === value);
}

export function isCourtLevelId(value: unknown): value is CourtLevelId {
  return COURT_LEVEL_ORDER.includes(value as CourtLevelId);
}

export function benchSeatsFor(level: CourtLevelId): BenchSeat[] {
  if (level === 'supreme') {
    return [
      {
        id: 'cassation-judge-1',
        kind: 'cassation-judge',
        contractId: 'cassation-judge',
        title: 'قاضي النقض الأول — رئيس الدائرة',
        focus: 'مخالفة النظام أو الخطأ في تطبيقه أو تأويله، وأثر ذلك في النتيجة.',
        issuesRuling: true,
      },
      {
        id: 'cassation-judge-2',
        kind: 'cassation-judge',
        contractId: 'cassation-judge',
        title: 'قاضي النقض الثاني',
        focus: 'الاختصاص وسلامة تشكيل المحكمة والإجراءات الجوهرية المؤثرة.',
        issuesRuling: false,
      },
      {
        id: 'cassation-judge-3',
        kind: 'cassation-judge',
        contractId: 'cassation-judge',
        title: 'قاضي النقض الثالث',
        focus: 'الخطأ في تكييف الواقعة أو وصفها، وقصور التسبيب أو تناقضه، وإغفال المستند الحاسم.',
        issuesRuling: false,
      },
    ];
  }

  return [
    {
      id: 'judge-agent-1',
      kind: 'judge-agent',
      contractId: 'judge-agent',
      title: 'وكيل القاضي الأول',
      focus: level === 'appeal'
        ? 'قبول الاعتراض شكلاً ونطاقه، والاختصاص والإجراءات والمواعيد.'
        : 'الاختصاص والقبول والإجراءات والمواعيد وشروط الدعوى.',
      issuesRuling: false,
    },
    {
      id: 'judge-agent-2',
      kind: 'judge-agent',
      contractId: 'judge-agent',
      title: 'وكيل القاضي الثاني',
      focus: level === 'appeal'
        ? 'صحة أسباب الحكم الابتدائي ومعالجته للدفوع والمستندات، والتكييف والإثبات.'
        : 'الموضوع والإثبات والتكييف والتسبيب والطلبات.',
      issuesRuling: false,
    },
    {
      id: 'presiding-judge',
      kind: 'presiding-judge',
      contractId: 'presiding-judge',
      title: level === 'appeal' ? 'رئيس الدائرة الاستئنافية — مُصدر الحكم' : 'القاضي ناظر القضية — مُصدر الحكم',
      focus: 'يزن رأيي وكيليه ومرافعة الطرفين ثم يصدر الحكم المحاكى ومنطوقه وأسبابه.',
      issuesRuling: true,
    },
  ];
}

/** المقاعد التي تقدم رأياً مستقلاً قبل الحكم (وكيلا القاضي، أو قضاة النقض الثلاثة). */
export function deliberatingSeatsFor(level: CourtLevelId): BenchSeat[] {
  return benchSeatsFor(level).filter((seat) => level === 'supreme' || seat.kind === 'judge-agent');
}

export function prosecutorSeatFor(systemId: CourtSystemId, level: CourtLevelId): ProsecutorSeat {
  const system = getCourtSystem(systemId);
  return {
    id: 'prosecutor',
    contractId: 'public-prosecutor',
    title: level === 'supreme' ? 'المدعي العام — الرد على أسباب النقض' : 'المدعي العام',
    represents: system.prosecutor.represents,
    focus: system.prosecutor.focus,
  };
}

export function buildCourtRoster(systemId: CourtSystemId, levelId: CourtLevelId): CourtRoster {
  const system = getCourtSystem(systemId);
  return {
    system,
    level: system.levels[levelId],
    bench: benchSeatsFor(levelId),
    prosecutor: prosecutorSeatFor(system.id, levelId),
    lawyers: LAWYER_TEAM,
  };
}

export function allCourtRosters(): CourtRoster[] {
  return COURT_SYSTEMS.flatMap((system) => COURT_LEVEL_ORDER.map((level) => buildCourtRoster(system.id, level)));
}

export function defaultClientRole(systemId: CourtSystemId): ClientRole {
  return systemId === 'criminal' ? 'defendant' : 'claimant';
}

export function defaultLevelForService(serviceId?: string | null): CourtLevelId {
  if (!serviceId) return 'first';
  if (/_cassation$|_supreme$/.test(serviceId)) return 'supreme';
  if (/_appeal$/.test(serviceId)) return 'appeal';
  return 'first';
}

export function clientPartyLabel(systemId: CourtSystemId, level: CourtLevelId, role: ClientRole): string {
  if (level === 'supreme') return 'المعترض بطلب النقض';
  if (level === 'appeal') return systemId === 'criminal' && role === 'defendant' ? 'المعترض (المحكوم عليه)' : 'المعترض على الحكم';
  if (role === 'defendant') return systemId === 'criminal' ? 'المتهم' : 'المدعى عليه';
  return systemId === 'administrative' ? 'المدعي في مواجهة الجهة الإدارية' : 'المدعي';
}

export function pleadingTypeFor(systemId: CourtSystemId, level: CourtLevelId, role: ClientRole): string {
  if (level === 'supreme') return 'مذكرة اعتراض بطلب النقض';
  if (level === 'appeal') return 'لائحة اعتراض (استئناف)';
  if (role === 'defendant') return systemId === 'criminal' ? 'مذكرة دفاع جزائي' : 'مذكرة جوابية';
  return 'لائحة دعوى';
}

// ---------------------------------------------------------------------------
// مخرجات الجلسة
// ---------------------------------------------------------------------------

export type LawyerOpinion = {
  roleId: LawyerRoleId;
  summary: string;
  points: string[];
  delivered: boolean;
};

export type DefenseBrief = {
  theory: string;
  lawyers: LawyerOpinion[];
  pleading: string;
  requests: string[];
  oralArguments: string[];
  missingEvidence: string[];
  authorities: string[];
};

export type AttackSeverity = 'high' | 'medium' | 'low';

export type ProsecutionAttack = {
  point: string;
  target: string;
  severity: AttackSeverity;
};

export type ProsecutionBrief = {
  strongestAttack: string;
  attacks: ProsecutionAttack[];
  demands: string;
};

export type BenchVote = 'favorable' | 'partial' | 'unfavorable';
export type RulingOutcome = 'favorable' | 'partial' | 'unfavorable' | 'not-ready';

export type BenchOpinion = {
  seatId: string;
  vote: BenchVote;
  reasoning: string;
  decisiveIssues: string[];
  delivered: boolean;
};

export type BenchRuling = {
  opinions: BenchOpinion[];
  finalJudgment: {
    outcome: RulingOutcome;
    operative: string;
    reasons: string[];
  };
  curableDefects: string[];
  evidentiaryGaps: string[];
};

export type SessionNextStep = 'won' | 'revise' | 'needs-client-input' | 'exhausted' | 'wrong-court';

export type SessionDecision = {
  outcome: RulingOutcome;
  nextStep: SessionNextStep;
  round: number;
  maxRounds: number;
  dissentingSeats: string[];
  majority?: { favorable: number; partial: number; unfavorable: number };
  downgradedReasons: string[];
};

export const OUTCOME_LABELS: Record<RulingOutcome, string> = {
  favorable: 'لصالح الموكل',
  partial: 'لصالح الموكل جزئياً',
  unfavorable: 'ضد الموكل',
  'not-ready': 'تعذر الفصل — الملف غير مكتمل',
};

export const VOTE_LABELS: Record<BenchVote, string> = {
  favorable: 'مع الموكل',
  partial: 'مع الموكل جزئياً',
  unfavorable: 'ضد الموكل',
};

export const NEXT_STEP_LABELS: Record<SessionNextStep, string> = {
  won: 'انتهت المحاكاة لصالح الموكل',
  revise: 'فريق الدفاع يعالج أسباب الحكم في جولة جديدة',
  'needs-client-input': 'الفوز يحتاج مستندات أو وقائع منك',
  exhausted: 'اكتملت الجولات — راجع ما يلزم لتقوية الملف',
  'wrong-court': 'القضية من اختصاص جهة أخرى — أعد الجلسة أمام المحكمة المختصة',
};

// ---------------------------------------------------------------------------
// تطبيع مخرجات النموذج (المدخل غير موثوق دائماً)
// ---------------------------------------------------------------------------

function clip(value: unknown, max: number): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
  return text.replace(/\u0000/g, '').trim().slice(0, max);
}

function clipList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return clip(item, maxLength);
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        return clip(record.text ?? record.point ?? record.item ?? '', maxLength);
      }
      return '';
    })
    .filter(Boolean)
    .slice(0, maxItems);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizeDefenseBrief(raw: unknown): DefenseBrief {
  const source = asRecord(raw);
  const lawyersRaw = Array.isArray(source.lawyers) ? source.lawyers.map(asRecord) : [];

  const lawyers = LAWYER_TEAM.map((seat, index): LawyerOpinion => {
    const match = lawyersRaw.find((item) => item.roleId === seat.id)
      || (lawyersRaw[index] && !lawyersRaw[index].roleId ? lawyersRaw[index] : undefined)
      || {};
    const summary = clip(match.summary, 900);
    const points = clipList(match.points, 8, 600);
    return {
      roleId: seat.id,
      summary: summary || 'لم يقدم الوكيل رأياً مكتملاً في هذه الجولة.',
      points,
      delivered: Boolean(summary || points.length),
    };
  });

  return {
    theory: clip(source.theory, 1500),
    lawyers,
    pleading: clip(source.pleading, 30000),
    requests: clipList(source.requests, 10, 500),
    oralArguments: clipList(source.oralArguments, 8, 500),
    missingEvidence: clipList(source.missingEvidence, 10, 400),
    authorities: clipList(source.authorities, 12, 300),
  };
}

export function normalizeProsecutionBrief(raw: unknown): ProsecutionBrief {
  const source = asRecord(raw);
  const attacks = (Array.isArray(source.attacks) ? source.attacks : [])
    .map((item): ProsecutionAttack => {
      const record = asRecord(item);
      const severity = record.severity === 'high' || record.severity === 'low' ? record.severity : 'medium';
      return {
        point: clip(typeof item === 'string' ? item : record.point, 700),
        target: clip(record.target, 60) || 'الموضوع',
        severity,
      };
    })
    .filter((attack) => attack.point)
    .slice(0, 10);

  return {
    strongestAttack: clip(source.strongestAttack, 1200) || attacks[0]?.point || '',
    attacks,
    demands: clip(source.demands, 1200),
  };
}

function normalizeVote(value: unknown): BenchVote {
  return value === 'favorable' || value === 'partial' ? value : 'unfavorable';
}

function normalizeOutcome(value: unknown): RulingOutcome {
  return value === 'favorable' || value === 'partial' || value === 'unfavorable' ? value : 'not-ready';
}

export function normalizeBenchRuling(raw: unknown, level: CourtLevelId): BenchRuling {
  const source = asRecord(raw);
  const opinionsRaw = Array.isArray(source.opinions) ? source.opinions.map(asRecord) : [];

  const opinions = deliberatingSeatsFor(level).map((seat, index): BenchOpinion => {
    const match = opinionsRaw.find((item) => item.seatId === seat.id)
      || (opinionsRaw[index] && !opinionsRaw[index].seatId ? opinionsRaw[index] : undefined)
      || {};
    const reasoning = clip(match.reasoning, 2000);
    // مقعد لم يقدم رأياً لا يُحسب لصالح الموكل (fail-closed).
    return {
      seatId: seat.id,
      vote: reasoning ? normalizeVote(match.vote) : 'unfavorable',
      reasoning: reasoning || 'لم يقدم القاضي رأياً مسبباً في هذه الجولة؛ لا يُحتسب صوته لصالح الموكل.',
      decisiveIssues: clipList(match.decisiveIssues, 6, 500),
      delivered: Boolean(reasoning),
    };
  });

  const judgment = asRecord(source.finalJudgment);
  return {
    opinions,
    finalJudgment: {
      outcome: normalizeOutcome(judgment.outcome),
      operative: clip(judgment.operative, 2500),
      reasons: clipList(judgment.reasons, 10, 900),
    },
    curableDefects: clipList(source.curableDefects, 10, 500),
    evidentiaryGaps: clipList(source.evidentiaryGaps, 10, 500),
  };
}

// ---------------------------------------------------------------------------
// قواعد الحكم الحتمية
// ---------------------------------------------------------------------------

export type DeterministicFindings = {
  /** إحالات قانونية أدخلها الدفاع ولا توجد في الملف أو حزمة المصادر. */
  unsupportedCitations: string[];
  /** أركان تحرير الدعوى الناقصة متى كان المحرر لائحة دعوى. */
  claimLiberationIssues: string[];
  /** الملف يدل بثقة عالية على اختصاص جهة غير المختارة (src/lib/courtJurisdiction.ts). */
  jurisdictionIssues?: string[];
};

export function resolveSessionDecision(
  ruling: BenchRuling,
  level: CourtLevelId,
  round: number,
  findings: DeterministicFindings,
): { decision: SessionDecision; ruling: BenchRuling } {
  const curableDefects = [...ruling.curableDefects];
  const downgradedReasons: string[] = [];
  let benchOutcome = ruling.finalJudgment.outcome;
  let majority: SessionDecision['majority'];

  if (level === 'supreme') {
    const tally = { favorable: 0, partial: 0, unfavorable: 0 };
    for (const opinion of ruling.opinions) tally[opinion.vote] += 1;
    majority = tally;
    // دائرة النقض تقرر بالأغلبية، إلا إذا أعلنت تعذر الفصل (مسار غير صحيح أو ملف ناقص).
    if (benchOutcome !== 'not-ready') {
      benchOutcome = tally.favorable >= 2 ? 'favorable' : tally.unfavorable >= 2 ? 'unfavorable' : 'partial';
    }
  }

  // المخالفة تقاس على ما قررته الهيئة نفسها، قبل قيود بوابة التحقق.
  const benchVote: BenchVote | null = benchOutcome === 'not-ready' ? null : benchOutcome;
  const dissentingSeats = benchVote
    ? ruling.opinions.filter((opinion) => opinion.vote !== benchVote).map((opinion) => opinion.seatId)
    : [];

  // لا يكسب الموكل بسند مختلق ولا بدعوى غير محررة: الحد الأعلى «جزئي» حتى يعالجها الدفاع.
  if (findings.unsupportedCitations.length > 0) {
    downgradedReasons.push('مذكرة الدفاع تتضمن إحالات قانونية غير متحققة في الملف أو حزمة المصادر الرسمية.');
    curableDefects.unshift(`احذف أو صحح الإحالات غير المتحققة: ${findings.unsupportedCitations.slice(0, 6).join('، ')}`);
  }
  if (findings.claimLiberationIssues.length > 0) {
    downgradedReasons.push('لائحة الدعوى غير مكتملة التحرير (البيانات، الوقائع، المستندات، الطلبات).');
    curableDefects.unshift(`استكمل تحرير الدعوى: ${findings.claimLiberationIssues.slice(0, 4).join(' ')}`);
  }
  let outcome = benchOutcome;
  if (downgradedReasons.length > 0 && outcome === 'favorable') outcome = 'partial';

  // محكمة غير مختصة لا تفصل في الموضوع: لا جولات مراجعة، والحل نقل القضية للجهة المختصة.
  const jurisdictionIssues = findings.jurisdictionIssues || [];
  if (jurisdictionIssues.length > 0) {
    downgradedReasons.unshift('عدم الاختصاص النوعي: الملف من اختصاص جهة قضائية أخرى.');
    curableDefects.unshift(...jurisdictionIssues);
    if (outcome !== 'unfavorable') outcome = 'not-ready';
  }

  const finalRuling: BenchRuling = {
    ...ruling,
    finalJudgment: { ...ruling.finalJudgment, outcome },
    curableDefects: Array.from(new Set(curableDefects)).slice(0, 12),
  };

  return {
    ruling: finalRuling,
    decision: {
      outcome,
      nextStep: jurisdictionIssues.length > 0
        ? 'wrong-court'
        : decideNextStep(outcome, finalRuling.curableDefects, finalRuling.evidentiaryGaps, round),
      round,
      maxRounds: MAX_SESSION_ROUNDS,
      dissentingSeats,
      majority,
      downgradedReasons,
    },
  };
}

export function decideNextStep(
  outcome: RulingOutcome,
  curableDefects: string[],
  evidentiaryGaps: string[],
  round: number,
): SessionNextStep {
  if (outcome === 'favorable') return 'won';
  if (round >= MAX_SESSION_ROUNDS) return 'exhausted';
  if (curableDefects.length > 0) return 'revise';
  if (evidentiaryGaps.length > 0) return 'needs-client-input';
  return 'revise';
}
