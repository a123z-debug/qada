 /**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Menu, Scale, ShieldCheck, LogOut, ArrowRight, FileText, Library, Bot, FileCheck, Sparkles, ArrowLeft, BookOpenCheck, Workflow, LockKeyhole, UploadCloud, ScanSearch, ChevronLeft, Home, FolderOpen } from 'lucide-react';
import { UserSession, JudgmentRecord, Attachment } from './types';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar, CourtJurisdiction } from './components/layout/Sidebar';
import { WelcomeScreen } from './components/workspaces/WelcomeScreen';
import { AdministrativeWorkspace } from './components/workspaces/AdministrativeWorkspace';
import { GeneralWorkspace } from './components/workspaces/GeneralWorkspace';
import { CriminalWorkspace } from './components/workspaces/CriminalWorkspace';
import { FloatingChatBot } from './components/chat/FloatingChatBot';
import { Article8CalculatorModal } from './components/Article8CalculatorModal';
import { CaseDossierModal } from './components/CaseDossierModal';
import { JudgmentRepositoryModal } from './components/JudgmentRepositoryModal';
import { LegalReferencesModal } from './components/LegalReferencesModal';
import { PdfUploadModal } from './components/PdfUploadModal';
import { CasePleadingStudioModal } from './components/CasePleadingStudioModal';
import { AdminAgentMap } from './components/admin/AdminAgentMap';
import { AdminAnalysisRoom } from './components/admin/AdminAnalysisRoom';
type LaunchIntent =
  | { kind: 'dashboard' }
  | { kind: 'service'; court: CourtJurisdiction; service: string }
  | { kind: 'repository' }
  | { kind: 'dossier' }
  | { kind: 'assistant'; prefill?: string };

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
  return (
    <div className="hidden lg:flex bg-[#041126]/95 border-b border-cyan-400/15 px-4 py-2 items-center justify-between text-xs backdrop-blur-xl sticky top-0 z-40 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-3">
        <div className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-400"></span>
        </div>
        <span className="text-cyan-200 font-bold">مركز التحليل متصل:</span>
        <span className="text-slate-300">مساحة القضية جاهزة للمراجعة والتحليل...</span>
      </div>
      <div className="hidden sm:flex items-center gap-2 text-slate-400">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>جلسة دخول خادمية محمية</span>
      </div>
    </div>
  );
}

// ==========================================
// 3. مكون الصفحة الترحيبية (Landing Page - OS Style)
// ==========================================
function LandingPage({ onEnterApp }: { onEnterApp: (intent?: LaunchIntent) => void }) {
  const featureCards = [
    {
      icon: ScanSearch,
      title: 'فحص الدعوى',
      description: 'تحليل بنية الدعوى وربط الوقائع والطلبات واكتشاف مواضع القوة والقصور قبل الإيداع.',
      tone: 'cyan',
      action: { kind: 'dashboard' } as LaunchIntent,
    },
    {
      icon: FileText,
      title: 'محرر اللوائح',
      description: 'صياغة ومراجعة اللوائح والمذكرات في مساحة عمل واحدة مع تدقيق متدرج وواضح.',
      tone: 'violet',
      action: { kind: 'service', court: 'administrative', service: 'administrative_claim' } as LaunchIntent,
    },
    {
      icon: Scale,
      title: 'فحص النقض والاستئناف',
      description: 'مراجعة أسباب الاعتراض وربطها بالحكم والطلبات والأسانيد النظامية ذات الصلة.',
      tone: 'blue',
      action: { kind: 'service', court: 'administrative', service: 'administrative_appeal' } as LaunchIntent,
    },
    {
      icon: BookOpenCheck,
      title: 'المراجع والأسانيد',
      description: 'الوصول إلى الأنظمة واللوائح والمراجع المنظمة داخل قاعدة المعرفة القانونية للمنصة.',
      tone: 'gold',
      action: { kind: 'repository' } as LaunchIntent,
    },
    {
      icon: Bot,
      title: 'المستشار القضائي',
      description: 'مسار حواري يساعدك على ترتيب القضية، واستكمال البيانات الناقصة، والوصول إلى الخطوة التالية.',
      tone: 'cyan',
      action: { kind: 'assistant' } as LaunchIntent,
    },
  ] as const;


  const trustChips: Array<{ label: string; icon: React.ElementType }> = [
    { label: 'مراجع منظمة', icon: Library },
    { label: 'فحص متعدد المراحل', icon: FileCheck },
    { label: 'مساحة قضية موحدة', icon: Workflow },
    { label: 'خصوصية أعلى', icon: LockKeyhole },
  ];
  const steps = [
    { icon: UploadCloud, number: '01', title: 'ارفع المذكرة', text: 'أدخل نص الدعوى أو أرفق المستندات المراد فحصها.' },
    { icon: Workflow, number: '02', title: 'حلّل واربط', text: 'تُنظم الوقائع والطلبات والمرفقات وتُربط بالأسانيد ذات الصلة.' },
    { icon: FileCheck, number: '03', title: 'راجع النتيجة', text: 'استعرض الملاحظات والتوصيات والتعديلات قبل اعتماد المستند.' },
  ];

  return (
    <div id="home" className="landing-shell min-h-screen text-white font-sans selection:bg-cyan-400/30 selection:text-white" dir="rtl">
      <div className="landing-grid" aria-hidden="true" />
      <div className="landing-orb landing-orb-one" aria-hidden="true" />
      <div className="landing-orb landing-orb-two" aria-hidden="true" />

      <header className="landing-header">
        <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between gap-5">
          <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3 shrink-0 group" aria-label="العودة للرئيسية">
            <span className="brand-mark"><Scale className="w-6 h-6" /></span>
            <span className="text-right leading-tight">
              <span className="block font-black text-lg sm:text-xl tracking-tight text-white">أصول القضاء</span>
              <span className="block text-[10px] sm:text-[11px] font-bold text-[#f7c967] mt-0.5">منصة التدقيق والتقاضي الذكي</span>
            </span>
          </button>

          <nav className="hidden lg:flex items-center gap-1 rounded-2xl border border-cyan-400/10 bg-[#041126]/70 p-1.5 backdrop-blur-xl">
            <a href="#home" className="landing-nav-link landing-nav-link-active">الرئيسية</a>
            <a href="#knowledge" className="landing-nav-link">مركز المعرفة</a>
            <a href="#about" className="landing-nav-link">عن المنصة</a>
            <a href="#contact" className="landing-nav-link">تواصل معنا</a>
          </nav>

          <button onClick={() => onEnterApp({ kind: 'dashboard' })} className="landing-login-btn group">
            <span>ابدأ فحص قضيتك</span>
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          </button>
        </div>
      </header>

      <main className="relative z-10">
        <section className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-16 lg:pt-20 pb-10 lg:pb-16">
          <div className="grid lg:grid-cols-[0.92fr_1.08fr] gap-10 lg:gap-14 items-center">
            <div className="order-2 lg:order-1 text-center lg:text-right">
              <div className="landing-eyebrow mx-auto lg:mx-0">
                <Sparkles className="w-4 h-4" />
                <span>منصة متكاملة لفهم القضية ومراجعة مستنداتها</span>
              </div>

              <h1 className="landing-title mt-6">
                <span className="block">ابنِ لائحتك بثقة</span>
                <span className="block">واكشف مواضع <span className="landing-gold">القوة والقصور</span></span>
                <span className="block landing-blue">برؤية قانونية أدق</span>
              </h1>

              <p className="mt-6 text-[15px] sm:text-lg leading-8 text-slate-300 max-w-2xl mx-auto lg:mx-0">
                أصول القضاء مساحة عمل قضائية تجمع فحص الدعوى، ومراجعة اللوائح والمرفقات، وتحليل الأحكام، وربط عناصر القضية بالأسانيد والمراجع ذات الصلة؛ لتكون الصورة أوضح قبل كل خطوة.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3">
                <button onClick={() => onEnterApp({ kind: 'dashboard' })} className="landing-primary-btn group">
                  <span>ارفع مذكرتك وابدأ الفحص</span>
                  <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                </button>
                <a href="#knowledge" className="landing-secondary-btn">
                  <BookOpenCheck className="w-5 h-5" />
                  <span>استكشف أدوات المنصة</span>
                </a>
              </div>

              <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-w-3xl mx-auto lg:mx-0">
                {trustChips.map(({ label, icon: Icon }) => (
                  <div key={label} className="landing-trust-chip">
                    <Icon className="w-4 h-4 text-cyan-300" />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="order-1 lg:order-2 relative min-h-[430px] sm:min-h-[520px] lg:min-h-[600px]">
              <div className="hero-stage">
                <div className="hero-city" aria-hidden="true">
                  <span className="tower tower-1" />
                  <span className="tower tower-2" />
                  <span className="tower tower-3" />
                  <span className="tower tower-4" />
                  <span className="tower tower-5" />
                  <span className="tower tower-6" />
                </div>
                <div className="hero-ring hero-ring-a" aria-hidden="true" />
                <div className="hero-ring hero-ring-b" aria-hidden="true" />
                <div className="justice-pedestal">
                  <div className="justice-halo" />
                  <Scale className="justice-scale" strokeWidth={1.35} />
                  <div className="pedestal-base" />
                </div>

                <div className="floating-panel panel-analysis">
                  <div className="floating-panel-title"><ScanSearch className="w-4 h-4" /> تحليل نظامي</div>
                  <div className="panel-line"><span>ترابط الوقائع والطلبات</span><span className="status-dot" /></div>
                  <div className="panel-line"><span>مراجعة الأسانيد</span><span className="status-dot" /></div>
                  <div className="panel-line"><span>كشف مواضع القصور</span><span className="status-dot" /></div>
                </div>

                <div className="floating-panel panel-sources">
                  <div className="floating-panel-title"><Library className="w-4 h-4" /> مراجع نظامية</div>
                  <div className="source-pill">الأنظمة واللوائح</div>
                  <div className="source-pill">المبادئ القضائية</div>
                  <div className="source-pill">الأحكام والمراجع</div>
                </div>

                <div className="document-card">
                  <div className="document-card-head"><FileText className="w-5 h-5" /> مذكرة قضائية</div>
                  <div className="doc-line w-4/5" /><div className="doc-line w-full" /><div className="doc-line w-11/12" /><div className="doc-line w-3/4" />
                  <div className="document-state"><FileCheck className="w-4 h-4" /> جاهزة للمراجعة</div>
                </div>

                <div className="scene-quote">
                  <span className="text-[#f7c967]">نحو عدالة</span>
                  <strong>أكثر دقة وفعالية</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="knowledge" className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 pb-14 lg:pb-20">
          <div className="section-heading">
            <div>
              <span className="section-kicker">مسارات العمل</span>
              <h2>كل ما تحتاجه في القضية ضمن مسار واحد</h2>
            </div>
            <p>من قراءة المستند إلى مراجعة الأسانيد ثم بناء المذكرة والتقرير النهائي.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mt-7">
            {featureCards.map(({ icon: Icon, title, description, tone, action }) => (
              <button key={title} onClick={() => onEnterApp(action)} className={`feature-card feature-${tone} group text-right`}>
                <span className="feature-icon"><Icon className="w-6 h-6" /></span>
                <h3>{title}</h3>
                <p>{description}</p>
                <span className="feature-link">فتح الأداة <ChevronLeft className="w-4 h-4" /></span>
              </button>
            ))}
          </div>
        </section>

        <section id="about" className="landing-process-wrap">
          <div className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-center">
            <div>
              <span className="section-kicker">كيف تعمل أصول القضاء؟</span>
              <h2 className="mt-3 text-3xl sm:text-4xl font-black tracking-tight">من المستند إلى رؤية قانونية أعمق</h2>
              <p className="mt-4 text-slate-400 leading-8 max-w-xl">
                صُممت المنصة لتجعل مسار المراجعة واضحاً: تبدأ بالمستند، ثم تنظيم عناصر القضية، ثم مراجعة النتائج والمصادر قبل اتخاذ الخطوة التالية.
              </p>
              <button onClick={() => onEnterApp({ kind: 'dashboard' })} className="landing-primary-btn mt-7 group">
                <span>ابدأ من مساحة قضيتي</span>
                <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-3.5">
              {steps.map(({ icon: Icon, number, title, text }) => (
                <div key={number} className="process-card">
                  <div className="flex items-center justify-between gap-3">
                    <span className="process-icon"><Icon className="w-5 h-5" /></span>
                    <span className="process-number">{number}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="max-w-[1480px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="landing-disclaimer">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-cyan-300 mt-0.5 shrink-0" />
              <p>أصول القضاء أداة تقنية مساعدة للبحث والتحليل والتنظيم، ولا تُعد بديلاً عن الاستشارة القانونية المتخصصة أو التمثيل المهني. يجب التحقق من النصوص والمراجع والنتائج قبل الاعتماد عليها أو تقديمها للجهات القضائية.</p>
            </div>
            <button onClick={() => onEnterApp({ kind: 'dashboard' })} className="text-[#f7c967] font-bold hover:text-[#ffe5a0] transition-colors shrink-0">الدخول للمنصة</button>
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
        if (!cancelled && restoredSession) setSession(restoredSession);
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
    setSession(userSession);
    setSessionChecked(true);
  };

  const handleLogout = () => {
    void fetch('/api/session', {
      method: 'DELETE',
      credentials: 'same-origin',
    });
    setSession(null);
    setSessionChecked(true);
    setShowLandingPage(true);
    setActiveCourt(null);
    setActiveService(null);
    setIsAdminMapOpen(false);
    setIsAdminAnalysisOpen(false);
    setJudgmentRecords([]);
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
      })
      .catch((error) => {
        setJudgmentRecords(previous);
        setCaseStoreError(error instanceof Error ? error.message : 'تعذر حفظ القضية.');
      });
  };

  const handleDeleteRecord = (recordId: string) => {
    if (!session) return;

    const previous = judgmentRecords;
    setJudgmentRecords((prev) => prev.filter((record) => record.id !== recordId));
    setCaseStoreError('');

    void fetch(`/api/cases?id=${encodeURIComponent(recordId)}`, {
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
      <div className="min-h-[100dvh] bg-slate-950 text-slate-200 flex items-center justify-center" dir="rtl">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-6 py-4 text-sm font-bold">
          جاري التحقق من الجلسة الآمنة...
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

  // 3. مساحة العمل الأساسية المشفرة
  return (
    <div
      className="app-shell flex h-[100dvh] bg-slate-950 text-slate-100 overflow-hidden font-sans"
      dir="rtl"
    >
      {/* طبقة الأمان (العلامة المائية) */}
      <SecurityWatermark user={session} />

      <Sidebar
        activeCourt={activeCourt}
        activeService={activeService}
        onSelectCourt={(court) => {
          setIsAdminMapOpen(false);
          setIsAdminAnalysisOpen(false);
          setActiveCourt(court);
          setActiveService(null);
        }}
        onSelectService={(service) => {
          setIsAdminMapOpen(false);
          setIsAdminAnalysisOpen(false);
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
          setIsAdminMapOpen(true);
        } : undefined}
        onOpenAdminAnalysis={session.role === 'admin' ? () => {
          setActiveCourt(null);
          setActiveService(null);
          setIsAdminMapOpen(false);
          setIsAdminAnalysisOpen(true);
        } : undefined}
      />

      <div className="w-full lg:w-3/4 flex-1 flex flex-col h-full overflow-hidden relative z-10">
        
        {/* شريط المدير الذكي المركزي */}
        <SystemAgentBar />

        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between p-3.5 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMobileMenuOpen(true)} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-400" />
              <span className="font-bold text-sm text-white">أصول القضاء</span>
            </div>
          </div>
          <button onClick={handleLogout} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-400 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </header>

        {/* مساحة العمل */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-24 sm:pb-6 lg:pb-8 custom-scrollbar">
          {caseStoreError && (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">
              تعذر الوصول إلى مخزن القضايا: {caseStoreError}
            </div>
          )}
          {activeCourt && (
            <div className="sticky top-0 z-20 mb-4 flex justify-end bg-slate-950/80 py-2 backdrop-blur-md">
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

          {session.role === 'admin' && isAdminMapOpen && !isAdminAnalysisOpen && (
            <AdminAgentMap
              onOpenAnalysisRoom={() => {
                setIsAdminMapOpen(false);
                setIsAdminAnalysisOpen(true);
              }}
            />
          )}

          {session.role === 'admin' && isAdminAnalysisOpen && (
            <AdminAnalysisRoom
              onBack={() => {
                setIsAdminAnalysisOpen(false);
                setIsAdminMapOpen(true);
              }}
            />
          )}

          {!activeCourt && !isAdminMapOpen && !isAdminAnalysisOpen && (
            <WelcomeScreen
              userName={session.name}
              message="مرحباً بك في مساحة القضية الرقمية."
              isAdmin={session.role === 'admin'}
              onOpenAdminOverview={() => {
                setActiveCourt(null);
                setActiveService(null);
                setIsAdminAnalysisOpen(false);
                setIsAdminMapOpen(true);
              }}
              onSelectCourt={(court) => {
                setIsAdminMapOpen(false);
                setIsAdminAnalysisOpen(false);
                setActiveCourt(court);
                setActiveService(null);
              }}
              onSelectService={(service) => setActiveService(service)}
            />
          )}

          {!isAdminMapOpen && !isAdminAnalysisOpen && activeCourt === 'administrative' && (
            <AdministrativeWorkspace
              service={activeService}
              userSession={session}
              onOpenArticle8Modal={() => setIsArticle8Open(true)}
              onOpenDossierModal={() => setIsDossierOpen(true)}
              onOpenRepositoryModal={() => setIsRepositoryOpen(true)}
              onOpenPdfModal={() => setIsPdfModalOpen(true)}
            />
          )}

          {!isAdminMapOpen && !isAdminAnalysisOpen && activeCourt === 'general' && (
            <GeneralWorkspace
              service={activeService}
              userSession={session}
            />
          )}

          {!isAdminMapOpen && !isAdminAnalysisOpen && activeCourt === 'criminal' && (
            <CriminalWorkspace
              service={activeService}
              userSession={session}
            />
          )}
        </main>
      </div>

      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-cyan-400/15 bg-[#031023]/94 backdrop-blur-2xl shadow-[0_-14px_40px_rgba(0,0,0,0.35)]"
        aria-label="التنقل السريع"
        style={{ paddingBottom: 'max(0.45rem, env(safe-area-inset-bottom))' }}
      >
        <div className="grid grid-cols-5 gap-1 px-2 pt-2">
          <button
            type="button"
            onClick={() => { setIsAdminMapOpen(false); setIsAdminAnalysisOpen(false); setActiveCourt(null); setActiveService(null); }}
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
          <button type="button" onClick={() => setIsReferencesOpen(true)} className="mobile-dock-btn">\n            <Library className="w-5 h-5" /><span>المراجع</span>
          </button>
          <button type="button" onClick={() => requestAssistant('')} className="mobile-dock-btn">
            <Bot className="w-5 h-5" /><span>المستشار</span>
          </button>
        </div>
      </nav>

      <FloatingChatBot
        position="bottom-left"
        activeCourt={activeCourt}
        activeService={activeService}
        userSession={session}
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
  );
}
