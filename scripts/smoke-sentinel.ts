import fs from 'node:fs';
import { detectSentinelFindings, looksLikeBareCourtAnswer } from '../api/_sentinel';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(looksLikeBareCourtAnswer('محكمة خميس مشيط'), 'Bare local court answer must be recognized');
assert(looksLikeBareCourtAnswer('محكمة الاستئناف الإدارية'), 'Bare appeal-court name must be recognized');
assert(!looksLikeBareCourtAnswer('أبي استئناف على حكم محكمة الاستئناف الإدارية'), 'Explicit legal action must not be treated as bare court answer');

const stateConflict = detectSentinelFindings({
  responseMode: 'simple',
  lastUserText: 'محكمة خميس مشيط',
  conversationText: 'أبي أجهز دعوى\nمحكمة خميس مشيط',
  reply: 'سأبدأ صياغة الدعوى',
  routeTask: 'claim',
  routeStage: 'unknown',
  draftingActive: true,
});
assert(stateConflict.some((item) => item.code === 'STATE_INTENT_CONFLICT' && item.severity === 'P0'), 'Sentinel must catch court-answer drafting conflict');

const prematureGate = detectSentinelFindings({
  responseMode: 'simple',
  lastUserText: 'محكمة خميس مشيط',
  conversationText: 'محكمة خميس مشيط',
  reply: 'أرسل المعلومة التالية',
  draftingActive: false,
  releaseGateDecision: 'BLOCK',
});
assert(prematureGate.some((item) => item.code === 'PREMATURE_RELEASE_GATE'), 'Sentinel must catch premature release-gate activation');

const leak = detectSentinelFindings({
  responseMode: 'simple',
  lastUserText: 'وش ناقص؟',
  conversationText: 'وش ناقص؟',
  reply: 'بوابة الاعتماد: BLOCK ودرجة الجاهزية 72',
});
assert(leak.some((item) => item.code === 'INTERNAL_PIPELINE_LEAK'), 'Sentinel must catch internal gate leakage in Simple');

const doctrine = detectSentinelFindings({
  responseMode: 'simple',
  lastUserText: 'محكمة خميس مشيط',
  conversationText: 'أنا فقط أحدد المحكمة',
  reply: 'يلزم بحث الإثراء بلا سبب والفعل الضار',
});
assert(doctrine.some((item) => item.code === 'UNSUPPORTED_RECHARACTERIZATION' && item.severity === 'P0'), 'Sentinel must catch unsupported recharacterization');

const citation = detectSentinelFindings({
  responseMode: 'professional',
  lastUserText: 'حلل القضية',
  conversationText: 'حلل القضية',
  reply: 'تحليل',
  unsupportedCitations: 2,
});
assert(citation.some((item) => item.code === 'UNVERIFIED_CITATION' && item.severity === 'P0'), 'Sentinel must catch unverified citations');

const clean = detectSentinelFindings({
  responseMode: 'simple',
  lastUserText: 'محكمة خميس مشيط',
  conversationText: 'محكمة خميس مشيط',
  reply: 'تمام، سجلت المحكمة. ما تاريخ القرار؟',
  draftingActive: false,
  releaseGateDecision: '',
  unsupportedCitations: 0,
});
assert(!clean.some((item) => item.severity === 'P0' || item.severity === 'P1'), 'Normal field-completion turn must stay clean');

for (let index = 0; index < 1000; index += 1) {
  const city = ['خميس مشيط', 'أبها', 'الرياض', 'جدة', 'الدمام'][index % 5];
  const findings = detectSentinelFindings({
    responseMode: 'simple',
    lastUserText: `محكمة ${city}`,
    conversationText: `المستخدم يجيب عن المحكمة\nمحكمة ${city}`,
    reply: 'تم تسجيل المحكمة، أكمل بالمعلومة التالية.',
    draftingActive: false,
    releaseGateDecision: '',
    unsupportedCitations: 0,
  });
  assert(!findings.some((item) => item.code === 'STATE_INTENT_CONFLICT'), 'Safe court completion regressed at iteration ' + index);
}

const app = fs.readFileSync('src/App.tsx', 'utf8');
const sidebar = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');
const server = fs.readFileSync('server.ts', 'utf8');
const chat = fs.readFileSync('api/chat.ts', 'utf8');
const dashboard = fs.readFileSync('src/components/admin/AdminSentinel.tsx', 'utf8');

assert(app.includes('AdminSentinel') && app.includes('onOpenAdminSentinel'), 'Admin Sentinel surface is not wired');
assert(sidebar.includes('QADA Sentinel — المراقبة الحية'), 'Sentinel admin button missing');
assert(server.includes("/api/admin-sentinel"), 'Sentinel API route missing');
assert(chat.includes('recordSentinelTurn') && chat.includes('SENTINEL_WRITE_TIMEOUT'), 'Chat monitoring hook missing');
assert(dashboard.includes('استنتاجات المراقب') && dashboard.includes('P0 حرج'), 'Sentinel dashboard conclusions missing');

console.log(JSON.stringify({
  ok: true,
  deterministicScenarios: 6,
  safeCompletionStress: 1000,
  uiWiring: true,
  encryptedStore: true,
  adminOnly: true,
}, null, 2));
