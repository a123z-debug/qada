import fs from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const gate = fs.readFileSync('api/_draftReleaseGate.ts', 'utf8');

const sourceQueryBlock = gate.match(/const sourceQuery = \[([\s\S]*?)\]\.filter\(Boolean\)\.join/);
assert(sourceQueryBlock, 'release gate sourceQuery block missing');
assert(!sourceQueryBlock[1].includes('draft'), 'generated draft must not be fed back into source retrieval');
assert(
  gate.includes('ممنوع اقتراح أو افتراض نظرية قانونية بديلة')
    && gate.includes('الإثراء بلا سبب')
    && gate.includes('الفعل الضار'),
  'release gate must explicitly forbid invented substitute legal theories',
);

assert(
  gate.includes('assessClaimLiberation')
    && gate.includes('الدعوى غير محررة')
    && gate.includes('البيانات → الوقائع → المستندات → الطلبات'),
  'release gate must block claims that are not fully liberated across the four mandatory pillars',
);

const chat = fs.readFileSync('api/chat.ts', 'utf8');
assert(chat.includes('shouldActivateDrafting(clientMessages)'), 'chat must gate drafting by current conversation state');
assert(chat.includes('buildConversationStateInstruction(clientMessages)'), 'chat must inject continuation state');
assert(
  chat.includes("isSubstantiveLegalRequest(currentUserTurn)"),
  'professional audit must follow the current turn rather than stale history',
);
assert(!chat.includes('راجعت QADA المسودة قبل تسليمها ولم تعتمدها بعد.'), 'Simple UI must not expose internal draft-gate wording');

console.log(JSON.stringify({ ok: true, regression: 'stale-draft + invented-theory leak' }, null, 2));
