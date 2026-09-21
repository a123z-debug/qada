import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  Database,
  FileCheck2,
  FileSearch,
  ExternalLink,
  FileText,
  Gavel,
  Gauge,
  GitBranch,
  Landmark,
  Layers3,
  LockKeyhole,
  RotateCcw,
  Scale,
  ScanSearch,
  Search,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Workflow,
  XCircle,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
} from 'lucide-react';

type AgentStatus = 'linked' | 'planned' | 'warning' | 'error' | 'running' | 'completed';
type AgentTone = 'cyan' | 'amber' | 'emerald' | 'violet' | 'slate' | 'rose';

type AgentNode = {
  id: string;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: AgentStatus;
  tone: AgentTone;
  icon: LucideIcon;
  adminOnly?: boolean;
  detail: string;
};

type Edge = {
  from: string;
  to: string;
  kind?: 'normal' | 'admin' | 'verification';
};

type RuntimeAgentRun = {
  id: string;
  label: string;
  status: 'success' | 'warning' | 'error';
  durationMs: number;
  model?: string;
  summary: string;
  blockers?: string[];
};

type RuntimeSourcePacket = {
  agentId: string;
  label: string;
  status: 'success' | 'warning' | 'error';
  scope: string;
  references: Array<{
    name: string;
    sourceUrl: string;
    issueInstrument?: string;
  }>;
  blockers: string[];
};

type PlatformHealth = {
  ready?: boolean;
  status?: 'ready' | 'degraded';
  services?: {
    authConfigured?: boolean;
    dataConfigured?: boolean;
    adminConfigured?: boolean;
    aiConfigured?: boolean;
    geminiConfigured?: boolean;
    gatewayConfigured?: boolean;
    redisConfigured?: boolean;
    redisReachable?: boolean;
  };
  legalCorpus?: {
    officialSystems?: number;
    officialRegulations?: number;
    officialAmendments?: number;
  };
  build?: {
    commit?: string;
    environment?: string;
  };
  checkedAt?: string;
};

type RuntimeSnapshot = {
  runId?: string;
  documentTitle?: string;
  analyzedAt?: string;
  agentRuns?: RuntimeAgentRun[];
  sourcePackets?: RuntimeSourcePacket[];
  meta?: {
    completedAgents?: number;
    warningAgents?: number;
    failedAgents?: number;
    architecture?: string;
  };
};

const CANVAS_WIDTH = 1600;
const CANVAS_HEIGHT = 1080;

