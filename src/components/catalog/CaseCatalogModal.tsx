import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronDown, Home, LayoutGrid, Search, X, ArrowLeft, Scale, MessageCircle, Landmark, AlertTriangle } from 'lucide-react';
import {
  CASE_TAXONOMY,
  SYSTEM_LABELS,
  WORKSPACE_ACTIONS,
  TAXONOMY_LEVEL_NAMES,
  TaxonomyWorkspace,
  TaxonomyNode,
  countLeaves,
  findNode,
  getTrail,
  hashToPath,
  pathToHash,
  searchTaxonomy,
  taxonomyStats,
} from '../../data/caseTaxonomy';
import type { CourtSystemId } from '../../lib/judicialSystem';

interface CaseCatalogModalProps {
  isOpen: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onLaunch: (workspace: TaxonomyWorkspace, serviceId: string, casePath: string[], caseLabel: string) => void;
  /** يفتح المحكمة الافتراضية على الجهة المرجّحة لنوع القضية. */
  onOpenCourtroom?: (system: CourtSystemId) => void;
  /** الوضع المبسط: المحادثة الموجّهة أولاً، والأدوات المتخصصة بعدها. */
  simpleMode?: boolean;
  /** يفتح المستشار بنص مُعبّأ مسبقاً؛ المستخدم يراجعه ويرسله بنفسه. */
  onAskAssistant?: (text: string) => void;
}

function clearCatalogHash() {
  try {
    if (window.location.hash.startsWith('#/catalog')) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  } catch { /* بعض البيئات تمنع تعديل السجل */ }
}

function caseTypeChatPrompt(trailLabels: string): string {
  return `قضيتي من نوع: ${trailLabels}.
اسألني عن الوقائع والتواريخ والمستندات المهمة لهذا النوع، ثم وضّح لي الخيارات والخطوة التالية بلغة واضحة.`;
}

function palette(isAdmin: boolean) {
  return isAdmin
    ? {
        shell: 'bg-slate-950 text-slate-100',
        bar: 'bg-slate-900 border-slate-800',
        card: 'bg-slate-900 border-slate-800 hover:border-amber-500/50',
        soft: 'bg-slate-900/60 border-slate-800',
        muted: 'text-slate-400',
        strong: 'text-white',
        accent: 'text-amber-300',
        accentBg: 'bg-amber-500 text-slate-950',
        chip: 'bg-slate-800 text-slate-300 hover:bg-slate-700',
        chipOn: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
        input: 'bg-slate-900 border-slate-700 text-white placeholder:text-slate-500',
        panel: 'bg-slate-900 border-slate-700 shadow-2xl',
        link: 'hover:text-amber-300',
        warn: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
      }
    : {
        shell: 'bg-[#f7f8fa] text-slate-900',
        bar: 'bg-white border-slate-200',
        card: 'bg-white border-slate-200 hover:border-slate-900/40',
        soft: 'bg-white border-slate-200',
        muted: 'text-slate-500',
        strong: 'text-slate-950',
        accent: 'text-slate-900',
        accentBg: 'bg-slate-950 text-white',
        chip: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
        chipOn: 'bg-slate-900 text-white border-slate-900',
        input: 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400',
        panel: 'bg-white border-slate-200 shadow-2xl',
        link: 'hover:text-slate-950 hover:underline',
        warn: 'border-amber-300 bg-amber-50 text-amber-900',
      };
}

