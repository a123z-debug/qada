import React from 'react';
import {
  Building2,
  Scale,
  ShieldAlert,
  FileText,
  FileCheck,
  AlertTriangle,
  FolderOpen,
  UploadCloud,
  ChevronDown,
  ChevronLeft,
  Home,
  LogOut,
  User,
  ShieldCheck,
  Gavel,
  CheckCircle2,
  HelpCircle,
  X,
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
    subTitle: 'ديوان المظالم والتظلمات وقضايا القرارات والبدلات',
    icon: Building2,
    colorTheme: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-400',
      accent: 'text-amber-300',
      hoverBg: 'hover:bg-amber-500/15',
    },
    services: [
      {
        id: 'administrative_claim',
        label: 'لائحة دعوى',
        icon: FileText,
        badge: 'دعوى إدارية',
        description: 'صياغة دعوى متكاملة وفق نظام المرافعات أمام ديوان المظالم والأنظمة السارية',
      },
      {
        id: 'administrative_appeal',
        label: 'اعتراض',
        icon: Scale,
        badge: 'طعن استئنافي',
        description: 'نقض أسباب الحكم الإداري والقصور في التسبيب ومخالفة المراسيم والأنظمة',
      },
      {
        id: 'administrative_memo',
        label: 'مذكرة',
        icon: Gavel,
        badge: 'دفوع موضوعية',
        description: 'دحض دفاع الإدارة وإلزامية المراسيم الملكية (م/37) وأوجه بطلان القرار',
      },
      {
        id: 'administrative_attachments',
        label: 'رفع مرفقات',
        icon: UploadCloud,
        badge: 'قرارات ومستندات',
        description: 'تحليل القرار الإداري المطعون فيه أو الصكوك واستخراج الثغرات النظامية',
      },
    ],
  },
  {
    id: 'general',
    title: 'المحاكم العامة',
    subTitle: 'الدعاوى الحقوقية والمدنية والعقارات والمقاولات',
    icon: Scale,
    colorTheme: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-400',
      accent: 'text-emerald-300',
      hoverBg: 'hover:bg-emerald-500/15',
    },
    services: [
      {
        id: 'general_claim',
        label: 'لائحة دعوى',
        icon: FileText,
        badge: 'مطالبة حقوقية',
        description: 'صياغة دعوى مدنية طبقاً لنظام المعاملات المدنية والمرافعات الشرعية',
      },
      {
        id: 'general_appeal',
        label: 'اعتراض',
        icon: Gavel,
        badge: 'لائحة استئنافية',
        description: 'أوجه الاعتراض والفساد في الاستدلال ومخالفة القواعد الشرعية والأنظمة',
      },
      {
        id: 'general_memo',
        label: 'مذكرة',
        icon: FileCheck,
        badge: 'دفوع جوابية',
        description: 'الدفع بإنكار الالتزام، أو انقضاء الدين، أو التقادم، وسقوط الحق',
      },
      {
        id: 'general_attachments',
        label: 'رفع مرفقات',
        icon: UploadCloud,
        badge: 'عقود وبينات',
        description: 'فحص السندات لأمر، العقود الموقعة، ودفاتر الحسابات إلكترونياً',
      },
    ],
  },
  {
    id: 'criminal',
    title: 'المحاكم الجزائية',
    subTitle: 'الدفاع الجنائي والدفوع الإجرائية وبطلان القبض والتفتيش',
    icon: ShieldAlert,
    colorTheme: {
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/30',
      text: 'text-rose-400',
      accent: 'text-rose-300',
      hoverBg: 'hover:bg-rose-500/15',
    },
    services: [
      {
        id: 'criminal_defense',
        label: 'لائحة دعوى',
        icon: FileText,
        badge: 'مذكرة دفاع / براءة',
        description: 'صياغة دفاع موضوعي ودحض أدلة الاتهام وتطبيق أصل البراءة',
      },
      {
        id: 'criminal_appeal',
        label: 'اعتراض',
        icon: Gavel,
        badge: 'اعتراض واستئناف',
        description: 'الطعن في عقوبة التعزير ومخالفة نظام الإجراءات الجزائية وأصل البراءة',
      },
      {
        id: 'criminal_procedural',
        label: 'مذكرة',
        icon: ShieldAlert,
        badge: 'دفوع جوهرية',
        description: 'بطلان القبض والتفتيش وانتفاء حالة التلبس وقاعدة ثمرة الشجرة الخبيثة',
      },
      {
        id: 'criminal_evidence',
        label: 'رفع مرفقات',
        icon: UploadCloud,
        badge: 'محاضر وتحقيق',
        description: 'تدقيق محضر الضبط والتحقيق الجنائي واستخراج أوجه التناقض',
      },
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
}: SidebarProps) {
  // Accordion state: which court section is open
  const [expandedCourt, setExpandedCourt] = React.useState<CourtJurisdiction | null>(
    activeCourt || 'administrative'
  );

  // Sync expanded section if activeCourt changes from external welcome screen
  React.useEffect(() => {
    if (activeCourt) {
      setExpandedCourt(activeCourt);
    }
  }, [activeCourt]);

  const toggleCourtAccordion = (courtId: CourtJurisdiction) => {
    if (expandedCourt === courtId) {
      // Toggle off
      setExpandedCourt(null);
    } else {
      // Accordion rule: open this one, close all others
      setExpandedCourt(courtId);
      onSelectCourt(courtId);
      // Auto select first service if not selected
      const cat = COURT_CATEGORIES.find((c) => c.id === courtId);
      if (cat && cat.services.length > 0 && activeCourt !== courtId) {
        onSelectService(cat.services[0].id);
      }
    }
  };

  const handleServiceClick = (courtId: CourtJurisdiction, serviceId: string) => {
    if (activeCourt !== courtId) {
      onSelectCourt(courtId);
    }
    onSelectService(serviceId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <div className="h-full flex flex-col bg-neutral-900 border-l border-neutral-800 text-neutral-100 select-none">
      {/* 1. Header & Identity */}
      <div className="p-4 border-b border-neutral-800/80 bg-neutral-950/60">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-sm font-bold text-neutral-100 tracking-tight">ديوان المظالم</h1>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  SPA
                </span>
              </div>
              <p className="text-[11px] text-neutral-400">بوابة الذكاء القضائي الموحدة</p>
            </div>
          </div>

          {/* Close button for mobile */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* User Identity Info */}
        {userSession && (
          <div className="mt-3 p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="truncate">
                  <p className="text-neutral-200 font-semibold truncate text-[11px]">
                    {userSession.name}
                  </p>
                  <p className="text-[10px] text-neutral-400 font-mono">
                    هوية: {userSession.nationalId}
                  </p>
                </div>
              </div>
              {onLogout && (
                <button
                  onClick={onLogout}
                  className="p-1 rounded text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Navigation Overview Home Button */}
      <div className="p-3 border-b border-neutral-800/60 bg-neutral-900/40">
        <button
          id="btn-return-home"
          type="button"
          onClick={() => {
            onSelectCourt(null);
            if (onCloseMobile) onCloseMobile();
          }}
          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
            activeCourt === null
              ? 'bg-amber-500 text-neutral-950 shadow-md font-extrabold'
              : 'bg-neutral-800/60 text-neutral-300 hover:bg-neutral-800 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Home className="w-4 h-4" />
            <span>البؤرة القضائية الرئيسية</span>
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/20">3 اختصاصات</span>
        </button>
      </div>

      {/* 3. Accordion Section for 3 Jurisdictions */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
        <div className="px-2 py-1 flex items-center justify-between text-[11px] font-semibold text-neutral-400">
          <span>الاختصاصات القضائية المعتمدة</span>
          <span className="text-[10px] text-neutral-400">عزل تام</span>
        </div>

        {COURT_CATEGORIES.map((cat) => {
          const isExpanded = expandedCourt === cat.id;
          const isCurrentCourt = activeCourt === cat.id;
          const CatIcon = cat.icon;

          return (
            <div
              key={cat.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                isCurrentCourt
                  ? `${cat.colorTheme.border} bg-neutral-950/80 shadow-lg ring-1 ring-neutral-700/50`
                  : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700'
              }`}
            >
              {/* Accordion Header Button */}
              <button
                type="button"
                id={`accordion-btn-${cat.id}`}
                onClick={() => toggleCourtAccordion(cat.id)}
                className={`w-full flex items-center justify-between p-3 text-right transition-colors ${
                  isExpanded ? 'bg-neutral-850/80' : 'hover:bg-neutral-850/50'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${cat.colorTheme.bg} ${cat.colorTheme.border} ${cat.colorTheme.text}`}
                  >
                    <CatIcon className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs sm:text-sm text-neutral-100">
                        {cat.title}
                      </span>
                      {isCurrentCourt && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-400 truncate max-w-[170px]">
                      {cat.subTitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-neutral-400">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 font-mono">
                    {cat.services.length}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180 text-amber-400' : 'text-neutral-500'
                    }`}
                  />
                </div>
              </button>

              {/* Accordion Sub-Menu (Services) */}
              {isExpanded && (
                <div className="p-2 pt-1 space-y-1 bg-neutral-950/60 border-t border-neutral-800/80">
                  {cat.services.map((srv) => {
                    const isServiceActive = isCurrentCourt && activeService === srv.id;
                    const SrvIcon = srv.icon;

                    return (
                      <button
                        key={srv.id}
                        id={`service-btn-${srv.id}`}
                        type="button"
                        onClick={() => handleServiceClick(cat.id, srv.id)}
                        className={`w-full flex items-start gap-2.5 p-2 rounded-xl text-right transition-all group ${
                          isServiceActive
                            ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300 font-bold shadow-sm'
                            : 'hover:bg-neutral-850/80 text-neutral-300 hover:text-white border border-transparent'
                        }`}
                      >
                        <div
                          className={`mt-0.5 p-1 rounded-lg shrink-0 ${
                            isServiceActive
                              ? 'bg-amber-500 text-neutral-950'
                              : 'bg-neutral-800 text-neutral-400 group-hover:text-amber-400 group-hover:bg-neutral-750'
                          }`}
                        >
                          <SrvIcon className="w-3.5 h-3.5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold truncate leading-tight">
                              {srv.label}
                            </span>
                            {srv.badge && (
                              <span
                                className={`text-[9px] px-1 py-0.2 rounded font-mono shrink-0 ${
                                  isServiceActive
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-neutral-800 text-neutral-400'
                                }`}
                              >
                                {srv.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-neutral-400 line-clamp-1 mt-0.5">
                            {srv.description}
                          </p>
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

      {/* 4. Footer info */}
      <div className="p-3 border-t border-neutral-800/80 bg-neutral-950/80 text-[11px] text-neutral-400 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>تشفير وعزل قضائي</span>
        </div>
        <span className="font-mono text-[10px] text-neutral-400">SPA v3.0</span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar (25% on desktop) */}
      <aside className="hidden lg:block w-full lg:w-1/4 h-full shrink-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
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
