 /**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Menu, Scale, ShieldCheck, LogOut, ArrowRight, CheckCircle2, AlertTriangle, FileText, Search, Library, Bot, FileCheck } from 'lucide-react';
import { UserSession, JudgmentRecord } from './types';
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
import { PdfUploadModal } from './components/PdfUploadModal';
import { INITIAL_JUDGMENT_RECORDS } from './data/judgmentRecords';

const SESSION_STORAGE_KEY = 'diwan_user_session_v1';
const JUDGMENT_RECORDS_STORAGE_KEY = 'diwan_judgment_records_v1';

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed ?? fallback;
  } catch (error) {
    console.error(`Storage read failed for ${key}:`, error);
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Storage write failed for ${key}:`, error);
    return false;
  }
}

// ==========================================
// 1. مكون العلامة المائية الأمنية (Dynamic Watermark)
// ==========================================
function SecurityWatermark({ user }: { user: UserSession }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden opacity-[0.02] flex items-center justify-center select-none">
      <div className="rotate-[-35deg] text-white font-black text-4xl sm:text-7xl whitespace-nowrap">
        {user.name} - {user.nationalId} - {new Date().toLocaleDateString()}
      </div>
    </div>
  );
}

// ==========================================
// 2. مكون المدير الذكي (System Agent Presence)
// ==========================================
function SystemAgentBar() {
  return (
    <div className="bg-slate-900 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs backdrop-blur-md sticky top-0 z-40 shadow-md">
      <div className="flex items-center gap-3">
        <div className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
        </div>
        <span className="text-amber-200 font-bold">المدير الذكي متصل:</span>
        <span className="text-slate-300">يقوم بمراقبة مساحة العمل وتحديث الأنظمة لحظياً...</span>
      </div>
      <div className="hidden sm:flex items-center gap-2 text-slate-400">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
        <span>مساحة عمل مشفرة</span>
      </div>
    </div>
  );
}

// ==========================================
// 3. مكون الصفحة الترحيبية (Landing Page - OS Style)
// ==========================================
function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-amber-500 selection:text-slate-950" dir="rtl">
      
      {/* الشريط العلوي الفاخر */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-amber-500/10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-600/20 to-amber-900/20 border border-amber-500/30 flex items-center justify-center text-amber-400 text-2xl shadow-[0_0_20px_rgba(245,158,11,0.15)] backdrop-blur-md">
              ⚖️
            </div>
            <div>
              <span className="font-bold text-xl tracking-wide text-white block">أصول القضاء</span>
              <span className="text-[11px] text-amber-400/80 block font-medium">منصة التدقيق والتقاضي الذكي</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onEnterApp} className="px-6 py-2.5 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-500 to-amber-400 rounded-xl hover:from-amber-400 hover:to-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all">
              ابدأ فحص قضيتك
            </button>
          </div>
        </div>
      </header>

      {/* القسم الرئيسي (Hero) */}
      <section className="relative pt-24 pb-16 px-6 flex flex-col items-center text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-amber-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-4xl mx-auto relative z-10 flex flex-col items-center gap-6">
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white leading-tight">
            افحص قضيتك <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">قبل أن تقدمها</span>
          </h1>
          <p className="text-slate-400 text-lg md:text-xl max-w-3xl leading-relaxed">
            منصة ذكية لمراجعة اللوائح القضائية، وتحليل الأحكام والمرفقات، وربط الوقائع والطلبات بالأسانيد النظامية والمراجع ذات الصلة.
          </p>
          <div className="flex gap-4 mt-6">
            <button onClick={onEnterApp} className="px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shadow-[0_0_25px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2 text-lg">
              <Scale className="w-5 h-5" /> مساحة قضيتي
            </button>
          </div>
        </div>
      </section>

      {/* شبكة الأدوات (OS Tools Grid) */}
      <section className="py-12 px-6 max-w-7xl mx-auto relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <div className="group bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-amber-500/40 p-6 rounded-2xl transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">فحص الدعوى</h3>
            <p className="text-slate-400 text-sm">راجع بناء الدعوى واكتشف النواقص والتناقضات قبل إيداعها للمحكمة.</p>
          </div>

          <div className="group bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-amber-500/40 p-6 rounded-2xl transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">محرر اللوائح</h3>
            <p className="text-slate-400 text-sm">اكتب وعدّل لائحتك مع أدوات التدقيق والتحليل الذكي المتزامنة.</p>
          </div>

          <div className="group bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-amber-500/40 p-6 rounded-2xl transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">محلل الأحكام</h3>
            <p className="text-slate-400 text-sm">حلل الحكم واستخرج أسبابه ومنطوقه والمراجع المرتبطة به بدقة فائقة.</p>
          </div>

          <div className="group bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-amber-500/40 p-6 rounded-2xl transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <FileCheck className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">فحص المرفقات</h3>
            <p className="text-slate-400 text-sm">اربط المستندات بالوقائع واكتشف فجوات الإثبات أو التناقضات.</p>
          </div>

          <div className="group bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-amber-500/40 p-6 rounded-2xl transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <Library className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">الأسانيد النظامية</h3>
            <p className="text-slate-400 text-sm">ابحث في الأنظمة واللوائح والمراجع باستخدام محرك البحث المعرفي الذكي.</p>
          </div>

          <div className="group bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:border-amber-500/40 p-6 rounded-2xl transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20 group-hover:scale-110 transition-transform">
              <Bot className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">المستشار الإداري</h3>
            <p className="text-slate-400 text-sm">اسأل عن قضيتك واستكشف المواد والمراجع، دعه يوجهك خطوة بخطوة.</p>
          </div>

        </div>
      </section>

      {/* التنبيه القانوني */}
      <div className="max-w-4xl mx-auto px-6 py-12 text-center text-slate-500 text-xs">
        <p>تنبيه: أصول القضاء أداة تقنية مساعدة للبحث والتحليل والتنظيم، ولا تُعد بديلاً عن الاستشارة القانونية المتخصصة أو تمثيل المحامي. يجب التحقق من النصوص والمراجع قبل الاعتماد عليها.</p>
      </div>
    </div>
  );
}

