import assert from 'node:assert/strict';

import { analyzeLawOfficeRoute } from '../src/lib/lawOfficeExpert';
import {
  buildQadaAgentOsInstruction,
  buildQadaAgentOsPlan,
  toAgentOsRouteInput,
} from '../src/lib/qadaAgentOs';

const verifiedBundle: any = {
  packets: [
    {
      agentId: 'src-bog',
      label: 'ديوان المظالم',
      status: 'success',
      scope: 'administrative',
      references: [],
      verifiedArticles: [],
      blockers: [],
    },
    {
      agentId: 'src-precedents',
      label: 'المبادئ',
      status: 'warning',
      scope: 'precedents',
      references: [],
      verifiedArticles: [],
      blockers: ['precedent corpus incomplete'],
    },
  ],
  runs: [],
  context: 'verified context',
  verification: {
    officialSources: 3,
    verifiedArticles: 4,
    blockers: [],
    literalQuotationReady: false,
    precedentCorpusReady: false,
  },
};

{
  const route = analyzeLawOfficeRoute(
    'أريد لائحة اعتراض على حكم ابتدائي صادر من المحكمة الإدارية مع الرد على دفوع الجهة',
    true,
  );
  const plan = buildQadaAgentOsPlan({
    route,
    sources: verifiedBundle,
    hasEvidence: true,
    responseMode: 'professional',
  });

  const ids = plan.team.map((agent) => agent.id);
  assert(ids.includes('case-router'), 'case router missing');
  assert(ids.includes('official-source'), 'official source verifier missing');
  assert(ids.includes('procedural-flaws'), 'procedural reviewer missing');
  assert(ids.includes('evidence-flaws'), 'evidence reviewer missing');
  assert(ids.includes('rebuttal-review'), 'red-team reviewer missing');
  assert(ids.includes('hujja-bayan'), 'drafting agent missing');
  assert(ids.includes('virtual-judge'), 'virtual judge gate missing');
  assert(plan.phases.some((phase) => phase.id === 'truth' && phase.gate), 'truth gate missing');
  assert(plan.phases.some((phase) => phase.id === 'release' && phase.gate), 'release gate missing');
  assert(plan.orchestrationConfidence > 0 && plan.orchestrationConfidence <= 1, 'invalid orchestration confidence');
}

{
  const route = analyzeLawOfficeRoute(
    'أريد لائحة استئناف على حكم صادر من محكمة الاستئناف الإدارية',
    true,
  );
  const plan = buildQadaAgentOsPlan({
    route,
    sources: verifiedBundle,
    hasEvidence: true,
    responseMode: 'simple',
  });

  assert.equal(plan.routeBlocked, true, 'second appeal route must block');
  assert.equal(plan.risk, 'critical', 'blocked route must be critical');
  assert(!plan.team.some((agent) => agent.id === 'hujja-bayan'), 'blocked route must not draft');
  assert(!plan.team.some((agent) => agent.id === 'virtual-judge'), 'blocked route must not reach release gate');
}

{
  const route = analyzeLawOfficeRoute('أريد مراجعة مستند إداري', true);
  const blockedBundle: any = {
    ...verifiedBundle,
    verification: {
      ...verifiedBundle.verification,
      blockers: ['amendment not verified', 'deadline source missing'],
    },
  };
  const plan = buildQadaAgentOsPlan({
    route,
    sources: blockedBundle,
    hasEvidence: true,
    responseMode: 'professional',
  });

  assert.equal(plan.truth.mode, 'blocked', 'source blockers must propagate into truth mode');
  assert(['high', 'critical'].includes(plan.risk), 'source blockers must raise risk');
  assert(plan.invariants.some((item) => item.includes('blocker')), 'fail-closed invariant missing');
}

{
  const route = analyzeLawOfficeRoute('أريد استشارة عن نزاع إداري', false);
  const plan = buildQadaAgentOsPlan({
    route,
    sources: verifiedBundle,
    hasEvidence: false,
    responseMode: 'simple',
  });
  const projection = toAgentOsRouteInput(plan);
  const instruction = buildQadaAgentOsInstruction(plan);

  assert(!/هوية|جوال|اسم العميل|1234567890/.test(projection), 'Agent OS projection must not include case identifiers');
  assert(projection.includes('capability planning'), 'Agent OS projection purpose missing');
  assert(instruction.includes('QADA Intelligence Kernel'), 'internal intelligence instruction missing');
  assert(instruction.includes('تظل بيانات القضية داخل QADA'), 'privacy invariant missing');
}

console.log(JSON.stringify({ ok: true, suite: 'qada-agent-os-intelligence' }));
