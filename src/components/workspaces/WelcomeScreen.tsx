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
    <div className="max-w-5xl mx-auto space-y-5 sm:space-y-8 py-3 sm:py-4 px-2 sm:px-6">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 p-4 sm:p-10 shadow-2xl">
        <div className="absolute top-0 left-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>نظام البؤرة القضائية والعزل التام (SPA)</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-neutral-100 tracking-tight">
            {isAdmin ? 'أهلاً بك' : userName ? `أهلاً بك، ${userName}` : 'منظومة الترافع والذكاء القضائي'}
          </h1>

          {isAdmin && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-300">
              <ShieldCheck className="h-4 w-4" />
              <span>حساب مسؤول</span>
            </div>
          )}

          <p className="text-sm sm:text-base text-neutral-300 max-w-2xl leading-relaxed">
            {message}. تم بناء الواجهة بتقنية الصفحة الواحدة الحديثة مع العزل التام للمذكرات واللوائح لكل محكمة على حدة لضمان الدقة وتجنب تداخل الاختصاصات.
          </p>

          <div className="hidden sm:flex pt-2 flex-wrap items-center gap-4 text-xs text-neutral-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>تنقل فوري بدون إعادة تحميل (No Refresh)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>عزل برمجيات الدفوع والمذكرات</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>مستشار ذكي عائم (Floating Chat)</span>
            </span>
          </div>
        </div>
      </div>

      {isAdmin && onOpenAdminOverview && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onOpenAdminOverview}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/20"
          >
            <FolderOpen className="w-4 h-4" />
            <span>مرفوعات جميع المستخدمين</span>
          </button>
        </div>
      )}

      {/* 2. Three Judicial Core Jurisdiction Cards */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-bold text-neutral-100 flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-400" />
            <span>حدد المحكمة المختصة لبدء مساحة العمل:</span>
          </h2>
          <span className="text-xs text-neutral-400">3 بؤر قضائية معزولة</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {COURT_CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const primaryService = cat.services[0];

            return (
              <div
                key={cat.id}
                className="group relative rounded-3xl bg-slate-900/80 border border-amber-500/20 hover:border-amber-400/70 transition-all duration-300 p-4 sm:p-6 flex flex-col justify-between shadow-[0_0_20px_rgba(245,158,11,0.08)] hover:shadow-[0_0_30px_rgba(245,158,11,0.18)] hover:-translate-y-1 backdrop-blur-md"
              >
                <div className="space-y-4">
                  {/* Top Badge & Icon */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${cat.colorTheme.bg} ${cat.colorTheme.border} ${cat.colorTheme.text}`}
                    >
                      <CatIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300">
                      {cat.services.length} خدمات
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-neutral-100 group-hover:text-amber-400 transition-colors">
                      {cat.title}
                    </h3>
                    <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                      {cat.subTitle}
                    </p>
                  </div>

                  {/* Service list previews */}
                  <div className="space-y-1.5 pt-2 border-t border-neutral-800/80">
                    <p className="text-[11px] font-bold text-neutral-400">أبرز النماذج والخدمات:</p>
                    {cat.services.slice(0, 3).map((srv) => (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => handleQuickLaunch(cat.id, srv.id)}
                        className="w-full min-h-11 flex items-center justify-between p-2 rounded-lg text-xs text-neutral-300 hover:text-amber-300 hover:bg-neutral-800/80 transition-colors text-right"
                      >
                        <span className="truncate">{srv.label}</span>
                        <ArrowLeft className="w-3 h-3 text-neutral-500 group-hover:text-amber-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary CTA Button */}
                <div className="pt-6 mt-4 border-t border-neutral-800">
                  <button
                    type="button"
                    id={`enter-court-btn-${cat.id}`}
                    onClick={() => handleQuickLaunch(cat.id, primaryService.id)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-neutral-200 text-xs font-bold transition-all shadow-md cursor-pointer"
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

      {/* 3. System Highlights Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
        <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-neutral-200">سرعة فائقة (SPA)</h4>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              تبديل فوري للمحتوى بين اللوائح والمذكرات بنقرة زر دون فقدان البيانات.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-neutral-200">بؤرة قضائية محكمة</h4>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              عزل برمجيات القضايا الإدارية عن العامة والجزائية لضمان سلامة الإجراءات.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-neutral-200">مستشار ذكي عائم</h4>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              نافذة شات عائمة أسفل اليسار ترافقك للإجابة على الاستفسارات أثناء الكتابة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
