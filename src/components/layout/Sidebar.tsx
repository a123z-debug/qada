 import React, { useState, useEffect } from 'react';
import {
  Building2,
  Scale,
  ShieldAlert,
  FileText,
  FileCheck,
  UploadCloud,
  ChevronDown,
  Home,
  LogOut,
  User,
  ShieldCheck,
  Gavel,
  Library,
  Bot,
  FolderOpen,
  BarChart3,
  Settings,
  X,
  Search,
  Clock,
  GitCompare
} from 'lucide-react';
import { UserSession } from '../../types';

export type CourtJurisdiction = 'administrative' | 'general' | 'criminal';

export interface ServiceOption {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  description: string;
}

export interface CourtCategoryConfig {
  id: CourtJurisdiction;
  title: string;
  subTitle: string;
  icon: React.ElementType;
  colorTheme: {
    bg: string;
    border: string;
    text: string;
    accent: string;
    hoverBg: string;
  };
  services: ServiceOption[];
}

export const COURT_CATEGORIES: CourtCategoryConfig[] = [
  {
    id: 'administrative',
    title: 'المحاكم الإدارية',
    subTitle: 'القضايا الإدارية والتظلمات والقرارات',
    icon: Building2,
    colorTheme: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      accent: 'text-amber-300',
      hoverBg: 'hover:bg-amber-500/15',
    },
    services: [
      { id: 'administrative_claim', label: 'لائحة دعوى', icon: FileText, badge: 'إدارية', description: 'صياغة دعوى متكاملة وفق نظام ديوان المظالم' },
      { id: 'administrative_appeal', label: 'اعتراض واستئناف', icon: Scale, badge: 'طعن', description: 'نقض أسباب الحكم الإداري والقصور في التسبيب' },
      { id: 'administrative_memo', label: 'مذكرة دفوع', icon: Gavel, badge: 'موضوعية', description: 'دحض دفاع الإدارة وأوجه بطلان القرار' },
      { id: 'administrative_attachments', label: 'فحص المرفقات والقرارات', icon: UploadCloud, badge: 'مستندات', description: 'استخراج الثغرات النظامية من القرار المطعون فيه' },
    ],
  },
  {
    id: 'general',
    title: 'المحاكم العامة',
    subTitle: 'الدعاوى الحقوقية والعقارات والمقاولات',
    icon: Scale,
    colorTheme: {
      bg: 'bg-cyan-500/10',
      border: 'border-cyan-400/30',
      text: 'text-cyan-300',
      accent: 'text-cyan-200',
      hoverBg: 'hover:bg-cyan-400/10',
    },
    services: [
      { id: 'general_claim', label: 'لائحة حقوقية', icon: FileText, badge: 'مطالبة', description: 'صياغة دعوى مدنية طبقاً لنظام المعاملات المدنية' },
      { id: 'general_appeal', label: 'استئناف عام', icon: Gavel, badge: 'اعتراض', description: 'أوجه الاعتراض والفساد في الاستدلال' },
      { id: 'general_memo', label: 'مذكرة جوابية', icon: FileCheck, badge: 'دفوع', description: 'الدفع بإنكار الالتزام أو انقضاء الدين' },
      { id: 'general_attachments', label: 'فحص السندات والعقود', icon: UploadCloud, badge: 'بينات', description: 'فحص السندات لأمر والعقود الموقعة إلكترونياً' },
    ],
  },
  {
    id: 'criminal',
    title: 'المحاكم الجزائية',
    subTitle: 'الدفاع الجنائي والدفوع الإجرائية',
    icon: ShieldAlert,
    colorTheme: {
      bg: 'bg-fuchsia-500/10',
      border: 'border-fuchsia-400/30',
      text: 'text-fuchsia-300',
      accent: 'text-fuchsia-200',
      hoverBg: 'hover:bg-fuchsia-400/10',
    },
    services: [
      { id: 'criminal_defense', label: 'مذكرة دفاع / براءة', icon: FileText, badge: 'دفاع', description: 'دحض أدلة الاتهام وتطبيق أصل البراءة' },
      { id: 'criminal_appeal', label: 'اعتراض جزائي', icon: Gavel, badge: 'نقض', description: 'الطعن في عقوبة التعزير ومخالفة الإجراءات' },
      { id: 'criminal_procedural', label: 'دفوع الإجراءات الباطلة', icon: ShieldAlert, badge: 'بطلان', description: 'بطلان القبض والتفتيش وثمرة الشجرة الخبيثة' },
      { id: 'criminal_evidence', label: 'تدقيق محضر الضبط', icon: UploadCloud, badge: 'محاضر', description: 'استخراج أوجه التناقض في محضر التحقيق' },
    ],
  },
];

