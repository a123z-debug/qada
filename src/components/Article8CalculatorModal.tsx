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
  const [hasExplicitResponse, setHasExplicitResponse] = useState<boolean>(false);
  const [explicitResponseDate, setExplicitResponseDate] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const calcResult = useMemo(() => {
    if (!notificationDate) return null;

    const notif = new Date(notificationDate);
    
    // Grievance deadline: 60 days from notification
    const grievanceDeadline = new Date(notif);
    grievanceDeadline.setDate(grievanceDeadline.getDate() + 60);

    let grievanceDateObj: Date | null = null;
    let isGrievanceOnTime = true;
    let grievanceElapsed = 0;

    if (grievanceDate) {
      grievanceDateObj = new Date(grievanceDate);
      const diffTime = grievanceDateObj.getTime() - notif.getTime();
      grievanceElapsed = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      isGrievanceOnTime = grievanceElapsed <= 60 && grievanceElapsed >= 0;
    }

    // Agency 60-day response window (from grievance date)
    const baseGrievanceDate = grievanceDateObj || notif;
    const agencyDecisionDeadline = new Date(baseGrievanceDate);
    agencyDecisionDeadline.setDate(agencyDecisionDeadline.getDate() + 60);

    // Court filing deadline: 60 days from explicit response OR from expiry of agency 60-day window
    let courtDeadline = new Date(agencyDecisionDeadline);
    let triggerDescription = 'انقضاء مهلة الـ 60 يوماً دون رد (الرفض الحكمي/الضمني)';

    if (hasExplicitResponse && explicitResponseDate) {
      const explicitDateObj = new Date(explicitResponseDate);
      courtDeadline = new Date(explicitDateObj);
      courtDeadline.setDate(courtDeadline.getDate() + 60);
      triggerDescription = `تاريخ صدور قرار الرفض الصريح (${explicitResponseDate})`;
    } else {
      courtDeadline.setDate(courtDeadline.getDate() + 60);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysRemainingForCourt = Math.ceil(
      (courtDeadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    const isCourtWindowOpen = daysRemainingForCourt >= 0;

    return {
      notificationDateStr: notificationDate,
      grievanceDeadlineStr: grievanceDeadline.toISOString().split('T')[0],
      grievanceElapsed,
      isGrievanceOnTime,
      agencyDecisionDeadlineStr: agencyDecisionDeadline.toISOString().split('T')[0],
      courtDeadlineStr: courtDeadline.toISOString().split('T')[0],
      triggerDescription,
      daysRemainingForCourt,
      isCourtWindowOpen,
    };
  }, [notificationDate, grievanceDate, hasExplicitResponse, explicitResponseDate]);

  if (!isOpen) return null;

  const generatedText = calcResult
    ? `بيانات فحص الميعاد النظامي (المادة 8 من نظام المرافعات أمام ديوان المظالم):
- تاريخ العلم بالقرار أو إبلاغه: ${calcResult.notificationDateStr}
- أقصى ميعاد لتقديم التظلم للجهة (60 يوماً): ${calcResult.grievanceDeadlineStr}
- تاريخ تقديم التظلم الفعلي: ${grievanceDate || 'لم يقدم بعد'} (${calcResult.isGrievanceOnTime ? 'داخل الميعاد' : 'خارج الميعاد النظامي'})
- ميعاد انقضاء مهلة بت الجهة (60 يوماً): ${calcResult.agencyDecisionDeadlineStr}
- ميعاد سقوط الحق في رفع الدعوى أمام ديوان المظالم: ${calcResult.courtDeadlineStr}
- المتبقي لإقامة الدعوى أمام المحكمة الإدارية: ${calcResult.daysRemainingForCourt} يوماً (${calcResult.isCourtWindowOpen ? 'الدعوى مقبولة شكلاً من حيث الميعاد' : 'سقط الميعاد شكلاً'})

المطلوب: تدقيق هذه المواعيد وبيان الدفوع الشكلية المقررة والمذكرات الاحترازية.`
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
                نظام المرافعات أمام ديوان المظالم - مدد الـ (60) يوماً
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
                    calcResult.isGrievanceOnTime && calcResult.isCourtWindowOpen
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  {calcResult.isGrievanceOnTime && calcResult.isCourtWindowOpen ? (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      الميعاد قائم (مقبول شكلاً)
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="w-3 h-3" />
                      خطر السقوط الشكلي
                    </>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-neutral-300">
                <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800/80">
                  <span className="text-neutral-400 block text-[11px]">آخر موعد للتظلم أمام الجهة:</span>
                  <span className="font-semibold text-neutral-100">{calcResult.grievanceDeadlineStr}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-neutral-900/80 border border-neutral-800/80">
                  <span className="text-neutral-400 block text-[11px]">آخر ميعاد لإقامة الدعوى بالديوان:</span>
                  <span className="font-semibold text-neutral-100">{calcResult.courtDeadlineStr}</span>
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 leading-relaxed border-t border-neutral-800/80 pt-2">
                {calcResult.daysRemainingForCourt >= 0 ? (
                  <span>
                    متبقي <strong className="text-amber-400">{calcResult.daysRemainingForCourt} يوماً</strong>{' '}
                    لقيد لائحة الدعوى بنظام (معين / ديوان المظالم) قبل فوات الميعاد النظامي الحتمي.
                  </span>
                ) : (
                  <span className="text-rose-400 font-medium">
                    تجاوزت المهلة النظامية بمقدار {Math.abs(calcResult.daysRemainingForCourt)} يوماً. يجب فحص ما إذا كان هناك عذر مانع أو تظلم ولائي مجدد أو انعدام في القرار يسقط سريان الميعاد.
                  </span>
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
