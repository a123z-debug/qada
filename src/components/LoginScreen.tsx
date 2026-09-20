import { useEffect, useState } from 'react';
import { Eye, EyeOff, KeyRound, LockKeyhole, Mail, Scale, ShieldCheck, UserPlus } from 'lucide-react';
import { UserSession } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
}

const ACCOUNT_PROOFS_STORAGE_KEY = 'diwan_account_proofs_v2';
const LEGACY_USERS_STORAGE_KEY = 'diwan_registered_users_v1';

function readAccountProofs(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ACCOUNT_PROOFS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveAccountProof(email: string, accountProof: string) {
  const proofs = readAccountProofs();
  proofs[email] = accountProof;
  localStorage.setItem(ACCOUNT_PROOFS_STORAGE_KEY, JSON.stringify(proofs));
}

async function readJsonError(response: Response, fallback: string) {
  try {
    const payload = await response.json();
    return typeof payload?.error === 'string' ? payload.error : fallback;
  } catch {
    return fallback;
  }
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'admin'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [adminCode, setAdminCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Remove the legacy store because older builds saved passwords as plaintext.
    localStorage.removeItem(LEGACY_USERS_STORAGE_KEY);
  }, []);

  const resetError = () => setError('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetError();
    setIsSubmitting(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;
    const cleanName = name.trim();

    try {
      if (mode === 'admin') {
        const response = await fetch('/api/admin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            action: 'admin-login',
            adminCode: adminCode.trim(),
            password: cleanPassword,
          }),
        });

        if (!response.ok) {
          setError(await readJsonError(response, 'تعذر تسجيل دخول الإدارة.'));
          return;
        }

        const payload = await response.json();
        onLoginSuccess(payload.session as UserSession);
        return;
      }

      if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
        setError('يرجى إدخال بريد إلكتروني صحيح.');
        return;
      }

      if (cleanPassword.length < 10) {
        setError('كلمة المرور يجب أن تكون 10 أحرف على الأقل.');
        return;
      }

      if (mode === 'login') {
        const accountProof = readAccountProofs()[cleanEmail];
        if (!accountProof) {
          setError('بيانات الحساب الآمنة غير موجودة في هذا المتصفح. أنشئ الحساب أولاً على هذا الجهاز.');
          return;
        }

        const response = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            action: 'login',
            email: cleanEmail,
            password: cleanPassword,
            accountProof,
          }),
        });

        if (!response.ok) {
          setError(await readJsonError(response, 'بيانات الدخول غير صحيحة.'));
          return;
        }

        const payload = await response.json();
        onLoginSuccess(payload.session as UserSession);
        return;
      }

      if (cleanName.length < 3) {
        setError('يرجى إدخال الاسم الكامل.');
        return;
      }

      if (readAccountProofs()[cleanEmail]) {
        setError('يوجد حساب محفوظ بهذا البريد في هذا المتصفح. استخدم تسجيل الدخول.');
        return;
      }

      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'register',
          name: cleanName,
          email: cleanEmail,
          password: cleanPassword,
        }),
      });

      if (!response.ok) {
        setError(await readJsonError(response, 'تعذر إنشاء الحساب.'));
        return;
      }

      const payload = await response.json();
      if (typeof payload.accountProof !== 'string' || !payload.session) {
        setError('تعذر حفظ بيانات الحساب الآمنة.');
        return;
      }

      saveAccountProof(cleanEmail, payload.accountProof);
      onLoginSuccess(payload.session as UserSession);
    } catch {
      setError('تعذر الاتصال بخدمة المصادقة. تحقق من الاتصال وحاول مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAdmin = mode === 'admin';
  const isRegister = mode === 'register';

  return (
    <div className="login-shell min-h-[100dvh] w-full bg-neutral-950 text-neutral-100 flex flex-col justify-between relative overflow-y-auto font-sans" dir="rtl">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-b from-amber-600/10 via-amber-900/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[350px] bg-emerald-600/5 blur-3xl pointer-events-none" />

      <header className="p-4 sm:p-6 flex items-center justify-between border-b border-neutral-850 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-neutral-950 flex items-center justify-center font-bold shadow-lg border border-amber-400/40">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-neutral-100">أصول القضاء</h1>
            <p className="text-[11px] text-neutral-400">منصة التدقيق والتقاضي الذكي</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-400 bg-neutral-900/80 px-3 py-1.5 rounded-xl border border-neutral-800">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>جلسة خادمية آمنة</span>
        </div>
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center p-3 sm:p-6 relative z-10">
        <div className="w-full max-w-lg bg-neutral-900/90 border border-neutral-800 rounded-3xl shadow-2xl backdrop-blur-xl p-5 sm:p-8 text-right">
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-1">
              {isAdmin ? <LockKeyhole className="w-8 h-8" /> : isRegister ? <UserPlus className="w-8 h-8" /> : <Scale className="w-8 h-8" />}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-neutral-100">
              {isAdmin ? 'دخول الإدارة' : isRegister ? 'إنشاء مستخدم جديد' : 'تسجيل الدخول'}
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-sm mx-auto">
              {isAdmin
                ? 'أدخل رمز الإدارة وكلمة المرور. لا تُخزن بيانات الإدارة في الواجهة.'
                : isRegister
                  ? 'أنشئ حسابك بالاسم والبريد الإلكتروني وكلمة المرور.'
                  : 'أدخل البريد الإلكتروني وكلمة المرور للمتابعة.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label htmlFor="register-name" className="block text-xs font-bold text-neutral-300 mb-1.5">الاسم الكامل</label>
                  <input id="register-name" value={name} onChange={(event) => { setName(event.target.value); resetError(); }} className="w-full px-4 py-3 bg-neutral-950 border border-neutral-750 rounded-xl text-sm" placeholder="اكتب الاسم الكامل" required />
                </div>

              </>
            )}

            {isAdmin && (
              <div>
                <label htmlFor="admin-code" className="block text-xs font-bold text-neutral-300 mb-1.5">رمز دخول الإدارة</label>
                <div className="relative">
                  <input id="admin-code" value={adminCode} onChange={(event) => { setAdminCode(event.target.value); resetError(); }} autoComplete="username" className="w-full px-4 py-3 pl-11 bg-neutral-950 border border-neutral-750 rounded-xl text-sm font-mono text-center" placeholder="رمز الإدارة" required />
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                </div>
              </div>
            )}

            {!isAdmin && (
              <div>
                <label htmlFor="login-email" className="block text-xs font-bold text-neutral-300 mb-1.5">البريد الإلكتروني</label>
                <div className="relative">
                  <input id="login-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); resetError(); }} autoComplete="email" className="w-full px-4 py-3 pl-11 bg-neutral-950 border border-neutral-750 rounded-xl text-sm" placeholder="example@domain.com" required />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="account-password" className="block text-xs font-bold text-neutral-300 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <input id="account-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); resetError(); }} autoComplete={isAdmin ? 'current-password' : isRegister ? 'new-password' : 'current-password'} className="w-full px-4 py-3 pl-11 bg-neutral-950 border border-neutral-750 rounded-xl text-sm" placeholder="10 أحرف على الأقل" required />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute left-1 top-1/2 -translate-y-1/2 min-h-11 min-w-11 inline-flex items-center justify-center text-neutral-400" title={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && <div className="rounded-xl border border-rose-800/60 bg-rose-950/50 px-3 py-2.5 text-xs text-rose-300">{error}</div>}

            <button type="submit" disabled={isSubmitting} className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-sm disabled:opacity-50">
              {isSubmitting ? 'جاري التحقق...' : isAdmin ? 'دخول الإدارة' : isRegister ? 'إنشاء الحساب والدخول' : 'دخول'}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3 text-xs">
            {!isAdmin && (
              <button type="button" onClick={() => { setMode(isRegister ? 'login' : 'register'); resetError(); }} className="text-amber-300 hover:text-amber-200 underline">
                {isRegister ? 'لديك حساب؟ تسجيل الدخول' : 'إنشاء مستخدم جديد'}
              </button>
            )}
            <button type="button" onClick={() => { setMode(isAdmin ? 'login' : 'admin'); setAdminCode(''); setPassword(''); resetError(); }} className="text-neutral-400 hover:text-neutral-200 underline">
              {isAdmin ? 'العودة لدخول المستخدمين' : 'دخول مصرح للإدارة'}
            </button>
          </div>
        </div>
      </main>

      <footer className="p-4 border-t border-neutral-850 text-center text-xs text-neutral-400 relative z-10">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> المصادقة والتحقق يتمان على الخادم</span>
      </footer>
    </div>
  );
}
