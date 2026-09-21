import React, { useMemo, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound, UserPlus } from 'lucide-react';
import type { UserSession } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
  onBack: () => void;
}

type Mode = 'user-login' | 'register' | 'admin';

const ACCOUNT_PROOFS_KEY = 'qada_account_proofs_v1';

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function readProofs(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ACCOUNT_PROOFS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveProof(email: string, proof: string) {
  const proofs = readProofs();
  proofs[normalizeEmail(email)] = proof;
  localStorage.setItem(ACCOUNT_PROOFS_KEY, JSON.stringify(proofs));
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

  const title = useMemo(() => {
    if (mode === 'register') return 'إنشاء مستخدم جديد';
    if (mode === 'admin') return 'Administration';
    return 'دخول المستخدم';
  }, [mode]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      let payload: Record<string, string>;

      if (mode === 'register') {
        payload = {
          action: 'register',
          name,
          email: normalizeEmail(email),
          password,
        };
      } else if (mode === 'admin') {
        payload = {
          action: 'admin-login',
          adminCode: adminCode.trim(),
          password,
        };
      } else {
        const normalizedEmail = normalizeEmail(email);
        const accountProof = readProofs()[normalizedEmail] || '';
        payload = {
          action: 'user-login',
          email: normalizedEmail,
          password,
          accountProof,
        };
      }

      const response = await fetch('/api/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || 'تعذر تسجيل الدخول.');
      }

      if (mode === 'register' && data?.accountProof) {
        saveProof(email, String(data.accountProof));
      }

      if (!data?.session) {
        throw new Error('لم يتم إنشاء جلسة دخول.');
      }

      onLoginSuccess(data.session as UserSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تسجيل الدخول.');
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setPassword('');
    setError('');
  }

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
          className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors"
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
                ? 'دخول الإدارة بصلاحيات المشرف.'
                : mode === 'register'
                  ? 'أنشئ حسابك باستخدام البريد الإلكتروني وكلمة المرور.'
                  : 'ادخل ببريدك الإلكتروني وكلمة المرور.'}
            </p>
          </div>

          <div className="p-2 grid grid-cols-3 gap-1 bg-slate-900/60 border-b border-white/5">
            <button
              type="button"
              onClick={() => switchMode('user-login')}
              className={`rounded-xl px-2 py-2.5 text-xs font-black transition-colors ${mode === 'user-login' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              المستخدم
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`rounded-xl px-2 py-2.5 text-xs font-black transition-colors ${mode === 'register' ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              إنشاء مستخدم
            </button>
            <button
              type="button"
              onClick={() => switchMode('admin')}
              className={`rounded-xl px-2 py-2.5 text-xs font-black transition-colors ${mode === 'admin' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              Administration
            </button>
          </div>

          <form onSubmit={submit} className="p-6 space-y-4">
            {mode === 'register' && (
              <label className="block">
                <span className="text-xs font-bold text-slate-300">اسم المستخدم</span>
                <div className="mt-2 relative">
                  <UserRound className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                    required
                    minLength={3}
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
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
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
                    onChange={(e) => setAdminCode(e.target.value)}
                    autoComplete="username"
                    required
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-3 pr-10 pl-3 text-sm outline-none focus:border-amber-400/70"
                    placeholder="Administration code"
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
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  required
                  minLength={mode === 'register' ? 8 : undefined}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/80 py-3 pr-10 pl-10 text-sm outline-none focus:border-cyan-400/70"
                  placeholder="••••••••"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-bold text-rose-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className={`w-full rounded-xl px-4 py-3.5 text-sm font-black transition-colors disabled:opacity-60 ${
                mode === 'admin'
                  ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                  : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'
              }`}
            >
              {busy
                ? 'جاري التحقق...'
                : mode === 'register'
                  ? 'إنشاء المستخدم والدخول'
                  : mode === 'admin'
                    ? 'دخول Administration'
                    : 'دخول المستخدم'}
            </button>

            {mode === 'register' && (
              <div className="flex items-start gap-2 text-[11px] leading-5 text-slate-500">
                <UserPlus className="w-4 h-4 shrink-0 mt-0.5" />
                <span>يُحفظ إثبات الحساب بصورة مشفرة في هذا المتصفح، ولا تُحفظ كلمة المرور كنص صريح.</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
