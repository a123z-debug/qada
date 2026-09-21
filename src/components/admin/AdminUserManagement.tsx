import { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, RefreshCw, ShieldCheck, ShieldOff, Users } from 'lucide-react';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  createdAt: number;
  disabled: boolean;
  disabledAt?: number;
};

export function AdminUserManagement({ onBack }: { onBack: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin-users', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'تعذر تحميل المستخدمين.');
      setUsers(Array.isArray(payload?.users) ? payload.users : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل المستخدمين.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const toggleUser = async (user: AdminUser) => {
    if (busyId) return;
    setBusyId(user.id);
    setError('');
    try {
      const response = await fetch('/api/admin-users', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, disabled: !user.disabled }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'تعذر تحديث المستخدم.');
      setUsers((current) => current.map((item) => item.id === user.id ? payload.user : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث المستخدم.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="space-y-4" dir="rtl">
      <div className="rounded-3xl border border-violet-400/25 bg-gradient-to-l from-violet-500/15 via-slate-950 to-cyan-500/10 p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-violet-300/30 bg-violet-500/15 text-violet-200">
              <Users className="h-7 w-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-[10px] font-black text-violet-200">
                <LockKeyhole className="h-3 w-3" /> ADMIN ONLY
              </div>
              <h2 className="mt-2 text-xl sm:text-2xl font-black text-white">إدارة مستخدمي المنصة</h2>
              <p className="mt-1 text-xs sm:text-sm leading-6 text-slate-400">عرض الحسابات المسجلة وإيقافها أو إعادة تفعيلها دون كشف كلمات المرور أو بصماتها.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 text-xs font-black text-slate-300 hover:text-white disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
            </button>
            <button type="button" onClick={onBack} className="min-h-11 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 text-xs font-black text-slate-300 hover:text-white">
              <ArrowRight className="h-4 w-4" /> رجوع
            </button>
          </div>
        </div>
      </div>

      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}

      <div className="rounded-2xl border border-slate-800 bg-slate-950/90 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="text-sm font-black text-white">الحسابات المسجلة</div>
          <div className="text-[11px] font-bold text-slate-500">{users.length} مستخدم</div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">جاري تحميل الحسابات...</div>
        ) : users.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">لا توجد حسابات مستخدمين مسجلة.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {users.map((user) => (
              <div key={user.id} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-slate-100">{user.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${user.disabled ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'}`}>
                      {user.disabled ? 'موقوف' : 'نشط'}
                    </span>
                  </div>
                  <div className="mt-1 break-all text-xs text-slate-400" dir="ltr">{user.email}</div>
                  <div className="mt-1 text-[10px] text-slate-600">أنشئ: {new Date(user.createdAt).toLocaleString('ar-SA')}</div>
                </div>
                <button
                  type="button"
                  onClick={() => void toggleUser(user)}
                  disabled={busyId === user.id}
                  className={`min-h-11 inline-flex items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black disabled:opacity-50 ${user.disabled ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15' : 'border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/15'}`}
                >
                  {user.disabled ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                  {busyId === user.id ? 'جاري التحديث...' : user.disabled ? 'إعادة التفعيل' : 'إيقاف الحساب'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}