import fs from 'node:fs';
import { AGENT_CONTRACTS, PLATFORM_NODE_IDS, launchBlockingContracts } from '../src/lib/agentContracts';
import { allCourtProfiles, detectCourtProfile } from '../src/lib/courtProfiles';
import { allCaseStrategyProfiles, detectCaseStrategyProfile } from '../src/lib/caseStrategyProfiles';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const map = fs.readFileSync('src/components/admin/AdminAgentMap.tsx', 'utf8');
const adminAnalysis = fs.readFileSync('api/admin-analysis.ts', 'utf8');
const judgesReview = fs.readFileSync('api/judges-review.ts', 'utf8');
const hujja = fs.readFileSync('src/lib/hujjaBayanAgent.ts', 'utf8');
const nodesBlock = map.match(/const nodes: AgentNode\[\] = \[([\s\S]*?)\n\];/);
assert(nodesBlock, 'Admin agent map nodes block not found');
const mapIds = Array.from(nodesBlock[1].matchAll(/\bid:\s*'([^']+)'/g)).map((match) => match[1]);

const contractsById = new Map(AGENT_CONTRACTS.map((contract) => [contract.id, contract]));
assert(contractsById.size === AGENT_CONTRACTS.length, 'Agent contract IDs must be unique');

for (const id of mapIds) {
  assert(
    contractsById.has(id) || PLATFORM_NODE_IDS.has(id),
    `Map node has no explicit contract or platform classification: ${id}`,
  );
}

for (const contract of AGENT_CONTRACTS) {
  assert(contract.label.trim().length > 0, `Missing label: ${contract.id}`);
  assert(contract.mission.trim().length >= 20, `Mission too weak: ${contract.id}`);
  assert(contract.inputs.length > 0, `No inputs: ${contract.id}`);
  assert(contract.outputs.length > 0, `No outputs: ${contract.id}`);
  assert(contract.mustDo.length > 0, `No mandatory duties: ${contract.id}`);
  assert(contract.mustNot.length > 0, `No prohibited behavior: ${contract.id}`);
  assert(contract.strengths.length > 0, `No strength definition: ${contract.id}`);
  assert(contract.weaknesses.length > 0, `No weakness definition: ${contract.id}`);
  assert(contract.implementation.trim().length > 0, `No implementation mapping: ${contract.id}`);
}

for (const id of [
  'document-reader',
  'case-router',
  'qada-core',
  'official-source',
  'exact-text',
  'amendments',
  'src-bog',
  'src-personnel',
  'src-royal',
  'src-precedents',
  'legislative-flaws',
  'judicial-flaws',
  'procedural-flaws',
  'evidence-flaws',
  'reasoning-flaws',
  'rebuttal-review',
  'admin-final',
  'hujja-bayan',
  'virtual-judge',
  'final-review',
  'security-007',
]) {
  assert(contractsById.has(id), `Critical agent contract missing: ${id}`);
}

const profiles = allCourtProfiles();
assert(profiles.length >= 8, 'Court profile coverage is too narrow');
for (const profile of profiles) {
  assert(profile.mission.trim().length >= 20, `Court profile mission too weak: ${profile.id}`);
  assert(profile.reviewLens.length > 0, `Court profile missing review lens: ${profile.id}`);
  assert(profile.draftingFocus.length > 0, `Court profile missing drafting focus: ${profile.id}`);
  assert(profile.forbiddenShortcuts.length > 0, `Court profile missing forbidden shortcuts: ${profile.id}`);
  assert(
    /متحقق|رسم|مصدر/.test(profile.precedentRule),
    `Court profile may not infer judicial tendency without verified sources: ${profile.id}`,
  );
}
assert(detectCourtProfile('المحكمة الإدارية العليا طعن بالنقض').id === 'administrative-supreme', 'Administrative supreme routing failed');
assert(detectCourtProfile('محكمة الاستئناف الإدارية').id === 'administrative-appeal', 'Administrative appeal routing failed');
assert(detectCourtProfile('المحكمة الإدارية ديوان المظالم').id === 'administrative-first', 'Administrative first-instance routing failed');
assert(detectCourtProfile('المحكمة الجزائية').id === 'criminal-first', 'Criminal court routing failed');
assert(detectCourtProfile('المحكمة العامة مطالبة مالية').id === 'general-first', 'General court routing failed');

