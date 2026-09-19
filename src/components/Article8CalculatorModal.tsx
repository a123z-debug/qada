import { useState, useMemo } from 'react';
import { X, Calendar, Calculator, CheckCircle2, AlertTriangle, ArrowRight, Copy, Check } from 'lucide-react';

interface Article8CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertToPrompt: (text: string) => void;
}

export function Article8CalculatorModal({
  isOpen,
  onClose,
  onInsertToPrompt,
}: Article8CalculatorModalProps) {
  const [notificationDate, setNotificationDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 20);
    return d.toISOString().split('T')[0];
  });
  const [grievanceDate, setGrievanceDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 5);
    return d.toISOString().split('T')[0];
  });
  const [claimPath, setClaimPath] = useState<'cancellation' | 'service_rights' | 'unknown'>('unknown');
  const [hasExplicitResponse, setHasExplicitResponse] = useState<boolean>(false);
  const [explicitResponseDate, setExplicitResponseDate] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const calcResult = useMemo(() => {
    if (!notificationDate || claimPath === 'unknown') return null;

    const notif = new Date(notificationDate);
    let grievanceDateObj: Date | null = null;
    if (grievanceDate) grievanceDateObj = new Date(grievanceDate);

    const isCancellation = claimPath === 'cancellation';
    let grievanceDeadline: Date | null = null;
    let grievanceElapsed: number | null = null;
    let isGrievanceOnTime: boolean | null = null;

    if (isCancellation) {
      grievanceDeadline = new Date(notif);
      grievanceDeadline.setDate(grievanceDeadline.getDate() + 60);
      if (grievanceDateObj) {
        const diffTime = grievanceDateObj.getTime() - notif.getTime();
        grievanceElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        isGrievanceOnTime = grievanceElapsed <= 60 && grievanceElapsed >= 0;
      }
    }

    if (!grievanceDateObj) {
      return {
        claimPath,
        notificationDateStr: notificationDate,
        grievanceDeadlineStr: grievanceDeadline ? grievanceDeadline.toISOString().split('T')[0] : null,
        grievanceElapsed,
        isGrievanceOnTime,
        agencyDecisionDeadlineStr: null,
        courtDeadlineStr: null,
        triggerDescription: 'يلزم إدخال تاريخ تقديم التظلم قبل حساب مهلة بت الجهة وميعاد رفع الدعوى.',
        daysRemainingForCourt: null,
        isCourtWindowOpen: null,
      };
    }

    const agencyDecisionDeadline = new Date(grievanceDateObj);
    agencyDecisionDeadline.setDate(agencyDecisionDeadline.getDate() + 60);

    let courtDeadline = new Date(agencyDecisionDeadline);
    let triggerDescription = 'انقضاء مهلة بت الجهة دون رد';

    if (hasExplicitResponse && explicitResponseDate) {
      const explicitDateObj = new Date(explicitResponseDate);
      courtDeadline = new Date(explicitDateObj);
      courtDeadline.setDate(courtDeadline.getDate() + 60);
      triggerDescription = `تاريخ إبلاغ الرفض الصريح (${explicitResponseDate})`;
    } else {
      courtDeadline.setDate(courtDeadline.getDate() + 60);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysRemainingForCourt = Math.ceil(
      (courtDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      claimPath,
      notificationDateStr: notificationDate,
      grievanceDeadlineStr: grievanceDeadline ? grievanceDeadline.toISOString().split('T')[0] : null,
      grievanceElapsed,
      isGrievanceOnTime,
      agencyDecisionDeadlineStr: agencyDecisionDeadline.toISOString().split('T')[0],
      courtDeadlineStr: courtDeadline.toISOString().split('T')[0],
      triggerDescription,
      daysRemainingForCourt,
      isCourtWindowOpen: daysRemainingForCourt >= 0,
    };
  }, [notificationDate, grievanceDate, hasExplicitResponse, explicitResponseDate, claimPath]);

  if (!isOpen) return null;

  const generatedText = calcResult
    ? `بيانات فحص ميعاد مبدئي وفق المسار المختار في المادة (8) من نظام المرافعات أمام ديوان المظالم:
- نوع المسار: ${claimPath === 'cancellation' ? 'دعوى إلغاء قرار إداري' : 'دعوى حقوق وظيفية / خدمة مدنية أو عسكرية'}
- التاريخ المدخل كبداية للوقائع: ${calcResult.notificationDateStr}
${claimPath === 'cancellation' && calcResult.grievanceDeadlineStr ? `- آخر موعد مبدئي للتظلم بحسب مسار الإلغاء (60 يوماً): ${calcResult.grievanceDeadlineStr}` : '- لا تطبق الحاسبة مهلة 60 يوماً من تاريخ العلم على مسار الحقوق الوظيفية؛ يجب التحقق من تاريخ نشوء الحق والنص الرسمي النافذ.'}
- تاريخ تقديم التظلم الفعلي: ${grievanceDate || 'لم يقدم بعد'}
${calcResult.agencyDecisionDeadlineStr ? `- ميعاد انقضاء مهلة بت الجهة المحسوبة: ${calcResult.agencyDecisionDeadlineStr}` : '- لم يُحسب ميعاد بت الجهة لعدم إدخال تاريخ التظلم.'}
${calcResult.courtDeadlineStr ? `- الميعاد المبدئي المحسوب لرفع الدعوى بعد رد الجهة/انقضاء مهلة البت: ${calcResult.courtDeadlineStr}` : '- لم يُحسب ميعاد رفع الدعوى بعد.'}

تنبيه إلزامي: هذه حاسبة مساعدة وليست حكماً بقبول الدعوى أو سقوطها. يجب مطابقة نوع الدعوى والفقرة النظامية والنسخة النافذة من المادة (8) مع المصدر الرسمي قبل الاعتماد.`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    onInsertToPrompt(generatedText);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div
        id="article8-modal"
        className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-xl w-full text-neutral-100 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-100">
                حاسبة الميعاد النظامي للتظلم الوجوبي (المادة 8)
              </h2>
              <p className="text-xs text-neutral-400">
                فحص مساعد للمواعيد بحسب نوع الدعوى مع وجوب المطابقة بالمصدر الرسمي
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              id="back-article8-modal-btn"
              onClick={onClose}
              className="px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              title="رجوع"
            >
              <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
              <span>رجوع</span>
            </button>
            <button
              id="close-article8-modal"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-neutral-200 rounded-lg hover:bg-neutral-800 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Controls */}
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-2">
            <label className="block text-xs font-bold text-amber-200">اختر مسار الدعوى قبل الحساب</label>
            <select
              value={claimPath}
              onChange={(e) => setClaimPath(e.target.value as 'cancellation' | 'service_rights' | 'unknown')}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500"
            >
              <option value="unknown">حدد نوع الدعوى</option>
              <option value="cancellation">دعوى إلغاء قرار إداري</option>
              <option value="service_rights">دعوى حقوق وظيفية / خدمة مدنية أو عسكرية</option>
            </select>
            <p className="text-[11px] leading-relaxed text-neutral-400">
              تختلف المواعيد بحسب نوع الدعوى. لن تصدر الحاسبة حكماً بالسقوط أو القبول قبل اختيار المسار، ولن تطبق مهلة الإلغاء على دعاوى الحقوق الوظيفية.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Notification Date */}
            <div>
              <label
                htmlFor="notification-date-input"
                className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mb-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                تاريخ العلم بالقرار / إبلاغه
              </label>
              <input
                id="notification-date-input"
                type="date"
                value={notificationDate}
                onChange={(e) => setNotificationDate(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500 transition-colors"
              />
            </div>

            {/* Grievance Date */}
            <div>
              <label
                htmlFor="grievance-date-input"
                className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 mb-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                تاريخ تقديم التظلم للجهة
              </label>
              <input
                id="grievance-date-input"
                type="date"
                value={grievanceDate}
                onChange={(e) => setGrievanceDate(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          {/* Explicit response toggle */}
          <div className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-800 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                id="explicit-response-checkbox"
                type="checkbox"
                checked={hasExplicitResponse}
                onChange={(e) => setHasExplicitResponse(e.target.checked)}
                className="rounded-sm accent-amber-500 text-amber-500 bg-neutral-900 border-neutral-700"
              />
              <span className="text-xs font-medium text-neutral-300">
                صدر رد صريح بالرفض من الجهة الإدارية قبل فوات الـ (60) يوماً
              </span>
            </label>

            {hasExplicitResponse && (
              <div>
                <label
                  htmlFor="explicit-response-date-input"
                  className="text-xs text-neutral-400 block mb-1"
                >
                  تاريخ إبلاغ الرفض الصريح
                </label>
                <input
                  id="explicit-response-date-input"
                  type="date"
                  value={explicitResponseDate}
                  onChange={(e) => setExplicitResponseDate(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-amber-500 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Results Card */}
          {calcResult && (
            <div className="p-4 rounded-xl bg-gradient-to-br from-neutral-950 to-neutral-900 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">النتيجة الإجرائية المبدئية</span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                    calcResult.isCourtWindowOpen === true && (calcResult.isGrievanceOnTime !== false)
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {calcResult.isCourtWindowOpen === true && calcResult.isGrievanceOnTime !== false ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      الحساب المبدئي داخل المدة
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" />
                      يحتاج تحققاً من المسار والمصدر
                    </>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-300">
                <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800/80">
                  <span className="text-neutral-400 block text-[11px]">{claimPath === 'cancellation' ? 'آخر موعد مبدئي للتظلم في مسار الإلغاء:' : 'ميعاد التظلم في مسار الحقوق:'}</span>
                  <span className="font-semibold text-neutral-100">{calcResult.grievanceDeadlineStr || 'لا يُحسب هنا؛ يلزم التحقق من تاريخ نشوء الحق والنص الرسمي'}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800/80">
                  <span className="text-neutral-400 block text-[11px]">ميعاد رفع الدعوى المحسوب بعد التظلم:</span>
                  <span className="font-semibold text-neutral-100">{calcResult.courtDeadlineStr || 'أدخل تاريخ التظلم أولاً'}</span>
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 leading-relaxed border-t border-neutral-800/80 pt-2">
                {typeof calcResult.daysRemainingForCourt === 'number' ? (
                  calcResult.daysRemainingForCourt >= 0 ? (
                    <span>
                      المتبقي بحسب الحساب المبدئي <strong className="text-amber-400">{calcResult.daysRemainingForCourt} يوماً</strong>. يلزم مطابقة هذا الناتج بالمصدر الرسمي ونوع الدعوى قبل الاعتماد.
                    </span>
                  ) : (
                    <span className="text-amber-300 font-medium">
                      الحساب المبدئي تجاوز التاريخ المحسوب بمقدار {Math.abs(calcResult.daysRemainingForCourt)} يوماً، لكن الحاسبة لا تقرر سقوط الدعوى؛ يلزم فحص نوع الدعوى وتاريخ نشوء الحق وأي استثناءات أو أسباب توقف/انقطاع الميعاد من المصدر الرسمي.
                    </span>
                  )
                ) : (
                  <span>أدخل تاريخ التظلم لإكمال الحساب المبدئي.</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-950/80">
          <button
            id="copy-calculation-btn"
            onClick={handleCopy}
            className="px-3 py-2 text-xs font-medium text-neutral-300 hover:text-white rounded-xl bg-neutral-800 hover:bg-neutral-700 transition-colors flex items-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'تم النسخ' : 'نسخ التقرير'}</span>
          </button>

          <button
            id="insert-calculation-btn"
            onClick={handleInsert}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5"
          >
            <span>إدراج في الاستشارة القضائية</span>
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </button>
        </div>
      </div>
    </div>
  );
}
