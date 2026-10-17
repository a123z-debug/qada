import fs from 'node:fs';
import { AGENT_CONTRACTS } from '../src/lib/agentContracts';
import { detectCourtProfile } from '../src/lib/courtProfiles';
import {
  COURT_SYSTEMS,
  LAWYER_TEAM,
  MAX_SESSION_ROUNDS,
  allCourtRosters,
  decideNextStep,
  normalizeBenchRuling,
  normalizeDefenseBrief,
  resolveSessionDecision,
} from '../src/lib/judicialSystem';
import {
  assessDefenseFindings,
  buildBenchPrompt,
  buildCourtSourceBundle,
  buildDefensePrompt,
  buildProsecutionPrompt,
  parseCourtStageRequest,
  runCourtStage,
  type CourtGenerator,
  type CourtStageInput,
} from '../api/_courtEngine';
import { buildCourtRunSnapshot } from '../api/_courtTelemetry';
import { LITIGATION_DEADLINES, buildDeadlinesInstruction, deadlinesFor } from '../src/lib/litigationDeadlines';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

// ---------------------------------------------------------------------------
// 1. الهيكل: 6 جهات × 3 درجات، هيئة ومدعٍ عام وستة محامين في كل محكمة
// ---------------------------------------------------------------------------

assert(
  COURT_SYSTEMS.map((system) => system.id).join(',') === 'commercial,general,labor,personal-status,administrative,criminal',
  'Court systems must be: commercial, general, labor, personal status, administrative (Board of Grievances), criminal — in that order',
);

const rosters = allCourtRosters();
assert(rosters.length === 18, 'Expected 18 courts (6 systems × 3 levels), got ' + rosters.length);

const contractIds = new Set(AGENT_CONTRACTS.map((contract) => contract.id));
const expectedLawyers = ['facts-references', 'gaps', 'drafting-advocacy', 'statutes', 'super-lawyer', 'former-judge'];

for (const roster of rosters) {
  const where = `${roster.system.id}/${roster.level.id}`;
  assert(roster.level.courtName.trim().length > 0, 'Court name missing: ' + where);

  assert(roster.lawyers.length === 6, 'Each court needs six lawyers: ' + where);
  assert(roster.lawyers.map((lawyer) => lawyer.id).join(',') === expectedLawyers.join(','), 'Lawyer roles out of order: ' + where);

  const rulingSeats = roster.bench.filter((seat) => seat.issuesRuling);
  assert(rulingSeats.length === 1, 'Exactly one bench seat must issue the ruling: ' + where);

  if (roster.level.id === 'supreme') {
    assert(roster.bench.length === 3 && roster.bench.every((seat) => seat.kind === 'cassation-judge'),
      'Cassation courts need three cassation judges: ' + where);
  } else {
    assert(roster.bench.filter((seat) => seat.kind === 'judge-agent').length === 2, 'Two judge agents required: ' + where);
    assert(rulingSeats[0].kind === 'presiding-judge', 'Final judge must issue the ruling: ' + where);
  }

  assert(roster.prosecutor.title.includes('المدعي العام'), 'Public prosecutor missing: ' + where);
  for (const id of [...roster.lawyers.map((lawyer) => lawyer.contractId), ...roster.bench.map((seat) => seat.contractId), roster.prosecutor.contractId]) {
    assert(contractIds.has(id), `Courtroom role has no agent contract: ${id} (${where})`);
  }
}

assert(rosters.find((roster) => roster.system.id === 'criminal')?.prosecutor.represents.includes('النيابة العامة'),
  'Criminal prosecutor must represent the public prosecution');
assert(COURT_SYSTEMS.find((system) => system.id === 'administrative')?.levels.supreme.courtName === 'المحكمة الإدارية العليا',
  'Administrative cassation must sit at the Supreme Administrative Court');

