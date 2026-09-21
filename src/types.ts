export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // base64 without data URI scheme
  previewUrl?: string;
  isImage: boolean;
}

export type JudgeCourtCategory = 'المحكمة الإدارية' | 'المحكمة الجزائية' | 'المحكمة العامة';

export interface CassationJudgeOpinion {
  judgeId: string;
  judgeName: string;
  judgeTitle: string;
  courtCategory: JudgeCourtCategory;
  verdict: 'مقبول شكلاً وموضوعاً' | 'مرفوض شكلاً' | 'معيب موضوعاً' | 'بحاجة لتصحيح جوهري' | 'خطر السقوط الشكلي';
  fatalFlaws: string[]; // مكامن الخلل القاتلة
  proceduralCritique: string; // الرقابة الإجرائية والمواعيد
  substantiveCritique: string; // رقابة تطبيق النظام والشريعة ومبادئ المحكمة العليا
  actionableRemedy: string; // التوجيه الحاسم لتصحيح الخلل
  scoreOutOf100: number | null;
}

export interface CassationAuditReport {
  documentType: 'مذكرة' | 'مرفوع' | 'لائحة' | 'اعتراض' | 'دعوى' | 'غير محدد';
  overallStatus: 'جاهز للإيداع' | 'معيب بحاجة لتصحيح' | 'خطر السقوط الشكلي';
  primaryFatalDefect: string; // الخلل الرئيسي الأبرز
  targetCourt?: 'الكل' | JudgeCourtCategory;
  judges: CassationJudgeOpinion[];
  judge1?: CassationJudgeOpinion;
  judge2?: CassationJudgeOpinion;
  synthesisAdvice: string; // الخلاصة الموحدة لتدارك البطلان
  timestamp: number;
}

export interface DetailedJudgeItem {
  judgeId: string;
  judgeName: string;
  judgeTitle: string;
  courtCategory: string;
  verdict: 'مقبول شكلاً وموضوعاً' | 'معيب موضوعاً' | 'مرفوض شكلاً' | 'بحاجة لتصحيح جوهري' | 'خطر السقوط الشكلي' | 'لم يكتمل الفحص الآلي';
  scoreOutOf100: number | null;
  errorsIdentified: string[];
  critique: string;
  specificAmendment: string;
}

export interface DetailedJudgesReviewReport {
  documentType: string;
  overallStatus: 'جاهز للإيداع' | 'معيب بحاجة لتصحيح' | 'خطر السقوط الشكلي' | 'بطلان محتمل' | 'تعذر إكمال الفحص الآلي';
  primaryFatalDefect: string;
  judges: DetailedJudgeItem[];
  cassationErrors: {
    title: string;
    items: string[];
    severity: 'عالية' | 'متوسطة' | 'منخفضة' | 'غير مقيمة';
  };
  claimErrors: {
    title: string;
    items: string[];
    severity: 'عالية' | 'متوسطة' | 'منخفضة' | 'غير مقيمة';
  };
  attachmentErrors: {
    title: string;
    items: string[];
    severity: 'عالية' | 'متوسطة' | 'منخفضة' | 'غير مقيمة';
    missingRequiredDocs: string[];
  };
  revisedDocument: string;
  changeLog: string[];
  synthesisAdvice: string;
  timestamp: number;
}

export type CourtType = 'المحكمة الإدارية' | 'محكمة الاستئناف الإدارية' | 'المحكمة الإدارية العليا' | 'المحكمة الجزائية' | 'المحكمة العامة' | 'المحكمة العليا';

export type CaseStageLevel = 
  | 'بداية المعاملة والتظلم الوجوبي (مادة 8)'
  | 'المحكمة الإدارية (الدرجة الأولى)'
  | 'محكمة الاستئناف الإدارية'
  | 'المحكمة الإدارية العليا (النقض)'
  | 'التماس إعادة النظر';

export type PleadingDocumentType = 
  | 'لائحة دعوى' 
  | 'مذكرة جوابية' 
  | 'لائحة اعتراضية استئنافية' 
  | 'صحيفة طعن بالنقض' 
  | 'التماس إعادة النظر' 
  | 'مذكرة دفوع شكلية وموضوعية';

export interface PartyDialogue {
  id: string;
  speaker: 'المدعي (صاحب الشأن)' | 'المدعى عليه (ممثل الجهة الحكومية)' | 'القاضي / ناظر القضية' | 'الوكيل الشرعي';
  statement: string;
  legalFlawIdentified?: string; // الخطأ القانوني المرصود في القول
  rebuttalArg?: string; // الرد الصاعق والحجة والبراهين
}

