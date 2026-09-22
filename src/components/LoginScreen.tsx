import React, { useState } from 'react';
import { ArrowRight, KeyRound, LockKeyhole, Scale, ShieldCheck, Sparkles, UserRound } from 'lucide-react';
import type { UserSession } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
  onBack: () => void;
}

type WorkspaceMode = 'simple' | 'professional' | 'admin';

export function LoginScreen({ onLoginSuccess, onBack }: LoginScreenProps) {
  const [busyMode, setBusyMode] = useState<WorkspaceMode | null>(null);
  const [error, setError] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  async function openWorkspace(workspaceMode: WorkspaceMode) {
    if (busyMode) return;
    setError('');

    if (workspaceMode === 'admin') {
      setAdminOpen(true);
      return;
    }

    setBusyMode(workspaceMode);

    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-access',
          workspaceMode,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'تعذر فتح واجهة QADA.');
      }
      if (!payload?.session || payload.session.role !== 'user') {
        throw new Error('لم يتم إنشاء جلسة استخدام صالحة.');
      }

      onLoginSuccess({
        ...(payload.session as UserSession),
        workspaceMode,
      });
    } catch (workspaceError) {
      setError(workspaceError instanceof Error ? workspaceError.message : 'تعذر فتح واجهة QADA.');
    } finally {
      setBusyMode(null);
    }
  }

  async function submitAdmin(event: React.FormEvent) {
    event.preventDefault();
    if (busyMode) return;

    const code = adminCode.trim();
    if (!code || !adminPassword) {
      setError('أدخل رمز الإدارة وكلمة المرور.');
      return;
    }

    setBusyMode('admin');
    setError('');

    try {
      document.cookie = 'qada_test_mode=; Path=/; Max-Age=0; SameSite=Lax; Secure';

      const response = await fetch('/api/session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'admin-login',
          adminCode: code,
          password: adminPassword,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'تعذر تسجيل دخول الإدارة.');
      }

      if (!payload?.session || payload.session.role !== 'admin') {
        throw new Error('لم يتم إنشاء جلسة إدارة صالحة.');
      }

      onLoginSuccess({
        ...(payload.session as UserSession),
        workspaceMode: 'admin',
      });
    } catch (adminError) {
      setError(adminError instanceof Error ? adminError.message : 'تعذر تسجيل دخول الإدارة.');
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
              الواجهتان Simple وProfessional متاحتان مباشرة، بينما لوحة الإدارة محمية برمز دخول وكلمة مرور.
            </p>
            <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1.5 text-[11px] font-black text-amber-200">
              <LockKeyhole className="h-3.5 w-3.5" />
              QADA Admin محمية
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:p-7 md:grid-cols-3">
            {options.map(({ mode, title, description, icon: Icon, tone, badge }) => (
              <button
                key={mode}
                type="button"
                disabled={Boolean(busyMode)}
                onClick={() => openWorkspace(mode)}
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
                  {busyMode === mode
                    ? 'جاري التحقق...'
                    : mode === 'admin'
                      ? 'دخول محمي ←'
                      : 'فتح مباشرة ←'}
                </div>
              </button>
            ))}
          </div>

          {adminOpen && (
            <form onSubmit={submitAdmin} className="mx-5 mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 sm:mx-7 sm:mb-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10">
                  <KeyRound className="h-5 w-5 text-amber-200" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white">دخول إدارة QADA</h2>
                  <p className="mt-1 text-[11px] text-slate-400">يلزم التحقق من بيانات الإدارة قبل فتح أدوات التحكم.</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-bold text-slate-300">
                  رمز الدخول
                  <input
                    value={adminCode}
                    onChange={(event) => setAdminCode(event.target.value)}
                    autoComplete="username"
                    dir="ltr"
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-amber-300/50"
                    placeholder="Admin code"
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-bold text-slate-300">
                  كلمة المرور
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    autoComplete="current-password"
                    dir="ltr"
                    className="h-11 rounded-xl border border-white/10 bg-slate-950/80 px-3 text-sm text-white outline-none transition focus:border-amber-300/50"
                    placeholder="••••••••••••"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={Boolean(busyMode)}
                  onClick={() => {
                    setAdminOpen(false);
                    setAdminPassword('');
                    setError('');
                  }}
                  className="min-h-10 rounded-xl border border-white/10 px-4 text-xs font-black text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={Boolean(busyMode)}
                  className="min-h-10 rounded-xl border border-amber-300/20 bg-amber-400 px-5 text-xs font-black text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyMode === 'admin' ? 'جاري التحقق...' : 'دخول الإدارة'}
                </button>
              </div>
            </form>
          )}

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