for (const id of ['lawyer-facts-references', 'lawyer-gaps', 'lawyer-drafting-advocacy', 'lawyer-statutes', 'lawyer-super', 'lawyer-former-judge', 'judge-agent', 'presiding-judge', 'cassation-judge', 'public-prosecutor']) {
  const contract = AGENT_CONTRACTS.find((item) => item.id === id);
  assert(contract, 'Missing courtroom contract: ' + id);
  assert(contract.mustNot.some((rule) => /اختراع|غير متحقق|مجاملة|التحول|نسبة توجه|وعد|بناء النصر/.test(rule)),
    'Courtroom contract must forbid fabrication or bias: ' + id);
}

// Court profiles route every level of every system.
const expectedProfiles: Record<string, string> = {
  'commercial/first': 'commercial-first',
  'commercial/appeal': 'commercial-appeal',
  'commercial/supreme': 'supreme',
  'general/first': 'general-first',
  'general/appeal': 'general-appeal',
  'general/supreme': 'supreme',
  'labor/first': 'labor-first',
  'labor/appeal': 'labor-appeal',
  'labor/supreme': 'supreme',
  'personal-status/first': 'personal-status-first',
  'personal-status/appeal': 'personal-status-appeal',
  'personal-status/supreme': 'supreme',
  'administrative/first': 'administrative-first',
  'administrative/appeal': 'administrative-appeal',
  'administrative/supreme': 'administrative-supreme',
  'criminal/first': 'criminal-first',
  'criminal/appeal': 'criminal-appeal',
  'criminal/supreme': 'supreme',
};
for (const roster of rosters) {
  const key = `${roster.system.id}/${roster.level.id}`;
  const actual = detectCourtProfile(roster.level.profileHint).id;
  assert(actual === expectedProfiles[key], `Court profile routing failed for ${key}: ${actual}`);
}
assert(detectCourtProfile('المحكمة العامة مطالبة مالية').id === 'general-first', 'Commercial routing must not swallow general-court cases');

// المدد النظامية: لكل جهة مددها، بسند رسمي، ولا تختلط مدد جهة بأخرى.
const ALL_DEADLINES = Object.values(LITIGATION_DEADLINES).flat();
for (const deadline of ALL_DEADLINES) {
  assert(deadline.source.url.startsWith('https://laws.boe.gov.sa/'), 'Deadline must link to the official BOE text: ' + deadline.id);
  assert(/^المادة \(\d+\)/.test(deadline.article), 'Deadline article must be numeric for the citation guard: ' + deadline.id);
  assert(deadline.officialText.length >= 60 && deadline.period && deadline.startsFrom, 'Deadline needs period, start and official text: ' + deadline.id);
  assert(deadline.levels.length > 0, 'Deadline must apply to at least one level: ' + deadline.id);
}
for (const system of COURT_SYSTEMS) {
  assert(deadlinesFor(system.id, 'appeal').some((deadline) => deadline.kind === 'objection'), 'Appeal period missing: ' + system.id);
  assert(deadlinesFor(system.id, 'supreme').some((deadline) => deadline.kind === 'objection'), 'Cassation period missing: ' + system.id);
}

const serviceRights = LITIGATION_DEADLINES.administrative.find((deadline) => deadline.id === 'grievances-8-1-service-rights');
assert(serviceRights?.period === 'عشر سنوات' && serviceRights.article === 'المادة (8) الفقرة (1)' && serviceRights.status === 'verified',
  'Board of Grievances: service-rights grievance must be ten years under Article 8(1)');
assert(LITIGATION_DEADLINES.administrative.find((deadline) => deadline.id === 'grievances-8-6-limitation')?.period === 'عشر سنوات',
  'Board of Grievances: compensation and contract claims must be ten years under Article 8(6)');
assert(LITIGATION_DEADLINES.administrative.find((deadline) => deadline.id === 'grievances-8-4-cancellation-grievance')?.period === 'ستون يوماً',
  'Board of Grievances: cancellation grievance must be sixty days under Article 8(4)');
assert(LITIGATION_DEADLINES.commercial.find((deadline) => deadline.kind === 'limitation')?.period === 'خمس سنوات',
  'Commercial courts: limitation must be five years under Article 24');