const nodes: AgentNode[] = [
  { id: 'auth', title: 'المصادقة والحساب', subtitle: 'دخول وصلاحيات', x: 45, y: 42, width: 180, height: 74, status: 'linked', tone: 'cyan', icon: ShieldCheck, detail: 'بوابة الدخول والجلسات وتحديد صلاحية المستخدم أو المشرف.' },
  { id: 'search', title: 'البحث القانوني', subtitle: 'استرجاع وبحث', x: 265, y: 42, width: 180, height: 74, status: 'linked', tone: 'cyan', icon: Search, detail: 'مسار البحث في الأنظمة والمراجع وربط السؤال بالمصادر المتاحة.' },
  { id: 'laws', title: 'الأنظمة والتشريعات', subtitle: 'نصوص ومراجع', x: 485, y: 42, width: 180, height: 74, status: 'linked', tone: 'cyan', icon: BookOpenCheck, detail: 'طبقة النصوص النظامية والمراجع الرسمية المفهرسة داخل المنصة.' },
  { id: 'judgments', title: 'الأحكام والقرارات', subtitle: 'تحليل ومستودع', x: 705, y: 42, width: 180, height: 74, status: 'linked', tone: 'cyan', icon: Gavel, detail: 'إدارة الأحكام والسوابق وتحليل الحكم والقرارات المرتبطة بالقضية.' },
  { id: 'references', title: 'المراجع والمصادر', subtitle: 'توثيق رسمي', x: 925, y: 42, width: 180, height: 74, status: 'linked', tone: 'cyan', icon: Database, detail: 'المصادر الرسمية التي يعتمد عليها محرك الاسترجاع والتحقق.' },
  { id: 'cases', title: 'القضايا والملفات', subtitle: 'ملف القضية', x: 1145, y: 42, width: 180, height: 74, status: 'linked', tone: 'amber', icon: Layers3, detail: 'مستودع ملف القضية والمرفقات والتسلسل الزمني والمواد المرتبطة.' },
  { id: 'advisor', title: 'المستشار القضائي', subtitle: 'واجهة الذكاء', x: 1365, y: 42, width: 190, height: 74, status: 'linked', tone: 'emerald', icon: Bot, detail: 'واجهة المحادثة الحالية وربط الأسئلة بالمحرك والمراجع.' },

  { id: 'document-reader', title: 'قارئ المستندات', subtitle: 'PDF / صور / نص', x: 55, y: 220, width: 210, height: 80, status: 'linked', tone: 'amber', icon: FileSearch, detail: 'يستقبل الحكم أو المذكرة أو المرفق ويجهز المحتوى للتحليل.' },
  { id: 'case-router', title: 'موجّه القضية', subtitle: 'تحديد المسار', x: 310, y: 220, width: 210, height: 80, status: 'linked', tone: 'cyan', icon: GitBranch, detail: 'يحدد الاختصاص ونوع المستند والوكلاء المطلوب تشغيلهم لكل قضية.' },

  { id: 'src-bog', title: 'ديوان المظالم', subtitle: 'النظام والمرافعات', x: 365, y: 345, width: 190, height: 68, status: 'linked', tone: 'amber', icon: Landmark, detail: 'وكيل مرجعي لمنظومة ديوان المظالم ونظام المرافعات والتنفيذ واللوائح.' },
  { id: 'src-personnel', title: 'نظام خدمة الأفراد', subtitle: 'حقوق عسكرية', x: 365, y: 430, width: 190, height: 68, status: 'warning', tone: 'amber', icon: BadgeCheck, detail: 'وكيل متخصص بنظام خدمة الأفراد ولوائحه وتعديلاته وحقوق العسكريين.' },
  { id: 'src-royal', title: 'الأوامر والمراسيم', subtitle: 'ملكية وسامية', x: 365, y: 515, width: 190, height: 68, status: 'linked', tone: 'amber', icon: FileText, detail: 'وكيل يجمع الأوامر والمراسيم والقرارات الرسمية ذات الصلة ويحدد أثرها.' },
  { id: 'src-precedents', title: 'المبادئ والأحكام', subtitle: 'سوابق قضائية', x: 365, y: 600, width: 190, height: 68, status: 'warning', tone: 'amber', icon: Scale, detail: 'وكيل لاستخراج المبادئ والأحكام ذات الصلة مع الفصل بين النص النظامي والاجتهاد القضائي.' },

  { id: 'qada-core', title: 'QADA AI', subtitle: 'محرك التحليل القضائي', x: 690, y: 380, width: 220, height: 118, status: 'linked', tone: 'cyan', icon: Sparkles, detail: 'نواة التوجيه والتحليل التي تستقبل مدخلات القضية وتوزعها على الوكلاء المختصين.' },

  { id: 'facts', title: 'محلل الوقائع', subtitle: 'وقائع وتسلسل زمني', x: 980, y: 220, width: 190, height: 68, status: 'linked', tone: 'emerald', icon: FileText, detail: 'يفصل الوقائع عن الادعاءات ويستخرج التسلسل الزمني من مخرجات قارئ المستند؛ تظهر حالته الفعلية في كل تشغيل.' },
  { id: 'jurisdiction', title: 'محلل الاختصاص', subtitle: 'نوع المحكمة والمسار', x: 1190, y: 220, width: 190, height: 68, status: 'linked', tone: 'emerald', icon: Landmark, detail: 'يفحص الاختصاص والمسار الإجرائي ضمن مسار الإجراءات ويظهر النقص في الوقائع اللازمة قبل الجزم.' },
  { id: 'characterization', title: 'محلل التكييف', subtitle: 'الوصف النظامي', x: 980, y: 310, width: 190, height: 68, status: 'linked', tone: 'emerald', icon: Scale, detail: 'يفحص التكييف النظامي للوقائع والطلبات من مسار التكييف والتسبيب دون افتراض نتيجة مسبقة.' },
  { id: 'evidence', title: 'محلل الإثبات', subtitle: 'الأدلة والعبء', x: 1190, y: 310, width: 190, height: 68, status: 'linked', tone: 'emerald', icon: FileCheck2, detail: 'يربط الوقائع بالأدلة ويكشف فجوات الإثبات والمرفقات الناقصة ضمن مسار إثبات مستقل.' },
  { id: 'reasoning', title: 'محلل التسبيب', subtitle: 'منطق الحكم', x: 980, y: 400, width: 190, height: 68, status: 'linked', tone: 'emerald', icon: Workflow, detail: 'يفحص ترابط الأسباب والمنطوق والطلبات ويرفع نقاط التعارض إلى المراجع النهائي.' },
  { id: 'procedure', title: 'محلل الإجراءات', subtitle: 'مواعيد وشكل', x: 1190, y: 400, width: 190, height: 68, status: 'linked', tone: 'emerald', icon: Gauge, detail: 'يفحص المواعيد والإجراءات والمتطلبات الشكلية مع إظهار البيانات الناقصة التي تمنع النتيجة القطعية.' },

  { id: 'official-source', title: 'مدقق المصدر الرسمي', subtitle: 'مصدر وهوية النص', x: 980, y: 515, width: 190, height: 68, status: 'linked', tone: 'amber', icon: SearchCheck, detail: 'يتحقق أن المرجع المستخدم صادر من مصدر رسمي محدد وقابل للتتبع.' },
  { id: 'exact-text', title: 'مدقق النص الحرفي', subtitle: 'كل حرف ورقم', x: 1190, y: 515, width: 190, height: 68, status: 'warning', tone: 'amber', icon: ScanSearch, detail: 'يطابق النص الحرفي للمادة أو الحكم ويمنع الاقتباس التقريبي.' },
  { id: 'amendments', title: 'مدقق السريان', subtitle: 'تعديل / إلغاء / نسخ', x: 980, y: 600, width: 190, height: 68, status: 'linked', tone: 'amber', icon: Activity, detail: 'يتحقق من النسخة السارية والتعديل والإلغاء والنفاذ الزمني للنص.' },
  { id: 'conflicts', title: 'كاشف التعارض', subtitle: 'تناقض النصوص والنتائج', x: 1190, y: 600, width: 190, height: 68, status: 'linked', tone: 'amber', icon: AlertTriangle, detail: 'يجمع نقاط التعارض الخارجة من مسارات الإثبات والتسبيب والدفوع ويعرضها كتحذير قابل للتتبع.' },

  { id: 'final-review', title: 'المراجع النهائي', subtitle: 'بوابة تحقق داخلية', x: 1410, y: 365, width: 165, height: 90, status: 'linked', tone: 'violet', icon: CheckCircle2, detail: 'بوابة داخلية تجمع النتائج وتمنع إخفاء فشل الوكلاء أو قيود المصادر قبل إخراج التقرير.' },
  { id: 'drafting', title: 'مختبر الصياغة', subtitle: 'دعوى / مذكرة / اعتراض', x: 1410, y: 485, width: 165, height: 90, status: 'linked', tone: 'cyan', icon: FileText, detail: 'يحوّل التحليل الموثق إلى مسودة قانونية منظمة، ويربط الصياغة ببوابة التحقق المرجعي قبل اعتماد أي إحالة.' },
  { id: 'final-output', title: 'المخرجات النهائية', subtitle: 'تقرير / مسودة / خطة عمل', x: 1410, y: 595, width: 165, height: 78, status: 'linked', tone: 'amber', icon: FileCheck2, detail: 'يجمع التقرير التحليلي والمسودة المنقحة وروابط المصادر وقائمة التحقق المطلوبة للمراجعة البشرية.' },

  { id: 'editor-tool', title: 'Editor', subtitle: 'إدارة وصياغة المواد', x: 610, y: 692, width: 155, height: 58, status: 'linked', tone: 'cyan', icon: FileText, detail: 'واجهة تحرير المذكرات والمسودات ومراجعة النص قبل إدخاله إلى مسارات التحليل.' },
  { id: 'execution-tool', title: 'Execution', subtitle: 'مراقبة سير التشغيل', x: 785, y: 692, width: 155, height: 58, status: 'linked', tone: 'cyan', icon: Activity, detail: 'يعرض حالة تشغيل الوكلاء الفعلية، الأزمنة، التحذيرات، الأخطاء ومسار التنفيذ.' },
  { id: 'evaluation-tool', title: 'Evaluation', subtitle: 'اختبار وتحقق', x: 960, y: 692, width: 155, height: 58, status: 'linked', tone: 'emerald', icon: CheckCircle2, detail: 'طبقة التقييم والاختبارات الآلية التي تمنع اعتماد نسخة لا تجتاز فحوص المصادر والأمان والبناء.' },
  { id: 'agents-tool', title: 'Agents', subtitle: 'إدارة الوكلاء', x: 1135, y: 692, width: 155, height: 58, status: 'linked', tone: 'amber', icon: Layers3, detail: 'فهرس الوكلاء والمسارات المرتبطة بالخريطة التشغيلية وحالة كل وكيل.' },

  { id: 'admin-entry', title: 'غرفة التحليل للأدمن', subtitle: 'مدخل خاص ومقيد', x: 85, y: 840, width: 240, height: 82, status: 'linked', tone: 'violet', icon: LockKeyhole, adminOnly: true, detail: 'مدخل منفصل للمشرف لتحليل حكم أو مذكرة بشكل أعمق من واجهة المستخدم العامة.' },
  { id: 'judgment-audit', title: 'إيجنت تحليل الأحكام', subtitle: 'الحكم كاملاً', x: 380, y: 815, width: 205, height: 74, status: 'linked', tone: 'violet', icon: Gavel, adminOnly: true, detail: 'مسار فعلي لتحليل الأحكام يوزع الحكم على الفحص التشريعي والقضائي والإجرائي والإثباتي والتسبيب والدفوع.' },
  { id: 'memo-audit', title: 'إيجنت تحليل المذكرات', subtitle: 'دعوى ودفاع', x: 380, y: 910, width: 205, height: 74, status: 'linked', tone: 'violet', icon: FileSearch, adminOnly: true, detail: 'مسار فعلي للمذكرات واللوائح والدفاع يوزع المستند على الوكلاء التخصصيين ثم بوابة التحقق.' },
  { id: 'legislative-flaws', title: 'كشف العيوب التشريعية', subtitle: 'نص وسريان', x: 660, y: 800, width: 205, height: 68, status: 'linked', tone: 'rose', icon: AlertTriangle, adminOnly: true, detail: 'يكشف مخالفة النصوص أو تطبيق نص غير ساري أو إغفال النص الواجب التطبيق.' },
  { id: 'judicial-flaws', title: 'كشف العيوب القضائية', subtitle: 'مبادئ وتسبيب', x: 660, y: 885, width: 205, height: 68, status: 'linked', tone: 'rose', icon: Scale, adminOnly: true, detail: 'يفحص مخالفة المبادئ والتناقض مع السوابق ذات الصلة دون تحويل السابقة إلى نص ملزم تلقائياً.' },
  { id: 'procedural-flaws', title: 'كشف العيوب الإجرائية', subtitle: 'شكل ومواعيد', x: 660, y: 970, width: 205, height: 68, status: 'linked', tone: 'rose', icon: XCircle, adminOnly: true, detail: 'يفحص الاختصاص والمواعيد والإجراءات والإعلانات والدفوع الشكلية.' },
  { id: 'evidence-flaws', title: 'فحص الإثبات', subtitle: 'فجوات وتناقضات', x: 930, y: 800, width: 205, height: 68, status: 'linked', tone: 'rose', icon: FileCheck2, adminOnly: true, detail: 'يكشف الوقائع غير المسندة والدليل غير المنتج والتناقض بين المستندات.' },
  { id: 'reasoning-flaws', title: 'فحص التكييف والتسبيب', subtitle: 'سبب ومنطوق', x: 930, y: 885, width: 205, height: 68, status: 'linked', tone: 'rose', icon: Workflow, adminOnly: true, detail: 'يفحص صحة التكييف وارتباط الأسباب بالمنطوق وأي قفزة منطقية في الحكم.' },
  { id: 'rebuttal-review', title: 'مراجعة الدفوع والردود', subtitle: 'نقاط القوة والقصور', x: 930, y: 970, width: 205, height: 68, status: 'linked', tone: 'violet', icon: Scale, adminOnly: true, detail: 'يرتب نقاط الاعتراض والردود الممكنة ويبين سند كل نقطة وحدودها.' },
  { id: 'admin-final', title: 'التقرير التحليلي للأدمن', subtitle: 'نتيجة داخلية غير عامة', x: 1245, y: 870, width: 270, height: 110, status: 'linked', tone: 'violet', icon: FileCheck2, adminOnly: true, detail: 'يجمع العيوب والمراجع والأثر المحتمل وما يحتاج إلى تحقق بشري في تقرير واحد خاص بالأدمن.' },
];

