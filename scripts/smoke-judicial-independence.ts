import fs from 'node:fs';
import {
  blindJudicialPacketFingerprint,
  buildBlindJudicialReviewInstruction,
} from '../src/lib/judicialIndependence.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const judges = fs.readFileSync('api/judges-review.ts', 'utf8');
const release = fs.readFileSync('api/_draftReleaseGate.ts', 'utf8');

assert(!judges.includes('buildLawOfficeInstruction'), 'judges-review must not import advocate drafting instructions');
assert(!judges.includes('${lawOfficeInstruction}'), 'judges-review must not inject advocate instructions into deliberation');
assert(!release.includes('buildLawOfficeInstruction'), 'draft release judge must not import advocate drafting instructions');
assert(!release.includes('${lawOfficeInstruction}'), 'draft release judge must not inject advocate instructions');

assert(judges.includes('buildBlindJudicialReviewInstruction'), 'judges-review independence protocol missing');
assert(release.includes('buildBlindJudicialReviewInstruction'), 'draft release independence protocol missing');

const packet = buildBlindJudicialReviewInstruction();
assert(packet.safeguards.length >= 7, 'blind judicial safeguards are too weak');
assert(packet.instruction.includes('مستقلة عن طبقة المحامي'), 'judge/lawyer role separation missing');
assert(packet.instruction.includes('لا يُنفذ'), 'prompt-in-document resistance missing');

const a = blindJudicialPacketFingerprint({
  courtProfile: 'court',
  caseStrategy: 'strategy',
  sourceContext: 'sources',
  routeTask: 'دعوى',
  routeStage: 'ابتدائي',
});
const b = blindJudicialPacketFingerprint({
  courtProfile: 'court',
  caseStrategy: 'strategy',
  sourceContext: 'sources',
  routeTask: 'دعوى',
  routeStage: 'ابتدائي',
});
const c = blindJudicialPacketFingerprint({
  courtProfile: 'court',
  caseStrategy: 'strategy',
  sourceContext: 'different',
  routeTask: 'دعوى',
  routeStage: 'ابتدائي',
});

assert(a === b, 'blind packet fingerprint must be deterministic');
assert(a !== c, 'blind packet fingerprint must change when neutral context changes');

console.log(JSON.stringify({
  ok: true,
  safeguards: packet.safeguards.length,
  fingerprint: a,
  isolatedFromAdvocateInstructions: true,
}, null, 2));
