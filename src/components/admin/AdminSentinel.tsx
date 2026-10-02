import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Eye,
  Radio,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

type Severity = 'P0' | 'P1' | 'P2';
type Finding = {
  severity: Severity;
  code: string;
  title: string;
  conclusion: string;
  expected?: string;
  actual?: string;
  agent?: string;
};

type SentinelEvent = {
  id: string;
  at: number;
  sessionFingerprint: string;
  status: 'clean' | 'flagged';
  maxSeverity: Severity | 'OK';
  responseMode: 'simple' | 'professional';
  routeTask: string;
  routeStage: string;
  draftingActive: boolean;
  releaseGateDecision: string;
  releaseGateScore: number | null;
  sourceBlockers: number;
  unsupportedCitations: number;
  providerMode: string;
  userSnippet: string;
  replySnippet: string;
  findings: Finding[];
};

type SentinelPayload = {
  events?: SentinelEvent[];
  summary?: { total: number; flagged: number; clean: number; P0: number; P1: number; P2: number };
  degraded?: boolean;
  warning?: string;
  error?: string;
};

const severityStyle: Record<string, string> = {
  P0: 'border-rose-400/30 bg-rose-500/10 text-rose-200',
  P1: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
  P2: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200',
  OK: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
};

function formatTime(value: number) {
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

export function AdminSentinel({ onBack }: { onBack: () => void }) {
  const [events, setEvents] = useState<SentinelEvent[]>([]);
  const [summary, setSummary] = useState({ total: 0, flagged: 0, clean: 0, P0: 0, P1: 0, P2: 0 });
  const [selectedId, setSelectedId] = useState('');
  const [filter, setFilter] = useState<'all' | 'flagged' | Severity>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin-sentinel?limit=250', {
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({})) as SentinelPayload;
      if (!response.ok) throw new Error(payload?.error || 'تعذر تحميل QADA Sentinel.');
      const next = Array.isArray(payload.events) ? payload.events : [];
      setEvents(next);
      setSummary(payload.summary || { total: 0, flagged: 0, clean: 0, P0: 0, P1: 0, P2: 0 });
      setWarning(payload.warning || '');
      setSelectedId((current) => current && next.some((item) => item.id === current)
        ? current
        : (next.find((item) => item.status === 'flagged')?.id || next[0]?.id || ''));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل QADA Sentinel.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load();
    const timer = window.setInterval(() => {
      if (!cancelled) void load(true);
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return events;
    if (filter === 'flagged') return events.filter((event) => event.status === 'flagged');
    return events.filter((event) => event.findings.some((finding) => finding.severity === filter));
  }, [events, filter]);

  const selected = events.find((item) => item.id === selectedId) || filtered[0] || null;

  return (
    <section className="min-h-full bg-slate-950 text-slate-100" dir="rtl">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-black text-slate-200 hover:border-slate-600"
          >
            <ArrowRight className="h-4 w-4" />
            رجوع
          </button>
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-rose-300" />
              <h1 className="text-base font-black">QADA Sentinel — المراقب الظل</h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-200">
                <Radio className="h-3 w-3" />
                LIVE
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">يراقب انتقالات المحادثة والوكلاء والبوابات ويكشف الانحراف قبل أن يتحول إلى نمط متكرر.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-500/10 px-3 text-xs font-black text-cyan-200 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {warning && (
          <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 text-xs leading-6 text-amber-100">{warning}</div>
        )}
        {error && (
          <div className="mb-4 rounded-2xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs leading-6 text-rose-100">{error}</div>
        )}

        <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ['المحادثات المرصودة', summary.total, 'text-slate-100'],
            ['تنبيهات', summary.flagged, 'text-amber-200'],
            ['سليم', summary.clean, 'text-emerald-200'],
            ['P0 حرج', summary.P0, 'text-rose-200'],
            ['P1 مهم', summary.P1, 'text-amber-200'],
            ['P2 جودة', summary.P2, 'text-cyan-200'],
          ].map(([label, value, color]) => (
            <div key={String(label)} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
              <div className="text-[10px] font-bold text-slate-500">{label}</div>
              <div className={`mt-2 text-2xl font-black ${color}`}>{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {([
            ['all', 'الكل'],
            ['flagged', 'التنبيهات فقط'],
            ['P0', 'P0'],
            ['P1', 'P1'],
            ['P2', 'P2'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-xl border px-3 py-2 text-xs font-black transition ${
                filter === id
                  ? 'border-violet-400/40 bg-violet-500/15 text-violet-100'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-6 grid min-h-[300px] place-items-center rounded-2xl border border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <Activity className="h-4 w-4 animate-pulse" />
              جاري تحميل المراقبة الحية...
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="mt-6 grid min-h-[280px] place-items-center rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center">
            <div>
              <Eye className="mx-auto h-8 w-8 text-slate-500" />
              <div className="mt-3 text-sm font-black text-slate-200">Sentinel جاهز للمراقبة</div>
              <div className="mt-1 text-xs text-slate-500">ستظهر هنا المحادثات الجديدة بعد مرورها بمسار QADA.</div>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="max-h-[68vh] space-y-2 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900/45 p-2">
              {filtered.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedId(event.id)}
                  className={`w-full rounded-xl border p-3 text-right transition ${
                    selected?.id === event.id
                      ? 'border-violet-400/45 bg-violet-500/10'
                      : 'border-slate-800 bg-slate-950/55 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-lg border px-2 py-1 text-[10px] font-black ${severityStyle[event.maxSeverity] || severityStyle.OK}`}>
                      {event.maxSeverity}
                    </span>
                    <span className="text-[10px] text-slate-500">{formatTime(event.at)}</span>
                  </div>
                  <div className="mt-2 line-clamp-2 text-xs font-bold leading-5 text-slate-200">{event.userSnippet || 'رسالة بدون نص'}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] text-slate-500">
                    <span>{event.responseMode}</span>
                    {event.routeTask && <span>• {event.routeTask}</span>}
                    {event.draftingActive && <span>• drafting</span>}
                    <span>• #{event.sessionFingerprint.slice(0, 8)}</span>
                  </div>
                </button>
              ))}
              {!filtered.length && <div className="p-5 text-center text-xs text-slate-500">لا توجد أحداث بهذا التصنيف.</div>}
            </div>

            <div className="min-h-[420px] rounded-2xl border border-slate-800 bg-slate-900/55 p-4">
              {selected ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        {selected.status === 'clean'
                          ? <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                          : <CircleAlert className="h-5 w-5 text-amber-300" />}
                        <h2 className="text-sm font-black">{selected.status === 'clean' ? 'المسار سليم حسب القواعد الحالية' : 'Sentinel اكتشف انحرافاً'}</h2>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">{formatTime(selected.at)} • جلسة #{selected.sessionFingerprint.slice(0, 10)}</div>
                    </div>
                    <span className={`rounded-xl border px-3 py-1.5 text-xs font-black ${severityStyle[selected.maxSeverity] || severityStyle.OK}`}>{selected.maxSeverity}</span>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-800 bg-slate-950/65 p-3">
                      <div className="text-[10px] font-black text-slate-500">رسالة المستخدم — منزوعة المعرّفات المباشرة</div>
                      <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-200">{selected.userSnippet || '—'}</div>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-950/65 p-3">
                      <div className="text-[10px] font-black text-slate-500">رد QADA المرصود</div>
                      <div className="mt-2 whitespace-pre-wrap text-xs leading-6 text-slate-200">{selected.replySnippet || '—'}</div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ['المسار', selected.routeTask || 'غير محسوم'],
                      ['المرحلة', selected.routeStage || 'غير محسومة'],
                      ['الصياغة', selected.draftingActive ? 'مفعلة' : 'غير مفعلة'],
                      ['Release Gate', selected.releaseGateDecision || 'لم يعمل'],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                        <div className="text-[9px] font-bold text-slate-500">{label}</div>
                        <div className="mt-1 text-xs font-black text-slate-200">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2">
                    <h3 className="text-xs font-black text-slate-300">استنتاجات المراقب</h3>
                    {selected.findings.length ? selected.findings.map((finding, index) => (
                      <div key={finding.code + index} className={`rounded-2xl border p-4 ${severityStyle[finding.severity]}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-black">{finding.title}</div>
                          <div className="font-mono text-[10px] opacity-75">{finding.severity} • {finding.code}</div>
                        </div>
                        <p className="mt-2 text-xs leading-6 opacity-95">{finding.conclusion}</p>
                        {(finding.expected || finding.actual) && (
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {finding.expected && <div className="rounded-xl bg-black/15 p-3 text-[11px] leading-5"><b>المفترض:</b> {finding.expected}</div>}
                            {finding.actual && <div className="rounded-xl bg-black/15 p-3 text-[11px] leading-5"><b>الذي حدث:</b> {finding.actual}</div>}
                          </div>
                        )}
                        {finding.agent && <div className="mt-2 text-[10px] opacity-70">المسار/الوكيل: {finding.agent}</div>}
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4 text-xs leading-6 text-emerald-100/80">
                        لم تكتشف القواعد الحالية تعارض حالة، تسريباً داخلياً، إحالة غير متحققة أو تكييفاً جديداً غير مبرر في هذا الدور.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="grid h-full min-h-[380px] place-items-center text-xs text-slate-500">اختر حدثاً لعرض استنتاجات المراقب.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
