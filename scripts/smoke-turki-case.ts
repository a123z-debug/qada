import fs from 'node:fs';
import { runLegalSourceAgents } from '../src/lib/legalSourceAgents';

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
const personnel = fs.readFileSync('src/data/officialReferences/personnelServiceLaw1397.ts', 'utf8');
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
  login.includes("action: authMode === 'register' ? 'register' : 'user-login'")
    && !login.includes("action: 'test-access'")
    && !login.includes("id: 'test-user'"),
  'browser must use persistent server accounts and must not manufacture a shared test identity',
);
assert(
  !session.includes("cookies(header)[TEST_MODE_COOKIE]"),
  'protected APIs must not authenticate from a client-set legacy test-mode cookie',
);
assert(
  sourceAgents.includes('PERSONNEL_SERVICE_LAW_1397')
    && sourceAgents.includes("ref.status === 'official-verified'"),
  'source agents must include personnel materials without promoting needs-correction records',
);

const turkiDraftQuery = `
لائحة طعن بالنقض أمام المحكمة الإدارية العليا في حكم محكمة الاستئناف الإدارية.
فرد عسكري بالقوات البرية يطالب بمكافأة الحاسب الآلي، ويستند إلى المادة (53) للميعاد،
والمادة (11) من نظام ديوان المظالم، والمادة (17/ب) والمادة (2/هـ) من نظام خدمة الأفراد،
والمرسوم الملكي م/37 لعام 1430هـ، ويدفع باختلاف مناط العلاوة الفنية ومكافأة الحاسب
وبثبوت الممارسة الفعلية للعمل.
`;
const turkiBundle = runLegalSourceAgents(turkiDraftQuery);
const articleKeys = new Set(
  turkiBundle.packets.flatMap((packet) =>
    packet.verifiedArticles.map((article) => `${article.system}|${article.article}`)
  )
);
for (const key of [
  'نظام ديوان المظالم|11',
  'نظام ديوان المظالم|13',
  'نظام المرافعات أمام ديوان المظالم|33',
  'نظام المرافعات أمام ديوان المظالم|45',
  'نظام المرافعات أمام ديوان المظالم|46',
  'نظام المرافعات أمام ديوان المظالم|53',
  'نظام المرافعات أمام ديوان المظالم|54',
  'نظام خدمة الأفراد|2',
  'نظام خدمة الأفراد|16',
  'نظام خدمة الأفراد|17',
  'نظام خدمة الأفراد|19',
]) {
  assert(articleKeys.has(key), 'Turki semantic retrieval missing controlling article: ' + key);
}
assert(
  turkiBundle.verification.blockers.some((item) => item.includes('م/37') || item.includes('م 37')),
  'Turki query must keep M/37 historical-amendment claim behind an explicit verification blocker',
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
  semanticRetrieval: Array.from(articleKeys).filter((key) => /ديوان المظالم|خدمة الأفراد/.test(key)),
  attachmentContinuity: true,
  persistentEmailPasswordSessions: true,
}, null, 2));
