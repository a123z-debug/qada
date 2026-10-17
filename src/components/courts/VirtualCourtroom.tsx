import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  Crown,
  Feather,
  FileSearch,
  Gavel,
  GraduationCap,
  HardHat,
  HeartHandshake,
  Hourglass,
  Landmark,
  Library,
  ListChecks,
  Paperclip,
  Play,
  RotateCcw,
  Scale,
  ScanSearch,
  ScrollText,
  ShieldAlert,
  Square,
  Swords,
  UsersRound,
  X,
} from 'lucide-react';
import type { Attachment } from '../../types';
import { INLINE_ATTACHMENT_MAX_BYTES, readFileAsAttachment } from '../../lib/clientAttachments';
import {
  COURT_LEVEL_ORDER,
  COURT_SYSTEMS,
  LAWYER_TEAM,
  MAX_SESSION_ROUNDS,
  NEXT_STEP_LABELS,
  OUTCOME_LABELS,
  VOTE_LABELS,
  buildCourtRoster,
  clientPartyLabel,
  defaultClientRole,
  pleadingTypeFor,
  type BenchRuling,
  type BenchSeat,
  type ClientRole,
  type CourtLevelId,
  type CourtSystemId,
  type DefenseBrief,
  type DeterministicFindings,
  type LawyerRoleId,
  type ProsecutionBrief,
  type SessionDecision,
} from '../../lib/judicialSystem';
import { DEADLINES_VERIFIED_ON, DEADLINE_KIND_LABELS, deadlinesFor } from '../../lib/litigationDeadlines';
import { describeIdentification, identifyCourt, isConfidentIdentification } from '../../lib/courtJurisdiction';

type StageId = 'defense' | 'prosecution' | 'bench';
type SessionStatus = 'idle' | 'running' | 'done' | 'stopped' | 'error';
type SeatState = 'idle' | 'working' | 'done' | 'failed';
type ResultTab = 'verdict' | 'defense' | 'prosecution' | 'bench' | 'pleading' | 'winplan';

type SourceAudit = {
  officialSources: number;
  verifiedArticles: number;
  blockers: string[];
};

type CourtRound = {
  round: number;
  defense?: { brief: DefenseBrief; findings: DeterministicFindings; droppedAuthorities: string[]; sourceAudit?: SourceAudit };
  prosecution?: { brief: ProsecutionBrief };
  bench?: { ruling: BenchRuling; decision: SessionDecision; findings: DeterministicFindings };
};

interface VirtualCourtroomProps {
  /** بدونها تُحدد الجهة تلقائياً من ملف القضية. */
  initialSystem?: CourtSystemId;
  initialLevel?: CourtLevelId;
  initialCaseText?: string;
  documentTitle?: string;
  documentsText?: string;
  initialAttachments?: Attachment[];
  embedded?: boolean;
  onAdoptPleading?: (pleading: string) => void;
  onBack?: () => void;
}

const SYSTEM_ICONS: Record<CourtSystemId, React.ElementType> = {
  commercial: Briefcase,
  general: Scale,
  labor: HardHat,
  'personal-status': HeartHandshake,
  administrative: Building2,
  criminal: ShieldAlert,
};

const LAWYER_ICONS: Record<LawyerRoleId, React.ElementType> = {
  'facts-references': FileSearch,
  gaps: ScanSearch,
  'drafting-advocacy': Feather,
  statutes: Library,
  'super-lawyer': Crown,
  'former-judge': GraduationCap,
};

const STAGE_LABELS: Record<StageId, string> = {
  defense: 'مرافعة فريق الدفاع',
  prosecution: 'مرافعة المدعي العام',
  bench: 'المداولة والحكم',
};

const SEAT_STATE_LABELS: Record<SeatState, string> = {
  idle: 'بانتظار الجلسة',
  working: 'يعمل الآن',
  done: 'أنهى',
  failed: 'تعذر',
};

const RESULT_TABS: Array<{ id: ResultTab; label: string }> = [
  { id: 'verdict', label: 'الحكم' },
  { id: 'defense', label: 'فريق الدفاع' },
  { id: 'prosecution', label: 'المدعي العام' },
  { id: 'bench', label: 'مداولة الهيئة' },
  { id: 'pleading', label: 'المذكرة النهائية' },
  { id: 'winplan', label: 'ما يلزم للفوز' },
];

const SEVERITY_LABELS = { high: 'خطير', medium: 'متوسط', low: 'محدود' } as const;

const ROUND_COUNT_LABELS = ['', 'جولة واحدة', 'جولتين', 'ثلاث جولات'];
const FACTS_LIMIT = 30000;

function nextStageOf(rounds: CourtRound[]): { stage: StageId; round: number } | null {
  if (rounds.length === 0) return { stage: 'defense', round: 1 };
  const last = rounds[rounds.length - 1];
  if (!last.defense) return { stage: 'defense', round: last.round };
  if (!last.prosecution) return { stage: 'prosecution', round: last.round };
  if (!last.bench) return { stage: 'bench', round: last.round };
  if (last.bench.decision.nextStep === 'revise' && last.round < MAX_SESSION_ROUNDS) {
    return { stage: 'defense', round: last.round + 1 };
  }
  return null;
}

function mergeStage(rounds: CourtRound[], next: { stage: StageId; round: number }, result: any): CourtRound[] {
  const base = rounds.some((item) => item.round === next.round) ? rounds : [...rounds, { round: next.round }];
  return base.map((item) => {
    if (item.round !== next.round) return item;
    if (next.stage === 'defense') {
      return {
        ...item,
        defense: {
          brief: result.brief,
          findings: result.findings,
          droppedAuthorities: Array.isArray(result.droppedAuthorities) ? result.droppedAuthorities : [],
          sourceAudit: result.sourceAudit,
        },
      };
    }
    if (next.stage === 'prosecution') return { ...item, prosecution: { brief: result.brief } };
    return { ...item, bench: { ruling: result.ruling, decision: result.decision, findings: result.findings } };
  });
}

