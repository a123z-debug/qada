import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail, Scale, ShieldCheck, UserPlus } from 'lucide-react';
import { UserSession } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
}

interface StoredUser {
  name: string;
  nationalId: string;
  email: string;
  password: string;
}

const USERS_STORAGE_KEY = 'diwan_registered_users_v1';

export const ADMIN_CREDENTIALS = {
  nationalId: '3751375135',
  name: 'مدير النظام',
  role: 'admin' as const,
  agency: 'الإدارة العامة',
  password: 'As123@456', 
  email: 'admin@diwan.gov.sa',
};

function readUsers(): StoredUser[] {
  try {
    const stored = localStorage.getItem(USERS_STORAGE_KEY);
    const users = stored ? JSON.parse(stored) : [];
    return Array.isArray(users) ? users : [];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'admin'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetError = () => setError('');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    resetError();
    setIsSubmitting(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanName = name.trim();
    const cleanNationalId = nationalId.trim().replace(/\D/g, '');

    if (mode === 'admin') {
      if (cleanNationalId !== ADMIN_CREDENTIALS.nationalId || cleanPassword !== ADMIN_CREDENTIALS.password) {
        setError('رقم الهوية أو كلمة المرور غير صحيحة.');
        setIsSubmitting(false);
        return;
      }

      onLoginSuccess({
        id: `admin-${ADMIN_CREDENTIALS.nationalId}`,
        name: ADMIN_CREDENTIALS.name,
        personName: ADMIN_CREDENTIALS.name,
        nationalId: ADMIN_CREDENTIALS.nationalId,
        email: ADMIN_CREDENTIALS.email,
        role: 'admin',
        agency: ADMIN_CREDENTIALS.agency,
        loginMethod: 'admin_password',
        loginAt: Date.now(),
      });
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('يرجى إدخال بريد إلكتروني صحيح.');
      setIsSubmitting(false);
      return;
    }

    if (cleanPassword.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف أو أرقام على الأقل.');
      setIsSubmitting(false);
      return;
    }

    const users = readUsers();

    if (mode === 'login') {
      const user = users.find((item) => item.email.toLowerCase() === cleanEmail && item.password === cleanPassword);
      if (!user) {
        setError('بيانات الدخول غير صحيحة أو الحساب غير موجود. يمكنك إنشاء حساب جديد.');
        setIsSubmitting(false);
        return;
      }

      onLoginSuccess({
        id: `user-${user.nationalId}`,
        name: user.name,
        personName: user.name,
        nationalId: user.nationalId,
        email: user.email,
        role: 'user',
        loginMethod: 'email_otp',
        loginAt: Date.now(),
      });
      return;
    }

    if (cleanName.length < 3 || cleanNationalId.length !== 10) {
      setError('يرجى إدخال الاسم ورقم الهوية المكون من 10 أرقام.');
      setIsSubmitting(false);
      return;
    }

    if (cleanNationalId === ADMIN_CREDENTIALS.nationalId) {
      setError('هذه الهوية مخصصة للحساب الإداري. استخدم مسار دخول الإدارة.');
      setIsSubmitting(false);
      return;
    }

    if (users.some((item) => item.email.toLowerCase() === cleanEmail || item.nationalId === cleanNationalId)) {
      setError('يوجد حساب مسجل بهذا البريد أو رقم الهوية. استخدم تسجيل الدخول.');
      setIsSubmitting(false);
      return;
    }

    const newUser = { name: cleanName, nationalId: cleanNationalId, email: cleanEmail, password: cleanPassword };
    saveUsers([...users, newUser]);
    onLoginSuccess({
      id: `user-${newUser.nationalId}`,
      name: newUser.name,
      personName: newUser.name,
      nationalId: newUser.nationalId,
      email: newUser.email,
      role: 'user',
      loginMethod: 'email_otp',
      loginAt: Date.now(),
    });
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
          <span>دخول آمن</span>
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
              {isAdmin ? 'أدخل رقم الهوية وكلمة المرور الإدارية.' : isRegister ? 'أنشئ حسابك لحفظ معاملاتك والعودة إليها لاحقاً.' : 'أدخل البريد الإلكتروني وكلمة المرور للمتابعة.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div>
                  <label htmlFor="register-name" className="block text-xs font-bold text-neutral-300 mb-1.5">الاسم الكامل</label>
                  <input id="register-name" value={name} onChange={(event) => { setName(event.target.value); resetError(); }} className="w-full px-4 py-3 bg-neutral-950 border border-neutral-750 rounded-xl text-sm" placeholder="اكتب الاسم الكامل" required />
                </div>
                <div>
                  <label htmlFor="register-national-id" className="block text-xs font-bold text-neutral-300 mb-1.5">رقم الهوية الوطنية</label>
                  <input id="register-national-id" value={nationalId} onChange={(event) => { setNationalId(event.target.value); resetError(); }} maxLength={10} inputMode="numeric" className="w-full px-4 py-3 bg-neutral-950 border border-neutral-750 rounded-xl text-sm font-mono text-center" placeholder="10 أرقام" required />
                </div>
              </>
            )}

            {isAdmin && (
              <div>
                <label htmlFor="admin-national-id" className="block text-xs font-bold text-neutral-300 mb-1.5">رقم الهوية الوطنية</label>
                <input id="admin-national-id" value={nationalId} onChange={(event) => { setNationalId(event.target.value); resetError(); }} maxLength={10} inputMode="numeric" className="w-full px-4 py-3 bg-neutral-950 border border-neutral-750 rounded-xl text-sm font-mono text-center" placeholder="رقم الهوية" required />
              </div>
            )}

            {!isAdmin && (
              <div>
                <label htmlFor="login-email" className="block text-xs font-bold text-neutral-300 mb-1.5">البريد الإلكتروني</label>
                <div className="relative">
                  <input id="login-email" type="email" value={email} onChange={(event) => { setEmail(event.target.value); resetError(); }} className="w-full px-4 py-3 pl-11 bg-neutral-950 border border-neutral-750 rounded-xl text-sm" placeholder="example@domain.com" required />
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="account-password" className="block text-xs font-bold text-neutral-300 mb-1.5">كلمة المرور</label>
              <div className="relative">
                <input id="account-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => { setPassword(event.target.value); resetError(); }} className="w-full px-4 py-3 pl-11 bg-neutral-950 border border-neutral-750 rounded-xl text-sm" placeholder="6 أحرف أو أرقام على الأقل" required />
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
            <button type="button" onClick={() => { setMode(isAdmin ? 'login' : 'admin'); setNationalId(''); setPassword(''); resetError(); }} className="text-neutral-400 hover:text-neutral-200 underline">
              {isAdmin ? 'العودة لدخول المستخدمين' : 'دخول مصرح للإدارة'}
            </button>
          </div>
        </div>
      </main>

      <footer className="p-4 border-t border-neutral-850 text-center text-xs text-neutral-400 relative z-10">
        <span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-emerald-400" /> دخول آمن ومقيد بالهوية</span>
      </footer>
    </div>
  );
}
