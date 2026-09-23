import React, { useState, useRef, useEffect } from 'react';
import {
  MessageSquare,
  Sparkles,
  X,
  Send,
  Minimize2,
  Maximize2,
  Trash2,
  Scale,
  Copy,
  Check,
  Building2,
  ShieldAlert,
  Bot,
  User,
} from 'lucide-react';
import { readSseTextResponse } from '../../lib/readSseTextResponse';
import { CourtJurisdiction } from '../layout/Sidebar';
import { Attachment, UserSession } from '../../types';

interface FloatingChatBotProps {
  activeCourt: CourtJurisdiction | null;
  activeService: string | null;
  userSession?: UserSession | null;
  responseMode?: 'simple' | 'professional';
  position?: 'bottom-left' | 'bottom-right';
  openSignal?: number;
  externalPrefill?: string;
  externalAttachments?: Attachment[];
}

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

async function assistantHttpError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({} as Record<string, unknown>));
  const code = typeof payload?.error === 'string' ? payload.error : '';
  const retryAfter = Number(response.headers.get('Retry-After') || 0);

  if (response.status === 401 || code === 'AUTH_REQUIRED') {
    return 'انتهت جلسة الاستخدام أو لم تصل إلى الخادم. حدّث الصفحة واختر واجهة QADA من جديد.';
  }
  if (response.status === 429) {
    return retryAfter > 0
      ? `تم بلوغ حد الاستخدام المؤقت. أعد المحاولة بعد نحو ${retryAfter} ثانية.`
      : 'تم بلوغ حد الاستخدام المؤقت. أعد المحاولة بعد قليل.';
  }
  if (response.status === 400) {
    return 'تعذر قراءة الطلب بصورته الحالية. اختصر النص أو أزل المرفق غير المدعوم ثم أعد المحاولة.';
  }
  if (code === 'RATE_LIMIT_STORE_UNAVAILABLE') {
    return 'خدمة تنظيم الطلبات غير متاحة مؤقتاً. أعد المحاولة بعد قليل.';
  }
  return `تعذر إكمال الطلب حالياً (رمز HTTP ${response.status}). لم تعتمد QADA أي نتيجة قانونية من هذه المحاولة.`;
}

