import React, { useState, useEffect } from 'react';
import {
  Scale,
  FileText,
  Gavel,
  Building2,
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

interface GeneralWorkspaceProps {
  service: string | null;
  userSession?: UserSession | null;
}

const STORAGE_KEY = 'diwan_general_draft_v2';

export function GeneralWorkspace({
  service = 'general_claim',
  userSession,
}: GeneralWorkspaceProps) {
  const currentService = service || 'general_claim';

  // Restore draft from LocalStorage
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      claimantName: userSession?.name || 'المدعي )',
      nationalId: userSession?.nationalId || 'الهوية الوطنية)',
      defendantName: 'المدعى عليه (الطرف المخل بالعقد / المدين)',
      disputeSubject: 'المطالبة بمستحقات عقد مقاولة وتعويض عن التأخير وإخلال بالالتزام العقدي',
      legalGrounds: 'نظام المعاملات المدنية الصادر بالمرسوم الملكي (م/191)، المواد (128، 129، 138)، ونظام المرافعات الشرعية، ونظام الإثبات في السندات والعقود الموقعة.',
      claimDemands: '1. إلزام المدعى عليه بسداد كامل المبلغ المترصد وقدره (150,000) ريال.\n2. التعويض عن الأضرار الناشئة عن المماطلة وتأخير السداد.\n3. إلزام المدعى عليه بأتعاب المحاماة والتقاضي.',
      userStory: '',
      uploadedFileName: '',
      uploadedFileText: '',
      generatedOutput: '',
    };
  };

  const initial = getInitialState();

  const [claimantName, setClaimantName] = useState<string>(initial.claimantName);
  const [nationalId, setNationalId] = useState<string>(initial.nationalId);
  const [defendantName, setDefendantName] = useState<string>(initial.defendantName);
  const [disputeSubject, setDisputeSubject] = useState<string>(initial.disputeSubject);
  const [legalGrounds, setLegalGrounds] = useState<string>(initial.legalGrounds);
  const [claimDemands, setClaimDemands] = useState<string>(initial.claimDemands);

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
    const newSubject = extracted.subject || extracted.disputedSubject || disputeSubject;
    const newGrounds = extracted.legal_bases?.length
      ? extracted.legal_bases.map((basis) => `- ${basis}`).join('\n')
      : extracted.legalBases || legalGrounds;
    const newDemands = extracted.requests?.length
      ? extracted.requests.map((request, index) => `${index + 1}. ${request}`).join('\n')
      : extracted.claimDemands || claimDemands;
    setDisputeSubject(newSubject);
    setLegalGrounds(newGrounds);
    setClaimDemands(newDemands);
    setPendingAdaptation(null);
    setIsAutoFilled(true);
    setTimeout(() => setIsAutoFilled(false), 2200);
  };

  // Auto-save to LocalStorage
  useEffect(() => {
    try {
      const data = {
        claimantName,
        nationalId,
        defendantName,
        disputeSubject,
        legalGrounds,
        claimDemands,
        userStory,
        uploadedFileName,
        uploadedFileText,
        generatedOutput,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      const now = new Date();
      setLastSavedTime(`تم الحفظ في ${now.toLocaleTimeString('ar-SA')}`);
    } catch {
      // ignore
    }
  }, [
    claimantName,
    nationalId,
    defendantName,
    disputeSubject,
    legalGrounds,
    claimDemands,
    userStory,
    uploadedFileName,
    uploadedFileText,
    generatedOutput,
  ]);

  // Handle Attachment Upload (NO API CALL TRIGGERED)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      const summaryText = `[مرفق مستند أو عقد: ${file.name} - الحجم: ${(file.size / 1024).toFixed(1)} ك.ب]\n${content.slice(0, 1200)}`;
      setUploadedFileText(summaryText);
      setDisputeSubject((prev) => `${prev}\n(مرفق العقد/السند: ${file.name})`);
    };
    reader.readAsText(file);
  };

  // Explicit Generation Call: (صياغة المذكرة)
  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedOutput('');

    const storyAddon = userStory.trim()
      ? `\n\n[سرد العميل باللغة البسيطة أو النص المنسوخ لما حدث (صار كذا كذا)]:\n"""\n${userStory}\n"""\nالمطلوب: تكييف هذا السرد في نصوص ومواد نظام المعاملات المدنية ونظام الإثبات وصياغة الوقائع والطلبات بأسلوب قضائي حاسم.`
      : '';

    let prompt = '';
    if (currentService === 'general_claim') {
      prompt = `بصفتك مستشاراً قانونياً متخصصاً في المحاكم العامة بالمملكة العربية السعودية، قم بصياغة (لائحة دعوى حقوقية / عامة) نموذجية متكاملة وفق أحكام نظام المعاملات المدنية ونظام المرافعات الشرعية:
المدعي: ${claimantName} (هوية: ${nationalId})
المدعى عليه: ${defendantName}
موضوع النزاع: ${disputeSubject}
الأسانيد: ${legalGrounds}
${storyAddon}
${uploadedFileText ? `بيانات المرفقات المودعة: ${uploadedFileText}` : ''}
الطلبات:
${claimDemands}

صغ اللائحة بأسلوب قضائي رصين، واذكر الوقائع بدقة، وتطبيق القواعد الشرعية ومواد نظام المعاملات المدنية، ثم الطلبات الختامية.`;
    } else if (currentService === 'general_appeal') {
      prompt = `قم بصياغة (لائحة اعتراض واستئناف حكم عام) أمام محكمة الاستئناف (الدوائر الحقوقية/المدنية).
المستأنف: ${claimantName}
المستأنف ضده: ${defendantName}
موضوع الطعن: الاعتراض على الحكم الابتدائي لفساده في الاستدلال، ومخالفته للثابت بالأوراق ولبنود العقد المؤرخ ومواد نظام المعاملات المدنية.
${storyAddon}`;
    } else if (currentService === 'general_memo') {
      prompt = `قم بصياغة مذكرة دفاع ومرافعة مدنية جوابية أمام المحكمة العامة في الدعوى المقامة ضد ${claimantName} ودحض مزاعم المدعى عليه استناداً لنظام المعاملات المدنية.
${storyAddon}`;
    } else {
      prompt = `قم بصياغة مذكرة إيداع بينات وعقود أمام المحكمة العامة لفحص السند أو العقد (${uploadedFileName || 'المرفقات'}) وإثبات الالتزام والمديونية.
${storyAddon}`;
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompt }],
          targetCourt: 'المحكمة العامة',
          clientNationalId: nationalId,
          clientPersonName: claimantName,
          powerMode: true,
        }),
      });

      if (!response.ok) throw new Error('فشل التوليد');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  fullText += parsed.text;
                  setGeneratedOutput(fullText);
                }
              } catch {
                fullText += dataStr;
                setGeneratedOutput(fullText);
              }
            }
          }
        }
      }

      if (!fullText) {
        fullText = `بسم الله الرحمن الرحيم\n\nلدى المحكمة العامة الموقرة\n\nالمدعي: ${claimantName} - الهوية: (${nationalId})\nالمدعى عليه: ${defendantName}\n\nالموضوع: دعوى مطالبة حقوقية وتنفيذ التزام عقدي.\n\nالوقائع:\nأبرم الطرفان عقداً التزم بموجبه المدعي بتنفيذ كافة التزاماته، في حين امتنع المدعى عليه عن الوفاء بالسداد دون مسوغ نظامي أو شرعي، إخلالاً بقاعدة العقد شريعة المتعاقدين ومقتضيات حسن النية.\n\nالأسانيد:\n- المواد (128، 129، 138) من نظام المعاملات المدنية (م/191).\n- نظام الإثبات ونظام المرافعات الشرعية.\n\nالطلبات:\n${claimDemands}\n\nوالله يحفظكم ويرعاكم،،\nالمدعي: ${claimantName}`;
        setGeneratedOutput(fullText);
      }

      // Enter Focus Mode (Legal Review Editor) automatically
      setIsReviewMode(true);
    } catch (err) {
      console.error('Generation failed:', err);
      const fallback = `بسم الله الرحمن الرحيم\n\nلدى المحكمة العامة\n\nالمدعي: ${claimantName} (هوية: ${nationalId})\nالمدعى عليه: ${defendantName}\n\nالموضوع: ${disputeSubject}\n\nالأسانيد:\n${legalGrounds}\n\nالطلبات:\n${claimDemands}\n\nمقدمه: ${claimantName}`;
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
        court="general"
        serviceId={currentService}
        documentTitle={
          currentService === 'general_claim'
            ? 'لائحة دعوى حقوقية - المحكمة العامة'
            : currentService === 'general_appeal'
            ? 'لائحة اعتراض واستئناف حكم عام'
            : currentService === 'general_memo'
            ? 'مذكرة جوابية ودفاع مدني'
            : 'مذكرة إيداع عقود وبينات'
        }
        clientName={claimantName}
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
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-neutral-900 border border-emerald-500/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-100">بؤرة المحاكم العامة</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                عزل تام
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {currentService === 'general_claim' && 'إعداد وصياغة لائحة دعوى حقوقية / عامة'}
              {currentService === 'general_appeal' && 'صياغة اعتراض واستئناف حكم عام'}
              {currentService === 'general_memo' && 'إعداد مذكرة جوابية ودفاع'}
              {currentService === 'general_attachments' && 'رفع مرفقات وعقود وبينات'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400">
            <Save className="w-3.5 h-3.5 text-emerald-400" />
            <span>{lastSavedTime}</span>
          </div>

          {generatedOutput && (
            <button
              type="button"
              onClick={() => setIsReviewMode(true)}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>وضع التركيز والمراجعة</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Workspace Form Mode */}
      {currentService === 'general_attachments' ? (
        /* رفع مرفقات View (Staged, No Automatic API Trigger) */
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2.5 text-emerald-400">
              <UploadCloud className="w-6 h-6" />
              <div>
                <h3 className="text-lg font-bold text-neutral-100">رفع مرفقات وعقود المحاكم العامة</h3>
                <p className="text-xs text-neutral-400">
                  تُحفظ المستندات في مسودة العمل محلياً دون أي استهلاك للرصيد، ولا يتم التوليد إلا بالضغط على الزر أدناه
                </p>
              </div>
            </div>
            <label className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow">
              <UploadCloud className="w-4 h-4" />
              <span>اختيار ملف من الجهاز</span>
              <input type="file" onChange={handleFileUpload} className="hidden" accept=".pdf,.doc,.docx,.txt,image/*" />
            </label>
          </div>

          {uploadedFileName && (
            <div className="p-4 rounded-2xl bg-neutral-950 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCheck className="w-6 h-6 text-emerald-400" />
                <div>
                  <p className="text-xs font-bold text-neutral-200">{uploadedFileName}</p>
                  <p className="text-[11px] text-neutral-400">تم إدراج المستند في المسودة بنجاح.</p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20">
                جاهز للصياغة
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-300">المدعي:</label>
              <input
                type="text"
                value={claimantName}
                onChange={(e) => setClaimantName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:border-emerald-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-300">المدعى عليه:</label>
              <input
                type="text"
                value={defendantName}
                onChange={(e) => setDefendantName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* EXPLICIT BUTTON (صياغة المذكرة) */}
          <button
            type="button"
            id="btn-draft-memo-general-attachments"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5" />
            <span>{isGenerating ? 'جاري التحليل والصياغة...' : 'صياغة المذكرة'}</span>
          </button>
        </div>
      ) : (
        /* Primary Claim / Appeal / Memo */
        <div className="space-y-6">
          <div className="bg-transparent border-0 rounded-3xl p-0 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-neutral-100">
                  {currentService === 'general_claim' && 'نموذج لائحة الدعوى العامة'}
                  {currentService === 'general_appeal' && 'نموذج لائحة الاعتراض والاستئناف'}
                  {currentService === 'general_memo' && 'نموذج المذكرة الجوابية'}
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                حفظ محلي (LocalStorage)
              </span>
            </div>

            {/* Plain Language Assistant for General Court */}
            <PlainStoryInput
              court="general"
              currentStory={userStory}
              onStoryChange={setUserStory}
              onApplyExtractedData={(extracted) => setPendingAdaptation(extracted)}
            />

            {pendingAdaptation && (
              <div className="space-y-4 rounded-2xl border border-emerald-500/30 bg-white/5 p-4 backdrop-blur-sm">
                <div><p className="text-xs font-bold text-emerald-300">التكييف الأولي المقترح</p><p className="mt-1 text-[11px] text-neutral-400">راجع الموضوع والأسانيد والطلبات قبل اعتمادها.</p></div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-slate-800/30 p-3"><span className="text-[10px] font-bold text-neutral-400">موضوع القضية</span><p className="mt-1 text-xs leading-relaxed text-neutral-200">{pendingAdaptation.subject || pendingAdaptation.disputedSubject}</p></div>
                  <div className="rounded-xl border border-white/10 bg-slate-800/30 p-3"><span className="text-[10px] font-bold text-neutral-400">الأسانيد المتوقعة</span><p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-neutral-200">{pendingAdaptation.legal_bases?.map((basis) => `- ${basis}`).join('\n') || pendingAdaptation.legalBases}</p></div>
                  <div className="rounded-xl border border-white/10 bg-slate-800/30 p-3"><span className="text-[10px] font-bold text-neutral-400">الطلبات المقترحة</span><p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-neutral-200">{pendingAdaptation.requests?.map((request, index) => `${index + 1}. ${request}`).join('\n') || pendingAdaptation.claimDemands}</p></div>
                </div>
                <div className="flex justify-end gap-2"><button type="button" onClick={() => setPendingAdaptation(null)} className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-300 hover:bg-neutral-800">إلغاء الاقتراح</button><button type="button" onClick={() => applyAdaptation(pendingAdaptation)} className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-neutral-950 hover:bg-emerald-400">اعتماد وتعبئة النموذج</button></div>
              </div>
            )}

            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">المدعي:</label>
                  <input
                    type="text"
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:border-emerald-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">الهوية الوطنية:</label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs font-mono focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">المدعى عليه:</label>
                <input
                  type="text"
                  value={defendantName}
                  onChange={(e) => setDefendantName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-neutral-300">موضوع النزاع والوقائع:</label>
                  {isAutoFilled && (
                    <span className="text-[10px] text-emerald-400 font-bold animate-pulse">تم التكييف والتعبئة 🪄</span>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={disputeSubject}
                  onChange={(e) => setDisputeSubject(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl bg-neutral-950 text-neutral-100 text-xs focus:border-emerald-500 outline-none resize-none transition-all duration-500 ${
                    isAutoFilled ? 'animate-auto-fill border-emerald-500 ring-2 ring-emerald-500/40' : 'border border-neutral-800'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-neutral-300">الأسانيد والنصوص النظامية (المعاملات المدنية والإثبات):</label>
                  {isAutoFilled && (
                    <span className="text-[10px] text-emerald-400 font-bold animate-pulse">مستخرجة نظامياً ✓</span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={legalGrounds}
                  onChange={(e) => setLegalGrounds(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl bg-neutral-950 text-neutral-100 text-xs focus:border-emerald-500 outline-none resize-none transition-all duration-500 ${
                    isAutoFilled ? 'animate-auto-fill border-emerald-500 ring-2 ring-emerald-500/40' : 'border border-neutral-800'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-neutral-300">الطلبات الختامية:</label>
                  {isAutoFilled && (
                    <span className="text-[10px] text-emerald-400 font-bold animate-pulse">مكتملة ✓</span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={claimDemands}
                  onChange={(e) => setClaimDemands(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl bg-neutral-950 text-neutral-100 text-xs focus:border-emerald-500 outline-none resize-none transition-all duration-500 ${
                    isAutoFilled ? 'animate-auto-fill border-emerald-500 ring-2 ring-emerald-500/40' : 'border border-neutral-800'
                  }`}
                />
              </div>
            </div>

            {/* MANDATORY BUTTON: (صياغة المذكرة) */}
            <button
              type="button"
              id="btn-draft-memo-general"
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-5 h-5" />
              <span>{isGenerating ? 'جاري الصياغة الفورية...' : 'صياغة المذكرة'}</span>
            </button>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-bold text-neutral-100">المعاينة الفورية</h3>
                </div>
                {generatedOutput && (
                  <button
                    onClick={() => setIsReviewMode(true)}
                    className="text-[11px] text-emerald-300 hover:underline font-bold"
                  >
                    فتح شاشة المراجعة الكاملة &larr;
                  </button>
                )}
              </div>

              <div className="h-[430px] overflow-y-auto p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80 text-neutral-200 text-xs leading-relaxed font-sans whitespace-pre-wrap selection:bg-emerald-500 selection:text-neutral-950 custom-scrollbar">
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
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>نظام المعاملات المدنية (م/191)</span>
              </span>
              <span className="font-mono text-emerald-400/80">المحاكم العامة</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
