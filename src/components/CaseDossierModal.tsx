import { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  Check,
  Copy,
  Download,
  FileText,
  LockKeyhole,
  Printer,
  Scale,
  ShieldCheck,
  X,
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
  currentUser,
}: CaseDossierModalProps) {
  const [selectedId, setSelectedId] = useState('');
  const [copied, setCopied] = useState(false);

  const visibleRecords = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.role === 'admin') return judgmentRecords;
    return judgmentRecords.filter((record) => record.nationalId === currentUser.nationalId);
  }, [judgmentRecords, currentUser]);

  useEffect(() => {
    if (!isOpen) return;
    if (!visibleRecords.some((record) => record.id === selectedId)) {
      setSelectedId(visibleRecords[0]?.id || '');
    }
  }, [isOpen, visibleRecords, selectedId]);

  if (!isOpen) return null;

  const selected = visibleRecords.find((record) => record.id === selectedId) || null;
  const identityMarker = currentUser?.nationalId ? `•••• ${currentUser.nationalId.slice(-4)}` : 'إدارة';

  const printableText = selected
    ? [
        `ملف القضية: ${selected.judgmentType}`,
        `صاحب الشأن: ${selected.personName}`,
        `الجهة: ${selected.agencyName}`,
        `المحكمة: ${selected.courtType} - ${selected.circuitName}`,
        `رقم القضية: ${selected.caseNumber || 'غير مدخل'}`,
        `رقم الحكم: ${selected.judgmentNumber || 'غير مدخل'}`,
        `تاريخ الحكم: ${selected.judgmentDate || 'غير مدخل'}`,
        '',
        'الوقائع:',
        selected.facts || 'غير مدخلة',
        '',
        'أسباب الحكم:',
        selected.rulingReasons || 'غير مدخلة',
        '',
        'المنطوق:',
        selected.rulingOperative || 'غير مدخل',
        '',
        'الأنظمة والمواد المرتبطة:',
        selected.applicableRegulations.length ? selected.applicableRegulations.map((item) => `- ${item}`).join('\n') : 'لا توجد مراجع مرتبطة بعد.',
        '',
        'الملاحظات/العيوب المرصودة:',
        selected.fatalFlawsFound.length ? selected.fatalFlawsFound.map((item) => `- ${item}`).join('\n') : 'لا توجد ملاحظات مسجلة.',
      ].join('\n')
    : '';

  const handleCopy = async () => {
    if (!printableText) return;
    await navigator.clipboard.writeText(printableText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleDownload = () => {
    if (!printableText) return;
    const blob = new Blob([printableText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ملف_القضية_${selected?.caseNumber || 'أصول_القضاء'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    if (!printableText) return;
    const popup = window.open('', '_blank');
    if (!popup) {
      window.print();
      return;
    }
    popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>ملف القضية</title><style>body{font-family:Arial,sans-serif;line-height:1.8;padding:32px;white-space:pre-wrap;color:#111}</style></head><body>${escapeHtml(printableText)}<script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md p-2 sm:p-4" dir="rtl">
      <div className="mx-auto flex h-[96dvh] max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-black sm:text-lg">قضيتي — ملف مرتبط بالجلسة الآمنة</h2>
              <p className="text-[11px] text-slate-400">
                المستخدم: {currentUser?.name || 'غير معروف'} • الهوية: {identityMarker}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:text-white" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[290px_1fr]">
          <aside className="min-h-0 border-b border-slate-800 bg-slate-900/50 p-3 lg:border-b-0 lg:border-l">
            <div className="mb-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-[11px] leading-5 text-slate-400">
              <div className="mb-1 flex items-center gap-2 font-black text-emerald-300">
                <ShieldCheck className="h-4 w-4" /> عزل الملفات مفعل
              </div>
              لا يمكن فتح ملف بمجرد معرفة رقم هوية. تظهر هنا فقط السجلات التابعة للجلسة الحالية.
            </div>

            <div className="space-y-2 overflow-y-auto">
              {visibleRecords.map((record) => (
                <button
                  key={record.id}
                  onClick={() => setSelectedId(record.id)}
                  className={`w-full rounded-xl border p-3 text-right transition ${selectedId === record.id ? 'border-amber-400/40 bg-amber-400/10' : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'}`}
                >
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 shrink-0 text-amber-300" />
                    <span className="text-xs font-black text-slate-100">{record.judgmentType}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500">{record.caseNumber || 'قضية بلا رقم'} • {record.courtType}</p>
                </button>
              ))}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto p-4 sm:p-6">
            {!selected ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
                <BriefcaseBusiness className="h-12 w-12 text-slate-600" />
                <h3 className="mt-4 text-base font-black text-slate-200">لا توجد قضية محفوظة في هذه الجلسة</h3>
                <p className="mt-2 max-w-md text-xs leading-6 text-slate-500">
                  أضف القضية من مستودع الأحكام أو مساحة العمل. لن تعرض المنصة ملفات تجريبية أو هويات مستخدمين آخرين.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-white">{selected.judgmentType}</h3>
                      <p className="mt-1 text-xs text-slate-400">{selected.courtType} • {selected.circuitName}</p>
                      <p className="mt-2 text-[11px] text-slate-500">صاحب الشأن: {selected.personName} • الجهة: {selected.agencyName}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleCopy} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 text-xs font-bold text-cyan-200">
                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'تم النسخ' : 'نسخ'}
                      </button>
                      <button onClick={handleDownload} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-bold text-slate-300">
                        <Download className="h-4 w-4" /> نص
                      </button>
                      <button onClick={handlePrint} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-amber-400 px-3 text-xs font-black text-slate-950">
                        <Printer className="h-4 w-4" /> طباعة
                      </button>
                    </div>
                  </div>
                </section>

                <DossierSection title="الوقائع" text={selected.facts} />
                <DossierSection title="أسباب الحكم" text={selected.rulingReasons} />
                <DossierSection title="منطوق الحكم" text={selected.rulingOperative} />

                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <h4 className="mb-3 flex items-center gap-2 font-black text-white"><FileText className="h-4 w-4 text-cyan-300" /> الأنظمة والمواد المرتبطة</h4>
                  {selected.applicableRegulations.length ? (
                    <ul className="space-y-2 text-sm leading-7 text-slate-300">
                      {selected.applicableRegulations.map((item, index) => <li key={index}>• {item}</li>)}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-500">لا توجد مراجع مرتبطة بعد.</p>
                  )}
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function DossierSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <h4 className="mb-2 font-black text-white">{title}</h4>
      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{text || 'غير مدخل'}</p>
    </section>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
