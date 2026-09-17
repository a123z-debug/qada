import React, { useState } from 'react';
import {
  Scale,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  FileSearch,
  UserCheck,
  ChevronDown,
  Sparkles,
  Gavel,
  Check,
  X,
  ExternalLink,
  BookOpen,
  Building2,
} from 'lucide-react';
import { CassationAuditReport, CassationJudgeOpinion, JudgeCourtCategory } from '../types';

interface CassationJudgesPanelProps {
  report: CassationAuditReport;
  onApplyRemedy?: (remedyText: string) => void;
  onDismiss?: () => void;
  compact?: boolean;
}

export function CassationJudgesPanel({
  report,
  onApplyRemedy,
  onDismiss,
  compact = false,
}: CassationJudgesPanelProps) {
  const [selectedCourtTab, setSelectedCourtTab] = useState<'الكل' | JudgeCourtCategory>(
    report.targetCourt || 'الكل'
  );

  // Update selected court tab if report changes
  React.useEffect(() => {
    if (report.targetCourt) {
      setSelectedCourtTab(report.targetCourt);
    }
  }, [report.targetCourt, report.timestamp]);

  // Collect all judges (safely fallback to judge1 & judge2 if judges array is missing)
  const allJudges: CassationJudgeOpinion[] = React.useMemo(() => {
    if (Array.isArray(report.judges) && report.judges.length > 0) {
      return report.judges;
    }
    const fallback: CassationJudgeOpinion[] = [];
    if (report.judge1) fallback.push({ ...report.judge1, courtCategory: report.judge1.courtCategory || 'المحكمة الإدارية' });
    if (report.judge2) fallback.push({ ...report.judge2, courtCategory: report.judge2.courtCategory || 'المحكمة الإدارية' });
    return fallback;
  }, [report]);

  const filteredJudges = selectedCourtTab === 'الكل'
    ? allJudges
    : allJudges.filter((j) => j.courtCategory === selectedCourtTab);

  const getVerdictBadge = (verdict: CassationJudgeOpinion['verdict']) => {
    switch (verdict) {
      case 'مقبول شكلاً وموضوعاً':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
          icon: CheckCircle2,
        };
      case 'مرفوض شكلاً':
        return {
          bg: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
          icon: XCircle,
        };
      case 'خطر السقوط الشكلي':
      case 'معيب موضوعاً':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
          icon: AlertTriangle,
        };
      default:
        return {
          bg: 'bg-purple-500/10 border-purple-500/30 text-purple-300',
          icon: ShieldAlert,
        };
    }
  };

  const getOverallStatusBanner = () => {
    if (report.overallStatus === 'جاهز للإيداع') {
      return {
        bg: 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200',
        badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        icon: ShieldCheck,
      };
    }
    if (report.overallStatus === 'خطر السقوط الشكلي') {
      return {
        bg: 'bg-rose-950/40 border-rose-500/50 text-rose-200',
        badge: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
        icon: XCircle,
      };
    }
    return {
      bg: 'bg-amber-950/40 border-amber-500/40 text-amber-200',
      badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      icon: AlertTriangle,
    };
  };

  const banner = getOverallStatusBanner();

  return (
    <div
      id="cassation-judges-audit-card"
      className="my-3.5 rounded-2xl border border-neutral-750 bg-neutral-900/90 shadow-xl overflow-hidden text-right"
    >
      {/* Top Banner: Supreme Judicial Oversight Header */}
      <div className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2.5 ${banner.bg}`}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shadow-xs">
            <Gavel className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-neutral-100 flex items-center gap-1.5">
                <span>هيئة قضاة الرقابة والتدقيق (الإدارية • الجزائية • العامة)</span>
                <span className="text-[10px] text-amber-400 font-mono px-1.5 py-0.5 rounded-sm bg-neutral-950/60 border border-neutral-800">
                  {allJudges.length} قضاة (٢ لكل محكمة)
                </span>
              </h4>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${banner.badge}`}>
                {report.overallStatus}
              </span>
            </div>
            <p className="text-[11px] text-neutral-300 mt-0.5">
              نوع المرفوع المفحوص: <span className="text-amber-300 font-bold">{report.documentType}</span>
            </p>
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800/60 transition-colors cursor-pointer"
            title="إخفاء التقرير"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter Tabs by Court Jurisdiction */}
      <div className="px-4 py-2 bg-neutral-950/80 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <button
            onClick={() => setSelectedCourtTab('الكل')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              selectedCourtTab === 'الكل'
                ? 'bg-amber-500 text-neutral-950 font-bold shadow-xs'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            جميع القضاة ({allJudges.length})
          </button>
          <button
            onClick={() => setSelectedCourtTab('المحكمة الإدارية')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
              selectedCourtTab === 'المحكمة الإدارية'
                ? 'bg-sky-500 text-neutral-950 font-bold shadow-xs'
                : 'bg-neutral-900 text-neutral-400 hover:text-sky-300 border border-neutral-800'
            }`}
          >
            <Scale className="w-3 h-3" />
            <span>المحكمة الإدارية (٢)</span>
          </button>
          <button
            onClick={() => setSelectedCourtTab('المحكمة الجزائية')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
              selectedCourtTab === 'المحكمة الجزائية'
                ? 'bg-rose-500 text-neutral-950 font-bold shadow-xs'
                : 'bg-neutral-900 text-neutral-400 hover:text-rose-300 border border-neutral-800'
            }`}
          >
            <ShieldAlert className="w-3 h-3" />
            <span>المحكمة الجزائية (٢)</span>
          </button>
          <button
            onClick={() => setSelectedCourtTab('المحكمة العامة')}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
              selectedCourtTab === 'المحكمة العامة'
                ? 'bg-emerald-500 text-neutral-950 font-bold shadow-xs'
                : 'bg-neutral-900 text-neutral-400 hover:text-emerald-300 border border-neutral-800'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            <span>المحكمة العامة (٢)</span>
          </button>
        </div>

        <span className="text-[11px] text-neutral-400 hidden sm:inline">
          تدقيق شامل وفق الأنظمة واللوائح وسوابق المحكمة العليا
        </span>
      </div>

      {/* Primary Flaw Highlight Callout */}
      {report.primaryFatalDefect && (
        <div className="px-4 py-2.5 bg-neutral-950/70 border-b border-neutral-800/80 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-bold text-rose-300 ml-1">مكمن الخلل الأبرز المرصود:</span>
            <span className="text-neutral-200 font-medium">{report.primaryFatalDefect}</span>
          </div>
        </div>
      )}

      {/* Judges Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 gap-px bg-neutral-800">
        {filteredJudges.map((judge, idx) => (
          <div key={judge.judgeId || idx} className="bg-neutral-950/70">
            <JudgeBox
              judge={judge}
              getVerdictBadge={getVerdictBadge}
              onApplyRemedy={onApplyRemedy}
            />
          </div>
        ))}
      </div>

      {/* Unified Synthesis / Remedy Footer */}
      {report.synthesisAdvice && (
        <div className="px-4 py-3 bg-neutral-900 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300">الخلاصة القضائية الموحدة لتدارك البطلان: </span>
              <span className="text-neutral-300">{report.synthesisAdvice}</span>
            </div>
          </div>
          {onApplyRemedy && (
            <button
              onClick={() => onApplyRemedy(report.synthesisAdvice)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer self-end sm:self-center shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>إدراج التصحيح في الصندوق</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function JudgeBox({
  judge,
  getVerdictBadge,
  onApplyRemedy,
}: {
  judge: CassationJudgeOpinion;
  getVerdictBadge: (verdict: CassationJudgeOpinion['verdict']) => {
    bg: string;
    icon: typeof CheckCircle2;
  };
  onApplyRemedy?: (remedyText: string) => void;
}) {
  const badge = getVerdictBadge(judge.verdict);
  const VerdictIcon = badge.icon;

  const getCourtBadgeColor = (court?: JudgeCourtCategory) => {
    switch (court) {
      case 'المحكمة الجزائية':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/40';
      case 'المحكمة العامة':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
      case 'المحكمة الإدارية':
      default:
        return 'bg-sky-500/15 text-sky-300 border-sky-500/40';
    }
  };

  return (
    <div className="p-4 flex flex-col justify-between space-y-3 text-right h-full">
      {/* Judge Header */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-neutral-800 border border-neutral-700 text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h5 className="text-xs font-bold text-neutral-100">{judge.judgeName}</h5>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md border font-semibold ${getCourtBadgeColor(judge.courtCategory)}`}>
                  {judge.courtCategory || 'المحكمة الإدارية'}
                </span>
              </div>
              <p className="text-[10px] text-neutral-400 truncate max-w-[220px]">{judge.judgeTitle}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${badge.bg}`}
            >
              <VerdictIcon className="w-3 h-3" />
              <span>{judge.verdict}</span>
            </span>
            <span className="text-[10px] font-mono text-neutral-400">
              مؤشر السلامة: <b className="text-amber-400">{judge.scoreOutOf100}%</b>
            </span>
          </div>
        </div>

        {/* Fatal Flaws List */}
        {judge.fatalFlaws && judge.fatalFlaws.length > 0 && (
          <div className="mt-2.5 p-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>مكامن الخلل المرصودة في المرفوع:</span>
            </div>
            <ul className="space-y-1 pr-1">
              {judge.fatalFlaws.map((flaw, idx) => (
                <li key={idx} className="text-xs text-neutral-300 flex items-start gap-1.5">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>{flaw}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Critique Analysis */}
        <div className="mt-3 space-y-2 text-xs">
          <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
            <span className="font-bold text-amber-300/90 text-[11px] block mb-0.5">
              الرقابة الإجرائية والمواعيد وشروط الدعوى:
            </span>
            <p className="text-neutral-300 leading-relaxed text-[11px]">{judge.proceduralCritique}</p>
          </div>

          <div className="p-2 rounded-lg bg-neutral-900/60 border border-neutral-800/80">
            <span className="font-bold text-sky-300/90 text-[11px] block mb-0.5">
              رقابة التطبيق الموضوعي وسوابق المحكمة العليا:
            </span>
            <p className="text-neutral-300 leading-relaxed text-[11px]">{judge.substantiveCritique}</p>
          </div>
        </div>
      </div>

      {/* Actionable Remedy Guidance */}
      {judge.actionableRemedy && (
        <div className="pt-2 border-t border-neutral-800/80 mt-auto">
          <div className="flex items-start justify-between gap-2 p-2 rounded-xl bg-amber-950/20 border border-amber-500/20 text-xs">
            <div className="min-w-0 flex-1">
              <span className="font-bold text-amber-300 text-[11px] block">توجيه القاضي لتصحيح الخلل:</span>
              <p className="text-neutral-200 text-[11px] leading-relaxed mt-0.5">{judge.actionableRemedy}</p>
            </div>
            {onApplyRemedy && (
              <button
                onClick={() => onApplyRemedy(judge.actionableRemedy)}
                className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold shrink-0 flex items-center gap-1 transition-colors cursor-pointer self-center"
                title="إدراج في صندوق الكتابة"
              >
                <span>إدراج</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