assert(LITIGATION_DEADLINES.general.find((deadline) => deadline.id === 'civil-295-limitation')?.period === 'عشر سنوات',
  'General courts: civil limitation must be ten years under Civil Transactions Article 295');
assert(deadlinesFor('general', 'first').some((deadline) => deadline.period === 'ثمانية أيام على الأقل')
  && deadlinesFor('labor', 'first').some((deadline) => deadline.period === 'أربعة أيام على الأقل'),
  'Attendance must be eight days in general courts and four days in specialized courts');
assert(LITIGATION_DEADLINES.labor.find((deadline) => deadline.kind === 'limitation')?.status === 'verify',
  'Labor Article 222 sits in a chapter marked repealed on BOE; it must stay flagged for verification');
assert(!deadlinesFor('commercial', 'first').some((deadline) => deadline.source.law === 'نظام المرافعات أمام ديوان المظالم')
  && !deadlinesFor('administrative', 'first').some((deadline) => deadline.source.law === 'نظام المحاكم التجارية'),
  'Deadlines of one court system must not leak into another');

const grievancesBlock = buildDeadlinesInstruction('administrative', 'first');
assert(grievancesBlock.includes('عشر سنوات') && grievancesBlock.includes('المادة (8) الفقرة (1)') && grievancesBlock.includes('مرسوم ملكي رقم (م/3)'),
  'Administrative deadlines block must carry the ten-year rule with its article and decree');

// ---------------------------------------------------------------------------
// 2. المطالبات مربوطة بعقود الأدوار وحدود عدم الاختلاق
// ---------------------------------------------------------------------------

const baseInput: CourtStageInput = {
  stage: 'defense',
  systemId: 'commercial',
  levelId: 'first',
  clientRole: 'claimant',
  round: 1,
  caseFile: {
    title: 'مطالبة بقيمة توريدات',
    facts: 'وردت شركتنا بضائع لشركة أخرى بموجب عقد توريد وفواتير مؤرخة، واستلمت الشركة البضاعة ولم تسدد المبلغ المتبقي رغم المطالبة بالبريد. هوية المفوض 1234567890.',
    requests: 'إلزام المدعى عليها بسداد قيمة الفواتير المتبقية',
    documentsText: '',
  },
};

const defensePrompt = buildDefensePrompt(baseInput, '[حزمة المصادر]');
for (const seat of LAWYER_TEAM) {
  const label = AGENT_CONTRACTS.find((contract) => contract.id === seat.contractId)?.label;
  assert(label && defensePrompt.includes(`[عقد الوكيل: ${label}]`), 'Defense prompt not bound to contract: ' + seat.contractId);
}
assert(defensePrompt.includes('لا تخترعوا واقعة') && defensePrompt.includes('لا تذكروا مادة'), 'Defense prompt must forbid invented facts and law');
assert(defensePrompt.includes('missingEvidence'), 'Defense must route unprovable claims to missingEvidence');

const prosecutionPrompt = buildProsecutionPrompt({ ...baseInput, stage: 'prosecution' }, '[حزمة المصادر]');
assert(prosecutionPrompt.includes('[عقد الوكيل: المدعي العام]') && prosecutionPrompt.includes('لا تخترع واقعة'),
  'Prosecutor prompt must carry its contract and the no-fabrication rule');

const noFindings = { unsupportedCitations: [], claimLiberationIssues: [] };
const benchPrompt = buildBenchPrompt({ ...baseInput, stage: 'bench' }, '[حزمة المصادر]', noFindings);
assert(benchPrompt.includes('الحياد واجب') && benchPrompt.includes('[عقد الوكيل: القاضي مُصدر الحكم]'), 'Bench prompt must be neutral and bound to the final judge');
const supremePrompt = buildBenchPrompt({ ...baseInput, stage: 'bench', levelId: 'supreme' }, '[حزمة المصادر]', noFindings);
assert(supremePrompt.includes('بالأغلبية') && supremePrompt.includes('لا تعيدوا وزن الأدلة') && supremePrompt.includes('[عقد الوكيل: قاضي النقض]'),
  'Cassation bench must decide by majority without reweighing evidence');

