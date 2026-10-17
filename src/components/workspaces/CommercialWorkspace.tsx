import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  FileText,
  Gavel,
  UploadCloud,
  Sparkles,
  ShieldCheck,
  FileCheck,
  Save,
  Maximize2,
} from 'lucide-react';
import { Attachment, UserSession } from '../../types';
import { LegalReviewEditor } from './LegalReviewEditor';
import { LegalAdaptationResult, PlainStoryInput } from './PlainStoryInput';
import { readFileAsAttachment } from '../../lib/clientAttachments';
import { readSseTextResponse } from '../../lib/readSseTextResponse';

interface CommercialWorkspaceProps {
  service: string | null;
  userSession?: UserSession | null;
}

const STORAGE_KEY_PREFIX = 'diwan_commercial_draft_v1';

const SERVICE_TITLES: Record<string, string> = {
  commercial_claim: 'لائحة دعوى تجارية - المحكمة التجارية',
  commercial_appeal: 'لائحة اعتراض على حكم تجاري',
  commercial_memo: 'مذكرة جوابية في دعوى تجارية',
  commercial_attachments: 'مذكرة فحص العقود والفواتير التجارية',
};

export function CommercialWorkspace({
  service = 'commercial_claim',
  userSession,
}: CommercialWorkspaceProps) {
  const currentService = service || 'commercial_claim';
  const storageKey = `${STORAGE_KEY_PREFIX}:${userSession?.id || 'guest'}`;

  // Restore draft from sessionStorage for this browser session
  const getInitialState = () => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return {
      claimantName: userSession?.name || '',
      defendantName: '',
      relationship: '',
      disputeSubject: 'اكتب موضوع النزاع التجاري والوقائع الأساسية كما تظهر في العقد والفواتير والمراسلات.',
      claimAmount: '',
      claimDemands: 'اكتب الطلبات التي تريد بحثها، وسيتم فحص ملاءمتها للمستندات والاختصاص التجاري.',
      userStory: '',
      uploadedFileName: '',
      uploadedFileText: '',
      generatedOutput: '',
    };
  };

  const initial = getInitialState();

  const [claimantName, setClaimantName] = useState<string>(initial.claimantName);
  const [defendantName, setDefendantName] = useState<string>(initial.defendantName);
  const [relationship, setRelationship] = useState<string>(initial.relationship || '');
  const [disputeSubject, setDisputeSubject] = useState<string>(initial.disputeSubject);
  const [claimAmount, setClaimAmount] = useState<string>(initial.claimAmount || '');
  const [claimDemands, setClaimDemands] = useState<string>(initial.claimDemands);
  const [userStory, setUserStory] = useState<string>(initial.userStory || '');
  const [uploadedFileName, setUploadedFileName] = useState<string>(initial.uploadedFileName || '');
  const [uploadedFileText, setUploadedFileText] = useState<string>(initial.uploadedFileText || '');
  const [uploadedAttachment, setUploadedAttachment] = useState<Attachment | null>(null);
  const [generatedOutput, setGeneratedOutput] = useState<string>(initial.generatedOutput || '');
  const [generationError, setGenerationError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState<boolean>(Boolean(initial.generatedOutput));
  const [lastSavedTime, setLastSavedTime] = useState<string>('محفوظ مؤقتاً في هذه الجلسة');
  const [isAutoFilled, setIsAutoFilled] = useState(false);
  const [pendingAdaptation, setPendingAdaptation] = useState<LegalAdaptationResult | null>(null);

  const applyAdaptation = (extracted: LegalAdaptationResult) => {
    setDisputeSubject(extracted.subject || extracted.disputedSubject || disputeSubject);
    setClaimDemands(
      extracted.requests?.length
        ? extracted.requests.map((request, index) => `${index + 1}. ${request}`).join('\n')
        : extracted.claimDemands || claimDemands,
    );
    setPendingAdaptation(null);
    setIsAutoFilled(true);
    setTimeout(() => setIsAutoFilled(false), 2200);
  };

  // Auto-save to sessionStorage for this browser tab/session
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({
        claimantName,
        defendantName,
        relationship,
        disputeSubject,
        claimAmount,
        claimDemands,
        userStory,
        uploadedFileName,
        uploadedFileText,
        generatedOutput,
      }));
      setLastSavedTime(`تم الحفظ في ${new Date().toLocaleTimeString('ar-SA')}`);
    } catch {
      // ignore
    }
  }, [
    claimantName,
    defendantName,
    relationship,
    disputeSubject,
    claimAmount,
    claimDemands,
    userStory,
    uploadedFileName,
    uploadedFileText,
    generatedOutput,
  ]);

  // Stage the attachment without sending it until the user explicitly requests drafting.
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const attachment = await readFileAsAttachment(file);
      setUploadedAttachment(attachment);
      setUploadedFileName(file.name);
      setUploadedFileText(`[مرفق جاهز للتحليل: ${file.name} - الحجم: ${(file.size / 1024).toFixed(1)} ك.ب]`);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'تعذر قراءة الملف.');
      setUploadedAttachment(null);
      setUploadedFileName('');
      setUploadedFileText('');
    } finally {
      e.target.value = '';
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedOutput('');
    setGenerationError('');

    const storyAddon = userStory.trim()
      ? `\n\n[سرد المستخدم أو النص المنسوخ]:\n"""\n${userStory}\n"""\nالمطلوب: تنظيم الوقائع التجارية وتكييفها دون افتراض مادة أو ميعاد؛ استخدم فقط المراجع الرسمية التي يسترجعها الخادم.`
      : '';

    const sharedRules = `قواعد إلزامية:
- افحص الاختصاص النوعي والصفة التجارية للأطراف وللعمل محل النزاع قبل الصياغة، ولا تفترضهما.
- افحص وجود شرط تحكيم أو اتفاق على جهة نظر النزاع أو إجراء سابق للقيد.
- لا تفترض صحة عقد أو ثبوت دين أو مسؤولية قبل فحص العقود والفواتير والمراسلات.
- لا تذكر مادة أو مرسوماً أو ميعاداً من الذاكرة؛ استخدم فقط الأسانيد الرسمية المسترجعة من الخادم واذكر ما يحتاج تحققاً.
- لا تعرض أرقام الهوية أو الحسابات البنكية في المخرجات.
- قبل أي اعتراض: حدد درجة الحكم من المستند أولاً، وإذا كان الطلب لا يطابق درجة الحكم فأوقف الصياغة وصحح طريق الاعتراض.
- صغ النتيجة كمسودة للمراجعة البشرية، لا كضمان لنتيجة قضائية.`;

    const caseBlock = `صاحب الشأن: [محجوب من طلب الذكاء]
الطرف الآخر: ${defendantName}
العلاقة التجارية / العقد: ${relationship || 'لم تحدد'}
موضوع النزاع: ${disputeSubject}
المبلغ محل المطالبة وأساس احتسابه: ${claimAmount || 'لم يحدد'}${storyAddon}
${uploadedFileText ? `بيانات المرفقات: ${uploadedFileText}` : ''}`;

    let prompt = '';
    if (currentService === 'commercial_claim') {
      prompt = `صغ مسودة لائحة دعوى تجارية أمام المحكمة التجارية للمراجعة، بالترتيب: البيانات، الوقائع، المستندات، الطلبات.
${caseBlock}
الطلبات المراد بحثها:
${claimDemands}

${sharedRules}`;
    } else if (currentService === 'commercial_appeal') {
      prompt = `حلل الحكم التجاري ودرجة التقاضي أولاً. لا تبدأ الصياغة حتى تميز الحكم الابتدائي من الاستئنافي، ثم اكتب أسباب الاعتراض بصيغة: الخطأ ← موضعه في الحكم ← السند أو الدليل ← الأثر.
${caseBlock}

${sharedRules}`;
    } else if (currentService === 'commercial_memo') {
      prompt = `صغ مسودة مذكرة جوابية في دعوى تجارية للمراجعة: الدفوع الشكلية (الاختصاص وشرط التحكيم والصفة) ثم الدفوع الموضوعية (السداد، المقاصة، الإخلال المقابل، ضعف الإثبات) متى ثبت سندها.
${caseBlock}

${sharedRules}`;
    } else {
      prompt = `صغ مسودة مذكرة فحص للعقود والفواتير والدفاتر التجارية في نزاع أمام المحكمة التجارية، واربط كل ملاحظة بما يظهر فعلاً في المستند وما ينقصه.
${caseBlock}
المرفق: ${uploadedFileName || 'مرفقات القضية'}

${sharedRules}`;
    }

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: prompt,
            attachments: uploadedAttachment ? [uploadedAttachment] : [],
          }],
          targetCourt: 'المحكمة التجارية',
          powerMode: true,
        }),
      });

      if (!response.ok) throw new Error('فشل التوليد');

      const fullText = await readSseTextResponse(response, (nextText) => {
        setGeneratedOutput(nextText);
      });

      if (!fullText) {
        throw new Error('لم تُرجع خدمة الذكاء مسودة قابلة للمراجعة.');
      }

      setIsReviewMode(true);
    } catch (error) {
      console.error('Document generation failed:', error);
      setGeneratedOutput('');
      setIsReviewMode(false);
      setGenerationError(
        error instanceof Error
          ? error.message
          : 'تعذر إكمال الصياغة الآلية. احتفظت المنصة بمدخلاتك دون إنشاء مسودة بديلة.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  if (isReviewMode && generatedOutput) {
    return (
      <LegalReviewEditor
        initialContent={generatedOutput}
        court="commercial"
        serviceId={currentService}
        documentTitle={SERVICE_TITLES[currentService] || SERVICE_TITLES.commercial_claim}
        clientName={claimantName}
        uploadedFileName={uploadedFileName}
        uploadedFileText={uploadedFileText}
        uploadedAttachments={uploadedAttachment ? [uploadedAttachment] : []}
        onBackToEdit={() => setIsReviewMode(false)}
        onContentChange={(updated) => setGeneratedOutput(updated)}
      />
    );
  }

  const inputClass = 'w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:border-sky-500 outline-none';
  const autoFillClass = (base: string) => `${base} transition-all duration-500 ${isAutoFilled ? 'animate-auto-fill border-sky-500 ring-2 ring-sky-500/40' : ''}`;

  return (
    <div className="qada-case-workspace qada-case-commercial max-w-6xl mx-auto space-y-6">
      {/* 1. Header & Local Storage Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-3xl bg-neutral-900 border border-sky-500/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-300">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-100">بؤرة المحاكم التجارية</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                معزول حسب الحساب
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              {currentService === 'commercial_claim' && 'إعداد وصياغة لائحة دعوى تجارية'}
              {currentService === 'commercial_appeal' && 'صياغة اعتراض على حكم تجاري'}
              {currentService === 'commercial_memo' && 'إعداد مذكرة جوابية في دعوى تجارية'}
              {currentService === 'commercial_attachments' && 'فحص العقود والفواتير والدفاتر التجارية'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-950 border border-neutral-800 text-[11px] text-neutral-400">
            <Save className="w-3.5 h-3.5 text-sky-300" />
            <span>{lastSavedTime}</span>
          </div>

          {generatedOutput && (
            <button
              type="button"
              onClick={() => setIsReviewMode(true)}
              className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-neutral-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>وضع التركيز والمراجعة</span>
            </button>
          )}
        </div>
      </div>

      {generationError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold leading-6 text-rose-200">
          تعذر إنشاء المسودة: {generationError} لم تُنشئ المنصة أي مواد أو دفوع أو نتائج بديلة، ويمكنك إعادة المحاولة بعد التحقق من الاتصال والخدمات.
        </div>
      )}

      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-sky-300" />
              <h3 className="text-sm font-bold text-neutral-100">
                {currentService === 'commercial_claim' && 'نموذج لائحة الدعوى التجارية'}
                {currentService === 'commercial_appeal' && 'نموذج الاعتراض على الحكم التجاري'}
                {currentService === 'commercial_memo' && 'نموذج المذكرة الجوابية التجارية'}
                {currentService === 'commercial_attachments' && 'نموذج فحص العقود والفواتير'}
              </h3>
            </div>
            <label className="px-3 py-1.5 rounded-xl bg-neutral-950 border border-sky-500/30 text-sky-200 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer">
              <UploadCloud className="w-3.5 h-3.5" />
              <span>{uploadedFileName ? 'تغيير المرفق' : 'إرفاق عقد أو فاتورة'}</span>
              <input type="file" onChange={handleFileUpload} className="hidden" accept=".pdf,application/pdf,image/*" />
            </label>
          </div>

          {uploadedFileName && (
            <div className="p-3 rounded-2xl bg-neutral-950 border border-sky-500/30 flex items-center gap-3">
              <FileCheck className="w-5 h-5 text-sky-300" />
              <div>
                <p className="text-xs font-bold text-neutral-200">{uploadedFileName}</p>
                <p className="text-[11px] text-neutral-400">جاهز للصياغة؛ لا يُرسل قبل الضغط على زر الصياغة.</p>
              </div>
            </div>
          )}

          <PlainStoryInput
            court="commercial"
            currentStory={userStory}
            onStoryChange={setUserStory}
            onApplyExtractedData={(extracted) => setPendingAdaptation(extracted)}
          />

          {pendingAdaptation && (
            <div className="space-y-4 rounded-2xl border border-sky-500/30 bg-white/5 p-4 backdrop-blur-sm">
              <div>
                <p className="text-xs font-bold text-sky-300">التكييف الأولي المقترح</p>
                <p className="mt-1 text-[11px] text-neutral-400">راجع الموضوع والطلبات قبل اعتمادها.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-slate-800/30 p-3">
                  <span className="text-[10px] font-bold text-neutral-400">موضوع القضية</span>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-200">{pendingAdaptation.subject || pendingAdaptation.disputedSubject}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-800/30 p-3">
                  <span className="text-[10px] font-bold text-neutral-400">الطلبات المقترحة</span>
                  <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-neutral-200">
                    {pendingAdaptation.requests?.map((request, index) => `${index + 1}. ${request}`).join('\n') || pendingAdaptation.claimDemands}
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPendingAdaptation(null)} className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-bold text-neutral-300 hover:bg-neutral-800">إلغاء الاقتراح</button>
                <button type="button" onClick={() => applyAdaptation(pendingAdaptation)} className="rounded-xl bg-sky-500 px-4 py-2 text-xs font-bold text-neutral-950 hover:bg-sky-400">اعتماد وتعبئة النموذج</button>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">المدعي (المنشأة أو التاجر):</label>
                <input type="text" value={claimantName} onChange={(e) => setClaimantName(e.target.value)} className={inputClass} />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-neutral-300">المدعى عليه:</label>
                <input type="text" value={defendantName} onChange={(e) => setDefendantName(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-neutral-300">العلاقة التجارية أو العقد (توريد، وكالة، شراكة، مقاولة...):</label>
              <input type="text" value={relationship} onChange={(e) => setRelationship(e.target.value)} className={inputClass} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-neutral-300">موضوع النزاع والوقائع:</label>
                {isAutoFilled && <span className="text-[10px] text-sky-300 font-bold animate-pulse">تم التكييف والتعبئة</span>}
              </div>
              <textarea rows={3} value={disputeSubject} onChange={(e) => setDisputeSubject(e.target.value)} className={autoFillClass(`${inputClass} resize-none`)} />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-neutral-300">المبلغ محل المطالبة وأساس احتسابه:</label>
              <input type="text" value={claimAmount} onChange={(e) => setClaimAmount(e.target.value)} className={inputClass} />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-neutral-300">الطلبات الختامية:</label>
              <textarea rows={3} value={claimDemands} onChange={(e) => setClaimDemands(e.target.value)} className={autoFillClass(`${inputClass} resize-none`)} />
            </div>
          </div>

          <button
            type="button"
            id="btn-draft-memo-commercial"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-3 px-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-neutral-950 font-black text-sm flex items-center justify-center gap-2 transition-all shadow-lg cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-5 h-5" />
            <span>{isGenerating ? 'جاري الصياغة...' : 'صياغة المذكرة'}</span>
          </button>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 sm:p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div className="flex items-center gap-2">
                <Gavel className="w-5 h-5 text-sky-300" />
                <h3 className="text-sm font-bold text-neutral-100">المعاينة الفورية</h3>
              </div>
              {generatedOutput && (
                <button onClick={() => setIsReviewMode(true)} className="text-[11px] text-sky-300 hover:underline font-bold">
                  فتح شاشة المراجعة الكاملة &larr;
                </button>
              )}
            </div>

            <div className="h-[360px] overflow-y-auto p-4 rounded-2xl bg-neutral-950 border border-neutral-800/80 text-neutral-200 text-xs leading-relaxed font-sans whitespace-pre-wrap custom-scrollbar">
              {generatedOutput ? (
                generatedOutput
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 space-y-3">
                  <FileText className="w-12 h-12 stroke-1 text-neutral-600" />
                  <p className="text-xs font-semibold text-neutral-300">اضغط على زر (صياغة المذكرة) للبدء.</p>
                  <p className="text-[11px] text-neutral-400 max-w-xs">
                    بعد الصياغة تنتقل لوضع المراجعة، ومنه إلى المحكمة الافتراضية والقاضي الافتراضي قبل التصدير.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-300" />
              <span>الأسانيد من حزمة المصادر الرسمية فقط</span>
            </span>
            <span className="font-mono text-sky-300/80">المحاكم التجارية</span>
          </div>
        </div>
      </div>
    </div>
  );
}
