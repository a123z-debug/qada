import { useState } from 'react';
import { Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, X } from 'lucide-react';
import type { UserSession } from '../types';

export function AccountSecurityModal({
  isOpen,
  onClose,
  session,
}: {
  isOpen: boolean;
  onClose: () => void;
  session: UserSession;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || session.role === 'admin') return;
    setError('');
    setSuccess('');

    if (newPassword.length < 10) {
      setError('كلمة المرور الجديدة يجب أن تكون 10 أحرف على الأقل.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('تأكيد كلمة المرور غير مطابق.');
      return;
    }

    setBusy(true);
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change-password',
          currentPassword,
          newPassword,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'تعذر تغيير كلمة المرور.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('تم تغيير كلمة المرور بنجاح.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تغيير كلمة المرور.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6" dir="rtl">
      <div className="mx-auto flex h-full max-w-xl items-center justify-center">
        <div className="w-full rounded-3xl border border-cyan-400/20 bg-slate-950 shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-800 p-5">
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-400/20 bg-cyan-500/10 text-cyan-200">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">أمان الحساب</h2>
                <p className="mt-1 text-xs leading-6 text-slate-500">إدارة بيانات الدخول دون كشف كلمة المرور أو تخزينها في المتصفح.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-5">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="flex items-center gap-2 text-xs font-black text-slate-200"><ShieldCheck className="h-4 w-4 text-emerald-400" />الحساب الحالي</div>
              <div className="mt-3 text-sm font-bold text-white">{session.name}</div>
              <div className="mt-1 break-all text-xs text-slate-500" dir="ltr">{session.email}</div>
              <div className="mt-2 text-[10px] font-bold text-slate-600">الدور: {session.role === 'admin' ? 'مدير النظام' : 'مستخدم'}</div>
            </div>

            {session.role === 'admin' ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4 text-xs leading-6 text-amber-100/75">
                كلمة مرور الإدارة تُدار من إعدادات الخادم ولا يمكن تغييرها من الواجهة. عند الحاجة يتم تدوير بصمة بيانات الإدارة في إعدادات البيئة.
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-200"><KeyRound className="h-4 w-4 text-cyan-300" />تغيير كلمة المرور</div>
                  <button type="button" onClick={() => setShowPasswords((value) => !value)} className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-300">
                    {showPasswords ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {showPasswords ? 'إخفاء' : 'إظهار'}
                  </button>
                </div>

                <input
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  placeholder="كلمة المرور الحالية"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
                  required
                />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="كلمة المرور الجديدة — 10 أحرف على الأقل"
                  minLength={10}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
                  required
                />
                <input
                  type={showPasswords ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="تأكيد كلمة المرور الجديدة"
                  minLength={10}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
                  required
                />

                {error && <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-xs font-bold text-rose-200">{error}</div>}
                {success && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-xs font-bold text-emerald-200">{success}</div>}

                <button type="submit" disabled={busy} className="min-h-11 w-full rounded-xl bg-cyan-500 px-4 text-sm font-black text-slate-950 hover:bg-cyan-400 disabled:opacity-50">
                  {busy ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}