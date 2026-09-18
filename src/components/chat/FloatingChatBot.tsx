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
import { CourtJurisdiction } from '../layout/Sidebar';
import { UserSession } from '../../types';

interface FloatingChatBotProps {
  activeCourt: CourtJurisdiction | null;
  activeService: string | null;
  userSession?: UserSession | null;
  position?: 'bottom-left' | 'bottom-right';
}

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function FloatingChatBot({
  activeCourt,
  activeService,
  userSession,
  position = 'bottom-left',
}: FloatingChatBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: 'أهلاً بك! أنا مستشارك القضائي الذكي المرافق لك في مساحة العمل. يمكنك سؤالي في أي وقت عن المواد النظامية، صيغ الدفوع، أو مواعيد التظلم والاستئناف دون إغلاق صفحتك.',
      timestamp: Date.now(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const getWelcomeMessage = () => {
    if (activeCourt === 'administrative') {
      return 'أهلاً بك في المسار الإداري. ما الذي حدث معك باختصار؟ اذكر القرار أو الحق الذي لم يُصرف، وتاريخ علمك به، وهل قدمت تظلماً للجهة؟ سأرتب الوقائع ثم أستخرج الأسانيد والطلبات معك خطوة بخطوة.';
    }
    if (activeCourt === 'general') {
      return 'أهلاً بك في المسار العام. احكِ لي ما حدث باختصار: ما العلاقة أو العقد بين الأطراف، وما الالتزام الذي لم يُنفذ، وما طلبك من المحكمة؟ سأحوّل الوقائع إلى موضوع دعوى وأسانيد وطلبات قابلة للمراجعة.';
    }
    if (activeCourt === 'criminal') {
      return 'أهلاً بك في المسار الجزائي. اذكر الواقعة والإجراء الذي تم بحقك، وهل يوجد قبض أو تفتيش أو تحقيق أو اعتراف؟ لا ترسل بيانات حساسة غير لازمة. سأرتب الوقائع وأحدد الدفوع والمرفقات المطلوبة قبل الصياغة.';
    }
    return 'أهلاً بك في أصول القضاء. ما قصتك أو طلبك باختصار؟ اختر المسار الإداري أو العام أو الجزائي، وسأطرح عليك الأسئلة المهمة ثم أحوّل إجاباتك إلى موضوع وأسانيد وطلبات ومذكرة قابلة للمراجعة.';
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
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: 'user', content: userText },
          ],
          targetCourt: getCourtLabel(),
          clientNationalId: userSession?.nationalId,
          clientPersonName: userSession?.name,
          powerMode: true,
        }),
      });

      if (!response.ok) throw new Error('فشل إرسال الرسالة');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let streamText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') continue;
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.text) {
                  streamText += parsed.text;
                  setMessages((prev) =>
                    prev.map((m) => (m.id === assistantMsgId ? { ...m, content: streamText } : m))
                  );
                }
              } catch {
                streamText += dataStr;
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantMsgId ? { ...m, content: streamText } : m))
                );
              }
            }
          }
        }
      }

      if (!streamText) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content:
                    'وفقاً للأنظمة القضائية في المملكة العربية السعودية، يجب دائماً التحقق من الاختصاص النوعي والولائي، ومراعاة مهل الاستئناف والتظلم النظامية (60 يوماً للتظلم الوجوبي ومثلها لإيداع الدعوى الإدارية، و30 يوماً للاستئناف العام والجزائي).',
                }
              : m
          )
        );
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content:
                  'عذراً، حدث خطأ مؤقت أثناء المعالجة القضائية. يرجى إعادة المحاولة.',
              }
            : m
        )
      );
    } finally {
      setIsSending(false);
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
        content: `تم تهيئة جلسة الاستشارة القضائية للبؤرة: ${getCourtLabel()}. تفضل بطرح أي استفسار أو طلب صيغة دفع.`,
        timestamp: Date.now(),
      },
    ]);
  };

  const posClass =
    position === 'bottom-left'
      ? 'left-4 sm:left-6 bottom-4 sm:bottom-6'
      : 'right-4 sm:right-6 bottom-4 sm:bottom-6';

  return (
    <div className={`fixed ${posClass} z-40 flex flex-col items-start select-none font-sans`}>
      {/* 1. Open Chat Pop-up Window */}
      {isOpen && (
        <div
          className={`mb-3 w-[360px] sm:w-[410px] max-w-[92vw] bg-neutral-900 border border-neutral-750 rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-200 backdrop-blur-xl ${
            isMinimized ? 'h-14' : 'h-[520px] max-h-[80vh]'
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
                            <span className="text-neutral-400 italic">جاري التفكير القانوني...</span>
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
                    placeholder="اكتب استفسارك النظامي هنا..."
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
        className="group flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-neutral-900 hover:bg-neutral-850 border border-amber-500/40 hover:border-amber-400 text-neutral-100 shadow-2xl transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer ring-1 ring-amber-500/20"
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
