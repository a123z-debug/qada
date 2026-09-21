import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';

type AuditEvent = {
  id: string;
  at: number;
  actorId: string;
  actorRole: 'admin' | 'user' | 'system';
  action: string;
  targetType?: string;
  targetRef?: string;
  outcome: 'success' | 'warning' | 'denied' | 'error';
  metadata?: Record<string, string | number | boolean | null>;
};

function outcomeClass(outcome: AuditEvent['outcome']) {
  if (outcome === 'success') return 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200';
  if (outcome === 'warning') return 'border-amber-400/25 bg-amber-500/10 text-amber-200';
  if (outcome === 'denied') return 'border-orange-400/25 bg-orange-500/10 text-orange-200';
  return 'border-rose-400/25 bg-rose-500/10 text-rose-200';
}

function outcomeLabel(outcome: AuditEvent['outcome']) {
  if (outcome === 'success') return 'نجاح';
  if (outcome === 'warning') return 'تحذير';
  if (outcome === 'denied') return 'مرفوض';
  return 'خطأ';
}

export function AdminAuditLog({ onBack }: { onBack: () => void }) {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | AuditEvent['outcome']>('all');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/audit-log?limit=200', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || 'تعذر تحميل سجل التدقيق.');
      setEvents(Array.isArray(payload?.events) ? payload.events : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل سجل التدقيق.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visible = useMemo(() => filter === 'all' ? events : events.filter((event) => event.outcome === filter), [events, filter]);
  const failures = events.filter((event) => event.outcome === 'error' || event.outcome === 'denied').length;

  return (
    <section className="space-y-4" dir="rtl">
      <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-l from-cyan-500/12 via-slate-950 to-violet-500/10 p-5 sm:p-6 shadow-2xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-300/25 bg-cyan-500/10 text-cyan-200">
              <Activity className="h-7 w-7" />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[10px] font-black text-cyan-200">
                <ShieldCheck className="h-3 w-3" /> ADMIN AUDIT TRAIL
              </div>
              <h2 className="mt-2 text-xl sm:text-2xl font-black text-white">سجل التدقيق التشغيلي</h2>
              <p className="mt-1 max-w-3xl text-xs sm:text-sm leading-6 text-slate-400">أثر مركزي مشفر لعمليات الدخول وحفظ القضايا وتشغيل التحليل وتغييرات الحسابات. لا يحفظ نص القضية أو كلمات المرور داخل سجل التدقيق.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 text-xs font-black text-slate-300 hover:text-white disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> تحديث
            </button>
            <button type="button" onClick={onBack} className="min-h-11 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 text-xs font-black text-slate-300 hover:text-white">
              <ArrowRight className="h-4 w-4" /> رجوع
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4"><div className="text-2xl font-black text-white">{events.length}</div><div className="mt-1 text-[10px] font-bold text-slate-500">الأحداث المحملة</div></div>
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4"><div className="text-2xl font-black text-emerald-300">{events.filter((event) => event.outcome === 'success').length}</div><div className="mt-1 text-[10px] font-bold text-slate-500">عمليات ناجحة</div></div>
        <div className="rounded-2xl border border-rose-400/15 bg-rose-500/5 p-4"><div className="text-2xl font-black text-rose-300">{failures}</div><div className="mt-1 text-[10px] font-bold text-slate-500">أخطاء أو وصول مرفوض</div></div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'success', 'warning', 'denied', 'error'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-xl border px-3 py-2 text-[11px] font-black ${filter === value ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-200' : 'border-slate-800 bg-slate-950 text-slate-500 hover:text-white'}`}
          >
            {value === 'all' ? 'الكل' : outcomeLabel(value)}
          </button>
        ))}
      </div>

      {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-bold text-rose-200">{error}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/85">
        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500">جاري تحميل سجل التدقيق...</div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">لا توجد أحداث ضمن هذا التصنيف.</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {visible.map((event) => (
              <article key={event.id} className="grid gap-3 p-4 lg:grid-cols-[1.2fr_.7fr_.8fr] lg:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {event.outcome === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : event.outcome === 'denied' ? <ShieldAlert className="h-4 w-4 text-orange-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
                    <span className="font-mono text-xs font-black text-slate-200">{event.action}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${outcomeClass(event.outcome)}`}>{outcomeLabel(event.outcome)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-600">
                    <span>الممثل: {event.actorRole}</span>
                    <span>#{event.actorId}</span>
                    {event.targetType && <span>الهدف: {event.targetType}</span>}
                    {event.targetRef && <span>مرجع: #{event.targetRef}</span>}
                  </div>
                </div>
                <div className="text-xs text-slate-400">{new Date(event.at).toLocaleString('ar-SA')}</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(event.metadata || {}).map(([key, value]) => (
                    <span key={key} className="rounded-lg border border-slate-800 bg-slate-900/70 px-2 py-1 text-[9px] text-slate-500">{key}: {String(value)}</span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}