// كتلة المدد جزء من حزمة المصادر: الإحالة إلى المادة الثامنة في دعوى إدارية متحققة، وتصل للهيئة.
const adminInput: CourtStageInput = { ...baseInput, systemId: 'administrative' };
const adminContext = buildCourtSourceBundle(adminInput).context;
assert(adminContext.includes('[المدد النظامية لهذه المحكمة'), 'Court source context must carry the deadlines block');
assert(!buildCourtSourceBundle(baseInput).context.includes('عشر سنوات من تاريخ نشوء الحق المدعى به'),
  'Commercial court context must not carry Board of Grievances periods');
const article8Findings = assessDefenseFindings(
  adminInput,
  normalizeDefenseBrief({ pleading: 'تظلم المدعي إلى الجهة خلال المدة المقررة في المادة (8) الفقرة (1) من نظام المرافعات أمام ديوان المظالم الصادر بموجب مرسوم ملكي رقم (م/3).' }),
  adminContext,
);
assert(article8Findings.unsupportedCitations.length === 0,
  'Citing Article 8 from the verified deadlines block must not be flagged: ' + article8Findings.unsupportedCitations.join('، '));
assert(buildBenchPrompt({ ...adminInput, stage: 'bench' }, adminContext, noFindings).includes('المادة (8) الفقرة (1)'),
  'Bench prompt must see the Board of Grievances periods');

// ---------------------------------------------------------------------------
// 3. تشغيل جلسة كاملة بنموذج وهمي (بدون شبكة)
// ---------------------------------------------------------------------------

const seenPrompts: string[] = [];
function fakeModel(replies: unknown[]): CourtGenerator {
  let index = 0;
  return async (prompt) => {
    seenPrompts.push(prompt);
    const reply = replies[Math.min(index, replies.length - 1)];
    index += 1;
    return typeof reply === 'string' ? reply : JSON.stringify(reply);
  };
}

const lawyersReply = expectedLawyers.map((roleId) => ({ roleId, summary: `رأي ${roleId}`, points: ['نقطة محددة'] }));
const fabricatedDefense = {
  theory: 'التزام ثابت بالفواتير والاستلام',
  lawyers: lawyersReply,
  pleading: [
    'البيانات',
    'المدعي: شركة التوريد بصفتها البائع. المدعى عليه: الشركة المستلمة بصفتها المشتري. المحكمة: المحكمة التجارية.',
    'الوقائع',
    'أبرم الطرفان عقد توريد، وورّدت المدعية البضائع بموجب فواتير مؤرخة، واستلمتها المدعى عليها دون اعتراض، ثم امتنعت عن سداد المبلغ المتبقي رغم المطالبة بالبريد. وتنص المادة (999) من نظام وهمي على الإلزام.',
    'المستندات',
    'عقد التوريد، والفواتير المؤرخة، ومراسلات المطالبة بالبريد.',
    'الطلبات',
    'نطلب الحكم بإلزام المدعى عليها بسداد قيمة الفواتير المتبقية.',
  ].join('\n'),
  requests: ['إلزام المدعى عليها بسداد قيمة الفواتير'],
  oralArguments: ['الاستلام ثابت بتوقيع المدعى عليها'],
  missingEvidence: ['كشف حساب مطابق'],
  authorities: ['نظام وهمي — المادة (999)'],
};

const defenseResult = await runCourtStage(baseInput, fakeModel([fabricatedDefense]));
assert(defenseResult.stage === 'defense', 'Defense stage result expected');
assert(!seenPrompts.some((prompt) => prompt.includes('1234567890')), 'National ID must be redacted before reaching the AI provider');
assert(defenseResult.findings.unsupportedCitations.some((marker) => marker.includes('999')), 'Fabricated citation must be detected');
assert(defenseResult.brief.pleading.includes('[غير متحقق من حزمة المصادر الرسمية]'), 'Fabricated citation must be labelled inside the pleading');
assert(!defenseResult.brief.authorities.some((item) => item.includes('999')), 'Fabricated authority must be dropped');
assert(defenseResult.brief.lawyers.length === 6 && defenseResult.brief.lawyers.every((lawyer) => lawyer.delivered), 'All six lawyers must report');

