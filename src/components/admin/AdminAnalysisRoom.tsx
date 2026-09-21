import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  CheckCircle2,
  FileSearch,
  FileText,
  ExternalLink,
  Download,
  History,
  Printer,
  Gavel,
  LoaderCircle,
  LockKeyhole,
  Scale,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UploadCloud,
} from 'lucide-react';

type AnalysisIssue = {
  id: string;
  category: string;
  severity: string;
  title: string;
  documentSegment: string;
  analysis: string;
  legalBasis: string;
  sourceUrls: string[];
  sourceStatus: string;
  impact: string;
  verificationNeeded: boolean;
};

type AdminAnalysisReport = {
  documentType: string;
  jurisdiction: string;
  executiveSummary: string;
  issues: AnalysisIssue[];
  missingFacts: string[];
  missingEvidence: string[];
  conflictingPoints: string[];
  strongestVerifiedPoints: string[];
  verificationQueue: string[];
  finalNotes: string;
};

type UploadedAttachment = {
  name: string;
  type: string;
  data: string;
};

type AgentRun = {
  id: string;
  label: string;
  status: 'success' | 'warning' | 'error';
  durationMs: number;
  model?: string;
  summary: string;
  blockers?: string[];
};

type AnalysisMeta = {
  analyzedAt?: string;
  officialContextAvailable?: boolean;
  completedAgents?: number;
  warningAgents?: number;
  failedAgents?: number;
  officialSources?: number;
  verifiedArticles?: number;
  sourceBlockers?: number;
  architecture?: string;
};

type SavedAnalysisRun = {
  runId?: string;
  documentTitle?: string;
  analyzedAt?: number | string;
  report?: AdminAnalysisReport;
  agentRuns?: AgentRun[];
  sourcePackets?: SourcePacket[];
  meta?: AnalysisMeta | null;
};

type SourcePacket = {
  agentId: string;
  label: string;
  status: 'success' | 'warning' | 'error';
  scope: string;
  references: Array<{
    name: string;
    authority?: string;
    sourceUrl: string;
    issueInstrument?: string;
    coverage?: string;
    note: string;
  }>;
  verifiedArticles: Array<{
    system: string;
    article: string;
    sourceUrl: string;
    note: string;
  }>;
  blockers: string[];
};

const severityOrder: Record<string, number> = {
  'حرج': 0,
  'عالٍ': 1,
  'متوسط': 2,
  'منخفض': 3,
  'ملاحظة': 4,
};

function severityClass(value: string) {
  if (value === 'حرج') return 'border-rose-500/40 bg-rose-500/10 text-rose-200';
  if (value === 'عالٍ') return 'border-orange-500/40 bg-orange-500/10 text-orange-200';
  if (value === 'متوسط') return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  if (value === 'منخفض') return 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200';
  return 'border-slate-600 bg-slate-800 text-slate-300';
}

function categoryClass(value: string) {
  if (['تشريعي', 'مرجعي'].includes(value)) return 'text-amber-300 border-amber-400/25 bg-amber-500/10';
  if (['قضائي', 'تسبيب', 'تكييف'].includes(value)) return 'text-violet-300 border-violet-400/25 bg-violet-500/10';
  if (['إثبات', 'تعارض'].includes(value)) return 'text-rose-300 border-rose-400/25 bg-rose-500/10';
  if (['إجرائي', 'اختصاص'].includes(value)) return 'text-cyan-300 border-cyan-400/25 bg-cyan-500/10';
  return 'text-slate-300 border-slate-600 bg-slate-800';
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('تعذر قراءة الملف.'));
    reader.readAsDataURL(file);
  });
}

