import { useState, useMemo } from 'react';
import {
  FileText,
  Gavel,
  ShieldAlert,
  ArrowRight,
  Scale,
  Calendar,
  CheckCircle2,
  Copy,
  Check,
  Send,
  Sparkles,
  BookOpen,
  HelpCircle,
  Download,
  Printer,
} from 'lucide-react';
import { JudgmentRecord, PleadingDocumentType, CaseStageLevel, UserSession } from '../types';
import { printLegalMemo } from '../utils/printMemo';

interface CasePleadingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: JudgmentRecord;
  onSendToChatPrompt: (promptText: string) => void;
  currentUser?: UserSession | null;
}

export function CasePleadingStudioModal({
  isOpen,
  onClose,
  record,
  onSendToChatPrompt,
  currentUser,
}: CasePleadingStudioModalProps) {
  const [activeDocType, setActiveDocType] = useState<PleadingDocumentType>('صحيفة طعن بالنقض');
  const [copied, setCopied] = useState(false);

  // Record access is already scoped by the server repository. Do not rewrite
  // parties or identifiers based on browser-side heuristics.
  const effectiveRecord = useMemo<JudgmentRecord>(() => record, [record]);

  const [selectedStage, setSelectedStage] = useState<CaseStageLevel>(
    effectiveRecord.courtType === 'المحكمة الإدارية العليا'
      ? 'المحكمة الإدارية العليا (النقض)'
      : effectiveRecord.courtType === 'محكمة الاستئناف الإدارية'
      ? 'محكمة الاستئناف الإدارية'
      : 'المحكمة الإدارية (الدرجة الأولى)'
  );

  if (!isOpen) return null;

  // Generates a structured working draft without inventing legal citations or deadlines.
  // Any article, decree, precedent, or time limit must be verified later through the source-gated AI path.
  const generatePleadingDraft = () => {
    const flaws = effectiveRecord.fatalFlawsFound.length
      ? effectiveRecord.fatalFlawsFound.map((item, index) => `${index + 1}. ${item}`).join('\n')
      : 'لا توجد ملاحظات مسجلة في ملف القضية حتى الآن.';

    const rebuttals = effectiveRecord.strongestRebuttals.length
      ? effectiveRecord.strongestRebuttals.map((item, index) => `${index + 1}. ${item}`).join('\n')
      : 'تحتاج الردود إلى استكمال وربطها بالمستندات.';

    const citedRegulations = effectiveRecord.applicableRegulations.length
      ? effectiveRecord.applicableRegulations.map((item) => `- ${item} [يحتاج مطابقة بالمصدر الرسمي]`).join('\n')
      : '- لم يُثبت في ملف القضية سند نظامي متحقق بعد.';

    const citedPrecedents = effectiveRecord.courtPrecedents.length
      ? effectiveRecord.courtPrecedents.map((item) => `- ${item} [لا يعتمد قبل التحقق من الحكم/المبدأ الرسمي]`).join('\n')
      : '- لا توجد سوابق قضائية متحققة مضافة إلى ملف القضية.';

    const commonHeader = `بسم الله الرحمن الرحيم

لدى ${effectiveRecord.courtType}
${effectiveRecord.circuitName ? `الدائرة: ${effectiveRecord.circuitName}` : ''}
نوع المحرر: ${activeDocType}

صاحب الشأن: ${effectiveRecord.personName}
الجهة المقابلة: ${effectiveRecord.agencyName}
رقم القضية: ${effectiveRecord.caseNumber || 'غير محدد'}
رقم الحكم/الصك: ${effectiveRecord.judgmentNumber || 'غير محدد'}
تاريخ الحكم: ${effectiveRecord.judgmentDate || 'غير محدد'}

تنبيه مرجعي:
هذه مسودة عمل تنظيمية. لا تتضمن افتراضاً بصحة مادة أو ميعاد أو مرسوم أو سابقة قضائية. يجب مطابقة كل سند مع المصدر الرسمي قبل التقديم.`;

    const facts = `
أولاً: الوقائع كما هي مثبتة في ملف القضية
${effectiveRecord.facts || 'تحتاج الوقائع إلى استكمال من المستندات.'}

ثانياً: مواضع الخلل أو الاعتراض المسجلة
${flaws}

ثالثاً: الأسانيد المذكورة في ملف القضية — للتحقق
${citedRegulations}

رابعاً: السوابق أو المبادئ المذكورة — للتحقق المستقل
${citedPrecedents}

خامساً: الردود والحجج المطلوب فحصها
${rebuttals}
`;

    switch (activeDocType) {
      case 'صحيفة طعن بالنقض':
        return `${commonHeader}

صحيفة طعن — مسودة للمراجعة

${facts}

سادساً: مسائل القبول الشكلي التي يجب التحقق منها
- تاريخ التبليغ بالحكم.
- تاريخ إيداع الطعن.
- النص النافذ المنظم للميعاد والشروط الشكلية.
- المحكمة والدائرة المختصة.

سابعاً: أوجه الطعن المطلوب بحثها
- مدى وجود خطأ في تطبيق النظام أو تفسيره.
- مدى وجود قصور أو تناقض في التسبيب.
- مدى معالجة الحكم للدفوع الجوهرية المثبتة في الملف.
- أي وجه آخر لا يدرج إلا بعد ربطه بالنص الرسمي والمستند.

ثامناً: الطلبات
تلتمس الجهة مقدمة الطعن بحث قبول الطعن والطلبات الموضوعية وفق ما يثبته النظام النافذ والمستندات الرسمية، دون افتراض نتيجة قبل التحقق.

مقدمه / ${effectiveRecord.personName}`;

      case 'لائحة اعتراضية استئنافية':
        return `${commonHeader}

لائحة اعتراضية استئنافية — مسودة للمراجعة

${facts}

سادساً: مسائل شكلية تحتاج تحققاً
- تاريخ التبليغ بالحكم وتاريخ الاعتراض.
- الميعاد النظامي النافذ وشروطه.
- نطاق اختصاص محكمة الاستئناف في هذه المرحلة.

سابعاً: أسباب الاعتراض
- أوجه القصور أو التناقض المحددة في الحكم.
- الوقائع أو الأدلة التي لم تُناقش على النحو المبين في ملف القضية.
- التكييف النظامي الذي يطلب مراجعته، بعد تثبيت سنده الرسمي.

ثامناً: الطلبات
بحث قبول الاعتراض والطلبات التي يجيزها النظام في ضوء المرحلة القضائية والمستندات المتاحة.

مقدمه / ${effectiveRecord.personName}`;

      case 'لائحة دعوى':
        return `${commonHeader}

لائحة دعوى — مسودة للمراجعة

${facts}

سادساً: الشروط الإجرائية التي يجب التحقق منها
- الاختصاص والصفة والمصلحة.
- التظلم السابق إن كان مطلوباً لنوع الدعوى.
- المواعيد وفق نوع الطلب والنص النافذ.
- اكتمال المستندات المؤيدة.

سابعاً: الطلبات
تدرج الطلبات النهائية بعد التحقق من نوع الدعوى والسند النظامي والمستندات، مع فصل الطلبات الأصلية والاحتياطية عند الحاجة.

مقدمه / ${effectiveRecord.personName}`;

      case 'التماس إعادة النظر':
        return `${commonHeader}

التماس إعادة نظر — مسودة للمراجعة

${facts}

سادساً: سبب الالتماس
يجب تحديد الحالة النظامية التي يُبنى عليها الالتماس وربطها بوقائع ومستندات ثابتة، ثم مطابقة النص والميعاد من المصدر الرسمي قبل التقديم.

سابعاً: الطلبات
بحث قبول الالتماس وما يترتب عليه فقط بالقدر الذي يسمح به النظام النافذ بعد التحقق من السبب والميعاد والاختصاص.

مقدمه / ${effectiveRecord.personName}`;

      case 'مذكرة جوابية':
      case 'مذكرة دفوع شكلية وموضوعية':
      default:
        return `${commonHeader}

مذكرة دفوع وردود — مسودة للمراجعة

${facts}

سادساً: الرد على دفوع الطرف الآخر
${effectiveRecord.dialoguesAndExchanges.length
  ? effectiveRecord.dialoguesAndExchanges.map((item) => `- ما ورد من ${item.speaker}: ${item.statement}\n  الرد المقترح للفحص: ${item.rebuttalArg || 'يحتاج صياغة وربطاً بالدليل.'}`).join('\n')
  : 'لا توجد ردود مسجلة في ملف القضية.'}

سابعاً: الطلبات
تحدد الطلبات النهائية بعد مطابقة الوقائع والأدلة والأسانيد النظامية بالمصادر الرسمية.

مقدمه / ${effectiveRecord.personName}`;
    }
  };

  const draftText = generatePleadingDraft();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(draftText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendToChat = () => {
    const promptToSend = [
      'راجع المسودة التالية كمحرر قانوني سعودي، مع الالتزام ببوابة التحقق المرجعي:',
      '- لا تضف مادة أو مرسوماً أو قراراً أو ميعاداً أو حكماً من الذاكرة.',
      '- اربط أي سند جديد بمصدر رسمي مسترجع، وإلا اذكر أن التحقق مطلوب.',
      '- لا تفترض قبول الطلبات أو صحة الميعاد.',
      '- لا تعرض رقم الهوية أو أي معرّف شخصي غير لازم.',
      `المحكمة المستهدفة: ${effectiveRecord.courtType}`,
      `نوع المحرر: ${activeDocType}`,
      '',
      draftText,
    ].join('\n');

    onSendToChatPrompt(promptToSend);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto">
      <div
        id="case-pleading-studio-modal"
        className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-5xl w-full shadow-2xl overflow-hidden flex flex-col text-neutral-100 max-h-[92vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-amber-200">
                  استوديو إعداد لوائح الترافع والطعون القضائية
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-neutral-800 text-amber-400 border border-neutral-700">
                  قضية {record.caseNumber || '—'}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                إعداد مسودات منظمة للقضية مع إلزام التحقق من الأسانيد قبل الاعتماد: {effectiveRecord.personName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Document Type Selector */}
          <div>
            <label className="block text-xs font-bold text-neutral-400 mb-2">
              اختر نوع المحرر القضائي المطلوب إعداده للمحكمة:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {(
                [
                  'صحيفة طعن بالنقض',
                  'لائحة اعتراضية استئنافية',
                  'لائحة دعوى',
                  'مذكرة جوابية',
                  'مذكرة دفوع شكلية وموضوعية',
                  'التماس إعادة النظر',
                ] as PleadingDocumentType[]
              ).map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveDocType(type)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-center ${
                    activeDocType === type
                      ? 'bg-amber-500 text-neutral-950 border-amber-400 shadow-md font-extrabold'
                      : 'bg-neutral-800/80 text-neutral-300 border-neutral-700 hover:border-amber-500/40 hover:text-white'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Legal Intelligence Bar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3.5 bg-neutral-950/70 border border-neutral-800 rounded-xl text-xs">
            <div>
              <span className="text-neutral-400 block mb-1">المحكمة المختصة:</span>
              <span className="font-bold text-amber-300 flex items-center gap-1">
                <Gavel className="w-3.5 h-3.5" />
                {record.courtType} ({record.circuitName})
              </span>
            </div>
            <div>
              <span className="text-neutral-400 block mb-1">الجهة المدعى عليها:</span>
              <span className="font-semibold text-neutral-200">{record.agencyName}</span>
            </div>
            <div>
              <span className="text-neutral-400 block mb-1">رقم القضية وصك الحكم:</span>
              <span className="font-mono text-neutral-300">
                قضية: {record.caseNumber} • صك: {record.judgmentNumber}
              </span>
            </div>
          </div>

          {/* Fatal Flaws & Rebuttals Reference Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-900/40 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-rose-300 mb-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>الأخطاء المرصودة في موقف الخصم وحكم الموضوع:</span>
              </div>
              <ul className="space-y-1.5 text-neutral-300 list-disc list-inside">
                {record.fatalFlawsFound.map((flaw, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {flaw}
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-900/40 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-emerald-300 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>الحجج والبراهين الرادعة المضمنة في الصياغة:</span>
              </div>
              <ul className="space-y-1.5 text-neutral-300 list-disc list-inside">
                {record.strongestRebuttals.map((reb, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {reb}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Pleading Draft Editor/Viewer */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-amber-400" />
                مسودة اللائحة النظامية المعتمدة (جاهزة للطباعة أو الإيداع بنظام معين):
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">تم النسخ</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>نسخ النص</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => printLegalMemo(draftText, `${activeDocType} - ${record.personName}`)}
                  title="طباعة المذكرة"
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 hover:text-white bg-amber-950/40 hover:bg-amber-900/50 border border-amber-500/40 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  <span>طباعة المذكرة</span>
                </button>

                <button
                  onClick={handleSendToChat}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-neutral-950 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 transition-colors flex items-center gap-1.5 shadow-md cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-neutral-950" />
                  <span>إرسال للمستشار الذكي للصقل والمحاكاة</span>
                </button>
              </div>
            </div>

            <textarea
              readOnly
              value={draftText}
              rows={14}
              className="w-full p-4 rounded-xl text-xs md:text-sm font-mono text-neutral-200 bg-neutral-950 border border-neutral-800 leading-relaxed focus:outline-hidden"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-900/90 flex items-center justify-between text-xs text-neutral-400">
          <span>
            جميع المذكرات مصاغة بلغة قضائية صارمة تراعي قيد الميعاد الإجرائي ونفي السلطة التقديرية.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