const prosecutionResult = await runCourtStage(
  { ...baseInput, stage: 'prosecution', defense: defenseResult.brief },
  fakeModel([{ strongestAttack: 'لا يثبت الاستلام بالفواتير وحدها', attacks: [{ point: 'غياب محضر الاستلام', target: 'الإثبات', severity: 'high' }], demands: 'رد الدعوى' }]),
);
assert(prosecutionResult.stage === 'prosecution' && prosecutionResult.brief.attacks[0].severity === 'high', 'Prosecution stage must normalize attacks');

const favorableBench = {
  opinions: [
    { seatId: 'judge-agent-1', vote: 'favorable', reasoning: 'الاختصاص منعقد', decisiveIssues: [] },
    { seatId: 'judge-agent-2', vote: 'favorable', reasoning: 'الاستلام ثابت', decisiveIssues: [] },
  ],
  finalJudgment: { outcome: 'favorable', operative: 'حكمت المحكمة بإلزام المدعى عليها', reasons: ['ثبوت التوريد'] },
  curableDefects: [],
  evidentiaryGaps: [],
};

// The client tries to hide the fabricated citation: the bench recomputes it on the server.
const benchResult = await runCourtStage(
  { ...baseInput, stage: 'bench', defense: defenseResult.brief, prosecution: prosecutionResult.brief },
  fakeModel([favorableBench]),
);
assert(benchResult.stage === 'bench', 'Bench stage result expected');
assert(benchResult.decision.outcome === 'partial', 'A win built on an unverified citation must be capped at partial');
assert(benchResult.decision.nextStep === 'revise', 'Lawyers must get another round to fix curable defects');
assert(benchResult.ruling.curableDefects.some((item) => item.includes('999')), 'Unverified citation must become a curable defect');
assert(benchResult.decision.dissentingSeats.length === 0, 'A gate downgrade must not be reported as judicial dissent');

const cleanDefense = { ...fabricatedDefense, pleading: fabricatedDefense.pleading.replace(' وتنص المادة (999) من نظام وهمي على الإلزام.', ''), authorities: [] };
const roundTwo = await runCourtStage(
  {
    ...baseInput,
    round: 2,
    priorDefense: defenseResult.brief,
    priorProsecution: prosecutionResult.brief,
    priorBench: benchResult.ruling,
  },
  fakeModel([cleanDefense]),
);
assert(roundTwo.stage === 'defense' && roundTwo.findings.unsupportedCitations.length === 0, 'Revised pleading must be clean');
assert(seenPrompts[seenPrompts.length - 1].includes('الجولة 2') && seenPrompts[seenPrompts.length - 1].includes('999'),
  'Round two prompt must carry the bench reasons and the citation to remove');

const benchTwo = await runCourtStage(
  { ...baseInput, stage: 'bench', round: 2, defense: roundTwo.brief, prosecution: prosecutionResult.brief },
  fakeModel([favorableBench]),
);
assert(benchTwo.stage === 'bench' && benchTwo.decision.outcome === 'favorable' && benchTwo.decision.nextStep === 'won',
  'A clean, favorable ruling must end the session as won');

// Cassation majority overrides a presiding opinion that contradicts the votes.
const majority = resolveSessionDecision(
  normalizeBenchRuling({
    opinions: [
      { seatId: 'cassation-judge-1', vote: 'favorable', reasoning: 'خطأ في تطبيق النظام' },
      { seatId: 'cassation-judge-2', vote: 'unfavorable', reasoning: 'لا عيب إجرائي' },
      { seatId: 'cassation-judge-3', vote: 'unfavorable', reasoning: 'مجادلة في الدليل' },
    ],
    finalJudgment: { outcome: 'favorable', operative: 'نقض الحكم', reasons: [] },
  }, 'supreme'),
  'supreme',
  1,
  noFindings,
);
assert(majority.decision.outcome === 'unfavorable' && majority.decision.majority?.unfavorable === 2, 'Cassation must follow the majority');