// ==========================================
// 4. التطبيق الرئيسي (Main App Component)
// ==========================================
export default function App() {
  const [showLandingPage, setShowLandingPage] = useState(true);
  const [session, setSession] = useState<UserSession | null>(() => readStorage<UserSession | null>(SESSION_STORAGE_KEY, null));
  const [activeCourt, setActiveCourt] = useState<CourtJurisdiction | null>(null);
  const [activeService, setActiveService] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isArticle8Open, setIsArticle8Open] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isRepositoryOpen, setIsRepositoryOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const [judgmentRecords, setJudgmentRecords] = useState<JudgmentRecord[]>(() => {
    const saved = readStorage<JudgmentRecord[] | null>(JUDGMENT_RECORDS_STORAGE_KEY, null);
    if (Array.isArray(saved)) return saved.length > 0 ? saved : INITIAL_JUDGMENT_RECORDS;
    return INITIAL_JUDGMENT_RECORDS;
  });

  const handleLoginSuccess = (userSession: UserSession) => {
    setSession(userSession);
    writeStorage(SESSION_STORAGE_KEY, userSession);
  };

  const handleLogout = () => {
    setSession(null);
    setShowLandingPage(true);
    localStorage.removeItem(SESSION_STORAGE_KEY);
  };

  const handleSaveRecord = (record: JudgmentRecord) => {
    setJudgmentRecords((prev) => {
      const exists = prev.some((r) => r.id === record.id);
      const updated = exists ? prev.map((r) => (r.id === record.id ? record : r)) : [record, ...prev];
      writeStorage(JUDGMENT_RECORDS_STORAGE_KEY, updated);
      return updated;
    });
  };

  const handleDeleteRecord = (recordId: string) => {
    setJudgmentRecords((prev) => {
      const updated = prev.filter((r) => r.id !== recordId);
      writeStorage(JUDGMENT_RECORDS_STORAGE_KEY, updated);
      return updated;
    });
  };

  if (showLandingPage) {
    return <LandingPage onEnterApp={() => setShowLandingPage(false)} />;
  }

  if (!session) {
    return (
      <div className="relative min-h-screen">
        <button 
          onClick={() => setShowLandingPage(true)} 
          className="absolute top-4 right-4 z-50 text-amber-500 hover:text-amber-400 text-sm font-bold flex items-center gap-1 bg-slate-900/80 px-4 py-2 rounded-lg border border-amber-500/30"
          dir="rtl"
        >
          <ArrowRight className="w-4 h-4" /> العودة للرئيسية
        </button>
        <LoginScreen onLoginSuccess={handleLoginSuccess} />
      </div>
    );
  }

  // 3. مساحة العمل الأساسية المشفرة
  return (
    // تم إضافة onContextMenu لمنع النقر باليمين و select-none لمنع النسخ
    <div 
      className="app-shell flex h-[100dvh] bg-slate-950 text-slate-100 overflow-hidden font-sans select-none" 
      dir="rtl"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* طبقة الأمان (العلامة المائية) */}
      <SecurityWatermark user={session} />

      <Sidebar
        activeCourt={activeCourt}
        activeService={activeService}
        onSelectCourt={(court) => {
          setActiveCourt(court);
          setActiveService(null);
        }}
        onSelectService={(service) => setActiveService(service)}
        userSession={session}
        onLogout={handleLogout}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
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

          {!activeCourt && (
            <WelcomeScreen
              userName={session.name}
              message="مرحباً بك في مساحة القضية الرقمية."
              isAdmin={session.role === 'admin'}
              onOpenAdminOverview={() => setIsRepositoryOpen(true)}
              onSelectCourt={(court) => {
                setActiveCourt(court);
                setActiveService(null);
              }}
              onSelectService={(service) => setActiveService(service)}
            />
          )}

          {activeCourt === 'administrative' && (
            <AdministrativeWorkspace
              service={activeService}
              userSession={session}
              onOpenArticle8Modal={() => setIsArticle8Open(true)}
              onOpenDossierModal={() => setIsDossierOpen(true)}
              onOpenRepositoryModal={() => setIsRepositoryOpen(true)}
              onOpenPdfModal={() => setIsPdfModalOpen(true)}
            />
          )}

          {activeCourt === 'general' && (
            <GeneralWorkspace
              service={activeService}
              userSession={session}
            />
          )}

          {activeCourt === 'criminal' && (
            <CriminalWorkspace
              service={activeService}
              userSession={session}
            />
          )}
        </main>
      </div>

      <FloatingChatBot
        position="bottom-left"
        activeCourt={activeCourt}
        activeService={activeService}
        userSession={session}
      />

      <Article8CalculatorModal isOpen={isArticle8Open} onClose={() => setIsArticle8Open(false)} onInsertToPrompt={() => setIsArticle8Open(false)} />
      <CaseDossierModal isOpen={isDossierOpen} onClose={() => setIsDossierOpen(false)} judgmentRecords={judgmentRecords} initialNationalId={session.nationalId} currentUser={session} />
      <JudgmentRepositoryModal isOpen={isRepositoryOpen} onClose={() => setIsRepositoryOpen(false)} records={judgmentRecords} currentUser={session} onSaveRecord={handleSaveRecord} onDeleteRecord={handleDeleteRecord} onOpenPleadingStudio={() => {}} onSendToChatPrompt={() => {}} />
      <PdfUploadModal isOpen={isPdfModalOpen} onClose={() => setIsPdfModalOpen(false)} onAddAttachments={() => {}} />
    </div>
  );
}
