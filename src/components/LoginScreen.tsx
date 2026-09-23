import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  KeyRound,
  LogIn,
  Mail,
  ShieldCheck,
  Sparkles,
  UserPlus,
  UserRound,
} from 'lucide-react';
import type { UserSession } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
  onBack: () => void;
}

type AuthMode = 'login' | 'register';
type BusyMode = 'user' | 'admin' | null;

export function LoginScreen({ onLoginSuccess, onBack }: LoginScreenProps) {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [busyMode, setBusyMode] = useState<BusyMode>(null);
  const [error, setError] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const [interfaceMenuOpen, setInterfaceMenuOpen] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');

  const [adminCode, setAdminCode] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  async function submitUser(event: React.FormEvent) {
    event.preventDefault();
    if (busyMode) return;

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();

    if (!normalizedEmail || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور.');
      return;
    }

    if (authMode === 'register') {
      if (normalizedName.length < 3) {
        setError('أدخل اسماً لا يقل عن 3 أحرف.');
        return;
      }
      if (password.length < 10) {
        setError('كلمة المرور يجب ألا تقل عن 10 أحرف.');
        return;
      }
      if (password !== passwordConfirm) {
        setError('تأكيد كلمة المرور غير مطابق.');
        return;
      }
    }

    setBusyMode('user');
    setError('');

    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: authMode === 'register' ? 'register' : 'user-login',
          ...(authMode === 'register' ? { name: normalizedName } : {}),
          email: normalizedEmail,
          password,
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : 'تعذر إكمال تسجيل الدخول.');
      }

      if (!payload?.session || payload.session.role !== 'user') {
        throw new Error('لم يتم إنشاء جلسة مستخدم صالحة.');
      }

      onLoginSuccess({
        ...(payload.session as UserSession),
        workspaceMode: 'simple',
      });
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'تعذر إكمال تسجيل الدخول.');
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
        cache: 'no-store',
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

  function changeAuthMode(next: AuthMode) {
    setAuthMode(next);
    setError('');
    setPassword('');
    setPasswordConfirm('');
  }

  return (
    <div className="min-h-[100dvh] bg-[#020817] text-white flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-400 transition-colors hover:text-white"
        >
          <ArrowRight className="h-4 w-4" />
          العودة للرئيسية
        </button>

        <div className="overflow-visible rounded-3xl border border-cyan-400/15 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
          <div className="border-b border-white/5 px-6 py-7 text-center sm:px-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/10">
              <Sparkles className="h-6 w-6 text-cyan-300" />
            </div>

            <div className="relative mx-auto w-fit">
              <button
                type="button"
                onClick={() => setInterfaceMenuOpen((open) => !open)}
                className="group inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-2xl font-black transition hover:bg-white/[0.03] sm:text-3xl"
                aria-expanded={interfaceMenuOpen}
                aria-haspopup="menu"
              >
                <span>اختر واجهة QADA</span>
                <ChevronDown
                  className={`h-4 w-4 text-slate-700 transition-transform group-hover:text-slate-500 ${interfaceMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {interfaceMenuOpen && (
                <div
                  role="menu"
                  className="absolute left-1/2 top-full z-30 mt-2 w-56 -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-slate-950 p-1.5 text-right shadow-2xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setInterfaceMenuOpen(false);
                      setAdminOpen(true);
                      setError('');
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[11px] font-bold text-slate-600 transition hover:bg-amber-400/10 hover:text-amber-200"
                  >
                    <span>إدارة QADA</span>
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-400">
              حساب واحد ومساحة عمل واحدة. بعد الدخول يمكنك التبديل فوراً بين الواجهة البسيطة والمتقدمة دون فقد القضية أو المحادثة.
            </p>
          </div>

          {!adminOpen && (
            <div className="p-5 sm:p-7">
              <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-slate-900/70 p-1.5">
                <button
                  type="button"
                  onClick={() => changeAuthMode('login')}
                  className={`min-h-10 rounded-xl px-3 text-xs font-black transition ${authMode === 'login' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => changeAuthMode('register')}
                  className={`min-h-10 rounded-xl px-3 text-xs font-black transition ${authMode === 'register' ? 'bg-violet-400 text-slate-950' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                >
                  إنشاء مستخدم جديد
                </button>
              </div>

              <form onSubmit={submitUser} className="space-y-4">
                {authMode === 'register' && (
                  <label className="grid gap-1.5 text-xs font-bold text-slate-300">
                    الاسم
                    <div className="relative">
                      <UserRound className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        autoComplete="name"
                        className="h-12 w-full rounded-xl border border-white/10 bg-slate-950/80 pr-10 pl-3 text-sm text-white outline-none transition focus:border-violet-300/50"
                        placeholder="الاسم الكامل"
                      />
                    </div>
                  </label>
                )}

                <label className="grid gap-1.5 text-xs font-bold text-slate-300">
                  البريد الإلكتروني
                  <div className="relative">
                    <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      dir="ltr"
                      className="h-12 w-full rounded-xl border border-white/10 bg-slate-950/80 pr-10 pl-3 text-left text-sm text-white outline-none transition focus:border-cyan-300/50"
                      placeholder="name@example.com"
                    />
                  </div>
                </label>

                <label className="grid gap-1.5 text-xs font-bold text-slate-300">
                  كلمة المرور
                  <div className="relative">
                    <KeyRound className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                      dir="ltr"
                      className="h-12 w-full rounded-xl border border-white/10 bg-slate-950/80 pr-10 pl-3 text-left text-sm text-white outline-none transition focus:border-cyan-300/50"
                      placeholder="••••••••••••"
                    />
                  </div>
                </label>

                {authMode === 'register' && (
                  <label className="grid gap-1.5 text-xs font-bold text-slate-300">
                    تأكيد كلمة المرور
                    <input
                      type="password"
                      value={passwordConfirm}
                      onChange={(event) => setPasswordConfirm(event.target.value)}
                      autoComplete="new-password"
                      dir="ltr"
                      className="h-12 w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 text-left text-sm text-white outline-none transition focus:border-violet-300/50"
                      placeholder="••••••••••••"
                    />
                  </label>
                )}

                {authMode === 'register' && (
                  <p className="text-[11px] leading-5 text-slate-500">
                    كلمة المرور لا تقل عن 10 أحرف. بيانات الحساب تُحفظ في مخزن الخادم ولا تُخزن كلمة المرور كنص صريح.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={Boolean(busyMode)}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {authMode === 'register' ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                  {busyMode === 'user'
                    ? 'جاري التحقق...'
                    : authMode === 'register'
                      ? 'إنشاء الحساب والدخول'
                      : 'دخول إلى QADA'}
                </button>
              </form>
            </div>
          )}

          {adminOpen && (
            <form onSubmit={submitAdmin} className="m-5 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 sm:m-7">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10">
                  <ShieldCheck className="h-5 w-5 text-amber-200" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white">دخول إدارة QADA</h2>
                  <p className="mt-1 text-[11px] text-slate-400">هذه الواجهة لا تظهر في الدخول العادي.</p>
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
                  رجوع
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
