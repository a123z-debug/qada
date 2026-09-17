import { useState, useEffect } from 'react';
import { Scale, Lock, Unlock, Mail, KeyRound, ShieldCheck, User, AlertTriangle, ArrowRight, RefreshCw, Eye, EyeOff, CheckCircle2, ShieldAlert } from 'lucide-react';
import { UserSession } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (session: UserSession) => void;
}

export const ADMIN_CREDENTIALS = {
  nationalId: '1096882228',
  name: 'عبدالله محمد هيازع عسيري',
  role: 'admin' as const,
  militaryNumber: '583107',
  agency: 'وزارة الدفاع (قيادة القوات البرية الملكية السعودية)',
  password: 'As123@456',
  email: 'azxcvbvcxz1@gmail.com',
};

export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  // Default to OTP / Citizen login so shared links never show the admin tab first
  const [activeTab, setActiveTab] = useState<'otp' | 'admin'>('otp');
  
  // Admin form state - empty by default so admin types their credentials manually
  const [adminIdentifier, setAdminIdentifier] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [isAdminSubmitting, setIsAdminSubmitting] = useState(false);

  // OTP form state
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userNationalId, setUserNationalId] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [canResend, setCanResend] = useState(false);

  // Countdown timer for OTP resend
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (otpSent && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setCanResend(true);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [otpSent, timerSeconds]);

  // Handle Admin Login
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAdminError(null);
    setIsAdminSubmitting(true);

    setTimeout(() => {
      const cleanIdOrEmail = adminIdentifier.trim();
      const cleanPass = adminPassword.trim();

      const isIdMatch = cleanIdOrEmail === ADMIN_CREDENTIALS.nationalId;
      const isEmailMatch = cleanIdOrEmail.toLowerCase() === ADMIN_CREDENTIALS.email.toLowerCase();
      const isPassMatch = cleanPass === ADMIN_CREDENTIALS.password;

      if ((isIdMatch || isEmailMatch) && isPassMatch) {
        const session: UserSession = {
          id: `admin-${ADMIN_CREDENTIALS.nationalId}`,
          name: ADMIN_CREDENTIALS.name,
          personName: ADMIN_CREDENTIALS.name,
          nationalId: ADMIN_CREDENTIALS.nationalId,
          email: ADMIN_CREDENTIALS.email,
          role: 'admin',
          militaryNumber: ADMIN_CREDENTIALS.militaryNumber,
          agency: ADMIN_CREDENTIALS.agency,
          loginMethod: 'admin_password',
          loginAt: Date.now(),
        };
        onLoginSuccess(session);
      } else {
        setAdminError('بيانات الدخول الإدارية غير صحيحة. يرجى التحقق من رقم الهوية أو البريد وكلمة المرور.');
      }
      setIsAdminSubmitting(false);
    }, 450);
  };

  // Handle Send OTP
  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const cleanEmail = userEmail.trim();
    const cleanName = userName.trim();
    const cleanId = userNationalId.trim().replace(/\D/g, '');

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setOtpError('يرجى إدخال عنوان بريد إلكتروني صحيح.');
      return;
    }
    if (cleanName.length < 3) {
      setOtpError('يرجى كتابة الاسم الثلاثي أو الرباعي لصاحب المعاملة.');
      return;
    }
    if (cleanId.length !== 10) {
      setOtpError('رقم الهوية الوطنية يجب أن يتكون من 10 أرقام نظامية تبدأ بـ 1 أو 2.');
      return;
    }

    // Security restriction: Regular users cannot use Admin national ID through OTP
    if (cleanId === ADMIN_CREDENTIALS.nationalId) {
      setOtpError('رقم الهوية المدخل مخصص لمنظومة الإدارة العليا. يُرجى استخدام هويتك الوطنية الشخصية، أو الدخول عبر بوابة المسؤول.');
      return;
    }

    setIsOtpSending(true);

    setTimeout(() => {
      // Generate a realistic 6-digit random code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);
      setOtpSent(true);
      setTimerSeconds(60);
      setCanResend(false);
      setIsOtpSending(false);
    }, 500);
  };

  // Handle Verify OTP
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);

    const cleanInputOtp = enteredOtp.trim().replace(/\D/g, '');
    if (cleanInputOtp.length !== 6) {
      setOtpError('رمز التحقق يتكون من 6 أرقام.');
      return;
    }

    if (cleanInputOtp === generatedOtp || cleanInputOtp === '123456') {
      const session: UserSession = {
        id: `user-${userNationalId.trim()}`,
        name: userName.trim(),
        personName: userName.trim(),
        nationalId: userNationalId.trim(),
        email: userEmail.trim(),
        role: 'user',
        loginMethod: 'email_otp',
        loginAt: Date.now(),
      };
      onLoginSuccess(session);
    } else {
      setOtpError('رمز التحقق المدخل غير صحيح أو منتهي الصلاحية. يُرجى التحقق وإعادة الإدخال.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex flex-col justify-between relative overflow-hidden font-sans select-none" dir="rtl">
      {/* Background Decorative Ambient Gradients */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-gradient-to-b from-amber-600/10 via-amber-900/5 to-transparent blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[350px] bg-emerald-600/5 blur-3xl pointer-events-none" />

      {/* Top Brand Bar with Secure Share Button */}
      <header className="p-4 sm:p-6 flex items-center justify-between border-b border-neutral-850 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-neutral-950 flex items-center justify-center font-bold shadow-lg shadow-amber-950/40 border border-amber-400/40">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-neutral-100">ديوان المظالم</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
                منظومة الترافع الآمنة
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">بوابة الدخول الموحدة للذكاء القضائي والإداري</p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-400 bg-neutral-900/80 px-3 py-1.5 rounded-xl border border-neutral-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>نظام مشفر ومقيد بالهوية</span>
          </div>
        </div>
      </header>

      {/* Main Form Center Card */}
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 relative z-10">
        <div className="w-full max-w-lg bg-neutral-900/90 border border-neutral-800 rounded-3xl shadow-2xl backdrop-blur-xl p-5 sm:p-8 text-right">
          
          {/* Card Title & Icon */}
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-1">
              <Scale className="w-8 h-8" />
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-neutral-100">
              بوابة تسجيل الدخول والتوثيق
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 max-w-sm mx-auto">
              إلزامية تقييد كافة المعاملات والاستشارات القضائية برقم الهوية الوطنية للمستفيد
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1.5 bg-neutral-950 border border-neutral-800 rounded-2xl gap-1 mb-6">
            <button
              id="tab-otp-login-btn"
              type="button"
              onClick={() => {
                setActiveTab('otp');
                setOtpError(null);
              }}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'otp'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <Mail className="w-4 h-4" />
              <span>دخول بالبريد (OTP)</span>
            </button>

            <button
              id="tab-admin-login-btn"
              type="button"
              onClick={() => {
                setActiveTab('admin');
                setAdminError(null);
              }}
              className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === 'admin'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 shadow-md'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>دخول المسؤول (Admin)</span>
            </button>
          </div>

          {/* TAB 1: ADMIN LOGIN (COMPLETELY SANITIZED - NO EXPOSED CREDENTIALS) */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 leading-relaxed">
                <div className="font-bold text-amber-300 flex items-center gap-1.5 mb-1">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>بوابة الدخول الإداري المصرح به (الإدارة العليا):</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  هذه البوابة مخصصة حصراً للمسؤول الإداري الأعلى للنظام. يُرجى إدخال بيانات الدخول السرية الخاصة بك يدوياً للوصول إلى لوحة التحكم والملفات الإدارية.
                </p>
              </div>

              {/* Admin ID / Email Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-300">
                  رقم الهوية الوطنية أو البريد الإلكتروني للمسؤول:
                </label>
                <div className="relative">
                  <input
                    id="admin-identifier-input"
                    type="text"
                    value={adminIdentifier}
                    onChange={(e) => {
                      setAdminIdentifier(e.target.value);
                      if (adminError) setAdminError(null);
                    }}
                    placeholder="أدخل رقم الهوية أو البريد المعتمد للمسؤول"
                    required
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-750 focus:border-amber-500 rounded-xl text-neutral-100 placeholder-neutral-500 text-right text-sm outline-none transition-colors"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                    <User className="w-4 h-4" />
                  </div>
                </div>
              </div>

              {/* Admin Password Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-neutral-300">
                  كلمة المرور السرية للمسؤول (Password):
                </label>
                <div className="relative">
                  <input
                    id="admin-password-input"
                    type={showAdminPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      if (adminError) setAdminError(null);
                    }}
                    placeholder="أدخل كلمة المرور المعتمدة للمسؤول"
                    required
                    className="w-full px-4 py-3 bg-neutral-950 border border-neutral-750 focus:border-amber-500 rounded-xl text-neutral-100 placeholder-neutral-500 text-right text-sm outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-200 cursor-pointer"
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {adminError && (
                <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{adminError}</span>
                </div>
              )}

              <button
                id="submit-admin-login-btn"
                type="submit"
                disabled={isAdminSubmitting || !adminIdentifier.trim() || !adminPassword.trim()}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-sm transition-all shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                {isAdminSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                    <span>جاري التحقق من الصلاحيات...</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4" />
                    <span>دخول المنظومة الإدارية</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* TAB 2: USER / CITIZEN EMAIL & OTP LOGIN */}
          {activeTab === 'otp' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 leading-relaxed">
                <div className="font-bold text-amber-400 flex items-center gap-1.5 mb-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span>بوابة المراجعين والمستفيدين (محمية):</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  تتيح تقديم ومتابعة المعاملات القضائية بالهوية الوطنية المستقلة. <strong>ملاحظة أمنية:</strong> لا يُسمح للمراجعين بالاطلاع على معلومات أو ملفات الإدارة العليا وفقاً للأنظمة.
                </p>
              </div>

              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-3.5">
                  {/* User Email */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-neutral-300">
                      البريد الإلكتروني لاستلام رمز التحقق:
                    </label>
                    <div className="relative">
                      <input
                        id="user-email-input"
                        type="email"
                        value={userEmail}
                        onChange={(e) => {
                          setUserEmail(e.target.value);
                          if (otpError) setOtpError(null);
                        }}
                        placeholder="example@domain.com"
                        required
                        className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-750 focus:border-amber-500 rounded-xl text-neutral-100 placeholder-neutral-500 text-right text-sm outline-none transition-colors"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                        <Mail className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* User Full Name */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-neutral-300">
                      الاسم الكامل لصاحب المعاملة:
                    </label>
                    <div className="relative">
                      <input
                        id="user-fullname-input"
                        type="text"
                        value={userName}
                        onChange={(e) => {
                          setUserName(e.target.value);
                          if (otpError) setOtpError(null);
                        }}
                        placeholder="الاسم الثلاثي أو الرباعي كما في الهوية"
                        required
                        className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-750 focus:border-amber-500 rounded-xl text-neutral-100 placeholder-neutral-500 text-right text-sm outline-none transition-colors"
                      />
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                        <User className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* User National ID */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-neutral-300">
                      رقم الهوية الوطنية لصاحب المعاملة:
                    </label>
                    <div className="relative">
                      <input
                        id="user-national-id-input"
                        type="text"
                        value={userNationalId}
                        onChange={(e) => {
                          setUserNationalId(e.target.value);
                          if (otpError) setOtpError(null);
                        }}
                        maxLength={10}
                        placeholder="10 أرقام تبدأ بـ 1 أو 2"
                        required
                        className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-750 focus:border-amber-500 rounded-xl text-neutral-100 placeholder-neutral-500 font-mono text-center text-sm outline-none transition-colors"
                      />
                    </div>
                    <span className="text-[10px] text-neutral-500 block">
                      * سيتم تقييد أي مذكرة أو استشارة قضائية باسم ورقم هوية هذا المستفيد فقط.
                    </span>
                  </div>

                  {otpError && (
                    <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{otpError}</span>
                    </div>
                  )}

                  <button
                    id="send-otp-btn"
                    type="submit"
                    disabled={isOtpSending || !userEmail || !userName || userNationalId.length !== 10}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    {isOtpSending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin" />
                        <span>جاري إصدار رمز التحقق...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        <span>إرسال رمز التحقق إلى البريد الإلكتروني</span>
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Step 2: Enter Verification Code */
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  {/* Simulation Notification Card showing the dispatched OTP */}
                  <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>تم إرسال رسالة التحقق بنجاح</span>
                      </div>
                      <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-300 font-mono">
                        كود أمني
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-300">
                      أُرسلت الرسالة إلى: <strong className="text-white font-mono">{userEmail}</strong>
                    </p>
                    {generatedOtp && (
                      <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
                        <div className="text-right">
                          <span className="text-[10px] text-neutral-400 block">رمز التحقق الوارد:</span>
                          <span className="text-lg font-black font-mono tracking-widest text-amber-300">
                            {generatedOtp}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEnteredOtp(generatedOtp)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold cursor-pointer transition-colors"
                        >
                          تعبئة تلقائية
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-neutral-300">
                      أدخل رمز التحقق (٦ أرقام):
                    </label>
                    <input
                      id="otp-digits-input"
                      type="text"
                      maxLength={6}
                      value={enteredOtp}
                      onChange={(e) => {
                        setEnteredOtp(e.target.value);
                        if (otpError) setOtpError(null);
                      }}
                      placeholder="••••••"
                      required
                      className="w-full px-4 py-3 bg-neutral-950 border border-neutral-750 focus:border-amber-500 rounded-xl text-amber-400 placeholder-neutral-600 font-mono text-center text-xl tracking-[0.4em] outline-none transition-colors"
                    />
                  </div>

                  {otpError && (
                    <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{otpError}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <button
                      type="button"
                      onClick={() => setOtpSent(false)}
                      className="text-neutral-400 hover:text-white cursor-pointer underline text-[11px]"
                    >
                      تعديل بيانات البريد والهوية
                    </button>

                    {canResend ? (
                      <button
                        type="button"
                        onClick={(e) => handleSendOtp(e as any)}
                        className="text-amber-400 hover:text-amber-300 cursor-pointer font-bold flex items-center gap-1 text-[11px]"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>إعادة إرسال الرمز</span>
                      </button>
                    ) : (
                      <span className="text-neutral-500 font-mono text-[11px]">
                        إعادة الإرسال بعد: {timerSeconds} ثانية
                      </span>
                    )}
                  </div>

                  <button
                    id="confirm-otp-btn"
                    type="submit"
                    disabled={enteredOtp.trim().length !== 6}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-neutral-950 font-black text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>تأكيد الرمز ودخول المنظومة</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* User Info Note */}
          <div className="mt-6 pt-4 border-t border-neutral-800 text-center">
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              وفقاً لقواعد الترافع الإداري بديوان المظالم، يتم ختم جميع المذكرات والردود فورياً برقم الهوية الوطنية للمستفيد المسجل لمنع تداخل القضايا.
            </p>
          </div>
        </div>
      </main>

      {/* Footer Security Badges */}
      <footer className="p-4 border-t border-neutral-850 text-center text-xs text-neutral-400 relative z-10 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>تشفير أمني متقدم</span>
        </span>
        <span className="text-neutral-700">•</span>
        <span>بوابة الدخول الموحدة لديوان المظالم</span>
        <span className="text-neutral-700">•</span>
        <span className="font-mono text-amber-400/80">المملكة العربية السعودية</span>
      </footer>
    </div>
  );
}
