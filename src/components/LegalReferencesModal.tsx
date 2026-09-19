import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  Check,
  Copy,
  ChevronLeft,
  ExternalLink,
  FileCheck2,
  FileText,
  Library,
  Search,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  LEGAL_REFERENCE_CATEGORIES,
  LEGAL_REFERENCE_DB_VERSION,
  LEGAL_REFERENCE_SYSTEMS,
  LegalReferenceSystem,
} from '../data/legalReferences';

interface LegalReferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAskExpert: (prompt: string) => void;
}

type ReferenceTab = 'articles' | 'law' | 'executive' | 'amendments' | 'versions';

const OFFICIAL_REFERENCE_PORTALS = [
  {
    label: 'هيئة الخبراء بمجلس الوزراء',
    url: 'https://laws.boe.gov.sa/',
    note: 'النص النظامي، أدوات الإصدار، الإصدارات والتعديلات',
  },
  {
    label: 'مجلس الوزراء السعودي',
    url: 'https://www.uqn.gov.sa/Decisions/council-of-ministers-decisions',
    note: 'قرارات مجلس الوزراء المنشورة رسمياً',
  },
  {
    label: 'مجلس الشورى',
    url: 'https://www.shura.gov.sa/',
    note: 'قرارات المجلس ومسار دراسة مشروعات الأنظمة',
  },
  {
    label: 'جريدة أم القرى',
    url: 'https://www.uqn.gov.sa/',
    note: 'التحقق من النشر والنفاذ والمراسيم والقرارات',
  },
] as const;

interface ParsedArticle {
  title: string;
  body: string;
}

