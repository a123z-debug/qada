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
  const [grievancePeriodDays, setGrievancePeriodDays] = useState<string>('');
  const [agencyDecisionPeriodDays, setAgencyDecisionPeriodDays] = useState<string>('');
  const [courtFilingPeriodDays, setCourtFilingPeriodDays] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const calcResult = useMemo(() => {
    if (!notificationDate || claimPath === 'unknown') return null;

    const parseDays = (value: string) => {
      const n = Number(value);
      return Number.isInteger(n) && n > 0 && n <= 3650 ? n : null;
    };

    const notif = new Date(notificationDate);
    const grievanceDateObj = grievanceDate ? new Date(grievanceDate) : null;
    const grievanceDays = parseDays(grievancePeriodDays);
    const agencyDays = parseDays(agencyDecisionPeriodDays);
    const courtDays = parseDays(courtFilingPeriodDays);

    const grievanceDeadline =
      claimPath === 'cancellation' && grievanceDays
        ? new Date(notif)
        : null;
    if (grievanceDeadline && grievanceDays) {
      grievanceDeadline.setDate(grievanceDeadline.getDate() + grievanceDays);
    }

    let grievanceElapsed: number | null = null;
    let isGrievanceOnTime: boolean | null = null;
    if (grievanceDateObj) {
      grievanceElapsed = Math.floor(
        (grievanceDateObj.getTime() - notif.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (grievanceDeadline) {
        isGrievanceOnTime =
          grievanceDateObj.getTime() <= grievanceDeadline.getTime()
          && grievanceElapsed >= 0;
      }
    }

    let agencyDecisionDeadline: Date | null = null;
    if (grievanceDateObj && agencyDays) {
      agencyDecisionDeadline = new Date(grievanceDateObj);
      agencyDecisionDeadline.setDate(agencyDecisionDeadline.getDate() + agencyDays);
    }

    let courtDeadline: Date | null = null;
    let triggerDescription = 'لم يُحدد أساس حساب ميعاد رفع الدعوى بعد.';

    if (courtDays) {
      if (hasExplicitResponse && explicitResponseDate) {
        const explicitDateObj = new Date(explicitResponseDate);
        courtDeadline = new Date(explicitDateObj);
        courtDeadline.setDate(courtDeadline.getDate() + courtDays);
        triggerDescription = `تاريخ الرد الصريح المدخل (${explicitResponseDate})`;
      } else if (agencyDecisionDeadline) {
        courtDeadline = new Date(agencyDecisionDeadline);
        courtDeadline.setDate(courtDeadline.getDate() + courtDays);
        triggerDescription = 'انتهاء فترة بت الجهة المدخلة يدوياً';
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysRemainingForCourt = courtDeadline
      ? Math.ceil((courtDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      claimPath,
      notificationDateStr: notificationDate,
      grievanceDeadlineStr: grievanceDeadline ? grievanceDeadline.toISOString().split('T')[0] : null,
      grievanceElapsed,
      isGrievanceOnTime,
      agencyDecisionDeadlineStr: agencyDecisionDeadline ? agencyDecisionDeadline.toISOString().split('T')[0] : null,
      courtDeadlineStr: courtDeadline ? courtDeadline.toISOString().split('T')[0] : null,
      triggerDescription,
      daysRemainingForCourt,
      isCourtWindowOpen: typeof daysRemainingForCourt === 'number' ? daysRemainingForCourt >= 0 : null,
      grievanceDays,
      agencyDays,
      courtDays,
    };
  }, [
    notificationDate,
    grievanceDate,
    hasExplicitResponse,
    explicitResponseDate,
    claimPath,
    grievancePeriodDays,
    agencyDecisionPeriodDays,
    courtFilingPeriodDays,
  ]);

  if (!isOpen) return null;

  const generatedText = calcResult
    ? `بيانات حساب زمني مساعد لمسار مرافعة إدارية:
- نوع المسار المختار: ${claimPath === 'cancellation' ? 'دعوى إلغاء قرار إداري' : 'دعوى حقوق وظيفية / خدمة مدنية أو عسكرية'}
- تاريخ العلم/الإبلاغ المدخل: ${calcResult.notificationDateStr}
- فترة التظلم المدخلة يدوياً: ${calcResult.grievanceDays ? `${calcResult.grievanceDays} يوماً` : 'غير مدخلة'}
- تاريخ التظلم الفعلي: ${grievanceDate || 'غير مدخل'}
- فترة بت الجهة المدخلة يدوياً: ${calcResult.agencyDays ? `${calcResult.agencyDays} يوماً` : 'غير مدخلة'}
- فترة رفع الدعوى المدخلة يدوياً: ${calcResult.courtDays ? `${calcResult.courtDays} يوماً` : 'غير مدخلة'}
${calcResult.grievanceDeadlineStr ? `- التاريخ الحسابي الناتج لنهاية فترة التظلم: ${calcResult.grievanceDeadlineStr}` : ''}
${calcResult.agencyDecisionDeadlineStr ? `- التاريخ الحسابي الناتج لنهاية فترة بت الجهة: ${calcResult.agencyDecisionDeadlineStr}` : ''}
${calcResult.courtDeadlineStr ? `- التاريخ الحسابي الناتج لنهاية فترة رفع الدعوى: ${calcResult.courtDeadlineStr}` : ''}
- أساس بدء الحساب الأخير: ${calcResult.triggerDescription}

تنبيه إلزامي: الفترات أعلاه مدخلة يدوياً وليست مستخرجة تلقائياً من مادة نظامية. قبل الاعتماد يجب مطابقة نوع الدعوى والفقرة النظامية والنسخة النافذة مع المصدر الرسمي.`
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
                حاسبة المدد الإجرائية المساعدة
              </h2>
              <p className="text-xs text-neutral-400">
                حساب تاريخي فقط بعد إدخال الفترات التي تحققت منها في المصدر الرسمي
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
              لا تحتوي هذه الحاسبة على مدد نظامية ثابتة. أدخل عدد الأيام فقط بعد التحقق من النص الرسمي النافذ لنوع دعواك.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-cyan-200">فترة التظلم بالأيام</span>
              <input
                type="number"
                min="1"
                max="3650"
                value={grievancePeriodDays}
                onChange={(e) => setGrievancePeriodDays(e.target.value)}
                placeholder="بعد التحقق"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-cyan-400"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-cyan-200">فترة بت الجهة بالأيام</span>
              <input
                type="number"
                min="1"
                max="3650"
                value={agencyDecisionPeriodDays}
                onChange={(e) => setAgencyDecisionPeriodDays(e.target.value)}
                placeholder="بعد التحقق"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-cyan-400"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[11px] font-bold text-cyan-200">فترة رفع الدعوى بالأيام</span>
              <input
                type="number"
                min="1"
                max="3650"
                value={courtFilingPeriodDays}
                onChange={(e) => setCourtFilingPeriodDays(e.target.value)}
                placeholder="بعد التحقق"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-xl px-3 py-2 text-xs text-neutral-200 focus:outline-hidden focus:border-cyan-400"
              />
            </label>
            <p className="sm:col-span-3 text-[10px] leading-5 text-cyan-100/70">
              أدخل هذه الفترات فقط إذا راجعت المصدر الرسمي وحددت الفقرة المنطبقة على نوع الدعوى والمرحلة.
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
                صدر رد صريح من الجهة الإدارية
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
                  <span className="font-semibold text-neutral-100">{calcResult.grievanceDeadlineStr || 'أدخل فترة الأيام بعد التحقق من المصدر الرسمي'}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800/80">
                  <span className="text-neutral-400 block text-[11px]">التاريخ الحسابي لنهاية فترة رفع الدعوى:</span>
                  <span className="font-semibold text-neutral-100">{calcResult.courtDeadlineStr || 'أدخل الفترات اللازمة وتاريخ التظلم/الرد'}</span>
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
