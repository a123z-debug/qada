import React, { useEffect, useState } from 'react';
import {
  Building2,
  Scale,
  ShieldAlert,
  ArrowLeft,
  FileText,
  Gavel,
  ShieldCheck,
  Sparkles,
  Zap,
  CheckCircle2,
  HelpCircle,
  FolderOpen,
  Search,
  Library,
  Bot,
  FileCheck,
  AlertTriangle,
  Clock,
  Network,
  LockKeyhole
} from 'lucide-react';
import { CourtJurisdiction, COURT_CATEGORIES } from '../layout/Sidebar';
import { readSseTextResponse } from '../../lib/readSseTextResponse';
import { readFileAsAttachment } from '../../lib/clientAttachments';
import type { Attachment } from '../../types';

async function simpleAssistantHttpError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({} as Record<string, unknown>));
  const code = typeof payload?.error === 'string' ? payload.error : '';
  const retryAfter = Number(response.headers.get('Retry-After') || 0);

  if (response.status === 401 || code === 'AUTH_REQUIRED') {
    return 'انتهت جلسة الاستخدام. حدّث الصفحة واختر واجهة QADA من جديد.';
  }
  if (response.status === 429) {
    return retryAfter > 0
      ? `تم بلوغ حد الاستخدام المؤقت. أعد المحاولة بعد نحو ${retryAfter} ثانية.`
      : 'تم بلوغ حد الاستخدام المؤقت. أعد المحاولة بعد قليل.';
  }
  if (response.status === 400) {
    return 'تعذر قراءة الطلب أو أحد المرفقات. راجع المدخلات ثم أعد المحاولة.';
  }
  return `تعذر تشغيل محرك التحليل حالياً (HTTP ${response.status}).`;
}

interface WelcomeScreenProps {
  onSelectCourt: (court: CourtJurisdiction) => void;
  onSelectService: (service: string) => void;
  userName?: string;
  message?: string;
  isAdmin?: boolean;
  defaultMode?: 'simple' | 'professional';
  onModeChange?: (mode: 'simple' | 'professional') => void;
  onOpenAdminOverview?: () => void;
}

