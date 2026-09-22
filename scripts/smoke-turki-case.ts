import fs from 'node:fs';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const chat = fs.readFileSync('api/chat.ts', 'utf8');
const welcome = fs.readFileSync('src/components/workspaces/WelcomeScreen.tsx', 'utf8');
const floating = fs.readFileSync('src/components/chat/FloatingChatBot.tsx', 'utf8');
const login = fs.readFileSync('src/components/LoginScreen.tsx', 'utf8');
const session = fs.readFileSync('api/session.ts', 'utf8');
const bogLaw = fs.readFileSync('src/data/officialReferences/boardOfGrievancesLaw1428.ts', 'utf8');
const bogProcedure = fs.readFileSync('src/data/officialReferences/boardOfGrievancesProcedureLaw1435.ts', 'utf8');
const personnel = fs.readFileSync('src/data/officialReferences/militaryPersonnelServiceLaw1397.ts', 'utf8');
const sourceAgents = fs.readFileSync('src/lib/legalSourceAgents.ts', 'utf8');

for (const article of ['2', '16', '17', '19']) {
  assert(personnel.includes(`number: '${article}'`), 'military personnel article missing: ' + article);
}
assert(
  personnel.includes('م/37') && personnel.includes("status: 'needs-correction'"),
  'historical M/37 claim must remain explicitly unverified until an official amendment instrument is matched',
);
assert(
  bogLaw.includes("number: '11'") && bogLaw.includes("number: '13'"),
  'Board of Grievances Articles 11 and 13 must be indexed',
);
for (const article of ['33', '45', '46', '53', '54']) {
  assert(bogProcedure.includes(`number: '${article}'`), 'administrative procedure article missing: ' + article);
}
assert(
  bogProcedure.includes('وليست المادة (53) هي منشأ هذا الميعاد'),
  'deadline regression: Article 33 must be distinguished from Article 53',
);
assert(
  chat.includes('لا تعامل المادة أو المرسوم أو القرار الذي يورده المستخدم على أنه صحيح تلقائياً'),
  'user-supplied legal citations must be verified rather than trusted',
);
assert(
  chat.includes('extractAttachmentReferenceHints') && chat.includes('guardIntroducedLegalCitations(sourceQuery'),
  'attached judgments must contribute reference hints to legal retrieval and citation guard',
);
assert(
  chat.includes('سجل رد سابق من QADA') && chat.includes('Final privacy pass'),
  'follow-up context and final reply privacy pass must remain enabled',
);
assert(
  !welcome.includes('setSimpleAttachments([]);'),
  'Simple must retain attached evidence across follow-up questions',
);
assert(
  !floating.includes('setPendingAttachments([]);\n    } finally'),
  'floating assistant must retain evidence across follow-up questions',
);
assert(
  login.includes("action: 'test-access'") && !login.includes("id: 'test-user'"),
  'browser must not manufacture a shared test-user identity',
);
assert(
  !session.includes("cookies(header)[TEST_MODE_COOKIE]"),
  'protected APIs must not authenticate from a client-set legacy test-mode cookie',
);
assert(
  sourceAgents.includes('MILITARY_PERSONNEL_SERVICE_LAW_1397')
    && sourceAgents.includes("ref.status === 'official-verified'"),
  'source agents must include verified personnel materials without promoting needs-correction records',
);

console.log(JSON.stringify({
  ok: true,
  scenario: 'Turki administrative cassation / computer allowance',
  verifiedLegalArticles: {
    boardOfGrievances: ['11', '13'],
    administrativeProcedure: ['33', '45', '46', '53', '54'],
    militaryPersonnel: ['2', '16', '17', '19'],
  },
  historicalAmendmentM37: 'needs-correction',
  attachmentContinuity: true,
  isolatedDirectSessions: true,
}, null, 2));