export interface CaseStageRecord {
  id: string;
  stageLevel: CaseStageLevel;
  courtName: CourtType | 'الجهة الإدارية (التظلم الإداري)';
  circuitNumber?: string; // الدائرة القضائية (مثلاً: الدائرة الإدارية الثالثة)
  caseNumber?: string; // رقم القضية في معين
  filingDate?: string;
  rulingDate?: string;
  rulingSummary?: string; // منطوق الحكم في هذه المرحلة
  rulingReasons?: string; // أسباب ومنطوق الحكم
  factsSummary?: string; // الوقائع
  rebuttalsAndExchanges?: string; // المناقشات والردود بين الأطراف
  status: 'مكتمل' | 'قيد النظر' | 'تم الطعن عليه' | 'محكوم نهائياً';
  deadlinesNote?: string; // ملاحظات الميعاد (مثلاً 30 يوماً للاستئناف أو النقض)
}

export interface JudgmentRecord {
  id: string;
  // Internal repository ownership metadata. Returned only to administrators when
  // they inspect cross-user records; normal users never receive it.
  storageOwnerId?: string;
  // 1. هوية الشخص وبيانات الدعوى
  personName: string;
  nationalId: string; // رقم الهوية الوطنية / الإقامة
  agencyName: string; // اسم الجهة الحكومية المدعى عليها
  courtType: CourtType;
  circuitName: string; // الدائرة القضائية
  caseNumber: string; // رقم القضية
  judgmentNumber: string; // رقم صك الحكم
  judgmentDate: string; // تاريخ صدور الحكم (هجري/ميلادي)

  // 2. تفاصيل الحكم والوقائع والردود
  judgmentType: 'غير محدد' | 'إلغاء قرار إداري' | 'تعويض مالي وبدلات' | 'تسوية وظيفية' | 'تأديبي' | 'عقود إدارية' | 'رفض الدعوى' | 'عدم قبول شكلاً' | 'أخرى';
  facts: string; // وقائع القضية
  rulingReasons: string; // مسببات الحكم وحيثياته
  rulingOperative: string; // منطوق الحكم الحاسم
  dialoguesAndExchanges: PartyDialogue[]; // الردود بين الشخص وممثل الجهة والقاضي

  // 3. الأوامر والتعليمات والمواد النظامية وأدوات الترافع
  applicableRegulations: string[]; // الأنظمة والمواد المستند عليها (نظام ديوان المظالم، نظام المرافعات، نظام الخدمة المدنية ولائحته التنفيذية، الأوامر الملكية والسامية)
  courtPrecedents: string[]; // السوابق القضائية ومبادئ المحكمة العليا المقيدة
  fatalFlawsFound: string[]; // جميع الأخطاء المرصودة (إجرائية، عيب سبب، انحراف بالسلطة، مخالفة الأنظمة)
  strongestRebuttals: string[]; // أقوى الحجج والبراهين والردود لإظهار تمكن الوكيل أمام الدائرة

  // 4. تسلسل مسار المعاملة عبر المحاكم
  caseChronology: CaseStageRecord[];

  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
  charCount?: number;
  attachments?: Attachment[];
  cassationAudit?: CassationAuditReport;
  associatedJudgmentId?: string;
}

export type LegalCategory =
  | 'فحص المواعيد (مادة 8)'
  | 'سوابق وبدلات الحاسب'
  | 'دعاوى الإلغاء وعيوب القرار'
  | 'تحليل صكوك الأحكام'
  | 'صياغة المذكرات والدفوع';

export interface PromptTemplate {
  id: string;
  title: string;
  category: LegalCategory;
  description: string;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
}

export interface ChatSettings {
  systemInstruction: string;
  temperature: number;
  maxCharacters: number;
  enhanceStyle: 'legal' | 'procedural' | 'substantive' | 'defense';
}

export interface Article8CalculationResult {
  grievanceDeadline: string; // 60 days from notification
  decisionAgencyDeadline: string; // 60 days for agency to respond
  courtFilingDeadline: string; // 60 days to file at Board of Grievances
  isWithinGrievanceWindow: boolean;
  statusSummary: string;
  notes: string[];
}

export interface UserSession {
  id: string;
  name: string;
  personName?: string;
  email: string;
  nationalId: string;
  role: 'admin' | 'user';
  militaryNumber?: string;
  agency?: string;
  loginMethod: 'admin_password' | 'email_password' | 'email_otp';
  token?: string;
  loginAt: number;
}
