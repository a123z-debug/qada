import React, { useEffect, useState, useMemo } from 'react';
import {
  FileText,
  Scale,
  CheckSquare,
  Square,
  Download,
  Printer,
  Copy,
  Check,
  ArrowRight,
  AlertTriangle,
  BookOpen,
  Sparkles,
  ShieldCheck,
  Eye,
  Edit3,
  Calendar,
  Hash,
  Coins,
  FileCheck2,
  Search,
  Gavel,
  Paperclip,
  RotateCcw,
  ExternalLink,
  LoaderCircle,
} from 'lucide-react';
import { CourtJurisdiction } from '../layout/Sidebar';
import { printLegalMemo } from '../../utils/printMemo';
import { JudgesCassationReviewPanel } from '../JudgesCassationReviewPanel';
import { DetailedJudgesReviewReport } from '../../types';

interface LegalReviewEditorProps {
  initialContent: string;
  court: CourtJurisdiction;
  serviceId: string;
  documentTitle: string;
  clientName?: string;
  nationalId?: string;
  uploadedFileName?: string;
  uploadedFileText?: string;
  attachmentsText?: string;
  onBackToEdit: () => void;
  onContentChange?: (updatedContent: string) => void;
}

interface RagReference {
  id: string;
  title: string;
  source: string;
  sourceUrl: string;
  issueInstrument: string;
  verificationNote: string;
  coverage: string;
  category: string;
  agentId: string;
  agentStatus: 'success' | 'warning' | 'error';
}

interface ReferenceSearchMeta {
  officialSources: number;
  verifiedArticles: number;
  literalQuotationReady: boolean;
  precedentCorpusReady: boolean;
}

interface JudgesSourceAudit {
  officialSources: number;
  verifiedArticles: number;
  blockers: string[];
  literalQuotationReady: boolean;
  precedentCorpusReady: boolean;
}

function normalizeJudgesReport(raw: any, originalText: string): DetailedJudgesReviewReport {
  const normalizeSection = (section: any, title: string) => ({
    title: section?.title || title,
    items: Array.isArray(section?.items) ? section.items.filter((item: unknown): item is string => typeof item === 'string') : [],
    severity: ['عالية', 'متوسطة', 'منخفضة', 'غير مقيمة'].includes(section?.severity) ? section.severity : 'غير مقيمة',
  });

  const judges = Array.isArray(raw?.judges) && raw.judges.length > 0
    ? raw.judges.map((judge: any, index: number) => ({
        judgeId: judge?.judgeId || judge?.id || `judge_${index + 1}`,
        judgeName: judge?.judgeName || judge?.name || judge?.role || `عضو الهيئة ${index + 1}`,
        judgeTitle: judge?.judgeTitle || judge?.title || 'فحص وتدقيق المحرر القضائي',
        courtCategory: judge?.courtCategory || 'هيئة المراجعة القضائية',
        verdict: judge?.verdict || 'لم يكتمل الفحص الآلي',
        scoreOutOf100: Number.isFinite(Number(judge?.scoreOutOf100)) ? Number(judge.scoreOutOf100) : null,
        errorsIdentified: Array.isArray(judge?.errorsIdentified) ? judge.errorsIdentified : [],
        critique: judge?.critique || judge?.opinion || 'لم يرد تفصيل كافٍ في تقرير الهيئة.',
        specificAmendment: judge?.specificAmendment || '',
      }))
    : [{
        judgeId: 'judge_review',
        judgeName: 'المراجع الآلي',
        judgeTitle: 'فحص وتدقيق المحرر القضائي',
        courtCategory: 'هيئة المراجعة التحليلية',
        verdict: 'لم يكتمل الفحص الآلي',
        scoreOutOf100: null,
        errorsIdentified: [],
        critique: 'تعذر استكمال تفاصيل التقرير. راجع النص وحاول الفحص مرة أخرى.',
        specificAmendment: '',
      }];

  return {
    documentType: raw?.documentType || 'محرر قضائي',
    overallStatus: raw?.overallStatus || 'تعذر إكمال الفحص الآلي',
    primaryFatalDefect: raw?.primaryFatalDefect || '',
    judges,
    cassationErrors: normalizeSection(raw?.cassationErrors, 'أخطاء الطعن والنقض'),
    claimErrors: normalizeSection(raw?.claimErrors, 'أخطاء الدعوى والطلبات'),
    attachmentErrors: {
      ...normalizeSection(raw?.attachmentErrors, 'أخطاء ونواقص المرفقات'),
      missingRequiredDocs: Array.isArray(raw?.attachmentErrors?.missingRequiredDocs) ? raw.attachmentErrors.missingRequiredDocs : [],
    },
    revisedDocument: typeof raw?.revisedDocument === 'string' && raw.revisedDocument.trim() ? raw.revisedDocument : originalText,
    changeLog: Array.isArray(raw?.changeLog) ? raw.changeLog.filter((item: unknown): item is string => typeof item === 'string') : [],
    synthesisAdvice: raw?.synthesisAdvice || 'راجع النص والمواد والتواريخ والمرفقات قبل الاعتماد.',
    timestamp: Number(raw?.timestamp) || Date.now(),
  };
}