export function CaseCatalogModal({ isOpen, isAdmin, onClose, onLaunch, onOpenCourtroom, simpleMode = false, onAskAssistant }: CaseCatalogModalProps) {
  const t = palette(isAdmin);
  const [path, setPath] = useState<string[]>(() => (typeof window === 'undefined' ? [] : hashToPath(window.location.hash)));
  const [query, setQuery] = useState('');
  const [sectorFilter, setSectorFilter] = useState<string | null>(null);
  const [megaOpen, setMegaOpen] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stats = useMemo(() => taxonomyStats(), []);
  // مرجع ثابت حتى لا يُعاد تسجيل مستمعي السجل مع كل إعادة رسم في App.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // التزامن مع الرابط: #/catalog/القطاع/الفرع/التصنيف/النوع
  useEffect(() => {
    if (!isOpen) return;
    const sync = () => {
      const next = hashToPath(window.location.hash);
      setPath(findNode(next) || next.length === 0 ? next : []);
    };
    // زر الرجوع في المتصفح: الخروج من #/catalog يغلق الفهرس كأنه صفحة.
    const onHistory = () => {
      if (!window.location.hash.startsWith('#/catalog')) onCloseRef.current();
      else sync();
    };
    sync();
    window.addEventListener('hashchange', onHistory);
    window.addEventListener('popstate', onHistory);
    return () => {
      window.removeEventListener('hashchange', onHistory);
      window.removeEventListener('popstate', onHistory);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (megaOpen) setMegaOpen(null);
      else { clearCatalogHash(); onClose(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, megaOpen, onClose]);

  const goTo = (next: string[]) => {
    setPath(next);
    setQuery('');
    setSectorFilter(null);
    setMegaOpen(null);
    try {
      const hash = pathToHash(next);
      if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    } catch { /* بعض البيئات تمنع تعديل السجل — التنقل الداخلي يعمل بدونه */ }
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const close = () => {
    clearCatalogHash();
    onClose();
  };

  const askAssistant = (text: string) => {
    if (!onAskAssistant) return;
    close();
    onAskAssistant(text);
  };

  const node = path.length ? findNode(path) : null;
  const trail = getTrail(path);
  const hits = useMemo(() => searchTaxonomy(query), [query]);
  const hitsBySector = useMemo(() => {
    const counts = new Map<string, number>();
    for (const hit of hits) counts.set(hit.node.path[0], (counts.get(hit.node.path[0]) || 0) + 1);
    return counts;
  }, [hits]);
  const visibleHits = sectorFilter ? hits.filter((hit) => hit.node.path[0] === sectorFilter) : hits;

  if (!isOpen) return null;

  const searching = query.trim().length > 0;

  return (
    <div className={`fixed inset-0 z-[60] flex flex-col ${t.shell}`} dir="rtl" role="dialog" aria-modal="true" aria-label="فهرس القضايا">
      {/* الرأس + البحث */}
      <header className={`shrink-0 border-b ${t.bar}`}>
        <div className="flex items-center gap-2 px-3 py-2.5 sm:px-5">
          <button type="button" onClick={() => goTo([])} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-2 font-black ${t.strong}`}>
            <LayoutGrid className="h-5 w-5" />
            <span className="text-sm sm:text-base">فهرس القضايا</span>
          </button>
          <div className="relative flex-1">
            <Search className={`pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 ${t.muted}`} />
            <input
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSectorFilter(null); setMegaOpen(null); }}
              placeholder="ابحث بنوع المشكلة: فصل تعسفي، شيك، حضانة، إخلاء…"
              aria-label="بحث في فهرس القضايا"
              className={`min-h-11 w-full rounded-xl border py-2 pr-10 pl-9 text-sm outline-none focus:ring-2 focus:ring-amber-400/50 ${t.input}`}
            />
            {searching && (
              <button type="button" onClick={() => setQuery('')} aria-label="مسح البحث" className={`absolute left-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 ${t.muted}`}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button type="button" onClick={close} aria-label="إغلاق الفهرس" className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl ${t.chip}`}>
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* القائمة الكبرى: القطاعات ← الفروع ← التصنيفات */}
        <nav className="relative" aria-label="قطاعات القضايا">
          <div className="flex gap-1 overflow-x-auto px-3 pb-2 sm:px-5">
            {CASE_TAXONOMY.map((sector) => {
              const open = megaOpen === sector.key;
              const active = path[0] === sector.key;
              return (
                <button
                  key={sector.key}
                  type="button"
                  aria-expanded={open}
                  onClick={() => setMegaOpen(open ? null : sector.key)}
                  onMouseEnter={() => { if (window.matchMedia?.('(hover: hover)').matches) setMegaOpen(sector.key); }}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-xs font-bold sm:text-sm ${
                    open || active ? t.accentBg : t.chip
                  }`}
                >
                  {sector.label}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
              );
            })}
          </div>

          {megaOpen && (() => {
            const sector = CASE_TAXONOMY.find((s) => s.key === megaOpen)!;
            return (
              <div
                className={`absolute inset-x-0 top-full z-10 max-h-[70vh] overflow-y-auto border-y p-4 sm:p-6 ${t.panel}`}
                onMouseLeave={() => { if (window.matchMedia?.('(hover: hover)').matches) setMegaOpen(null); }}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <button type="button" onClick={() => goTo(sector.path)} className={`text-base font-black ${t.strong} ${t.link}`}>
                      {sector.label} — عرض الكل ({countLeaves(sector)} نوع)
                    </button>
                    <p className={`mt-1 text-xs ${t.muted}`}>{sector.description}</p>
                  </div>
                  <button type="button" onClick={() => setMegaOpen(null)} className={`rounded-lg p-2 ${t.chip}`} aria-label="إغلاق القائمة">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  {sector.children.map((branch) => (
                    <div key={branch.key}>
                      <button type="button" onClick={() => goTo(branch.path)} className={`mb-2 block text-right text-sm font-black ${t.accent} ${t.link}`}>
                        {branch.label}
                      </button>
                      <ul className="space-y-1">
                        {branch.children.map((category) => (
                          <li key={category.key}>
                            <button type="button" onClick={() => goTo(category.path)} className={`min-h-9 text-right text-xs ${t.muted} ${t.link}`}>
                              {category.label}
                              <span className="mr-1 opacity-60">({countLeaves(category)})</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </nav>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 pb-24 sm:p-6" onClick={() => megaOpen && setMegaOpen(null)}>
        <div className="mx-auto max-w-6xl">
          {searching ? (
            <section aria-live="polite">
              <h2 className={`text-lg font-black ${t.strong}`}>نتائج البحث ({visibleHits.length})</h2>
              {hits.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="تصفية حسب القطاع">
                  <button type="button" onClick={() => setSectorFilter(null)} className={`min-h-9 rounded-full border px-3 text-xs font-bold ${sectorFilter === null ? t.chipOn : `border-transparent ${t.chip}`}`}>
                    الكل ({hits.length})
                  </button>
                  {CASE_TAXONOMY.filter((s) => hitsBySector.has(s.key)).map((s) => (
                    <button key={s.key} type="button" onClick={() => setSectorFilter(sectorFilter === s.key ? null : s.key)} className={`min-h-9 rounded-full border px-3 text-xs font-bold ${sectorFilter === s.key ? t.chipOn : `border-transparent ${t.chip}`}`}>
                      {s.label} ({hitsBySector.get(s.key)})
                    </button>
                  ))}
                </div>
              )}
              {visibleHits.length === 0 ? (
                <div className={`mt-6 rounded-2xl border p-6 text-sm ${t.soft} ${t.muted}`}>
                  <p>لا يوجد نوع مطابق. جرّب كلمة أبسط، أو تصفّح القطاعات من القائمة أعلاه.</p>
                  {onAskAssistant && (
                    <button type="button" onClick={() => askAssistant(query.trim())} className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-black ${t.accentBg}`}>
                      <MessageCircle className="h-4 w-4" /> اسأل QADA عن: «{query.trim().slice(0, 60)}»
                    </button>
                  )}
                </div>
              ) : (
                <ul className="mt-4 space-y-2">
                  {visibleHits.map((hit) => (
                    <li key={hit.node.path.join('/')}>
                      <button type="button" onClick={() => goTo(hit.node.path)} className={`w-full rounded-2xl border p-3 text-right transition-colors ${t.card}`}>
                        <div className={`text-[11px] ${t.muted}`}>
                          {hit.trail.slice(0, -1).map((item) => item.label).join(' › ')}
                        </div>
                        <div className={`mt-0.5 flex items-center justify-between gap-2 text-sm font-black ${t.strong}`}>
                          <span>{hit.node.label}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.chip}`}>{TAXONOMY_LEVEL_NAMES[hit.node.level - 1]}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <>
              {/* مسار التنقل */}
              <nav aria-label="مسار التنقل" className="mb-4 flex flex-wrap items-center gap-1 text-xs">
                <button type="button" onClick={() => goTo([])} className={`inline-flex min-h-9 items-center gap-1 rounded-lg px-2 ${t.chip}`}>
                  <Home className="h-3.5 w-3.5" /> الفهرس
                </button>
                {trail.map((item, index) => (
                  <React.Fragment key={item.path.join('/')}>
                    <ChevronLeft className={`h-3.5 w-3.5 ${t.muted}`} />
                    <button
                      type="button"
                      onClick={() => goTo(item.path)}
                      aria-current={index === trail.length - 1 ? 'page' : undefined}
                      className={`min-h-9 rounded-lg px-2 ${index === trail.length - 1 ? `font-black ${t.strong}` : t.chip}`}
                    >
                      {item.label}
                    </button>
                  </React.Fragment>
                ))}
              </nav>

              {!node && (
                <section>
                  <h1 className={`text-xl font-black sm:text-2xl ${t.strong}`}>ما نوع قضيتك؟</h1>
                  <p className={`mt-1 text-sm ${t.muted}`}>
                    {stats.sectors} قطاعات · {stats.branches} فرعاً · {stats.categories} تصنيفاً · {stats.leaves} نوع قضية. اختر القطاع ثم ضيّق حتى تصل لنوع قضيتك.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {CASE_TAXONOMY.map((sector) => (
                      <button key={sector.key} type="button" onClick={() => goTo(sector.path)} className={`rounded-2xl border p-4 text-right transition-colors ${t.card}`}>
                        <div className="flex items-start justify-between gap-2">
                          <h2 className={`text-base font-black ${t.strong}`}>{sector.label}</h2>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${t.chip}`}>{countLeaves(sector)}</span>
                        </div>
                        <p className={`mt-1 text-xs leading-6 ${t.muted}`}>{sector.description}</p>
                        <p className={`mt-3 text-[11px] ${t.muted}`}>
                          {sector.children.slice(0, 4).map((b) => b.label).join(' · ')}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {node && node.level < 4 && (
                <section>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.chip}`}>{TAXONOMY_LEVEL_NAMES[node.level - 1]}</span>
                    <h1 className={`text-xl font-black sm:text-2xl ${t.strong}`}>{node.label}</h1>
                  </div>
                  {node.description && <p className={`mt-1 text-sm ${t.muted}`}>{node.description}</p>}
                  <p className={`mt-1 text-xs ${t.muted}`}>{countLeaves(node)} نوع قضية · {SYSTEM_LABELS[node.system]}</p>

                  {node.level === 3 ? (
                    <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {node.children.map((leaf) => (
                        <li key={leaf.key}>
                          <button type="button" onClick={() => goTo(leaf.path)} className={`flex min-h-14 w-full items-center justify-between gap-2 rounded-2xl border p-3 text-right text-sm font-bold transition-colors ${t.card} ${t.strong}`}>
                            <span>{leaf.label}</span>
                            <ArrowLeft className={`h-4 w-4 shrink-0 ${t.muted}`} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {node.children.map((child) => (
                        <div key={child.key} className={`rounded-2xl border p-4 ${t.soft}`}>
                          <button type="button" onClick={() => goTo(child.path)} className={`flex w-full items-center justify-between gap-2 text-right ${t.strong}`}>
                            <h2 className="text-sm font-black">{child.label}</h2>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.chip}`}>{countLeaves(child)}</span>
                          </button>
                          <ul className="mt-3 space-y-1">
                            {child.children.slice(0, node.level === 1 ? 5 : 4).map((grand) => (
                              <li key={grand.key}>
                                <button type="button" onClick={() => goTo(grand.path)} className={`min-h-9 w-full text-right text-xs ${t.muted} ${t.link}`}>
                                  {grand.label}
                                </button>
                              </li>
                            ))}
                            {child.children.length > (node.level === 1 ? 5 : 4) && (
                              <li>
                                <button type="button" onClick={() => goTo(child.path)} className={`min-h-9 text-xs font-bold ${t.accent}`}>
                                  عرض الكل ({child.children.length})
                                </button>
                              </li>
                            )}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {node && node.level === 4 && (
                <section className="mx-auto max-w-3xl">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${t.chip}`}>{TAXONOMY_LEVEL_NAMES[3]}</span>
                  <h1 className={`mt-2 text-xl font-black sm:text-2xl ${t.strong}`}>{node.label}</h1>
                  <p className={`mt-1 text-xs ${t.muted}`}>{trail.slice(0, -1).map((item) => item.label).join(' › ')}</p>
                  <p className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${t.chip}`}>
                    <Landmark className="h-3.5 w-3.5" /> الجهة المرجّحة: {SYSTEM_LABELS[node.system]}
                  </p>
                  {node.note && (
                    <p role="note" className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-xs font-bold leading-6 ${t.warn}`}>
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{node.note}</span>
                    </p>
                  )}

                  {(() => {
                    const trailLabels = trail.map((item) => item.label).join(' › ');
                    const chat = onAskAssistant && (
                      <button
                        type="button"
                        onClick={() => askAssistant(caseTypeChatPrompt(trailLabels))}
                        className={`flex min-h-16 w-full items-center gap-3 rounded-2xl p-3 text-right transition-colors ${simpleMode ? t.accentBg : `border ${t.card} ${t.strong}`}`}
                      >
                        <MessageCircle className="h-5 w-5 shrink-0" />
                        <span>
                          <span className="block text-sm font-black">ابدأ بمحادثة موجّهة مع QADA</span>
                          <span className="mt-0.5 block text-xs opacity-80">نسألك عن الناقص فقط ثم نوضح لك الخطوة التالية. تراجع الرسالة قبل إرسالها.</span>
                        </span>
                      </button>
                    );
                    const tools = (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {WORKSPACE_ACTIONS[node.workspace].map((action) => (
                          <button
                            key={action.id}
                            type="button"
                            onClick={() => { close(); onLaunch(node.workspace, action.id, node.path, trailLabels); }}
                            className={`min-h-16 rounded-2xl border p-3 text-right transition-colors ${t.card}`}
                          >
                            <span className={`flex items-center gap-2 text-sm font-black ${t.strong}`}><Scale className="h-4 w-4" />{action.label}</span>
                            <span className={`mt-1 block text-xs ${t.muted}`}>{action.hint}</span>
                          </button>
                        ))}
                      </div>
                    );
                    const courtroom = onOpenCourtroom && (
                      <button
                        type="button"
                        onClick={() => { close(); onOpenCourtroom(node.system); }}
                        className={`mt-2 flex min-h-14 w-full items-center gap-3 rounded-2xl border p-3 text-right transition-colors ${t.card} ${t.strong}`}
                      >
                        <Landmark className="h-5 w-5 shrink-0" />
                        <span>
                          <span className="block text-sm font-black">اختبر قضيتك في المحكمة الافتراضية</span>
                          <span className={`mt-0.5 block text-xs ${t.muted}`}>تُفتح على {SYSTEM_LABELS[node.system]} — محاكاة للمراجعة، لا تنبؤ بالحكم.</span>
                        </span>
                      </button>
                    );
                    return simpleMode ? (
                      <>
                        <h2 className={`mt-6 text-sm font-black ${t.strong}`}>كيف تحب نبدأ؟</h2>
                        <div className="mt-3">{chat}</div>
                        <h2 className={`mt-6 text-xs font-black ${t.muted}`}>{chat ? 'أو افتح أداة متخصصة' : 'اختر الأداة'}</h2>
                        {tools}
                        {courtroom}
                      </>
                    ) : (
                      <>
                        <h2 className={`mt-6 text-sm font-black ${t.strong}`}>ماذا تريد أن تفعل؟</h2>
                        {tools}
                        {courtroom}
                        {chat && <div className="mt-2">{chat}</div>}
                      </>
                    );
                  })()}
                  <p className={`mt-3 text-[11px] leading-6 ${t.muted}`}>
                    الفهرس للوصول السريع فقط. الجهة المرجّحة تقدير تنظيمي؛ تُحدَّد الجهة المختصة من وقائع قضيتك، وتُراجع المخرجات على المصادر المتحققة قبل الاعتماد عليها.
                  </p>

                  {(() => {
                    const siblings = (findNode(node.path.slice(0, -1))?.children || []).filter((s) => s.key !== node.key);
                    if (!siblings.length) return null;
                    return (
                      <div className="mt-8">
                        <h2 className={`text-sm font-black ${t.strong}`}>أنواع قريبة</h2>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {siblings.map((s) => (
                            <button key={s.key} type="button" onClick={() => goTo(s.path)} className={`min-h-9 rounded-full px-3 text-xs font-bold ${t.chip}`}>{s.label}</button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
