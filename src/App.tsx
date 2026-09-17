/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Menu, Scale, ShieldCheck, LogOut } from 'lucide-react';
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

export default function App() {
  // Authentication & Session
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('diwan_user_session_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return null;
  });

  const handleLoginSuccess = (userSession: UserSession) => {
    setSession(userSession);
    try {
      localStorage.setItem('diwan_user_session_v1', JSON.stringify(userSession));
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    setSession(null);
    try {
      localStorage.removeItem('diwan_user_session_v1');
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
    try {
      const saved = localStorage.getItem('diwan_judgment_records_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_JUDGMENT_RECORDS;
  });

  const handleSaveRecord = (record: JudgmentRecord) => {
    setJudgmentRecords((prev) => {
      const exists = prev.some((r) => r.id === record.id);
      const updated = exists ? prev.map((r) => (r.id === record.id ? record : r)) : [record, ...prev];
      try {
        localStorage.setItem('diwan_judgment_records_v1', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  const handleDeleteRecord = (recordId: string) => {
    setJudgmentRecords((prev) => {
      const updated = prev.filter((r) => r.id !== recordId);
      try {
        localStorage.setItem('diwan_judgment_records_v1', JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  };

  if (!session) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 overflow-hidden font-sans select-none" dir="rtl">
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
              className="p-2 rounded-xl bg-neutral-800 text-neutral-200 hover:bg-neutral-750 transition-colors"
              title="القائمة"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-400" />
              <span className="font-bold text-sm text-neutral-100">ديوان المظالم</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeCourt && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                {activeCourt === 'administrative' && 'المحاكم الإدارية'}
                {activeCourt === 'general' && 'المحاكم العامة'}
                {activeCourt === 'criminal' && 'المحاكم الجزائية'}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 transition-colors"
              title="خروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Dynamic Workspace Rendering */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          {!activeCourt && (
            <WelcomeScreen
              userName={session.name}
              message="الرجاء اختيار الاختصاص القضائي للبدء"
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
