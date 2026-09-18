import { Scale, Calendar, Award, FileText, ArrowLeft, Shield, Upload, FileUp, Lock, ShieldCheck } from 'lucide-react';
import { PROMPT_TEMPLATES } from '../data/promptTemplates';
import { PromptTemplate } from '../types';

interface WelcomeStartersProps {
  onSelectPrompt: (template: PromptTemplate) => void;
  onOpenArticle8: () => void;
  onOpenRepository?: () => void;
  onUploadClick?: () => void;
  onOpenDossier?: () => void;
}

const CATEGORY_ICONS: Record<string, typeof Scale> = {
  'فحص المواعيد (مادة 8)': Calendar,
  'سوابق وبدلات الحاسب': Award,
  'دعاوى الإلغاء وعيوب القرار': Shield,
  'تحليل صكوك الأحكام': FileText,
  'صياغة المذكرات والدفوع': Scale,
};

export function WelcomeStarters({ onSelectPrompt, onOpenArticle8, onOpenRepository, onUploadClick, onOpenDossier }: WelcomeStartersProps) {
  return (
    <div id="welcome-starters" className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-10 flex flex-col items-center text-center">
      {/* Official Judicial Emblem Badge */}
      <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] sm:text-xs font-semibold mb-3 sm:mb-4 shadow-sm">
        <Scale className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
        <span>أصول القضاء | منصة القضايا والدفوعات</span>
      </div>

      {/* Main Title */}
      <h1 className="text-xl sm:text-3xl md:text-4xl font-bold tracking-tight text-neutral-100 mb-2.5 sm:mb-3 font-legal">
        التحليل القضائي وصياغة الدفوع الإدارية والعسكرية
      </h1>
      <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl mb-5 sm:mb-6 leading-relaxed px-1">
        منظومة استشارية متقدمة لحفظ ومطابقة الأحكام برقم الهوية، تتبع المعاملة عبر المحاكم، وحماية ملفات الترافع بالهوية الوطنية وتجهيز لوائح الدفاع النظامية.
      </p>

      {/* Supreme Court 4-Stage Operational Framework Banner */}
      <div className="w-full bg-gradient-to-r from-neutral-900 via-neutral-900/90 to-neutral-900 border border-amber-500/20 rounded-2xl p-3 sm:p-4 mb-5 sm:mb-8 text-right shadow-lg">
        <div className="flex items-center justify-between gap-2 mb-2.5 sm:mb-3 pb-2 border-b border-neutral-800 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <Shield className="w-4 h-4 text-amber-400 shrink-0" />
            <span>الإطار التشغيلي لطعون المحكمة الإدارية العليا (محكمة قانون لا محكمة موضوع)</span>
          </div>
          <span className="text-[10px] sm:text-[11px] text-neutral-400">سقف الرد النظامي 3,500 حرف</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <div className="p-2 sm:p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800 text-neutral-300">
            <span className="text-amber-400 font-bold block mb-0.5 text-[11px] sm:text-xs">١. مكمن الخلل</span>
            <span className="text-[10px] sm:text-[11px] text-neutral-400">تحديد سبب الطعن الحصري</span>
          </div>
          <div className="p-2 sm:p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800 text-neutral-300">
            <span className="text-amber-400 font-bold block mb-0.5 text-[11px] sm:text-xs">٢. تكييف الدفع</span>
            <span className="text-[10px] sm:text-[11px] text-neutral-400">رقابة المشروعية والتأويل</span>
          </div>
          <div className="p-2 sm:p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800 text-neutral-300">
            <span className="text-amber-400 font-bold block mb-0.5 text-[11px] sm:text-xs">٣. الرد الاستباقي</span>
            <span className="text-[10px] sm:text-[11px] text-neutral-400">تفنيد دفوع ممثلي الجهة</span>
          </div>
          <div className="p-2 sm:p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800 text-neutral-300">
            <span className="text-amber-400 font-bold block mb-0.5 text-[11px] sm:text-xs">٤. مسودة الطعن</span>
            <span className="text-[10px] sm:text-[11px] text-neutral-400">صياغة محكمة لا تُرد</span>
          </div>
        </div>
      </div>

      {/* Quick Tools Callout: Dossier (Protected with National ID), Repository, Article 8 Calculator & File Upload */}
      <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
        {/* Case Dossier Direct Card - Bound to National ID */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/15 to-amber-600/10 border border-amber-500/50 text-right shadow-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center justify-center shrink-0 font-bold shadow-xs">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-300 truncate">ملف الترافع (محمي)</div>
              <div className="text-[10px] sm:text-[11px] text-neutral-400 truncate">مقيد بالهوية الوطنية</div>
            </div>
          </div>
          {onOpenDossier && (
            <button
              id="quick-dossier-btn"
              type="button"
              onClick={onOpenDossier}
              className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-neutral-950 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer border border-amber-500/40"
            >
              <span>فك القفل</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* National ID Judgment Repository Starter */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 text-right">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Award className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-200 truncate">سجل الأحكام بالهوية</div>
              <div className="text-[10px] sm:text-[11px] text-neutral-400 truncate">تتبع صكوك القضية</div>
            </div>
          </div>
          {onOpenRepository && (
            <button
              id="quick-repository-btn"
              type="button"
              onClick={onOpenRepository}
              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer border border-neutral-700"
            >
              <span>السجل</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 text-right">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 text-amber-400 flex items-center justify-center shrink-0 border border-neutral-750">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-neutral-200 truncate">حاسبة الميعاد (م/8)</div>
              <div className="text-[10px] sm:text-[11px] text-neutral-400 truncate">مهل التظلم والطعن</div>
            </div>
          </div>
          <button
            id="quick-article8-btn"
            type="button"
            onClick={onOpenArticle8}
            className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer border border-neutral-700"
          >
            <span>الحاسبة</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 text-right">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 text-amber-400 border border-neutral-750 flex items-center justify-center shrink-0">
              <FileUp className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-neutral-200 truncate">فحص صك أو قرار</div>
              <div className="text-[10px] sm:text-[11px] text-neutral-400 truncate">رفع صكوك وقرارات</div>
            </div>
          </div>
          {onUploadClick && (
            <button
              id="quick-upload-starter-btn"
              type="button"
              onClick={onUploadClick}
              className="px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-amber-300 border border-neutral-700 hover:border-amber-500/40 text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>رفع</span>
            </button>
          )}
        </div>
      </div>

      {/* Starter Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-right">
        {PROMPT_TEMPLATES.map((template) => {
          const Icon = CATEGORY_ICONS[template.category] || Scale;
          return (
            <button
              key={template.id}
              id={`starter-${template.id}`}
              onClick={() => onSelectPrompt(template)}
              className="group p-3.5 sm:p-4 rounded-xl border border-neutral-800 hover:border-amber-500/50 hover:bg-neutral-900 transition-all bg-neutral-900/60 shadow-sm flex flex-col justify-between text-right cursor-pointer"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400/90">
                    <Icon className="w-3.5 h-3.5 text-amber-400" />
                    {template.category}
                  </span>
                  <span className="text-[11px] text-neutral-500 group-hover:text-amber-300 transition-colors flex items-center gap-1 font-medium">
                    استخدام <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform" />
                  </span>
                </div>
                <h2 className="text-xs sm:text-sm font-bold text-neutral-100 mb-1 group-hover:text-amber-300 transition-colors">
                  {template.title}
                </h2>
                <p className="text-[11px] sm:text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                  {template.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