// Missing opinions never count for the client.
const silent = normalizeBenchRuling({ opinions: [], finalJudgment: { outcome: 'favorable' } }, 'supreme');
assert(silent.opinions.length === 3 && silent.opinions.every((opinion) => opinion.vote === 'unfavorable' && !opinion.delivered),
  'Silent cassation judges must fail closed');
assert(resolveSessionDecision(silent, 'supreme', 1, noFindings).decision.outcome === 'unfavorable', 'Silent bench cannot produce a win');

assert(decideNextStep('unfavorable', ['x'], [], MAX_SESSION_ROUNDS) === 'exhausted', 'Session must stop after the last round');
assert(decideNextStep('partial', [], ['مستند'], 1) === 'needs-client-input', 'Pure evidence gaps must go back to the client');

// Claim liberation applies to first-instance claims.
const unliberated = await runCourtStage(baseInput, fakeModel([{ ...cleanDefense, pleading: 'نطلب إلزام المدعى عليها بالسداد.' }]));
assert(unliberated.stage === 'defense' && unliberated.findings.claimLiberationIssues.length > 0, 'Unliberated claim must be flagged');

// Request parsing rejects malformed or incomplete stages.
assert(parseCourtStageRequest({ ...baseInput, stage: 'verdict' }).ok === false, 'Unknown stage must be rejected');
assert(parseCourtStageRequest({ ...baseInput, systemId: 'military' }).ok === false, 'Unknown court system must be rejected');
assert(parseCourtStageRequest({ ...baseInput, caseFile: { facts: 'قصير' } }).ok === false, 'Empty case file must be rejected');
assert(parseCourtStageRequest({ ...baseInput, stage: 'bench', defense: cleanDefense }).ok === false, 'Bench without prosecution must be rejected');
assert(parseCourtStageRequest({ ...baseInput, round: 4 }).ok === false, 'Rounds beyond the limit must be rejected');
assert(parseCourtStageRequest({ ...baseInput, stage: 'defense', round: 2 }).ok === false, 'Later rounds need the prior round');

let unavailable = '';
try {
  await runCourtStage(baseInput, async () => '');
} catch (error) {
  unavailable = error instanceof Error ? error.message : '';
}
assert(unavailable === 'AI_UNAVAILABLE', 'Empty provider output must fail the stage instead of inventing a result');

// ---------------------------------------------------------------------------
// 4. نبض غرفة الأدمن: حالات الوكلاء فقط، بلا نص القضية
// ---------------------------------------------------------------------------

const secretFact = 'وقائع-سرية-لا-تغادر-الجلسة-7731';
const telemetry = buildCourtRunSnapshot({
  systemId: 'commercial',
  levelId: 'first',
  round: 2,
  defense: { ...roundTwo.brief, pleading: roundTwo.brief.pleading + '\n' + secretFact, theory: secretFact },
  prosecution: { ...prosecutionResult.brief, strongestAttack: secretFact },
  ruling: benchTwo.ruling,
  decision: benchTwo.decision,
  findings: benchTwo.findings,
  benchDurationMs: 4200,
});
const telemetryJson = JSON.stringify(telemetry);
assert(!telemetryJson.includes(secretFact) && !telemetryJson.includes('1234567890'), 'Court telemetry must not carry case text or identifiers');
const mapSource = fs.readFileSync('src/components/admin/AdminAgentMap.tsx', 'utf8');
for (const run of telemetry.agentRuns) {
  assert(mapSource.includes(`id: '${run.id}'`), 'Telemetry agent is not a map node: ' + run.id);
}
assert(telemetry.agentRuns.length === 10 && telemetry.meta.outcome === 'favorable', 'First-instance telemetry must cover hub, six lawyers, prosecutor and the bench');
const cassationTelemetry = buildCourtRunSnapshot({
  systemId: 'administrative',
  levelId: 'supreme',
  round: 1,
  defense: roundTwo.brief,
  prosecution: prosecutionResult.brief,
  ruling: majority.ruling,
  decision: majority.decision,
  findings: noFindings,
  benchDurationMs: 3000,
});
assert(cassationTelemetry.agentRuns.filter((run) => run.id === 'cassation-judge').length === 1
  && !cassationTelemetry.agentRuns.some((run) => run.id === 'presiding-judge'),
  'Cassation telemetry must report one cassation panel entry and no presiding judge');
