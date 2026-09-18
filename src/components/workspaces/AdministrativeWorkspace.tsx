import React, { useState, useEffect } from 'react';
import {
  Building2,
  FileText,
  Scale,
  Gavel,
  AlertTriangle,
  FolderOpen,
  UploadCloud,
  Sparkles,
  Copy,
  Check,
  Printer,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Save,
  Maximize2,
} from 'lucide-react';
import { printLegalMemo } from '../../utils/printMemo';
import { UserSession } from '../../types';
import { LegalReviewEditor } from './LegalReviewEditor';
import { LegalAdaptationResult, PlainStoryInput } from './PlainStoryInput';

interface AdministrativeWorkspaceProps {
  service: string | null;
  userSession?: UserSession | null;
  onOpenArticle8Modal?: () => void;
  onOpenDossierModal?: () => void;
  onOpenRepositoryModal?: () => void;
  onOpenPdfModal?: () => void;
}

const STORAGE_KEY = 'diwan_administrative_draft_v2';

export function AdministrativeWorkspace({
  service = 'administrative_claim',
  userSession,
  onOpenArticle8Modal,
  onOpenDossierModal,
  onOpenRepositoryModal,
  onOpenPdfModal,
}: AdministrativeWorkspaceProps) {
  const currentService = service || 'administrative_claim';

  // Restore Draft from LocalStorage on mount
  const getInitialState = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // ignore
    }
    return {
      claimantName: userSession?.name || '',
      nationalId: userSession?.nationalId || '',
      defendantAgency: 'وزارة الدفاع (قيادة القوات البرية الملكية السعودية)',
      disputedDecision: 'القرار السلبي بالامتناع عن صرف بدل مكافحة الإرهاب والعمليات والجمع بين العلاوتين وفق المرسوم (م/37)',
      grievanceDate: '1445/05/15هـ',
      legalBases: 'المرسوم الملكي الكريم رقم (م/37) وتاريخ 1430/06/30هـ المعدل للمادة (17/ب) من نظام خدمة الأفراد، ومحاضر هيئة الخبراء بمجلس الوزراء رقم (198) لعام 1430هـ، وقرار مجلس الشورى (63/92)، والمادة (8) من نظام المرافعات أمام ديوان المظالم.',
      claimRequests: '1. إلغاء القرار الإداري السلبي المطعون فيه بالامتناع عن الصرف.\n2. إلزام الجهة الإدارية المدعى عليها بصرف بدل مكافحة الإرهاب بنسبة 25% وبدل العمليات بأثر رجعي.\n3. إلزام الجهة بتنفيذ المرسوم الملكي (م/37) والجمع بين العلاوتين نظاماً.',
      userStory: '',
      uploadedFileName: '',
      uploadedFileText: '',
      generatedOutput: '',
    };
  };

  const initial = getInitialState();

  // Form State
  const [claimantName, setClaimantName] = useState<string>(initial.claimantName);
  const [nationalId, setNationalId] = useState<string>(initial.nationalId);
  const [defendantAgency, setDefendantAgency] = useState<string>(initial.defendantAgency);
  const [disputedDecision, setDisputedDecision] = useState<string>(initial.disputedDecision);
  const [grievanceDate, setGrievanceDate] = useState<string>(initial.grievanceDate);
  const [legalBases, setLegalBases] = useState<string>(initial.legalBases);
  const [claimRequests, setClaimRequests] = useState<string>(initial.claimRequests);

  // Plain Narrative / Pasted Text State ("صار كذا كذا")
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
    const newSubject = extracted.subject || extracted.disputedSubject || disputedDecision;
    const newLegalBases = extracted.legal_bases?.length
      ? extracted.legal_bases.map((basis) => `- ${basis}`).join('\n')
      : extracted.legalBases || legalBases;
    const newRequests = extracted.requests?.length
      ? extracted.requests.map((request, index) => `${index + 1}. ${request}`).join('\n')
      : extracted.claimDemands || claimRequests;

    setDisputedDecision(newSubject);
    setLegalBases(newLegalBases);
    setClaimRequests(newRequests);
    setPendingAdaptation(null);
    setIsAutoFilled(true);
    setTimeout(() => setIsAutoFilled(false), 2200);
  };

  // Auto-save to LocalStorage whenever form fields or output change
  useEffect(() => {
    try {
      const dataToSave = {
        claimantName,
        nationalId,
        defendantAgency,
        disputedDecision,
        grievanceDate,
        legalBases,
        claimRequests,
        userStory,
        uploadedFileName,
        uploadedFileText,
        generatedOutput,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
      const now = new Date();
      setLastSavedTime(`تم الحفظ في ${now.toLocaleTimeString('ar-SA')}`);
    } catch {
      // quota or private mode
    }
  }, [
    claimantName,
    nationalId,
    defendantAgency,
    disputedDecision,
    grievanceDate,
    legalBases,
    claimRequests,
    userStory,
    uploadedFileName,
    uploadedFileText,
    generatedOutput,
  ]);

  // Handle Attachment Upload (STRICT: NO API CALL IS MADE HERE)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      const summaryText = `[مرفق مستند: ${file.name} - الحجم: ${(file.size / 1024).toFixed(1)} ك.ب]\n${content.slice(0, 1200)}`;
      setUploadedFileText(summaryText);
      setDisputedDecision((prev) => `${prev}\n(مرفق: ${file.name})`);
    };
    reader.readAsText(file);
  };

  // Generation Handler triggered ONLY by explicit "صياغة المذكرة" button
  const handleGenerateDocument = async () => {
    const cleanNationalId = nationalId.trim().replace(/\D/g, '');
    if (
      claimantName.trim().length < 3 ||
      cleanNationalId.length !== 10 ||
      !defendantAgency.trim() ||
      !grievanceDate.trim() ||
      !disputedDecision.trim()
    ) {
      window.alert('يرجى إكمال اسم صاحب الحق ورقم الهوية والجهة وتاريخ التظلم وموضوع الدعوى قبل الصياغة.');
      return;
    }

    setIsGenerating(true);
    setGeneratedOutput('');

    let promptContent = '';
    const storyAddon = userStory.trim()
      ? `\n\n[سرد العميل أو النص المنسوخ لما حدث (صار كذا كذا)]:\n"""\n${userStory}\n"""\nمهمتك تحويل هذا السرد البسيط إلى أسانيد ووقائع نظامية رفيعة ومطابقة لأحكام ديوان المظالم والمرسوم م/37 والأنظمة السعودية.`
      : '';

    if (currentService === 'administrative_claim') {
      promptContent = `بصفتك مستشاراً قضائياً خبيراً في ديوان المظالم بالمملكة العربية السعودية، قم بصياغة (لائحة دعوى إدارية) نموذجية مكتملة الأركان وفق نظام المرافعات أمام ديوان المظالم ولائحته التنفيذية بالبيانات التالية:
المدعي: ${claimantName} - رقم الهوية: ${nationalId}
الجهة المدعى عليها: ${defendantAgency}
موضوع الدعوى والقرار المطعون فيه: ${disputedDecision}
تاريخ التظلم الإداري الوجوبي (مادة 8): ${grievanceDate}
الأسانيد النظامية والشرعية: ${legalBases}
${storyAddon}
${uploadedFileText ? `بيانات المرفقات المودعة: ${uploadedFileText}` : ''}
الطلبات الختامية:
${claimRequests}

اجعل الصياغة رصينة، تبدأ بالبسملة، وتوجه إلى فضيلة رئيس وأعضاء الدائرة الإدارية بالمحكمة الإدارية، واذكر الوقائع بدقة، ثم الأسانيد (مع إبراز عدم جواز تعطيل المرسوم الملكي م/37 وحظر تنصل الإدارة من تشريع شاركت في إقراره)، ثم الطلبات، والتوقيع.`;
    } else if (currentService === 'administrative_appeal') {
      promptContent = `بصفتك خبيراً في الطعون الإدارية، قم بصياغة (لائحة اعتراض واستئناف حكم إداري) أمام محكمة الاستئناف الإدارية بديوان المظالم.
المستأنف: ${claimantName} (هوية: ${nationalId})
المستأنف ضدها: ${defendantAgency}
موضوع الاستئناف: الطعن على الحكم الابتدائي لقصوره في التسبيب ومخالفته لصريح المرسوم الملكي (م/37) لعام 1430هـ وقرار الشورى 63/92.
${storyAddon}
الأسانيد والمرفقات: ${legalBases} ${uploadedFileText ? `\nالمرفقات: ${uploadedFileText}` : ''}
الطلبات: ${claimRequests}`;
    } else if (currentService === 'administrative_memo') {
      promptContent = `قم بصياغة (مذكرة رد ومرافعة جوابية) أمام المحكمة الإدارية تدحض تمسك ممثل ${defendantAgency} بالقرارات القديمة لعام 1425هـ واحتجاجه بحظر الجمع، وإثبات نسخ هذا الحظر بالمرسوم الملكي النافذ (م/37) وقواعد تدرج القواعد القانونية.
المدعي: ${claimantName}
${storyAddon}
الطلبات: ${claimRequests}`;
    } else {
      promptContent = `قدم صياغة قانونية متكاملة لـ (رفع مرفقات ومذكرة إيداع بينات) أمام ديوان المظالم تتضمن تفنيد المستند (${uploadedFileName || 'القرار المطعون فيه'}) ومطابقته للمرسوم الملكي م/37.
المدعي: ${claimantName} - الهوية: ${nationalId}
الجهة: ${defendantAgency}
${storyAddon}`;
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: promptContent }],
          targetCourt: 'المحكمة الإدارية',
          clientNationalId: nationalId,
          clientPersonName: claimantName,
          powerMode: true,
        }),
      });

      if (!response.ok) {
        throw new Error('فشل توليد المذكرة من الخادم');
      }

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
        fullText = `بسم الله الرحمن الرحيم\n\nلدى فضيلة رئيس وأعضاء الدائرة الإدارية بالمحكمة الإدارية الموقرين\n\nالسلام عليكم ورحمة الله وبركاته،، وبعد:\n\nموضوع الدعوى: المطالبة بإلغاء القرار الإداري السلبي بالامتناع عن صرف البدلات المقررة نظاماً.\n\nالمدعي: ${claimantName} - سجل مدني: (${nationalId})\nالمدعى عليها: ${defendantAgency}\n\nأولاً: في الشكل:\nحيث تظلم المدعي أمام الجهة المدعى عليها بتاريخ ${grievanceDate} استيفاءً للقيد الإجرائي المنصوص عليه في المادة (8) من نظام ديوان المظالم، ومضى الميعاد النظامي دون جدوى، فتكون الدعوى مقبولة شكلاً لاستيفائها كافة شرائطها المقررة.\n\nثانياً: في الموضوع:\n1. استحقاق المدعي الثابت وفق المرسوم الملكي الكريم رقم (م/37) وتاريخ 1430/06/30هـ المعدل للمادة (17/ب) من نظام خدمة الأفراد بجواز الجمع.\n2. ما أثبتته محاضر هيئة الخبراء بمجلس الوزراء رقم (198) لعام 1430هـ بمصادقة ممثلي وزارتي الدفاع والمالية، وقرار مجلس الشورى رقم (63/92).\n\nبناءً عليه، يطلب المدعي الحكم بـ:\n${claimRequests}\n\nوتقبلوا وافر التحية والتقدير،،\nالمدعي: ${claimantName}`;
        setGeneratedOutput(fullText);
      }

      // Automatically switch to Focus Mode (Legal Review Editor)
      setIsReviewMode(true);
    } catch (error) {
      console.error('Error generating document:', error);
      const fallbackText = `بسم الله الرحمن الرحيم\n\nلدى المحكمة الإدارية الموقرة\n\nالمدعي: ${claimantName} - الهوية: (${nationalId})\nالمدعى عليها: ${defendantAgency}\nالموضوع: دعوى إلغاء قرار إداري والتعويض.\n\nالأسانيد:\n- المرسوم الملكي رقم (م/37) وتاريخ 1430/06/30هـ.\n- قرار مجلس الشورى 63/92 ومحضر الخبراء رقم 198.\n\nالطلبات:\n${claimRequests}\n\nمقدمه: ${claimantName}`;
      setGeneratedOutput(fallbackText);
      setIsReviewMode(true);
    } finally {
      setIsGenerating(false);
    }
  };

  // If Review Mode is active, render LegalReviewEditor (Focus Mode)
  if (isReviewMode && generatedOutput) {
    return (
      <LegalReviewEditor
        initialContent={generatedOutput}
        court="administrative"
        serviceId={currentService}
        documentTitle={
          currentService === 'administrative_claim'
            ? 'لائحة دعوى إدارية - ديوان المظالم'
            : currentService === 'administrative_appeal'
            ? 'لائحة اعتراض واستئناف إداري'
            : currentService === 'administrative_memo'
            ? 'مذكرة رد ودفوع موضوعية'
            : 'مذكرة إيداع مرفقات ومستندات'
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
      {/* 1. Header & Storage Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-neutral-900 border border-amber-500/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-100">بؤرة القضايا الإدارية</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                عزل تام
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {currentService === 'administrative_claim' && 'إعداد وصياغة لائحة دعوى إدارية (إلغاء قرار / تعويض)'}
              {currentService === 'administrative_appeal' && 'صياغة اعتراض واستئناف حكم إداري'}
              {currentService === 'administrative_memo' && 'إعداد مذكرة رد ودفوع موضوعية'}
              {currentService === 'administrative_attachments' && 'رفع مرفقات ومستندات وقرارات إدارية'}
            </p>
          </div>
        </div>

        {/* Local Storage Indicator & Focus Mode Switch */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400">
            <Save className="w-3.5 h-3.5 text-amber-400" />
            <span>{lastSavedTime}</span>
          </div>

          {generatedOutput && (
            <button
              type="button"
              onClick={() => setIsReviewMode(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>وضع التركيز والمراجعة</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Form & Workspace Mode */}
      {currentService === 'administrative_attachments' ? (
        /* رفع مرفقات View (Staged, No Automatic API Trigger) */
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2.5 text-amber-400">
              <UploadCloud className="w-6 h-6" />
              <div>
                <h3 className="text-lg font-bold text-neutral-100">رفع مرفقات وقرارات القضية</h3>
                <p className="text-xs text-neutral-400">
                  يتم حفظ المرفقات في مسودة العمل محلياً دون استهلاك رصيد أو تشغيل تلقائي للذكاء الاصطناعي
                </p>
              </div>
            </div>
            <label className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow">
              <UploadCloud className="w-4 h-4" />
              <span>اختيار ملف من الجهاز</span>
              <input type="file" onChange={handleFileUpload} className="hidden" accept=".pdf,.doc,.docx,.txt,image/*" />
            </label>
          </div>

          {uploadedFileName && (
            <div className="p-4 rounded-2xl bg-neutral-950 border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileCheck className="w-6 h-6 text-emerald-400" />
                <div>
                  <p className="text-xs font-bold text-neutral-200">{uploadedFileName}</p>
                  <p className="text-[11px] text-neutral-400">تم إدراج المرفق بنجاح في مسودة القضية الحالية.</p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20">
                جاهز للصياغة
              </span>
            </div>
          )}

          {/* Prompt fields before API call */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-300">المدعي:</label>
              <input
                type="text"
                value={claimantName}
                onChange={(e) => setClaimantName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:border-amber-500 outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-300">الجهة المدعى عليها:</label>
              <input
                type="text"
                value={defendantAgency}
                onChange={(e) => setDefendantAgency(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {/* EXPLICIT BUTTON (صياغة المذكرة) */}
          <button
            type="button"
            id="btn-draft-memo-attachments"
            onClick={handleGenerateDocument}
            disabled={isGenerating}
            className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5" />
            <span>{isGenerating ? 'جاري التحليل والصياغة...' : 'صياغة المذكرة'}</span>
          </button>
        </div>
      ) : (
        /* Primary Pleading / Claim / Appeal / Memo Studio */
        <div className="space-y-6">
          <div className="bg-transparent border-0 rounded-3xl p-0 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-neutral-100">
                  {currentService === 'administrative_claim' && 'نموذج لائحة الدعوى الإدارية'}
                  {currentService === 'administrative_appeal' && 'نموذج لائحة الاعتراض والاستئناف'}
                  {currentService === 'administrative_memo' && 'نموذج المذكرة الجوابية'}
                </h3>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                حفظ تلقائي (LocalStorage)
              </span>
            </div>

            {/* Plain Language / Narrative Assistant Component for Non-Lawyers */}
            <PlainStoryInput
              court="administrative"
              currentStory={userStory}
              onStoryChange={setUserStory}
              onApplyExtractedData={(extracted) => setPendingAdaptation(extracted)}
            />

            {pendingAdaptation && (
              <div className="space-y-4 rounded-2xl border border-amber-500/30 bg-white/5 p-4 backdrop-blur-sm">
                <div>
                  <p className="text-xs font-bold text-amber-300">التكييف الأولي المقترح</p>
                  <p className="mt-1 text-[11px] text-neutral-400">راجع النتيجة ثم اعتمدها لتعبئة نموذج اللائحة، أو عدّلها يدويًا بعد الاعتماد.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-slate-800/30 p-3">
                    <span className="text-[10px] font-bold text-neutral-400">موضوع القضية</span>
                    <p className="mt-1 text-xs leading-relaxed text-neutral-200">{pendingAdaptation.subject || pendingAdaptation.disputedSubject}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-800/30 p-3">
                    <span className="text-[10px] font-bold text-neutral-400">الأسانيد المتوقعة</span>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-neutral-200">{pendingAdaptation.legal_bases?.map((basis) => `- ${basis}`).join('\n') || pendingAdaptation.legalBases}</p>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-slate-800/30 p-3">
                    <span className="text-[10px] font-bold text-neutral-400">الطلبات المقترحة</span>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-neutral-200">{pendingAdaptation.requests?.map((request, index) => `${index + 1}. ${request}`).join('\n') || pendingAdaptation.claimDemands}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button type="button" onClick={() => setPendingAdaptation(null)} className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-300 hover:bg-neutral-800">إلغاء النتيجة</button>
                  <button type="button" onClick={() => applyAdaptation(pendingAdaptation)} className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-950 hover:bg-amber-400">اعتماد وتعبئة النموذج</button>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">المدعي (صاحب الحق):</label>
                  <input
                    type="text"
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:border-amber-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">رقم الهوية الوطنية:</label>
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    required
                    maxLength={10}
                    inputMode="numeric"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs font-mono focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">الجهة المدعى عليها:</label>
                  <input
                    type="text"
                    value={defendantAgency}
                    onChange={(e) => setDefendantAgency(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:border-amber-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-neutral-300">تاريخ التظلم الإداري (م/8):</label>
                  <input
                    type="text"
                    value={grievanceDate}
                    onChange={(e) => setGrievanceDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs font-mono focus:border-amber-500 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-neutral-300">موضوع الدعوى والقرار المطعون فيه:</label>
                  {isAutoFilled && (
                    <span className="text-[10px] text-amber-400 font-bold animate-pulse">تم التكييف والتعبئة 🪄</span>
                  )}
                </div>
                <textarea
                  rows={2}
                  value={disputedDecision}
                  onChange={(e) => setDisputedDecision(e.target.value)}
                  required
                  className={`w-full px-3 py-2 rounded-xl bg-neutral-950 text-neutral-100 text-xs focus:border-amber-500 outline-none resize-none transition-all duration-500 ${
                    isAutoFilled ? 'animate-auto-fill border-amber-500 ring-2 ring-amber-500/40' : 'border border-neutral-800'
                  }`}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-neutral-300">الأسانيد النظامية والمواد المستند إليها:</label>
                  {isAutoFilled && (
                    <span className="text-[10px] text-amber-400 font-bold animate-pulse">مستخرجة نظامياً ✓</span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={legalBases}
                  onChange={(e) => setLegalBases(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl bg-neutral-950 text-neutral-100 text-xs focus:border-amber-500 outline-none resize-none transition-all duration-500 ${
                    isAutoFilled ? 'animate-auto-fill border-amber-500 ring-2 ring-amber-500/40' : 'border border-neutral-800'
                  }`}
                />
              </div>

              <button
                type="button"
                id="btn-draft-memo-admin"
                onClick={handleGenerateDocument}
                disabled={isGenerating}
                className="w-full bg-amber-500/90 hover:bg-amber-500 text-slate-950 font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-5 h-5" />
                <span>{isGenerating ? 'جاري الاتصال بالذكاء الاصطناعي والصياغة...' : 'صياغة المذكرة الاحترافية'}</span>
              </button>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-neutral-300">الطلبات الختامية الجازمة:</label>
                  {isAutoFilled && (
                    <span className="text-[10px] text-amber-400 font-bold animate-pulse">مكتملة ✓</span>
                  )}
                </div>
                <textarea
                  rows={3}
                  value={claimRequests}
                  onChange={(e) => setClaimRequests(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl bg-neutral-950 text-neutral-100 text-xs focus:border-amber-500 outline-none resize-none transition-all duration-500 ${
                    isAutoFilled ? 'animate-auto-fill border-amber-500 ring-2 ring-amber-500/40' : 'border border-neutral-800'
                  }`}
                />
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-slate-300 text-sm backdrop-blur-sm">
                <span className="text-xs text-amber-400/80 block mb-1">الأسانيد النظامية والمواد المستند إليها (كمثال توضيحي):</span>
                <p className="opacity-80">المرسوم الملكي الكريم رقم (م/37) وتاريخ 1430/06/30هـ...</p>
              </div>
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-amber-400" />
                  <h3 className="text-sm font-bold text-neutral-100">المعاينة الفورية</h3>
                </div>
                {generatedOutput && (
                  <button
                    onClick={() => setIsReviewMode(true)}
                    className="text-[11px] text-amber-300 hover:underline font-bold"
                  >
                    فتح شاشة المراجعة الكاملة &larr;
                  </button>
                )}
              </div>

              <div className="h-[430px] overflow-y-auto p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80 text-neutral-200 text-xs leading-relaxed font-sans whitespace-pre-wrap selection:bg-amber-500 selection:text-neutral-950 custom-scrollbar">
                {generatedOutput ? (
                  generatedOutput
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 space-y-3">
                    <FileText className="w-12 h-12 stroke-1 text-neutral-600" />
                    <p className="text-xs font-semibold text-neutral-300">
                      اضغط على زر (صياغة المذكرة) لبدء التوليد.
                    </p>
                    <p className="text-[11px] text-neutral-400 max-w-xs">
                      سواءً أدخلت المواد يدوياً أو كتبت ما حدث معك في مربع "وش صار معك"، سيقوم النظام بصياغة المذكرة واستخراج المواد المناسبة تلقائياً.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>ديوان المظالم بالمملكة العربية السعودية</span>
              </span>
              <span className="font-mono text-amber-400/80">م/37</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