export function WelcomeScreen({
  onSelectCourt,
  onSelectService,
  userName,
  message = 'الرجاء اختيار الاختصاص القضائي للبدء',
  isAdmin = false,
  defaultMode,
  onModeChange,
  onOpenAdminOverview,
}: WelcomeScreenProps) {
  const [interfaceMode, setInterfaceMode] = useState<'simple' | 'professional'>(defaultMode || (isAdmin ? 'professional' : 'simple'));

  useEffect(() => {
    if (defaultMode) setInterfaceMode(defaultMode);
  }, [defaultMode]);

  const changeInterfaceMode = (mode: 'simple' | 'professional') => {
    setInterfaceMode(mode);
    onModeChange?.(mode);
  };
  const [simpleRequest, setSimpleRequest] = useState('');
  const [simpleMessages, setSimpleMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([]);
  const [simpleBusy, setSimpleBusy] = useState(false);
  const [simpleError, setSimpleError] = useState('');
  const [simpleAttachments, setSimpleAttachments] = useState<Attachment[]>([]);
  const [workspaceLoaded, setWorkspaceLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/cases?workspace=1', {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json().catch(() => ({}));
        return payload?.state as { simpleMessages?: Array<{ id: string; role: 'user' | 'assistant'; content: string }>; simpleDraft?: string } | undefined;
      })
      .then((state) => {
        if (cancelled || !state) return;
        if (Array.isArray(state.simpleMessages)) setSimpleMessages(state.simpleMessages.slice(-40));
        if (typeof state.simpleDraft === 'string') setSimpleRequest(state.simpleDraft);
      })
      .catch(() => {
        // The interface still works if the shared workspace store is temporarily unavailable.
      })
      .finally(() => {
        if (!cancelled) setWorkspaceLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!workspaceLoaded) return;
    const timer = window.setTimeout(() => {
      void fetch('/api/cases?workspace=1', {
        method: 'PUT',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: {
            simpleMessages: simpleMessages.filter((message) => message.content.trim()).slice(-40),
            simpleDraft: simpleRequest,
          },
        }),
      }).then((response) => {
        if (!response.ok) {
          setSimpleError('تعذر حفظ مساحة العمل على الخادم. المحادثة الحالية ما زالت ظاهرة في هذا المتصفح، لكن لا تعتبرها محفوظة دائماً حتى تعود خدمة الحفظ.');
        }
      }).catch(() => {
        setSimpleError('تعذر الاتصال بخدمة حفظ مساحة العمل. المحادثة الحالية ما زالت ظاهرة في هذا المتصفح.');
      });
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [simpleMessages, simpleRequest, workspaceLoaded]);

  const sharedTask = [...simpleMessages].reverse().find((message) => message.role === 'user' && message.content.trim());

  const handleQuickLaunch = (court: CourtJurisdiction, serviceId: string) => {
    onSelectCourt(court);
    onSelectService(serviceId);
  };

  const simpleActions = [
    { title: 'شخص ما سددني', description: 'دين، تحويل، سلفة أو مبلغ مستحق.', icon: Sparkles, text: 'لي مبلغ عند شخص أو جهة ولم يتم سداده. اسألني عن المبلغ، سبب الاستحقاق، الإثباتات، المواعيد، وما تم بيننا، ثم وضح لي الخيارات والخطوة التالية.' },
    { title: 'أبغى أعترض على حكم', description: 'ارفع الحكم أو اشرح نتيجته وتاريخه.', icon: Gavel, text: 'عندي حكم وأبغى أعرف هل عندي طريق اعتراض وما الذي أحتاجه. ابدأ بالحكم وتاريخه وطلبات القضية والمستندات، ولا تفترض وجود سبب اعتراض قبل فحصه.' },
    { title: 'عندي مشكلة مع جهة حكومية', description: 'قرار، خصم، رفض طلب أو إجراء إداري.', icon: ShieldCheck, text: 'عندي مشكلة مع جهة حكومية. اسألني عن القرار أو الإجراء وتاريخه والجهة وما الذي طلبته أو تظلمت منه، ثم حدد لي المسار المناسب بلغة واضحة.' },
    { title: 'راجع عقد أو مستند', description: 'عقد، سند، تحويل، محضر أو خطاب.', icon: FolderOpen, text: 'أبغى تراجع مستنداتي وتقول لي وش تثبت، وش ينقصها، وهل بينها تعارض، وما المستندات التي أحتاجها قبل أي خطوة.' },
    { title: 'ما أعرف وش حقي', description: 'احكِ المشكلة وسنبدأ من الصفر.', icon: Search, text: 'ما أعرف وش حقي أو وش الإجراء المناسب. خلني أشرح المشكلة من البداية، واسألني فقط عن الأشياء المهمة ثم وضح لي الخيارات بدون مصطلحات معقدة.' },
    { title: 'أبغى دعوى أو مذكرة', description: 'نجمع منك المعلومات ثم نبدأ الصياغة.', icon: FileText, text: 'أبغى إعداد دعوى أو مذكرة. لا تبدأ الصياغة مباشرة؛ اجمع مني الوقائع والطلبات والمستندات الناقصة ثم ابدأ بمسودة واضحة قابلة للمراجعة.' },
  ];

  const openSimpleTask = async (request: string) => {
    const task = request.trim();
    if (!task || simpleBusy) return;

    const userMessage = { id: 'simple-user-' + Date.now(), role: 'user' as const, content: task };
    const assistantId = 'simple-assistant-' + Date.now();
    const assistantMessage = { id: assistantId, role: 'assistant' as const, content: '' };
    const previousMessages = simpleMessages;

    setSimpleRequest('');
    setSimpleError('');
    setSimpleBusy(true);
    setSimpleMessages([...previousMessages, userMessage, assistantMessage]);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...previousMessages
              .filter((message) => message.content.trim())
              .map((message) => ({ role: message.role, content: message.content })),
            { role: 'user', content: task, attachments: simpleAttachments },
          ],
          targetCourt: 'الاستشارة القضائية العامة',
          responseMode: 'simple',
          powerMode: true,
        }),
      });

      if (!response.ok) {
        throw new Error(await simpleAssistantHttpError(response));
      }

      const result = await readSseTextResponse(response, (fullText) => {
        setSimpleMessages((current) =>
          current.map((message) => message.id === assistantId ? { ...message, content: fullText } : message)
        );
      });

      if (!result.trim()) {
        throw new Error('لم يصل رد صالح من محرك التحليل.');
      }
      // Keep the current evidence attached across follow-up questions until the user removes it.
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر إكمال المهمة.';
      setSimpleError(message);
      setSimpleMessages((current) =>
        current.map((item) =>
          item.id === assistantId
            ? { ...item, content: message }
            : item
        )
      );
    } finally {
      setSimpleBusy(false);
    }
  };

  const addSimpleAttachments = async (files: FileList | null) => {
    if (!files?.length) return;
    setSimpleError('');
    try {
      const attachments = await Promise.all(Array.from(files).map((file) => readFileAsAttachment(file)));
      setSimpleAttachments((current) => [...current, ...attachments].slice(0, 6));
    } catch (error) {
      setSimpleError(error instanceof Error ? error.message : 'تعذر قراءة المرفق.');
    }
  };

  if (interfaceMode === 'simple') {
    return (
      <div className="qada-simple-screen mx-auto w-full max-w-4xl space-y-5 px-1 py-2 sm:px-4 sm:py-4" dir="rtl">
        <div className="qada-profile-card relative overflow-hidden rounded-[26px] border px-4 py-4 sm:px-5 sm:py-5">
          <div className="qada-profile-ribbon" aria-hidden="true" />
          <div className="qada-profile-gold-sweep" aria-hidden="true" />

          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5 sm:gap-4">
              <div className="qada-profile-avatar-shell relative shrink-0">
                <div className="qada-profile-avatar flex h-14 w-14 items-center justify-center rounded-full text-lg font-black text-white sm:h-16 sm:w-16 sm:text-xl">
                  {(userName || 'مستخدم').trim().slice(0, 1)}
                </div>
                <span className="qada-profile-verified absolute -bottom-1 -left-1 flex h-6 w-6 items-center justify-center rounded-full">
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
              </div>

              <div className="min-w-0">
                <div className="qada-profile-kicker mb-1 inline-flex items-center gap-1.5 text-[10px] font-black">
                  <Scale className="h-3.5 w-3.5" strokeWidth={1.9} />
                  الملف الشخصي
                </div>
                <div className="qada-profile-name truncate text-base font-black sm:text-lg">
                  {userName || 'مستخدم QADA'}
                </div>
                <div className="qada-profile-meta mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold sm:text-[11px]">
                  <span>QADA Simple</span>
                  <span className="opacity-40">•</span>
                  <span>مساحة شخصية</span>
                </div>
              </div>
            </div>

            <div className="qada-profile-status hidden items-center gap-2 rounded-full px-3 py-2 text-[10px] font-black sm:flex">
              <ShieldCheck className="h-4 w-4" strokeWidth={2} />
              جلسة محمية
            </div>
          </div>

          <div className="qada-profile-mobile-status relative z-10 mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-black sm:hidden">
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
            جلسة محمية
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-1">
          <div>
            <div className="sr-only">QADA SIMPLE</div>
            <h2 className="text-sm font-black text-slate-950">قضيتي</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">كل شيء عن مشكلتك في مكان واحد.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changeInterfaceMode('professional')}
              className="min-h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-bold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
            >
              الواجهة الاحترافية
            </button>
            {isAdmin && onOpenAdminOverview && (
              <button
                type="button"
                onClick={onOpenAdminOverview}
                className="min-h-10 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-black text-slate-700 shadow-sm"
              >
                واجهة الإدارة
              </button>
            )}
          </div>
        </div>

        <section className="qada-simple-hero rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_12px_45px_rgba(15,23,42,0.06)] sm:p-7">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <Sparkles className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-4xl">
                احكِ لنا وش صار معك.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-[15px]">
                ما تحتاج ترتب كلامك ولا تعرف اسم المحكمة أو النظام. اكتب القصة مثل ما تعرفها، وQADA يسألك فقط عن الأشياء الناقصة.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            {[
              ['1', 'احكِ المشكلة', 'اكتب اللي صار بطريقتك.'],
              ['2', 'أرفق أوراقك', 'إن عندك حكم أو عقد أو صورة.'],
              ['3', 'خذ خطوتك التالية', 'نوضح لك وش تحتاج تسوي بعدين.'],
            ].map(([number, title, text]) => (
              <div key={number} className="rounded-2xl border border-emerald-900/10 bg-emerald-50/45 px-3 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-800 text-[10px] font-black text-white">{number}</span>
                  <span className="text-xs font-black text-slate-900">{title}</span>
                </div>
                <p className="mt-1.5 pr-8 text-[10px] leading-5 text-slate-500">{text}</p>
              </div>
            ))}
          </div>

          {simpleMessages.length > 0 && (
            <div className="mt-5 max-h-[48dvh] space-y-3 overflow-y-auto rounded-2xl bg-[#f7f8fa] p-3 custom-scrollbar sm:p-4">
              {simpleMessages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.role === 'user'
                      ? 'mr-auto max-w-[92%] rounded-2xl rounded-tr-md border border-blue-100 bg-blue-50 p-3'
                      : 'ml-auto max-w-[96%] rounded-2xl rounded-tl-md border border-slate-200 bg-white p-3'
                  }
                >
                  <div className="mb-1 text-[10px] font-black text-slate-400">
                    {message.role === 'user' ? 'أنت' : 'QADA'}
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                    {message.content || <span className="text-slate-400">جاري إكمال المهمة...</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-5 rounded-2xl border border-slate-200 bg-[#fafbfc] p-2.5 sm:p-3">
            <textarea
              value={simpleRequest}
              onChange={(event) => setSimpleRequest(event.target.value)}
              placeholder={
                simpleMessages.length
                  ? 'أضف المعلومة المطلوبة أو أكمل كلامك...'
                  : 'مثال: سلفت شخص 15 ألف ريال قبل سنة، عندي تحويل بنكي ورسائل، والحين يرفض يسدد...'
              }
              className="min-h-28 w-full resize-y rounded-xl border-0 bg-transparent px-2 py-2 text-base leading-7 text-slate-950 outline-none placeholder:text-slate-400 sm:min-h-32"
            />

            {simpleAttachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2 px-1">
                {simpleAttachments.map((attachment) => (
                  <button
                    key={attachment.id}
                    type="button"
                    onClick={() => setSimpleAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                    className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600 shadow-sm hover:border-rose-200 hover:text-rose-600"
                    title="إزالة المرفق"
                  >
                    {attachment.name}
                  </button>
                ))}
              </div>
            )}

            {simpleError && (
              <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold leading-5 text-rose-700">
                {simpleError}
              </div>
            )}

            <div className="mt-2 flex flex-col gap-2 border-t border-slate-200 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-slate-600 transition hover:bg-white hover:text-slate-950">
                <FileText className="h-4 w-4" />
                <span>إرفاق ملف أو صورة</span>
                <input
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(event) => {
                    void addSimpleAttachments(event.target.files);
                    event.currentTarget.value = '';
                  }}
                />
              </label>

              <button
                type="button"
                disabled={!simpleRequest.trim() || simpleBusy}
                onClick={() => void openSimpleTask(simpleRequest)}
                className="qada-primary-action min-h-12 shrink-0 rounded-2xl bg-slate-950 px-6 text-sm font-black text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 sm:min-w-40"
              >
                {simpleBusy ? 'جاري فهم قضيتك...' : simpleMessages.length ? 'أكمل مع QADA' : 'حلّل مشكلتي'}
              </button>
            </div>
          </div>
        </section>

        {simpleMessages.length === 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <h2 className="text-sm font-black text-slate-950">أمثلة تساعدك تبدأ</h2>
              <span className="text-[10px] font-bold text-slate-400">اختر الأقرب أو اكتب حالتك بنفسك</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {simpleActions.map((action) => {
                const ActionIcon = action.icon;
                return (
                  <button
                    key={action.title}
                    type="button"
                    onClick={() => void openSimpleTask(action.text)}
                    className="group flex min-h-[104px] items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-[0_6px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_10px_30px_rgba(15,23,42,0.07)]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition group-hover:bg-slate-950 group-hover:text-white">
                      <ActionIcon className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <span>
                      <span className="block text-sm font-black text-slate-950">{action.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">{action.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        <p className="px-1 text-center text-[10px] leading-5 text-slate-400">
          QADA يرتب التحليل والمراجع في الخلفية. أنت تشوف فقط اللي يفيدك في قضيتك.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 py-4 px-2 sm:px-6 select-none" dir="rtl">
      <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/15 bg-slate-900/70 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] font-black text-amber-300">QADA PROFESSIONAL</div>
          <p className="mt-1 text-xs text-slate-400">للشخص الذي يعرف نوع القضية ويريد اختيار المحكمة والخدمة والمراجع بنفسه.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => changeInterfaceMode('simple')} className="min-h-10 rounded-xl border border-slate-700 bg-slate-950 px-4 text-xs font-bold text-slate-200 hover:border-cyan-400/40">
            الواجهة البسيطة
          </button>
          {isAdmin && onOpenAdminOverview && (
            <button type="button" onClick={onOpenAdminOverview} className="min-h-10 rounded-xl border border-violet-400/30 bg-violet-500/10 px-4 text-xs font-black text-violet-200 hover:bg-violet-500/20">
              واجهة الإدارة
            </button>
          )}
        </div>
      </div>

      {sharedTask && (
        <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[11px] font-black text-cyan-200">ملف العمل المشترك بين Simple وProfessional</div>
              <p className="mt-1 line-clamp-2 text-xs leading-6 text-slate-400">{sharedTask.content}</p>
              <p className="mt-1 text-[10px] text-slate-600">محفوظ في مخزن QADA المشفر لحسابك، ويمكنك الرجوع إلى Simple ومتابعة نفس السياق.</p>
            </div>
            <button type="button" onClick={() => changeInterfaceMode('simple')} className="min-h-10 shrink-0 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 text-xs font-black text-cyan-200 hover:bg-cyan-400/15">
              متابعة الملف في Simple
            </button>
          </div>
        </div>
      )}
      
      {/* 1. بانر الـ Hero الرئيسي */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-amber-500/20 p-6 sm:p-10 shadow-2xl">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          
          <div className="space-y-4 max-w-2xl text-right">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>الوضع المتقدم — تحكم يدوي</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              اختر المسار بنفسك <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-600">وتابع التفاصيل</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {userName ? `أهلاً بك، ${userName}. ` : ''}هنا تقدر تختار نوع المحكمة والخدمة بنفسك، تراجع المستندات والمراجع، وتتنقل بين أدوات القضية بتفصيل أكبر.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => handleQuickLaunch('administrative', 'administrative_claim')}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:from-amber-400 hover:to-amber-500 transition-all text-sm flex items-center gap-2"
              >
                <Scale className="w-4 h-4" /> اختر نوع القضية
              </button>
              <a
                href="#tools-section"
                className="px-6 py-3 bg-slate-800/80 hover:bg-slate-800 text-slate-200 font-medium border border-slate-700 rounded-xl transition-all text-sm"
              >
                شوف كل الخيارات
              </a>
            </div>
          </div>

          {/* لوحة مصغرة تمثل ملف القضية الرقمي */}
          <div className="w-full md:w-80 bg-slate-950/80 border border-amber-500/30 rounded-2xl p-5 shadow-2xl backdrop-blur-md shrink-0">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <span className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4" /> مساحة قضيتي
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono">
                قيد المراجعة
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-300">
                <span>حالة ملف القضية:</span>
                <span className="font-bold text-amber-400">بانتظار الفحص</span>
              </div>

              <div className="space-y-1.5 pt-2 text-[11px]">
                <div className="flex items-center justify-between text-slate-400">
                  <span>المحرر القضائي:</span>
                  <span className="text-slate-300">غير مقيم بعد</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>المستندات والمرفقات:</span>
                  <span className="text-slate-300">تُحدد بعد الرفع</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>الملاحظات الحرجة:</span>
                  <span className="text-slate-300">تظهر بعد التحليل</span>
                </div>
              </div>

              <p className="pt-2 border-t border-slate-800 text-[10px] leading-5 text-slate-500">
                لا تعرض المنصة نسبة سلامة ثابتة قبل تشغيل فحص فعلي على ملف القضية.
              </p>
            </div>
          </div>

        </div>
      </div>

      {isAdmin && onOpenAdminOverview && (
        <div className="relative overflow-hidden rounded-3xl border border-violet-400/35 bg-gradient-to-l from-violet-500/15 via-slate-950/95 to-cyan-500/10 p-5 sm:p-6 shadow-[0_20px_70px_rgba(76,29,149,.18)]">
          <div className="absolute -top-16 -left-16 h-44 w-44 rounded-full bg-violet-500/15 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-violet-300/30 bg-violet-500/15 text-violet-200 shadow-[0_0_25px_rgba(167,139,250,.15)]">
                <Network className="h-7 w-7" />
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-2.5 py-1 text-[10px] font-black text-violet-200">
                  <LockKeyhole className="h-3 w-3" />
                  ADMIN ONLY
                </div>
                <h2 className="mt-2 text-xl sm:text-2xl font-black text-white">غرفة العمليات وخريطة الوكلاء</h2>
                <p className="mt-1 max-w-2xl text-xs sm:text-sm leading-6 text-slate-400">
                  شاهد جميع وكلاء QADA ومساراتهم، واعرف أي وكيل متصل الآن وأي وكيل قيد البناء، ثم تتبع الأخطاء وحالة كل مسار من مكان واحد.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenAdminOverview}
              className="min-h-12 shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-300/40 bg-violet-500/20 px-5 py-3 text-sm font-black text-violet-100 transition hover:bg-violet-500/30 hover:border-violet-200/60 shadow-lg"
            >
              <Network className="w-5 h-5" />
              <span>فتح خريطة الوكلاء</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. مركز الأدوات والخدمات الرئيسية (Grid) */}
      <div id="tools-section" className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-400" />
            <span>اختر نوع قضيتك أو الإجراء الذي تريده</span>
          </h2>
          <span className="text-xs text-slate-400">وضع متقدم للمستخدم الخبير</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {COURT_CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const primaryService = cat.services[0];

            return (
              <div
                key={cat.id}
                className="group relative rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/40 transition-all duration-300 p-6 flex flex-col justify-between shadow-xl backdrop-blur-sm"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-inner ${cat.colorTheme.bg} ${cat.colorTheme.border} ${cat.colorTheme.text}`}>
                      <CatIcon className="w-6 h-6" />
                    </div>
                    <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {cat.services.length} مسارات
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-amber-400 transition-colors">
                      {cat.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {cat.subTitle}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                    <p className="text-[11px] font-bold text-slate-400">الخدمات والأدوات المتاحة:</p>
                    {cat.services.map((srv) => (
                      <button
                        key={srv.id}
                        type="button"
                        onClick={() => handleQuickLaunch(cat.id, srv.id)}
                        className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-slate-300 hover:text-amber-300 hover:bg-slate-800/80 transition-colors text-right"
                      >
                        <span className="truncate">{srv.label}</span>
                        <ArrowLeft className="w-3 h-3 text-slate-500 group-hover:text-amber-400 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-6 mt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => handleQuickLaunch(cat.id, primaryService.id)}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-200 text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    <span>الدخول لمساحة {cat.title}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. تنبيهات وخصائص المنصة الذكية */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">تحليل فجوات الإثبات</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              مقارنة تلقائية بين ما تدعيه في اللائحة وما تثبته في المستندات والمرفقات.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">تحقق مرجعي منظم</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              تمييز المراجع المتحققة من المصادر الرسمية عن النصوص التي ما زالت تحتاج مراجعة.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
          <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">المستشار القانوني المترجم</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              شرح المصطلحات المعقدة وتوجيهك بخطوات واضحة وبسيطة لتقوية موقفك.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}