import { useEffect, useState } from 'react';
import {
  BookOpenCheck,
  Brain,
  FileSearch,
  FileText,
  Gavel,
  Landmark,
  ListChecks,
  Pause,
  Play,
  Route,
  Scale,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';

// Illustrates the real QADA pipeline (case router → specialist agents →
// official sources → verification gate → drafting). It is a diagram, not a
// live run, and says so.

type Tone = 'gold' | 'blue' | 'violet' | 'green' | 'brass' | 'rose';

type FlowNode = {
  id: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tone: Tone;
  steps: number[];
};

const STEPS = [
  'سؤالك يصل إلى موجّه القضية',
  'الذاكرة والخطة تحددان المسار',
  'التوزيع على الوكلاء المتخصصين',
  'الوكلاء يرجعون إلى المصادر الموثقة',
  'بوابة التحقق تفحص كل نتيجة',
  'صياغة جواب موثق مع مصادره',
];

const QUERY: FlowNode = { id: 'query', title: 'سؤالك أو قصتك', subtitle: 'نص + مرفقات', icon: UserRound, tone: 'gold', steps: [1, 6] };
const MEMORY: FlowNode = { id: 'memory', title: 'الذاكرة', subtitle: 'سياق المحادثة', icon: Brain, tone: 'blue', steps: [2] };
const ROUTER: FlowNode = { id: 'router', title: 'موجّه القضية', subtitle: 'الاختصاص والمسار', icon: Route, tone: 'gold', steps: [1, 2, 3, 5] };
const PLANNING: FlowNode = { id: 'planning', title: 'الخطة', subtitle: 'المرحلة والمهمة', icon: ListChecks, tone: 'violet', steps: [2] };

const AGENTS: FlowNode[] = [
  { id: 'facts', title: 'الوقائع والإثبات', subtitle: 'تسلسل وأدلة', icon: FileSearch, tone: 'green', steps: [3] },
  { id: 'laws', title: 'الأنظمة والمراسيم', subtitle: 'نص وسريان', icon: Landmark, tone: 'green', steps: [3] },
  { id: 'procedure', title: 'الاختصاص والإجراءات', subtitle: 'مواعيد وشكل', icon: Scale, tone: 'green', steps: [3] },
];

const SOURCES: FlowNode[] = [
  { id: 'attachments', title: 'مرفقاتك', subtitle: 'PDF · صور', icon: FileText, tone: 'brass', steps: [4] },
  { id: 'boe', title: 'الفهرس الرسمي', subtitle: 'هيئة الخبراء', icon: BookOpenCheck, tone: 'brass', steps: [4] },
  { id: 'uqn', title: 'أم القرى', subtitle: 'التعديلات والقرارات', icon: ScrollText, tone: 'brass', steps: [4] },
];

const VERIFY: FlowNode = { id: 'verify', title: 'بوابة التحقق', subtitle: 'المصدر · السريان · القاضي الافتراضي', icon: ShieldCheck, tone: 'rose', steps: [5] };
const DRAFT: FlowNode = { id: 'draft', title: 'وكيل الصياغة', subtitle: 'حُجّة وبيان', icon: Gavel, tone: 'violet', steps: [6] };
const ANSWER: FlowNode = { id: 'answer', title: 'الجواب + المصادر', subtitle: 'مع ما يحتاج تحققاً', icon: Sparkles, tone: 'gold', steps: [6] };

const STEP_MS = 2800;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!query) return;
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

function Node({ node, step, wide = false }: { node: FlowNode; step: number; wide?: boolean }) {
  const Icon = node.icon;
  const active = node.steps.includes(step);
  return (
    <div className={`qd-flow-node qd-tone-${node.tone}${wide ? ' qd-flow-node-wide' : ''}`} data-active={active || undefined}>
      <span className="qd-flow-icon" aria-hidden="true">
        <Icon className="h-4 w-4" strokeWidth={1.9} />
      </span>
      <span className="qd-flow-text">
        <span className="qd-flow-title">{node.title}</span>
        <span className="qd-flow-sub">{node.subtitle}</span>
      </span>
    </div>
  );
}