export function LegalReviewEditor({
  initialContent,
  court,
  serviceId,
  documentTitle,
  clientName,
  nationalId,
  uploadedFileName,
  uploadedFileText,
  attachmentsText,
  onBackToEdit,
  onContentChange,
}: LegalReviewEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [activeTab, setActiveTab] = useState<'editor' | 'highlighted' | 'judges'>('editor');
  const [copied, setCopied] = useState(false);
  const [referenceSearch, setReferenceSearch] = useState('');
  const [referenceResults, setReferenceResults] = useState<RagReference[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(false);
  const [referenceError, setReferenceError] = useState('');
  const [referenceBlockers, setReferenceBlockers] = useState<string[]>([]);
  const [referenceMeta, setReferenceMeta] = useState<ReferenceSearchMeta | null>(null);

  // 3 Mandatory Checkboxes for Legal Approval Gate
  const [checkNames, setCheckNames] = useState(false);
  const [checkDates, setCheckDates] = useState(false);
  const [checkRequests, setCheckRequests] = useState(false);

  // 3-Judge Cassation, Appeal & Attachments Panel State
  const [judgesReport, setJudgesReport] = useState<DetailedJudgesReviewReport | null>(null);
  const [judgesSourceAudit, setJudgesSourceAudit] = useState<JudgesSourceAudit | null>(null);
  const [isLoadingJudges, setIsLoadingJudges] = useState(false);
  const [previousContent, setPreviousContent] = useState<string | null>(null);
  const [revisionToast, setRevisionToast] = useState<string | null>(null);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);

  const isAllApproved = checkNames && checkDates && checkRequests;
  const approvedCount = (checkNames ? 1 : 0) + (checkDates ? 1 : 0) + (checkRequests ? 1 : 0);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    if (onContentChange) {
      onContentChange(val);
    }
  };

  const handleRunJudgesAudit = async () => {
    setIsLoadingJudges(true);
    setJudgesSourceAudit(null);
    setActiveTab('judges');
    try {
      const response = await fetch('/api/judges-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          court,
          serviceId,
          documentTitle,
          clientName: clientName || 'صاحب الشأن',
          attachmentsText: attachmentsText || uploadedFileText || '',
          uploadedFileName: uploadedFileName || '',
        }),
      });

      if (!response.ok) {
        throw new Error('تعذر تشغيل هيئة المراجعة القضائية الآلية');
      }

      const data = await response.json();
      const report = data.report || data.auditReport;
      setJudgesSourceAudit(data.sourceAudit || null);
      if (report) {
        setJudgesReport(normalizeJudgesReport(report, content));
      }
    } catch (err: any) {
      console.error('Error invoking judges audit:', err);
    } finally {
      setIsLoadingJudges(false);
    }
  };

  const handleApplyFullRevision = (revisedText: string) => {
    setPreviousContent(content);
    setContent(revisedText);
    if (onContentChange) {
      onContentChange(revisedText);
    }
    setRevisionToast('تم تطبيق الصياغة المقترحة من هيئة المراجعة الآلية في المحرر ✓');
    setTimeout(() => setRevisionToast(null), 5000);
  };

  const handleApplySpecificAmendment = (amendmentText: string) => {
    setPreviousContent(content);
    const newContent = `${content}\n\n[تعديل مقترح من المراجعة الآلية]:\n${amendmentText}`;
    setContent(newContent);
    if (onContentChange) {
      onContentChange(newContent);
    }
    setRevisionToast('تم إدراج التعديل المقترح في صلب المذكرة ✓');
    setTimeout(() => setRevisionToast(null), 5000);
  };

  const handleRestorePreviousContent = () => {
    if (previousContent) {
      const current = content;
      setContent(previousContent);
      setPreviousContent(current);
      if (onContentChange) {
        onContentChange(previousContent);
      }
      setRevisionToast('تم التراجع واستعادة النص السابق ✓');
      setTimeout(() => setRevisionToast(null), 4000);
    }
  };

  // Smart Regex Patterns for Highlights
  // 1. Dates (Hijri or Gregorian)
  const dateRegex = /\b(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}(?:هـ|م)?|\d{1,2}[/-]\d{1,2}[/-]\d{4}(?:هـ|م)?|\d{4}هـ|\d{4}م)\b/g;
  // 2. National IDs (10 digits starting with 1 or 2, or preceded by هوية/سجل)
  const idRegex = /(?:هوية|سجل مدني|رقم هوية|سجل)\s*[:\-]?\s*\(?(\b[12]\d{9}\b)\)?|\b[12]\d{9}\b/g;
  // 3. Amounts (Numbers followed by ريال or ر.س or نسبة %)
  const amountRegex = /(?:\b\d[\d,.]*\s*(?:ريالاً|ريال|ر\.س|%|بالمائة)\b)/g;
  // 4. Deed, Royal Decree, Decision, Case numbers
  const deedRegex = /(?:مرسوم ملكي|قرار|صك|محضر|دعوى|رقم)\s*(?:كريم|رقم)?\s*\(?([مM]?\/?\d+[\d\/\-_]*)\)?/g;

  // Analysis Counts
  const detectedMetrics = useMemo(() => {
    const dates = content.match(dateRegex) || [];
    const ids = content.match(idRegex) || [];
    const amounts = content.match(amountRegex) || [];
    const deeds = content.match(deedRegex) || [];
    return {
      datesCount: dates.length,
      idsCount: ids.length,
      amountsCount: amounts.length,
      deedsCount: deeds.length,
      total: dates.length + ids.length + amounts.length + deeds.length,
    };
  }, [content]);

  // Render Highlighted HTML preview
  const highlightedHtml = useMemo(() => {
    if (!content) return '';
    // Escape HTML first
    let text = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Highlight Dates
    text = text.replace(
      dateRegex,
      (match) =>
        `<mark class="bg-amber-300 text-neutral-950 font-semibold px-1 py-0.5 rounded shadow-sm" title="تاريخ يتطلب التدقيق">${match}</mark>`
    );

    // Highlight IDs
    text = text.replace(
      idRegex,
      (match) =>
        `<mark class="bg-amber-400 text-neutral-950 font-bold px-1 py-0.5 rounded font-mono shadow-sm" title="رقم هوية وطنية">${match}</mark>`
    );

    // Highlight Amounts
    text = text.replace(
      amountRegex,
      (match) =>
        `<mark class="bg-amber-200 text-neutral-950 font-bold px-1 py-0.5 rounded shadow-sm" title="مبلغ مالي أو نسبة">${match}</mark>`
    );

    // Highlight Deeds and Decrees
    text = text.replace(
      deedRegex,
      (match) =>
        `<mark class="bg-amber-300 text-neutral-950 font-bold px-1 py-0.5 rounded shadow-sm" title="رقم صك / قرار / مرسوم">${match}</mark>`
    );

    return text;
  }, [content]);

  // Official-source-only legal references. No hardcoded legal quotation is inserted from the UI.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setReferencesLoading(true);
      setReferenceError('');
      try {
        const response = await fetch('/api/legal-source-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            court,
            query: [documentTitle, referenceSearch].filter(Boolean).join(' '),
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error('تعذر استرجاع المراجع الرسمية.');
        if (cancelled) return;
        setReferenceResults(Array.isArray(payload.references) ? payload.references : []);
        setReferenceBlockers(Array.isArray(payload.blockers) ? payload.blockers : []);
        setReferenceMeta(payload.meta || null);
      } catch (error) {
        if (cancelled || (error instanceof DOMException && error.name === 'AbortError')) return;
        setReferenceResults([]);
        setReferenceBlockers([]);
        setReferenceMeta(null);
        setReferenceError(error instanceof Error ? error.message : 'تعذر استرجاع المراجع الرسمية.');
      } finally {
        if (!cancelled) setReferencesLoading(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [court, documentTitle, referenceSearch]);

  const filteredReferences = useMemo(() => referenceResults, [referenceResults]);

  const handleInsertReference = (ref: RagReference) => {
    const insertion = [
      '',
      '',
      `[مرجع رسمي للتحقق: ${ref.title}`,
      ref.issueInstrument ? `أداة الإصدار: ${ref.issueInstrument}` : '',
      `المصدر: ${ref.sourceUrl}`,
      ref.coverage ? `تغطية المستودع: ${ref.coverage}` : '',
      'تنبيه: لا يعتمد أي نص حرفي للمادة إلا بعد مطابقته بالمصدر الرسمي.]',
      '',
    ].filter(Boolean).join('\n');
    const newContent = content + insertion;
    setContent(newContent);
    if (onContentChange) onContentChange(newContent);
  };

  const handlePrintPdf = () => {
    if (!isAllApproved) return;
    setIsPrintPreviewOpen(true);
  };

  const handleConfirmPrint = () => {
    setIsPrintPreviewOpen(false);
    printLegalMemo(content, documentTitle || 'محرر قضائي رسمي');
  };

  const handleExportWord = () => {
    if (!isAllApproved) return;
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${documentTitle}</title><style>body { font-family: 'Traditional Arabic', 'Arial', sans-serif; font-size: 16pt; direction: rtl; text-align: right; line-height: 1.8; }</style></head><body dir='rtl'>`;
    const footer = '</body></html>';
    const sourceHTML = header + `<div style="white-space: pre-wrap;">${content}</div>` + footer;

    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement('a');
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `${documentTitle.replace(/\s+/g, '_')}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-10">
      {/* 1. Top Focus Mode Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToEdit}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
            title="الرجوع إلى نموذج البيانات"
          >
            <ArrowRight className="w-4 h-4" />
            <span>تعديل المدخلات</span>
          </button>

          <div className="h-6 w-px bg-neutral-800 hidden sm:block" />

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-neutral-100">{documentTitle}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                وضع التركيز والمراجعة القانونية
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              تدقيق الأسانيد، التظليل الذكي للعناصر الجوهرية، وبوابة الاعتماد الإلزامية للتصدير
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-neutral-950 p-1 rounded-xl border border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'editor'
                  ? 'bg-neutral-800 text-neutral-100 shadow'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>محرر التعديل</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('highlighted')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'highlighted'
                  ? 'bg-amber-500 text-neutral-950 shadow'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>التظليل الذكي ({detectedMetrics.total})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('judges')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'judges'
                  ? 'bg-amber-500 text-neutral-950 shadow'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Gavel className="w-3.5 h-3.5 text-amber-400" />
              <span>هيئة قضاة النقض والاستئناف ⚖️</span>
              {judgesReport && (
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyText}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="نسخ النص كاملاً"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? 'تم النسخ' : 'نسخ'}</span>
          </button>
        </div>
      </div>

      {/* Revision Applied Alert Banner */}
      {revisionToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center justify-between gap-2 shadow-lg">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{revisionToast}</span>
          </div>
          {previousContent && (
            <button
              onClick={handleRestorePreviousContent}
              className="text-xs text-neutral-300 hover:text-amber-300 flex items-center gap-1 underline cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>تراجع عن التعديل</span>
            </button>
          )}
        </div>
      )}

      {/* 2. Detected Elements Notice Banner */}
      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-amber-300 font-bold">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>التظليل الذكي للبيانات الحساسة باللون الأصفر:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
          <span className="px-2 py-0.5 rounded bg-amber-300 text-neutral-950 font-bold flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{detectedMetrics.datesCount} تواريخ</span>
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-400 text-neutral-950 font-bold flex items-center gap-1">
            <Hash className="w-3 h-3" />
            <span>{detectedMetrics.idsCount} هويات</span>
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-200 text-neutral-950 font-bold flex items-center gap-1">
            <Coins className="w-3 h-3" />
            <span>{detectedMetrics.amountsCount} مبالغ</span>
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-300 text-neutral-950 font-bold flex items-center gap-1">
            <FileCheck2 className="w-3 h-3" />
            <span>{detectedMetrics.deedsCount} صكوك وقرارات</span>
          </span>
        </div>
      </div>

      {/* 3. Judicial Oversight Quick Banner (قضاة النقض والاستئناف والمرفقات) */}
      <div className="p-4 rounded-3xl bg-neutral-900 border border-amber-500/30 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
            <Gavel className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-bold text-neutral-100">
                هيئة فحص وتعديل قضاة النقض والاستئناف والمرفقات
              </h4>
              {isAllApproved && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  معتمد بعد التظليل
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              فحص أخطاء الطعن بالنقض، عيوب عريضة الدعوى، ونواقص المرفقات مع اقتراح التعديلات اللازمة والصياغة الجاهزة للإيداع.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {uploadedFileName && (
            <span className="text-[10px] px-2.5 py-1 rounded-xl bg-neutral-950 border border-neutral-800 text-sky-300 flex items-center gap-1.5 font-medium">
              <Paperclip className="w-3 h-3 text-sky-400" />
              <span className="truncate max-w-[140px]">{uploadedFileName}</span>
            </span>
          )}
          <button
            type="button"
            onClick={handleRunJudgesAudit}
            disabled={isLoadingJudges}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
          >
            <Scale className="w-4 h-4" />
            <span>
              {isLoadingJudges
                ? 'جارٍ انعقاد الهيئة...'
                : judgesReport
                ? 'معاينة تقرير وتعديلات القضاة ⚖️'
                : 'فحص وتعديل القضاة للمذكرة والمرفقات ⚖️'}
            </span>
          </button>
        </div>
      </div>

      {/* 4. Main Body: Either Judges Panel or Split Editor/RAG */}
      {activeTab === 'judges' ? (
        <JudgesCassationReviewPanel
          report={judgesReport}
          sourceAudit={judgesSourceAudit}
          isLoading={isLoadingJudges}
          onRunAudit={handleRunJudgesAudit}
          onApplyFullRevision={handleApplyFullRevision}
          onApplySpecificAmendment={handleApplySpecificAmendment}
          currentEditorText={content}
          documentTitle={documentTitle}
          previousEditorText={previousContent || undefined}
          onRestorePreviousText={handleRestorePreviousContent}
        />
      ) : (
        /* 3. Main Split Screen (Right: RAG Data 40%, Left: Rich Editor 60%) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Right (40% / 5 cols): RAG Data & Statutory Grounds */}
        <div className="lg:col-span-5 bg-neutral-900 border border-neutral-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-neutral-100">المراجع الرسمية المتحققة</h3>
                  <p className="mt-0.5 text-[10px] text-neutral-500">بيانات مصدر موثق فقط — لا تُحقن نصوص مواد من الذاكرة.</p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-800 text-amber-300">
                {filteredReferences.length} مراجع
              </span>
            </div>

            <div className="relative">
              {referencesLoading
                ? <LoaderCircle className="w-3.5 h-3.5 text-amber-400 absolute right-3 top-1/2 -translate-y-1/2 animate-spin" />
                : <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2" />}
              <input
                type="text"
                value={referenceSearch}
                onChange={(e) => setReferenceSearch(e.target.value)}
                placeholder="ابحث باسم النظام، المادة، المرسوم أو الموضوع..."
                className="w-full pl-3 pr-8 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:border-amber-500 outline-none"
              />
            </div>

            {referenceMeta && (
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-2.5 py-2 text-neutral-400">
                  مصادر رسمية: <span className="font-bold text-emerald-300">{referenceMeta.officialSources}</span>
                </div>
                <div className="rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-2.5 py-2 text-neutral-400">
                  مواد مفهرسة: <span className="font-bold text-cyan-300">{referenceMeta.verifiedArticles}</span>
                </div>
              </div>
            )}

            {referenceError && (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-[10px] font-bold text-rose-200">
                {referenceError}
              </div>
            )}

            <div className="h-[460px] overflow-y-auto space-y-3 custom-scrollbar pr-1">
              {!referencesLoading && filteredReferences.length === 0 && !referenceError && (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4 text-center text-[11px] leading-6 text-neutral-500">
                  لم يظهر مرجع رسمي مطابق بدرجة كافية. غيّر عبارة البحث، ولا تعتمد سنداً من الذاكرة.
                </div>
              )}

              {filteredReferences.map((ref) => (
                <div
                  key={ref.id}
                  className="p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 hover:border-amber-500/40 transition-colors space-y-2 group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={
                        'text-[10px] font-bold px-2 py-0.5 rounded border inline-block mb-1 ' +
                        (ref.agentStatus === 'success'
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                          : ref.agentStatus === 'warning'
                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-300 border-rose-500/20')
                      }>
                        {ref.category}
                      </span>
                      <h4 className="text-xs font-bold text-neutral-100 group-hover:text-amber-300 transition-colors">
                        {ref.title}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleInsertReference(ref)}
                      className="px-2 py-1 rounded-lg bg-neutral-800 hover:bg-amber-500 hover:text-neutral-950 text-neutral-300 text-[10px] font-bold transition-all shrink-0 cursor-pointer"
                      title="إدراج بيانات المرجع الرسمي دون اقتباس حرفي"
                    >
                      + إدراج المرجع
                    </button>
                  </div>

                  {ref.issueInstrument && (
                    <p className="text-[10px] text-neutral-400 leading-relaxed">
                      <span className="font-bold text-neutral-300">أداة الإصدار:</span> {ref.issueInstrument}
                    </p>
                  )}

                  {ref.verificationNote && (
                    <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-4">
                      {ref.verificationNote}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-neutral-900">
                    <span className="text-[10px] text-neutral-500">
                      {ref.source}{ref.coverage ? ' • ' + ref.coverage : ''}
                    </span>
                    <a
                      href={ref.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-300 hover:text-cyan-200"
                    >
                      <ExternalLink className="h-3 w-3" />
                      فتح المصدر الرسمي
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {referenceBlockers.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <div className="text-[10px] font-bold text-amber-200">قيود تحقق يجب الانتباه لها</div>
                <div className="mt-1 space-y-1">
                  {referenceBlockers.slice(0, 3).map((blocker, index) => (
                    <div key={index} className="text-[9px] leading-5 text-amber-100/70">• {blocker}</div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 rounded-2xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>
              تعرض هذه اللوحة بيانات مصادر رسمية مفهرسة. وجود المرجع لا يعني أن نص المادة الحرفي مخزن أو أن الحكم القضائي السابق متحقق؛ افتح المصدر الرسمي قبل اعتماد الاقتباس أو الأثر القانوني.
            </span>
          </div>
        </div>

        {/* Left (60% / 7 cols): Live Rich / Highlighted Text Editor */}
        <div className="lg:col-span-7 bg-neutral-900 border border-neutral-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-neutral-100">
                  {activeTab === 'editor' ? 'محرر النص الحي القابل للتعديل' : 'معاينة التظليل الذكي والتدقيق'}
                </h3>
              </div>
              <span className="text-[10px] text-neutral-400 font-mono">
                {content.length} حرفاً
              </span>
            </div>

            {/* Editor Canvas Area */}
            {activeTab === 'editor' ? (
              <div className="relative">
                <textarea
                  value={content}
                  onChange={handleTextChange}
                  rows={20}
                  className="w-full h-[470px] p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs sm:text-sm font-sans leading-relaxed focus:border-amber-500 outline-none resize-none custom-scrollbar selection:bg-amber-500 selection:text-neutral-950"
                  placeholder="أدخل أو عدل نص المذكرة القضائية هنا..."
                />
              </div>
            ) : (
              <div
                className="w-full h-[470px] overflow-y-auto p-4 rounded-2xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs sm:text-sm font-sans leading-relaxed custom-scrollbar whitespace-pre-wrap selection:bg-amber-500 selection:text-neutral-950"
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            )}
          </div>

          {/* 4. Verification Checklist Gate (بوابة الاعتماد الإلزامية) */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-neutral-100">بوابة الاعتماد والتدقيق المهني (إلزامي):</h4>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                  isAllApproved
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {approvedCount}/3 مكتمل
              </span>
            </div>

            {/* 3 Checkboxes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              <label
                className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                  checkNames
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checkNames}
                  onChange={(e) => setCheckNames(e.target.checked)}
                  className="hidden"
                />
                {checkNames ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-neutral-500 shrink-0" />
                )}
                <span className="text-[11px] font-semibold">1. مراجعة الأسماء والخصوم</span>
              </label>

              <label
                className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                  checkDates
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checkDates}
                  onChange={(e) => setCheckDates(e.target.checked)}
                  className="hidden"
                />
                {checkDates ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-neutral-500 shrink-0" />
                )}
                <span className="text-[11px] font-semibold">2. مراجعة التواريخ والمهل</span>
              </label>

              <label
                className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                  checkRequests
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200'
                    : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checkRequests}
                  onChange={(e) => setCheckRequests(e.target.checked)}
                  className="hidden"
                />
                {checkRequests ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Square className="w-4 h-4 text-neutral-500 shrink-0" />
                )}
                <span className="text-[11px] font-semibold">3. مراجعة ومطابقة الطلبات</span>
              </label>
            </div>

            {/* Recommended Next Step After Highlighting Approval */}
            {isAllApproved && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-neutral-950 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs">
                  <Gavel className="w-5 h-5 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold text-amber-300 block">
                      اكتمل اعتماد التظليل الذكي ومطابقة البيانات الجوهرية!
                    </span>
                    <span className="text-neutral-300 text-[11px]">
                      اعرض المذكرة الآن على هيئة قضاة النقض والاستئناف لفحص وتعديل أخطاء الطعن والمرفقات قبل التصدير.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleRunJudgesAudit}
                  disabled={isLoadingJudges}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>
                    {isLoadingJudges
                      ? 'جارٍ الفحص...'
                      : judgesReport
                      ? 'معاينة فحص وتعديل القضاة ⚖️'
                      : 'فحص وتعديل هيئة القضاة ⚖️'}
                  </span>
                </button>
              </div>
            )}

            {/* Export Buttons Gated */}
            <div className="pt-2 border-t border-neutral-850 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-neutral-400">
                {!isAllApproved
                  ? '⚠️ يجب تحديد صناديق المراجعة الثلاثة لتفعيل التصدير.'
                  : 'جاهز للتصدير المباشر بصيغة PDF أو Word الرسمية.'}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  id="btn-export-pdf"
                  onClick={handlePrintPdf}
                  disabled={!isAllApproved}
                  className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                    isAllApproved
                      ? 'bg-amber-500 hover:bg-amber-400 text-neutral-950 cursor-pointer shadow-amber-500/20'
                      : 'bg-neutral-800 text-neutral-500 opacity-50 cursor-not-allowed'
                  }`}
                  title={!isAllApproved ? 'مُعطل حتى يتم تدقيق البنود الثلاثة' : 'معاينة اللائحة ثم طباعتها'}
                >
                  <Printer className="w-4 h-4" />
                  <span>معاينة وطباعة اللائحة</span>
                </button>

                <button
                  type="button"
                  id="btn-export-word"
                  onClick={handleExportWord}
                  disabled={!isAllApproved}
                  className={`py-2 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
                    isAllApproved
                      ? 'bg-neutral-800 hover:bg-neutral-750 text-neutral-100 border border-neutral-700 cursor-pointer'
                      : 'bg-neutral-800 text-neutral-500 opacity-50 cursor-not-allowed border border-neutral-800'
                  }`}
                  title={!isAllApproved ? 'مُعطل حتى يتم تدقيق البنود الثلاثة' : 'تصدير بصيغة Word (.doc)'}
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير Word</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {isPrintPreviewOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-3 sm:p-6" dir="rtl">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3 sm:px-6">
              <div>
                <h3 className="text-sm font-bold text-neutral-100">معاينة نهائية قبل الطباعة</h3>
                <p className="mt-1 text-[11px] text-neutral-400">يمكنك الرجوع للمحرر وإضافة أي تعديل قبل إخراج اللائحة.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsPrintPreviewOpen(false)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-neutral-300 hover:bg-neutral-800 hover:text-white"
              >
                رجوع للتعديل
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-white p-5 text-right text-sm leading-loose text-slate-900 sm:p-8">
              <h4 className="mb-5 border-b-2 border-slate-300 pb-3 text-center text-lg font-bold">{documentTitle}</h4>
              <div className="whitespace-pre-wrap">{content}</div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 bg-neutral-950 px-4 py-3 sm:px-6">
              <span className="text-[11px] text-neutral-400">هذه المعاينة لا ترسل اللائحة إلى أي جهة.</span>
              <button
                type="button"
                onClick={handleConfirmPrint}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-950 hover:bg-amber-400"
              >
                <Printer className="h-4 w-4" />
                طباعة اللائحة الآن
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