const adminRuns = fs.readFileSync('api/admin-runs.ts', 'utf8');
assert(adminRuns.includes('courtRunsKey()') && adminRuns.includes('courtRuns'), 'Admin run history must include court sessions');
const sessionApi = fs.readFileSync('api/court-session.ts', 'utf8');
assert(sessionApi.includes("result.decision.nextStep !== 'revise'") && sessionApi.includes('COURT_TELEMETRY_TIMEOUT'),
  'Court telemetry must be recorded once per finished session and never block the user');

// ---------------------------------------------------------------------------
// 5. ربط الخادم والواجهة
// ---------------------------------------------------------------------------

const api = fs.readFileSync('api/court-session.ts', 'utf8');
for (const marker of ['readActiveSession', "res.status(401).json({ error: 'AUTH_REQUIRED' })", "enforceRateLimit('court-session'", 'withTimeout(', 'STAGE_BUDGET_MS']) {
  assert(api.includes(marker), 'Court session API invariant missing: ' + marker);
}
const server = fs.readFileSync('server.ts', 'utf8');
assert(server.includes("app.post('/api/court-session'"), 'Local server route for the courtroom missing');

const courtroom = fs.readFileSync('src/components/courts/VirtualCourtroom.tsx', 'utf8');
for (const marker of ["fetch('/api/court-session'", 'qada-court-chamber', 'aria-live="polite"', 'role="tablist"', 'ليست حكماً قضائياً ولا تضمن نتيجة المحكمة', 'nextStageOf']) {
  assert(courtroom.includes(marker), 'Courtroom UI invariant missing: ' + marker);
}
const editor = fs.readFileSync('src/components/workspaces/LegalReviewEditor.tsx', 'utf8');
assert(editor.includes('<VirtualCourtroom') && editor.includes('المحكمة الافتراضية'), 'Editor must open the virtual court');
assert(editor.includes('hidden={activeTab !== \'courtroom\'}'), 'Courtroom must stay mounted across editor tabs');
const app = fs.readFileSync('src/App.tsx', 'utf8');
assert(app.includes('<CommercialWorkspace') && app.includes('<VirtualCourtroom') && app.includes('onOpenCourtroom={openCourtroom}'),
  'App must route the commercial court and the virtual court');
const css = fs.readFileSync('src/qada-8k.css', 'utf8');
assert(css.includes('.qada-court-chamber') && css.includes('.qada-court-paper') && css.includes('.qada-court-state[data-state="working"]::before { animation: none'),
  'Courtroom design layer must be in the 8K system with reduced-motion support');

console.log(JSON.stringify({
  ok: true,
  courtSystems: COURT_SYSTEMS.length,
  courts: rosters.length,
  seatsPerCourt: rosters[0].bench.length + 1 + rosters[0].lawyers.length,
  cassationJudges: rosters.find((roster) => roster.level.id === 'supreme')?.bench.length,
  maxRounds: MAX_SESSION_ROUNDS,
  offlineSession: ['defense', 'prosecution', 'bench', 'defense(r2)', 'bench(r2)=won'],
  guards: ['redaction', 'citation-guard', 'claim-liberation', 'majority', 'fail-closed'],
}, null, 2));
