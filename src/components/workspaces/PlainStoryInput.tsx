import React, { useState } from 'react';
import { Sparkles, ClipboardPaste, Check, AlertCircle, HelpCircle } from 'lucide-react';

export interface LegalAdaptationResult {
  subject: string;
  legal_bases: string[];
  requests: string[];
  verification?: {
    officialSources: number;
    verifiedArticles: number;
    blockers: string[];
    literalQuotationReady: boolean;
    precedentCorpusReady: boolean;
  };
  // Backwards compatibility formatted strings:
  disputedSubject?: string;
  legalBases?: string;
  claimDemands?: string;
}

interface PlainStoryInputProps {
  court: 'administrative' | 'general' | 'criminal';
  onApplyExtractedData: (data: LegalAdaptationResult) => void;
  currentStory: string;
  onStoryChange: (story: string) => void;
}

export function PlainStoryInput({
  court,
  onApplyExtractedData,
  currentStory,
  onStoryChange,
}: PlainStoryInputProps) {
  const [isExtracting, setIsExtracting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 3 Quick Example Chips per jurisdiction
  const quickExamples =
    court === 'administrative'
      ? [
          'جهة عملي لم تصرف بدلاتي',
          'قرار فصل تعسفي',
          'حرماني من الترقية ظلماً',
        ]
      : court === 'general'
      ? [
          'مماطلة في سداد دين عقد مقاولة',
          'مستأجر امتنع عن دفع الإيجار',
          'بيع سيارة معيبة بعيب خفي',
        ]
      : [
          'بطلان قبض وتفتيش بدون إذن',
          'اتهام كيدي بدون دليل جنائي',
          'اعتراف منتزع تحت الإكراه',
        ];

  // Legal Adaptation Function: calls /api/convert-story
  const handleExtractArticles = async () => {
    if (!currentStory.trim()) {
      setErrorMessage('فضلاً اكتب ما حدث معك أو انسخ النص أولاً.');
      return;
    }

    setIsExtracting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/convert-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          story: currentStory,
          court,
        }),
      });

      if (!response.ok) {
        throw new Error('تعذر تكييف القصة واستخراج المواد النظامية حالياً.');
      }

      const data: LegalAdaptationResult = await response.json();
      onApplyExtractedData(data);
      setSuccessMessage(
        data.legal_bases.length > 0
          ? `تم إعداد التكييف وربطه بـ ${data.legal_bases.length} مراجع رسمية متاحة للمراجعة 🪄`
          : 'تم إعداد التكييف والطلبات، ولم يظهر سند رسمي مطابق بدرجة كافية؛ راجع المراجع قبل الاعتماد.'
      );
      setTimeout(() => setSuccessMessage(null), 4500);
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء استخراج المواد');
    } finally {
      setIsExtracting(false);
    }
  };

  // Clipboard Paste handler
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onStoryChange(text);
        setSuccessMessage('تم لصق النص من الحافظة بنجاح.');
        setTimeout(() => setSuccessMessage(null), 2500);
      }
    } catch {
      setErrorMessage('يرجى السماح بالوصول للحافظة أو استخدم الاختصار Ctrl+V.');
      setTimeout(() => setErrorMessage(null), 3000);
    }
  };

  return (
    <div
      id="plain-story-assistant"
      className="p-4 sm:p-5 rounded-3xl bg-neutral-950/90 border border-amber-500/40 shadow-lg space-y-3.5 transition-all"
    >
      {/* 1. Header & Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-black text-neutral-100 flex items-center gap-2">
              <span>ما تعرف المواد؟ اكتب وش صار معك ببساطة أو انسخ النص</span>
            </h4>
            <p className="text-[11px] text-neutral-400">
              يُحوَّل سردك إلى تكييف مبدئي، ثم تُربط به المراجع الرسمية التي استطاعت المنصة التحقق منها
            </p>
          </div>
        </div>

        {/* Action Buttons: Paste & Extract */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="btn-paste-clipboard"
            onClick={handlePasteClipboard}
            className="px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-semibold flex items-center gap-1.5 border border-neutral-700 transition-colors shadow-sm cursor-pointer"
            title="لصق النص من الحافظة"
          >
            <ClipboardPaste className="w-4 h-4 text-amber-400" />
            <span>📋 لصق نص منسوخ</span>
          </button>

          <button
            type="button"
            id="btn-extract-legal-bases"
            onClick={handleExtractArticles}
            disabled={isExtracting || !currentStory.trim()}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isExtracting ? 'جاري التكييف والتحقق...' : 'تكييف القصة وربطها بالمراجع الرسمية 🪄'}</span>
          </button>
        </div>
      </div>

      {/* 2. Large Narrative Textarea */}
      <div className="relative">
        <textarea
          id="textarea-user-story"
          rows={3}
          value={currentStory}
          onChange={(e) => onStoryChange(e.target.value)}
          placeholder={`اكتب هنا ما حدث معك باللغة العادية (مثلاً: "صار كذا وكذا... ورفضت جهتي صرف مستحقاتي...") أو الصق نص القرار أو المحادثة هنا مباشرة.`}
          className="w-full px-4 py-3 rounded-2xl bg-neutral-900/90 border border-neutral-800 text-neutral-100 text-xs sm:text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none leading-relaxed placeholder:text-neutral-500 resize-y min-h-[85px] transition-all"
        />
      </div>

      {/* 3. 3 Quick Example Chips */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <span className="text-[11px] font-bold text-neutral-400">أمثلة سريعة:</span>
        <div className="flex flex-wrap gap-1.5">
          {quickExamples.map((ex, idx) => (
            <button
              key={idx}
              type="button"
              id={`btn-quick-example-${idx}`}
              onClick={() => onStoryChange(ex)}
              className="text-xs px-3 py-1 rounded-xl bg-neutral-900 hover:bg-amber-500/10 hover:text-amber-300 text-neutral-300 border border-neutral-800 hover:border-amber-500/40 transition-all cursor-pointer"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Messages */}
      {successMessage && (
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
