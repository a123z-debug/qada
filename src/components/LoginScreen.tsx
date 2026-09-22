import React, { useState } from 'react';
import { ArrowRight, Scale, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import type { UserSession } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
  onBack: () => void;
}

type WorkspaceMode = 'simple' | 'professional' | 'admin';

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

export function LoginScreen({ onLoginSuccess, onBack }: LoginScreenProps) {
  const [busyMode, setBusyMode] = useState<WorkspaceMode | null>(null);
  const [error, setError] = useState('');

  async function openWorkspace(workspaceMode: WorkspaceMode) {
    if (busyMode) return;
    setBusyMode(workspaceMode);
    setError('');

    try {
      const response = await fetchWithTimeout('/api/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-access',
          workspaceMode,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.session) {
        throw new Error(data?.error || 'تعذر فتح الواجهة.');
      }

      const verification = await fetchWithTimeout('/api/session', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      }, 7_000);
      const verified = await verification.json().catch(() => ({}));
      const session = verified?.session as UserSession | undefined;

      if (!verification.ok || !verified?.authenticated || !session) {
        throw new Error('تم إنشاء الجلسة لكن تعذر تثبيتها في المتصفح.');
      }
      if (session.workspaceMode !== workspaceMode) {
        throw new Error('نوع الواجهة في الجلسة لا يطابق الاختيار.');
      }

      onLoginSuccess(session);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('انتهت مهلة الاتصال بالخادم. أعد المحاولة.');
      } else {
        setError(err instanceof Error ? err.message : 'تعذر فتح الواجهة.');
      }
    } finally {
      setBusyMode(null);
    }
  }

  const options: Array<{
    mode: WorkspaceMode;
    title: string;
    description: string;
    icon: React.ElementType;
    tone: string;
    badge: string;
  }> = [
    {
      mode: 'simple',
      title: 'المستخدم البسيط',
      description: 'اكتب مشكلتك أو ما تريد إنجازه، وQADA يقودك من البداية إلى النتيجة بدون تفاصيل تقنية معقدة.',
      icon: UserRound,
      tone: 'border-cyan-400/25 bg-cyan-400/8 hover:border-cyan-300/55',
      badge: 'QADA Simple',
    },
    {
      mode: 'professional',
      title: 'المستخدم المتقدم',
      description: 'واجهة احترافية تعرض الاختصاصات والأدوات والمراجع والتحليل التفصيلي والتحكم في مسار القضية.',
      icon: Scale,
      tone: 'border-violet-400/25 bg-violet-400/8 hover:border-violet-300/55',
      badge: 'QADA Professional',
    },
    {
      mode: 'admin',
      title: 'الإدارة',
      description: 'لوحة إدارة المنصة والوكلاء والمستخدمين والسجلات والمصادر ومراقبة التشغيل.',
      icon: ShieldCheck,
      tone: 'border-amber-400/25 bg-amber-400/8 hover:border-amber-300/55',
      badge: 'QADA Admin',
    },
  ];

  return (
    <div className="min-h-[100dvh] bg-[#020817] text-white flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-3xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-400 transition-colors hover:text-white"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للرئيسية
        </button>

        <div className="overflow-hidden rounded-3xl border border-cyan-400/15 bg-slate-950/90 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/5 px-6 py-7 text-center sm:px-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
              <Sparkles className="h-6 w-6 text-cyan-300" />
            </div>
            <h1 className="text-2xl font-black sm:text-3xl">اختر واجهة QADA</h1>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-400">
              نسخة الاختبار الحالية مفتوحة بدون كلمات مرور. اختر نوع الواجهة التي تريد تجربتها الآن.
            </p>
            <div className="mx-auto mt-4 inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[11px] font-black text-amber-200">
              وضع اختبار مؤقت — الحماية ستعاد قبل النشر العام
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:p-7 md:grid-cols-3">
            {options.map(({ mode, title, description, icon: Icon, tone, badge }) => (
              <button
                key={mode}
                type="button"
                disabled={Boolean(busyMode)}
                onClick={() => void openWorkspace(mode)}
                className={`group min-h-[220px] rounded-2xl border p-5 text-right transition-all disabled:cursor-not-allowed disabled:opacity-60 ${tone}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <span className="rounded-full border border-white/10 bg-slate-950/70 px-2.5 py-1 text-[9px] font-black text-slate-400">
                    {badge}
                  </span>
                </div>
                <h2 className="mt-5 text-lg font-black text-white">{title}</h2>
                <p className="mt-2 text-xs leading-6 text-slate-400">{description}</p>
                <div className="mt-5 text-xs font-black text-cyan-200">
                  {busyMode === mode ? 'جاري فتح الواجهة...' : 'فتح مباشرة ←'}
                </div>
              </button>
            ))}
          </div>

          {error && (
            <div className="mx-5 mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold leading-6 text-rose-200 sm:mx-7 sm:mb-7">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
