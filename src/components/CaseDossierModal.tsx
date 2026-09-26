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
import { CaseStageRecord, JudgmentRecord, UserSession } from '../types';

interface CaseDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  judgmentRecords?: JudgmentRecord[];
  initialNationalId?: string;
  currentUser?: UserSession | null;
}

type DossierGroup = {
  id: string;
  records: JudgmentRecord[];
  personName: string;
  nationalId: string;
  agencyName: string;
  matterTitle: string;
};

function recordTime(record: JudgmentRecord): number {
  return Number(record.updatedAt || record.createdAt || 0);
}

function maskNationalId(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return 'غير مدخل';
  return digits.length <= 4 ? '••••' : `••••••${digits.slice(-4)}`;
}

function stageDate(stage: CaseStageRecord): string {
  return stage.rulingDate || stage.filingDate || '';
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
    return judgmentRecords;
  }, [judgmentRecords, currentUser]);

  const dossierGroups = useMemo<DossierGroup[]>(() => {
    const map = new Map<string, JudgmentRecord[]>();
    for (const record of visibleRecords) {
      const key = record.dossierId || `legacy-${record.id}`;
      const bucket = map.get(key) || [];
      bucket.push(record);
      map.set(key, bucket);
    }

    return Array.from(map.entries())
      .map(([id, records]) => {
        const sorted = [...records].sort((a, b) => recordTime(a) - recordTime(b));
        const first = sorted[0];
        return {
          id,
          records: sorted,
          personName: first?.personName || 'غير معروف',
          nationalId: first?.nationalId || '',
          agencyName: first?.agencyName || '',
          matterTitle: first?.matterTitle || first?.judgmentType || 'ملف قضائي',
        };
      })
      .sort((a, b) => recordTime(b.records[b.records.length - 1]) - recordTime(a.records[a.records.length - 1]));
  }, [visibleRecords]);

  useEffect(() => {
    if (!isOpen) return;
    if (!dossierGroups.some((group) => group.id === selectedId)) {
      setSelectedId(dossierGroups[0]?.id || '');
    }
  }, [isOpen, dossierGroups, selectedId]);

  if (!isOpen) return null;

  const selectedGroup = dossierGroups.find((group) => group.id === selectedId) || null;
  const selected = selectedGroup?.records[selectedGroup.records.length - 1] || null;
  const identityMarker = currentUser?.role === 'admin' ? 'ADMIN' : currentUser?.email || 'مستخدم';

  const timelineText = selectedGroup
    ? selectedGroup.records.flatMap((record, recordIndex) => {
        const header = [
          `الوثيقة/الحكم ${recordIndex + 1}: ${record.judgmentType}`,
          `المحكمة: ${record.courtType} - ${record.circuitName}`,
          `رقم القضية: ${record.caseNumber || 'غير مدخل'}`,
          `رقم الحكم: ${record.judgmentNumber || 'غير مدخل'}`,
          `التاريخ: ${record.judgmentDate || 'غير مدخل'}`,
          `المنطوق: ${record.rulingOperative || 'غير مدخل'}`,
          `الأسباب: ${record.rulingReasons || 'غير مدخلة'}`,
        ];
        const stages = (record.caseChronology || []).map((stage, index) => [
          `  المرحلة ${index + 1}: ${stage.stageLevel}`,
          `  النوع: ${stage.documentType || 'غير محدد'}`,
          `  القضية: ${stage.caseNumber || 'غير مدخل'}`,
          `  التاريخ: ${stageDate(stage) || 'غير مدخل'}`,
          `  النتيجة لصاحب الشأن: ${stage.outcomeForPerson || 'غير محسوم'}`,
          `  التكييف: ${stage.judicialCharacterization || 'غير مدخل'}`,
          `  التسبيب: ${stage.judicialReasoning || stage.rulingReasons || 'غير مدخل'}`,
          `  المنطوق: ${stage.rulingSummary || 'غير مدخل'}`,
          `  المواد/القرارات: ${stage.legalMaterials?.join(' | ') || 'غير مدخلة'}`,
        ].join('\n'));
        return [...header, ...stages, ''];
      }).join('\n')
    : '';

  const printableText = selectedGroup
    ? [
        `ملف النزاع: ${selectedGroup.matterTitle}`,
        `صاحب الشأن: ${selectedGroup.personName}`,
        `الهوية: ${maskNationalId(selectedGroup.nationalId)}`,
        `الجهة: ${selectedGroup.agencyName}`,
        `معرف الملف: ${selectedGroup.id}`,
        `عدد السجلات المرتبطة: ${selectedGroup.records.length}`,
        '',
        'التسلسل القضائي الكامل:',
        timelineText,
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
    link.download = `ملف_القضية_${selected?.rootCaseNumber || selected?.caseNumber || 'أصول_القضاء'}.txt`;
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

    popup.document.title = 'ملف القضية';
    popup.document.documentElement.lang = 'ar';
    popup.document.documentElement.dir = 'rtl';

    const style = popup.document.createElement('style');
    style.textContent = 'body{font-family:Arial,sans-serif;line-height:1.8;padding:32px;color:#111;direction:rtl} pre{white-space:pre-wrap;word-break:break-word;font:inherit;margin:0}';
    popup.document.head.appendChild(style);

    const contentNode = popup.document.createElement('pre');
    contentNode.textContent = printableText;
    popup.document.body.replaceChildren(contentNode);

    window.setTimeout(() => {
      try {
        popup.focus();
        popup.print();
      } catch (error) {
        console.error('Unable to open dossier print dialog', error);
      }
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md p-2 sm:p-4" dir="rtl">
      <div className="mx-auto flex h-[96dvh] max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/90 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-black sm:text-lg">قضيتي — ملف نزاع موحد بتسلسل الأحكام</h2>
              <p className="text-[11px] text-slate-400">المستخدم: {currentUser?.name || 'غير معروف'} • الحساب: {identityMarker}</p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:text-white" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[330px_1fr]">
          <aside className="min-h-0 border-b border-slate-800 bg-slate-900/50 p-3 lg:border-b-0 lg:border-l">
            <div className="mb-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-3 text-[11px] leading-5 text-slate-400">
              <div className="mb-1 flex items-center gap-2 font-black text-emerald-300"><ShieldCheck className="h-4 w-4" /> الربط القضائي مفعل</div>
              الاسم والهوية محفوظان داخل السجل المشفر. الخادم يربط الأحكام إذا تطابقت هوية صاحب الشأن ووجد رابط قوي في أرقام القضايا/الأحكام أو ملف النزاع، ولا يدمج القضايا المختلفة بالهوية وحدها.
            </div>

            <div className="space-y-2 overflow-y-auto">
              {dossierGroups.map((group) => (
                <button
                  key={group.id}
                  onClick={() => setSelectedId(group.id)}
                  className={`w-full rounded-xl border p-3 text-right transition ${selectedId === group.id ? 'border-amber-400/40 bg-amber-400/10' : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'}`}
                >
                  <div className="flex items-center gap-2">
                    <Scale className="h-4 w-4 shrink-0 text-amber-300" />
                    <span className="text-xs font-black text-slate-100">{group.matterTitle}</span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-400">{group.personName} • هوية {maskNationalId(group.nationalId)}</p>
                  <p className="mt-1 text-[10px] text-slate-500">{group.records.length} سجل/حكم مرتبط • {group.agencyName || 'جهة غير مدخلة'}</p>
                </button>
              ))}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto p-4 sm:p-6">
            {!selectedGroup || !selected ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center">
                <BriefcaseBusiness className="h-12 w-12 text-slate-600" />
                <h3 className="mt-4 text-base font-black text-slate-200">لا توجد قضية محفوظة في هذه الجلسة</h3>
              </div>
            ) : (
              <div className="space-y-4">
                <section className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="text-lg font-black text-white">{selectedGroup.matterTitle}</h3>
                      <p className="mt-1 text-xs text-slate-400">{selectedGroup.personName} • هوية {maskNationalId(selectedGroup.nationalId)}</p>
                      <p className="mt-2 text-[11px] text-slate-500">{selectedGroup.agencyName} • {selectedGroup.records.length} وثيقة/حكم في الملف</p>
                      {selected.dossierLinkStatus === 'candidate' && (
                        <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-bold text-amber-200">يوجد ملف مرشح للربط؛ لم تدمجه المنصة تلقائياً لأن الصلة لم تبلغ حد الثقة.</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleCopy} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 text-xs font-bold text-cyan-200">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'تم النسخ' : 'نسخ'}</button>
                      <button onClick={handleDownload} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-bold text-slate-300"><Download className="h-4 w-4" /> نص</button>
                      <button onClick={handlePrint} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-amber-400 px-3 text-xs font-black text-slate-950"><Printer className="h-4 w-4" /> طباعة</button>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                  <h4 className="mb-4 flex items-center gap-2 font-black text-white"><FileText className="h-4 w-4 text-cyan-300" /> التسلسل الكامل للأحكام والمذكرات</h4>
                  <div className="space-y-4 border-r-2 border-amber-500/30 pr-4">
                    {selectedGroup.records.map((record, recordIndex) => (
                      <div key={record.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-black text-amber-200">{recordIndex + 1}. {record.judgmentType}</div>
                          <div className="text-[10px] text-slate-500">{record.judgmentDate || 'تاريخ غير مدخل'}</div>
                        </div>
                        <div className="mt-2 grid gap-2 text-[11px] text-slate-400 sm:grid-cols-3">
                          <span>المحكمة: {record.courtType}</span>
                          <span>القضية: {record.caseNumber || '—'}</span>
                          <span>الحكم: {record.judgmentNumber || '—'}</span>
                        </div>
                        <DossierSection title="منطوق هذه المرحلة" text={record.rulingOperative} compact />
                        <DossierSection title="سبب الحكم" text={record.rulingReasons} compact />
                        {(record.caseChronology || []).map((stage, stageIndex) => (
                          <div key={stage.id} className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-400/5 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs font-black text-cyan-200">{stageIndex + 1}. {stage.stageLevel} {stage.documentType ? `• ${stage.documentType}` : ''}</span>
                              <span className="text-[10px] text-slate-500">{stageDate(stage)}</span>
                            </div>
                            <p className="mt-2 text-xs leading-6 text-slate-300"><b>النتيجة:</b> {stage.outcomeForPerson || 'غير محسوم'} — {stage.rulingSummary || 'لا يوجد منطوق مسجل'}</p>
                            {stage.judicialCharacterization && <p className="mt-1 text-xs leading-6 text-slate-300"><b>تكييف المحكمة:</b> {stage.judicialCharacterization}</p>}
                            {(stage.judicialReasoning || stage.rulingReasons) && <p className="mt-1 text-xs leading-6 text-slate-300"><b>التسبيب:</b> {stage.judicialReasoning || stage.rulingReasons}</p>}
                            {!!stage.legalMaterials?.length && <p className="mt-1 text-xs leading-6 text-slate-300"><b>المواد والقرارات:</b> {stage.legalMaterials.join(' • ')}</p>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function DossierSection({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  return (
    <section className={compact ? 'mt-3' : 'rounded-2xl border border-slate-800 bg-slate-900/50 p-4'}>
      <h4 className="mb-1 font-black text-white">{title}</h4>
      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{text || 'غير مدخل'}</p>
    </section>
  );
}