async function courtHttpError(response: Response): Promise<string> {
  const payload = await response.json().catch(() => ({} as Record<string, unknown>));
  const code = typeof payload?.error === 'string' ? payload.error : '';
  const retryAfter = Number(response.headers.get('Retry-After') || 0);

  if (response.status === 401) return 'انتهت جلسة الدخول. حدّث الصفحة وسجّل الدخول من جديد.';
  if (response.status === 429) {
    return retryAfter > 0
      ? `تم بلوغ حد الاستخدام المؤقت للمحكمة الافتراضية. أعد المحاولة بعد نحو ${retryAfter} ثانية.`
      : 'تم بلوغ حد الاستخدام المؤقت للمحكمة الافتراضية. أعد المحاولة بعد قليل.';
  }
  if (response.status === 413) return 'حجم المرفقات أكبر من المسموح في الجلسة. احذف أحد المرفقات أو استخدم ملفاً أصغر ثم استكمل الجلسة.';
  if (code === 'CASE_FACTS_REQUIRED') return 'اكتب وقائع القضية أو الصق المسودة أو نص الحكم (30 حرفاً على الأقل).';
  if (code === 'AI_INVALID_RESPONSE') return 'وصل رد غير مكتمل من محرك التحليل. استكمل الجلسة لإعادة هذه المرحلة.';
  if (response.status === 503 || code === 'AI_UNAVAILABLE') {
    return 'محرك التحليل غير متاح الآن. ما أنجزته الجلسة محفوظ، ويمكنك استكمالها بعد قليل.';
  }
  return `تعذر إكمال مرحلة الجلسة (HTTP ${response.status}).`;
}

function initialCourtFor(initialSystem: CourtSystemId | undefined, initialCaseText: string): CourtSystemId {
  if (initialSystem) return initialSystem;
  const identification = identifyCourt(initialCaseText);
  // المحاكم العامة صاحبة الولاية العامة: هي البديل حين لا يتضح الاختصاص من الملف.
  return isConfidentIdentification(identification) && identification.systemId ? identification.systemId : 'general';
}

