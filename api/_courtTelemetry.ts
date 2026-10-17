import { isRedisConfigured, redisCommand, redisPrefix } from './_redis.js';
import { protectJson } from './_secureStore.js';
import {
  LAWYER_TEAM,
  NEXT_STEP_LABELS,
  OUTCOME_LABELS,
  VOTE_LABELS,
  buildCourtRoster,
  type BenchRuling,
  type CourtLevelId,
  type CourtSystemId,
  type DefenseBrief,
  type DeterministicFindings,
  type ProsecutionBrief,
  type SessionDecision,
} from '../src/lib/judicialSystem.js';

// Virtual-court sessions feed the admin agent map so the room shows real activity.
// Only agent statuses and counts are recorded: no case text, no parties, no user identity.

type CourtAgentRun = {
  id: string;
  label: string;
  status: 'success' | 'warning' | 'error';
  durationMs: number;
  summary: string;
  blockers?: string[];
};

export type CourtRunSnapshot = {
  runId: string;
  documentTitle: string;
  analyzedAt: number;
  agentRuns: CourtAgentRun[];
  sourcePackets: [];
  meta: {
    architecture: 'virtual-court-v1';
    state: 'completed';
    live: false;
    buildCommit: string;
    courtSystem: CourtSystemId;
    courtLevel: CourtLevelId;
    rounds: number;
    outcome: SessionDecision['outcome'];
    completedAgents: number;
    warningAgents: number;
    failedAgents: number;
  };
};

export function courtRunsKey(): string {
  return `${redisPrefix()}:admin:court-runs`;
}

function buildCommit(): string {
  return process.env.RAILWAY_GIT_COMMIT_SHA
    || process.env.QADA_RELEASE
    || process.env.VERCEL_GIT_COMMIT_SHA
    || '';
}

function roundsLabel(rounds: number): string {
  if (rounds === 1) return 'جولة واحدة';
  if (rounds === 2) return 'جولتين';
  return `${rounds} جولات`;
}

export function buildCourtRunSnapshot(args: {
  systemId: CourtSystemId;
  levelId: CourtLevelId;
  round: number;
  defense: DefenseBrief;
  prosecution: ProsecutionBrief;
  ruling: BenchRuling;
  decision: SessionDecision;
  findings: DeterministicFindings;
  benchDurationMs: number;
}): CourtRunSnapshot {
  const { systemId, levelId, round, defense, prosecution, ruling, decision, findings } = args;
  const roster = buildCourtRoster(systemId, levelId);
  const agentRuns: CourtAgentRun[] = [];

  agentRuns.push({
    id: 'virtual-court',
    label: 'المحكمة الافتراضية',
    status: 'success',
    durationMs: 0,
    summary: `${roster.level.courtName}: ${OUTCOME_LABELS[decision.outcome]} بعد ${roundsLabel(round)} — ${NEXT_STEP_LABELS[decision.nextStep]}`,
  });

  for (const seat of LAWYER_TEAM) {
    const opinion = defense.lawyers.find((item) => item.roleId === seat.id);
    let status: CourtAgentRun['status'] = opinion?.delivered ? 'success' : 'warning';
    let summary = opinion?.delivered
      ? `قدّم رأيه ضمن مرافعة الجولة ${round}.`
      : 'لم يقدم رأياً مكتملاً في الجولة الأخيرة.';
    const blockers: string[] = [];

    if (seat.id === 'statutes' && findings.unsupportedCitations.length > 0) {
      status = 'warning';
      summary = `أسقطت بوابة الإحالات ${findings.unsupportedCitations.length} إحالة غير متحققة من مذكرة الدفاع.`;
      blockers.push('إحالات نظامية غير موجودة في الملف أو حزمة المصادر الرسمية.');
    }
    if (seat.id === 'drafting-advocacy' && findings.claimLiberationIssues.length > 0) {
      status = 'warning';
      summary = `لائحة الدعوى ينقصها ${findings.claimLiberationIssues.length} من شروط التحرير.`;
      blockers.push('أركان تحرير الدعوى غير مكتملة (البيانات، الوقائع، المستندات، الطلبات).');
    }

    agentRuns.push({ id: seat.contractId, label: seat.title, status, durationMs: 0, summary, ...(blockers.length ? { blockers } : {}) });
  }

  const severe = prosecution.attacks.filter((attack) => attack.severity === 'high').length;
  agentRuns.push({
    id: 'public-prosecutor',
    label: roster.prosecutor.title,
    status: prosecution.strongestAttack || prosecution.attacks.length ? 'success' : 'warning',
    durationMs: 0,
    summary: `${roster.prosecutor.represents}: ${prosecution.attacks.length} هجمات، منها ${severe} خطيرة.`,
  });

  const silentSeats = ruling.opinions.filter((opinion) => !opinion.delivered).length;
  const verdict = `الحكم المحاكى: ${OUTCOME_LABELS[decision.outcome]} — الجولة ${round}.`;
  const downgrade = decision.downgradedReasons.slice(0, 3);

  if (levelId === 'supreme') {
    // The cassation panel both deliberates and rules: one map node, one entry.
    const tally = decision.majority || { favorable: 0, partial: 0, unfavorable: 0 };
    const blockers = [
      ...(silentSeats ? [`${silentSeats} من قضاة النقض لم يقدم رأياً مسبباً.`] : []),
      ...downgrade,
    ];
    agentRuns.push({
      id: 'cassation-judge',
      label: 'قضاة النقض × 3',
      status: blockers.length ? 'warning' : 'success',
      durationMs: args.benchDurationMs,
      summary: `القرار بالأغلبية: مع الموكل ${tally.favorable} • جزئي ${tally.partial} • ضد الموكل ${tally.unfavorable}. ${verdict}`,
      ...(blockers.length ? { blockers } : {}),
    });
  } else {
    agentRuns.push({
      id: 'judge-agent',
      label: 'وكيلا القاضي',
      status: silentSeats ? 'warning' : 'success',
      durationMs: args.benchDurationMs,
      summary: ruling.opinions.map((opinion, index) => `الوكيل ${index + 1}: ${VOTE_LABELS[opinion.vote]}`).join(' • '),
      ...(silentSeats ? { blockers: [`${silentSeats} من وكيلي القاضي لم يقدم رأياً مسبباً.`] } : {}),
    });
    agentRuns.push({
      id: 'presiding-judge',
      label: 'القاضي مُصدر الحكم',
      status: downgrade.length ? 'warning' : 'success',
      durationMs: args.benchDurationMs,
      summary: verdict,
      ...(downgrade.length ? { blockers: downgrade } : {}),
    });
  }

  return {
    runId: `court-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    documentTitle: `جلسة المحكمة الافتراضية — ${roster.system.title} / ${roster.level.shortName}`,
    analyzedAt: Date.now(),
    agentRuns,
    sourcePackets: [],
    meta: {
      architecture: 'virtual-court-v1',
      state: 'completed',
      live: false,
      buildCommit: buildCommit(),
      courtSystem: systemId,
      courtLevel: levelId,
      rounds: round,
      outcome: decision.outcome,
      completedAgents: agentRuns.filter((run) => run.status === 'success').length,
      warningAgents: agentRuns.filter((run) => run.status === 'warning').length,
      failedAgents: agentRuns.filter((run) => run.status === 'error').length,
    },
  };
}

export async function recordCourtSessionRun(snapshot: CourtRunSnapshot): Promise<void> {
  if (!isRedisConfigured()) return;
  await redisCommand(['LPUSH', courtRunsKey(), protectJson(snapshot, 'admin-run')]);
  await redisCommand(['LTRIM', courtRunsKey(), 0, 19]);
}
