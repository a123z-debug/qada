/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Menu, Scale, ShieldCheck, LogOut, ArrowRight } from 'lucide-react';
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

export default function App() {
  // Authentication & Session
  const [session, setSession] = useState<UserSession | null>(() => readStorage<UserSession | null>(SESSION_STORAGE_KEY, null));

  const handleLoginSuccess = (userSession: UserSession) => {
    setSession(userSession);
    writeStorage(SESSION_STORAGE_KEY, userSession);
  };

  const handleLogout = () => {
    setSession(null);
    try {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (e) {
      console.error(e);
    }
  };

  // Judicial Focus (العزل التام) State
  const [activeCourt, setActiveCourt] = useState<CourtJurisdiction | null>(null);
  const [activeService, setActiveService] = useState<string | null>(null);

  // Mobile sidebar drawer
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Modals state
  const [isArticle8Open, setIsArticle8Open] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isRepositoryOpen, setIsRepositoryOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Judgment Records state
  const [judgmentRecords, setJudgmentRecords] = useState<JudgmentRecord[]>(() => {
    const saved = readStorage<JudgmentRecord[] | null>(JUDGMENT_RECORDS_STORAGE_KEY, null);
    if (Array.isArray(saved)) {
      return saved.length > 0 ? saved : INITIAL_JUDGMENT_RECORDS;
    }
    return INITIAL_JUDGMENT_RECORDS;
  });

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

  if (!session) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-shell flex h-[100dvh] bg-neutral-950 text-neutral-100 overflow-hidden font-sans" dir="rtl">
      {/* 1. Sidebar (Right) with Accordion */}
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

      {/* 2. Main Workspace (75% on desktop, full width on mobile) */}
      <div className="w-full lg:w-3/4 flex-1 flex flex-col h-full overflow-hidden">
        {/* Mobile Header Bar */}
        <header className="lg:hidden flex items-center justify-between p-3.5 bg-neutral-900 border-b border-neutral-800 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl bg-neutral-800 text-neutral-200 hover:bg-neutral-750 transition-colors"
              title="القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-400" />
              <span className="font-bold text-sm text-neutral-100">أصول القضاء</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeCourt && (
              <span className="max-w-[42vw] truncate text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {activeCourt === 'administrative' && 'المحاكم الإدارية'}
                {activeCourt === 'general' && 'المحاكم العامة'}
                {activeCourt === 'criminal' && 'المحاكم الجزائية'}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg text-neutral-400 hover:text-rose-400 transition-colors"
              title="خروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Dynamic Workspace Rendering */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          {activeCourt && <div className="sticky top-0 z-10 mb-4 flex justify-end bg-[var(--app-bg)]/90 py-1 backdrop-blur-sm">
            <button
              type="button"
              title="العودة لاختيار المحكمة والنموذج"
              onClick={() => {
                setActiveCourt(null);
                setActiveService(null);
              }}
              className="min-h-11 inline-flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.08)] transition hover:border-amber-400/70 hover:bg-amber-500/20 hover:shadow-[0_0_22px_rgba(245,158,11,0.16)]"
            >
              <ArrowRight className="h-4 w-4" />
              <span>العودة لاختيار النماذج</span>
            </button>
          </div>}

          {!activeCourt && (
            <WelcomeScreen
              userName={session.name}
              message="الرجاء اختيار الاختصاص القضائي للبدء"
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

      {/* 3. Floating AI Legal Assistant (bottom-left) */}
      <FloatingChatBot
        position="bottom-left"
        activeCourt={activeCourt}
        activeService={activeService}
        userSession={session}
      />

      {/* Modals for Deep Judicial Audits */}
      <Article8CalculatorModal
        isOpen={isArticle8Open}
        onClose={() => setIsArticle8Open(false)}
        onInsertToPrompt={() => setIsArticle8Open(false)}
      />

      <CaseDossierModal
        isOpen={isDossierOpen}
        onClose={() => setIsDossierOpen(false)}
        judgmentRecords={judgmentRecords}
        initialNationalId={session.nationalId}
        currentUser={session}
      />

      <JudgmentRepositoryModal
        isOpen={isRepositoryOpen}
        onClose={() => setIsRepositoryOpen(false)}
        records={judgmentRecords}
        currentUser={session}
        onSaveRecord={handleSaveRecord}
        onDeleteRecord={handleDeleteRecord}
        onOpenPleadingStudio={() => {}}
        onSendToChatPrompt={() => {}}
      />

      <PdfUploadModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onAddAttachments={() => {}}
      />
    </div>
  );
}