function normalize(value: string) {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function parseArticles(text: string): ParsedArticle[] {
  if (!text) return [];
  const matches = [...text.matchAll(/###\s*(المادة[^\n:]*(?::|：)?)/g)];
  if (matches.length === 0) return [];
  return matches.map((match, index) => {
    const start = (match.index || 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index || text.length) : text.length;
    return {
      title: match[1].trim(),
      body: text.slice(start, end).replace(/^\s*[:：]?\s*/, '').trim(),
    };
  });
}

function sourceBadge(system: LegalReferenceSystem) {
  return system.verificationStatus === 'official'
    ? 'مطابق بمصدر رسمي'
    : 'بانتظار المطابقة الرسمية';
}

export function LegalReferencesModal({
  isOpen,
  onClose,
  onAskExpert,
}: LegalReferencesModalProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('الكل');
  const [selectedId, setSelectedId] = useState(LEGAL_REFERENCE_SYSTEMS[0]?.id || '');
  const [tab, setTab] = useState<ReferenceTab>('articles');
  const [expertRequest, setExpertRequest] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);

  const systems = useMemo(() => {
    const q = normalize(query);
    return LEGAL_REFERENCE_SYSTEMS.filter((system) => {
      const categoryMatch = category === 'الكل' || system.category === category;
      if (!categoryMatch) return false;
      if (!q) return true;
      return normalize([
        system.name,
        system.subCategory,
        system.royalDecree,
        system.cabinetResolution,
        system.tags.join(' '),
        system.lawText,
        system.executiveText,
        system.amendmentsText,
      ].join(' ')).includes(q);
    });
  }, [query, category]);

  const selected =
    LEGAL_REFERENCE_SYSTEMS.find((system) => system.id === selectedId) ||
    systems[0] ||
    LEGAL_REFERENCE_SYSTEMS[0];

  const articles = useMemo(() => parseArticles(selected?.lawText || ''), [selected]);

  if (!isOpen || !selected) return null;

  const copyCompleteReference = async () => {
    const payload = [
      selected.name,
      selected.royalDecree ? `أداة الإصدار: ${selected.royalDecree}` : '',
      selected.cabinetResolution ? `قرار مجلس الوزراء: ${selected.cabinetResolution}` : '',
      selected.status ? `الحالة: ${selected.status}` : '',
      selected.lawText ? `\n=== نص النظام ===\n${selected.lawText}` : '',
      selected.executiveText ? `\n=== اللائحة والملحقات ===\n${selected.executiveText}` : '',
      selected.amendmentsText ? `\n=== التعديلات والقرارات ===\n${selected.amendmentsText}` : '',
      selected.officialSourceUrl ? `\nالمصدر الرسمي: ${selected.officialSourceUrl}` : '',
    ].filter(Boolean).join('\n');
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 1800);
    } catch (error) {
      console.error('Copy legal reference failed', error);
    }
  };

  const askReferenceCustodian = () => {
    const request = expertRequest.trim() || query.trim() || `أعطني مواد ${selected.name}`;
    onAskExpert(
      `[أمين المراجع القانونية - أصول القضاء]
المطلوب: ${request}
النظام المحدد: ${selected.name}
بيانات الإصدار الداخلية: ${selected.royalDecree || 'غير محدد'}
حالة المصدر: ${sourceBadge(selected)}
${selected.officialSourceUrl ? `المصدر الرسمي: ${selected.officialSourceUrl}` : ''}

تعليمات إلزامية: أحضر المادة المطلوبة برقمها واسم النظام ونصها ومصدرها الرسمي وحالة التعديل إن أمكن. لا تنسب أي نص للنظام إذا لم يكن المصدر الرسمي متحققاً. إذا كانت النسخة الداخلية غير موثقة أو متعارضة فقل ذلك صراحة ولا تخمّن.`
    );
    onClose();
  };

  const askReferenceAuditor = () => {
    const request = expertRequest.trim() || query.trim() || selected.name;
    onAskExpert(
      `[مدقق المراجع القانونية - أصول القضاء]
راجع المرجع التالي قبل اعتماده: ${request}
النظام: ${selected.name}
الأداة: ${selected.royalDecree || 'غير محددة'}
قرار مجلس الوزراء: ${selected.cabinetResolution || 'غير محدد'}
الحالة الداخلية: ${selected.status || 'غير محددة'}
${selected.officialSourceUrl ? `المصدر الرسمي المتاح: ${selected.officialSourceUrl}` : 'لا يوجد رابط رسمي مثبت في قاعدة المنصة بعد.'}

المهمة: تحقق من اسم النظام ورقم المادة والنص والنسخة النافذة والتعديلات، وفرّق بوضوح بين النص الرسمي وبين الملاحظات الداخلية أو المبادئ القضائية. لا تعتمد مرجعاً غير موثق.`
    );
    onClose();
  };

  const tabs: Array<{ id: ReferenceTab; label: string }> = [
    { id: 'articles', label: 'المواد' },
    { id: 'law', label: 'نص النظام' },
    { id: 'executive', label: 'اللائحة' },
    { id: 'amendments', label: 'التعديلات' },
    { id: 'versions', label: 'النسخ والمصدر' },
  ];

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm p-2 sm:p-4" dir="rtl">
      <div className="mx-auto flex h-[96vh] max-w-[1500px] flex-col overflow-hidden rounded-3xl border border-cyan-400/20 bg-[#030b1b] text-slate-100 shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-cyan-400/15 bg-[#06142b]/95 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <Library className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-black sm:text-xl">مركز المراجع والأنظمة</h2>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {LEGAL_REFERENCE_SYSTEMS.length} مرجعاً منظماً • إصدار القاعدة {LEGAL_REFERENCE_DB_VERSION} • النظام ← المواد ← اللائحة ← التعديلات
              </p>
            </div>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-300 hover:text-white" aria-label="إغلاق">
            <ArrowRight className="h-5 w-5" />
          </button>
        </header>

        <div className="grid flex-1 min-h-0 grid-cols-1 lg:grid-cols-[350px_1fr]">
          <aside className="flex min-h-0 flex-col border-b border-slate-800 bg-[#041126]/90 lg:border-b-0 lg:border-l">
            <div className="space-y-3 border-b border-slate-800 p-3">
              <div className="relative">
                <Search className="absolute right-3 top-3 h-4 w-4 text-slate-500" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث باسم النظام أو المادة أو التعديل..." className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-3 pr-10 text-xs outline-none focus:border-cyan-400/60" />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {['الكل', ...LEGAL_REFERENCE_CATEGORIES.map((item) => item.name)].map((item) => (
                  <button key={item} onClick={() => setCategory(item)} className={`whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${category === item ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-200' : 'border-slate-800 bg-slate-900 text-slate-400'}`}>
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {systems.map((system) => (
                <button key={system.id} onClick={() => { setSelectedId(system.id); setTab('articles'); }} className={`mb-2 w-full rounded-2xl border p-3 text-right transition ${selected.id === system.id ? 'border-cyan-400/40 bg-cyan-400/10' : 'border-slate-800 bg-slate-900/70 hover:border-slate-700'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-extrabold leading-5 text-slate-100">{system.name}</span>
                    {system.verificationStatus === 'official' ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" /> : <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-slate-500">{system.subCategory}</p>
                </button>
              ))}
              {systems.length === 0 && <div className="p-8 text-center text-xs text-slate-500">لا توجد نتائج مطابقة.</div>}
            </div>
          </aside>

          <main className="min-h-0 overflow-y-auto p-4 sm:p-6 select-text">
            <section className="rounded-2xl border border-cyan-400/15 bg-[#07172d] p-4 select-text">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-white sm:text-2xl">{selected.name}</h3>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${selected.verificationStatus === 'official' ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/30 bg-amber-400/10 text-amber-300'}`}>{sourceBadge(selected)}</span>
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate-400">{selected.subCategory}</p>
                  <div className="mt-3 grid gap-2 text-[11px] text-slate-400 sm:grid-cols-2">
                    <div><span className="font-bold text-slate-300">أداة الإصدار:</span> {selected.royalDecree || 'غير مثبتة'}</div>
                    <div><span className="font-bold text-slate-300">قرار مجلس الوزراء:</span> {selected.cabinetResolution || 'غير مثبت'}</div>
                    <div><span className="font-bold text-slate-300">الحالة:</span> {selected.status || 'غير محددة'}</div>
                    <div><span className="font-bold text-slate-300">الجهة:</span> {selected.authority || 'غير محددة'}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={copyCompleteReference} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-400/15">
                    {copiedAll ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedAll ? 'تم النسخ' : 'نسخ المرجع كاملاً'}
                  </button>
                  {selected.officialSourceUrl && (
                    <a href={selected.officialSourceUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-400/15">
                      <ExternalLink className="h-4 w-4" /> المصدر الرسمي
                    </a>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-400/5 p-4">
              <div className="flex items-center gap-2 text-emerald-200">
                <ShieldCheck className="h-5 w-5" />
                <h4 className="font-black">مصادر الاعتماد الرئيسية</h4>
              </div>
              <p className="mt-1 text-[11px] leading-5 text-slate-400">
                ترتيب التحقق في أصول القضاء: هيئة الخبراء بمجلس الوزراء، قرارات مجلس الوزراء السعودي، مجلس الشورى، ثم جريدة أم القرى لإثبات النشر والنفاذ. لا تُقدَّم النسخة الداخلية على المصدر الرسمي.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {OFFICIAL_REFERENCE_PORTALS.map((portal) => (
                  <a key={portal.label} href={portal.url} target="_blank" rel="noreferrer" className="rounded-xl border border-slate-700 bg-slate-950/70 p-3 hover:border-emerald-400/40">
                    <div className="flex items-center gap-2 text-xs font-black text-slate-100">
                      <ExternalLink className="h-3.5 w-3.5 text-emerald-300" />
                      <span>{portal.label}</span>
                    </div>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">{portal.note}</p>
                  </a>
                ))}
              </div>
            </section>

            <section className="mt-4 grid gap-3 xl:grid-cols-2">
              <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
                <div className="flex items-center gap-2 text-cyan-200"><Bot className="h-5 w-5" /><span className="font-black">أمين المراجع</span></div>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">موظف مخصص لإحضار المادة المطلوبة باسم النظام ورقم المادة والمصدر، ويرفض اختلاق النص عند غياب التوثيق.</p>
              </div>
              <div className="rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4">
                <div className="flex items-center gap-2 text-violet-200"><Sparkles className="h-5 w-5" /><span className="font-black">مدقق المراجع</span></div>
                <p className="mt-1 text-[11px] leading-5 text-slate-400">خبير ثانٍ لمراجعة النسخة النافذة والتعديل والمصدر قبل اعتماد النص في التحليل أو المذكرة.</p>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input value={expertRequest} onChange={(e) => setExpertRequest(e.target.value)} placeholder="مثال: أحضر المادة الثامنة من نظام المرافعات أمام ديوان المظالم مع آخر تعديل" className="min-h-11 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs outline-none focus:border-cyan-400/60" />
                <button onClick={askReferenceCustodian} className="min-h-11 rounded-xl bg-cyan-400 px-4 text-xs font-black text-slate-950 hover:bg-cyan-300">استدعاء أمين المراجع</button>
                <button onClick={askReferenceAuditor} className="min-h-11 rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 text-xs font-black text-violet-200 hover:bg-violet-400/15">تدقيق المرجع</button>
              </div>
            </section>

            <div className="mt-4 flex gap-1.5 overflow-x-auto border-b border-slate-800 pb-2">
              {tabs.map((item) => (
                <button key={item.id} onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold ${tab === item.id ? 'bg-amber-400 text-slate-950' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>{item.label}</button>
              ))}
            </div>

            <section className="mt-4">
              {tab === 'articles' && (
                <div className="space-y-3">
                  {articles.length > 0 ? articles.map((article, index) => (
                    <article key={article.title + index} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="font-black text-amber-300">{article.title}</h4>
                        <button onClick={() => { setExpertRequest(`${article.title} من ${selected.name}`); }} className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-300">
                          طلب التحقق <ChevronLeft className="h-3 w-3" />
                        </button>
                      </div>
                      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-300">{article.body}</p>
                    </article>
                  )) : (
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm leading-7 text-amber-100">
                      لم تُفهرس مواد هذا النظام مادةً مادة في النسخة الداخلية الحالية. استخدم «أمين المراجع» لإحضار مادة محددة، ولا تعتمد نصاً غير موثق.
                    </div>
                  )}
                </div>
              )}

              {tab === 'law' && <ReferenceText title="نص النظام في قاعدة المنصة" text={selected.lawText} />}
              {tab === 'executive' && <ReferenceText title="اللائحة التنفيذية والملحقات" text={selected.executiveText} />}
              {tab === 'amendments' && <ReferenceText title="سجل التعديلات والقرارات" text={selected.amendmentsText} />}

              {tab === 'versions' && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
                    <h4 className="flex items-center gap-2 font-black text-white"><BookOpenCheck className="h-4 w-4 text-cyan-300" /> نسخة قاعدة المنصة</h4>
                    <p className="mt-2 text-xs leading-6 text-slate-400">الإصدار الداخلي: {LEGAL_REFERENCE_DB_VERSION}. تاريخ الإصدار الهجري المسجل: {selected.issueDateHijri || 'غير محدد'}، وتاريخ النفاذ المسجل: {selected.effectiveDateHijri || 'غير محدد'}.</p>
                  </div>
                  <div className={`rounded-2xl border p-4 ${selected.verificationStatus === 'official' ? 'border-emerald-400/20 bg-emerald-400/5' : 'border-amber-400/20 bg-amber-400/5'}`}>
                    <h4 className="flex items-center gap-2 font-black text-white"><ShieldCheck className="h-4 w-4" /> حالة المطابقة</h4>
                    <p className="mt-2 text-xs leading-6 text-slate-300">
                      {selected.verificationStatus === 'official'
                        ? 'تم ربط هذا المرجع بصفحة نظام رسمية في بوابة الأنظمة السعودية التابعة لهيئة الخبراء. تبقى مراجعة المواد المعدلة والإصدارات مطلوبة قبل الاستشهاد القضائي.'
                        : 'هذا المرجع موجود في قاعدة المنصة الداخلية لكنه لم يُربط بعد بمصدر رسمي مثبت. لا يُعامل كنص تشريعي نهائي حتى يراجعه مدقق المراجع.'}
                    </p>
                    {selected.officialSourceUrl && <a href={selected.officialSourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-emerald-300"><ExternalLink className="h-4 w-4" /> فتح النسخة الرسمية</a>}
                  </div>
                </div>
              )}
            </section>

            <div className="mt-6 rounded-2xl border border-rose-400/15 bg-rose-400/5 p-4 text-[11px] leading-6 text-slate-400">
              <span className="font-black text-rose-200">قاعدة اعتماد المراجع:</span> لا يُعتمد أي نص أو رقم مادة أو تعديل في مخرج قضائي لمجرد وجوده في قاعدة المنصة؛ الأولوية دائماً للنص الرسمي النافذ ومصدره وتاريخ تعديله.
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function ReferenceText({ title, text }: { title: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const copyText = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (error) {
      console.error('Copy reference text failed', error);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 select-text">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-cyan-300" />
          <h4 className="font-black text-white">{title}</h4>
        </div>
        {text && (
          <button onClick={copyText} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-2.5 text-[11px] font-bold text-cyan-200 hover:bg-cyan-400/10">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'تم النسخ' : 'نسخ النص كاملاً'}
          </button>
        )}
      </div>
      {text ? <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-slate-300 select-text">{text}</pre> : <p className="text-sm text-slate-500">لا توجد نسخة نصية مفهرسة في قاعدة المنصة حالياً.</p>}
    </div>
  );
}
