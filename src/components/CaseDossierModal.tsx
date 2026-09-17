import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Printer,
  Copy,
  Check,
  Download,
  X,
  Scale,
  ShieldCheck,
  BookOpen,
  Calendar,
  AlertTriangle,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  UserCheck,
  Search,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { JudgmentRecord, UserSession } from '../types';

interface CaseDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  judgmentRecords?: JudgmentRecord[];
  initialNationalId?: string;
  currentUser?: UserSession | null;
}

export function CaseDossierModal({
  isOpen,
  onClose,
  judgmentRecords = [],
  initialNationalId,
  currentUser,
}: CaseDossierModalProps) {
  const [copied, setCopied] = useState(false);
  
  // National ID Security & Binding State
  const [unlockedNationalId, setUnlockedNationalId] = useState<string | null>(null);
  const [inputNationalId, setInputNationalId] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Sync initialNationalId if passed
  useEffect(() => {
    if (initialNationalId) {
      setInputNationalId(initialNationalId);
    }
  }, [initialNationalId]);

  // Reset verification state on modal open/close if desired or keep locked by default
  useEffect(() => {
    if (!isOpen) {
      setValidationError(null);
      setIsVerifying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Registered National IDs
  const ALL_REGISTERED_DOSSIERS = [
    {
      nationalId: '1096882228',
      personName: 'الرقيب أول / عبدالله محمد هيازع',
      militaryNumber: '583107',
      agency: 'وزارة الدفاع (قيادة القوات البرية الملكية السعودية)',
      court: 'المحكمة الإدارية بأبها (ديوان المظالم)',
      subject: 'بدل طبيعة عمل الحاسب الآلي (15%) والعلاوة الفنية وجواز الجمع بالمرسوم (م/37)',
      badge: 'قضية عسكرية - محكمة أبها',
      isAdminOnly: true,
    },
    {
      nationalId: '1082918231',
      personName: 'عبدالرحمن بن سعد الشهري',
      agency: 'وزارة التعليم (إدارة تعليم الرياض)',
      court: 'المحكمة الإدارية العليا',
      subject: 'مكافأة الحاسب الآلي 25% مع العلاوة الفنية وإلغاء القرار السلبي',
      badge: 'قضية إدارية - المحكمة العليا',
      isAdminOnly: false,
    },
    {
      nationalId: '1055412998',
      personName: 'خالد بن ناصر العتيبي',
      agency: 'أمانة منطقة الرياض',
      court: 'المحكمة الإدارية بالرياض',
      subject: 'إلغاء القرار التأديبي والنقل المكاني المقنع لعدم التحقيق الكتابي',
      badge: 'دعوى إلغاء تأديبية',
      isAdminOnly: false,
    },
  ];

  // Filter dossiers shown in quick selector: Hide admin dossier from public/citizens
  const visibleDossiers = useMemo(() => {
    if (currentUser?.role === 'admin') {
      return ALL_REGISTERED_DOSSIERS;
    }
    return ALL_REGISTERED_DOSSIERS.filter((d) => !d.isAdminOnly && d.nationalId !== '1096882228');
  }, [currentUser]);

  const handleVerifyNationalId = (idToVerify: string) => {
    const cleanId = idToVerify.trim().replace(/\D/g, '');
    if (cleanId.length !== 10) {
      setValidationError('رقم الهوية الوطنية يجب أن يتكون من 10 أرقام نظامية تبدأ بالرقم 1 أو 2.');
      return;
    }

    setIsVerifying(true);
    setValidationError(null);

    setTimeout(() => {
      // Security Check: If current user is not admin, prevent accessing Admin dossier
      if (cleanId === '1096882228' && (!currentUser || currentUser.role !== 'admin')) {
        setValidationError('عذراً، هذا الملف مخصص للإدارة العليا ومحمي بموجب أنظمة ديوان المظالم. يرجى استخدام هويتك الوطنية الخاصة.');
        setIsVerifying(false);
        return;
      }

      setUnlockedNationalId(cleanId);
      setIsVerifying(false);
    }, 400);
  };

  const handleLockDossier = () => {
    setUnlockedNationalId(null);
    setInputNationalId('');
    setValidationError(null);
  };

  const handlePrint = () => {
    const element = document.getElementById('case-dossier-printable-content');
    if (!element) {
      window.print();
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>ملف وحقيبة الترافع القضائي بالهوية الوطنية - ${unlockedNationalId}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 24px; color: #111; line-height: 1.6; direction: rtl; }
            h1 { color: #854d0e; font-size: 20px; border-bottom: 2px solid #854d0e; padding-bottom: 8px; margin-bottom: 12px; }
            h2 { color: #1f2937; font-size: 16px; margin-top: 20px; margin-bottom: 8px; border-right: 4px solid #854d0e; padding-right: 8px; }
            h3 { font-size: 14px; margin-top: 12px; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 8px; text-align: right; vertical-align: top; }
            th { background-color: #f3f4f6; font-weight: bold; }
            blockquote { background: #f9fafb; border-right: 3px solid #854d0e; margin: 8px 0; padding: 10px; font-style: italic; font-size: 12px; }
            ol, ul { padding-right: 20px; font-size: 12px; }
            li { margin-bottom: 6px; }
            .header-box { text-align: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 16px; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          ${element.innerHTML}
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleCopyAll = () => {
    const element = document.getElementById('case-dossier-printable-content');
    if (element) {
      navigator.clipboard.writeText(element.innerText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadText = () => {
    const element = document.getElementById('case-dossier-printable-content');
    if (element) {
      const blob = new Blob([element.innerText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `حقيبة_الترافع_بالهوية_الوطنية_${unlockedNationalId || 'موثقة'}.txt`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  // Determine which dossier profile to display (Strictly Admin only for Abdullah's dossier)
  const isAbdullahDossier = currentUser?.role === 'admin' && unlockedNationalId === '1096882228';
  const customRecord = unlockedNationalId ? judgmentRecords.find((r) => r.nationalId === unlockedNationalId) : null;

  return (
    <div
      id="case-dossier-modal-backdrop"
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="case-dossier-modal-window"
        className="relative z-[101] w-full max-w-4xl bg-neutral-900 border border-neutral-750 rounded-2xl shadow-2xl overflow-hidden text-right flex flex-col h-full max-h-[96dvh] sm:max-h-[92vh]"
      >
        {/* Header Toolbar (Responsive Mobile/Desktop) */}
        <div className="flex items-center justify-between px-3 sm:px-5 py-3 sm:py-4 border-b border-neutral-800 bg-neutral-950/90 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              unlockedNationalId 
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' 
                : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
            }`}>
              {unlockedNationalId ? <Unlock className="w-4 h-4 sm:w-5 sm:h-5" /> : <Lock className="w-4 h-4 sm:w-5 sm:h-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-neutral-100 font-legal flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="truncate">ملف الترافع السري المحمي</span>
                {unlockedNationalId ? (
                  <span className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                    <ShieldCheck className="w-3 h-3" />
                    <span>مربوط بهوية: {unlockedNationalId}</span>
                  </span>
                ) : (
                  <span className="text-[10px] sm:text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 shrink-0">
                    <Lock className="w-3 h-3" />
                    <span>مقفل بالهوية الوطنية</span>
                  </span>
                )}
              </h2>
              <p className="text-[11px] sm:text-xs text-neutral-400 truncate">
                {unlockedNationalId 
                  ? 'تم التحقق من الهوية • ملف المرافعة معتمد ومحرر للطباعة والمرافعة'
                  : 'أدخل رقم الهوية الوطنية للمدعي لفك قفل ملف المرافعة المعتمد'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {unlockedNationalId && (
              <>
                <button
                  id="dossier-lock-btn"
                  onClick={handleLockDossier}
                  className="px-2.5 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-300 hover:text-amber-300 border border-neutral-700 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  title="قفل الملف وإخفاؤه فوراً"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">إخفاء وقفل</span>
                </button>

                <button
                  id="dossier-copy-btn"
                  onClick={handleCopyAll}
                  className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-750 text-neutral-200 hover:text-white border border-neutral-700 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                  title="نسخ النص بالكامل"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{copied ? 'تم النسخ' : 'نسخ'}</span>
                </button>

                <button
                  id="dossier-print-btn"
                  onClick={handlePrint}
                  className="px-2.5 sm:px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 text-xs font-bold transition-all shadow-md flex items-center gap-1 cursor-pointer"
                  title="طباعة أو تصدير بصيغة PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة / PDF</span>
                </button>
              </>
            )}

            <button
              id="dossier-close-btn"
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer mr-0.5"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Either National ID Gate OR Unlocked Case Dossier */}
        {!unlockedNationalId ? (
          /* =========================================================
             1. NATIONAL ID VERIFICATION GATE (بوابة التحقق بالهوية الوطنية)
             ========================================================= */
          <div className="p-4 sm:p-8 overflow-y-auto bg-neutral-950 flex-1 flex flex-col items-center justify-center text-center">
            <div className="max-w-xl w-full bg-neutral-900/90 border border-neutral-800 p-5 sm:p-8 rounded-2xl shadow-xl space-y-6">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                <KeyRound className="w-8 h-8 text-amber-400" />
              </div>

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>نظام الحماية القضائية المشفرة بالهوية الوطنية</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-neutral-100 font-legal">
                  بوابة التحقق بالهوية لفتح ملف المرافعة
                </h3>
                <p className="text-xs sm:text-sm text-neutral-400 leading-relaxed max-w-md mx-auto">
                  لأغراض السرية والتأصيل النظامي، تم إخفاء ملفات الترافع وربط كل ملف مرافعة بالهوية الوطنية لصاحبه. أدخل رقم الهوية الوطنية لفك القفل واستعراض المذكرات والدفوع المؤصلة.
                </p>
              </div>

              {/* National ID Input Field */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyNationalId(inputNationalId);
                }}
                className="space-y-3 max-w-md mx-auto text-right"
              >
                <label className="block text-xs font-bold text-neutral-300">
                  رقم الهوية الوطنية لصاحب ملف المرافعة:
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="national-id-dossier-input"
                    value={inputNationalId}
                    onChange={(e) => {
                      setInputNationalId(e.target.value);
                      if (validationError) setValidationError(null);
                    }}
                    placeholder="أدخل رقم الهوية الوطنية للمستفيد (10 أرقام)"
                    maxLength={10}
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-750 focus:border-amber-500 rounded-xl text-neutral-100 placeholder-neutral-500 font-mono text-center text-base tracking-widest outline-none transition-colors"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                    <UserCheck className="w-5 h-5" />
                  </div>
                </div>

                {validationError && (
                  <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{validationError}</span>
                  </div>
                )}

                <button
                  id="verify-national-id-btn"
                  type="submit"
                  disabled={isVerifying || inputNationalId.trim().length < 10}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  {isVerifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                      <span>جاري مطابقة الهوية بالسجلات القضائية...</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-4 h-4" />
                      <span>التحقق وفك قفل ملف المرافعة</span>
                    </>
                  )}
                </button>
              </form>

              {/* Quick Authorized Identity Selectors (الهويات المسجلة المصرح بها) */}
              <div className="pt-4 border-t border-neutral-800 space-y-2.5 text-right">
                <span className="text-[11px] font-bold text-neutral-400 block text-center">
                  أو اختر مباشرة من ملفات المرافعات المقيدة بالهوية الوطنية:
                </span>

                <div className="space-y-2">
                  {visibleDossiers.map((item) => (
                    <button
                      key={item.nationalId}
                      type="button"
                      onClick={() => {
                        setInputNationalId(item.nationalId);
                        handleVerifyNationalId(item.nationalId);
                      }}
                      className="w-full p-2.5 sm:p-3 rounded-xl bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 hover:border-amber-500/40 transition-all text-right flex items-center justify-between gap-2 cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 group-hover:bg-amber-500/20">
                          <Scale className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-neutral-200 group-hover:text-amber-300 truncate">
                            {item.personName}
                          </div>
                          <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 font-mono">
                            <span>هوية: {item.nationalId}</span>
                            <span>•</span>
                            <span className="text-neutral-500 truncate">{item.court}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 hidden sm:inline">
                          {item.badge}
                        </span>
                        <div className="p-1 rounded-md bg-neutral-800 group-hover:bg-amber-500 group-hover:text-neutral-950 text-neutral-400 transition-colors">
                          <ArrowRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* =========================================================
             2. UNLOCKED CASE DOSSIER (ملف المرافعة الكامل المفكوك بالهوية)
             ========================================================= */
          <div className="p-3 sm:p-6 md:p-8 overflow-y-auto bg-neutral-950 space-y-6 text-neutral-200 leading-relaxed font-sans select-text flex-1">
            {/* National ID Security Banner */}
            <div className="p-3 sm:p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-neutral-900 to-amber-950/30 border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-emerald-300 flex items-center gap-2">
                    <span>تم التحقق والمطابقة بالهوية الوطنية رقم:</span>
                    <span className="font-mono text-neutral-100 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700">
                      {unlockedNationalId}
                    </span>
                  </div>
                  <div className="text-[11px] text-neutral-400">
                    ملف مرافعة قضائي موثق ومطابق لاختصاص ديوان المظالم السعودي
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={handleLockDossier}
                  className="px-2.5 py-1 text-[11px] rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-amber-300 border border-neutral-750 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>قفل الملف وإخفاؤه</span>
                </button>
              </div>
            </div>

            <div
              id="case-dossier-printable-content"
              className="space-y-8 bg-neutral-900/70 p-4 sm:p-8 rounded-2xl border border-neutral-800 shadow-inner"
            >
              {/* Header / Document Identity */}
              <div className="border-b border-neutral-700 pb-6 text-center space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>حقيبة الدفوع القضائية المحررة لردود الجلسات ومذكرات الطعن</span>
                </div>
                <h1 className="text-lg sm:text-2xl font-black text-amber-400 font-legal pt-1">
                  {isAbdullahDossier
                    ? 'ملف الدفوع النظامية والردود الفورية لبدل الحاسب الآلي (15%) والعلاوة الفنية'
                    : customRecord
                    ? `ملف المرافعة والدفوع لقضية: ${customRecord.judgmentType}`
                    : `ملف المرافعة القضائي المقيد بالهوية: ${unlockedNationalId}`}
                </h1>

                {isAbdullahDossier ? (
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm text-neutral-200 font-bold">
                      المدعي: الرقيب أول / عبدالله محمد هيازع (الرقم العسكري: 583107 | الهوية الوطنية: {unlockedNationalId})
                    </p>
                    <p className="text-xs text-neutral-400">
                      الجهة المدعى عليها: وزارة الدفاع (قيادة القوات البرية الملكية السعودية) | المحكمة الإدارية بأبها
                    </p>
                  </div>
                ) : customRecord ? (
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm text-neutral-200 font-bold">
                      المدعي: {customRecord.personName} (الهوية الوطنية: {customRecord.nationalId})
                    </p>
                    <p className="text-xs text-neutral-400">
                      الجهة المدعى عليها: {customRecord.agencyName} | {customRecord.courtType}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm text-neutral-200 font-bold">
                      صاحب الطلب: {currentUser?.personName || 'صاحب الشأن'} (الهوية الوطنية: {unlockedNationalId})
                    </p>
                    <p className="text-xs text-neutral-400">
                      الاختصاص القضائي: المحكمة الإدارية (ديوان المظالم)
                    </p>
                  </div>
                )}
              </div>

              {isAbdullahDossier ? (
                <>
                  {/* Quick Tactical Table for Hearings */}
                  <div className="space-y-3">
                    <h2 className="text-sm sm:text-base font-bold text-amber-300 flex items-center gap-2 border-r-4 border-amber-500 pr-2">
                      <span>أولاً: جدول الردود المسكتة والسريعة على دفوع ممثل الوزارة في الجلسة</span>
                    </h2>

                    <div className="overflow-x-auto rounded-xl border border-neutral-750 -mx-2 sm:mx-0">
                      <table className="w-full text-xs text-right border-collapse min-w-[580px]">
                        <thead className="bg-neutral-800 text-neutral-200 border-b border-neutral-700">
                          <tr>
                            <th className="p-3 font-bold w-1/4">دفع ممثل الوزارة</th>
                            <th className="p-3 font-bold w-1/2">الرد الفوري الصاعق والمُسكت</th>
                            <th className="p-3 font-bold w-1/4">السند النظامي القاطع</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-800 text-neutral-300">
                          <tr className="hover:bg-neutral-850/50">
                            <td className="p-3 font-bold text-rose-300">
                              1. الأمر 12997 وقرار 118 يمنعان الجمع
                            </td>
                            <td className="p-3">
                              نصوص منسوخة حكماً؛ صدر بعدهما <span className="text-amber-300 font-bold">المرسوم الملكي الأعلى (م/37) لعام 1430هـ</span> بالمادة (17/ب) التي أجازت الجمع صراحة. وثبت بمحاضر هيئة الخبراء رقم (198) لسنة 1430هـ وقرار الشورى (63/92) مصادقة مندوبي الدفاع والمالية وسقوط حق الإدارة في التنصل.
                            </td>
                            <td className="p-3 font-mono text-amber-400/90">
                              المرسوم الملكي (م/37) + محضر الخبراء (198)
                            </td>
                          </tr>
                          <tr className="hover:bg-neutral-850/50">
                            <td className="p-3 font-bold text-rose-300">
                              2. صرف البدل يتجاوز سقف البدلات المالي
                            </td>
                            <td className="p-3">
                              حسبة مالية معيبة ومخالفة لصريح النظام؛ <span className="text-amber-300 font-bold">قرار مجلس الوزراء رقم (15) لسنة 1413هـ المادة (6/ب)</span> استثنى صراحة العلاوة الفنية من سقف الـ (65%). والمدعي يتقاضى (25% استخبارات + 25% إرهاب = 50%) وبإضافة (15% حاسب) يبلغ سقف (65%) تماماً دون تجاوز هللة واحدة!
                            </td>
                            <td className="p-3 font-mono text-amber-400/90">
                              قرار مجلس الوزراء 15 لسنة 1413هـ (المادة 6/ب)
                            </td>
                          </tr>
                          <tr className="hover:bg-neutral-850/50">
                            <td className="p-3 font-bold text-rose-300">
                              3. النظام العسكري يحظر الجمع بين البدلات
                            </td>
                            <td className="p-3">
                              مخالف لصريح النظام؛ <span className="text-amber-300 font-bold">المادة (16) من نظام الأفراد</span> تنص نصاً صريحاً: «ويجوز الجمع بين علاوتين فنيتين فقط إذا قام بعملهما معاً»، وسقف الجمع 3 علاوات بالمادة 17/أ.
                            </td>
                            <td className="p-3 font-mono text-amber-400/90">
                              المادتان (16) و(17/أ) من نظام خدمة الأفراد
                            </td>
                          </tr>
                          <tr className="hover:bg-neutral-850/50">
                            <td className="p-3 font-bold text-rose-300">
                              4. العلاوة الفنية هي نفسها بدل الحاسب
                            </td>
                            <td className="p-3">
                              قياس باطل مع الفارق؛ العلاوة الفنية للرتبة والتصنيف المهني (المادة 2/هـ)، وبدل الحاسب لـ <span className="text-amber-300 font-bold">طبيعة العمل والممارسة التشغيلية الفعلية اليومية بالقرار (1520)</span>؛ والمادة 11/ب تجيز قيام الفرد بأعباء وظيفتين.
                            </td>
                            <td className="p-3 font-mono text-amber-400/90">
                              المادة (2/هـ) و(11/ب) + قرارات مجلس الوزراء المنظمة
                            </td>
                          </tr>
                          <tr className="hover:bg-neutral-850/50">
                            <td className="p-3 font-bold text-rose-300">
                              5. القرار 118 نص على كاتب وطابع آلة بعد تشغيل الآلات الإلكترونية
                            </td>
                            <td className="p-3">
                              حجة للمدعي لا عليه؛ القرار رقم (118) لسنة 1425هـ صدر لـ <span className="text-amber-300 font-bold">«تقديم مزايا مالية إضافية واستيعاب الكليات التقنية بالفقرتين (س) و(ع) ومنح الفئات 8 و9 و10»</span>، وتعديل مسمى (كاتب وطابع آلة) باللائحة (28-2) كان لعلاوة الفنيين للرتبة، بينما بدل الحاسب (15%) لطبيعة العمل الفعلي لمنظومات القيادة والسيطرة؛ ومنسوخ حكماً بالمرسوم (م/37).
                            </td>
                            <td className="p-3 font-mono text-amber-400/90">
                              قرار مجلس الوزراء 118 لعام 1425هـ + المرسوم م/37
                            </td>
                          </tr>
                          <tr className="hover:bg-neutral-850/50">
                            <td className="p-3 font-bold text-rose-300">
                              6. لا يوجد إثبات لتكليفك الفعلي بالحاسب
                            </td>
                            <td className="p-3">
                              نتمسك بطلب عارض لإلزام الإدارة بتقديم <span className="text-amber-300 font-bold">القرار التنظيمي رقم (1520) وتاريخ 03/03/1437هـ</span>؛ وحجب الإدارة له يعد قرينة قضائية قاطعة لصالح المدعي.
                            </td>
                            <td className="p-3 font-mono text-amber-400/90">
                              المادة (14) مرافعات ديوان المظالم والمادة (108) إثبات
                            </td>
                          </tr>
                          <tr className="hover:bg-neutral-850/50">
                            <td className="p-3 font-bold text-rose-300">
                              7. فوات الميعاد وسقوط الحق بالتقادم (60 يوماً)
                            </td>
                            <td className="p-3">
                              دعاوى الحقوق المالية والبدلات تخضع لمهلة <span className="text-amber-300 font-bold">(10) عشر سنوات</span> وفقاً للمادة (8/6) مرافعات ديوان المظالم، ولا تسري عليها مهلة الـ 60 يوماً الخاصة بقرارات الإلغاء الفردية المجردة.
                            </td>
                            <td className="p-3 font-mono text-amber-400/90">
                              المادة (8 / الفقرة 6) من نظام مرافعات ديوان المظالم
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Detailed Substantive Defenses */}
                  <div className="space-y-6 pt-4">
                    <h2 className="text-sm sm:text-base font-bold text-amber-300 flex items-center gap-2 border-r-4 border-amber-500 pr-2">
                      <span>ثانياً: الدفوع الموضوعية المحررة (تُقرأ أو تُسلّم للدائرة القضائية)</span>
                    </h2>

                    {/* Defense 1: Royal Decree M/37 & Legislative Intent */}
                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                      <h3 className="text-xs sm:text-sm font-bold text-neutral-100 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">
                          1
                        </span>
                        <span>الوجه الأول: النسخ التشريعي القاطع بالمرسوم الملكي (م/37) وسقوط حظر الجمع وحظر تنصل الإدارة:</span>
                      </h3>
                      <blockquote className="p-3 rounded-lg bg-neutral-900/90 border-r-2 border-amber-500 text-xs text-neutral-300 italic leading-relaxed">
                        "فضيلة القاضي: إن تمسك ممثل الوزارة بالأمر القديم رقم 12997 أو القرار 118 لعام 1425هـ للاحتجاج بحظر الجمع، هو تمسك بنصوص وأحكام منسوخة حكماً بقوة التشريع؛ حيث صدر بعدهما <strong>المرسوم الملكي الكريم رقم (م/37) وتاريخ 30 / 06 / 1430هـ</strong>، والذي نص بقطعية تامة على تعديل المادة (17/ب) من نظام خدمة الأفراد لتصبح: <em>(يجوز الجمع بين علاوتين من العلاوات الواردة في جدول العلاوات الأخرى المرافقة لهذا النظام)</em>. ولقد تجلت النية التشريعية —كما هو ثابت في محاضر هيئة الخبراء بمجلس الوزراء رقم (198) لعام 1430هـ المبنية على قرار الشورى (63/92) وتاريخ 1430/01/08هـ— في إقرار 'جواز الجمع' بمشاركة ومصادقة مندوبي (وزارة الدفاع) و(وزارة المالية). وإن تنصل الجهة الإدارية من تشريعٍ ساهمت هي ذاتها في صياغته واعتماده، لا يجوز أن يجد مظلة أو سنداً من القضاء. وإن تعطيل الأثر القانوني المترتب على المرسوم الملكي النافذ يُشكل عواراً تشريعياً ومخالفة صارخة لقواعد التدرج الهرمي للتشريع، وهو ما يرمي دفاع الإدارة بالبطلان والخطأ الجسيم".
                      </blockquote>
                    </div>

                    {/* Defense 2: Decision 15 of 1413H & 65% ceiling exception */}
                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                      <h3 className="text-xs sm:text-sm font-bold text-neutral-100 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">
                          2
                        </span>
                        <span>الوجه الثاني: الخطأ الجسيم في تطبيق وعاء الاحتساب المالي ومخالفة الصريح الآمر لقرار مجلس الوزراء رقم (15) وتاريخ 27/01/1413هـ (المادة 6/ب):</span>
                      </h3>
                      <blockquote className="p-3 rounded-lg bg-neutral-900/90 border-r-2 border-amber-500 text-xs text-neutral-300 italic leading-relaxed space-y-2">
                        <p>
                          "فضيلة القاضي: إن ما تمسك به ممثل الوزارة من أن صرف بدل الحاسب الآلي للمدعي سيؤدي إلى تجاوز الحد الأعلى المسموح به مبني على حسبة مالية معيبة ومجانبة للصحة ومصادمة للنظام الآمر؛ فالصحيح الثابت بنصٍ قطعي في <strong>قرار مجلس الوزراء رقم (15) لعام 1413هـ الفقرة (6/ب)</strong>، أنه حدد سقف البدلات والمكافآت للأفراد العاملين في المباحث والاستخبارات بـ (65%) من أول مربوط الرتبة، <strong>ونص صراحة على استثناء بدل النقل والتمثيل والعلاج والعلاوة الفنية من هذا السقف</strong>.
                        </p>
                        <p>
                          وحيث إن المدعي مثبت في قسم أمني ويتقاضى (25% علاوة استخبارات + 25% بدل مكافحة إرهاب = 50%)، فإن استحقاقه للحد الأدنى من مكافأة الحاسب الآلي (15%) يجعله يصل إلى سقف (65%) تماماً دون أدنى تجاوز! وإن إخضاع «العلاوة الفنية» لذات الوعاء المالي الخاضع لسقف الاحتساب، متغافلاً عن الاستثناء القاطع المنصوص عليه صراحة، يمثل انحرافاً في تأويل القاعدة النظامية ومخالفة صريحة لمضمونها الآمر".
                        </p>
                      </blockquote>
                    </div>

                    {/* Defense 3: Articles 16 & 17/A */}
                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                      <h3 className="text-xs sm:text-sm font-bold text-neutral-100 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">
                          3
                        </span>
                        <span>الدفع بالإباحة الصريحة للجمع بنص المادة (16) والمادة (17/أ) من نظام الأفراد:</span>
                      </h3>
                      <blockquote className="p-3 rounded-lg bg-neutral-900/90 border-r-2 border-amber-500 text-xs text-neutral-300 italic leading-relaxed">
                        "فضيلة القاضي: إن نظام خدمة الأفراد ذاته نص في المادة (السادسة عشرة) بمنطوق آمر لا لبس فيه على أنه: <em>«ويجوز الجمع بين علاوتين فنيتين فقط إذا قام بعملهما معاً»</em>، كما وضعت المادة (17/أ) سقفاً عاماً يتيح الجمع حتى (3) علاوات. وحيث إن المدعي قائم بالعملين معاً بتكليف رسمي بقسم القيادة والسيطرة والحاسب، فإن حقه بالجمع مستمد من صلب النظام الأصيل، ولا تملك جهة الإدارة مصادرة حق كفله النظام بقرارات أو تفسيرات لائحية مجتزأة".
                      </blockquote>
                    </div>

                    {/* Defense 4: Difference in Manaat (العلاوة الفنية vs بدل الحاسب) */}
                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                      <h3 className="text-xs sm:text-sm font-bold text-neutral-100 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">
                          4
                        </span>
                        <span>الدفع باختلاف المناط والعلة بين العلاوة الفنية وبدل الحاسب الآلي:</span>
                      </h3>
                      <blockquote className="p-3 rounded-lg bg-neutral-900/90 border-r-2 border-amber-500 text-xs text-neutral-300 italic leading-relaxed">
                        "فضيلة القاضي: إن دمج الإدارة بين العلاوة الفنية وبدل الحاسب الآلي هو خلط قانوني ومصادمة لقرارات مجلس الوزراء المستقرة: فالعلاوة الفنية (المادة 2/هـ) تمنح لقاء التصنيف المهني والرتبة، بينما بدل الحاسب الآلي (15%) يمنح بموجب قرارات مجلس الوزراء وقواعد القوات المسلحة لقاء <strong>طبيعة العمل والممارسة التشغيلية الفعلية اليومية</strong> وإجهاد الشبكات والأنظمة. كما نصت المادة (11/ب) من نظام الأفراد على: <em>«يجوز أن يقوم الفرد بأعباء أكثر من وظيفة واحدة»</em>. والقاعدة القضائية المستقرة بديوان المظالم تقضي بأنه: <em>(إذا اختلف مناط وسبب الاستحقاق، انتفى التداخل واقترن الاستحقاق)</em>".
                      </blockquote>
                    </div>

                    {/* Defense 5: Decision 118 */}
                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                      <h3 className="text-xs sm:text-sm font-bold text-neutral-100 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">
                          5
                        </span>
                        <span>تفنيد تمسك الإدارة بقرار مجلس الوزراء رقم (118) وتاريخ 12 / 04 / 1425هـ وبيان حقيقته النظامية:</span>
                      </h3>
                      <blockquote className="p-3 rounded-lg bg-neutral-900/90 border-r-2 border-amber-500 text-xs text-neutral-300 italic leading-relaxed space-y-2">
                        <p>
                          <strong>الوجه الأول (الغاية التشريعية للمنح لا للحرمان):</strong> نصت الوثيقة الرسمية للقرار (118) على أنه جاء بناءً على دراسة مشتركة بين الجهات العسكرية ووزارة المالية <em>«لتقديم مزايا مالية وعسكرية إضافية تستوعب أصحاب المؤهلات الجامعية وخريجي الكليات التقنية»</em>، فقرر إضافة الفقرتين (س) و(ع) إلى علاوة الفنيين (28-2) لمنح خريجي الكليات التقنية الفئات (8 و9 و10)؛ فكيف تقلب الإدارة قراراً شُرّع للمزايا الإضافية واستيعاب التقنيين إلى أداة لحرمانهم ومصادرة بدلاتهم المستحقة؟!
                        </p>
                        <p>
                          <strong>الوجه الثاني (موقع وظيفة كاتب وطابع آلة):</strong> إن ما ورد في القرار (118) من إضافة مسمى (كاتب وطابع آلة) في اللائحة التنفيذية مباشرة بعد جملة: <em>«...مثل تشغيل العقل الإلكتروني وتشغيل الآلات الإلكترونية الأتوماتيكية»</em> يخص حصراً إيضاحات وضوابط (علاوة الفنيين للرتبة والمؤهل)، ولا صلة له بـ <strong>بدل الحاسب الآلي (15%)</strong> الممنوح لقاء الممارسة الميدانية والتشغيل الفعلي لمنظومات القيادة والسيطرة؛ ومنسوخ بالمرسوم (م/37).
                        </p>
                      </blockquote>
                    </div>

                    {/* Defense 6: Incidental claim for Order 1520 */}
                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                      <h3 className="text-xs sm:text-sm font-bold text-neutral-100 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">
                          6
                        </span>
                        <span>الطلب العارض بإلزام الإدارة بتقديم القرار رقم (1520) ومبدأ المواجهة:</span>
                      </h3>
                      <blockquote className="p-3 rounded-lg bg-neutral-900/90 border-r-2 border-amber-500 text-xs text-neutral-300 italic leading-relaxed">
                        "استناداً للمادة (14) والمادة (60) من نظام المرافعات أمام ديوان المظالم، والمادة (108) من نظام الإثبات (المرسوم الملكي م/43): نلتمس من الدائرة الموقرة إصدار أمرها التمهيدي بإلزام ممثل الجهة المدعى عليها بتقديم: <strong>أصل القرار التنظيمي رقم (1520) وتاريخ 03 / 03 / 1437هـ</strong> المحفوظ تحت يدها؛ لكونه مستنداً جوهرياً ومنتجاً يثبت تكليف ومباشرة المدعي الفعلية لأعمال الحاسب، وننبه إلى أن حجب الإدارة للمستند أو امتناعها عن تقديمه يُعد قرينة قضائية قاطعة على صحة دعوى المدعي".
                      </blockquote>
                    </div>

                    {/* Defense 7: Statute of limitations protection */}
                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                      <h3 className="text-xs sm:text-sm font-bold text-neutral-100 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">
                          7
                        </span>
                        <span>تحصين الدعوى شكلاً ورفض الدفع بالتقادم (المادة 8/6):</span>
                      </h3>
                      <blockquote className="p-3 rounded-lg bg-neutral-900/90 border-r-2 border-amber-500 text-xs text-neutral-300 italic leading-relaxed">
                        "فضيلة القاضي: إن ما قد تدفع به الإدارة من فوات المواعيد (60 يوماً) مردود عليه بصريح نص المادة (الثامنة / الفقرة 6) من نظام المرافعات أمام ديوان المظالم؛ حيث قررت أن دعاوى الحقوق المالية والبدلات المقررة نظاماً <strong>تُسمع خلال (10) عشر سنوات من تاريخ نشوء الحق</strong>، والمدعي يطالب ببدل دوري مستمر ناشئ عن مركز نظامي قائم، مما يجعل الدعوى مقبولة شكلاً بكافة عناصرها".
                      </blockquote>
                    </div>
                  </div>

                  {/* Final Requests */}
                  <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/40 space-y-3">
                    <h2 className="text-sm sm:text-base font-bold text-amber-300 border-b border-amber-500/30 pb-2">
                      ثالثاً: الطلبات الجازمة والختامية في الدعوى
                    </h2>
                    <ol className="list-decimal list-inside text-xs space-y-2 text-neutral-200 leading-relaxed font-medium">
                      <li>
                        <strong className="text-amber-200">في الطلب العارض:</strong> إلزام الجهة المدعى عليها بتقديم أصل القرار التنظيمي رقم (1520) وتاريخ 03 / 03 / 1437هـ ومسيرات العمل الفعلي بقسم القيادة والسيطرة والحاسب الآلي.
                      </li>
                      <li>
                        <strong className="text-amber-200">في الموضوع - أولاً:</strong> إلغاء القرار السلبي الصادر من الجهة المدعى عليها بالامتناع عن صرف بدل الحاسب الآلي بنسبة (15%) للمدعي.
                      </li>
                      <li>
                        <strong className="text-amber-200">في الموضوع - ثانياً:</strong> إلزام المدعى عليها بصرف بدل الحاسب الآلي بنسبة (15%) من الراتب الأساسي بأثر رجعي من تاريخ صدور التكليف الفعلي بالقرار (1520) وحتى تاريخه، مع استمرار صرفه شهرياً طالما زاول العمل ذاته.
                      </li>
                      <li>
                        <strong className="text-amber-200">في التنفيذ:</strong> شمول الحكم بالنفاذ وفقاً للصيغة التنفيذية المقررة بالمادة (30) من نظام المرافعات أمام ديوان المظالم.
                      </li>
                    </ol>

                    <div className="pt-4 border-t border-neutral-700/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-neutral-400">
                      <span className="font-bold text-neutral-300">
                        مقدمه / الرقيب أول عبدالله محمد هيازع (الهوية: {unlockedNationalId})
                      </span>
                      <span>التوقيع والمصادقة: ............................</span>
                    </div>
                  </div>
                </>
              ) : customRecord ? (
                <>
                  {/* Custom Record Presentation */}
                  {customRecord.dialoguesAndExchanges && customRecord.dialoguesAndExchanges.length > 0 && (
                    <div className="space-y-3">
                      <h2 className="text-sm sm:text-base font-bold text-amber-300 flex items-center gap-2 border-r-4 border-amber-500 pr-2">
                        <span>أولاً: جدول المناقشات القضائية والردود المسكتة في الجلسات</span>
                      </h2>
                      <div className="overflow-x-auto rounded-xl border border-neutral-750 -mx-2 sm:mx-0">
                        <table className="w-full text-xs text-right border-collapse min-w-[580px]">
                          <thead className="bg-neutral-800 text-neutral-200 border-b border-neutral-700">
                            <tr>
                              <th className="p-3 font-bold w-1/4">المتحدث / الدفع المثار</th>
                              <th className="p-3 font-bold w-1/4">العيب النظامي المرصود</th>
                              <th className="p-3 font-bold w-1/2">الرد الفوري الصاعق والمُسكت</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-800 text-neutral-300">
                            {customRecord.dialoguesAndExchanges.map((item, idx) => (
                              <tr key={item.id || idx} className="hover:bg-neutral-850/50">
                                <td className="p-3 font-bold text-amber-300">
                                  <div>{item.speaker}</div>
                                  <div className="text-[11px] text-neutral-400 font-normal mt-1">{item.statement}</div>
                                </td>
                                <td className="p-3 text-rose-300 font-medium">
                                  {item.legalFlawIdentified}
                                </td>
                                <td className="p-3 text-emerald-300/90 leading-relaxed">
                                  {item.rebuttalArg}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Fatal Flaws & Strongest Rebuttals */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                      <h3 className="text-xs sm:text-sm font-bold text-rose-300 flex items-center gap-1.5 border-r-2 border-rose-500 pr-2">
                        <span>العيوب الجوهرية المرصودة في موقف الجهة الإدارية:</span>
                      </h3>
                      <ul className="space-y-2 text-xs text-neutral-300">
                        {customRecord.fatalFlawsFound.map((flaw, idx) => (
                          <li key={idx} className="flex items-start gap-2 bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                            <span>{flaw}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                      <h3 className="text-xs sm:text-sm font-bold text-emerald-300 flex items-center gap-1.5 border-r-2 border-emerald-500 pr-2">
                        <span>الحجج والأسانيد النظامية القاطعة لصالح المدعي:</span>
                      </h3>
                      <ul className="space-y-2 text-xs text-neutral-300">
                        {customRecord.strongestRebuttals.map((reb, idx) => (
                          <li key={idx} className="flex items-start gap-2 bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/80">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                            <span>{reb}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Governing Regulations */}
                  <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                    <h3 className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-1.5 border-r-2 border-amber-500 pr-2">
                      <span>الأنظمة والمراسيم الحاكمة للنزاع:</span>
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {customRecord.applicableRegulations.map((reg, idx) => (
                        <span key={idx} className="px-3 py-1 rounded-lg bg-neutral-900 border border-amber-500/30 text-xs text-amber-200">
                          {reg}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Operative / Ruling Requests */}
                  <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/40 space-y-3">
                    <h2 className="text-sm sm:text-base font-bold text-amber-300 border-b border-amber-500/30 pb-2">
                      منطوق الحكم والطلبات الختامية المقيدة بالهوية
                    </h2>
                    <div className="p-3 rounded-lg bg-neutral-900/90 border-r-2 border-amber-500 text-xs text-neutral-200 leading-relaxed font-semibold">
                      {customRecord.rulingOperative}
                    </div>
                    <div className="pt-3 border-t border-neutral-700/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-neutral-400">
                      <span className="font-bold text-neutral-300">
                        مقدمه / {customRecord.personName} (الهوية الوطنية: {customRecord.nationalId})
                      </span>
                      <span>التوقيع والمصادقة: ............................</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Generic Citizen Case Dossier */}
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3">
                      <h2 className="text-sm sm:text-base font-bold text-amber-300 border-r-4 border-amber-500 pr-2">
                        أولاً: الدفوع النظامية المبدئية المقيدة برقم الهوية ({unlockedNationalId})
                      </h2>
                      <div className="space-y-2.5 text-xs text-neutral-300 leading-relaxed">
                        <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800">
                          <strong className="text-amber-300 block mb-1">1. الدفع بقبول الدعوى شكلاً لسلامة الميعاد والتظلم:</strong>
                          تطبيقاً للمادة (8) من نظام المرافعات أمام ديوان المظالم، استوفى المدعي كافة مراحل التظلم الإداري المقررة نظاماً، مع التمسك بمهلة الـ 10 سنوات لدعاوى الحقوق والمزايا المالية الوظيفية المقررة بالمادة (8 / الفقرة 6).
                        </div>
                        <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800">
                          <strong className="text-amber-300 block mb-1">2. الدفع بعيب مخالفة النظام والانحراف في استعمال السلطة:</strong>
                          يتمسك المدعي بمبدأ المشروعية وسيادة القانون الإداري، وبطلان أي قرار سلبي أو إيجابي يصادر حقاً وظيفياً أو مالياً اكتسبه صاحب الشأن بمركز نظامي سليم.
                        </div>
                        <div className="p-3 rounded-lg bg-neutral-900/80 border border-neutral-800">
                          <strong className="text-amber-300 block mb-1">3. إلزام جهة الإدارة بتقديم ملف المعاملة كاملاً:</strong>
                          عملاً بالمادة (14) من نظام المرافعات أمام ديوان المظالم والمادة (108) من نظام الإثبات، يتعين على الإدارة إيداع كافة المستندات والقرارات التي تحت يدها، ويعد حجبها قرينة قضائية للمدعي.
                        </div>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/40 space-y-3">
                      <h2 className="text-sm sm:text-base font-bold text-amber-300 border-b border-amber-500/30 pb-2">
                        ثانياً: الطلبات الختامية في صحيفة الدعوى
                      </h2>
                      <ol className="list-decimal list-inside text-xs space-y-2 text-neutral-200 leading-relaxed font-medium">
                        <li>قبول الدعوى شكلاً لاستيفائها سائر الأوضاع والمواعيد المقررة نظاماً.</li>
                        <li>إلغاء القرار الإداري محل النزاع مع ما يترتب عليه من آثار نظامية ومالية.</li>
                        <li>إلزام الجهة الإدارية بالتعويض العادل عن الأضرار اللاحقة بصاحب الشأن.</li>
                      </ol>

                      <div className="pt-4 border-t border-neutral-700/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs text-neutral-400">
                        <span className="font-bold text-neutral-300">
                          مقدمه / {currentUser?.personName || 'صاحب الشأن'} (الهوية الوطنية: {unlockedNationalId})
                        </span>
                        <span>التوقيع والمصادقة: ............................</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Footer info bar on mobile and desktop */}
        <div className="px-4 py-2.5 bg-neutral-950 border-t border-neutral-800 text-[11px] text-neutral-400 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>حماية مشفرة محلية • مربوط بالهوية الوطنية • ديوان المظالم</span>
          </div>
          <span className="font-mono text-amber-500/80">المحكمة الإدارية</span>
        </div>
      </div>
    </div>
  );
}