const edges: Edge[] = [
  { from: 'auth', to: 'qada-core' },
  { from: 'search', to: 'qada-core' },
  { from: 'laws', to: 'src-bog' },
  { from: 'judgments', to: 'qada-core' },
  { from: 'references', to: 'official-source' },
  { from: 'cases', to: 'case-router' },
  { from: 'advisor', to: 'qada-core' },
  { from: 'document-reader', to: 'case-router' },
  { from: 'case-router', to: 'qada-core' },
  { from: 'src-bog', to: 'qada-core' },
  { from: 'src-personnel', to: 'qada-core' },
  { from: 'src-royal', to: 'qada-core' },
  { from: 'src-precedents', to: 'qada-core' },
  { from: 'qada-core', to: 'facts' },
  { from: 'qada-core', to: 'jurisdiction' },
  { from: 'qada-core', to: 'characterization' },
  { from: 'qada-core', to: 'evidence' },
  { from: 'qada-core', to: 'reasoning' },
  { from: 'qada-core', to: 'procedure' },
  { from: 'facts', to: 'official-source', kind: 'verification' },
  { from: 'jurisdiction', to: 'official-source', kind: 'verification' },
  { from: 'characterization', to: 'exact-text', kind: 'verification' },
  { from: 'evidence', to: 'conflicts', kind: 'verification' },
  { from: 'reasoning', to: 'exact-text', kind: 'verification' },
  { from: 'procedure', to: 'amendments', kind: 'verification' },
  { from: 'official-source', to: 'final-review', kind: 'verification' },
  { from: 'exact-text', to: 'final-review', kind: 'verification' },
  { from: 'amendments', to: 'final-review', kind: 'verification' },
  { from: 'conflicts', to: 'final-review', kind: 'verification' },
  { from: 'final-review', to: 'drafting' },
  { from: 'drafting', to: 'final-output' },
  { from: 'qada-core', to: 'editor-tool' },
  { from: 'qada-core', to: 'execution-tool' },
  { from: 'qada-core', to: 'evaluation-tool' },
  { from: 'qada-core', to: 'agents-tool' },

  { from: 'admin-entry', to: 'judgment-audit', kind: 'admin' },
  { from: 'admin-entry', to: 'memo-audit', kind: 'admin' },
  { from: 'judgment-audit', to: 'legislative-flaws', kind: 'admin' },
  { from: 'judgment-audit', to: 'judicial-flaws', kind: 'admin' },
  { from: 'judgment-audit', to: 'procedural-flaws', kind: 'admin' },
  { from: 'judgment-audit', to: 'evidence-flaws', kind: 'admin' },
  { from: 'judgment-audit', to: 'reasoning-flaws', kind: 'admin' },
  { from: 'judgment-audit', to: 'rebuttal-review', kind: 'admin' },
  { from: 'memo-audit', to: 'legislative-flaws', kind: 'admin' },
  { from: 'memo-audit', to: 'judicial-flaws', kind: 'admin' },
  { from: 'memo-audit', to: 'procedural-flaws', kind: 'admin' },
  { from: 'memo-audit', to: 'evidence-flaws', kind: 'admin' },
  { from: 'memo-audit', to: 'reasoning-flaws', kind: 'admin' },
  { from: 'memo-audit', to: 'rebuttal-review', kind: 'admin' },
  { from: 'legislative-flaws', to: 'admin-final', kind: 'admin' },
  { from: 'judicial-flaws', to: 'admin-final', kind: 'admin' },
  { from: 'procedural-flaws', to: 'admin-final', kind: 'admin' },
  { from: 'evidence-flaws', to: 'admin-final', kind: 'admin' },
  { from: 'reasoning-flaws', to: 'admin-final', kind: 'admin' },
  { from: 'rebuttal-review', to: 'admin-final', kind: 'admin' },
];

