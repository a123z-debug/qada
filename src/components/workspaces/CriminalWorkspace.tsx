import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  FileText,
  Gavel,
  AlertTriangle,
  UploadCloud,
  Sparkles,
  Copy,
  Check,
  Printer,
  ShieldCheck,
  FileCheck,
  Save,
  Maximize2,
} from 'lucide-react';
import { UserSession } from '../../types';
import { LegalReviewEditor } from './LegalReviewEditor';
import { LegalAdaptationResult, PlainStoryInput } from './PlainStoryInput';
import { consumeTextSse } from '../../lib/consumeTextSse';

interface CriminalWorkspaceProps {
  service: string | null;
  userSession?: UserSession | null;
  onOpenPdfModal?: () => void;
}

const STORAGE_KEY_PREFIX = 'diwan_criminal_draft_v3';

export function CriminalWorkspace({
  service = 'criminal_defense',
  userSession,
  onOpenPdfModal,
}: CriminalWorkspaceProps) {
  const currentService = service || 'criminal_defense';
  const storageKey = `${STORAGE_KEY_PREFIX}:${userSession?.id || 'guest'}`;

  // Restore draft from LocalStorage
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      defendantName: userSession?.name || 'المتهم / الموكل',
      nationalId: userSession?.nationalId || 'الهوية الوطنية',
      chargeSubject: 'اكتب التهمة أو موضوع القضية كما ورد في لائحة الدعوى أو محضر التحقيق.',
      investigationFlaws: 'اكتب الملاحظات على إجراءات الضبط أو التحقيق كما تظهر في المستندات، دون افتراض بطلانها مسبقاً.',
      legalGrounds: 'لم يتم التحقق من سند نظامي بعد. استخدم أداة التكييف أو البحث الرسمي لربط الوقائع بالمراجع المتحققة.',
      defenseDemands: 'اكتب الطلبات التي تريد بحثها، وسيتم فحص مدى ملاءمتها للمرحلة والإجراءات والمستندات.',
      userStory: '',
      uploadedFileName: '',
      uploadedFileText: '',
      generatedOutput: '',
    };
  };

  const initial = getInitialState();

  const [defendantName, setDefendantName] = useState<string>(initial.defendantName);
  const [nationalId, setNationalId] = useState<string>(initial.nationalId);
  const [chargeSubject, setChargeSubject] = useState<string>(initial.chargeSubject);
  const [investigationFlaws, setInvestigationFlaws] = useState<string>(initial.investigationFlaws);
  const [legalGrounds, setLegalGrounds] = useState<string>(initial.legalGrounds);
  const [defenseDemands, setDefenseDemands] = useState<string>(initial.defenseDemands);

  // Plain narrative story ("صار كذا كذا")
  const [userStory, setUserStory] = useState<string>(initial.userStory || '');

  // File Upload state (No auto API call!)
  const [uploadedFileName, setUploadedFileName] = useState<string>(initial.uploadedFileName || '');
  const [uploadedFileText, setUploadedFileText] = useState<string>(initial.uploadedFileText || '');

  // Output & Review Mode
  const [generatedOutput, setGeneratedOutput] = useState<string>(initial.generatedOutput || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState<boolean>(Boolean(initial.generatedOutput));
  const [lastSavedTime, setLastSavedTime] = useState<string>('محفوظ محلياً');
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [pendingAdaptation, setPendingAdaptation] = useState<LegalAdaptationResult | null>(null);

  const applyAdaptation = (extracted: LegalAdaptationResult) => {
    const newSubject = extracted.subject || extracted.disputedSubject || chargeSubject;
    const newGrounds = extracted.legal_bases?.length
      ? extracted.legal_bases.map((basis) => `- ${basis}`).join('\n')
      : extracted.legalBases || legalGrounds;
    const newDemands = extracted.requests?.length
      ? extracted.requests.map((request, index) => `${index + 1}. ${request}`).join('\n')
      : extracted.claimDemands || defenseDemands;
    setChargeSubject(newSubject);
    setLegalGrounds(newGrounds);
    setDefenseDemands(newDemands);
    setPendingAdaptation(null);
    setIsAutoFilled(true);
    setTimeout(() => setIsAutoFilled(false), 2200);
  };

  // Auto-save to LocalStorage
  useEffect(() => {
    try {
      const data = {
        defendantName,
        nationalId,
        chargeSubject,
        investigationFlaws,
        legalGrounds,
        defenseDemands,
        userStory,
        uploadedFileName,
        uploadedFileText,
        generatedOutput,
      };
      localStorage.setItem(storageKey, JSON.stringify(data));
      const now = new Date();
      setLastSavedTime(`تم الحفظ في ${now.toLocaleTimeString('ar-SA')}`);
    } catch {
      // ignore
    }
  }, [
    defendantName,
    nationalId,
    chargeSubject,
    investigationFlaws,
    legalGrounds,
    defenseDemands,
    userStory,
    uploadedFileName,
    uploadedFileText,
    generatedOutput,
  ]);

  // Handle Attachment Upload (NO API CALL TRIGGERED)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPlainText = file.type === 'text/plain' || file.name.toLowerCase().endsWith('.txt');
    if (!isPlainText) {
      window.alert('هذا الحقل يقرأ ملفات TXT فقط. استخدم زر PDF/صورة لإرسال المحضر أو الصورة إلى المحادثة.');
      e.target.value = '';
      return;
    }
    if (file.size > 512 * 1024) {
      window.alert('ملف TXT أكبر من 512 كيلوبايت. اختصره أو أرسله على أجزاء.');
      e.target.value = '';
      return;
    }
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      const summaryText = `[مرفق محضر ضبط / تحقيق: ${file.name} - الحجم: ${(file.size / 1024).toFixed(1)} ك.ب]\n${content.slice(0, 1200)}`;
      setUploadedFileText(summaryText);
      setInvestigationFlaws((prev) => `${prev}\n(مرفق المحضر: ${file.name})`);
    };
    reader.readAsText(file);
  };

  // Explicit Generation Call: (صياغة المذكرة)
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedOutput('');

    const storyAddon = userStory.trim()
      ? `\n\n[سرد المتهم/الموكل أو نص المحضر المنسوخ]:\n"""\n${userStory}\n"""\nالمطلوب: تكييف الوقائع دون افتراض بطلان أو براءة، وربط أي سند نظامي بالمصدر الرسمي المسترجع فقط.`
      : '';

    const sharedRules = `قواعد إلزامية:
- لا تفترض بطلان القبض أو التفتيش أو التوقيف؛ افحص الوقائع والمستندات أولاً.
- لا تذكر رقم مادة أو مرسوم أو ميعاد من الذاكرة.
- استخدم فقط الأسانيد الرسمية المسترجعة من الخادم، واذكر ما يحتاج تحققاً.
- لا تعرض رقم الهوية الوطنية في المخرجات.
- صغ النتيجة كمسودة دفاع للمراجعة البشرية، لا كحكم أو ضمان نتيجة.`;

    let prompt = '';
    if (currentService === 'criminal_defense') {
      prompt = `صغ مسودة مذكرة دفاع جنائي للمراجعة:
المتهم: ${defendantName}
التهمة كما أدخلها المستخدم: ${chargeSubject}
الملاحظات على إجراءات التحقيق/الضبط: ${investigationFlaws}
الأسانيد التي أدخلها المستخدم أو استخرجها النظام: ${legalGrounds}
${storyAddon}
${uploadedFileText ? `بيانات المرفقات: ${uploadedFileText}` : ''}
الطلبات المراد بحثها:
${defenseDemands}

${sharedRules}`;
    } else if (currentService === 'criminal_appeal') {
      prompt = `صغ مسودة اعتراض أو استئناف جزائي للمراجعة، وحدد أولاً ما يلزم التحقق منه من الحكم والتبليغ والميعاد والأسباب دون افتراضها.
صاحب الشأن: ${defendantName}
موضوع القضية: ${chargeSubject}
${storyAddon}

${sharedRules}`;
    } else if (currentService === 'criminal_procedural') {
      prompt = `حلل إجراءات الضبط والقبض والتفتيش والتوقيف في القضية التالية، وحدد فقط ما يمكن وصفه بخلل بعد ربطه بالوقائع والمصدر الرسمي.
صاحب الشأن: ${defendantName}
الملاحظات المدخلة: ${investigationFlaws}
${storyAddon}

${sharedRules}`;
    } else {
      prompt = `صغ مذكرة إيداع ومراجعة للمرفقات في قضية جزائية، واربط كل ملاحظة بما يظهر فعلاً في المستند.
صاحب الشأن: ${defendantName}
المرفق: ${uploadedFileName || 'مرفقات القضية'}
${storyAddon}

${sharedRules}`;
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          targetCourt: 'المحكمة الجزائية',
          clientPersonName: defendantName,
          powerMode: true,
        }),
      });

      if (!response.ok) throw new Error('فشل التوليد');

      const fullText = await consumeTextSse(response, (text) => setGeneratedOutput(text));

      if (!fullText) {
        fullText = `تعذر استلام مسودة من خدمة الذكاء الاصطناعي، لذلك لم تنشئ المنصة أي مادة أو دفع قانوني افتراضي.

بيانات العمل المحفوظة:
- صاحب الشأن: ${defendantName}
- موضوع القضية: ${chargeSubject}
- ملاحظات الإجراءات: ${investigationFlaws}
- الأسانيد المدخلة/المستخرجة: ${legalGrounds}
- الطلبات المراد بحثها:
${defenseDemands}

أعد المحاولة بعد عودة الخدمة، ثم راجع المصادر الرسمية قبل اعتماد أي سند.`;
        setGeneratedOutput(fullText);
      }

      // Enter Focus Mode (Legal Review Editor) automatically
      setIsReviewMode(true);
    } catch (err) {
      console.error('Criminal generation failed:', err);
      const fallback = `تعذر إكمال الصياغة الآلية، ولم تُنشأ أسانيد بديلة.

صاحب الشأن: ${defendantName}
موضوع القضية: ${chargeSubject}
ملاحظات الإجراءات:
${investigationFlaws}

الأسانيد المدخلة أو المستخرجة سابقاً — تحتاج تحققاً:
${legalGrounds}

الطلبات المراد بحثها:
${defenseDemands}`;
      setGeneratedOutput(fallback);
      setIsReviewMode(true);
    } finally {
      setIsGenerating(false);
    }
  };

  // Render Focus Mode (LegalReviewEditor) when in review state
  if (isReviewMode && generatedOutput) {
    return (
      <LegalReviewEditor
        initialContent={generatedOutput}
        court="criminal"
        serviceId={currentService}
        documentTitle={
          currentService === 'criminal_defense'
            ? 'مذكرة دفاع جنائي - المحكمة الجزائية'
            : currentService === 'criminal_appeal'
            ? 'لائحة اعتراض واستئناف حكم جزائي'
            : currentService === 'criminal_procedural'
            ? 'مذكرة دفوع بطلان القبض والتفتيش'
            : 'مذكرة إيداع وتدقيق محاضر التحقيق'
        }
        clientName={defendantName}
        nationalId={nationalId}
        uploadedFileName={uploadedFileName}
        uploadedFileText={uploadedFileText}
        onBackToEdit={() => setIsReviewMode(false)}
        onContentChange={(updated) => setGeneratedOutput(updated)}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 1. Header & Local Storage Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-neutral-900 border border-rose-500/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-100">بؤرة المحاكم الجزائية</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                مسودة خاصة بالحساب الحالي
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {currentService === 'criminal_defense' && 'إعداد وصياغة لائحة دعوى / مذكرة دفاع جنائي'}
              {currentService === 'criminal_appeal' && 'صياغة اعتراض واستئناف حكم جزائي'}
              {currentService === 'criminal_procedural' && 'إعداد مذكرة دفوع بطلان القبض والتفتيش'}
              {currentService === 'criminal_evidence' && 'رفع مرفقات ومحاضر الضبط والتحقيق الجنائي'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400">
            <Save className="w-3.5 h-3.5 text-rose-400" />
            <span>{lastSavedTime}</span>
          </div>

          {generatedOutput && (
            <button
              type="button"
              onClick={() => setIsReviewMode(true)}
              className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>وضع التركيز والمراجعة</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Workspace Form Mode */}
      {currentService === 'criminal_evidence' ? (
        /* رفع مرفقات View (Staged, No Automatic API Trigger) */
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <UploadCloud className="w-6 h-6" />
              <div>
                <h3 className="text-lg font-bold text-neutral-100">رفع مرفقات ومحاضر المحاكم الجزائية</h3>
                <p className="text-xs text-neutral-400">
                  ملفات TXT المضافة هنا تحفظ في تخزين هذا المتصفح للحساب الحالي. استخدم زر PDF/صورة لإرسال المستند للمحادثة عند الحاجة.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onOpenPdfModal}
                disabled={!onOpenPdfModal}
                className="px-4 py-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-200 text-xs font-bold disabled:opacity-40"
              >
                PDF / صورة للمحادثة
              </button>
              <label className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow">
                <UploadCloud className="w-4 h-4" />
                <span>إضافة TXT للمسودة</span>
                <input type="file" onChange={handleFileUpload} className="hidden" accept=".txt,text/plain" />
              </label>
            </div>
          </div>

          {uploadedFileName && (
            <div className="p-4 rounded-2xl bg-neutral-950 border border-rose-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCheck className="w-6 h-6 text-rose-400" />
                <div>
                  <p className="text-xs font-bold text-neutral-200">{uploadedFileName}</p>
                  <p className="text-[11px] text-neutral-400">تم إدراج المحضر في مسودة الدفاع بنجاح.</p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 font-bold border border-rose-500/20">
                جاهز للصياغة
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-300">المتهم / الموكل:</label>
              <input
                type="text"
                value={defendantName}
                onChange={(e) => setDefendantName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:border-rose-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-300">رقم الهوية الوطنية:</label>
              <input
                type="text"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs font-mono focus:border-rose-500 outline-none"
              />
            </div>
          </div>

          {/* EXPLICIT BUTTON (صياغة المذكرة) */}
          <button
            type="button"
            id="btn-draft-memo-criminal-attachments"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 px-4 rounded-2xl bg-rose-500 hover:bg-rose-400 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5" />
            <span>{isGenerating ? 'جاري الفحص والصياغة...' : 'صياغة المذكرة'}</span>
          </button>
        </div>
      ) : (
        /* Primary Defense / Appeal / Procedural */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-bold text-neutral-100">
                  {currentService === 'criminal_defense' && 'نموذج لائحة الدعوى / مذكرة الدفاع الجنائي'}
                  {currentService === 'criminal_appeal' && 'نموذج لائحة الاعتراض والاستئناف الجزائي'}
                  {currentService === 'criminal_procedural' && 'نموذج مذكرة دفوع بطلان الإجراءات'}
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
                حفظ محلي على هذا المتصفح
              </span>
            </div>

            {/* Plain Language Assistant for Criminal Court */}
            <PlainStoryInput
              court="criminal"
              currentStory={userStory}
              onStoryChange={setUserStory}
              onApplyExtractedData={(extracted) => setPendingAdaptation(extracted)}
            />

            {pendingAdaptation && (
              <div className="space-y-4 rounded-2xl border border-rose-500/30 bg-white/5 p-4 backdrop-blur-sm">
                <div><p className="text-xs font-bold text-rose-300">التكييف الأولي المقترح</p><p className="mt-1 text-[11px] text-neutral-400">راجع التهمة والأسانيد والطلبات قبل اعتمادها.</p></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-slate-800/30 p-3"><span className="text-[10px] font-bold text-neutral-400">موضوع القضية</span><p className="mt-1 text-xs leading-relaxed text-neutral-200">{pendingAdaptation.subject || pendingAdaptation.disputedSubject}</p></div>
                  <div className="rounded-xl border border-white/10 bg-slate-800/30 p-3"><span className="text-[10px] font-bold text-neutral-400">الأسانيد المتوقعة</span><p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-neutral-200">{pendingAdaptation.legal_bases?.map((basis) => `- ${basis}`).join('\n') || pendingAdaptation.legalBases}</p></div>
                  <div className="rounded-xl border border-white/10 bg-slate-800/30 p-3"><span className="text-[10px] font-bold text-neutral-400">الطلبات المقترحة</span><p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-neutral-200">{pendingAdaptation.requests?.map((request, index) => `${index + 1}. ${request}`).join('\n') || pendingAdaptation.claimDemands}</p></div>
                </div>
                <div className="flex justify-end gap-2"><button type="button" onClick={() => setPendingAdaptation(null)} className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-300 hover:bg-neutral-800">إلغاء الاقتراح</button><button type="button" onClick={() => applyAdaptation(pendingAdaptation)} className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-neutral-950 hover:bg-rose-400">اعتماد وتعبئة النموذج</button></div>
              </div>
            )}

            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">المتهم / الموكل:</label>
                  <input
                    type="text"
                    value={defendantName}
                    onChange={(e) => setDefendantName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:border-rose-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">رقم الهوية الوطنية:</label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs font-mono focus:border-rose-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-neutral-300">التهمة المنسوبة ولائحة النيابة:</label>
                  {isAutoFilled && (
                    <span className="text-[10px] text-rose-400 font-bold animate-pulse">تم التكييف والتعبئة 🪄</span>
                  )}
                </div>
                <input
                  type="text"
                  value={chargeSubject}
                  onChange={(e) => setChargeSubject(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl bg-neutral-950 text-neutral-100 text-xs focus:border-rose-500 outline-none transition-all duration-500 ${
                    isAutoFilled ? 'animate-auto-fill border-rose-500 ring-2 ring-rose-500/40' : 'border border-neutral-800'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">أوجه البطلان وعيوب الضبط والتحقيق:</label>
                <textarea
                  rows={2}
                  value={investigationFlaws}
                  onChange={(e) => setInvestigationFlaws(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:border-rose-500 outline-none resize-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-neutral-300">الأسانيد والقواعد الجنائية (الإجراءات الجزائية):</label>
                  {isAutoFilled && (
                    <span className="text-[10px] text-rose-400 font-bold animate-pulse">مستخرجة نظامياً ✓</span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={legalGrounds}
                  onChange={(e) => setLegalGrounds(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl bg-neutral-950 text-neutral-100 text-xs focus:border-rose-500 outline-none resize-none transition-all duration-500 ${
                    isAutoFilled ? 'animate-auto-fill border-rose-500 ring-2 ring-rose-500/40' : 'border border-neutral-800'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-neutral-300">الطلبات الختامية (البراءة ورد الدعوى):</label>
                  {isAutoFilled && (
                    <span className="text-[10px] text-rose-400 font-bold animate-pulse">مكتملة ✓</span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={defenseDemands}
                  onChange={(e) => setDefenseDemands(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl bg-neutral-950 text-neutral-100 text-xs focus:border-rose-500 outline-none resize-none transition-all duration-500 ${
                    isAutoFilled ? 'animate-auto-fill border-rose-500 ring-2 ring-rose-500/40' : 'border border-neutral-800'
                  }`}
                />
              </div>
            </div>

            {/* MANDATORY BUTTON: (صياغة المذكرة) */}
            <button
              type="button"
              id="btn-draft-memo-criminal"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 px-4 rounded-2xl bg-rose-500 hover:bg-rose-400 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5" />
              <span>{isGenerating ? 'جاري الصياغة والدفاع...' : 'صياغة المذكرة'}</span>
            </button>
          </div>

          <div className="lg:col-span-5 bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-rose-400" />
                  <h3 className="text-sm font-bold text-neutral-100">المعاينة الفورية</h3>
                </div>
                {generatedOutput && (
                  <button
                    onClick={() => setIsReviewMode(true)}
                    className="text-[11px] text-rose-300 hover:underline font-bold"
                  >
                    فتح شاشة المراجعة الكاملة &larr;
                  </button>
                )}
              </div>

              <div className="h-[430px] overflow-y-auto p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80 text-neutral-200 text-xs leading-relaxed font-sans whitespace-pre-wrap selection:bg-rose-500 selection:text-neutral-950 custom-scrollbar">
                {generatedOutput ? (
                  generatedOutput
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 space-y-3">
                    <FileText className="w-12 h-12 stroke-1 text-neutral-600" />
                    <p className="text-xs font-semibold text-neutral-300">
                      اضغط على زر (صياغة المذكرة) للبدء.
                    </p>
                    <p className="text-[11px] text-neutral-400 max-w-xs">
                      ستنتقل مباشرة إلى وضع التركيز (Focus Mode) للمراجعة وتظليل الأرقام والهويات واعتماد التصدير.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-400" />
                <span>نظام الإجراءات الجزائية (م/2)</span>
              </span>
              <span className="font-mono text-rose-400/80">المحاكم الجزائية</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