const caseProfiles = allCaseStrategyProfiles();
assert(caseProfiles.length >= 8, 'Case strategy profile coverage is too narrow');
for (const profile of caseProfiles) {
  assert(profile.mission.trim().length >= 20, `Case strategy mission too weak: ${profile.id}`);
  assert(profile.elements.length > 0, `Case strategy missing elements: ${profile.id}`);
  assert(profile.evidenceFocus.length > 0, `Case strategy missing evidence focus: ${profile.id}`);
  assert(profile.opposingArguments.length > 0, `Case strategy missing opposing arguments: ${profile.id}`);
  assert(profile.remedyFocus.length > 0, `Case strategy missing remedy focus: ${profile.id}`);
  assert(profile.mandatoryChecks.length > 0, `Case strategy missing mandatory checks: ${profile.id}`);
  assert(profile.forbiddenShortcuts.length > 0, `Case strategy missing forbidden shortcuts: ${profile.id}`);
}
assert(
  detectCaseStrategyProfile('أنا فرد عسكري في وزارة الدفاع وأطالب بعلاوة فنية ومكافأة حاسب').id === 'military-personnel-rights',
  'Military personnel rights strategy routing failed',
);
assert(
  detectCaseStrategyProfile('أطعن في قرار إداري وأطلب إلغاء القرار').id === 'administrative-annulment',
  'Administrative annulment strategy routing failed',
);
assert(
  detectCaseStrategyProfile('سلفت شخص مبلغاً بتحويل بنكي ورفض السداد').id === 'general-money-claim',
  'General money-claim strategy routing failed',
);
assert(
  detectCaseStrategyProfile('قضية جزائية واتهام ومحضر قبض وتفتيش').id === 'criminal-defense',
  'Criminal-defense strategy routing failed',
);

for (const id of [
  'document-reader',
  'legislative-flaws',
  'judicial-flaws',
  'procedural-flaws',
  'evidence-flaws',
  'reasoning-flaws',
  'rebuttal-review',
  'admin-final',
]) {
  assert(
    adminAnalysis.includes(`buildAgentContractInstruction('${id}')`),
    `Runtime analysis prompt is not bound to agent contract: ${id}`,
  );
}
assert(
  hujja.includes("buildAgentContractInstruction('hujja-bayan')")
    && hujja.includes('buildCaseStrategyInstruction'),
  'Hujja must receive both its agent contract and case strategy profile',
);
assert(
  judgesReview.includes("buildAgentContractInstruction('virtual-judge')")
    && judgesReview.includes('buildCourtProfileInstruction')
    && judgesReview.includes('buildCaseStrategyInstruction'),
  'Virtual Judge must receive its contract, court profile, and case strategy profile',
);

const blockers = launchBlockingContracts();
assert(
  blockers.some((contract) => contract.id === 'security-007'),
  '007 must remain a launch blocker until an executable AppSec agent exists',
);
assert(
  blockers.some((contract) => contract.id === 'exact-text'),
  'Exact-text verification must remain launch-visible while literal quotation coverage is partial',
);
assert(
  blockers.some((contract) => contract.id === 'src-personnel'),
  'Personnel-law completeness must remain launch-visible while amendments/regulations are partial',
);
assert(
  blockers.some((contract) => contract.id === 'src-precedents'),
  'Precedent corpus incompleteness must remain launch-visible',
);

console.log(JSON.stringify({
  ok: true,
  mapNodes: mapIds.length,
  agentContracts: AGENT_CONTRACTS.length,
  courtProfiles: profiles.length,
  caseStrategyProfiles: caseProfiles.length,
  launchBlockers: blockers.map((item) => ({
    id: item.id,
    label: item.label,
    readiness: item.readiness,
  })),
}, null, 2));
