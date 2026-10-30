 /**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, useEffect, useState } from 'react';
import { Menu, Scale, ShieldCheck, LogOut, ArrowRight, Library, Bot, ScanSearch, Home, FolderOpen, Search, ChevronLeft, KeyRound, Repeat, Network, Users, ScrollText, ShieldAlert, Gavel, FileUp } from 'lucide-react';
import { UserSession, JudgmentRecord, Attachment } from './types';
import { LoginScreen } from './components/LoginScreen';
import { Sidebar, CourtJurisdiction, COURT_CATEGORIES } from './components/layout/Sidebar';
import { CommandPalette, type CommandAction } from './components/CommandPalette';
import { LandingPage } from './components/landing/LandingPage';
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
const AdminSentinel = React.lazy(() => import('./components/admin/AdminSentinel').then((module) => ({ default: module.AdminSentinel })));
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
  const identityMarker = user.nationalId
    ? `••••${user.nationalId.slice(-4)}`
    : user.role === 'admin' ? 'إدارة' : user.id.slice(-6);
  const stamp = new Date().toLocaleDateString('ar-SA-u-nu-latn');
  return (
    <div aria-hidden="true" className="qada-watermark pointer-events-none fixed inset-0 z-[9999] overflow-hidden flex items-center justify-center select-none">
      <div className="rotate-[-35deg] font-black text-4xl sm:text-7xl whitespace-nowrap" data-mark={`${user.name} - ${identityMarker} - ${stamp}`} />
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
  const [isAdminSentinelOpen, setIsAdminSentinelOpen] = useState(false);
  const [isAccountSecurityOpen, setIsAccountSecurityOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

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
      setIsAdminSentinelOpen(false);
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
    setIsAdminSentinelOpen(false);
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
      setIsAdminSentinelOpen(false);
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

  // Ctrl/⌘+K opens the command palette. KeyK keeps it working on the Arabic layout.
  useEffect(() => {
    if (!session) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.code === 'KeyK' || event.key.toLowerCase() === 'k')) {
        event.preventDefault();
        setIsPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session]);

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

  type AdminView = 'map' | 'analysis' | 'users' | 'audit' | 'sentinel';
  const openAdminView = (view: AdminView | null) => {
    setActiveCourt(null);
    setActiveService(null);
    setIsAdminMapOpen(view === 'map');
    setIsAdminAnalysisOpen(view === 'analysis');
    setIsAdminUsersOpen(view === 'users');
    setIsAdminAuditOpen(view === 'audit');
    setIsAdminSentinelOpen(view === 'sentinel');
  };
  const openCourt = (court: CourtJurisdiction, service: string | null = null) => {
    openAdminView(null);
    setActiveCourt(court);
    setActiveService(service);
  };
  const activeCourtConfig = COURT_CATEGORIES.find((category) => category.id === activeCourt);
  const activeServiceConfig = activeCourtConfig?.services.find((item) => item.id === activeService);

  const commandActions: CommandAction[] = [
    { id: 'home', group: 'التنقل', label: 'الرئيسية', icon: Home, run: () => openAdminView(session.role === 'admin' ? 'map' : null) },
    ...(!simpleUserMode
      ? [
          ...COURT_CATEGORIES.map((category) => ({
            id: `court-${category.id}`, group: 'المحاكم', label: category.title, hint: category.subTitle, icon: category.icon, run: () => openCourt(category.id),
          })),
          ...COURT_CATEGORIES.flatMap((category) => category.services.map((item) => ({
            id: `service-${item.id}`,
            group: 'الخدمات',
            label: item.label,
            hint: `${category.title} — ${item.description}`,
            icon: item.icon,
            run: () => openCourt(category.id, item.id),
          }))),
        ]
      : []),
    { id: 'library', group: 'الأدوات', label: 'الأنظمة والمراجع', hint: 'الفهرس الرسمي واللوائح والتعديلات', keywords: 'مكتبة نظام مادة', icon: Library, run: () => setIsReferencesOpen(true) },
    { id: 'assistant', group: 'الأدوات', label: 'اسأل QADA', hint: 'المستشار الذكي', keywords: 'محادثة مساعد', icon: Bot, run: () => requestAssistant('') },
    { id: 'search', group: 'الأدوات', label: 'ابحث عن جواب قانوني', hint: 'بحث في الأنظمة مع المصدر', icon: Search, run: () => requestAssistant('ابحث لي في الأنظمة والمراجع ذات الصلة بسؤالي، واذكر السند ومصدره الرسمي.') },
    { id: 'dossier', group: 'الأدوات', label: 'قضيتي', hint: 'ملف القضية والأحكام', keywords: 'ملف تقارير', icon: FolderOpen, run: () => setIsDossierOpen(true) },
    { id: 'repository', group: 'الأدوات', label: 'مستودع الأحكام', hint: 'إضافة حكم أو قرار وتحليله', icon: Gavel, run: () => setIsRepositoryOpen(true) },
    { id: 'upload', group: 'الأدوات', label: 'رفع مستند PDF', icon: FileUp, run: () => setIsPdfModalOpen(true) },
    ...(userMode
      ? [{ id: 'mode', group: 'الحساب', label: simpleUserMode ? 'التبديل إلى الوضع المتقدم' : 'التبديل إلى الوضع البسيط', icon: Repeat, run: () => handleInterfaceModeChange(simpleUserMode ? 'professional' : 'simple') }]
      : []),
    { id: 'security', group: 'الحساب', label: 'أمان الحساب', icon: KeyRound, run: () => setIsAccountSecurityOpen(true) },
    ...(session.role === 'admin'
      ? [
          { id: 'admin-map', group: 'الإدارة', label: 'خريطة الوكلاء وغرفة العمليات', icon: Network, run: () => openAdminView('map') },
          { id: 'admin-analysis', group: 'الإدارة', label: 'غرفة تحليل الأحكام والمذكرات', icon: ScrollText, run: () => openAdminView('analysis') },
          { id: 'admin-users', group: 'الإدارة', label: 'إدارة المستخدمين', icon: Users, run: () => openAdminView('users') },
          { id: 'admin-audit', group: 'الإدارة', label: 'سجل التدقيق', icon: ShieldCheck, run: () => openAdminView('audit') },
          { id: 'admin-sentinel', group: 'الإدارة', label: 'المراقبة الحية', hint: 'QADA Sentinel', icon: ShieldAlert, run: () => openAdminView('sentinel') },
        ]
      : []),
    { id: 'logout', group: 'الحساب', label: 'تسجيل الخروج', icon: LogOut, run: handleLogout },
  ];

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
      <CommandPalette open={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} actions={commandActions} />

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
        onOpenAdminMap={session.role === 'admin' ? () => openAdminView('map') : undefined}
        onOpenAdminAnalysis={session.role === 'admin' ? () => openAdminView('analysis') : undefined}
        onOpenAdminUsers={session.role === 'admin' ? () => openAdminView('users') : undefined}
        onOpenAdminAudit={session.role === 'admin' ? () => openAdminView('audit') : undefined}
        onOpenAdminSentinel={session.role === 'admin' ? () => openAdminView('sentinel') : undefined}
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
                <div className="text-xs font-bold text-slate-400">
                  {simpleUserMode ? 'QADA' : 'QADA Professional'}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" aria-label="فتح القائمة" onClick={() => setIsMobileMenuOpen(true)} className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors">
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" />
                <span className="font-bold text-sm text-white">أصول القضاء</span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsPaletteOpen(true)}
            className={`min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl transition-colors ${
              userMode ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-300 hover:text-white'
            }`}
            aria-label="البحث والانتقال السريع"
          >
            <Search className="w-4 h-4" />
          </button>
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
          </div>
        </header>

        {/* مساحة العمل */}
        <main className={`flex-1 overflow-y-auto custom-scrollbar ${
          userMode
            ? 'qada-user-main bg-[#f7f8fa] p-3 pb-24 sm:p-5 sm:pb-6 lg:p-8'
            : 'p-3 sm:p-6 lg:p-8 pb-24 sm:pb-6 lg:pb-8'
        }`}>
          <div className="qada-topbar">
            <nav className="qada-crumbs" aria-label="مسار التنقل">
              <button type="button" onClick={() => openAdminView(session.role === 'admin' ? 'map' : null)}>الرئيسية</button>
              {activeCourtConfig && (
                <>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <button type="button" onClick={() => openCourt(activeCourtConfig.id)} aria-current={activeServiceConfig ? undefined : 'page'}>{activeCourtConfig.title}</button>
                </>
              )}
              {activeServiceConfig && (
                <>
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  <span aria-current="page">{activeServiceConfig.label}</span>
                </>
              )}
            </nav>
            <button type="button" className="qada-cmdk" onClick={() => setIsPaletteOpen(true)} aria-label="البحث والانتقال السريع" aria-keyshortcuts="Control+K Meta+K">
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>ابحث أو انتقل إلى...</span>
              <kbd>Ctrl K</kbd>
            </button>
          </div>

          {caseStoreError && (
            <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">
              {userMode ? 'تعذر تحميل قضاياك مؤقتاً. جرّب تحديث الصفحة بعد قليل.' : `تعذر الوصول إلى مخزن القضايا: ${caseStoreError}`}
            </div>
          )}
          {activeCourt && (
            <div className="mb-4 flex justify-end py-1 lg:hidden">
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

          {session.role === 'admin' && isAdminMapOpen && !isAdminAnalysisOpen && !isAdminUsersOpen && !isAdminAuditOpen && !isAdminSentinelOpen && (
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
                if (nodeId === 'sentinel') {
                  setIsAdminMapOpen(false);
                  setIsAdminSentinelOpen(true);
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
                setIsAdminSentinelOpen(false);
                setIsAdminMapOpen(true);
              }}
            />
          )}

          {session.role === 'admin' && isAdminSentinelOpen && (
            <AdminSentinel
              onBack={() => {
                setIsAdminSentinelOpen(false);
                setIsAdminMapOpen(true);
              }}
            />
          )}

          {!activeCourt && !isAdminMapOpen && !isAdminAnalysisOpen && !isAdminUsersOpen && !isAdminAuditOpen && !isAdminSentinelOpen && (
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

          {!isAdminMapOpen && !isAdminAnalysisOpen && !isAdminUsersOpen && !isAdminAuditOpen && !isAdminSentinelOpen && activeCourt === 'administrative' && (
            <AdministrativeWorkspace
              service={activeService}
              userSession={session}
              onOpenArticle8Modal={() => setIsArticle8Open(true)}
              onOpenDossierModal={() => setIsDossierOpen(true)}
              onOpenRepositoryModal={() => setIsRepositoryOpen(true)}
              onOpenPdfModal={() => setIsPdfModalOpen(true)}
            />
          )}

          {!isAdminMapOpen && !isAdminAnalysisOpen && !isAdminUsersOpen && !isAdminAuditOpen && !isAdminSentinelOpen && activeCourt === 'general' && (
            <GeneralWorkspace
              service={activeService}
              userSession={session}
            />
          )}

          {!isAdminMapOpen && !isAdminAnalysisOpen && !isAdminUsersOpen && !isAdminAuditOpen && !isAdminSentinelOpen && activeCourt === 'criminal' && (
            <CriminalWorkspace
              service={activeService}
              userSession={session}
            />
          )}
        </main>
      </div>

      {userMode ? (
        <nav
          className="qada-glass-dock lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 px-2 pt-1.5 shadow-[0_-8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl"
          aria-label="التنقل السريع"
          style={{ paddingBottom: 'max(0.4rem, env(safe-area-inset-bottom))' }}
        >
          <div className="grid grid-cols-5 gap-1">
            <button
              type="button"
              onClick={() => { setActiveCourt(null); setActiveService(null); }}
              className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-xs font-black ${
                activeCourt === null ? 'bg-slate-100 text-slate-950' : 'text-slate-500'
              }`}
            >
              <Home className="h-5 w-5" strokeWidth={1.8} /><span>الرئيسية</span>
            </button>
            {simpleUserMode ? (
              <button
                type="button"
                onClick={() => handleInterfaceModeChange('professional')}
                className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold text-slate-500 active:bg-slate-100"
              >
                <Scale className="h-5 w-5" strokeWidth={1.8} /><span>متقدم</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold text-slate-500 active:bg-slate-100"
              >
                <ScanSearch className="h-5 w-5" strokeWidth={1.8} /><span>الأدوات</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsDossierOpen(true)}
              className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold text-slate-500 active:bg-slate-100"
            >
              <FolderOpen className="h-5 w-5" strokeWidth={1.8} /><span>قضيتي</span>
            </button>
            <button
              type="button"
              onClick={() => setIsReferencesOpen(true)}
              className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold text-slate-500 active:bg-slate-100"
            >
              <Library className="h-5 w-5" strokeWidth={1.8} /><span>المراجع</span>
            </button>
            <button
              type="button"
              onClick={() => requestAssistant('')}
              className="flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold text-slate-500 active:bg-slate-100"
            >
              <Bot className="h-5 w-5" strokeWidth={1.8} /><span>المستشار</span>
            </button>
          </div>
        </nav>
      ) : (
        <nav
          className="qada-glass-dock lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-cyan-400/15 bg-[#031023]/94 backdrop-blur-2xl shadow-[0_-14px_40px_rgba(0,0,0,0.35)]"
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
