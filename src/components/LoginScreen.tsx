import React, { useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  KeyRound,
  LogIn,
  Mail,
  Scale,
  ShieldCheck,
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
  const [adminReady, setAdminReady] = useState<boolean | null>(null);
  const [checkingAdmin, setCheckingAdmin] = useState(false);
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

  async function checkAdminReady(): Promise<boolean> {
    setCheckingAdmin(true);
    try {
      const response = await fetch('/api/session?health=1', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const payload = await response.json().catch(() => ({}));
      const ready = Boolean(response.ok && payload?.adminReady === true);
      setAdminReady(ready);
      if (!ready) {
        setError('دخول الإدارة غير جاهز حالياً على الخادم. أعد المحاولة بعد تحديث الصفحة.');
      }
      return ready;
    } catch {
      setAdminReady(false);
      setError('تعذر التحقق من خدمة دخول الإدارة. تحقق من الاتصال ثم أعد المحاولة.');
      return false;
    } finally {
      setCheckingAdmin(false);
    }
  }

  async function openAdminLogin() {
    if (busyMode || checkingAdmin) return;
    setInterfaceMenuOpen(false);
    setError('');
    setAdminOpen(true);
    void checkAdminReady();
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
      await checkAdminReady();

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

      const verificationResponse = await fetch('/api/session', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const verificationPayload = await verificationResponse.json().catch(() => ({}));

      if (
        !verificationResponse.ok
        || verificationPayload?.authenticated !== true
        || verificationPayload?.session?.role !== 'admin'
      ) {
        throw new Error('تم قبول بيانات الإدارة لكن تعذر تثبيت جلسة الدخول. حدّث الصفحة وأعد المحاولة.');
      }

      setAdminPassword('');
      setError('');
      onLoginSuccess({
        ...(verificationPayload.session as UserSession),
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
    <div
      className={`qada-login-shell ${adminOpen ? 'qada-admin-auth-shell' : 'qada-user-auth-shell'} min-h-[100dvh] bg-[#f7f8fa] px-4 py-[max(1rem,env(safe-area-inset-top))] text-slate-950 sm:px-6`}
      dir="rtl"
    >
      <div className="qada-login-architecture" aria-hidden="true">
        <span className="qada-login-tower"><span /></span>
        <span className="qada-login-wave qada-login-wave-a" />
        <span className="qada-login-wave qada-login-wave-b" />
      </div>
      <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-[440px] flex-col justify-center">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex min-h-11 w-fit items-center gap-2 rounded-xl px-2 text-sm font-bold text-slate-500 transition hover:bg-white hover:text-slate-900"
        >
          <ArrowRight className="h-4 w-4" />
          الرئيسية
        </button>

        <div className={`qada-login-card ${adminOpen ? 'qada-admin-login-card' : 'qada-user-login-card'} overflow-visible rounded-[28px] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]`}>
          <div className="px-5 pb-5 pt-7 text-center sm:px-7 sm:pt-8">
            <div className="qada-brand-emblem mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
              <Scale className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">أصول القضاء</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
              ادخل إلى حسابك واحكِ اللي صار. ما تحتاج تعرف اسم المحكمة أو النظام قبل ما تبدأ.
            </p>
          </div>

          {!adminOpen && (
            <div className="px-5 pb-6 sm:px-7 sm:pb-7">
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => changeAuthMode('login')}
                  className={`min-h-11 rounded-xl px-3 text-sm font-black transition ${
                    authMode === 'login'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  دخول
                </button>
                <button
                  type="button"
                  onClick={() => changeAuthMode('register')}
                  className={`min-h-11 rounded-xl px-3 text-sm font-black transition ${
                    authMode === 'register'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  حساب جديد
                </button>
              </div>

              <form onSubmit={submitUser} className="space-y-4">
                {authMode === 'register' && (
                  <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                    الاسم
                    <div className="relative">
                      <UserRound className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        autoComplete="name"
                        className="h-12 w-full rounded-2xl border border-slate-200 bg-[#fafbfc] pr-11 pl-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                        placeholder="الاسم الكامل"
                      />
                    </div>
                  </label>
                )}

                <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                  البريد الإلكتروني
                  <div className="relative">
                    <Mail className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      autoComplete="email"
                      autoCapitalize="none"
                      inputMode="email"
                      dir="ltr"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-[#fafbfc] pr-11 pl-4 text-left text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                      placeholder="name@example.com"
                    />
                  </div>
                </label>

                <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                  كلمة المرور
                  <div className="relative">
                    <KeyRound className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                      dir="ltr"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-[#fafbfc] pr-11 pl-4 text-left text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                      placeholder="••••••••••••"
                    />
                  </div>
                </label>

                {authMode === 'register' && (
                  <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                    تأكيد كلمة المرور
                    <input
                      type="password"
                      value={passwordConfirm}
                      onChange={(event) => setPasswordConfirm(event.target.value)}
                      autoComplete="new-password"
                      dir="ltr"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-[#fafbfc] px-4 text-left text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                      placeholder="••••••••••••"
                    />
                  </label>
                )}

                {authMode === 'register' && (
                  <p className="text-[11px] leading-5 text-slate-500">
                    كلمة المرور لا تقل عن 10 أحرف.
                  </p>
                )}

                <button
                  type="submit"
                  disabled={Boolean(busyMode)}
                  className="qada-primary-action inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {authMode === 'register' ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                  {busyMode === 'user'
                    ? 'جاري الدخول...'
                    : authMode === 'register'
                      ? 'إنشاء الحساب'
                      : 'دخول لحسابي'}
                </button>
              </form>

              <div className="relative mt-5 border-t border-slate-100 pt-4 text-center">
                <button
                  type="button"
                  onClick={() => setInterfaceMenuOpen((open) => !open)}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
                  aria-expanded={interfaceMenuOpen}
                  aria-haspopup="menu"
                >
                  خيارات أخرى
                  <ChevronDown className={`h-3.5 w-3.5 transition ${
                    interfaceMenuOpen ? 'rotate-180' : ''
                  }`} />
                </button>

                {interfaceMenuOpen && (
                  <div
                    role="menu"
                    className="absolute bottom-14 left-1/2 z-30 w-52 -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-1.5 text-right shadow-xl"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void openAdminLogin()}
                      className="flex min-h-10 w-full items-center justify-between rounded-xl px-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                    >
                      <span>إدارة QADA</span>
                      <ShieldCheck className="h-4 w-4 text-slate-400" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {adminOpen && (
            <form onSubmit={submitAdmin} className="border-t border-slate-100 px-5 pb-6 pt-5 sm:px-7 sm:pb-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-950">دخول إدارة QADA</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {checkingAdmin
                      ? 'جاري فحص خدمة الإدارة...'
                      : adminReady
                        ? 'خدمة الإدارة جاهزة.'
                        : 'للمشرفين فقط.'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                  رمز الدخول
                  <input
                    value={adminCode}
                    onChange={(event) => setAdminCode(event.target.value)}
                    autoComplete="username"
                    dir="ltr"
                    className="h-12 rounded-2xl border border-slate-200 bg-[#fafbfc] px-4 text-base text-slate-950 outline-none focus:border-slate-400 focus:bg-white"
                    placeholder="Admin code"
                  />
                </label>

                <label className="grid gap-1.5 text-xs font-bold text-slate-700">
                  كلمة المرور
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                    autoComplete="current-password"
                    dir="ltr"
                    className="h-12 rounded-2xl border border-slate-200 bg-[#fafbfc] px-4 text-base text-slate-950 outline-none focus:border-slate-400 focus:bg-white"
                    placeholder="••••••••••••"
                  />
                </label>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={Boolean(busyMode)}
                  onClick={() => {
                    setAdminOpen(false);
                    setAdminPassword('');
                    setError('');
                  }}
                  className="min-h-12 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  رجوع
                </button>
                <button
                  type="submit"
                  disabled={Boolean(busyMode) || checkingAdmin || adminReady === false}
                  className="min-h-12 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyMode === 'admin'
                    ? 'جاري الدخول...'
                    : checkingAdmin
                      ? 'جاري الفحص...'
                      : 'دخول الإدارة'}
                </button>
              </div>
            </form>
          )}

          {error && (
            <div className="mx-5 mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold leading-6 text-rose-700 sm:mx-7 sm:mb-7">
              {error}
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] leading-5 text-slate-400">
          واجهة بسيطة للجوال والكمبيوتر، ومصطلحات القانون تظهر فقط عندما تحتاجها.
        </p>
      </div>
    </div>
  );
}