function Rail({ active, tone = 'gold' }: { active: boolean; tone?: Tone }) {
  return <div className={`qd-flow-rail qd-tone-${tone}`} data-active={active || undefined} aria-hidden="true" />;
}

export function AgentFlowDiagram({ className = '' }: { className?: string }) {
  const reducedMotion = usePrefersReducedMotion();
  const [step, setStep] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [hovered, setHovered] = useState(false);
  const running = playing && !hovered && !reducedMotion;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setStep((current) => (current % STEPS.length) + 1), STEP_MS);
    return () => window.clearInterval(timer);
  }, [running]);

  return (
    <figure
      className={`qd-flow ${className}`}
      aria-label="كيف تعالج QADA سؤالك: سؤال واحد ووكلاء متخصصون"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <figcaption className="qd-flow-head">
        <span className="qd-flow-kicker">سؤال واحد، ووكلاء متخصصون</span>
        <span className="qd-flow-heading">كيف تعالج QADA سؤالك؟</span>
        <span className="qd-flow-caption">
          <span className="qd-flow-step-no">{step}/{STEPS.length}</span>
          {STEPS[step - 1]}
        </span>
      </figcaption>

      <div className="qd-flow-board" data-step={step}>
        <div className="qd-flow-row qd-flow-center">
          <Node node={QUERY} step={step} />
        </div>
        <Rail active={step === 1 || step === 6} />

        <div className="qd-flow-row qd-flow-hub">
          <Node node={MEMORY} step={step} />
          <span className="qd-flow-link qd-tone-blue" data-active={step === 2 || undefined} aria-hidden="true" />
          <Node node={ROUTER} step={step} />
          <span className="qd-flow-link qd-tone-violet" data-active={step === 2 || undefined} aria-hidden="true" />
          <Node node={PLANNING} step={step} />
        </div>
        <Rail active={step === 3 || step === 5} tone="green" />

        <div className="qd-flow-fan" data-active={step === 3 || step === 5 || undefined} aria-hidden="true" />
        <div className="qd-flow-row qd-flow-trio">
          {AGENTS.map((agent) => <Node key={agent.id} node={agent} step={step} />)}
        </div>

        <div className="qd-flow-band" data-active={step === 4 || undefined}>
          <span className="qd-flow-band-label">مصادر موثقة فقط</span>
          <div className="qd-flow-row qd-flow-trio">
            {SOURCES.map((source) => <Node key={source.id} node={source} step={step} />)}
          </div>
        </div>
        <Rail active={step === 5} tone="rose" />

        <div className="qd-flow-row qd-flow-center">
          <Node node={VERIFY} step={step} wide />
        </div>
        <Rail active={step === 6} tone="violet" />

        <div className="qd-flow-row qd-flow-center">
          <Node node={DRAFT} step={step} />
        </div>
        <Rail active={step === 6} />

        <div className="qd-flow-row qd-flow-center">
          <Node node={ANSWER} step={step} wide />
        </div>
      </div>

      <div className="qd-flow-controls">
        <div className="qd-flow-steps" role="group" aria-label="مراحل المسار">
          {STEPS.map((label, index) => (
            <button
              key={label}
              type="button"
              className="qd-flow-dot"
              aria-label={`المرحلة ${index + 1}: ${label}`}
              aria-pressed={step === index + 1}
              onClick={() => {
                setStep(index + 1);
                setPlaying(false);
              }}
            />
          ))}
        </div>
        {!reducedMotion && (
          <button
            type="button"
            className="qd-flow-play"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? 'إيقاف الحركة' : 'تشغيل الحركة'}
          >
            {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>

      <p className="qd-flow-note">رسم توضيحي لمسار العمل داخل المنصة، وليس عرضاً لتشغيل حي.</p>
    </figure>
  );
}
