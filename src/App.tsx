 /**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useEffect, useState } from 'react';
import { Menu, Scale, ShieldCheck, LogOut, ArrowRight, FileText, Library, Bot, FileCheck, Sparkles, ArrowLeft, BookOpenCheck, Workflow, LockKeyhole, UploadCloud, ScanSearch, ChevronLeft, Home, FolderOpen } from 'lucide-react';
import { UserSession, JudgmentRecord, Attachment } from './types';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar, CourtJurisdiction } from './components/layout/Sidebar';
const WelcomeScreen = React.lazy(() => import('./components/workspaces/WelcomeScreen').then((module) => ({ default: module.WelcomeScreen })));
const AdministrativeWorkspace = React.lazy(() => import('./components/workspaces/AdministrativeWorkspace').then((module) => ({ default: module.AdministrativeWorkspace })));
const GeneralWorkspace = React.lazy(() => import('./components/workspaces/GeneralWorkspace').then((module) => ({ default: module.GeneralWorkspace })));
const CriminalWorkspace = React.lazy(() => import('./components/workspaces/CriminalWorkspace').then((module) => ({ default: module.CriminalWorkspace })));
const FloatingChatBot = React.lazy(() => import('./components/chat/FloatingChatBot').then((module) => ({ default: module.FloatingChatBot })));
const Article8CalculatorModal = React.lazy(() => import('./components/Article8CalculatorModal').then((module) => ({ default: module.Article8CalculatorModal })));
const CaseDossierModal = React.lazy(() => import('./components/CaseDossierModal').then((module) => ({ default: module.CaseDossierModal })));
const JudgmentRepositoryModal = React.lazy(() => import('./components/JudgmentRepositoryModal').then((module) => ({ default: module.JudgmentRepositoryModal })));
const LegalReferencesModal = React.lazy(() => import('./components/LegalReferencesModal').then((module) => ({ default: module.LegalReferencesModal })));
const PdfUploadModal = React.lazy(() => import('./components/PdfUploadModal').then((module) => ({ default: module.PdfUploadModal })));
const CasePleadingStudioModal = React.lazy(() => import('./components/CasePleadingStudioModal').then((module) => ({ default: module.CasePleadingStudioModal })));
const AdminAgentMap = React.lazy(() => import('./components/admin/AdminAgentMap').then((module) => ({ default: module.AdminAgentMap })));
const AdminAnalysisRoom = React.lazy(() => import('./components/admin/AdminAnalysisRoom').then((module) => ({ default: module.AdminAnalysisRoom })));
const AdminUserManagement = React.lazy(() => import('./components/admin/AdminUserManagement').then((module) => ({ default: module.AdminUserManagement })));
const AdminAuditLog = React.lazy(() => import('./components/admin/AdminAuditLog').then((module) => ({ default: module.AdminAuditLog })));
const AccountSecurityModal = React.lazy(() => import('./components/AccountSecurityModal').then((module) => ({ default: module.AccountSecurityModal })));
type LaunchIntent =
  | { kind: 'dashboard' }
  | { kind: 'service'; court: CourtJurisdiction; service: string }
  | { kind: 'repository' }
  | { kind: 'dossier' }
  | { kind: 'assistant'; prefill?: string };

function DeferredSurfaceFallback() {
  return (
    <div className="min-h-[220px] w-full grid place-items-center rounded-2xl border border-cyan-400/10 bg-slate-950/60" dir="rtl">
      <div className="flex items-center gap-3 text-xs font-bold text-slate-400">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cyan-400" />
        جاري تحميل الوحدة المطلوبة...
      </div>
    </div>
  );
}

// ==========================================
// 1. مكون العلامة المائية الأمنية (Dynamic Watermark)
// ==========================================
function SecurityWatermark({ user }: { user: UserSession }) {
  const identityMarker = user.nationalId ? `••••${user.nationalId.slice(-4)}` : 'ADMIN';
  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden opacity-[0.02] flex items-center justify-center select-none">
      <div className="rotate-[-35deg] text-white font-black text-4xl sm:text-7xl whitespace-nowrap">
        {user.name} - {identityMarker} - {new Date().toLocaleDateString()}
      </div>
    </div>
  );
}

// ==========================================
// 2. مكون المدير الذكي (System Agent Presence)
// ==========================================
function SystemAgentBar() {
  const [health, setHealth] = useState<'checking' | 'ready' | 'degraded'>('checking');

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const response = await fetch('/api/health', { cache: 'no-store' });
        const payload = await response.json().catch(() => ({}));
        if (!cancelled) setHealth(response.ok && payload?.ready ? 'ready' : 'degraded');
      } catch {
        if (!cancelled) setHealth('degraded');
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const ready = health === 'ready';
  const checking = health === 'checking';
  const dotClass = ready ? 'bg-emerald-400' : checking ? 'bg-slate-400' : 'bg-amber-400';
  const statusText = ready ? 'مركز التحليل جاهز' : checking ? 'جاري فحص الخدمات' : 'بعض الخدمات تحتاج إعداداً';
  const detailText = ready
    ? 'المصادقة والتخزين مهيآن، وRedis يستجيب، ومزود الذكاء مضبوط للتشغيل.'
    : checking
      ? 'يتم التحقق من حالة المكونات الخادمية...'
      : 'لن تعرض المنصة حالة اتصال ناجحة قبل اجتياز فحص الجاهزية.';

  return (
    <div className="hidden lg:flex bg-[#041126]/95 border-b border-cyan-400/15 px-4 py-2 items-center justify-between text-xs backdrop-blur-xl sticky top-0 z-40 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-3">
        <div className="relative flex h-3 w-3">
          {ready && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${dotClass}`} />
        </div>
        <span className={`font-bold ${ready ? 'text-emerald-200' : checking ? 'text-slate-300' : 'text-amber-200'}`}>{statusText}:</span>
        <span className="text-slate-300">{detailText}</span>
      </div>
      <div className="hidden sm:flex items-center gap-2 text-slate-400">
        <ShieldCheck className={`w-4 h-4 ${ready ? 'text-emerald-400' : 'text-slate-500'}`} />
        <span>جلسة دخول خادمية محمية</span>
      </div>
    </div>
  );
}

// ==========================================
// 3. مكون الصفحة الترحيبية (Landing Page - OS Style)
// ==========================================
function LandingPage({ onEnterApp }: { onEnterApp: (intent?: LaunchIntent) => void }) {
  const quickActions = [
    { icon: Bot, title: 'عندي مشكلة قانونية', text: 'احكِ اللي صار بطريقتك، وQADA يرتب لك الخطوة التالية.', action: { kind: 'assistant', prefill: 'عندي مشكلة قانونية وأبغى أعرف وش أسوي. اسألني فقط عن المعلومات الناقصة وابدأ من الوقائع.' } as LaunchIntent },
    { icon: FileCheck, title: 'عندي حكم أو قرار', text: 'ارفعه أو اشرح محتواه، واعرف هل عندك اعتراض وما الذي يلزمك.', action: { kind: 'dossier' } as LaunchIntent },
    { icon: FileText, title: 'أبغى دعوى أو مذكرة', text: 'QADA يجمع منك البيانات ثم يبني لك مسودة قابلة للمراجعة.', action: { kind: 'assistant', prefill: 'أبغى أجهز دعوى أو مذكرة. اجمع مني البيانات خطوة بخطوة وحدد لي المطلوب والمستندات قبل الصياغة.' } as LaunchIntent },
    { icon: Library, title: 'أبي أعرف حقي', text: 'ابحث في الأنظمة والمراجع الرسمية واشرحها بكلام واضح.', action: { kind: 'repository' } as LaunchIntent },
  ];

  return (
    <div id="home" className="qada-saudi-landing min-h-[100dvh] bg-[#f7f8fa] text-slate-950" dir="rtl">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5"
            aria-label="الرئيسية"
          >
            <span className="qada-brand-emblem flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">
              <Scale className="h-5 w-5" strokeWidth={1.8} />
            </span>
            <span className="text-right">
              <span className="block text-sm font-black leading-4">أصول القضاء</span>
              <span className="block text-[9px] font-bold text-slate-400">QADA</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => onEnterApp({ kind: 'dashboard' })}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800"
          >
            دخول
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main>
        <section className="qada-riyadh-hero relative overflow-hidden">
          <div className="qada-riyadh-skyline" aria-hidden="true">
            <div className="qada-riyadh-tower">
              <span className="qada-riyadh-tower-cutout" />
            </div>
            <span className="qada-riyadh-city qada-riyadh-city-a" />
            <span className="qada-riyadh-city qada-riyadh-city-b" />
            <span className="qada-riyadh-city qada-riyadh-city-c" />
            <span className="qada-riyadh-palm qada-riyadh-palm-a" />
            <span className="qada-riyadh-palm qada-riyadh-palm-b" />
            <span className="qada-abstract-green-wave qada-wave-one" />
            <span className="qada-abstract-green-wave qada-wave-two" />
          </div>

          <div className="relative z-10 mx-auto grid min-h-[560px] max-w-6xl items-end gap-8 px-4 pb-12 pt-24 sm:px-6 sm:pb-16 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:pt-20">
            <div className="max-w-2xl text-right">
              <div className="qada-hero-badge mb-5 inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[11px] font-black">
                <Scale className="h-4 w-4" strokeWidth={1.8} />
                QADA • مساعدك القانوني الذكي
              </div>

              <h1 className="qada-riyadh-title text-4xl font-black leading-[1.12] tracking-tight sm:text-6xl lg:text-7xl">
                عندك قضية أو مشكلة؟
                <span className="block">احكِها مثل ما صارت.</span>
              </h1>

              <p className="qada-riyadh-copy mt-5 max-w-xl text-sm leading-7 sm:text-base">
                ما تحتاج تعرف اسم المحكمة أو رقم المادة. اكتب اللي صار، وارفع أوراقك إن وجدت، وQADA يرتب الوقائع ويحدد لك الخيارات والخطوة التالية.
              </p>

              <div className="mt-7 flex max-w-md flex-col gap-2.5 sm:flex-row">
                <button
                  type="button"
                  onClick={() => onEnterApp({ kind: 'dashboard' })}
                  className="qada-riyadh-primary inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-black transition active:scale-[0.99]"
                >
                  ابدأ قضيتي
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onEnterApp({ kind: 'assistant', prefill: 'عندي حكم أو قرار وأبغى أعرف وش أقدر أسوي عليه. ابدأ بالسؤال عن نوع القرار وتاريخه وما الذي أريده.' })}
                  className="qada-riyadh-secondary inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-black transition"
                >
                  <Bot className="h-4 w-4" />
                  عندي حكم أو قرار
                </button>
              </div>
            </div>

            <div className="qada-hero-signature hidden lg:block">
              <div className="qada-hero-signature-mark">
                <ShieldCheck className="h-5 w-5" strokeWidth={1.7} />
              </div>
              <div>
                <div className="text-xs font-black">ابدأ بدون مصطلحات قانونية</div>
                <div className="mt-1 text-[11px]">قل لنا وش صار • والباقي نرتبه معك</div>
              </div>
            </div>
          </div>
        </section>

        <section id="knowledge" className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map(({ icon: Icon, title, text: description, action }) => (
              <button
                key={title}
                type="button"
                onClick={() => onEnterApp(action)}
                className="group rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-[0_6px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_30px_rgba(15,23,42,0.07)]"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-950 group-hover:text-white">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <h2 className="mt-4 text-sm font-black text-slate-950">{title}</h2>
                <p className="mt-1.5 text-xs leading-5 text-slate-500">{description}</p>
              </button>
            ))}
          </div>
        </section>

        <section id="about" className="border-y border-slate-200 bg-white">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <span className="text-[11px] font-black text-slate-400">كيف تمشي معك QADA؟</span>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                من المشكلة إلى خطوة واضحة.
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                أنت تعطينا القصة والمستندات، والمنصة ترتبها وتسألك فقط عن الناقص ثم توضح لك ماذا تفعل بعد ذلك.
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-3">
              {[
                ['01', 'احكِ اللي صار', 'اكتب القصة بطريقتك، حتى لو كانت غير مرتبة.'],
                ['02', 'ارفع أوراقك', 'حكم، قرار، عقد، تحويل أو أي مستند عندك.'],
                ['03', 'خذ خطتك', 'نعرض لك النواقص والخطوة التالية أو نبدأ المسودة.'],
              ].map(([number, title, text]) => (
                <div key={number} className="rounded-2xl bg-[#f7f8fa] p-4">
                  <div className="text-xs font-black text-slate-400">{number}</div>
                  <div className="mt-5 text-sm font-black text-slate-950">{title}</div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">{text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-4 sm:px-6">
          <div className="rounded-3xl border border-emerald-900/10 bg-white p-5 shadow-[0_14px_44px_rgba(0,70,45,.06)] sm:p-7">
            <div className="mb-5">
              <div className="text-[11px] font-black text-emerald-700">وش تحصل بعد ما تبدأ؟</div>
              <h2 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">النتيجة تكون واضحة، مو كلام عام.</h2>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['فهم وضعك', 'ملخص مرتب للوقائع والمشكلة القانونية.'],
                ['وش ناقصك', 'المستندات أو المعلومات التي تحتاج تكملها.'],
                ['وش تسوي بعدين', 'المسار والإجراء التالي بلغة واضحة.'],
                ['المخرج المطلوب', 'دعوى، اعتراض، مذكرة أو جواب بحسب حالتك.'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-2xl bg-[#f7faf8] p-4">
                  <div className="text-sm font-black text-slate-950">{title}</div>
                  <div className="mt-1.5 text-xs leading-5 text-slate-500">{text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-6 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <p>QADA يساعدك في فهم القضية وترتيبها والبحث والصياغة. قبل أي تقديم رسمي، راجع المخرج النهائي والمستندات المرتبطة به.</p>
            </div>
            <button
              type="button"
              onClick={() => onEnterApp({ kind: 'dashboard' })}
              className="shrink-0 font-black text-slate-950"
            >
              الدخول للمنصة
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

// ==========================================
// 4. التطبيق الرئيسي (Main App Component)
// ==========================================
export default function App() {
  const [showLandingPage, setShowLandingPage] = useState(true);
  const [session, setSession] = useState<UserSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [interfaceMode, setInterfaceMode] = useState<'simple' | 'professional'>('simple');
  const [activeCourt, setActiveCourt] = useState<CourtJurisdiction | null>(null);
  const [activeService, setActiveService] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isArticle8Open, setIsArticle8Open] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isRepositoryOpen, setIsRepositoryOpen] = useState(false);
  const [isReferencesOpen, setIsReferencesOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pendingLaunch, setPendingLaunch] = useState<LaunchIntent | null>(null);
  const [assistantOpenSignal, setAssistantOpenSignal] = useState(0);
  const [assistantPrefill, setAssistantPrefill] = useState('');
  const [assistantAttachments, setAssistantAttachments] = useState<Attachment[]>([]);
  const [pleadingRecord, setPleadingRecord] = useState<JudgmentRecord | null>(null);
  const [isPleadingStudioOpen, setIsPleadingStudioOpen] = useState(false);
  const [isAdminMapOpen, setIsAdminMapOpen] = useState(false);
  const [isAdminAnalysisOpen, setIsAdminAnalysisOpen] = useState(false);
  const [isAdminUsersOpen, setIsAdminUsersOpen] = useState(false);
  const [isAdminAuditOpen, setIsAdminAuditOpen] = useState(false);
  const [isAccountSecurityOpen, setIsAccountSecurityOpen] = useState(false);

  const [judgmentRecords, setJudgmentRecords] = useState<JudgmentRecord[]>([]);
  const [caseStoreError, setCaseStoreError] = useState('');

  useEffect(() => {
    if (!session) {
      setJudgmentRecords([]);
      setCaseStoreError('');
      return;
    }

    let cancelled = false;
    const scope = session.role === 'admin' ? '?scope=all' : '';
    setCaseStoreError('');

    fetch(`/api/cases${scope}`, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || 'تعذر تحميل سجل القضايا.');
        return Array.isArray(payload?.records) ? payload.records as JudgmentRecord[] : [];
      })
      .then((records) => {
        if (!cancelled) setJudgmentRecords(records);
      })
      .catch((error) => {
        if (!cancelled) {
          setJudgmentRecords([]);
          setCaseStoreError(error instanceof Error ? error.message : 'تعذر تحميل سجل القضايا.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session?.id, session?.role]);

  useEffect(() => {
    localStorage.removeItem('diwan_user_session_v1');
    localStorage.removeItem('diwan_judgment_records_v1');
    localStorage.removeItem('diwan_pending_attachments_v1');

    // Remove persistent copies created by older builds. Case records now live in
    // the encrypted server-side repository.
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (
        key?.startsWith('diwan_administrative_draft_') ||
        key?.startsWith('diwan_criminal_draft_') ||
        key?.startsWith('diwan_general_draft_') ||
        key?.startsWith('diwan_judgment_records_v2_')
      ) {
        localStorage.removeItem(key);
      }
    }

    let cancelled = false;
    fetch('/api/session', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json();
        return payload?.session as UserSession | undefined;
      })
      .then((restoredSession) => {
        if (!cancelled && restoredSession) {
          setSession(restoredSession);
          setShowLandingPage(false);
          setInterfaceMode(restoredSession.workspaceMode === 'professional' || restoredSession.role === 'admin' ? 'professional' : 'simple');
          if (restoredSession.role === 'admin' || restoredSession.workspaceMode === 'admin') {
            setActiveCourt(null);
            setActiveService(null);
            setIsAdminAnalysisOpen(false);
            setIsAdminUsersOpen(false);
            setIsAdminAuditOpen(false);
            setIsAdminMapOpen(true);
          }
        }
      })
      .catch(() => {
        // No active session; the login screen will be shown when the user enters the platform.
      })
      .finally(() => {
        if (!cancelled) setSessionChecked(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session) return;
    if (session.workspaceMode === 'admin') {
      setActiveCourt(null);
      setActiveService(null);
      setIsAdminAnalysisOpen(false);
      setIsAdminUsersOpen(false);
      setIsAdminAuditOpen(false);
      setIsAdminMapOpen(true);
    }
  }, [session?.id, session?.workspaceMode]);

  const requestAssistant = (prefill = '', attachments: Attachment[] = []) => {
    setAssistantPrefill(prefill);
    setAssistantAttachments(attachments);
    setAssistantOpenSignal((value) => value + 1);
  };

  const applyLaunchIntent = (intent: LaunchIntent) => {
    if (intent.kind === 'dashboard') {
      setActiveCourt(null);
      setActiveService(null);
      return;
    }
    if (intent.kind === 'service') {
      setActiveCourt(intent.court);
      setActiveService(intent.service);
      return;
    }
    if (intent.kind === 'repository') {
      setIsReferencesOpen(true);
      return;
    }
    if (intent.kind === 'dossier') {
      setIsDossierOpen(true);
      return;
    }
    if (intent.kind === 'assistant') {
      requestAssistant(intent.prefill || '');
    }
  };

  useEffect(() => {
    if (!session || !pendingLaunch) return;
    applyLaunchIntent(pendingLaunch);
    setPendingLaunch(null);
  }, [session, pendingLaunch]);

  const handleEnterApp = (intent: LaunchIntent = { kind: 'dashboard' }) => {
    setPendingLaunch(intent);
    setShowLandingPage(false);
    if (session) {
      applyLaunchIntent(intent);
      setPendingLaunch(null);
    }
  };

  const handleLoginSuccess = (userSession: UserSession) => {
    setShowLandingPage(false);
    setPendingLaunch(null);
    setSession(userSession);
    setInterfaceMode(userSession.workspaceMode === 'professional' || userSession.role === 'admin' ? 'professional' : 'simple');
    setSessionChecked(true);
    setActiveCourt(null);
    setActiveService(null);
    setIsAdminAnalysisOpen(false);
    setIsAdminUsersOpen(false);
    setIsAdminAuditOpen(false);
    setIsAdminMapOpen(userSession.role === 'admin' || userSession.workspaceMode === 'admin');
  };

  const handleInterfaceModeChange = (mode: 'simple' | 'professional') => {
    setInterfaceMode(mode);
    setSession((current) => current && current.role === 'user'
      ? { ...current, workspaceMode: mode }
      : current);
  };

  const handleLogout = () => {
    const clearLocalSession = () => {
      setSession(null);
      setSessionChecked(true);
      setInterfaceMode('simple');
      setShowLandingPage(true);
      setActiveCourt(null);
      setActiveService(null);
      setIsAdminMapOpen(false);
      setIsAdminAnalysisOpen(false);
      setIsAdminUsersOpen(false);
      setIsAdminAuditOpen(false);
      setIsAccountSecurityOpen(false);
      setJudgmentRecords([]);
    };

    void fetch('/api/session', {
      method: 'DELETE',
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .catch(() => {
        // Local state is cleared even if the network is temporarily unavailable.
      })
      .finally(clearLocalSession);
  };

  const handleSaveRecord = (record: JudgmentRecord) => {
    if (!session) return;

    const previous = judgmentRecords;
    setJudgmentRecords((prev) => {
      const exists = prev.some((item) => item.id === record.id);
      return exists ? prev.map((item) => (item.id === record.id ? record : item)) : [record, ...prev];
    });
    setCaseStoreError('');

    void fetch('/api/cases', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || 'تعذر حفظ القضية.');
        const savedRecord = payload?.record as JudgmentRecord | undefined;
        if (savedRecord?.id) {
          setJudgmentRecords((prev) => {
            const exists = prev.some((item) => item.id === savedRecord.id);
            return exists
              ? prev.map((item) => (item.id === savedRecord.id ? savedRecord : item))
              : [savedRecord, ...prev];
          });
        }
      })
      .catch((error) => {
        setJudgmentRecords(previous);
        setCaseStoreError(error instanceof Error ? error.message : 'تعذر حفظ القضية.');
      });
  };

  const handleDeleteRecord = (recordId: string) => {
    if (!session) return;

    const previous = judgmentRecords;
    const target = judgmentRecords.find((record) => record.id === recordId);
    const ownerQuery = session.role === 'admin' && target?.storageOwnerId
      ? `&ownerId=${encodeURIComponent(target.storageOwnerId)}`
      : '';
    setJudgmentRecords((prev) => prev.filter((record) => record.id !== recordId));
    setCaseStoreError('');

    void fetch(`/api/cases?id=${encodeURIComponent(recordId)}${ownerQuery}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
      .then(async (response) => {
        if (response.status === 204) return;
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || 'تعذر حذف القضية.');
      })
      .catch((error) => {
        setJudgmentRecords(previous);
        setCaseStoreError(error instanceof Error ? error.message : 'تعذر حذف القضية.');
      });
  };

  if (showLandingPage) {
    return <LandingPage onEnterApp={handleEnterApp} />;
  }

  if (!session && !sessionChecked) {
    return (
      <div className="min-h-[100dvh] bg-[#f7f8fa] text-slate-700 flex items-center justify-center" dir="rtl">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-bold shadow-sm">
          جاري التحقق من الجلسة...
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <LoginScreen
        onLoginSuccess={handleLoginSuccess}
        onBack={() => {
          setPendingLaunch(null);
          setShowLandingPage(true);
        }}
      />
    );
  }

  const userMode = session.role === 'user';
  const simpleUserMode = userMode && interfaceMode === 'simple';

  // 3. مساحة العمل الأساسية المشفرة
  return (
    <Suspense fallback={<DeferredSurfaceFallback />}>
      <div
        className={`app-shell flex h-[100dvh] overflow-hidden font-sans ${
          userMode
            ? 'user-shell bg-[#f7f8fa] text-slate-950'
            : 'admin-shell bg-slate-950 text-slate-100'
        }`}
        dir="rtl"
      >
      {/* طبقة الأمان (العلامة المائية) */}
      <SecurityWatermark user={session} />

      {!simpleUserMode && (
      <Sidebar
        activeCourt={activeCourt}
        activeService={activeService}
        onSelectCourt={(court) => {
          setIsAdminMapOpen(false);
          setIsAdminAnalysisOpen(false);
          setIsAdminUsersOpen(false);
          setIsAdminAuditOpen(false);
          setActiveCourt(court);
          setActiveService(null);
        }}
        onSelectService={(service) => {
          setIsAdminMapOpen(false);
          setIsAdminAnalysisOpen(false);
          setIsAdminUsersOpen(false);
          setIsAdminAuditOpen(false);
          setActiveService(service);
        }}
        userSession={session}
        onLogout={handleLogout}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        onOpenKnowledge={() => setIsReferencesOpen(true)}
        onOpenSearch={() => requestAssistant('ابحث لي في الأنظمة والمراجع ذات الصلة بسؤالي، واذكر السند ومصدره بوضوح: ')}
        onOpenAssistant={() => requestAssistant('')}
        onOpenReports={() => setIsDossierOpen(true)}
        onOpenAdminMap={session.role === 'admin' ? () => {
          setActiveCourt(null);
          setActiveService(null);
          setIsAdminAnalysisOpen(false);
          setIsAdminUsersOpen(false);
          setIsAdminAuditOpen(false);
          setIsAdminMapOpen(true);
        } : undefined}
        onOpenAdminAnalysis={session.role === 'admin' ? () => {
          setActiveCourt(null);
          setActiveService(null);
          setIsAdminMapOpen(false);
          setIsAdminUsersOpen(false);
          setIsAdminAuditOpen(false);
          setIsAdminAnalysisOpen(true);
        } : undefined}
        onOpenAdminUsers={session.role === 'admin' ? () => {
          setActiveCourt(null);
          setActiveService(null);
          setIsAdminMapOpen(false);
          setIsAdminAnalysisOpen(false);
          setIsAdminUsersOpen(true);
        } : undefined}
        onOpenAdminAudit={session.role === 'admin' ? () => {
          setActiveCourt(null);
          setActiveService(null);
          setIsAdminMapOpen(false);
          setIsAdminAnalysisOpen(false);
          setIsAdminUsersOpen(false);
          setIsAdminAuditOpen(true);
        } : undefined}
        onOpenAccountSecurity={session.loginMethod === 'test_open' ? undefined : () => setIsAccountSecurityOpen(true)}
      />
      )}

      <div className={`w-full flex-1 flex flex-col h-full overflow-hidden relative z-10 ${simpleUserMode ? '' : 'lg:w-3/4'}`}>
        
        {/* شريط المدير الذكي المركزي */}
        {session.role === 'admin' && <SystemAgentBar />}

        {/* Mobile Header */}
        <header
          className={`lg:hidden flex items-center justify-between p-3 shrink-0 ${
            userMode
              ? 'qada-mobile-header border-b border-slate-200 bg-white/95 text-slate-950 backdrop-blur-xl'
              : 'bg-slate-900/80 backdrop-blur-md border-b border-slate-800'
          }`}
        >
          {userMode ? (
            <div className="flex items-center gap-2.5">
              {!simpleUserMode && (
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600"
                  aria-label="فتح الأدوات"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}
              <span className="qada-brand-emblem flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">
                <Scale className="h-4.5 w-4.5" strokeWidth={1.8} />
              </span>
              <div>
                <div className="text-sm font-black">أصول القضاء</div>
                <div className="text-[9px] font-bold text-slate-400">
                  {simpleUserMode ? 'QADA' : 'QADA Professional'}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setIsMobileMenuOpen(true)} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors">
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-sm text-white">أصول القضاء</span>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className={`min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl transition-colors ${
              userMode
                ? 'text-slate-400 hover:bg-slate-100 hover:text-rose-600'
                : 'text-slate-400 hover:text-rose-400'
            }`}
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* مساحة العمل */}
        <main className={`flex-1 overflow-y-auto custom-scrollbar ${
          userMode
            ? 'qada-user-main bg-[#f7f8fa] p-3 pb-24 sm:p-5 sm:pb-6 lg:p-8'
            : 'p-3 sm:p-6 lg:p-8 pb-24 sm:pb-6 lg:pb-8'
        }`}>
          {caseStoreError && (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">
              {userMode ? 'تعذر تحميل قضاياك مؤقتاً. جرّب تحديث الصفحة بعد قليل.' : `تعذر الوصول إلى مخزن القضايا: ${caseStoreError}`}
            </div>
          )}
          {activeCourt && (
            <div className={`sticky top-0 z-20 mb-4 flex justify-end py-2 backdrop-blur-md ${
              userMode ? 'bg-[#f7f8fa]/90' : 'bg-slate-950/80'
            }`}>
              <button
                type="button"
                onClick={() => {
                  setActiveCourt(null);
                  setActiveService(null);
                }}
                className="min-h-9 inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:border-amber-400/60 hover:bg-amber-500/20 transition-all shadow-[0_0_15px_rgba(245,158,11,0.1)]"
              >
                <ArrowRight className="h-4 w-4" />
                <span>رجوع للوحة القيادة</span>
              </button>
            </div>
          )}

          {session.role === 'admin' && isAdminMapOpen && !isAdminAnalysisOpen && !isAdminUsersOpen && !isAdminAuditOpen && (
            <AdminAgentMap
              onOpenAnalysisRoom={() => {
                setIsAdminMapOpen(false);
                setIsAdminAnalysisOpen(true);
              }}
              onNavigateNode={(nodeId) => {
                if (nodeId === 'auth' || nodeId === 'settings') {
                  setIsAccountSecurityOpen(true);
                  return;
                }
                if (nodeId === 'search') {
                  requestAssistant('ابحث لي في الأنظمة والمراجع الرسمية ذات الصلة، وميّز بوضوح بين المتحقق وما يحتاج مراجعة: ');
                  return;
                }
                if (nodeId === 'laws' || nodeId === 'references') {
                  setIsReferencesOpen(true);
                  return;
                }
                if (nodeId === 'judgments') {
                  setIsRepositoryOpen(true);
                  return;
                }
                if (nodeId === 'cases' || nodeId === 'final-output') {
                  setIsDossierOpen(true);
                  return;
                }
                if (nodeId === 'advisor') {
                  requestAssistant('');
                  return;
                }
                if (nodeId === 'drafting' || nodeId === 'editor-tool') {
                  setIsAdminMapOpen(false);
                  setActiveCourt('administrative');
                  setActiveService('administrative_claim');
                }
              }}
            />
          )}

          {session.role === 'admin' && isAdminAnalysisOpen && (
            <AdminAnalysisRoom
              onBack={() => {
                setIsAdminAnalysisOpen(false);
                setIsAdminUsersOpen(false);
                setIsAdminMapOpen(true);
              }}
            />
          )}

          {session.role === 'admin' && isAdminUsersOpen && (
            <AdminUserManagement
              onBack={() => {
                setIsAdminUsersOpen(false);
                setIsAdminMapOpen(true);
              }}
            />
          )}

          {session.role === 'admin' && isAdminAuditOpen && (
            <AdminAuditLog
              onBack={() => {
                setIsAdminAuditOpen(false);
                setIsAdminMapOpen(true);
              }}
            />
          )}

          {!activeCourt && !isAdminMapOpen && !isAdminAnalysisOpen && !isAdminUsersOpen && !isAdminAuditOpen && (
            <WelcomeScreen
              userName={session.name}
              message="مرحباً بك في مساحة القضية الرقمية."
              isAdmin={session.role === 'admin'}
              defaultMode={session.role === 'admin' ? 'professional' : interfaceMode}
              onModeChange={handleInterfaceModeChange}
              onOpenAdminOverview={() => {
                setActiveCourt(null);
                setActiveService(null);
                setIsAdminAnalysisOpen(false);
                setIsAdminUsersOpen(false);
                setIsAdminAuditOpen(false);
                setIsAdminMapOpen(true);
              }}
              onSelectCourt={(court) => {
                setIsAdminMapOpen(false);
                setIsAdminAnalysisOpen(false);
                setIsAdminUsersOpen(false);
                setActiveCourt(court);
                setActiveService(null);
              }}
              onSelectService={(service) => setActiveService(service)}
            />
          )}

          {!isAdminMapOpen && !isAdminAnalysisOpen && !isAdminUsersOpen && !isAdminAuditOpen && activeCourt === 'administrative' && (
            <AdministrativeWorkspace
              service={activeService}
              userSession={session}
              onOpenArticle8Modal={() => setIsArticle8Open(true)}
              onOpenDossierModal={() => setIsDossierOpen(true)}
              onOpenRepositoryModal={() => setIsRepositoryOpen(true)}
              onOpenPdfModal={() => setIsPdfModalOpen(true)}
            />
          )}

          {!isAdminMapOpen && !isAdminAnalysisOpen && !isAdminUsersOpen && !isAdminAuditOpen && activeCourt === 'general' && (
            <GeneralWorkspace
              service={activeService}
              userSession={session}
            />
          )}

          {!isAdminMapOpen && !isAdminAnalysisOpen && !isAdminUsersOpen && !isAdminAuditOpen && activeCourt === 'criminal' && (
            <CriminalWorkspace
              service={activeService}
              userSession={session}
            />
          )}
        </main>
      </div>

      {userMode ? (
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 px-2 pt-1.5 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
          aria-label="التنقل السريع"
          style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))' }}
        >
          <div className="grid grid-cols-5 gap-1">
            <button
              type="button"
              onClick={() => { setActiveCourt(null); setActiveService(null); }}
              className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-black ${
                activeCourt === null ? 'bg-slate-100 text-slate-950' : 'text-slate-500'
              }`}
            >
              <Home className="h-5 w-5" strokeWidth={1.8} /><span>الرئيسية</span>
            </button>
            {simpleUserMode ? (
              <button
                type="button"
                onClick={() => handleInterfaceModeChange('professional')}
                className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold text-slate-500 active:bg-slate-100"
              >
                <Scale className="h-5 w-5" strokeWidth={1.8} /><span>متقدم</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold text-slate-500 active:bg-slate-100"
              >
                <ScanSearch className="h-5 w-5" strokeWidth={1.8} /><span>الأدوات</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsDossierOpen(true)}
              className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold text-slate-500 active:bg-slate-100"
            >
              <FolderOpen className="h-5 w-5" strokeWidth={1.8} /><span>قضيتي</span>
            </button>
            <button
              type="button"
              onClick={() => setIsReferencesOpen(true)}
              className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold text-slate-500 active:bg-slate-100"
            >
              <Library className="h-5 w-5" strokeWidth={1.8} /><span>المراجع</span>
            </button>
            <button
              type="button"
              onClick={() => requestAssistant('')}
              className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-bold text-slate-500 active:bg-slate-100"
            >
              <Bot className="h-5 w-5" strokeWidth={1.8} /><span>المستشار</span>
            </button>
          </div>
        </nav>
      ) : (
        <nav
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-cyan-400/15 bg-[#031023]/94 backdrop-blur-2xl shadow-[0_-14px_40px_rgba(0,0,0,0.35)]"
          aria-label="التنقل السريع"
          style={{ paddingBottom: 'max(0.45rem, env(safe-area-inset-bottom))' }}
        >
          <div className="grid grid-cols-5 gap-1 px-2 pt-2">
            <button
              type="button"
              onClick={() => { setIsAdminMapOpen(false); setIsAdminAnalysisOpen(false); setIsAdminUsersOpen(false); setIsAdminAuditOpen(false); setActiveCourt(null); setActiveService(null); }}
              className={`mobile-dock-btn ${activeCourt === null ? 'mobile-dock-btn-active' : ''}`}
            >
              <Home className="w-5 h-5" /><span>الرئيسية</span>
            </button>
            <button type="button" onClick={() => setIsMobileMenuOpen(true)} className="mobile-dock-btn">
              <ScanSearch className="w-5 h-5" /><span>الأدوات</span>
            </button>
            <button type="button" onClick={() => setIsDossierOpen(true)} className="mobile-dock-btn">
              <FolderOpen className="w-5 h-5" /><span>قضيتي</span>
            </button>
            <button type="button" onClick={() => setIsReferencesOpen(true)} className="mobile-dock-btn">
              <Library className="w-5 h-5" /><span>المراجع</span>
            </button>
            <button type="button" onClick={() => requestAssistant('')} className="mobile-dock-btn">
              <Bot className="w-5 h-5" /><span>المستشار</span>
            </button>
          </div>
        </nav>
      )}

      {session.loginMethod !== 'test_open' && (
        <AccountSecurityModal
          isOpen={isAccountSecurityOpen}
          onClose={() => setIsAccountSecurityOpen(false)}
          session={session}
        />
      )}

      <FloatingChatBot
        position="bottom-left"
        activeCourt={activeCourt}
        activeService={activeService}
        userSession={session}
        responseMode={session.role === 'admin' ? 'professional' : 'simple'}
        openSignal={assistantOpenSignal}
        externalPrefill={assistantPrefill}
        externalAttachments={assistantAttachments}
      />

      <Article8CalculatorModal
        isOpen={isArticle8Open}
        onClose={() => setIsArticle8Open(false)}
        onInsertToPrompt={(generatedText) => {
          if (generatedText.trim()) requestAssistant(generatedText);
        }}
      />
      <CaseDossierModal isOpen={isDossierOpen} onClose={() => setIsDossierOpen(false)} judgmentRecords={judgmentRecords} initialNationalId={session.nationalId} currentUser={session} />
      <LegalReferencesModal
        isOpen={isReferencesOpen}
        onClose={() => setIsReferencesOpen(false)}
        onAskExpert={(promptText) => requestAssistant(promptText)}
      />
      <JudgmentRepositoryModal
        isOpen={isRepositoryOpen}
        onClose={() => setIsRepositoryOpen(false)}
        records={judgmentRecords}
        currentUser={session}
        onSaveRecord={handleSaveRecord}
        onDeleteRecord={handleDeleteRecord}
        onOpenPleadingStudio={(record) => {
          setPleadingRecord(record);
          setIsRepositoryOpen(false);
          setIsPleadingStudioOpen(true);
        }}
        onSendToChatPrompt={(promptText) => requestAssistant(promptText)}
      />
      {pleadingRecord && (
        <CasePleadingStudioModal
          isOpen={isPleadingStudioOpen}
          onClose={() => setIsPleadingStudioOpen(false)}
          record={pleadingRecord}
          currentUser={session}
          onSendToChatPrompt={(promptText) => requestAssistant(promptText)}
        />
      )}
      <PdfUploadModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onAddAttachments={(attachments) => {
          requestAssistant('', attachments);
        }}
        onAnalyzeImmediately={(attachments, prompt) => {
          requestAssistant(prompt || 'حلل المرفقات المضافة إلى المحادثة.', attachments);
        }}
      />
      </div>
    </Suspense>
  );
}