export function FloatingChatBot({
  activeCourt,
  activeService,
  userSession,
  responseMode = 'simple',
  position = 'bottom-left',
  openSignal = 0,
  externalPrefill = '',
  externalAttachments = [],
}: FloatingChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: 'اكتب مشكلتك أو قل لي وش تبي أنجز لك: دعوى، اعتراض، مذكرة، رد، أو استرداد حق. سأحدد لك التوجه وأبدأ معك مباشرة.',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const getWelcomeMessage = () => {
    if (activeCourt === 'administrative') {
      return 'أهلاً بك في المسار الإداري. ما الذي حدث معك باختصار؟ اذكر القرار أو الحق الذي لم يُصرف، وتاريخ علمك به، وهل قدمت تظلماً للجهة؟ سأرتب الوقائع ثم أستخرج الأسانيد والطلبات معك خطوة بخطوة.';
    }
    if (activeCourt === 'general') {
      return 'احكِ لي المشكلة كما حصلت. إذا كانت مطالبة مالية أو حق لم يُسدّد، سأحدد لك المسار وأطلب فقط الإثباتات والبيانات اللازمة ثم نجهز المطالبة.';
    }
    if (activeCourt === 'criminal') {
      return 'أهلاً بك في المسار الجزائي. اذكر الواقعة والإجراء الذي تم بحقك، وهل يوجد قبض أو تفتيش أو تحقيق أو اعتراف؟ لا ترسل بيانات حساسة غير لازمة. سأرتب الوقائع وأحدد الدفوع والمرفقات المطلوبة قبل الصياغة.';
    }
    return 'اكتب المشكلة كما هي، أو قل لي المخرج الذي تريده: دعوى، اعتراض، مذكرة، رد، أو مطالبة. سأحدد لك التوجه الصحيح وأطلب فقط الناقص ثم أبدأ التنفيذ.';
  };

  useEffect(() => {
    setMessages((previous) => {
      const welcomeMessage = getWelcomeMessage();
      if (previous.length === 1 && previous[0].id === 'welcome-msg') {
        return [{ ...previous[0], content: welcomeMessage }];
      }
      return previous;
    });
  }, [activeCourt]);

  useEffect(() => {
    if (!openSignal) return;
    setIsOpen(true);
    setIsMinimized(false);
    if (externalPrefill.trim()) {
      setInput(externalPrefill);
    }
    if (externalAttachments.length) {
      setPendingAttachments(externalAttachments);
    }
  }, [openSignal, externalPrefill, externalAttachments]);

  // Auto scroll to bottom when messages update
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const getCourtLabel = () => {
    if (activeCourt === 'administrative') return 'المحكمة الإدارية (ديوان المظالم)';
    if (activeCourt === 'general') return 'المحكمة العامة';
    if (activeCourt === 'criminal') return 'المحكمة الجزائية';
    return 'الاستشارة القضائية العامة';
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isSending) return;

    const userText = input.trim();
    setInput('');

    const userMsg: ChatMsg = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: Date.now(),
    };

    const assistantMsgId = `ast-${Date.now()}`;
    const initialAssistantMsg: ChatMsg = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
    setIsSending(true);

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: userText, attachments: pendingAttachments },
          ],
          targetCourt: getCourtLabel(),
          responseMode,
          powerMode: true,
        }),
      });

      if (!response.ok) throw new Error(await assistantHttpError(response));

      const streamText = await readSseTextResponse(response, (nextText) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, content: nextText } : m))
        );
      });

      if (!streamText) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content:
                    'تعذر إكمال التحليل الآلي ولم يتم اعتماد أي نتيجة قانونية. أعد المحاولة، ولا تعتمد ميعاداً أو مادة نظامية قبل ظهور النص ومصدره الرسمي.',
                }
              : m
          )
        );
      }
    } catch (err) {
      console.error(err);
      const message = err instanceof Error
        ? err.message
        : 'تعذر إكمال الطلب حالياً. لم تعتمد QADA أي نتيجة قانونية من هذه المحاولة.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: message }
            : m
        )
      );
    } finally {
      setIsSending(false);
      // Keep evidence attached for follow-up questions until the user removes it explicitly.
    }
  };

  const copyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome-reset',
        role: 'assistant',
        content: `جاهز. اكتب المشكلة أو المخرج الذي تريده، وسأحدد لك التوجه وأبدأ بالتنفيذ مباشرة.`,
        timestamp: Date.now(),
      },
    ]);
  };

  const posClass =
    position === 'bottom-left'
      ? 'left-3 sm:left-6 bottom-20 sm:bottom-6'
      : 'right-3 sm:right-6 bottom-20 sm:bottom-6';

  return (
    <div className={`fixed ${posClass} z-40 flex flex-col items-start select-none font-sans`}>
      {/* 1. Open Chat Pop-up Window */}
      {isOpen && (
        <div
          className={`mb-3 w-[calc(100vw-1.5rem)] sm:w-[410px] max-w-[calc(100vw-1.5rem)] sm:max-w-[92vw] bg-neutral-900 border border-neutral-750 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 backdrop-blur-xl ${
            isMinimized ? 'h-14' : 'h-[68dvh] sm:h-[520px] max-h-[78dvh] sm:max-h-[80vh]'
          }`}
        >
          {/* Pop-up Header */}
          <div className="p-3.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between text-neutral-100">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-neutral-100 truncate">المستشار الذكي</h4>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                    عائم
                  </span>
                </div>
                <p className="text-[10px] text-neutral-400 truncate max-w-[190px]">
                  {getCourtLabel()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-neutral-400">
              <button
                type="button"
                onClick={clearChat}
                className="p-1 rounded-lg hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
                title="تفريغ المحادثة"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1 rounded-lg hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
                title={isMinimized ? 'تكبير' : 'تصغير'}
              >
                {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-neutral-800 hover:text-rose-400 transition-colors"
                title="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          {!isMinimized && (
            <>
              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto p-3 space-y-3 bg-neutral-950/70 text-xs custom-scrollbar"
              >
                {messages.map((m) => {
                  const isUser = m.role === 'user';
                  return (
                    <div
                      key={m.id}
                      className={`flex gap-2 text-right ${isUser ? 'justify-start flex-row-reverse' : 'justify-start'}`}
                    >
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-1 ${
                          isUser ? 'bg-amber-500 text-neutral-950' : 'bg-neutral-800 text-amber-400'
                        }`}
                      >
                        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                      </div>

                      <div
                        className={`group relative max-w-[82%] p-3 rounded-2xl text-neutral-200 leading-relaxed ${
                          isUser
                            ? 'bg-amber-500/20 border border-amber-500/30 text-amber-100 rounded-tr-none'
                            : 'bg-neutral-900 border border-neutral-800 rounded-tl-none'
                        }`}
                      >
                        <div className="whitespace-pre-wrap selection:bg-amber-500 selection:text-neutral-950">
                          {m.content || (
                            <span className="text-neutral-400 italic">جاري تجهيز الصياغة...</span>
                          )}
                          {!isUser && isSending && m.id === messages[messages.length - 1]?.id && (
                            <span className="mr-1 inline-block animate-pulse text-amber-400">▎</span>
                          )}
                        </div>

                        {!isUser && m.content && (
                          <div className="mt-2 pt-1 border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-400">
                            <span>مستشار أصول القضاء</span>
                            <button
                              type="button"
                              onClick={() => copyMessage(m.id, m.content)}
                              className="p-1 rounded hover:bg-neutral-800 hover:text-white transition-colors"
                              title="نسخ الإجابة"
                            >
                              {copiedId === m.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Chat Input Bar */}
              <div className="p-2.5 bg-neutral-900 border-t border-neutral-800">
                {pendingAttachments.length > 0 && (
                  <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-[10px] text-cyan-200">
                    <span>{pendingAttachments.length} مرفق جاهز للتحليل مع رسالتك</span>
                    <button type="button" onClick={() => setPendingAttachments([])} className="text-slate-400 hover:text-white">إزالة</button>
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="اكتب مشكلتك أو ما تريد إنجازه: دعوى، اعتراض، مذكرة، رد، مطالبة..."
                    disabled={isSending}
                    className="flex-1 px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:border-amber-500 outline-none placeholder:text-neutral-500 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isSending}
                    className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold transition-colors disabled:opacity-40 cursor-pointer shrink-0"
                    title="إرسال"
                  >
                    <Send className="w-4 h-4 rotate-180" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {/* 2. Floating Action Button (FAB) */}
      <button
        type="button"
        id="floating-legal-assistant-btn"
        onClick={() => {
          setIsOpen(!isOpen);
          setIsMinimized(false);
        }}
        className="group hidden sm:flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-neutral-900 hover:bg-neutral-850 border border-amber-500/40 hover:border-amber-400 text-neutral-100 shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer ring-1 ring-amber-500/20"
      >
        <div className="relative">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-neutral-950 shadow-md">
            <Sparkles className="w-4 h-4 fill-neutral-950" />
          </div>
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-neutral-900 animate-pulse" />
        </div>

        <div className="text-right">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-neutral-100 group-hover:text-amber-300 transition-colors">
              المستشار الذكي
            </span>
            <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-400 font-mono">
              AI
            </span>
          </div>
          <p className="text-[10px] text-neutral-400">اسأل في أي وقت</p>
        </div>
      </button>
    </div>
  );
}