export function VirtualCourtroom({
  initialSystem,
  initialLevel = 'first',
  initialCaseText = '',
  documentTitle = '',
  documentsText = '',
  initialAttachments = [],
  embedded = false,
  onAdoptPleading,
  onBack,
}: VirtualCourtroomProps) {
  const [systemId, setSystemId] = useState<CourtSystemId>(() => initialCourtFor(initialSystem, initialCaseText));
  const [levelId, setLevelId] = useState<CourtLevelId>(initialLevel);
  const [clientRole, setClientRole] = useState<ClientRole>(() => defaultClientRole(initialCourtFor(initialSystem, initialCaseText)));
  // تلقائي حتى يختار المستخدم جهة أو درجة بنفسه.
  const [autoCourt, setAutoCourt] = useState(!initialSystem);
  const [caseTitle, setCaseTitle] = useState(documentTitle);
  const [facts, setFacts] = useState(initialCaseText);
  const [requests, setRequests] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
  const [rounds, setRounds] = useState<CourtRound[]>([]);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [activeStage, setActiveStage] = useState<{ stage: StageId; round: number } | null>(null);
  const [error, setError] = useState('');
  const [resultTab, setResultTab] = useState<ResultTab>('verdict');
  const [copied, setCopied] = useState(false);
  const [adopted, setAdopted] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Inside the editor, keep the case file in step with the draft until a session starts.
  useEffect(() => {
    if (!embedded || status !== 'idle' || rounds.length > 0) return;
    setFacts(initialCaseText);
  }, [embedded, initialCaseText]);

  const roster = useMemo(() => buildCourtRoster(systemId, levelId), [systemId, levelId]);
  const deadlines = useMemo(() => deadlinesFor(systemId, levelId), [systemId, levelId]);
  const running = status === 'running';

  const identification = useMemo(
    () => identifyCourt([caseTitle, facts, requests, documentsText].join('\n')),
    [caseTitle, facts, requests, documentsText],
  );
  const identifiedSystem = isConfidentIdentification(identification) ? identification.systemId : null;
  const jurisdictionMismatch = Boolean(identifiedSystem) && identifiedSystem !== systemId;

  // قبل بدء الجلسة: تتبع الجهة والدرجة ما يقرؤه الملف، ما دام المستخدم لم يختر بنفسه.
  useEffect(() => {
    if (!autoCourt || status !== 'idle' || rounds.length > 0 || !identifiedSystem) return;
    if (identifiedSystem !== systemId) {
      setSystemId(identifiedSystem);
      setClientRole(defaultClientRole(identifiedSystem));
    }
    if (identification.levelConfidence !== 'low' && identification.levelId !== levelId) {
      setLevelId(identification.levelId);
    }
  }, [autoCourt, status, rounds.length, identifiedSystem, identification.levelId, identification.levelConfidence]);

  const benchDisplay = useMemo(() => {
    const presiding = roster.bench.find((seat) => seat.issuesRuling);
    const others = roster.bench.filter((seat) => !seat.issuesRuling);
    return [others[0], presiding, others[1]].filter((seat): seat is BenchSeat => Boolean(seat));
  }, [roster]);

  const latestDefense = [...rounds].reverse().find((item) => item.defense)?.defense;
  const latestProsecution = [...rounds].reverse().find((item) => item.prosecution)?.prosecution;
  const latestBench = [...rounds].reverse().find((item) => item.bench)?.bench;
  const decision = latestBench?.decision;

  const winPlan = useMemo(() => {
    const items = new Set<string>();
    for (const gap of latestBench?.ruling.evidentiaryGaps || []) items.add(gap);
    for (const item of latestDefense?.brief.missingEvidence || []) items.add(item);
    if (decision && decision.nextStep !== 'won') {
      for (const defect of latestBench?.ruling.curableDefects || []) items.add(defect);
    }
    return Array.from(items);
  }, [latestBench, latestDefense, decision]);

  const resetSession = () => {
    abortRef.current?.abort();
    setRounds([]);
    setStatus('idle');
    setActiveStage(null);
    setError('');
    setAdopted(false);
    setResultTab('verdict');
  };

  const selectSystem = (id: CourtSystemId) => {
    if (running || id === systemId) return;
    setAutoCourt(false);
    setSystemId(id);
    setClientRole(defaultClientRole(id));
    resetSession();
  };

  const selectLevel = (id: CourtLevelId) => {
    if (running || id === levelId) return;
    setAutoCourt(false);
    setLevelId(id);
    resetSession();
  };

  const moveToIdentifiedCourt = () => {
    if (running || !identification.systemId) return;
    setSystemId(identification.systemId);
    setClientRole(defaultClientRole(identification.systemId));
    if (identification.levelConfidence !== 'low') setLevelId(identification.levelId);
    setAutoCourt(true);
    resetSession();
  };

  const selectRole = (role: ClientRole) => {
    if (running || role === clientRole) return;
    setClientRole(role);
    resetSession();
  };

  const callStage = async (
    next: { stage: StageId; round: number },
    current: CourtRound[],
    signal: AbortSignal,
  ) => {
    const roundState = current.find((item) => item.round === next.round);
    const previous = current.find((item) => item.round === next.round - 1);
    const attachmentNames = attachments.map((item) => `[مرفق: ${item.name}]`).join('\n');
    const payload: Record<string, unknown> = {
      stage: next.stage,
      round: next.round,
      systemId,
      levelId,
      clientRole,
      caseFile: {
        title: caseTitle,
        facts,
        requests,
        documentsText: [documentsText, attachmentNames].filter(Boolean).join('\n'),
      },
    };
    // Evidence goes to the lawyers once and to every bench; the prosecutor works from the record.
    if ((next.stage === 'defense' && next.round === 1) || next.stage === 'bench') {
      payload.attachments = attachments.map((item) => ({ name: item.name, type: item.type, data: item.data }));
    }
    if (next.stage !== 'defense') payload.defense = roundState?.defense?.brief;
    if (next.stage === 'bench') payload.prosecution = roundState?.prosecution?.brief;
    if (next.stage === 'defense' && next.round > 1 && previous) {
      payload.priorDefense = previous.defense?.brief;
      payload.priorProsecution = previous.prosecution?.brief;
      payload.priorBench = previous.bench?.ruling;
    }

    const response = await fetch('/api/court-session', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok) throw new Error(await courtHttpError(response));
    const result = await response.json();
    if (result?.stage !== next.stage) throw new Error('وصل رد غير متوقع من المحكمة الافتراضية. استكمل الجلسة لإعادة المرحلة.');
    return result;
  };

  const advance = async (startRounds: CourtRound[]) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setStatus('running');
    setError('');
    let current = startRounds;

    try {
      for (let next = nextStageOf(current); next; next = nextStageOf(current)) {
        setActiveStage(next);
        const result = await callStage(next, current, controller.signal);
        current = mergeStage(current, next, result);
        setRounds(current);
      }
      setActiveStage(null);
      setStatus('done');
      setResultTab('verdict');
    } catch (sessionError) {
      if (controller.signal.aborted) {
        setActiveStage(null);
        setStatus('stopped');
        return;
      }
      setStatus('error');
      setError(sessionError instanceof Error ? sessionError.message : 'تعذر إكمال الجلسة.');
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const startSession = () => {
    if (facts.trim().length < 30) {
      setError('اكتب وقائع القضية أو الصق المسودة أو نص الحكم (30 حرفاً على الأقل) قبل افتتاح الجلسة.');
      return;
    }
    setRounds([]);
    setAdopted(false);
    setResultTab('verdict');
    void advance([]);
  };

  const handleAttach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const attachment = await readFileAsAttachment(file);
      // Keep each stage request under the server's 4MB JSON limit once base64-encoded.
      const totalBytes = attachments.reduce((sum, item) => sum + item.size, 0) + attachment.size;
      if (attachments.length >= 2 || totalBytes > INLINE_ATTACHMENT_MAX_BYTES) {
        setError('مجموع مرفقات الجلسة يتجاوز 2.5 ميجابايت أو مرفقين. احذف مرفقاً أو استخدم ملفاً أصغر.');
        return;
      }
      setError('');
      setAttachments((previous) => [...previous, attachment]);
    } catch (attachError) {
      setError(attachError instanceof Error ? attachError.message : 'تعذر قراءة الملف.');
    }
  };

  const handleCopy = async () => {
    if (!latestDefense?.brief.pleading) return;
    try {
      await navigator.clipboard.writeText(latestDefense.brief.pleading);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError('تعذر النسخ تلقائياً؛ حدّد النص وانسخه يدوياً.');
    }
  };

  const handleAdopt = () => {
    if (!latestDefense?.brief.pleading || !onAdoptPleading) return;
    onAdoptPleading(latestDefense.brief.pleading);
    setAdopted(true);
  };

  const seatState = (group: StageId): SeatState => {
    if (activeStage?.stage === group) {
      if (status === 'running') return 'working';
      if (status === 'error') return 'failed';
    }
    const done = group === 'defense' ? latestDefense : group === 'prosecution' ? latestProsecution : latestBench;
    return done ? 'done' : 'idle';
  };

  const benchSeatSummary = (seat: BenchSeat): string => {
    if (!latestBench) return seat.focus;
    const opinion = latestBench.ruling.opinions.find((item) => item.seatId === seat.id);
    if (opinion) return `${VOTE_LABELS[opinion.vote]} — ${opinion.reasoning}`;
    if (seat.issuesRuling) {
      const judgment = latestBench.ruling.finalJudgment;
      return `${OUTCOME_LABELS[judgment.outcome]}${judgment.operative ? ` — ${judgment.operative}` : ''}`;
    }
    return seat.focus;
  };

  const progressText = running && activeStage
    ? `الجلسة منعقدة: ${STAGE_LABELS[activeStage.stage]} — الجولة ${activeStage.round} من ${MAX_SESSION_ROUNDS}`
    : status === 'done' && decision
      ? `${NEXT_STEP_LABELS[decision.nextStep]} — بعد ${ROUND_COUNT_LABELS[decision.round] || `${decision.round} جولات`}`
      : status === 'stopped'
        ? 'أُوقفت الجلسة. ما أنجزته محفوظ ويمكنك استكمالها.'
        : '';

  const SystemIcon = SYSTEM_ICONS[systemId];

  return (
    <section className="qada-court-chamber p-4 sm:p-6 lg:p-8 space-y-6" dir="rtl" aria-label="المحكمة الافتراضية">
      {/* 1. الترويسة */}
      <header className="qada-court-head flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="qada-court-emblem shrink-0" aria-hidden="true">
            <Scale className="h-7 w-7" strokeWidth={1.6} />
          </span>
          <div>
            <div className="qada-court-kicker">QADA • القضاء الافتراضي</div>
            <h2 className="qada-court-title mt-1 text-2xl sm:text-3xl font-black">المحكمة الافتراضية</h2>
            <p className="qada-court-muted mt-2 max-w-2xl text-sm leading-7">
              أربع جهات قضائية بثلاث درجات. في كل محكمة هيئة حكم ومدعٍ عام، وستة محامين يعملون معاً لكسب قضيتك بالحجة والدليل.
            </p>
          </div>
        </div>
        {onBack && (
          <button type="button" onClick={onBack} className="qada-court-secondary inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-xl px-4 text-xs font-bold">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </button>
        )}
      </header>

      <p className="qada-court-note rounded-2xl px-4 py-3 text-xs leading-6">
        محاكاة تحليلية مبنية على ملفك والمصادر الرسمية المتاحة في المنصة. ليست حكماً قضائياً ولا تضمن نتيجة المحكمة، ولا يُقبل فيها سند أو واقعة غير ثابتة.
      </p>

      {/* 2. اختيار المحكمة والدرجة */}
      <div className="space-y-4">
        <div>
          <div className="qada-court-label mb-2 text-xs font-bold">الجهة القضائية</div>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            {COURT_SYSTEMS.map((system) => {
              const Icon = SYSTEM_ICONS[system.id];
              const selected = system.id === systemId;
              return (
                <button
                  key={system.id}
                  type="button"
                  onClick={() => selectSystem(system.id)}
                  disabled={running && !selected}
                  aria-pressed={selected}
                  className="qada-court-choice flex min-h-[72px] items-start gap-3 rounded-2xl p-3 text-right"
                >
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.8} />
                  <span className="min-w-0">
                    <span className="block text-sm font-black">{system.title}</span>
                    <span className="qada-court-muted mt-0.5 block text-[11px] leading-5">{system.subtitle}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="qada-court-label mb-2 text-xs font-bold">درجة التقاضي</div>
          <ol className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {COURT_LEVEL_ORDER.map((level, index) => {
              const profile = roster.system.levels[level];
              const selected = level === levelId;
              return (
                <li key={level}>
                  <button
                    type="button"
                    onClick={() => selectLevel(level)}
                    disabled={running && !selected}
                    aria-pressed={selected}
                    className="qada-court-choice qada-court-level flex h-full min-h-[64px] w-full items-center gap-3 rounded-2xl p-3 text-right"
                  >
                    <span className="qada-court-step shrink-0" aria-hidden="true">{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-black">{profile.shortName}</span>
                      <span className="qada-court-muted block text-[11px] leading-5">{profile.courtName}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* قراءة الاختصاص من ملف القضية */}
        {identification.systemId ? (
          <div
            className="qada-court-item flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 text-xs leading-6"
            role={jurisdictionMismatch ? 'alert' : 'status'}
          >
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="qada-court-chip rounded-lg px-2 py-0.5 text-[10px]" data-tone={jurisdictionMismatch ? 'high' : 'done'}>
                {jurisdictionMismatch ? 'اختصاص مختلف' : autoCourt ? 'اختيرت تلقائياً' : 'مطابقة للملف'}
              </span>
              <span>
                <span className="qada-court-muted">قراءة الملف: </span>
                {describeIdentification(identification)}
                {identification.signals.length > 0 && <span className="qada-court-muted"> — {identification.signals.join('، ')}</span>}
              </span>
            </span>
            {jurisdictionMismatch && (
              <button
                type="button"
                onClick={moveToIdentifiedCourt}
                disabled={running}
                className="qada-court-choice min-h-9 rounded-xl px-3 text-[11px] font-bold"
              >
                انتقل إلى الجهة المختصة
              </button>
            )}
          </div>
        ) : (
          <p className="qada-court-muted text-[11px]">
            اكتب الوقائع أو الصق الحكم في ملف القضية، وتُحدد الجهة القضائية والدرجة تلقائياً من مضمونه.
          </p>
        )}
      </div>

      {/* المدد النظامية للجهة والدرجة المختارتين */}
      {deadlines.length > 0 && (
        <details className="qada-court-panel rounded-[24px] p-4 sm:p-5" open>
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
            <span className="qada-court-title flex items-center gap-2 text-sm font-black">
              <Hourglass className="h-4 w-4" aria-hidden="true" />
              المدد النظامية — {roster.system.title} ({roster.level.shortName})
            </span>
            <span className="qada-court-muted text-[11px]">من النص الرسمي في بوابة هيئة الخبراء — آخر مطابقة {DEADLINES_VERIFIED_ON}</span>
          </summary>
          <ul className="mt-4 grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {deadlines.map((deadline) => (
              <li key={deadline.id} className="qada-court-item space-y-1.5 rounded-2xl p-3.5 text-xs leading-6">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="qada-court-chip rounded-lg px-2 py-0.5 text-[10px]" data-tone="low">{DEADLINE_KIND_LABELS[deadline.kind]}</span>
                  {deadline.status === 'verify' && (
                    <span className="qada-court-chip rounded-lg px-2 py-0.5 text-[10px]" data-tone="medium">يحتاج تحققاً</span>
                  )}
                </div>
                <div className="font-black">{deadline.title}</div>
                <div className="qada-court-brass text-sm font-black">{deadline.period}</div>
                <div><span className="qada-court-muted">تبدأ: </span>{deadline.startsFrom}</div>
                {deadline.scope && <div><span className="qada-court-muted">النطاق: </span>{deadline.scope}</div>}
                {deadline.consequence && <div><span className="qada-court-muted">الأثر: </span>{deadline.consequence}</div>}
                {deadline.exceptions && <div><span className="qada-court-muted">الاستثناء: </span>{deadline.exceptions}</div>}
                {deadline.note && <div className="qada-court-muted">{deadline.note}</div>}
                <details>
                  <summary className="qada-court-muted cursor-pointer text-[11px]">
                    {deadline.source.law} — {deadline.article}
                  </summary>
                  <p className="mt-1 text-[11px] leading-6">«{deadline.officialText}»</p>
                  <a
                    href={deadline.source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="qada-court-brass text-[11px] underline"
                  >
                    {deadline.source.decree} — بوابة هيئة الخبراء
                  </a>
                </details>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* 3. قاعة المحكمة */}
      <div className="qada-court-hall space-y-5 rounded-[26px] p-4 sm:p-6">
        <div className="text-center">
          <div className="qada-court-kicker inline-flex items-center gap-2">
            <SystemIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {roster.system.title}
          </div>
          <h3 className="qada-court-title mt-1 text-lg sm:text-xl font-black">{roster.level.courtName}</h3>
          <p className="qada-court-muted mx-auto mt-1 max-w-2xl text-xs leading-6">{roster.level.mission}</p>
        </div>

        <div className="qada-court-bench rounded-[24px] px-3 pb-5 pt-4 sm:px-5">
          <div className="qada-court-label mb-3 flex items-center justify-center gap-2 text-xs font-bold">
            <Gavel className="h-4 w-4" aria-hidden="true" />
            {levelId === 'supreme' ? 'دائرة النقض — ثلاثة قضاة والقرار بالأغلبية' : 'منصة الحكم — وكيلا القاضي والقاضي مُصدر الحكم'}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {benchDisplay.map((seat) => (
              <button
                key={seat.id}
                type="button"
                onClick={() => setResultTab(seat.issuesRuling ? 'verdict' : 'bench')}
                data-state={seatState('bench')}
                data-role={seat.issuesRuling ? 'presiding' : 'judge'}
                className="qada-court-seat flex flex-col items-start gap-2 rounded-2xl p-3.5 text-right"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="qada-court-seat-icon" aria-hidden="true">
                    {seat.kind === 'cassation-judge' ? <Landmark className="h-4 w-4" /> : seat.issuesRuling ? <Gavel className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
                  </span>
                  <span className="qada-court-state" data-state={seatState('bench')}>{SEAT_STATE_LABELS[seatState('bench')]}</span>
                </span>
                <span className="text-sm font-black leading-6">{seat.title}</span>
                <span className="qada-court-muted line-clamp-3 text-[11px] leading-5">{benchSeatSummary(seat)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="qada-court-label mb-2 flex items-center gap-2 text-xs font-bold">
              <UsersRound className="h-4 w-4" aria-hidden="true" />
              فريق الدفاع — ستة محامين ({clientPartyLabel(systemId, levelId, clientRole)})
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {LAWYER_TEAM.map((lawyer) => {
                const Icon = LAWYER_ICONS[lawyer.id];
                const opinion = latestDefense?.brief.lawyers.find((item) => item.roleId === lawyer.id);
                const state = seatState('defense');
                return (
                  <button
                    key={lawyer.id}
                    type="button"
                    onClick={() => setResultTab(lawyer.id === 'drafting-advocacy' ? 'pleading' : 'defense')}
                    data-state={state}
                    data-role={lawyer.id === 'super-lawyer' ? 'lead' : 'lawyer'}
                    className="qada-court-seat flex flex-col items-start gap-2 rounded-2xl p-3.5 text-right"
                  >
                    <span className="flex w-full items-center justify-between gap-2">
                      <span className="qada-court-seat-icon" aria-hidden="true"><Icon className="h-4 w-4" /></span>
                      <span className="qada-court-state" data-state={state}>{SEAT_STATE_LABELS[state]}</span>
                    </span>
                    <span className="text-sm font-black leading-6">{lawyer.title}</span>
                    <span className="qada-court-muted line-clamp-3 text-[11px] leading-5">
                      {opinion?.delivered ? opinion.summary : lawyer.mission}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="qada-court-label mb-2 flex items-center gap-2 text-xs font-bold">
              <Swords className="h-4 w-4" aria-hidden="true" />
              الخصم
            </div>
            <button
              type="button"
              onClick={() => setResultTab('prosecution')}
              data-state={seatState('prosecution')}
              data-role="prosecutor"
              className="qada-court-seat flex h-[calc(100%-1.75rem)] min-h-[150px] w-full flex-col items-start gap-2 rounded-2xl p-4 text-right"
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="qada-court-seat-icon" aria-hidden="true"><Swords className="h-4 w-4" /></span>
                <span className="qada-court-state" data-state={seatState('prosecution')}>{SEAT_STATE_LABELS[seatState('prosecution')]}</span>
              </span>
              <span className="text-sm font-black leading-6">{roster.prosecutor.title}</span>
              <span className="qada-court-brass text-[11px] font-bold">{roster.prosecutor.represents}</span>
              <span className="qada-court-muted line-clamp-5 text-[11px] leading-5">
                {latestProsecution?.brief.strongestAttack || roster.prosecutor.focus}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. ملف القضية */}
      <div className="qada-court-panel space-y-4 rounded-[24px] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="qada-court-title flex items-center gap-2 text-sm font-black">
            <ScrollText className="h-4 w-4" aria-hidden="true" />
            ملف القضية
          </h3>
          <span className="qada-court-muted text-[11px]">
            المحرر المطلوب: {pleadingTypeFor(systemId, levelId, clientRole)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="صفة موكلنا">
          <span className="qada-court-label text-xs font-bold">صفة موكلنا:</span>
          {(['claimant', 'defendant'] as ClientRole[]).map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => selectRole(role)}
              disabled={running && role !== clientRole}
              aria-pressed={role === clientRole}
              className="qada-court-choice min-h-11 rounded-xl px-4 text-xs font-bold"
            >
              {role === 'claimant'
                ? (systemId === 'administrative' ? 'المدعي على الجهة' : 'المدعي / المعترض')
                : (systemId === 'criminal' ? 'المتهم' : 'المدعى عليه')}
            </button>
          ))}
        </div>

        {!embedded && (
          <label className="block space-y-1.5">
            <span className="qada-court-label text-xs font-bold">عنوان القضية (اختياري)</span>
            <input
              type="text"
              value={caseTitle}
              onChange={(event) => setCaseTitle(event.target.value)}
              maxLength={200}
              disabled={running}
              className="qada-court-input w-full rounded-xl px-3.5 py-2.5"
              placeholder="مثال: مطالبة بقيمة توريدات غير مسددة"
            />
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="qada-court-label text-xs font-bold">الوقائع أو المسودة أو نص الحكم</span>
          <textarea
            value={facts}
            onChange={(event) => setFacts(event.target.value)}
            rows={embedded ? 6 : 8}
            maxLength={FACTS_LIMIT}
            disabled={running}
            className="qada-court-input w-full rounded-xl px-3.5 py-3"
            placeholder="احكِ ما حدث بالتسلسل، أو الصق المسودة أو الحكم المعترض عليه. لا تكتب أرقام الهوية أو الجوال."
          />
          <span className="qada-court-muted block text-[11px]">{facts.length.toLocaleString('ar-SA')} / {FACTS_LIMIT.toLocaleString('ar-SA')} حرف</span>
        </label>

        <label className="block space-y-1.5">
          <span className="qada-court-label text-xs font-bold">ماذا تريد أن تكسب؟</span>
          <textarea
            value={requests}
            onChange={(event) => setRequests(event.target.value)}
            rows={2}
            maxLength={4000}
            disabled={running}
            className="qada-court-input w-full rounded-xl px-3.5 py-3"
            placeholder="مثال: إلزام الخصم بسداد المبلغ، إلغاء القرار، نقض الحكم، البراءة..."
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <label className="qada-court-secondary inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-4 text-xs font-bold">
            <Paperclip className="h-4 w-4" aria-hidden="true" />
            إرفاق مستند (PDF أو صورة)
            <input type="file" accept=".pdf,application/pdf,image/*" onChange={handleAttach} className="hidden" disabled={running} />
          </label>
          {attachments.map((attachment) => (
            <span key={attachment.id} className="qada-court-chip inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px]">
              <Paperclip className="h-3 w-3" aria-hidden="true" />
              <span className="max-w-[180px] truncate">{attachment.name}</span>
              <button
                type="button"
                onClick={() => setAttachments((previous) => previous.filter((item) => item.id !== attachment.id))}
                disabled={running}
                aria-label={`إزالة المرفق ${attachment.name}`}
                className="qada-court-icon-button"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>

        {error && (
          <div className="qada-court-alert flex items-start gap-2 rounded-xl px-3.5 py-3 text-xs font-bold leading-6" role="alert">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between qada-court-divider">
          <p className="qada-court-muted text-xs leading-6" aria-live="polite">
            {progressText || `حتى ${MAX_SESSION_ROUNDS} جولات: إذا لم يصدر الحكم لصالح موكلك يعالج فريق الدفاع أسبابه ويعود للمرافعة.`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {running ? (
              <button
                key="stop"
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="qada-court-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-bold"
              >
                <Square className="h-4 w-4" aria-hidden="true" />
                إيقاف الجلسة
              </button>
            ) : (status === 'error' || status === 'stopped') && nextStageOf(rounds) ? (
              <React.Fragment key="resume">
                <button type="button" onClick={resetSession} className="qada-court-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-bold">
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  جلسة جديدة
                </button>
                <button type="button" onClick={() => void advance(rounds)} className="qada-court-primary inline-flex min-h-12 items-center gap-2 rounded-xl px-6 text-sm font-black">
                  <Play className="h-4 w-4" aria-hidden="true" />
                  استكمال الجلسة
                </button>
              </React.Fragment>
            ) : (
              <button key="start" type="button" onClick={startSession} className="qada-court-primary inline-flex min-h-12 items-center gap-2 rounded-xl px-6 text-sm font-black">
                <Gavel className="h-4 w-4" aria-hidden="true" />
                {rounds.length > 0 ? 'جلسة جديدة بنفس الملف' : 'افتتاح الجلسة'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 5. مسار الجولات */}
      {rounds.length > 0 && (
        <ol className="grid grid-cols-1 gap-2.5 md:grid-cols-3" aria-label="جولات الجلسة">
          {rounds.map((item) => (
            <li key={item.round} className="qada-court-panel rounded-2xl p-3.5">
              <div className="qada-court-title text-xs font-black">الجولة {item.round}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(['defense', 'prosecution', 'bench'] as StageId[]).map((stage) => {
                  const done = Boolean(item[stage]);
                  const working = activeStage?.round === item.round && activeStage.stage === stage && running;
                  return (
                    <span key={stage} className="qada-court-chip inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px]" data-tone={done ? 'done' : working ? 'working' : 'idle'}>
                      {done ? <CircleCheck className="h-3 w-3" aria-hidden="true" /> : <Hourglass className="h-3 w-3" aria-hidden="true" />}
                      {STAGE_LABELS[stage]}
                    </span>
                  );
                })}
              </div>
              {item.bench && (
                <div className="mt-2 text-[11px] font-bold" data-outcome={item.bench.decision.outcome}>
                  الحكم: <span className="qada-court-outcome" data-outcome={item.bench.decision.outcome}>{OUTCOME_LABELS[item.bench.decision.outcome]}</span>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}

      {/* 6. النتائج */}
      {rounds.length > 0 && (
        <div className="qada-court-panel rounded-[24px] p-4 sm:p-5">
          <div className="flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="نتائج الجلسة">
            {RESULT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={resultTab === tab.id}
                onClick={() => setResultTab(tab.id)}
                className="qada-court-tab min-h-11 shrink-0 rounded-xl px-3.5 text-xs font-bold"
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4" role="tabpanel">
            {resultTab === 'verdict' && (
              latestBench && decision ? (
                <div className="space-y-4">
                  <div className="qada-court-verdict rounded-2xl p-4 sm:p-5" data-outcome={decision.outcome}>
                    <div className="flex items-start gap-3">
                      {decision.outcome === 'favorable'
                        ? <CircleCheck className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />
                        : <CircleAlert className="mt-0.5 h-6 w-6 shrink-0" aria-hidden="true" />}
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold opacity-80">الحكم المحاكى — {roster.level.courtName} — الجولة {decision.round}</div>
                        <div className="mt-1 text-xl font-black">{OUTCOME_LABELS[decision.outcome]}</div>
                        <div className="mt-1 text-xs font-bold">{NEXT_STEP_LABELS[decision.nextStep]}</div>
                        {decision.majority && (
                          <div className="mt-1 text-[11px]">
                            الأصوات: مع الموكل {decision.majority.favorable} • جزئي {decision.majority.partial} • ضد الموكل {decision.majority.unfavorable}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {latestBench.ruling.finalJudgment.operative && (
                    <div>
                      <div className="qada-court-label mb-1.5 text-xs font-bold">منطوق الحكم المحاكى</div>
                      <p className="qada-court-paper rounded-2xl p-4 text-sm leading-8">{latestBench.ruling.finalJudgment.operative}</p>
                    </div>
                  )}

                  {latestBench.ruling.finalJudgment.reasons.length > 0 && (
                    <div>
                      <div className="qada-court-label mb-1.5 text-xs font-bold">الأسباب</div>
                      <ul className="space-y-1.5">
                        {latestBench.ruling.finalJudgment.reasons.map((reason, index) => (
                          <li key={index} className="qada-court-item rounded-xl px-3 py-2 text-xs leading-6">{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {decision.downgradedReasons.length > 0 && (
                    <div className="qada-court-alert rounded-xl px-3.5 py-3 text-xs leading-6" role="note">
                      <div className="font-black">قيّدت بوابة التحقق نتيجة الحكم:</div>
                      <ul className="mt-1 space-y-1">
                        {decision.downgradedReasons.map((reason, index) => <li key={index}>• {reason}</li>)}
                      </ul>
                    </div>
                  )}

                  {decision.dissentingSeats.length > 0 && (
                    <p className="qada-court-muted text-[11px] leading-6">
                      رأي مخالف من: {decision.dissentingSeats.map((seatId) => roster.bench.find((seat) => seat.id === seatId)?.title || seatId).join('، ')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="qada-court-muted text-sm leading-7">لم تصدر الهيئة حكمها بعد. تابع سير الجلسة في القاعة أعلاه.</p>
              )
            )}

            {resultTab === 'defense' && (
              latestDefense ? (
                <div className="space-y-4">
                  {latestDefense.brief.theory && (
                    <div className="qada-court-verdict rounded-2xl p-4" data-outcome="lead">
                      <div className="flex items-center gap-2 text-xs font-black"><Crown className="h-4 w-4" aria-hidden="true" />نظرية القضية</div>
                      <p className="mt-1.5 text-sm leading-7">{latestDefense.brief.theory}</p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {latestDefense.brief.lawyers.map((opinion) => {
                      const seat = LAWYER_TEAM.find((item) => item.id === opinion.roleId);
                      const Icon = LAWYER_ICONS[opinion.roleId];
                      return (
                        <article key={opinion.roleId} className="qada-court-item rounded-2xl p-3.5">
                          <h4 className="flex items-center gap-2 text-sm font-black"><Icon className="h-4 w-4" aria-hidden="true" />{seat?.title}</h4>
                          <p className="mt-1.5 text-xs leading-6">{opinion.summary}</p>
                          {opinion.points.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {opinion.points.map((point, index) => <li key={index} className="qada-court-muted text-[11px] leading-6">• {point}</li>)}
                            </ul>
                          )}
                        </article>
                      );
                    })}
                  </div>
                  {latestDefense.brief.oralArguments.length > 0 && (
                    <div>
                      <div className="qada-court-label mb-1.5 text-xs font-bold">الحجج أمام القاضي</div>
                      <ul className="space-y-1.5">
                        {latestDefense.brief.oralArguments.map((item, index) => <li key={index} className="qada-court-item rounded-xl px-3 py-2 text-xs leading-6">{item}</li>)}
                      </ul>
                    </div>
                  )}
                  <div className="qada-court-muted text-[11px] leading-6">
                    الأسانيد المعتمدة: {latestDefense.brief.authorities.length ? latestDefense.brief.authorities.join(' • ') : 'لم يعتمد الفريق سنداً مرقماً من حزمة المصادر'}
                    {latestDefense.sourceAudit && ` — مصادر رسمية: ${latestDefense.sourceAudit.officialSources} • مواد مفهرسة: ${latestDefense.sourceAudit.verifiedArticles}`}
                  </div>
                  {(latestDefense.findings.unsupportedCitations.length > 0 || latestDefense.droppedAuthorities.length > 0) && (
                    <div className="qada-court-alert rounded-xl px-3.5 py-3 text-xs leading-6" role="note">
                      أسقطت بوابة التحقق إحالات غير متحققة: {[...latestDefense.findings.unsupportedCitations, ...latestDefense.droppedAuthorities].slice(0, 8).join('، ')}
                    </div>
                  )}
                </div>
              ) : (
                <p className="qada-court-muted text-sm leading-7">فريق الدفاع لم يقدم مرافعته بعد.</p>
              )
            )}

            {resultTab === 'prosecution' && (
              latestProsecution ? (
                <div className="space-y-4">
                  <div className="qada-court-verdict rounded-2xl p-4" data-outcome="unfavorable">
                    <div className="flex items-center gap-2 text-xs font-black"><Swords className="h-4 w-4" aria-hidden="true" />أقوى هجوم</div>
                    <p className="mt-1.5 text-sm leading-7">{latestProsecution.brief.strongestAttack}</p>
                  </div>
                  <ul className="space-y-2">
                    {latestProsecution.brief.attacks.map((attack, index) => (
                      <li key={index} className="qada-court-item flex items-start gap-3 rounded-xl px-3 py-2.5 text-xs leading-6">
                        <span className="qada-court-chip shrink-0 rounded-md px-2 py-0.5 text-[10px] font-black" data-tone={attack.severity}>
                          {SEVERITY_LABELS[attack.severity]}
                        </span>
                        <span><b>{attack.target}:</b> {attack.point}</span>
                      </li>
                    ))}
                  </ul>
                  {latestProsecution.brief.demands && (
                    <p className="qada-court-muted text-xs leading-6"><b>طلبات المدعي العام:</b> {latestProsecution.brief.demands}</p>
                  )}
                </div>
              ) : (
                <p className="qada-court-muted text-sm leading-7">لم يترافع المدعي العام بعد.</p>
              )
            )}

            {resultTab === 'bench' && (
              latestBench ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {latestBench.ruling.opinions.map((opinion) => (
                      <article key={opinion.seatId} className="qada-court-item rounded-2xl p-3.5">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-black">{roster.bench.find((seat) => seat.id === opinion.seatId)?.title || opinion.seatId}</h4>
                          <span className="qada-court-outcome text-[11px] font-black" data-outcome={opinion.vote}>{VOTE_LABELS[opinion.vote]}</span>
                        </div>
                        <p className="mt-1.5 text-xs leading-6">{opinion.reasoning}</p>
                        {opinion.decisiveIssues.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {opinion.decisiveIssues.map((issue, index) => <li key={index} className="qada-court-muted text-[11px] leading-6">• {issue}</li>)}
                          </ul>
                        )}
                      </article>
                    ))}
                  </div>
                  {latestBench.ruling.curableDefects.length > 0 && (
                    <div>
                      <div className="qada-court-label mb-1.5 text-xs font-bold">عيوب يعالجها فريق الدفاع</div>
                      <ul className="space-y-1.5">
                        {latestBench.ruling.curableDefects.map((item, index) => <li key={index} className="qada-court-item rounded-xl px-3 py-2 text-xs leading-6">{item}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p className="qada-court-muted text-sm leading-7">لم تبدأ مداولة الهيئة بعد.</p>
              )
            )}

            {resultTab === 'pleading' && (
              latestDefense?.brief.pleading ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="qada-court-label text-xs font-bold">
                      {pleadingTypeFor(systemId, levelId, clientRole)} — أقوى نسخة من الجولة {[...rounds].reverse().find((item) => item.defense)?.round}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => void handleCopy()} className="qada-court-secondary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-bold">
                        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                        {copied ? 'تم النسخ' : 'نسخ المذكرة'}
                      </button>
                      {onAdoptPleading && (
                        <button type="button" onClick={handleAdopt} disabled={running} className="qada-court-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-black">
                          <Check className="h-4 w-4" aria-hidden="true" />
                          {adopted ? 'اعتُمدت في المحرر' : 'اعتماد المذكرة في المحرر'}
                        </button>
                      )}
                    </div>
                  </div>
                  {onAdoptPleading && (
                    <p className="qada-court-muted text-[11px] leading-6">بعد الاعتماد تمر المذكرة من جديد ببوابة القاضي الافتراضي قبل الطباعة أو التصدير.</p>
                  )}
                  <div className="qada-court-paper max-h-[560px] overflow-y-auto whitespace-pre-wrap rounded-2xl p-5 text-sm leading-8">
                    {latestDefense.brief.pleading}
                  </div>
                  {latestDefense.brief.requests.length > 0 && (
                    <div>
                      <div className="qada-court-label mb-1.5 text-xs font-bold">الطلبات</div>
                      <ol className="space-y-1.5">
                        {latestDefense.brief.requests.map((item, index) => (
                          <li key={index} className="qada-court-item rounded-xl px-3 py-2 text-xs leading-6">{index + 1}. {item}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              ) : (
                <p className="qada-court-muted text-sm leading-7">لم يحرر فريق الدفاع المذكرة بعد.</p>
              )
            )}

            {resultTab === 'winplan' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-black qada-court-title">
                  <ListChecks className="h-4 w-4" aria-hidden="true" />
                  {decision?.nextStep === 'won' ? 'لتثبيت النتيجة أمام المحكمة الفعلية' : 'ما يلزم لقلب النتيجة لصالحك'}
                </div>
                {winPlan.length > 0 ? (
                  <ul className="space-y-1.5">
                    {winPlan.map((item, index) => (
                      <li key={index} className="qada-court-item flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-6">
                        <CircleAlert className="mt-1 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="qada-court-muted text-sm leading-7">لم تُرصد نواقص إضافية في هذه الجلسة.</p>
                )}
                <p className="qada-court-muted text-[11px] leading-6">
                  أضف ما ينقص إلى ملف القضية ثم افتح جلسة جديدة؛ المحامون يبنون على الدليل الجديد ولا يكتفون بالصياغة.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