export function AdminAnalysisRoom({ onBack }: { onBack: () => void }) {
  const [documentTitle, setDocumentTitle] = useState('');
  const [court, setCourt] = useState('ديوان المظالم / القضاء الإداري');
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<AdminAnalysisReport | null>(null);
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [meta, setMeta] = useState<AnalysisMeta | null>(null);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [sourcePackets, setSourcePackets] = useState<SourcePacket[]>([]);
  const [historyWarning, setHistoryWarning] = useState('');
  const [history, setHistory] = useState<SavedAnalysisRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState('');

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);

    fetch('/api/admin-runs', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error || 'تعذر تحميل سجل التحليلات.');
        return Array.isArray(payload?.runs) ? payload.runs as SavedAnalysisRun[] : [];
      })
      .then((runs) => {
        if (!cancelled) setHistory(runs.filter((item) => item && item.runId).slice(0, 20));
      })
      .catch((historyError) => {
        if (!cancelled) setHistoryWarning(historyError instanceof Error ? historyError.message : 'تعذر تحميل سجل التحليلات.');
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function openSavedRun(runId: string) {
    const saved = history.find((item) => item.runId === runId);
    if (!saved) return;

    setSelectedHistoryId(runId);
    setDocumentTitle(saved.documentTitle || '');
    setReport(saved.report || null);
    setMeta(saved.meta || null);
    setAgentRuns(Array.isArray(saved.agentRuns) ? saved.agentRuns : []);
    setSourcePackets(Array.isArray(saved.sourcePackets) ? saved.sourcePackets : []);
    setActiveCategory('الكل');
    setError('');
  }

  function exportCurrentReport() {
    if (!report) return;
    const payload = {
      documentTitle: documentTitle || report.documentType || 'تحليل قضائي',
      exportedAt: new Date().toISOString(),
      meta,
      agentRuns,
      sourcePackets,
      report,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `qada-analysis-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const categories = useMemo(() => {
    const set = new Set((report?.issues || []).map((issue) => issue.category));
    return ['الكل', ...Array.from(set)];
  }, [report]);

  const visibleIssues = useMemo(() => {
    const list = [...(report?.issues || [])].sort((a, b) => (severityOrder[a.severity] ?? 99) - (severityOrder[b.severity] ?? 99));
    return activeCategory === 'الكل' ? list : list.filter((issue) => issue.category === activeCategory);
  }, [report, activeCategory]);

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError('');
    const next: UploadedAttachment[] = [];
    for (const file of Array.from(files).slice(0, Math.max(0, 5 - attachments.length))) {
      const type = file.type || (
        file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf'
          : file.name.toLowerCase().endsWith('.png') ? 'image/png'
          : /\.jpe?g$/i.test(file.name) ? 'image/jpeg'
          : ''
      );
      if (!['application/pdf', 'image/png', 'image/jpeg', 'image/webp'].includes(type)) {
        setError('يدعم التحليل ملفات PDF والصور PNG/JPG/WEBP فقط.');
        continue;
      }
      if (file.size > 2.5 * 1024 * 1024) {
        setError('حجم الملف الواحد يجب ألا يتجاوز 2.5MB عند الإرسال المباشر.');
        continue;
      }
      const data = await readFileAsDataUrl(file);
      next.push({ name: file.name, type, data });
    }
    setAttachments((current) => {
      const combined = [...current, ...next].slice(0, 5);
      const totalBase64Chars = combined.reduce((sum, item) => sum + item.data.length, 0);
      if (totalBase64Chars > 3_500_000) {
        setError('إجمالي المرفقات تجاوز الحد الآمن للإرسال المباشر. حلل الملفات على دفعات أصغر.');
        return current;
      }
      return combined;
    });
  }

  async function runAnalysis() {
    if (busy) return;
    if (!text.trim() && attachments.length === 0) {
      setError('أدخل نص الحكم أو المذكرة، أو أرفق الملف المراد تحليله.');
      return;
    }

    setBusy(true);
    setError('');
    setReport(null);
    setMeta(null);
    setAgentRuns([]);
    setSourcePackets([]);
    setActiveCategory('الكل');
    setHistoryWarning('');

    try {
      const response = await fetch('/api/admin-analysis', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentTitle: documentTitle.trim(),
          court,
          text: text.trim(),
          attachments,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 403) throw new Error('هذه الغرفة متاحة للأدمن فقط.');
        if (response.status === 401) throw new Error('انتهت جلسة الدخول. أعد تسجيل الدخول.');
        throw new Error(payload?.error === 'AI_ANALYSIS_UNAVAILABLE'
          ? 'تعذر تشغيل محرك التحليل حالياً. راجع اتصال مزود الذكاء.'
          : 'تعذر إكمال التحليل.');
      }

      const nextReport = payload.report as AdminAnalysisReport;
      const nextMeta = (payload.meta || null) as AnalysisMeta | null;
      const nextAgentRuns = Array.isArray(payload.agentRuns) ? payload.agentRuns as AgentRun[] : [];
      const nextSourcePackets = Array.isArray(payload.sourcePackets) ? payload.sourcePackets as SourcePacket[] : [];
      setReport(nextReport);
      setMeta(nextMeta);
      setAgentRuns(nextAgentRuns);
      setSourcePackets(nextSourcePackets);
      const snapshot: SavedAnalysisRun = {
        runId: `run-${Date.now()}`,
        documentTitle: documentTitle.trim() || nextReport.documentType || 'تحليل قضائي',
        analyzedAt: nextMeta?.analyzedAt || Date.now(),
        report: nextReport,
        agentRuns: nextAgentRuns,
        sourcePackets: nextSourcePackets,
        meta: nextMeta,
      };
      try {
        const historyResponse = await fetch('/api/admin-runs', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshot }),
        });
        if (!historyResponse.ok) {
          const historyPayload = await historyResponse.json().catch(() => ({}));
          throw new Error(historyPayload?.error || 'تعذر حفظ أثر التشغيل.');
        }
        setHistory((current) => [snapshot, ...current.filter((item) => item.runId !== snapshot.runId)].slice(0, 20));
        setSelectedHistoryId(snapshot.runId || '');
      } catch (historyError) {
        setHistoryWarning(historyError instanceof Error ? historyError.message : 'تعذر حفظ أثر التشغيل.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر إكمال التحليل.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4" dir="rtl">
      <div className="rounded-3xl border border-violet-400/25 bg-gradient-to-l from-violet-500/15 via-slate-950 to-cyan-500/10 p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-violet-300/30 bg-violet-500/15 text-violet-200">
              <ScanSearch className="h-7 w-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-[10px] font-black text-violet-200">
                <LockKeyhole className="h-3 w-3" />
                ADMIN ANALYSIS ROOM
              </div>
              <h2 className="mt-2 text-xl sm:text-2xl font-black text-white">غرفة التحليل القضائي الخاصة بالأدمن</h2>
              <p className="mt-1 max-w-3xl text-xs sm:text-sm leading-6 text-slate-400">
                تحليل نقدي للحكم أو المذكرة من زوايا تشريعية وقضائية وإجرائية وإثباتية وتكييفية، مع فصل صريح بين النص المستخرج والاستنتاج وما تم التحقق منه مرجعياً.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {history.length > 0 && (
              <label className="relative">
                <History className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <select
                  value={selectedHistoryId}
                  onChange={(event) => openSavedRun(event.target.value)}
                  className="min-h-11 max-w-[320px] rounded-xl border border-slate-700 bg-slate-900 py-2 pl-3 pr-9 text-xs font-bold text-slate-300 outline-none focus:border-violet-400/60"
                  aria-label="فتح تحليل سابق"
                >
                  <option value="">{historyLoading ? 'جاري تحميل السجل...' : 'فتح تحليل سابق'}</option>
                  {history.map((item, index) => (
                    <option key={item.runId || index} value={item.runId || ''}>
                      {item.documentTitle || 'تحليل قضائي'} — {item.analyzedAt ? new Date(item.analyzedAt).toLocaleString('ar-SA') : 'بدون تاريخ'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {report && (
              <>
                <button type="button" onClick={exportCurrentReport} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-4 text-xs font-black text-cyan-200 hover:bg-cyan-500/15">
                  <Download className="h-4 w-4" />
                  تصدير JSON
                </button>
                <button type="button" onClick={() => window.print()} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 text-xs font-black text-slate-300 hover:text-white">
                  <Printer className="h-4 w-4" />
                  طباعة
                </button>
              </>
            )}
            <button type="button" onClick={onBack} className="min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 text-xs font-black text-slate-300 hover:text-white">
              <ArrowRight className="h-4 w-4" />
              العودة إلى خريطة الوكلاء
            </button>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[0.9fr_1.1fr] gap-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 sm:p-5 h-fit">
          <div className="flex items-center gap-2 text-white font-black">
            <Gavel className="h-5 w-5 text-violet-300" />
            <span>مدخلات التحليل</span>
          </div>

          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-xs font-bold text-slate-400">عنوان المستند</span>
              <input
                value={documentTitle}
                onChange={(event) => setDocumentTitle(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-sm text-white outline-none focus:border-violet-400/60"
                placeholder="مثال: حكم الدائرة الإدارية / مذكرة جوابية"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-400">الاختصاص المبدئي</span>
              <select
                value={court}
                onChange={(event) => setCourt(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-sm text-white outline-none focus:border-violet-400/60"
              >
                <option>ديوان المظالم / القضاء الإداري</option>
                <option>المحاكم العامة</option>
                <option>المحاكم الجزائية</option>
                <option>المحكمة العليا</option>
                <option>غير محدد</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-slate-400">نص الحكم أو المذكرة</span>
              <textarea
                value={text}
                onChange={(event) => setText(event.target.value)}
                rows={14}
                className="mt-2 w-full resize-y rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-3 text-sm leading-7 text-slate-100 outline-none focus:border-violet-400/60"
                placeholder="الصق النص هنا، أو ارفع ملف PDF/صورة أدناه..."
              />
              <div className="mt-1 text-left text-[10px] text-slate-600">{text.length.toLocaleString('ar-SA')} حرف</div>
            </label>

            <label className="block cursor-pointer rounded-2xl border border-dashed border-violet-400/25 bg-violet-500/5 p-4 hover:bg-violet-500/10 transition-colors">
              <input
                type="file"
                multiple
                accept=".pdf,image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  void addFiles(event.target.files);
                  event.currentTarget.value = '';
                }}
              />
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl border border-violet-400/20 bg-violet-500/10 text-violet-200">
                  <UploadCloud className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-xs font-black text-slate-200">رفع حكم أو مذكرة أو مرفق</div>
                  <div className="mt-1 text-[10px] text-slate-500">PDF أو PNG/JPG/WEBP — حتى 5 ملفات بإجمالي إرسال لا يتجاوز نحو 2.5MB خام</div>
                </div>
              </div>
            </label>

            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.map((attachment, index) => (
                  <div key={attachment.name + index} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-slate-300">{attachment.name}</div>
                      <div className="text-[9px] text-slate-600">{attachment.type}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAttachments((items) => items.filter((_, itemIndex) => itemIndex !== index))}
                      className="text-[10px] font-black text-rose-300 hover:text-rose-200"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-3 text-xs font-bold text-rose-200">
                {error}
              </div>
            )}

            {historyWarning && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-xs font-bold text-amber-200">
                تم التحليل بنجاح، لكن تعذر حفظ سجل التشغيل المركزي: {historyWarning}
              </div>
            )}

            <button
              type="button"
              onClick={runAnalysis}
              disabled={busy}
              className="min-h-13 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-l from-violet-500 to-cyan-500 px-5 py-3.5 text-sm font-black text-white shadow-[0_0_30px_rgba(124,58,237,.2)] transition hover:brightness-110 disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              <span>{busy ? 'جاري تشغيل غرفة التحليل...' : 'ابدأ التحليل العميق'}</span>
            </button>

            <div className="rounded-xl border border-amber-400/15 bg-amber-500/5 p-3 text-[10px] leading-5 text-amber-100/70">
              أي نقطة لم يكتمل التحقق من مصدرها الرسمي يجب أن تظهر في قائمة «التحقق المطلوب» ولا تُعامل كسند نهائي. عند تشغيل التحليل تُرسل المدخلات والمرفقات إلى مزود الذكاء المهيأ للمنصة؛ أزل البيانات الشخصية غير اللازمة قبل الرفع.
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 sm:p-5 min-h-[720px]">
          {!report && !busy && (
            <div className="h-full min-h-[600px] grid place-items-center text-center">
              <div className="max-w-md">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
                  <FileSearch className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-lg font-black text-white">لم يبدأ التحليل بعد</h3>
                <p className="mt-2 text-xs leading-6 text-slate-500">
                  أدخل الحكم أو المذكرة ثم شغّل التحليل. ستظهر هنا العيوب المحتملة مرتبة حسب الخطورة ومفصولة حسب نوعها.
                </p>
              </div>
            </div>
          )}

          {busy && (
            <div className="h-full min-h-[600px] grid place-items-center text-center">
              <div>
                <LoaderCircle className="mx-auto h-10 w-10 animate-spin text-violet-300" />
                <div className="mt-4 text-sm font-black text-white">تشغيل محرك التحليل القضائي</div>
                <div className="mt-2 text-xs text-slate-500">قراءة المستند ← استرجاع المراجع ← تحليل العيوب ← بناء التقرير</div>
              </div>
            </div>
          )}

          {report && !busy && (
            <div className="space-y-5">
              <div className="grid sm:grid-cols-4 gap-2">
                <StatCard label="نوع المستند" value={report.documentType || 'غير محدد'} icon={FileText} />
                <StatCard label="الاختصاص" value={report.jurisdiction || 'غير محدد'} icon={Scale} />
                <StatCard label="الملاحظات" value={String(report.issues.length)} icon={AlertTriangle} />
                <StatCard label="بحاجة تحقق" value={String(report.issues.filter((issue) => issue.verificationNeeded).length)} icon={BookOpenCheck} />
              </div>

              <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/5 p-4">
                <div className="flex items-center gap-2 text-xs font-black text-cyan-200">
                  <ShieldCheck className="h-4 w-4" />
                  الملخص التنفيذي
                </div>
                <p className="mt-2 whitespace-pre-wrap text-xs sm:text-sm leading-7 text-slate-300">{report.executiveSummary || 'لا يوجد ملخص.'}</p>
                {meta && (
                  <div className="mt-3 flex flex-wrap gap-2 text-[9px] text-slate-600">
                    <span>المعمارية: {meta.architecture || 'تحليل متعدد المراحل'}</span>
                    <span>•</span>
                    <span>المكتملون: {meta.completedAgents ?? agentRuns.filter((run) => run.status === 'success').length}</span>
                    <span>•</span>
                    <span>تحذيرات: {meta.warningAgents ?? agentRuns.filter((run) => run.status === 'warning').length}</span>
                    <span>•</span>
                    <span>المتعثرون: {meta.failedAgents ?? agentRuns.filter((run) => run.status === 'error').length}</span>
                    <span>•</span>
                    <span>مصادر رسمية: {meta.officialSources ?? 0}</span>
                    <span>•</span>
                    <span>مواد مفهرسة: {meta.verifiedArticles ?? 0}</span>
                    <span>•</span>
                    <span>قيود تحقق: {meta.sourceBlockers ?? 0}</span>
                    {meta.analyzedAt && <><span>•</span><span>{new Date(meta.analyzedAt).toLocaleString('ar-SA')}</span></>}
                  </div>
                )}
              </div>

              {agentRuns.length > 0 && (
                <div className="rounded-2xl border border-violet-400/15 bg-violet-500/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-black text-violet-200">
                      <Sparkles className="h-4 w-4" />
                      الوكلاء الذين نفذوا هذه العملية فعلياً
                    </div>
                    <span className="text-[9px] text-slate-600">{agentRuns.length} وكلاء</span>
                  </div>
                  <div className="mt-3 grid md:grid-cols-2 gap-2">
                    {agentRuns.map((run) => (
                      <div key={run.id} className="rounded-xl border border-slate-800 bg-slate-950/55 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-black text-slate-200">{run.label}</div>
                            <div className="mt-1 font-mono text-[9px] text-slate-600">{run.id}</div>
                          </div>
                          <span className={
                            'rounded-full border px-2 py-1 text-[9px] font-black ' +
                            (run.status === 'success'
                              ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                              : run.status === 'warning'
                                ? 'border-amber-400/25 bg-amber-500/10 text-amber-200'
                                : 'border-rose-400/25 bg-rose-500/10 text-rose-200')
                          }>
                            {run.status === 'success' ? 'مكتمل' : run.status === 'warning' ? 'تحقق مطلوب' : 'تعثر'}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[9px] text-slate-500">
                          <span>{(run.durationMs / 1000).toFixed(1)}ث</span>
                          {run.model && <><span>•</span><span>{run.model}</span></>}
                        </div>
                        {run.blockers?.length ? (
                          <div className="mt-2 rounded-lg border border-amber-400/15 bg-amber-500/5 p-2">
                            <div className="text-[9px] font-black text-amber-200">سبب التحذير / ما ينقص التحقق</div>
                            <ul className="mt-1 space-y-1">
                              {run.blockers.slice(0, 4).map((blocker, blockerIndex) => (
                                <li key={blockerIndex} className="text-[9px] leading-5 text-amber-100/70">• {blocker}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sourcePackets.length > 0 && (
                <div className="rounded-2xl border border-amber-400/15 bg-amber-500/5 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-200">
                      <BookOpenCheck className="h-4 w-4" />
                      أثر المراجع الرسمية ووكلاء المصدر
                    </div>
                    <span className="text-[9px] text-slate-600">{sourcePackets.reduce((sum, packet) => sum + packet.references.length, 0)} مرجعاً مسترجعاً</span>
                  </div>
                  <div className="mt-3 space-y-3">
                    {sourcePackets.map((packet) => (
                      <div key={packet.agentId} className="rounded-xl border border-slate-800 bg-slate-950/55 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="text-[11px] font-black text-slate-200">{packet.label}</div>
                            <div className="mt-1 text-[9px] leading-5 text-slate-500">{packet.scope}</div>
                          </div>
                          <span className={
                            'rounded-full border px-2 py-1 text-[9px] font-black ' +
                            (packet.status === 'success'
                              ? 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'
                              : packet.status === 'warning'
                                ? 'border-amber-400/25 bg-amber-500/10 text-amber-200'
                                : 'border-rose-400/25 bg-rose-500/10 text-rose-200')
                          }>
                            {packet.status === 'success' ? 'متحقق' : packet.status === 'warning' ? 'تحقق ناقص' : 'خطأ'}
                          </span>
                        </div>

                        {packet.references.length > 0 && (
                          <div className="mt-3 grid md:grid-cols-2 gap-2">
                            {packet.references.slice(0, 6).map((reference, index) => (
                              <div key={reference.sourceUrl + index} className="rounded-lg border border-slate-800 bg-black/15 p-2.5">
                                <div className="text-[10px] font-bold text-slate-300">{reference.name}</div>
                                {reference.issueInstrument && <div className="mt-1 text-[9px] text-slate-500">{reference.issueInstrument}</div>}
                                <a
                                  href={reference.sourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex items-center gap-1 text-[9px] font-black text-cyan-300 hover:text-cyan-200"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  المصدر الرسمي
                                </a>
                              </div>
                            ))}
                          </div>
                        )}

                        {packet.verifiedArticles.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {packet.verifiedArticles.slice(0, 12).map((article, index) => (
                              <a
                                key={article.system + article.article + index}
                                href={article.sourceUrl}
                                target="_blank"
                                rel="noreferrer"
                                title={article.note}
                                className="rounded-full border border-emerald-400/20 bg-emerald-500/5 px-2 py-1 text-[9px] font-bold text-emerald-200 hover:bg-emerald-500/10"
                              >
                                {article.system} — مادة {article.article}
                              </a>
                            ))}
                          </div>
                        )}

                        {packet.blockers.length > 0 && (
                          <div className="mt-3 rounded-lg border border-amber-400/15 bg-amber-500/5 p-2.5">
                            {packet.blockers.slice(0, 4).map((blocker, index) => (
                              <div key={index} className="text-[9px] leading-5 text-amber-100/70">• {blocker}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setActiveCategory(category)}
                    className={
                      'rounded-lg border px-3 py-1.5 text-[10px] font-black transition-colors ' +
                      (activeCategory === category
                        ? 'border-violet-400/40 bg-violet-500/15 text-violet-200'
                        : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-white')
                    }
                  >
                    {category}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {visibleIssues.length === 0 ? (
                  <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/5 p-4 text-xs text-emerald-200">
                    لا توجد ملاحظات ضمن هذا التصنيف في التقرير الحالي.
                  </div>
                ) : visibleIssues.map((issue, index) => (
                  <article key={issue.id || index} className="rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={'rounded-full border px-2 py-1 text-[9px] font-black ' + severityClass(issue.severity)}>{issue.severity}</span>
                          <span className={'rounded-full border px-2 py-1 text-[9px] font-black ' + categoryClass(issue.category)}>{issue.category}</span>
                          {issue.verificationNeeded && (
                            <span className="rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-1 text-[9px] font-black text-amber-200">تحقق مطلوب</span>
                          )}
                        </div>
                        <h4 className="mt-2 text-sm font-black text-white">{issue.title}</h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-600">#{index + 1}</span>
                    </div>

                    {issue.documentSegment && (
                      <div className="mt-3 rounded-xl border border-slate-800 bg-black/20 p-3">
                        <div className="text-[9px] font-black text-slate-600">الموضع محل الفحص</div>
                        <div className="mt-1 whitespace-pre-wrap text-[11px] leading-6 text-slate-400">{issue.documentSegment}</div>
                      </div>
                    )}

                    <div className="mt-3 grid md:grid-cols-2 gap-3 text-xs">
                      <InfoBox title="التحليل" text={issue.analysis} />
                      <InfoBox title="الأثر المحتمل" text={issue.impact} />
                      <InfoBox title="السند/المرجع" text={issue.legalBasis || 'لم يحدد سند متحقق.'} />
                      <InfoBox title="حالة المصدر" text={issue.sourceStatus || 'غير متحقق'} highlight />
                    </div>

                    {issue.sourceUrls?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {issue.sourceUrls.map((url, sourceIndex) => (
                          <a
                            key={url + sourceIndex}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-cyan-400/20 bg-cyan-500/5 px-2.5 py-1.5 text-[9px] font-black text-cyan-300 hover:bg-cyan-500/10"
                          >
                            <ExternalLink className="h-3 w-3" />
                            المصدر الرسمي {sourceIndex + 1}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-3">
                <ListPanel title="الوقائع الناقصة" items={report.missingFacts} icon={FileSearch} />
                <ListPanel title="أدلة أو مرفقات ناقصة" items={report.missingEvidence} icon={UploadCloud} />
                <ListPanel title="نقاط التعارض" items={report.conflictingPoints} icon={AlertTriangle} />
                <ListPanel title="أقوى النقاط المتحققة" items={report.strongestVerifiedPoints} icon={BadgeCheck} />
              </div>

              <ListPanel title="قائمة التحقق المرجعي المطلوبة" items={report.verificationQueue} icon={BookOpenCheck} amber />

              {report.finalNotes && (
                <div className="rounded-2xl border border-violet-400/15 bg-violet-500/5 p-4">
                  <div className="flex items-center gap-2 text-xs font-black text-violet-200">
                    <CheckCircle2 className="h-4 w-4" />
                    ملاحظات المراجع النهائي
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-7 text-slate-300">{report.finalNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 min-w-0">
      <Icon className="h-4 w-4 text-cyan-300" />
      <div className="mt-2 truncate text-xs font-black text-white">{value}</div>
      <div className="mt-1 text-[9px] font-bold text-slate-600">{label}</div>
    </div>
  );
}

function InfoBox({ title, text, highlight = false }: { title: string; text: string; highlight?: boolean }) {
  return (
    <div className={'rounded-xl border p-3 ' + (highlight ? 'border-amber-400/15 bg-amber-500/5' : 'border-slate-800 bg-black/15')}>
      <div className={'text-[9px] font-black ' + (highlight ? 'text-amber-300' : 'text-slate-600')}>{title}</div>
      <div className="mt-1 whitespace-pre-wrap text-[11px] leading-6 text-slate-400">{text || '—'}</div>
    </div>
  );
}

function ListPanel({ title, items, icon: Icon, amber = false }: { title: string; items: string[]; icon: React.ElementType; amber?: boolean }) {
  return (
    <div className={'rounded-2xl border p-4 ' + (amber ? 'border-amber-400/15 bg-amber-500/5' : 'border-slate-800 bg-slate-900/50')}>
      <div className={'flex items-center gap-2 text-xs font-black ' + (amber ? 'text-amber-200' : 'text-slate-200')}>
        <Icon className="h-4 w-4" />
        {title}
      </div>
      {items?.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => (
            <li key={index} className="flex items-start gap-2 text-[11px] leading-6 text-slate-400">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-600" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 text-[10px] text-slate-600">لا توجد عناصر مسجلة.</div>
      )}
    </div>
  );
}
