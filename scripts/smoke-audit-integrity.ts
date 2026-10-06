process.env.DATA_SECRET = 'qada-test-data-secret-'.padEnd(64, 'x');

import {
  assessAuditIntegrity,
  sealAuditEventIntegrity,
  type AuditEvent,
} from '../api/_audit.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function base(id: string, at: number): AuditEvent {
  return {
    id,
    at,
    actorId: 'actor-hash',
    actorRole: 'admin',
    action: 'test.action',
    outcome: 'success',
    metadata: { scope: 'smoke' },
  };
}

const event1 = sealAuditEventIntegrity(base('audit-1', 1), 1);
const event2 = sealAuditEventIntegrity(base('audit-2', 2), 2);
const event3 = sealAuditEventIntegrity(base('audit-3', 3), 3);

const clean = assessAuditIntegrity([event3, event2, event1]);
assert(clean.status === 'ok', 'valid signed audit sequence must be ok');
assert(clean.sequenceGaps === 0, 'valid sequence has no gaps');
assert(clean.invalidSignatures === 0, 'valid sequence has no bad signatures');

const tampered = { ...event2, action: 'tampered.action' };
const tamperedResult = assessAuditIntegrity([event3, tampered, event1]);
assert(tamperedResult.status === 'failed', 'tampered event must fail integrity');
assert(tamperedResult.invalidSignatures === 1, 'tampered signature must be detected');

const missing = assessAuditIntegrity([event3, event1]);
assert(missing.status === 'warning', 'missing sequence must warn');
assert(missing.sequenceGaps === 1, 'one deleted event must create one sequence gap');

const duplicate = assessAuditIntegrity([event3, { ...event2 }, { ...event2 }, event1]);
assert(duplicate.status === 'failed', 'duplicate sequence must fail integrity');
assert(duplicate.duplicateSequences === 1, 'duplicate sequence must be counted');

console.log(JSON.stringify({
  ok: true,
  clean,
  tampered: tamperedResult,
  missing,
  duplicate,
}, null, 2));
