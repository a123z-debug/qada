import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  UserRound,
  WifiOff,
} from 'lucide-react';
import type { UserSession } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
  onBack: () => void;
}

type Mode = 'user-login' | 'register' | 'admin';
type ServiceState = 'checking' | 'ready' | 'degraded';

type AuthHealth = {
  ok?: boolean;
  authConfigured?: boolean;
  dataConfigured?: boolean;
  adminConfigured?: boolean;
  adminReady?: boolean;
  userReady?: boolean;
  accountStore?: string;
  sessionCookie?: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

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
  const [mode, setMode] = useState<Mode>('user-login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [serviceState, setServiceState] = useState<ServiceState>('checking');
  const [health, setHealth] = useState<AuthHealth | null>(null);
  const [retryAfter, setRetryAfter] = useState(0);

  const title = useMemo(() => {
    if (mode === 'register') return 'إنشاء مستخدم جديد';
    if (mode === 'admin') return 'دخول الإدارة';
    return 'دخول المستخدم';
  }, [mode]);

  const modeReady = mode === 'admin'
    ? health?.adminReady !== false
    : health?.userReady !== false;

  async function checkServiceHealth() {
    setServiceState('checking');
    try {
      const response = await fetchWithTimeout('/api/session?health=1', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      }, 8_000);
      const payload = await response.json().catch(() => ({})) as AuthHealth;
      setHealth(payload);
      const relevantReady = mode === 'admin' ? payload.adminReady : payload.userReady;
      setServiceState(relevantReady === false ? 'degraded' : 'ready');
    } catch {
      setHealth(null);
      setServiceState('degraded');
    }
  }

  useEffect(() => {
    void checkServiceHealth();
  }, [mode]);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const timer = window.setInterval(() => {
      setRetryAfter((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAfter > 0]);

  async function verifyCreatedSession(expectedRole: UserSession['role']) {
    for (const delay of [0, 150, 450]) {
      if (delay) await wait(delay);
      try {
        const response = await fetchWithTimeout('/api/session', {
          method: 'GET',
          credentials: 'same-origin',
          cache: 'no-store',
        }, 6_000);
        if (!response.ok) continue;
        const payload = await response.json().catch(() => ({}));
        const session = payload?.session as UserSession | undefined;
        if (payload?.authenticated && session?.role === expectedRole) return session;
      } catch {
        // Retry briefly: mobile browsers can apply Set-Cookie just after the POST completes.
      }
    }
    return null;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || retryAfter > 0) return;

    const normalized = normalizeEmail(email);
    const cleanAdminCode = adminCode.trim();

    if (mode === 'register') {
      if (name.trim().length < 3) {
        setError('اكتب اسماً من 3 أحرف على الأقل.');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        setError('اكتب بريداً إلكترونياً صحيحاً.');
        return;
      }
      if (password.length < 10) {
        setError('كلمة المرور يجب أن تكون 10 أحرف على الأقل.');
        return;
      }
    } else if (mode === 'user-login') {
      if (!normalized || !password) {
        setError('اكتب البريد الإلكتروني وكلمة المرور.');
        return;
      }
    } else if (!cleanAdminCode || !password) {
      setError('اكتب رمز الإدارة وكلمة المرور.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      let payload: Record<string, string>;
      let expectedRole: UserSession['role'];

      if (mode === 'register') {
        payload = {
          action: 'register',
          name: name.trim(),
          email: normalized,
          password,
        };
        expectedRole = 'user';
      } else if (mode === 'admin') {
        payload = {
          action: 'admin-login',
          adminCode: cleanAdminCode,
          password,
        };
        expectedRole = 'admin';
      } else {
        payload = {
          action: 'user-login',
          email: normalized,
          password,
        };
        expectedRole = 'user';
      }

      const response = await fetchWithTimeout('/api/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (response.status === 429) {
        const headerSeconds = Number(response.headers.get('Retry-After') || 0);
        const bodySeconds = Number(data?.retryAfterSeconds || 0);
        const seconds = Math.max(1, headerSeconds, bodySeconds);
        setRetryAfter(seconds);
        throw new Error(`تم إيقاف المحاولات مؤقتاً. حاول بعد ${seconds} ثانية.`);
      }

      if (!response.ok) {
        throw new Error(data?.error || 'تعذر تسجيل الدخول.');
      }

      if (!data?.session || data.session.role !== expectedRole) {
        throw new Error('استجابة تسجيل الدخول غير مكتملة.');
      }

      const verifiedSession = await verifyCreatedSession(expectedRole);
      if (!verifiedSession) {
        throw new Error('تم قبول البيانات لكن تعذر تثبيت جلسة الدخول في المتصفح. أعد تحميل الصفحة ثم حاول مرة أخرى.');
      }

      setPassword('');
      setRetryAfter(0);
      onLoginSuccess(verifiedSession);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('انتهت مهلة الاتصال بالخادم. تحقق من الشبكة ثم أعد المحاولة.');
      } else {
        setError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول.');
      }
      void checkServiceHealth();
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setPassword('');
    setShowPassword(false);
    setError('');
    setRetryAfter(0);
  }

  const statusText = serviceState === 'checking'
    ? 'جاري فحص خدمة الدخول'
    : serviceState === 'ready' && modeReady
      ? 'خدمة الدخول جاهزة'
      : mode === 'admin'
        ? 'خدمة دخول الإدارة تحتاج تحققاً'
        : 'خدمة حسابات المستخدمين تحتاج تحققاً';

  return (
    <div className="min-h-[100dvh] bg-[#020817] text-white flex items-center justify-center p-4 sm:p-6" dir="rtl">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <button
          type="button"
          onClick={onBack}
          className="mb-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          العودة للرئيسية
        </button>

        <div className="rounded-3xl border border-cyan-400/15 bg-slate-950/85 shadow-2xl backdrop-blur-xl overflow-hidden">
          <div className="px-6 pt-7 pb-5 border-b border-white/5 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 flex items-center justify-center mb-4">
              <ShieldCheck className="w-6 h-6 text-cyan-300" />
            </div>
            <h1 className="text-2xl font-black">{title}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {mode === 'admin'
                ? 'دخول مخصص للمشرف وإدارة المنصة.'
                : mode === 'register'
                  ? 'أنشئ حساباً محفوظاً على الخادم ويمكن استخدامه من أجهزتك.'
                  : 'ادخل ببريدك الإلكتروني وكلمة المرور.'}
            </p>

            <div className={`mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold ${
              serviceState === 'ready' && modeReady
                ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200'
                : serviceState === 'checking'
                  ? 'border-slate-700 bg-slate-900 text-slate-400'
                  : 'border-amber-400/20 bg-amber-400/10 text-amber-200'
            }`}>
              {serviceState === 'ready' && modeReady
                ? <CheckCircle2 className="h-3.5 w-3.5" />
                : serviceState === 'checking'
                  ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  : <WifiOff className="h-3.5 w-3.5" />}
              <span>{statusText}</span>
              {serviceState === 'degraded' && (
                <button type="button" onClick={() => void checkServiceHealth()} className="mr-1 underline underline-offset-2">
                  إعادة الفحص
                </button>
              )}
            </div>
          </div>

          <div className="p-2 grid grid-cols-3 gap-1 bg-slate-900/60 border-b border-white/5">
            <button
              type="button"
              onClick={() => switchMode('user-login')}
              className={`min-h-11 rounded-xl px-2 py-2.5 text-xs font-black transition-colors ${mode === 'user-login' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              المستخدم
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`min-h-11 rounded-xl px-2 py-2.5 text-xs font-black transition-colors ${mode === 'register' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              إنشاء مستخدم
            </button>
            <button
              type="button"
              onClick={() => switchMode('admin')}
              className={`min-h-11 rounded-xl px-2 py-2.5 text-xs font-black transition-colors ${mode === 'admin' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              الإدارة
            </button>
          </div>

          <form onSubmit={submit} className="p-6 space-y-4" noValidate>
            {mode === 'register' && (
              <label className="block">
                <span className="text-xs font-bold text-slate-300">اسم المستخدم</span>
                <div className="mt-2 relative">
                  <UserRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    required
                    minLength={3}
                    maxLength={120}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-3 pr-10 pl-3 text-sm outline-none focus:border-cyan-400/70"
                    placeholder="الاسم"
                  />
                </div>
              </label>
            )}

            {mode !== 'admin' && (
              <label className="block">
                <span className="text-xs font-bold text-slate-300">البريد الإلكتروني</span>
                <div className="mt-2 relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    inputMode="email"
                    required
                    maxLength={254}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-3 pr-10 pl-3 text-sm outline-none focus:border-cyan-400/70"
                    placeholder="name@example.com"
                    dir="ltr"
                  />
                </div>
              </label>
            )}

            {mode === 'admin' && (
              <label className="block">
                <span className="text-xs font-bold text-slate-300">رمز الإدارة</span>
                <div className="mt-2 relative">
                  <LockKeyhole className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={adminCode}
                    onChange={(event) => setAdminCode(event.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    maxLength={128}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-3 pr-10 pl-3 text-sm outline-none focus:border-amber-400/70"
                    placeholder="رمز الإدارة"
                    dir="ltr"
                  />
                </div>
              </label>
            )}

            <label className="block">
              <span className="text-xs font-bold text-slate-300">كلمة المرور</span>
              <div className="mt-2 relative">
                <LockKeyhole className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  minLength={mode === 'register' ? 10 : undefined}
                  maxLength={256}
                  className={`w-full rounded-xl border border-slate-700 bg-slate-900/80 py-3 pr-10 pl-10 text-sm outline-none ${
                    mode === 'admin' ? 'focus:border-amber-400/70' : 'focus:border-cyan-400/70'
                  }`}
                  placeholder="••••••••"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 min-h-9 min-w-9 inline-flex items-center justify-center text-slate-500 hover:text-slate-200"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            {serviceState === 'degraded' && !modeReady && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-6 text-amber-100">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-1 h-4 w-4 shrink-0" />
                  <span>
                    {mode === 'admin'
                      ? 'إعداد دخول الإدارة على الخادم يحتاج تحققاً. يمكنك المحاولة الآن، وستظهر رسالة دقيقة إذا كان الإعداد غير مكتمل.'
                      : 'خدمة الحسابات أو مخزن المستخدمين غير جاهز حالياً. يمكنك إعادة الفحص قبل المحاولة.'}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-bold leading-6 text-rose-300"
                role="alert"
                aria-live="assertive"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy || retryAfter > 0}
              className={`w-full min-h-12 rounded-xl px-4 py-3.5 text-sm font-black transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                mode === 'admin'
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
              }`}
            >
              {busy
                ? 'جاري التحقق وتثبيت الجلسة...'
                : retryAfter > 0
                  ? `إعادة المحاولة بعد ${retryAfter} ث`
                  : mode === 'register'
                    ? 'إنشاء المستخدم والدخول'
                    : mode === 'admin'
                      ? 'دخول الإدارة'
                      : 'دخول المستخدم'}
            </button>

            {mode === 'register' && (
              <div className="flex items-start gap-2 text-[11px] leading-5 text-slate-500">
                <UserPlus className="w-4 h-4 shrink-0 mt-0.5" />
                <span>الحساب محفوظ على الخادم، وكلمة المرور لا تُخزن كنص صريح.</span>
              </div>
            )}

            {mode === 'admin' && (
              <div className="text-[11px] leading-5 text-slate-500">
                يتم التحقق من بيانات الإدارة على الخادم، ثم التأكد من حفظ جلسة الدخول قبل فتح أدوات الإدارة.
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