interface SidebarProps {
  activeCourt: CourtJurisdiction | null;
  activeService: string | null;
  onSelectCourt: (court: CourtJurisdiction | null) => void;
  onSelectService: (service: string) => void;
  userSession?: UserSession | null;
  onLogout?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  onOpenKnowledge?: () => void;
  onOpenSearch?: () => void;
  onOpenAssistant?: () => void;
  onOpenReports?: () => void;
}

export function Sidebar({
  activeCourt,
  activeService,
  onSelectCourt,
  onSelectService,
  userSession,
  onLogout,
  isMobileOpen,
  onCloseMobile,
  onOpenKnowledge,
  onOpenSearch,
  onOpenAssistant,
  onOpenReports,
}: SidebarProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('courts');

  useEffect(() => {
    if (activeCourt) {
      setExpandedSection('courts');
    }
  }, [activeCourt]);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const handleServiceClick = (courtId: CourtJurisdiction, serviceId: string) => {
    if (activeCourt !== courtId) {
      onSelectCourt(courtId);
    }
    onSelectService(serviceId);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <div className="app-sidebar h-full flex flex-col bg-slate-950 border-l border-slate-800 text-slate-100 select-none">
      
      {/* 1. رأس القائمة والهوية البصرية الفاخرة */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-white tracking-tight">أصول القضاء</h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono">
                  OS v3.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400">منصة التدقيق والتقاضي الذكي</p>
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* بيانات المستخدم الجلسة */}
        {userSession && (
          <div className="mt-3 p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <p className="text-slate-200 font-semibold truncate text-[11px]">
                    {userSession.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono">
                    هوية: •••• {userSession.nationalId.slice(-4)}
                  </p>
                </div>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. زر الرئيسية (مركز القيادة) */}
      <div className="p-3 border-b border-slate-800/60 bg-slate-900/40">
        <button
          type="button"
          onClick={() => {
            onSelectCourt(null);
            if (onCloseMobile) onCloseMobile();
          }}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeCourt === null
              ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)] font-black'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <Home className="w-4 h-4" />
            <span>مركز القيادة الرئيسي</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/30 font-mono text-amber-300">الرئيسية</span>
        </button>
      </div>

      {/* 3. هيكل التنقل والأقسام المعتمدة */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        
        {/* قسم أدوات التقاضي والاختصاصات */}
        <div className="space-y-1.5">
          <div className="px-2 py-1 flex items-center justify-between text-[11px] font-bold text-amber-400/90 tracking-wide">
            <span className="flex items-center gap-1.5"><Scale className="w-3.5 h-3.5" /> أدوات التقاضي والمسارات</span>
          </div>

          {COURT_CATEGORIES.map((cat) => {
            const isCurrentCourt = activeCourt === cat.id;
            const CatIcon = cat.icon;

            return (
              <div
                key={cat.id}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isCurrentCourt
                    ? 'border-amber-500/50 bg-slate-900 shadow-lg ring-1 ring-amber-500/20'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelectCourt(cat.id);
                    if (cat.services.length > 0 && !activeService) {
                      onSelectService(cat.services[0].id);
                    }
                    if (typeof window !== 'undefined' && window.innerWidth < 1024 && onCloseMobile) {
                      onCloseMobile();
                    }
                  }}
                  className={`w-full flex items-center justify-between p-3 text-right transition-colors ${
                    isCurrentCourt ? 'bg-amber-500/10' : 'hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${cat.colorTheme.bg} ${cat.colorTheme.border} ${cat.colorTheme.text}`}>
                      <CatIcon className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate">
                      <span className="font-bold text-xs text-white block truncate">
                        {cat.title}
                      </span>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {cat.subTitle}
                      </span>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isCurrentCourt ? 'rotate-180 text-amber-400' : ''}`} />
                </button>

                {/* خدمات الاختصاص الفردية */}
                {isCurrentCourt && (
                  <div className="p-2 pt-0 space-y-1 bg-slate-950/80 border-t border-slate-800/80">
                    {cat.services.map((srv) => {
                      const isServiceActive = activeService === srv.id;
                      const SrvIcon = srv.icon;

                      return (
                        <button
                          key={srv.id}
                          type="button"
                          onClick={() => handleServiceClick(cat.id, srv.id)}
                          className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-right transition-all ${
                            isServiceActive
                              ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold'
                              : 'hover:bg-slate-900 text-slate-300 hover:text-white border border-transparent'
                          }`}
                        >
                          <SrvIcon className={`w-3.5 h-3.5 shrink-0 ${isServiceActive ? 'text-amber-400' : 'text-slate-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs truncate">{srv.label}</span>
                              {srv.badge && (
                                <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 font-mono">
                                  {srv.badge}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* قسم المعرفة والبحث النظامي */}
        <div className="pt-2 border-t border-slate-800/80 space-y-1">
          <div className="px-2 py-1 text-[11px] font-bold text-slate-400 tracking-wide flex items-center gap-1.5">
            <Library className="w-3.5 h-3.5 text-amber-400" /> المعرفة والأسانيد
          </div>
          
          <button 
            onClick={() => {
              onOpenKnowledge?.();
              if (onCloseMobile) onCloseMobile();
            }}
            className="min-h-11 w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-900 hover:text-white transition-all"
          >
            <Library className="w-4 h-4 text-slate-400" />
            <span>المكتبة النظامية الشاملة</span>
          </button>

          <button 
            onClick={() => {
              onOpenSearch?.();
              if (onCloseMobile) onCloseMobile();
            }}
            className="min-h-11 w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-900 hover:text-white transition-all"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <span>البحث المعرفي الذكي</span>
          </button>
        </div>

        {/* قسم الذكاء الاصطناعي والإدارة */}
        <div className="pt-2 border-t border-slate-800/80 space-y-1">
          <div className="px-2 py-1 text-[11px] font-bold text-slate-400 tracking-wide flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-amber-400" /> المحرك الذكي
          </div>

          <button 
            onClick={() => {
              onOpenAssistant?.();
              if (onCloseMobile) onCloseMobile();
            }}
            className="min-h-11 w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-900 hover:text-white transition-all"
          >
            <Bot className="w-4 h-4 text-amber-400" />
            <span>المستشار الذكي (المدير)</span>
          </button>

          <button 
            onClick={() => {
              onOpenReports?.();
              if (onCloseMobile) onCloseMobile();
            }}
            className="min-h-11 w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:bg-slate-900 hover:text-white transition-all"
          >
            <BarChart3 className="w-4 h-4 text-slate-400" />
            <span>تقارير الفحص والنتائج</span>
          </button>
        </div>

      </div>

      {/* 4. تذييل القائمة الحماية والعزل */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-900/80 text-[11px] text-slate-400 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>حماية وعزل قضائي</span>
        </div>
        <span className="font-mono text-[10px] text-amber-400/80">SECURE OS</span>
      </div>
    </div>
  );

  return (
    <>
      {/* القائمة الثابتة على الشاشات الكبيرة */}
      <aside className="hidden lg:block w-full lg:w-1/4 h-full shrink-0 z-20">
        {sidebarContent}
      </aside>

      {/* قائمة الجوال المنبثقة */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-80 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-right duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}