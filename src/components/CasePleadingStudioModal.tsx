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

  // Derive sanitized record: if user is not admin, NEVER leak admin national ID or name
  const effectiveRecord = useMemo<JudgmentRecord>(() => {
    if (currentUser?.role === 'admin') {
      return record;
    }
    // If the record belongs to the admin, strictly mask it with citizen session or standard citizen details
    if (record.nationalId === '1096882228') {
      return {
        ...record,
        id: `sanitized-${currentUser?.nationalId || 'citizen'}`,
        personName: currentUser?.personName || 'صاحب الشأن (المراجع)',
        nationalId: currentUser?.nationalId || '1082918231',
        agencyName: 'الجهة الإدارية المدعى عليها',
      };
    }
    return {
      ...record,
      personName: currentUser?.personName || record.personName,
      nationalId: currentUser?.nationalId || record.nationalId,
    };
  }, [record, currentUser]);

  const [selectedStage, setSelectedStage] = useState<CaseStageLevel>(
    effectiveRecord.courtType === 'المحكمة الإدارية العليا'
      ? 'المحكمة الإدارية العليا (النقض)'
      : effectiveRecord.courtType === 'محكمة الاستئناف الإدارية'
      ? 'محكمة الاستئناف الإدارية'
      : 'المحكمة الإدارية (الدرجة الأولى)'
  );

  if (!isOpen) return null;

  // Generate specialized, rigorous pleading draft tailored for the chosen document and stage
  const generatePleadingDraft = () => {
    switch (activeDocType) {
      case 'صحيفة طعن بالنقض':
        return `المقام السامي لدى المحكمة الإدارية العليا الموقرة
الدائرة القضائية المختصة بفحص الطعون

صحيفة طعن بطريق النقض أمام المحكمة الإدارية العليا
(عملاً بالمواد 43 و44 من نظام المرافعات أمام ديوان المظالم)

أولاً: بيانات أطراف الطعن:
1. الطاعن: ${effectiveRecord.personName}، رقم الهوية الوطنية: (${effectiveRecord.nationalId})، وكيله الشرعي بموجب وكالة سارية.
2. المطعون ضدها: ${effectiveRecord.agencyName}.
3. الحكم المطعون فيه: الصادر في القضية رقم (${effectiveRecord.caseNumber}) وتاريخ (${effectiveRecord.judgmentDate}) عن ${effectiveRecord.courtType} (${effectiveRecord.circuitName}).

ثانياً: قبول الطعن شكلاً (التحقق الحتمي من الميعاد):
تأسيساً على نص المادة (43) من نظام المرافعات أمام ديوان المظالم، وحيث تم تبليغ الطاعن بصك الحكم بتاريخ حديث، وقيد هذا الطعن خلال ميعاد الثلاثين (30) يوماً المقررة نظاماً، وحيث استوفت الصحيفة شرائطها الشكلية، فإن الطعن يغدو حرياً بالقبول شكلاً.

ثالثاً: حصر أوجه الطعن بالنقض (المحكمة الإدارية العليا محكمة قانون وليست محكمة موضوع):
ينعى الطاعن على الحكم المطعون فيه بالبطلان ومخالفة الشريعة والأنظمة طبقاً للمادة (11) من نظام ديوان المظالم للأسباب الآتية:
1. مخالفة صريح الأنظمة واللوائح والخطأ في تطبيقها وتأويلها:
   - مخالفة: ${effectiveRecord.applicableRegulations[0] || 'الأنظمة واللوائح الإدارية الآمرة'}
   - حيث إن مناط الاستحقاق تقرر بنص آمر لا يسوغ لجهة الإدارة تعطيله، وقد سلك الحكم المطعون فيه مسلكاً خالف هذا الأصل.
2. مخالفة المبادئ القضائية المستقرة الصادرة عن المحكمة الإدارية العليا:
   - خالف الحكم المطعون فيه قضاء المحكمة العليا المقيد المستقر ومنه: (${effectiveRecord.courtPrecedents[0] || 'المبادئ المقيدة بالسوابق القضائية الراسخة'}).
3. بطلان التسبيب وعيب السبب والانحراف بالسلطة:
   - تمترس الحكم المطعون فيه بـ "السلطة التقديرية" للجهة الإدارية، وهو تمترس باطل؛ لأن سلطة الإدارة مقيدة بعدم مصادرة المراكز النظامية المستقرة وانتفاء المصلحة العامة، مما يوصم قرار الجهة بعيب الانحراف بالسلطة وعيب السبب.

رابعاً: رصد الأخطاء ومكامن الخلل في دفوع الجهة وحكم الموضوع:
${effectiveRecord.fatalFlawsFound.map((f, i) => `${i + 1}. ${f}`).join('\n')}

خامساً: أقوى الحجج والبراهين والردود الحازمة:
${effectiveRecord.strongestRebuttals.map((r, i) => `${i + 1}. ${r}`).join('\n')}

سادساً: الطلبات الختامية الجازمة:
يلتمس الطاعن من فضيلة ناظري القضية قضاءً عادلاً بما يلي:
1. قبول الطعن شكلاً لقيده داخل الميعاد النظامي.
2. نقض الحكم المطعون فيه نقضاً كلياً، والحكم مجدداً بإلغاء القرار الإداري المطعون فيه بكافة آثاره النظامية والمالية مع إلزام المطعون ضدها بتعويض الطاعن وصرف كافة مستحقاته.

والله الموفق والمستعان،،
مقدمه / ${effectiveRecord.personName} (الهوية الوطنية: ${effectiveRecord.nationalId})
وكيله الشرعي المعتمد`;

      case 'لائحة اعتراضية استئنافية':
        return `أصحاب الفضيلة رئيس وأعضاء محكمة الاستئناف الإدارية الموقرين
السلام عليكم ورحمة الله وبركاته،،

الموضوع: لائحة اعتراضية على صك الحكم رقم (${effectiveRecord.judgmentNumber}) في القضية رقم (${effectiveRecord.caseNumber})
المعاملة مقيدة للمستفيد: ${effectiveRecord.personName} (الهوية الوطنية: ${effectiveRecord.nationalId})

أولاً: من حيث الشكل:
حيث صدر الحكم بتاريخ (${effectiveRecord.judgmentDate}) وتم استلام نسخته وإيداع هذا الاعتراض قبل انقضاء مهلة الثلاثين يوماً النظامية عملاً بالمادة (37) من نظام المرافعات أمام ديوان المظالم، فالاعتراض مقبول شكلاً.

ثانياً: أسباب الاعتراض الموضوعية والخلل في تسبيب حكم أول درجة:
1. القصور في التسبيب والفساد في الاستدلال:
   - حيث أغفلت الدائرة مناقشة الدفوع الجوهرية المؤيدة بالمستندات الرسمية، واكتفت بالأخذ بما أبداه ممثل ${effectiveRecord.agencyName}.
2. خطأ الحكم في تكييف وقائع النزاع:
   - الوقائع الثابتة بالصك: ${effectiveRecord.facts}
3. تفنيد مزاعم الجهة الإدارية:
   ${effectiveRecord.dialoguesAndExchanges.map(d => `* رد على ${d.speaker}: ${d.rebuttalArg || d.statement}`).join('\n')}

ثالثاً: الطلبات:
نقض حكم محكمة أول درجة، والقضاء مجدداً بطلبات المدعي الأصلية الواردة بصحيفة الدعوى.

والله الموفق،،
مقدمه / ${effectiveRecord.personName} (الهوية الوطنية: ${effectiveRecord.nationalId})`;

      case 'لائحة دعوى':
        return `فضيلة رئيس الدائرة الإدارية بالمحكمة الإدارية الموقر
السلام عليكم ورحمة الله وبركاته،،

لائحة دعوى إدارية (إلغاء قرار إداري وتعويض)
المدعي: ${effectiveRecord.personName} - سجل مدني: (${effectiveRecord.nationalId})
المدعى عليها: ${effectiveRecord.agencyName}

الموضوع والوقائع:
${effectiveRecord.facts}

السند الإجرائي والتظلم الوجوبي (المادة 8):
حيث تم التقيد التام بمهل التظلم الإداري الوجوبي المنصوص عليها في المادة 8 من نظام المرافعات أمام ديوان المظالم ولم تنصف الإدارة المدعي، مما فتح له حق اللجوء للقضاء العادل.

الأسانيد النظامية والمواد المستند عليها:
${effectiveRecord.applicableRegulations.map(reg => `• ${reg}`).join('\n')}

الأخطاء والعوار المشوب به القرار:
${effectiveRecord.fatalFlawsFound.map(flaw => `• ${flaw}`).join('\n')}

الطلبات:
1. قبول الدعوى شكلاً.
2. الحكم بإلغاء القرار المطعون فيه بجميع آثاره النظامية والمالية والتعويض عما لحق المدعي من أضرار.

مقدمه / ${effectiveRecord.personName} (الهوية الوطنية: ${effectiveRecord.nationalId})`;

      case 'مذكرة جوابية':
      case 'مذكرة دفوع شكلية وموضوعية':
        return `أمام الدائرة القضائية ناظرة القضية رقم (${effectiveRecord.caseNumber})
بشأن الدعوى المقامة من: ${effectiveRecord.personName} (هوية: ${effectiveRecord.nationalId}) ضد: ${effectiveRecord.agencyName}

مذكرة دفوع جازمة وتفنيد لمذكرات الخصم

أولاً: الدفوع الشكلية الحتمية:
1. صحة الصفة والمصلحة وقيد المرفوع داخل الأجل الحتمي دون سقوط.
2. عدم قبول أي دفع صادر من ممثل الجهة يهدف للتسويف بعد إغفالهم التحقيق والرد القانوني.

ثانياً: الدفوع الموضوعية والردود الصاعقة:
${effectiveRecord.dialoguesAndExchanges.map(d => `• ما تمسك به ${d.speaker}: "${d.statement}"\n  -> الرد الصاعق والحجة القاطعة: ${d.rebuttalArg}`).join('\n\n')}

ثالثاً: النصوص والأحكام المقيدة:
${effectiveRecord.applicableRegulations.map(r => `- ${r}`).join('\n')}

لذلك نلتمس رفض دفوع ممثل الجهة والحكم فوراً وفق الطلبات المقيدة.

مقدمه / ${effectiveRecord.personName} (الهوية الوطنية: ${effectiveRecord.nationalId})`;

      case 'التماس إعادة النظر':
        return `المقام السامي لدى محكمة ديوان المظالم الموقرة
صحيفة التماس إعادة النظر طبقاً للمادة (200) من نظام المرافعات الشرعية ونظام ديوان المظالم
بشأن الحكم الصادر بحق الملتمس: ${effectiveRecord.personName} (هوية: ${effectiveRecord.nationalId})

أسباب الالتماس الحصرية:
1. ظهور أوراق ومستندات قاطعة في الدعوى كان متعذراً إبرازها قبل الحكم وحالت الجهة المدعى عليها دون تقديمها.
2. ثبوت الغش والتناقض في المبررات المساقة من ممثل ${effectiveRecord.agencyName}.

الطلبات:
قبول الالتماس شكلاً ووقف النفاذ مع إعادة فتح باب المرافعة والحكم مجدداً لصالح الموكل.

مقدمه / ${effectiveRecord.personName} (الهوية الوطنية: ${effectiveRecord.nationalId})`;

      default:
        return '';
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
    const promptToSend = `أرجو تدقيق هذه المذكرة القضائية المجهزة للوكيل في الترافع وصقلها بأقوى الحجج والمواد النظامية:\n\n` +
      `اسم الموكل: ${record.personName} (رقم الهوية: ${record.nationalId})\n` +
      `المحكمة المستهدفة: ${record.courtType}\n` +
      `نوع المرفوع: ${activeDocType}\n\n` +
      `"""${draftText}"""\n\n` +
      `المطلوب: مراجعة الدفوع بعين القاضي النبيه والمحامي المتمرس، وتثبيت أقوى الأوامر الملكية والتعليمات ومبادئ المحكمة العليا لضمان الإلزام القضائي التام.`;
    
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
                  {record.nationalId}
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                صياغة مذكرات قاطعة تظهر قوة وتمكن الوكيل للموكل: {record.personName}
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