const statusMeta: Record<AgentStatus, { label: string; dot: string; text: string }> = {
  linked: { label: 'متصل حالياً', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  planned: { label: 'قيد الربط', dot: 'bg-slate-500', text: 'text-slate-400' },
  warning: { label: 'يحتاج مراجعة', dot: 'bg-amber-400', text: 'text-amber-300' },
  error: { label: 'خطأ', dot: 'bg-rose-500', text: 'text-rose-300' },
  running: { label: 'يعمل الآن', dot: 'bg-cyan-400', text: 'text-cyan-300' },
  completed: { label: 'آخر تشغيل مكتمل', dot: 'bg-emerald-300', text: 'text-emerald-200' },
};

function toneClass(tone: AgentTone) {
  if (tone === 'amber') return 'border-amber-400/40 bg-amber-500/10 hover:border-amber-300/70';
  if (tone === 'emerald') return 'border-emerald-400/35 bg-emerald-500/10 hover:border-emerald-300/70';
  if (tone === 'violet') return 'border-violet-400/40 bg-violet-500/10 hover:border-violet-300/70';
  if (tone === 'rose') return 'border-rose-400/35 bg-rose-500/10 hover:border-rose-300/70';
  if (tone === 'slate') return 'border-slate-500/40 bg-slate-800/70 hover:border-slate-400/70';
  return 'border-cyan-400/35 bg-cyan-500/10 hover:border-cyan-300/70';
}

function edgePath(from: AgentNode, to: AgentNode) {
  const sx = from.x + from.width;
  const sy = from.y + from.height / 2;
  const tx = to.x;
  const ty = to.y + to.height / 2;
  const mx = sx + (tx - sx) * 0.5;
  return 'M ' + sx + ' ' + sy + ' C ' + mx + ' ' + sy + ', ' + mx + ' ' + ty + ', ' + tx + ' ' + ty;
}

export function AdminAgentMap({ onOpenAnalysisRoom }: { onOpenAnalysisRoom?: () => void }) {
  const [zoom, setZoom] = useState(0.82);
  const [filter, setFilter] = useState<'all' | 'admin' | 'linked' | 'planned' | 'last-run'>('all');
  const [selectedId, setSelectedId] = useState('qada-core');
  const [runtime, setRuntime] = useState<RuntimeSnapshot | null>(null);
  const [history, setHistory] = useState<RuntimeSnapshot[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [health, setHealth] = useState<PlatformHealth | null>(null);
  const [healthError, setHealthError] = useState('');

  const selected = nodes.find((node) => node.id === selectedId) || nodes[0];

  useEffect(() => {
    let cancelled = false;
    setHistoryError('');

    fetch('/api/admin-runs', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || 'تعذر تحميل سجل التشغيل.');
        return Array.isArray(payload?.runs) ? payload.runs as RuntimeSnapshot[] : [];
      })
      .then((runs) => {
        if (cancelled) return;
        const safeRuns = runs.filter((item) => item && Array.isArray(item.agentRuns)).slice(0, 20);
        setHistory(safeRuns);
        setRuntime(safeRuns[0] || null);
      })
      .catch((error) => {
        if (!cancelled) setHistoryError(error instanceof Error ? error.message : 'تعذر تحميل سجل التشغيل.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadHealth = async () => {
      try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        setHealth(payload as PlatformHealth);
        setHealthError(response.ok ? '' : 'فحص الجاهزية أفاد بأن بعض الخدمات غير جاهزة.');
      } catch (error) {
        if (!cancelled) {
          setHealth(null);
          setHealthError(error instanceof Error ? error.message : 'تعذر فحص جاهزية المنصة.');
        }
      }
    };

    void loadHealth();
    const timer = window.setInterval(() => void loadHealth(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const runtimeById = useMemo(() => {
    const map = new Map<string, RuntimeAgentRun>();
    for (const run of runtime?.agentRuns || []) map.set(run.id, run);
    return map;
  }, [runtime]);

  const sourcePacketById = useMemo(() => {
    const map = new Map<string, RuntimeSourcePacket>();
    for (const packet of runtime?.sourcePackets || []) map.set(packet.agentId, packet);
    return map;
  }, [runtime]);

  const infrastructureStatus = (node: AgentNode): AgentStatus => {
    if (!health?.services) return node.status;
    const services = health.services;

    if (node.id === 'auth') {
      return services.authConfigured && services.adminConfigured ? 'linked' : 'error';
    }
    if (['advisor', 'qada-core', 'document-reader'].includes(node.id)) {
      return services.geminiConfigured ? 'linked' : services.aiConfigured ? 'warning' : 'error';
    }
    if (['cases', 'admin-entry'].includes(node.id)) {
      return services.redisReachable && services.dataConfigured ? 'linked' : 'error';
    }
    if (['search', 'laws', 'references', 'official-source'].includes(node.id)) {
      return (health.legalCorpus?.officialSystems || 0) > 0 ? node.status === 'planned' ? 'warning' : 'linked' : 'warning';
    }
    return node.status;
  };

  const visibleIds = useMemo(() => {
    if (filter === 'all') return new Set(nodes.map((node) => node.id));
    if (filter === 'admin') return new Set(nodes.filter((node) => node.adminOnly).map((node) => node.id));
    if (filter === 'last-run') return new Set((runtime?.agentRuns || []).map((run) => run.id));
    return new Set(nodes.filter((node) => node.status === filter).map((node) => node.id));
  }, [filter, runtime]);

  const counts = useMemo(() => {
    return {
      total: nodes.length,
      linked: nodes.filter((node) => infrastructureStatus(node) === 'linked').length,
      planned: nodes.filter((node) => infrastructureStatus(node) === 'planned').length,
      admin: nodes.filter((node) => node.adminOnly).length,
      infrastructureErrors: nodes.filter((node) => infrastructureStatus(node) === 'error').length,
    };
  }, [health]);

  return (
    <section className="space-y-4" dir="rtl">
      <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-l from-violet-500/10 via-slate-950/90 to-cyan-500/10 p-4 sm:p-5">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-[11px] font-black text-violet-200">
              <LockKeyhole className="h-3.5 w-3.5" />
              للأدمن فقط
            </div>
            <h2 className="mt-3 text-xl sm:text-2xl font-black text-white">خريطة الوكلاء وغرفة العمليات</h2>
            <p className="mt-1 max-w-3xl text-xs sm:text-sm leading-6 text-slate-400">
              هذه الصفحة هي البنية التنفيذية للخريطة المعتمدة. الأخضر يعني أن المسار موجود حالياً في المنصة، والرمادي يعني أن الوكيل مرسوم وجاهز للربط في المراحل التالية. عند ربط التتبع الحي ستظهر هنا حالات التشغيل والأخطاء لكل وكيل.
            </p>
          </div>

          <div className="min-w-0">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <SummaryCard label="إجمالي العقد" value={counts.total} />
              <SummaryCard label="متصل" value={counts.linked} tone="emerald" />
              <SummaryCard label="قيد الربط" value={counts.planned} tone="slate" />
              <SummaryCard label={counts.infrastructureErrors ? 'أخطاء بنية' : 'غرفة الأدمن'} value={counts.infrastructureErrors || counts.admin} tone={counts.infrastructureErrors ? 'slate' : 'violet'} />
            </div>
            {historyError && (
              <div className="mt-2 rounded-xl border border-amber-400/20 bg-amber-500/5 px-3 py-2 text-[10px] font-bold text-amber-200">
                تعذر تحميل سجل التشغيل المركزي: {historyError}
              </div>
            )}
            <div className={
              'mt-2 rounded-xl border px-3 py-2 text-[10px] ' +
              (health?.ready
                ? 'border-emerald-400/20 bg-emerald-500/5 text-emerald-100/80'
                : 'border-amber-400/20 bg-amber-500/5 text-amber-100/80')
            }>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-black">{health?.ready ? 'البنية الخادمية جاهزة' : 'حالة البنية تحتاج انتباهاً'}</span>
                {health?.build?.commit && <span className="font-mono text-[9px] text-slate-600">{health.build.commit.slice(0, 10)}</span>}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[9px]">
                <span>Auth: {health?.services?.authConfigured ? '✓' : '✕'}</span>
                <span>Data: {health?.services?.dataConfigured ? '✓' : '✕'}</span>
                <span>Gemini: {health?.services?.geminiConfigured ? '✓' : '✕'}</span>
                <span>Redis: {health?.services?.redisReachable ? '✓' : '✕'}</span>
                <span>أنظمة رسمية: {health?.legalCorpus?.officialSystems ?? 0}</span>
              </div>
              {healthError && <div className="mt-1 font-bold text-amber-200">{healthError}</div>}
            </div>
            {runtime && (
              <div className="mt-2 rounded-xl border border-emerald-400/15 bg-emerald-500/5 px-3 py-2 text-[10px] text-slate-400">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    التشغيل المعروض: <span className="font-bold text-slate-200">{runtime.documentTitle || 'تحليل قضائي'}</span>
                    {runtime.analyzedAt && <span> • {new Date(runtime.analyzedAt).toLocaleString('ar-SA')}</span>}
                    <span> • مكتمل {runtime.meta?.completedAgents ?? runtime.agentRuns?.filter((run) => run.status === 'success').length ?? 0}</span>
                    <span> • تحذير {runtime.meta?.warningAgents ?? runtime.agentRuns?.filter((run) => run.status === 'warning').length ?? 0}</span>
                    <span> • متعثر {runtime.meta?.failedAgents ?? runtime.agentRuns?.filter((run) => run.status === 'error').length ?? 0}</span>
                  </div>
                  {history.length > 1 && (
                    <select
                      value={runtime.runId || ''}
                      onChange={(event) => {
                        const selectedRun = history.find((item) => item.runId === event.target.value);
                        if (selectedRun) {
                          setRuntime(selectedRun);
                          setFilter('last-run');
                          setSelectedId('qada-core');
                        }
                      }}
                      className="max-w-[260px] rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-[10px] font-bold text-slate-300 outline-none focus:border-cyan-400/50"
                    >
                      {history.map((item, index) => (
                        <option key={item.runId || index} value={item.runId || ''}>
                          {item.documentTitle || 'تحليل قضائي'} — {item.analyzedAt ? new Date(item.analyzedAt).toLocaleString('ar-SA') : 'بدون تاريخ'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-950/90 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 bg-slate-900/70 px-3 py-2.5">
            <div className="flex flex-wrap gap-1.5">
              <FilterButton active={filter === 'all'} onClick={() => setFilter('all')}>الكل</FilterButton>
              <FilterButton active={filter === 'admin'} onClick={() => setFilter('admin')}>غرفة الأدمن</FilterButton>
              <FilterButton active={filter === 'linked'} onClick={() => setFilter('linked')}>المتصل حالياً</FilterButton>
              <FilterButton active={filter === 'planned'} onClick={() => setFilter('planned')}>قيد الربط</FilterButton>
              <FilterButton active={filter === 'last-run'} onClick={() => setFilter('last-run')}>آخر تشغيل فعلي</FilterButton>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setZoom((value) => Math.min(1.15, Number((value + 0.08).toFixed(2))))} className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white" title="تكبير">
                <ZoomIn className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setZoom((value) => Math.max(0.58, Number((value - 0.08).toFixed(2))))} className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white" title="تصغير">
                <ZoomOut className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => { setZoom(0.82); setFilter('all'); setSelectedId('qada-core'); }} className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white" title="إعادة الضبط">
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="relative overflow-auto custom-scrollbar bg-[#020817] min-h-[640px]">
            <div
              className="relative origin-top-right transition-transform duration-200"
              style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT, transform: 'scale(' + zoom + ')' }}
            >
              <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(56,189,248,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.05) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

              <div className="absolute left-[26px] top-[20px] rounded-xl border border-cyan-400/15 bg-slate-950/80 px-3 py-2 text-[11px] font-bold text-cyan-200">
                منصة QADA العامة
              </div>
              <div className="absolute left-[45px] top-[175px] rounded-lg border border-amber-400/15 bg-amber-500/5 px-2.5 py-1.5 text-[10px] font-black text-amber-200">
                مختبر البيانات والأدلة
              </div>
              <div className="absolute left-[650px] top-[320px] rounded-lg border border-cyan-400/15 bg-cyan-500/5 px-2.5 py-1.5 text-[10px] font-black text-cyan-200">
                محرك التحليل القضائي الذكي
              </div>
              <div className="absolute left-[1395px] top-[455px] rounded-lg border border-cyan-400/15 bg-cyan-500/5 px-2.5 py-1.5 text-[10px] font-black text-cyan-200">
                الصياغة والمخرجات
              </div>
              <div className="absolute left-[610px] top-[660px] rounded-lg border border-slate-700 bg-slate-950/85 px-2.5 py-1.5 text-[10px] font-black text-slate-300">
                بيئة التشغيل والتحكم
              </div>
              <div className="absolute left-[26px] top-[785px] rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-[11px] font-black text-violet-200">
                غرفة التحليل الخاصة بالأدمن
              </div>
              <div className="absolute left-[26px] right-[26px] top-[780px] h-px bg-gradient-to-l from-transparent via-violet-400/50 to-transparent" />

              <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox={'0 0 ' + CANVAS_WIDTH + ' ' + CANVAS_HEIGHT} aria-hidden="true">
                <defs>
                  <filter id="qadaGlow">
                    <feGaussianBlur stdDeviation="2.4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {edges.map((edge, index) => {
                  const from = nodes.find((node) => node.id === edge.from);
                  const to = nodes.find((node) => node.id === edge.to);
                  if (!from || !to) return null;
                  const visible = visibleIds.has(from.id) && visibleIds.has(to.id);
                  const stroke = edge.kind === 'admin' ? '#a78bfa' : edge.kind === 'verification' ? '#fbbf24' : '#38bdf8';
                  const activeRuntimeEdge = runtimeById.has(from.id) && runtimeById.has(to.id);
                  const hasRuntimeError = runtimeById.get(from.id)?.status === 'error' || runtimeById.get(to.id)?.status === 'error';
                  const hasRuntimeWarning = runtimeById.get(from.id)?.status === 'warning' || runtimeById.get(to.id)?.status === 'warning';
                  const runtimeStroke = hasRuntimeError ? '#fb7185' : hasRuntimeWarning ? '#fbbf24' : stroke;
                  const path = edgePath(from, to);
                  return (
                    <g key={edge.from + '-' + edge.to + '-' + index}>
                      <path
                        d={path}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={edge.kind === 'admin' ? 1.8 : 1.35}
                        strokeOpacity={visible ? 0.42 : 0.05}
                        filter={visible ? 'url(#qadaGlow)' : undefined}
                      />
                      {activeRuntimeEdge && visible && (
                        <path
                          d={path}
                          fill="none"
                          stroke={runtimeStroke}
                          strokeWidth={edge.kind === 'admin' ? 3.2 : 2.8}
                          strokeOpacity={0.95}
                          strokeLinecap="round"
                          strokeDasharray="10 16"
                          filter="url(#qadaGlow)"
                        >
                          <animate attributeName="stroke-dashoffset" from="0" to="-52" dur="1.4s" repeatCount="indefinite" />
                        </path>
                      )}
                    </g>
                  );
                })}
              </svg>

              {nodes.map((node) => {
                const Icon = node.icon;
                const runtimeRun = runtimeById.get(node.id);
                const effectiveStatus: AgentStatus = runtimeRun
                  ? (runtimeRun.status === 'success' ? 'completed' : runtimeRun.status === 'warning' ? 'warning' : 'error')
                  : infrastructureStatus(node);
                const meta = statusMeta[effectiveStatus];
                const visible = visibleIds.has(node.id);
                const selectedNode = node.id === selectedId;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => setSelectedId(node.id)}
                    className={
                      'absolute rounded-2xl border p-3 text-right transition-all shadow-[0_14px_35px_rgba(0,0,0,.28)] backdrop-blur-md ' +
                      toneClass(node.tone) +
                      (selectedNode ? ' ring-2 ring-white/25 scale-[1.02] ' : ' ') +
                      (visible ? ' opacity-100 ' : ' opacity-15 ')
                    }
                    style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                    aria-label={node.title}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] font-black text-white">{node.title}</span>
                        <span className="mt-1 block truncate text-[10px] text-slate-400">{node.subtitle}</span>
                      </span>
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20 text-white">
                        <Icon className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="absolute bottom-2.5 right-3 left-3 flex items-center justify-between gap-2">
                      <span className={'text-[9px] font-bold ' + meta.text}>{meta.label}</span>
                      <span className={'h-2 w-2 rounded-full ' + meta.dot + (effectiveStatus === 'running' ? ' animate-pulse' : '')} />
                    </div>
                  </button>
                );
              })}

              <div className="absolute left-[610px] top-[330px] h-[250px] w-[380px] rounded-[50%] border border-cyan-400/10 bg-cyan-400/[0.025] pointer-events-none" />
              <div className="absolute left-[620px] top-[340px] h-[230px] w-[360px] rounded-[50%] border border-cyan-400/10 pointer-events-none" />
            </div>
          </div>
        </div>

        <aside className="lg:w-[320px] shrink-0 rounded-2xl border border-slate-800 bg-slate-950/90 p-4 h-fit">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-black text-slate-500">تفاصيل العقدة</span>
              <h3 className="mt-1 text-base font-black text-white">{selected.title}</h3>
            </div>
            <span className={'h-3 w-3 rounded-full ' + statusMeta[runtimeById.get(selected.id) ? (runtimeById.get(selected.id)?.status === 'success' ? 'completed' : runtimeById.get(selected.id)?.status === 'warning' ? 'warning' : 'error') : infrastructureStatus(selected)].dot} />
          </div>

          <p className="mt-3 text-xs leading-6 text-slate-400">{selected.detail}</p>

          <div className="mt-4 space-y-2 text-xs">
            <DetailRow
              label="الحالة"
              value={runtimeById.get(selected.id)
                ? statusMeta[runtimeById.get(selected.id)?.status === 'success' ? 'completed' : runtimeById.get(selected.id)?.status === 'warning' ? 'warning' : 'error'].label
                : statusMeta[selected.status].label}
            />
            <DetailRow label="النطاق" value={selected.adminOnly ? 'خاص بالأدمن' : 'منصة عامة / محرك'} />
            <DetailRow label="معرف الوكيل" value={selected.id} mono />
            {runtimeById.get(selected.id)?.model && <DetailRow label="النموذج" value={runtimeById.get(selected.id)?.model || ''} mono />}
            {runtimeById.get(selected.id) && <DetailRow label="زمن آخر تشغيل" value={(runtimeById.get(selected.id)!.durationMs / 1000).toFixed(1) + ' ثانية'} />}
            {runtimeById.get(selected.id)?.summary && <DetailRow label="ملخص آخر تشغيل" value={runtimeById.get(selected.id)?.summary || ''} />}
          </div>

          {runtimeById.get(selected.id)?.blockers?.length ? (
            <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/5 p-3">
              <div className="text-[10px] font-black text-amber-200">مواضع الخلل / التحقق الناقص</div>
              <ul className="mt-2 space-y-1.5">
                {runtimeById.get(selected.id)!.blockers!.slice(0, 6).map((blocker, index) => (
                  <li key={index} className="text-[10px] leading-5 text-amber-100/70">• {blocker}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {sourcePacketById.get(selected.id)?.references?.length ? (
            <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-500/5 p-3">
              <div className="text-[10px] font-black text-cyan-200">المصادر الرسمية في آخر تشغيل</div>
              <div className="mt-2 space-y-2">
                {sourcePacketById.get(selected.id)!.references.slice(0, 6).map((reference, index) => (
                  <a
                    key={reference.sourceUrl + index}
                    href={reference.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-slate-800 bg-slate-950/60 p-2 hover:border-cyan-400/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-slate-300">{reference.name}</div>
                        {reference.issueInstrument && <div className="mt-1 text-[9px] text-slate-600">{reference.issueInstrument}</div>}
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-xl border border-amber-400/15 bg-amber-500/5 p-3 text-[11px] leading-5 text-amber-100/80">
            الخريطة مرتبطة الآن بسجل التشغيل وفحص الجاهزية الخادمي. العقدة قد تتحول إلى تحذير أو خطأ إذا تعطل الذكاء أو Redis أو مفاتيح الحماية، ولا تُعرض حالة نجاح ثابتة عند فشل البنية.
          </div>

          {onOpenAnalysisRoom && (selected.adminOnly || selected.id === 'qada-core' || selected.id === 'judgments') && (
            <button
              type="button"
              onClick={onOpenAnalysisRoom}
              className="mt-3 min-h-12 w-full inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/35 bg-violet-500/15 px-4 text-xs font-black text-violet-100 hover:bg-violet-500/25 hover:border-violet-300/60 transition-colors"
            >
              <ScanSearch className="h-4 w-4" />
              <span>فتح غرفة التحليل القضائي</span>
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <div className="mt-4 border-t border-slate-800 pt-4">
            <div className="text-[10px] font-black text-slate-500 mb-2">مفتاح الحالة</div>
            <div className="grid grid-cols-2 gap-2">
              <Legend dot="bg-emerald-400" label="متصل" />
              <Legend dot="bg-cyan-400" label="يعمل" />
              <Legend dot="bg-amber-400" label="تحذير" />
              <Legend dot="bg-rose-500" label="خطأ" />
              <Legend dot="bg-slate-500" label="قيد الربط" />
              <Legend dot="bg-violet-400" label="إداري" />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function SummaryCard({ label, value, tone = 'cyan' }: { label: string; value: number; tone?: 'cyan' | 'emerald' | 'slate' | 'violet' }) {
  const toneText = tone === 'emerald' ? 'text-emerald-300' : tone === 'violet' ? 'text-violet-300' : tone === 'slate' ? 'text-slate-300' : 'text-cyan-300';
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 min-w-[92px]">
      <div className={'text-lg font-black ' + toneText}>{value}</div>
      <div className="text-[10px] font-bold text-slate-500">{label}</div>
    </div>
  );
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'min-h-9 rounded-lg border px-3 text-[11px] font-black transition-colors ' +
        (active
          ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-200'
          : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white')
      }
    >
      {children}
    </button>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <span className={'text-left font-bold text-slate-200 break-all ' + (mono ? 'font-mono text-[10px]' : '')}>{value}</span>
    </div>
  );
}

function Legend({ dot, label }: { dot: string; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 px-2.5 py-2">
      <span className={'h-2.5 w-2.5 rounded-full ' + dot} />
      <span className="text-[10px] font-bold text-slate-400">{label}</span>
    </div>
  );
}
