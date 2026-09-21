import React, { useState } from 'react';
import {
  Scale,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Check,
  RotateCcw,
  FileText,
  Paperclip,
  Gavel,
  BookOpen,
  ArrowRight,
  Copy,
  AlertCircle,
  Layers,
  ChevronDown,
  ChevronUp,
  Printer,
  Download,
} from 'lucide-react';
import { DetailedJudgesReviewReport, DetailedJudgeItem } from '../types';
import { printLegalMemo } from '../utils/printMemo';

interface JudgesSourceAudit {
  officialSources: number;
  verifiedArticles: number;
  blockers: string[];
  literalQuotationReady: boolean;
  precedentCorpusReady: boolean;
}

interface JudgesCassationReviewPanelProps {
  report: DetailedJudgesReviewReport | null;
  sourceAudit?: JudgesSourceAudit | null;
  isLoading: boolean;
  onRunAudit: () => void;
  onApplyFullRevision: (revisedText: string) => void;
  onApplySpecificAmendment: (amendmentText: string) => void;
  currentEditorText: string;
  documentTitle?: string;
  previousEditorText?: string;
  onRestorePreviousText?: () => void;
}

export function JudgesCassationReviewPanel({
  report,
  sourceAudit,
  isLoading,
  onRunAudit,
  onApplyFullRevision,
  onApplySpecificAmendment,
  currentEditorText,
  documentTitle,
  previousEditorText,
  onRestorePreviousText,
}: JudgesCassationReviewPanelProps) {
  const [activeTab, setActiveTab] = useState<'judges' | 'errors' | 'revised'>('errors');
  const [copiedRevision, setCopiedRevision] = useState(false);
  const [appliedNotification, setAppliedNotification] = useState<string | null>(null);
  const [expandedJudge, setExpandedJudge] = useState<string | null>('judge_cassation');

  const reviewFailed = report?.overallStatus === 'تعذر إكمال الفحص الآلي';
  const isSoundDocument =
    !reviewFailed &&
    ((report?.cassationErrors?.items?.length === 0 && report?.claimErrors?.items?.length === 0) ||
      report?.overallStatus === 'جاهز للإيداع');

  // Safeguard: Always use the complete text; never allow truncated or reduced versions
  const effectiveText =
    report?.revisedDocument && report.revisedDocument.length >= currentEditorText.length * 0.85
      ? report.revisedDocument
      : currentEditorText;

  const handlePrint = () => {
    printLegalMemo(effectiveText, documentTitle || 'لائحة طعن بالنقض - ديوان المظالم');
  };

  const handleExportWord = () => {
    const title = documentTitle || 'لائحة_طعن_بالنقض';
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${title}</title><style>body { font-family: 'Traditional Arabic', 'Arial', sans-serif; font-size: 16pt; direction: rtl; text-align: right; line-height: 1.8; }</style></head><body dir='rtl'>`;
    const footer = '</body></html>';
    const sourceHTML = header + `<div style="white-space: pre-wrap;">${effectiveText}</div>` + footer;

    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement('a');
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `${title.replace(/\s+/g, '_')}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRevision(true);
    setTimeout(() => setCopiedRevision(false), 2500);
  };

  const handleApplyFull = (text: string) => {
    onApplyFullRevision(text);
    setAppliedNotification('تم تطبيق الصياغة المنقحة بالكامل في المحرر بنجاح ✓');
    setTimeout(() => setAppliedNotification(null), 4000);
  };

  const handleApplySpecific = (text: string, judgeName: string) => {
    onApplySpecificAmendment(text);
    setAppliedNotification(`تم إدراج تعديل ${judgeName} في المحرر ✓`);
    setTimeout(() => setAppliedNotification(null), 4000);
  };

  if (isLoading) {
    return (
      <div className="p-8 rounded-3xl bg-neutral-900/90 border border-amber-500/30 text-center space-y-5 animate-pulse">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
          <Gavel className="w-8 h-8 animate-bounce" />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-bold text-neutral-100">
            تشغيل هيئة المراجعة القانونية الآلية متعددة المسارات...
          </h3>
          <p className="text-xs text-neutral-400 max-w-lg mx-auto leading-relaxed">
            يجري الآن تحليل أوجه الاعتراض، وتدقيق الدعوى والطلبات والمرفقات، مع تمييز ما تم التحقق منه مرجعياً عما يحتاج مراجعة مصدر رسمي.
          </p>
        </div>
        <div className="flex justify-center gap-2 pt-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800 text-[11px] text-amber-300 border border-neutral-700">
            <Scale className="w-3.5 h-3.5" />
            <span>مراجع الاستئناف</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800 text-[11px] text-rose-300 border border-neutral-700">
            <Gavel className="w-3.5 h-3.5" />
            <span>مراجع النقض</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-800 text-[11px] text-sky-300 border border-neutral-700">
            <Paperclip className="w-3.5 h-3.5" />
            <span>مراجع المرفقات</span>
          </span>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="p-6 rounded-3xl bg-neutral-900 border border-neutral-800 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <Scale className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-neutral-100">هيئة المراجعة القانونية الآلية</h4>
          <p className="text-xs text-neutral-400 max-w-md mx-auto mt-1 leading-relaxed">
            بعد مراجعة البيانات، شغّل هيئة تحليلية متعددة الأدوار لفحص أوجه الاعتراض والدعوى والمرفقات. هذه مراجعة آلية وليست رأياً صادراً من محكمة أو قاضٍ.
          </p>
        </div>
        <button
          onClick={onRunAudit}
          className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs flex items-center gap-2 mx-auto shadow-md transition-all cursor-pointer"
        >
          <Gavel className="w-4 h-4" />
          <span>بدء المراجعة القانونية الآلية</span>
        </button>
      </div>
    );
  }

  const scoredJudges = report.judges.filter(
    (judge): judge is DetailedJudgeItem & { scoreOutOf100: number } =>
      typeof judge.scoreOutOf100 === 'number' && Number.isFinite(judge.scoreOutOf100)
  );
  const averageScore =
    scoredJudges.length > 0
      ? Math.round(scoredJudges.reduce((acc, judge) => acc + judge.scoreOutOf100, 0) / scoredJudges.length)
      : null;

  return (
    <div className="rounded-3xl bg-neutral-900/95 border border-amber-500/30 overflow-hidden shadow-2xl space-y-0 transition-all text-right">
      {/* 1. Header & Verdict Banner */}
      <div className="p-4 sm:p-5 bg-gradient-to-b from-neutral-900 via-neutral-900 to-neutral-950 border-b border-neutral-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0">
              <Gavel className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-neutral-100">
                  تقرير هيئة المراجعة القانونية الآلية
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {reviewFailed ? 'الفحص غير مكتمل' : 'فحص وتعديل مكتمل'}
                </span>
              </div>
              <p className="text-xs text-neutral-400 mt-0.5">
                تحليل أوجه الاعتراض • أخطاء الدعوى والطلبات • تدقيق المرفقات • مسودة تعديل للمراجعة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <div className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-center">
              <div className="text-[10px] text-neutral-400 font-medium">مؤشر التحليل</div>
              <div className="text-sm font-bold font-mono text-amber-400">{averageScore === null ? 'غير مقيم' : `${averageScore}%`}</div>
            </div>
            <button
              onClick={onRunAudit}
              className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 transition-colors cursor-pointer"
              title="إعادة الفحص والتدقيق"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">إعادة الفحص</span>
            </button>
          </div>
        </div>

        {reviewFailed && (
          <div className="mt-3.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-100 leading-relaxed">
              لم يكتمل الفحص الآلي؛ لذلك لم تُمنح المذكرة أي درجة سلامة، ولا تُعد خلو قوائم الأخطاء دليلاً على سلامة المستند. أعد الفحص قبل تطبيق أي تعديل أو اعتماد النتيجة.
            </div>
          </div>
        )}

        {sourceAudit && (
          <div className={
            'mt-3.5 p-3 rounded-2xl border flex items-start gap-2.5 ' +
            (sourceAudit.blockers.length > 0
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-emerald-500/10 border-emerald-500/25')
          }>
            <BookOpen className={
              'w-4 h-4 shrink-0 mt-0.5 ' +
              (sourceAudit.blockers.length > 0 ? 'text-amber-400' : 'text-emerald-400')
            } />
            <div className="min-w-0 text-xs leading-relaxed">
              <div className="font-bold text-neutral-200">حالة التحقق المرجعي</div>
              <div className="mt-1 text-neutral-400">
                مصادر رسمية: {sourceAudit.officialSources} • مواد مفهرسة: {sourceAudit.verifiedArticles}
                {' • '}النص الحرفي: {sourceAudit.literalQuotationReady ? 'متحقق' : 'يحتاج مطابقة المصدر'}
                {' • '}السوابق الكاملة: {sourceAudit.precedentCorpusReady ? 'جاهزة' : 'غير مكتملة'}
              </div>
              {sourceAudit.blockers.length > 0 && (
                <ul className="mt-2 space-y-1 text-[11px] text-amber-100/75">
                  {sourceAudit.blockers.slice(0, 4).map((item, index) => (
                    <li key={index}>• {item}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

                {/* Primary Fatal Flaw Callout */}
        {report.primaryFatalDefect && (
          <div className="mt-3.5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-bold text-rose-300 ml-1">مكمن الخلل الأبرز وفق التحليل:</span>
              <span className="text-neutral-200 leading-relaxed font-medium">{report.primaryFatalDefect}</span>
            </div>
          </div>
        )}

        {/* Floating Applied Toast */}
        {appliedNotification && (
          <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 animate-bounce">
            <Check className="w-4 h-4" />
            <span>{appliedNotification}</span>
          </div>
        )}
      </div>

      {/* 2. Top Navigation Tabs */}
      <div className="px-4 py-2 bg-neutral-950/80 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('errors')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'errors'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>تشخيص أخطاء النقض والدعوى والمرفقات</span>
          </button>

          <button
            onClick={() => setActiveTab('judges')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'judges'
                ? 'bg-amber-500 text-neutral-950 shadow-xs'
                : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>آراء مسارات المراجعة ({report.judges.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('revised')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'revised'
                ? 'bg-emerald-500 text-neutral-950 shadow-xs'
                : 'bg-neutral-900 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>
              {isSoundDocument
                ? 'المسودة المنقحة — راجعها قبل الطباعة'
                : 'اقتراح التعديلات وصياغة مسودة للمراجعة'}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            title="طباعة المسودة الحالية بعد مراجعتك البشرية"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>معاينة/طباعة المسودة (PDF)</span>
          </button>

          {activeTab === 'revised' && (
            <button
              onClick={() => handleApplyFull(effectiveText)}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>تطبيق في المحرر</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Content Views */}
      <div className="p-4 sm:p-5">
        {/* VIEW A: THREE CORE ERROR DOMAINS (النقض • الدعوى • المرفقات) */}
        {activeTab === 'errors' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                <span>فحص ومطابقة مكامن الخلل القضائي في الأوجه الثلاثة المطلوبة:</span>
              </h4>
              <span className="text-[11px] text-neutral-400">تدقيق إجرائي وموضوعي دقيق</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* 1. أخطاء وعوار النقض */}
              <div className={`p-4 rounded-2xl bg-neutral-950 space-y-2.5 flex flex-col justify-between border ${
                !reviewFailed && report.cassationErrors.items.length === 0 ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-rose-500/30'
              }`}>
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      {!reviewFailed && report.cassationErrors.items.length === 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Gavel className="w-4 h-4 text-rose-400" />
                      )}
                      <h5 className={`text-xs font-bold ${!reviewFailed && report.cassationErrors.items.length === 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                        {report.cassationErrors.title || 'أخطاء وعوار النقض'}
                      </h5>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      !reviewFailed && report.cassationErrors.items.length === 0
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    }`}>
                      {!reviewFailed && report.cassationErrors.items.length === 0 ? 'لم تُرصد ملاحظات ✓' : `خطورة ${report.cassationErrors.severity || 'عالية'}`}
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-400 mt-2">
                    تحليل أوجه الاعتراض والنقض بحسب المستند والمراجع التي تم استرجاعها والتحقق منها في هذه العملية:
                  </p>

                  {!reviewFailed && report.cassationErrors.items.length === 0 ? (
                    <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                      <p className="text-xs text-emerald-300 font-semibold">لم تُرصد ملاحظات نقض في هذا المسار</p>
                      <p className="text-[11px] text-neutral-300 leading-relaxed">
                        لم يسجل مسار التحليل ملاحظة إضافية هنا؛ لا يعني ذلك سلامة المستند خارج نطاق البيانات والمراجع المتاحة.
                      </p>
                    </div>
                  ) : (
                    <ul className="mt-2.5 space-y-2">
                      {report.cassationErrors.items.map((item, idx) => (
                        <li key={idx} className="text-xs text-neutral-200 flex items-start gap-2 bg-neutral-900/60 p-2 rounded-xl border border-neutral-800/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shrink-0 mt-1.5" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-2 text-[10px] text-neutral-400 border-t border-neutral-900 flex items-center justify-between">
                  <span>محكمة النقض (المحكمة العليا)</span>
                  <span className={!reviewFailed && report.cassationErrors.items.length === 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
                    {!reviewFailed && report.cassationErrors.items.length === 0 ? 'لا ملاحظات مسجلة ✓' : `${report.cassationErrors.items.length} عيوب مرصودة`}
                  </span>
                </div>
              </div>

              {/* 2. أخطاء وعيوب عريضة الدعوى */}
              <div className={`p-4 rounded-2xl bg-neutral-950 space-y-2.5 flex flex-col justify-between border ${
                !reviewFailed && report.claimErrors.items.length === 0 ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-amber-500/30'
              }`}>
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      {!reviewFailed && report.claimErrors.items.length === 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <FileText className="w-4 h-4 text-amber-400" />
                      )}
                      <h5 className={`text-xs font-bold ${!reviewFailed && report.claimErrors.items.length === 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                        {report.claimErrors.title || 'أخطاء عريضة الدعوى والطلبات'}
                      </h5>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      !reviewFailed && report.claimErrors.items.length === 0
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}>
                      {!reviewFailed && report.claimErrors.items.length === 0 ? 'لم تُرصد ملاحظات ✓' : `خطورة ${report.claimErrors.severity || 'متوسطة'}`}
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-400 mt-2">
                    تحرير النزاع، بيان الصفة والمصلحة، وتعيين الطلبات القضائية الجازمة دون تجهيل أو غموض:
                  </p>

                  {!reviewFailed && report.claimErrors.items.length === 0 ? (
                    <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                      <p className="text-xs text-emerald-300 font-semibold">صياغة الطلبات جازمة ومحكمة</p>
                      <p className="text-[11px] text-neutral-300 leading-relaxed">
                        تم الفصل المتقن بين الطلبات الأصلية والاحتياطية مع تحديد المدعى ضده بدقة.
                      </p>
                    </div>
                  ) : (
                    <ul className="mt-2.5 space-y-2">
                      {report.claimErrors.items.map((item, idx) => (
                        <li key={idx} className="text-xs text-neutral-200 flex items-start gap-2 bg-neutral-900/60 p-2 rounded-xl border border-neutral-800/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="pt-2 text-[10px] text-neutral-400 border-t border-neutral-900 flex items-center justify-between">
                  <span>محكمة الاستئناف والموضوع</span>
                  <span className={!reviewFailed && report.claimErrors.items.length === 0 ? 'text-emerald-400 font-semibold' : 'text-amber-400 font-semibold'}>
                    {!reviewFailed && report.claimErrors.items.length === 0 ? 'لا ملاحظات مسجلة ✓' : `${report.claimErrors.items.length} ملاحظات صياغة`}
                  </span>
                </div>
              </div>

              {/* 3. أخطاء ونواقص المرفقات */}
              <div className={`p-4 rounded-2xl bg-neutral-950 space-y-2.5 flex flex-col justify-between border ${
                !reviewFailed && report.attachmentErrors.items.length === 0 ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-sky-500/30'
              }`}>
                <div>
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      {!reviewFailed && report.attachmentErrors.items.length === 0 ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Paperclip className="w-4 h-4 text-sky-400" />
                      )}
                      <h5 className={`text-xs font-bold ${!reviewFailed && report.attachmentErrors.items.length === 0 ? 'text-emerald-300' : 'text-sky-300'}`}>
                        {report.attachmentErrors.title || 'أخطاء ونواقص المرفقات'}
                      </h5>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      !reviewFailed && report.attachmentErrors.items.length === 0
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                    }`}>
                      {!reviewFailed && report.attachmentErrors.items.length === 0 ? 'مستوفٍ تماماً ✓' : `خطورة ${report.attachmentErrors.severity || 'عالية'}`}
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-400 mt-2">
                    كفاية وحجية البينات والمحررات وفق نظام الإثبات والمستندات الواجب إيداعها لإثبات الحق:
                  </p>

                  {!reviewFailed && report.attachmentErrors.items.length === 0 ? (
                    <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-1">
                      <p className="text-xs text-emerald-300 font-semibold">مرفقات مرحلة النقض مستوفاة</p>
                      <p className="text-[11px] text-neutral-300 leading-relaxed">
                        تم حصر صك حكم الاستئناف وتاريخ التبليغ؛ يرجى فقط إرفاق ملفاتها عند القيد بمنصة معين.
                      </p>
                    </div>
                  ) : (
                    <ul className="mt-2.5 space-y-2">
                      {report.attachmentErrors.items.map((item, idx) => (
                        <li key={idx} className="text-xs text-neutral-200 flex items-start gap-2 bg-neutral-900/60 p-2 rounded-xl border border-neutral-800/80">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0 mt-1.5" />
                          <span className="leading-relaxed">{item}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Missing Required Docs */}
                  {report.attachmentErrors.missingRequiredDocs && report.attachmentErrors.missingRequiredDocs.length > 0 && (
                    <div className="mt-3 p-2.5 rounded-xl bg-sky-950/40 border border-sky-500/20 space-y-1.5">
                      <span className="text-[10px] font-bold text-sky-300 block">وثائق لازمة يوصى بإرفاقها فوراً:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {report.attachmentErrors.missingRequiredDocs.map((doc, idx) => (
                          <span key={idx} className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-900 text-sky-200 border border-sky-500/30 font-medium">
                            📎 {doc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 text-[10px] text-neutral-400 border-t border-neutral-900 flex items-center justify-between">
                  <span>دائرة تدقيق المرفقات</span>
                  <span className={!reviewFailed && report.attachmentErrors.items.length === 0 ? 'text-emerald-400 font-semibold' : 'text-sky-400 font-semibold'}>
                    {!reviewFailed && report.attachmentErrors.items.length === 0 ? 'مستندات كافية ✓' : `${report.attachmentErrors.items.length} نواقص مسجلة`}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Switch to Full Revision */}
            <div className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-neutral-300">
                  أنتجت هيئة المراجعة الآلية مسودة منقحة استناداً إلى التحليل المتاح. راجع النص والمصادر الرسمية قبل الإيداع:
                </span>
              </div>
              <button
                onClick={() => setActiveTab('revised')}
                className="px-3.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <span>معاينة وتطبيق الصياغة المعدلة</span>
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              </button>
            </div>
          </div>
        )}

        {/* VIEW B: THREE JUDGES OPINIONS & SPECIFIC AMENDMENTS */}
        {activeTab === 'judges' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-300">
                أعضاء الدائرة القضائية الثلاثية وفحصهم المتخصص:
              </h4>
              <span className="text-[11px] text-neutral-400">انقر على أي قاضٍ لمعاينة تفاصيل التسبيب والتعديل</span>
            </div>

            <div className="space-y-3">
              {report.judges.map((judge) => {
                const isExpanded = expandedJudge === judge.judgeId;
                const badgeColor =
                  judge.judgeId === 'judge_appeal'
                    ? 'border-amber-500/40 text-amber-300 bg-amber-500/10'
                    : judge.judgeId === 'judge_cassation'
                    ? 'border-rose-500/40 text-rose-300 bg-rose-500/10'
                    : 'border-sky-500/40 text-sky-300 bg-sky-500/10';

                return (
                  <div
                    key={judge.judgeId}
                    className="rounded-2xl bg-neutral-950 border border-neutral-800 overflow-hidden transition-all"
                  >
                    {/* Judge Accordion Header */}
                    <button
                      onClick={() => setExpandedJudge(isExpanded ? null : judge.judgeId)}
                      className="w-full p-3.5 flex items-center justify-between gap-3 text-right hover:bg-neutral-900/60 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-700 flex items-center justify-center text-amber-400 shrink-0 font-bold text-xs">
                          <Scale className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-bold text-neutral-100">{judge.judgeName}</h5>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${badgeColor}`}>
                              {judge.courtCategory}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-0.5">{judge.judgeTitle}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-[10px] font-mono text-neutral-400 hidden sm:inline">
                          درجة التدقيق: <b className="text-amber-400">{judge.scoreOutOf100}%</b>
                        </span>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-200">
                          {judge.verdict}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-neutral-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-neutral-400" />
                        )}
                      </div>
                    </button>

                    {/* Judge Expanded Body */}
                    {isExpanded && (
                      <div className="p-4 border-t border-neutral-900 bg-neutral-950/60 space-y-3.5">
                        {/* Errors Identified */}
                        {judge.errorsIdentified && judge.errorsIdentified.length > 0 && (
                          <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-1.5">
                            <span className="text-[11px] font-bold text-rose-400 block">الملاحظات المرصودة من مسار المراجعة:</span>
                            <ul className="space-y-1">
                              {judge.errorsIdentified.map((err, i) => (
                                <li key={i} className="text-xs text-neutral-300 flex items-start gap-2">
                                  <span className="text-rose-400 font-bold">•</span>
                                  <span>{err}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Detailed Critique */}
                        <div className="p-3 rounded-xl bg-neutral-900/50 border border-neutral-800/80 space-y-1">
                          <span className="text-[11px] font-bold text-amber-300 block">التسبيب والنقد القضائي:</span>
                          <p className="text-xs text-neutral-300 leading-relaxed">{judge.critique}</p>
                        </div>

                        {/* Judge's Recommended Amendment */}
                        {judge.specificAmendment && (
                          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1 flex-1">
                              <span className="text-[11px] font-bold text-amber-300 block">التعديل المقترح من مسار المراجعة:</span>
                              <p className="text-xs text-neutral-200 leading-relaxed font-mono bg-neutral-950/70 p-2.5 rounded-lg border border-neutral-800">
                                {judge.specificAmendment}
                              </p>
                            </div>
                            <button
                              onClick={() => handleApplySpecific(judge.specificAmendment, judge.judgeName)}
                              className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 self-end sm:self-center shadow-xs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>تطبيق التعديل المقترح</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* VIEW C: FULL REVISED AND AMENDED DOCUMENT */}
        {activeTab === 'revised' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div
              className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                isSoundDocument
                  ? 'bg-emerald-950/25 border-emerald-500/40 text-emerald-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-neutral-200'
              }`}
            >
              <div className="flex items-start sm:items-center gap-2.5 text-xs">
                {isSoundDocument ? (
                  <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                ) : (
                  <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />
                )}
                <div>
                  <span className="font-bold text-emerald-300 block text-sm">
                    {isSoundDocument
                      ? 'اللائحة صحيحة ومستوفية للأصول القضائية 100% بكافة تفاصيلها وأسانيدها'
                      : 'تم تنقيح وتعديل المذكرة وفق مبادئ الاستئناف والنقض ونظام الإثبات'}
                  </span>
                  <span className="text-[11px] text-neutral-300">
                    {isSoundDocument
                      ? 'تم اعتماد النص الكامل بكافة تواريخه، أرقام صكوكه، نصوص المراسيم الملكية (م/37)، وقائمة المرفقات الخمسة دون أي حذف أو تقليل للمعلومات.'
                      : 'تم تدقيق العوار القضائي مع الحفاظ التام على كامل بيانات القضية.'}
                  </span>
                </div>
              </div>

              {/* Direct Export & Print Toolbar */}
              <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
                <button
                  onClick={handlePrint}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                  title="طباعة المسودة الحالية بعد مراجعتك البشرية A4"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة اللائحة (PDF)</span>
                </button>

                <button
                  onClick={handleExportWord}
                  className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-100 border border-neutral-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="تصدير بصيغة Word (.doc)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تصدير Word</span>
                </button>

                <button
                  onClick={() => handleCopy(effectiveText)}
                  className="px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedRevision ? 'تم النسخ!' : 'نسخ النص'}</span>
                </button>

                <button
                  onClick={() => handleApplyFull(effectiveText)}
                  className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>تطبيق في المحرر</span>
                </button>
              </div>
            </div>

            {/* Verification Guarantee Metadata */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>المسودة الحالية: {effectiveText.length.toLocaleString('ar-SA')} حرفاً • تحقق من الحيثيات والمرفقات والمصادر قبل الاعتماد</span>
              </span>
              <span className="text-neutral-400">جاهز للإيداع المباشر في منصة معين / ناجز</span>
            </div>

            {/* Change Log Chips */}
            {report.changeLog && report.changeLog.length > 0 && (
              <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-2">
                <span className="text-[11px] font-bold text-neutral-400 block">
                  سجل المراجعة التحليلية الآلية:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {report.changeLog.map((change, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-neutral-900 text-neutral-300 border border-neutral-700/80 flex items-center gap-1"
                    >
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span>{change}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Revised Document Text Box */}
            <div className="relative rounded-2xl bg-neutral-950 border border-emerald-500/20 p-4 font-mono text-xs text-neutral-200 leading-relaxed whitespace-pre-wrap max-h-[520px] overflow-y-auto selection:bg-emerald-500/30">
              {effectiveText}
            </div>

            {/* Undo / Revert Option if already applied */}
            {previousEditorText && onRestorePreviousText && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={onRestorePreviousText}
                  className="text-xs text-neutral-400 hover:text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>استعادة نص المسودة السابقة قبل تطبيق التعديل</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Unified Synthesis Footer */}
      {report.synthesisAdvice && (
        <div className="px-5 py-3.5 bg-neutral-950 border-t border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-amber-300">الخلاصة القضائية الموحدة لتفادي البطلان: </span>
              <span className="text-neutral-300">{report.synthesisAdvice}</span>
            </div>
          </div>

          {activeTab !== 'revised' && (
            <button
              onClick={() => handleApplyFull(report.revisedDocument)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer self-end sm:self-center shadow-xs"
            >
              <Check className="w-3.5 h-3.5" />
              <span>تطبيق الصياغة المعدلة</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
