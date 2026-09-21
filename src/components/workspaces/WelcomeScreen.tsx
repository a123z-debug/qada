import React from 'react';
import {
  Building2,
  Scale,
  ShieldAlert,
  ArrowLeft,
  FileText,
  Gavel,
  ShieldCheck,
  Sparkles,
  Zap,
  CheckCircle2,
  HelpCircle,
  FolderOpen,
  Search,
  Library,
  Bot,
  FileCheck,
  AlertTriangle,
  Clock,
  Network,
  LockKeyhole
} from 'lucide-react';
import { CourtJurisdiction, COURT_CATEGORIES } from '../layout/Sidebar';

interface WelcomeScreenProps {
  onSelectCourt: (court: CourtJurisdiction) => void;
  onSelectService: (service: string) => void;
  userName?: string;
  message?: string;
  isAdmin?: boolean;
  onOpenAdminOverview?: () => void;
}

export function WelcomeScreen({
  onSelectCourt,
  onSelectService,
  userName,
  message = 'الرجاء اختيار الاختصاص القضائي للبدء',
  isAdmin = false,
  onOpenAdminOverview,
}: WelcomeScreenProps) {
  const handleQuickLaunch = (court: CourtJurisdiction, serviceId: string) => {
    onSelectCourt(court);
    onSelectService(serviceId);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4 px-2 sm:px-6 select-none" dir="rtl">
      
      {/* 1. بانر الـ Hero الرئيسي */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-amber-500/20 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          
          <div className="space-y-4 max-w-2xl text-right">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>منصة التدقيق والتقاضي الذكي — أصول القضاء</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              افحص قضيتك <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">قبل أن تقدمها</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {userName ? `أهلاً بك، ${userName}. ` : ''}لا ترفع دعواك قبل أن تعرف نقاط قوتها وضعفها. افحص دعواك، دقّق لائحتك، راجع مستنداتك، واكتشف الثغرات الإجرائية والموضوعية بالاستناد إلى الأنظمة والمراجع القضائية.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleQuickLaunch('administrative', 'administrative_claim')}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:from-amber-400 hover:to-amber-500 transition-all text-sm flex items-center gap-2"
              >
                <Scale className="w-4 h-4" /> ابدأ فحص قضيتك
              </button>
              <a
                href="#tools-section"
                className="px-6 py-3 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-medium border border-slate-700 rounded-xl transition-all text-sm"
              >
                استكشف أدوات المنصة
              </a>
            </div>
          </div>

          {/* لوحة مصغرة تمثل ملف القضية الرقمي */}
          <div className="w-full md:w-80 bg-slate-950/80 border border-amber-500/30 rounded-2xl p-5 shadow-2xl backdrop-blur-md shrink-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <span className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4" /> مساحة قضيتي النشطة
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                قيد المراجعة
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>حالة ملف القضية:</span>
                <span className="font-bold text-amber-400">بانتظار الفحص</span>
              </div>

              <div className="space-y-1.5 pt-2 text-[11px]">
                <div className="flex items-center justify-between text-slate-400">
                  <span>المحرر القضائي:</span>
                  <span className="text-slate-300">غير مقيم بعد</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>المستندات والمرفقات:</span>
                  <span className="text-slate-300">تُحدد بعد الرفع</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>الملاحظات الحرجة:</span>
                  <span className="text-slate-300">تظهر بعد التحليل</span>
                </div>
              </div>

              <p className="pt-2 border-t border-slate-800 text-[10px] leading-5 text-slate-500">
                لا تعرض المنصة نسبة سلامة ثابتة قبل تشغيل فحص فعلي على ملف القضية.
              </p>
            </div>
          </div>

        </div>
      </div>

      {isAdmin && onOpenAdminOverview && (
        <div className="relative overflow-hidden rounded-3xl border border-violet-400/35 bg-gradient-to-l from-violet-500/15 via-slate-950/95 to-cyan-500/10 p-5 sm:p-6 shadow-[0_20px_70px_rgba(76,29,149,.18)]">
          <div className="absolute -top-16 -left-16 h-44 w-44 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-violet-300/30 bg-violet-500/15 text-violet-200 shadow-[0_0_25px_rgba(167,139,250,.15)]">
                <Network className="h-7 w-7" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black text-violet-200">
                  <LockKeyhole className="h-3 w-3" />
                  ADMIN ONLY
                </div>
                <h2 className="mt-2 text-xl sm:text-2xl font-black text-white">غرفة العمليات وخريطة الوكلاء</h2>
                <p className="mt-1 max-w-2xl text-xs sm:text-sm leading-6 text-slate-400">
                  شاهد جميع وكلاء QADA ومساراتهم، واعرف أي وكيل متصل الآن وأي وكيل قيد البناء، ثم تتبع الأخطاء وحالة كل مسار من مكان واحد.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenAdminOverview}
              className="min-h-12 shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-300/40 bg-violet-500/20 px-5 py-3 text-sm font-black text-violet-100 transition hover:bg-violet-500/30 hover:border-violet-200/60 shadow-lg"
            >
              <Network className="w-5 h-5" />
              <span>فتح خريطة الوكلاء</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. مركز الأدوات والخدمات الرئيسية (Grid) */}
      <div id="tools-section" className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-400" />
            <span>ماذا تريد أن تفعل؟ (اختر أداة التدقيق أو الاختصاص)</span>
          </h2>
          <span className="text-xs text-slate-400">منظومة متكاملة لمديري القضايا</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {COURT_CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const primaryService = cat.services[0];

            return (
              <div
                key={cat.id}
                className="group relative rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-all duration-300 p-6 flex flex-col justify-between shadow-xl backdrop-blur-sm"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${cat.colorTheme.bg} ${cat.colorTheme.border} ${cat.colorTheme.text}`}>
                      <CatIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {cat.services.length} مسارات
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                      {cat.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {cat.subTitle}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                    <p className="text-[11px] font-bold text-slate-400">الخدمات والأدوات المتاحة:</p>
                    {cat.services.map((srv) => (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => handleQuickLaunch(cat.id, srv.id)}
                        className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-slate-300 hover:text-amber-300 hover:bg-slate-800/80 transition-colors text-right"
                      >
                        <span className="truncate">{srv.label}</span>
                        <ArrowLeft className="w-3 h-3 text-slate-500 group-hover:text-amber-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 mt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleQuickLaunch(cat.id, primaryService.id)}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    <span>الدخول لمساحة {cat.title}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. تنبيهات وخصائص المنصة الذكية */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">تحليل فجوات الإثبات</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              مقارنة تلقائية بين ما تدعيه في اللائحة وما تثبته في المستندات والمرفقات.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">المدير الذكي الاستباقي</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              متابعة التحديثات النظامية وتنبيهك لأي تعديلات قد تؤثر على دعواك.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">المستشار القانوني المترجم</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              شرح المصطلحات المعقدة وتوجيهك بخطوات واضحة وبسيطة لتقوية موقفك.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}